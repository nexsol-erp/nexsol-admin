// Where the app keeps its files.
//   3.0+ installed for the whole PC (with the service): %ProgramData%\TradeLink247 Weighbridge,
//     marked by a ".machine" file the installer and the service create; screens and the service
//     share it.
//   Before that, and in development: the user's folder (same as the Electron app's userData):
//     Windows %APPDATA%\TradeLink247 Weighbridge, elsewhere ~/.config/TradeLink247 Weighbridge.
// WB_USERDATA overrides it (tests, a second copy for training).

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const APP_NAME: &str = "TradeLink247 Weighbridge";
const MARKER: &str = ".machine";

static DATA: OnceLock<PathBuf> = OnceLock::new();

pub fn user_data() -> PathBuf {
    DATA.get_or_init(|| {
        if let Some(p) = std::env::var_os("WB_USERDATA").filter(|p| !p.is_empty()) {
            return PathBuf::from(p);
        }
        if let Some(m) = machine_dir().filter(|m| m.join(MARKER).exists()) {
            return m;
        }
        per_user_dir()
    })
    .clone()
}

/// The service always uses the PC's folder (WB_USERDATA aside); called before anything else.
pub fn use_machine_dir() -> PathBuf {
    let dir = std::env::var_os("WB_USERDATA").filter(|p| !p.is_empty()).map(PathBuf::from).or_else(machine_dir).unwrap_or_else(per_user_dir);
    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::write(dir.join(MARKER), "Data of the TradeLink247 Weighbridge service and screens\r\n");
    let _ = DATA.set(dir.clone());
    user_data()
}

/// Installed for the whole PC (3.0+): the screens talk to the service instead of the indicator.
pub fn machine_install() -> bool {
    std::env::var_os("WB_SCREEN").is_some() || machine_dir().is_some_and(|m| m.join(MARKER).exists())
}

fn machine_dir() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("ProgramData").map(|p| PathBuf::from(p).join(APP_NAME))
    } else {
        None
    }
}

fn per_user_dir() -> PathBuf {
    dirs::config_dir().unwrap_or_else(std::env::temp_dir).join(APP_NAME)
}

pub fn ipc_token_file() -> PathBuf {
    user_data().join("ipc.token")
}

/// The per-user data folders of the 2.x app on this PC (C:\Users\*\AppData\Roaming\...), newest
/// database first, for the service's first start.
pub fn per_user_copies() -> Vec<PathBuf> {
    let users = std::env::var_os("PUBLIC").and_then(|p| Path::new(&p).parent().map(Path::to_path_buf)).unwrap_or_else(|| PathBuf::from(r"C:\Users"));
    let mut found: Vec<(std::time::SystemTime, PathBuf)> = std::fs::read_dir(users)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path().join("AppData").join("Roaming").join(APP_NAME))
        .filter_map(|d| {
            let m = std::fs::metadata(d.join("weighbridge.db")).and_then(|m| m.modified()).ok()?;
            Some((m, d))
        })
        .collect();
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found.into_iter().map(|(_, d)| d).collect()
}

pub fn db_file() -> PathBuf {
    user_data().join("weighbridge.db")
}

pub fn photos_dir() -> PathBuf {
    user_data().join("photos")
}

pub fn logs_dir() -> PathBuf {
    user_data().join("logs")
}

pub fn updates_dir() -> PathBuf {
    user_data().join("updates")
}

/// Documents\TradeLink247 Weighbridge\Vouchers, where the PDF copies go unless Settings say otherwise.
pub fn default_pdf_dir() -> PathBuf {
    dirs::document_dir().unwrap_or_else(user_data).join(APP_NAME).join("Vouchers")
}

/// The folder the .exe is in.
pub fn exe_dir() -> PathBuf {
    std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())).unwrap_or_else(|| PathBuf::from("."))
}

/// Opens a folder in Explorer (or the desktop's file manager).
pub fn open_folder(p: &std::path::Path) {
    let _ = std::fs::create_dir_all(p);
    #[cfg(windows)]
    let cmd = "explorer";
    #[cfg(target_os = "macos")]
    let cmd = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let cmd = "xdg-open";
    let _ = std::process::Command::new(cmd).arg(p).spawn();
}
