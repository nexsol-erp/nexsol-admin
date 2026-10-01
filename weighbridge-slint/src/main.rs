// TradeLink247 Weighbridge, Slint edition. Replaces the Qt weighbridge screen on site PCs.
// Reads the indicator, saves weighings on this PC first (works offline), prints the voucher and
// uploads to the TradeLink247 server. Same data folder and database as the Electron build.

#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod app;
mod camera;
mod charge;
mod dialogs;
mod error;
mod http;
mod indicator;
mod logx;
mod paths;
mod pdf;
mod print_win;
mod server_config;
mod settings;
mod settings_lock;
mod store;
mod sync;
mod ui;
mod updater;
mod voucher;
mod webcam;

use std::sync::{mpsc, Arc, Mutex};

const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Two copies would fight over the COM port and the voucher counter.
#[cfg(windows)]
fn already_running() -> bool {
    use windows::core::w;
    use windows::Win32::Foundation::{GetLastError, ERROR_ALREADY_EXISTS};
    use windows::Win32::System::Threading::CreateMutexW;
    unsafe {
        // kept for the life of the process
        let _ = CreateMutexW(None, true, w!("Local\\TradeLink247Weighbridge"));
        GetLastError() == ERROR_ALREADY_EXISTS
    }
}

#[cfg(not(windows))]
fn already_running() -> bool {
    false
}

fn main() {
    if already_running() {
        return;
    }
    crate::info!("start {VERSION} userData {}", paths::user_data().display());
    std::panic::set_hook(Box::new(|p| crate::error!("panic {p}")));

    let store = match store::Store::open(&paths::db_file().to_string_lossy()) {
        Ok(s) => s,
        Err(e) => {
            crate::error!("database {e}");
            eprintln!("Could not open the database: {e}");
            std::process::exit(1);
        }
    };
    let (tx, rx) = mpsc::channel();
    let tx = Mutex::new(tx);
    let core = app::Core::new(
        VERSION,
        store,
        Arc::new(http::RealHttp::new(VERSION)),
        server_config::ServerConfig::from_env(),
        Arc::new(move |e| {
            let _ = tx.lock().unwrap().send(e);
        }),
    );

    // The software renderer works on every PC, including ones with no graphics driver (remote
    // desktop, old onboard graphics). SLINT_BACKEND overrides it.
    if std::env::var_os("SLINT_BACKEND").is_none() {
        let _ = slint::BackendSelector::new().renderer_name("software".into()).select();
    }

    core.start_indicator();
    core.start_camera();
    // a development build would "update" itself to the published one
    let packaged = cfg!(all(windows, not(debug_assertions))) && std::env::var_os("WB_NO_UPDATES").is_none();
    core.start_background(packaged);

    if let Err(e) = ui::run(core.clone(), rx) {
        crate::error!("window {e}");
    }
    core.shutdown();
    crate::info!("stop");
}
