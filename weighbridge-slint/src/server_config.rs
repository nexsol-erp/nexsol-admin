// Which backend server this app talks to. Same rules and file as the POS and the Electron app
// (electron/serverConfig.js):
//
// One build works against any server (ours, a customer's own, or a new domain after a move). The
// choice is saved in <userData>/server.json, which survives reinstalls and upgrades. Resolution,
// first match wins:
//   1. <userData>/server.json            the confirmed choice
//   2. --server=https://…                passed by the launcher
//   3. pos-config.json next to the exe   legacy installs; migrated silently
//   4. build default                     used but NOT confirmed: the app shows "Connect to server"

use crate::http::Http;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const DEFAULT_SERVER: &str = "https://www.tradelink247.com";
const SERVER_INFO_PATH: &str = "/api/updates/pos/server-info";
const LEGACY_CHECK_PATH: &str = "/api/pos-app/update-check?platform=WINDOWS&currentVersion=0.0.0";

#[derive(Debug, Clone, PartialEq, Default)]
pub struct ServerState {
    pub api_server: String,
    pub name: String,
    pub confirmed: bool,
    /// saved | launcher | legacy | default
    pub source: String,
}

fn is_private_host(host: &str) -> bool {
    let octet2 = || host.split('.').nth(1).and_then(|s| s.parse::<u8>().ok()).unwrap_or(0);
    host == "localhost" || host.starts_with("127.") || host.starts_with("10.") || host.starts_with("192.168.") || (host.starts_with("172.") && (16..=31).contains(&octet2()))
}

/// "erp.example.com/" → "https://erp.example.com". None for anything that isn't a bare
/// scheme://host[:port]. Plain http is only accepted for localhost and LAN addresses.
pub fn normalize_server(input: &str) -> Option<String> {
    let mut u = input.trim().to_lowercase();
    if u.is_empty() {
        return None;
    }
    if !u.contains("://") {
        u = format!("https://{u}");
    }
    while u.ends_with('/') {
        u.pop();
    }
    let (scheme, rest) = u.split_once("://")?;
    if scheme != "http" && scheme != "https" {
        return None;
    }
    let (host, port) = match rest.rsplit_once(':') {
        Some((h, p)) => (h, Some(p)),
        None => (rest, None),
    };
    if host.is_empty() || !host.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '.' || c == '-') {
        return None;
    }
    if let Some(p) = port {
        if p.is_empty() || p.len() > 5 || !p.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
    }
    if scheme == "http" && !is_private_host(host) {
        return None;
    }
    Some(u)
}

fn read_json(p: &Path) -> Option<Value> {
    std::fs::read_to_string(p).ok().and_then(|t| serde_json::from_str(&t).ok())
}

pub struct ServerConfig {
    pub user_file: PathBuf,
    pub legacy_file: PathBuf,
    pub arg: Option<String>,
}

impl ServerConfig {
    pub fn from_env() -> ServerConfig {
        let arg = std::env::args().find_map(|a| a.strip_prefix("--server=").map(String::from));
        ServerConfig {
            user_file: crate::paths::user_data().join("server.json"),
            legacy_file: crate::paths::exe_dir().join("pos-config.json"),
            arg,
        }
    }

