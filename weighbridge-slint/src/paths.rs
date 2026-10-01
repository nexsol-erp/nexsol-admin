// Where the app keeps its files. Same folder as the Electron app's userData, so a test PC keeps its
// weighings, settings, photos and server choice:
//   Windows: %APPDATA%\TradeLink247 Weighbridge
//   elsewhere (development): ~/.config/TradeLink247 Weighbridge
// WB_USERDATA overrides it (tests, a second copy for training).

use std::path::PathBuf;

pub const APP_NAME: &str = "TradeLink247 Weighbridge";

pub fn user_data() -> PathBuf {
    if let Some(p) = std::env::var_os("WB_USERDATA").filter(|p| !p.is_empty()) {
        return PathBuf::from(p);
    }
    dirs::config_dir().unwrap_or_else(std::env::temp_dir).join(APP_NAME)
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
