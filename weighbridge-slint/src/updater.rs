// Keeps the app up to date from the server it is connected to. The server publishes the newest
// installer at /api/updates/weighbridge (latest.json + download, filled by the weighbridge CI).
// A newer version is downloaded in the background; it is installed only when the operator clicks
// "Restart to update" or when the app is closed, never in the middle of a weighing.

use crate::http::Http;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

pub const FIRST_CHECK: Duration = Duration::from_secs(20);
pub const CHECK_EVERY: Duration = Duration::from_secs(30 * 60);
const MIN_INSTALLER_BYTES: u64 = 1024 * 1024;

/// "1.2.10" > "1.2.9". Anything that isn't dotted numbers compares as 0.
pub fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parts = |s: &str| -> Vec<u64> { s.split(['.', '-']).map(|x| x.trim().parse().unwrap_or(0)).collect() };
    let (pa, pb) = (parts(a), parts(b));
    for i in 0..pa.len().max(pb.len()).max(3) {
        let d = pa.get(i).unwrap_or(&0).cmp(pb.get(i).unwrap_or(&0));
        if d.is_ne() {
            return d;
        }
    }
    std::cmp::Ordering::Equal
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct UpdateState {
    /// idle | checking | downloading | ready | error | none
    pub status: String,
    pub version: String,
    pub file: Option<PathBuf>,
    pub error: String,
}

pub struct Updater {
    pub current: String,
    pub dir: PathBuf,
    state: Mutex<UpdateState>,
    busy: Mutex<()>,
}

impl Updater {
    pub fn new(current: &str, dir: PathBuf) -> Updater {
        Updater { current: current.into(), dir, state: Mutex::new(UpdateState { status: "idle".into(), ..Default::default() }), busy: Mutex::new(()) }
    }

    pub fn state(&self) -> UpdateState {
        self.state.lock().unwrap().clone()
    }

    /// Screen: the service's update state (the service downloads and installs).
    pub fn mirror(&self, st: UpdateState) {
        *self.state.lock().unwrap() = st;
    }

    fn set(&self, f: impl FnOnce(&mut UpdateState)) {
        f(&mut self.state.lock().unwrap());
    }

    pub fn installer_path(&self, version: &str) -> PathBuf {
        self.dir.join(format!("TradeLink247-Weighbridge-Setup-{version}.exe"))
    }

    /// Asks the server for the newest version and downloads it if it is newer than this app.
    /// `on_state` sees each step (checking, downloading, ready).
    pub fn check(&self, http: &dyn Http, server: &str, on_state: &dyn Fn(&UpdateState)) -> UpdateState {
        let Ok(_busy) = self.busy.try_lock() else { return self.state() };
        if self.state().status == "ready" || server.is_empty() {
            return self.state();
        }
        self.set(|s| { s.status = "checking".into(); s.error.clear(); });
        on_state(&self.state());
        let result = (|| -> Result<(), String> {
            let res = http
                .send("GET", &format!("{server}/api/updates/weighbridge/latest.json"), &[("Accept".into(), "application/json".into())], None, Duration::from_secs(20))
                .map_err(|e| format!("update check: {e}"))?;
            if res.status == 404 {
                self.set(|s| s.status = "none".into());
                return Ok(());
            }
            if !res.ok() {
                return Err(format!("update check: HTTP {}", res.status));
            }
            let info = res.json().unwrap_or_default();
            let version = info.get("version").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if version.is_empty() || compare_versions(&version, &self.current).is_le() {
                self.set(|s| { s.status = "none".into(); s.version = version.clone(); });
                return Ok(());
            }
            let file = self.installer_path(&version);
            if !valid(&file) {
                self.set(|s| { s.status = "downloading".into(); s.version = version.clone(); });
                on_state(&self.state());
                let rel = info.get("url").and_then(|v| v.as_str()).unwrap_or("/api/updates/weighbridge/download");
                let url = if rel.starts_with("http") { rel.to_string() } else { format!("{server}{rel}") };
                self.download(http, &url, &file)?;
            }
            crate::info!("update ready {version} {}", file.display());
            self.set(|s| { s.status = "ready".into(); s.version = version; s.file = Some(file); });
            Ok(())
        })();
        if let Err(e) = result {
            crate::warn!("update check failed {e}");
            self.set(|s| { s.status = "error".into(); s.error = e; });
        }
        on_state(&self.state());
        self.state()
    }