    pub fn save(&self, api_server: &str, name: &str) -> Result<String, String> {
        let api = normalize_server(api_server).ok_or("Invalid server address")?;
        let ws = api.replacen("https://", "wss://", 1).replacen("http://", "ws://", 1);
        let out = json!({
            "apiServer": api, "wsServer": ws, "aiServer": api, "name": name,
            "savedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        });
        if let Some(d) = self.user_file.parent() {
            std::fs::create_dir_all(d).map_err(|e| e.to_string())?;
        }
        std::fs::write(&self.user_file, serde_json::to_string_pretty(&out).unwrap_or_default()).map_err(|e| e.to_string())?;
        Ok(api)
    }

    pub fn state(&self) -> ServerState {
        let saved = read_json(&self.user_file);
        let saved_api = saved.as_ref().and_then(|s| s.get("apiServer")).and_then(|v| v.as_str()).and_then(normalize_server);
        if let Some(api) = saved_api {
            let name = saved.as_ref().and_then(|s| s.get("name")).and_then(|v| v.as_str()).unwrap_or("").to_string();
            return ServerState { api_server: api, name, confirmed: true, source: "saved".into() };
        }
        // The launcher only passes a server it confirmed, so trust it.
        if let Some(api) = self.arg.as_deref().and_then(normalize_server) {
            let _ = self.save(&api, "");
            return ServerState { api_server: api, name: String::new(), confirmed: true, source: "launcher".into() };
        }
        let legacy = read_json(&self.legacy_file).and_then(|l| l.get("apiServer").and_then(|v| v.as_str()).and_then(normalize_server));
        if let Some(api) = legacy {
            let _ = self.save(&api, "");
            return ServerState { api_server: api, name: String::new(), confirmed: true, source: "legacy".into() };
        }
        ServerState { api_server: DEFAULT_SERVER.into(), name: String::new(), confirmed: false, source: "default".into() }
    }
}

/// Asks a server who it is. Ok((apiServer, name)) or Err(why). Servers without the server-info
/// endpoint are still accepted if they answer the older launcher update check.
pub fn check_server(http: &dyn Http, input: &str) -> Result<(String, String), String> {
    let base = normalize_server(input).ok_or("Enter an address like https://erp.example.com")?;
    let get = |url: String| http.send("GET", &url, &[("Accept".into(), "application/json".into())], None, Duration::from_secs(10));
    let info = get(format!("{base}{SERVER_INFO_PATH}")).map_err(|e| format!("Could not reach the server: {e}"))?;
    if info.status == 200 {
        if let Some(b) = info.json().filter(|b| b.get("product").and_then(|p| p.as_str()) == Some("TradeLink247")) {
            let api = b.get("apiServer").and_then(|v| v.as_str()).and_then(normalize_server).unwrap_or(base);
            let name = b.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            return Ok((api, name));
        }
    }
    let legacy = get(format!("{base}{LEGACY_CHECK_PATH}")).map_err(|e| format!("Could not reach the server: {e}"))?;
    if legacy.status == 200 && legacy.json().is_some_and(|b| b.get("updateAvailable").is_some_and(|v| v.is_boolean())) {
        return Ok((base, String::new()));
    }
    Err("That address didn't answer as a TradeLink247 server.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_addresses() {
        assert_eq!(normalize_server("erp.example.com/").as_deref(), Some("https://erp.example.com"));
        assert_eq!(normalize_server("HTTPS://WWW.TradeLink247.com").as_deref(), Some("https://www.tradelink247.com"));
        assert_eq!(normalize_server("http://192.168.1.5:8080").as_deref(), Some("http://192.168.1.5:8080"));
        assert_eq!(normalize_server("http://example.com"), None, "no plain http to a public host");
        assert_eq!(normalize_server("https://a.com/path"), None);
        assert_eq!(normalize_server(""), None);
    }

    #[test]
    fn saved_choice_then_launcher_then_default() {
        let dir = std::env::temp_dir().join(format!("wbcfg-{}", uuid::Uuid::new_v4()));
        let cfg = ServerConfig { user_file: dir.join("server.json"), legacy_file: dir.join("pos-config.json"), arg: None };
        let st = cfg.state();
        assert!(!st.confirmed);
        assert_eq!(st.api_server, DEFAULT_SERVER);
        let cfg2 = ServerConfig { arg: Some("erp.x.com".into()), ..cfg };
        assert_eq!(cfg2.state().source, "launcher");
        let cfg3 = ServerConfig { arg: None, ..cfg2 };
        let st = cfg3.state();
        assert_eq!((st.api_server.as_str(), st.confirmed, st.source.as_str()), ("https://erp.x.com", true, "saved"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