    fn download(&self, http: &dyn Http, url: &str, file: &Path) -> Result<(), String> {
        std::fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        let res = http.send("GET", url, &[], None, Duration::from_secs(600)).map_err(|e| format!("download: {e}"))?;
        if !res.ok() {
            return Err(format!("download: HTTP {}", res.status));
        }
        if let Some(n) = res.content_length.filter(|n| *n != res.body.len() as u64) {
            return Err(format!("download incomplete ({} of {n} bytes)", res.body.len()));
        }
        let part = file.with_extension("exe.part");
        std::fs::write(&part, &res.body).map_err(|e| e.to_string())?;
        if !valid(&part) {
            let _ = std::fs::remove_file(&part);
            return Err("downloaded file is not a Windows installer".into());
        }
        std::fs::rename(&part, file).map_err(|e| e.to_string())?;
        // keep only this installer
        if let Ok(rd) = std::fs::read_dir(&self.dir) {
            for e in rd.flatten() {
                if e.path() != file {
                    let _ = std::fs::remove_file(e.path());
                }
            }
        }
        Ok(())
    }

    /// Runs the downloaded installer silently and returns true; the caller then quits so it can
    /// replace the files. relaunch: start the new version when done ("Restart to update").
    pub fn run_installer(&self, relaunch: bool) -> bool {
        let st = self.state();
        let Some(file) = st.file.filter(|_| st.status == "ready") else { return false };
        if !cfg!(windows) {
            return false;
        }
        crate::info!("installing update {} {}", st.version, if relaunch { "and restarting" } else { "on close" });
        let mut cmd = std::process::Command::new(&file);
        cmd.arg("/S");
        if relaunch {
            cmd.arg("/RUN");
        }
        let ok = match cmd.spawn() {
            Ok(_) => true,
            // 740: the installer needs an administrator (3.0 installs for the whole PC and its
            // service): ask Windows for one, so whoever knows the admin password can approve it
            Err(e) if e.raw_os_error() == Some(740) => run_as_admin(&file, if relaunch { "/S /RUN" } else { "/S" }),
            Err(e) => {
                crate::warn!("installer {e}");
                false
            }
        };
        if !ok {
            // not again until the next check downloads it afresh
            self.set(|s| {
                s.status = "error".into();
                s.error = "The update could not be installed".into();
            });
        }
        ok
    }
}

#[cfg(windows)]
fn run_as_admin(file: &Path, args: &str) -> bool {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
    let (verb, file, args) = (HSTRING::from("runas"), HSTRING::from(file.as_os_str()), HSTRING::from(args));
    let r = unsafe { ShellExecuteW(None, &verb, &file, &args, PCWSTR::null(), SW_SHOWNORMAL) };
    // above 32 is success; the operator may also have said no
    let ok = r.0 as isize > 32;
    crate::info!("installer as administrator: {}", if ok { "started" } else { "not approved" });
    ok
}

#[cfg(not(windows))]
fn run_as_admin(_file: &Path, _args: &str) -> bool {
    false
}

/// A Windows program ("MZ" header) of a plausible size. Partial downloads never get this name.
fn valid(file: &Path) -> bool {
    use std::io::Read;
    let Ok(meta) = std::fs::metadata(file) else { return false };
    if meta.len() < MIN_INSTALLER_BYTES {
        return false;
    }
    let mut head = [0u8; 2];
    std::fs::File::open(file).and_then(|mut f| f.read_exact(&mut head)).is_ok() && &head == b"MZ"
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::http::Response;
    use std::cmp::Ordering;

    struct Srv {
        version: String,
        body: Vec<u8>,
        length: u64,
        latest_status: u16,
        calls: Mutex<Vec<String>>,
    }

    fn exe() -> Vec<u8> {
        let mut v = b"MZ".to_vec();
        v.extend(vec![1u8; 1024 * 1024 + 10]);
        v
    }

    fn srv() -> Srv {
        let body = exe();
        Srv { version: "2.0.1".into(), length: body.len() as u64, body, latest_status: 200, calls: Mutex::new(vec![]) }
    }

    impl Http for Srv {
        fn send(&self, _m: &str, url: &str, _h: &[(String, String)], _b: Option<Vec<u8>>, _t: Duration) -> Result<Response, String> {
            self.calls.lock().unwrap().push(url.to_string());
            if url.ends_with("/latest.json") {
                let body = serde_json::to_vec(&serde_json::json!({ "version": self.version, "url": "/api/updates/weighbridge/download" })).unwrap();
                return Ok(Response { status: self.latest_status, body, content_length: None });
            }
            Ok(Response { status: 200, body: self.body.clone(), content_length: Some(self.length) })
        }
    }

    fn tmp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("wb-upd-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn compares_numerically() {
        assert_eq!(compare_versions("1.0.10", "1.0.9"), Ordering::Greater);
        assert_eq!(compare_versions("1.0.1", "1.0.1"), Ordering::Equal);
        assert_eq!(compare_versions("1.0", "1.0.1"), Ordering::Less);
        assert_eq!(compare_versions("1.0.9", "2.0.0"), Ordering::Less, "the Electron builds never replace this app");
    }

    #[test]
    fn downloads_newer_and_reports_ready() {
        let dir = tmp();
        let s = srv();
        let u = Updater::new("2.0.0", dir.clone());
        let st = u.check(&s, "https://srv", &|_| {});
        assert_eq!((st.status.as_str(), st.version.as_str()), ("ready", "2.0.1"));
        assert!(dir.join("TradeLink247-Weighbridge-Setup-2.0.1.exe").exists());
        assert_eq!(*s.calls.lock().unwrap(), vec!["https://srv/api/updates/weighbridge/latest.json", "https://srv/api/updates/weighbridge/download"]);
    }

    #[test]
    fn same_or_older_or_nothing_published() {
        let s = Srv { version: "2.0.0".into(), ..srv() };
        assert_eq!(Updater::new("2.0.0", tmp()).check(&s, "https://srv", &|_| {}).status, "none");
        assert_eq!(s.calls.lock().unwrap().len(), 1);
        let s = Srv { latest_status: 404, ..srv() };
        assert_eq!(Updater::new("2.0.0", tmp()).check(&s, "https://srv", &|_| {}).status, "none");
    }

    #[test]
    fn broken_or_short_download_not_kept() {
        let dir = tmp();
        let s = Srv { body: b"<html>not found</html>".to_vec(), length: 22, ..srv() };
        assert_eq!(Updater::new("2.0.0", dir.clone()).check(&s, "https://srv", &|_| {}).status, "error");
        let s = Srv { length: exe().len() as u64 + 5, ..srv() };
        assert!(Updater::new("2.0.0", dir.clone()).check(&s, "https://srv", &|_| {}).error.contains("incomplete"));
        let exes = std::fs::read_dir(&dir).unwrap().flatten().filter(|e| e.path().extension().is_some_and(|x| x == "exe")).count();
        assert_eq!(exes, 0);
    }

    #[test]
    fn existing_installer_reused_older_removed() {
        let dir = tmp();
        std::fs::write(dir.join("TradeLink247-Weighbridge-Setup-2.0.0.exe"), exe()).unwrap();
        Updater::new("2.0.0", dir.clone()).check(&srv(), "https://srv", &|_| {});
        let again = srv();
        assert_eq!(Updater::new("2.0.0", dir.clone()).check(&again, "https://srv", &|_| {}).status, "ready");
        assert_eq!(again.calls.lock().unwrap().len(), 1, "no second download");
        let names: Vec<String> = std::fs::read_dir(&dir).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        assert_eq!(names, vec!["TradeLink247-Weighbridge-Setup-2.0.1.exe"]);
    }
}
