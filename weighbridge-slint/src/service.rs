// The weighbridge service (3.0+): "TradeLink247 Weighbridge.exe --service", started by Windows
// at boot and restarted if it stops. It reads the indicator, records every vehicle on the bridge
// with its photo, uploads to the server and installs updates, whether or not anyone is logged in
// or the window is open. The screens (the same exe without --service) connect to it (ipc.rs).
// On other systems `--service` runs the same thing in the foreground, for development.

use crate::app::{Core, Role};
use crate::ipc::{self, Hub};
use crate::{http, paths, server_config, store};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Weak};
use std::time::Duration;

#[cfg_attr(not(windows), allow(dead_code))]
pub const NAME: &str = "TradeLink247Weighbridge";

struct Link(Weak<Core>, String);

impl ipc::Service for Link {
    fn version(&self) -> String {
        self.1.clone()
    }
    fn greeting(&self) -> Vec<serde_json::Value> {
        self.0.upgrade().map(|c| c.greeting()).unwrap_or_default()
    }
    fn request(&self, cmd: &serde_json::Value) -> Option<serde_json::Value> {
        self.0.upgrade()?.serve_request(cmd)
    }
    fn changed(&self) {
        if let Some(c) = self.0.upgrade() {
            c.screens_changed();
        }
    }
}

/// Runs until `stop` says so (the service manager, or the process being killed). `ready` is
/// called once the data is in place, so the installer can open the screen after it.
pub fn run(version: &'static str, stop: mpsc::Receiver<()>, ready: &dyn Fn()) -> bool {
    let dir = paths::use_machine_dir();
    crate::info!("service start {version} data {}", dir.display());
    if let Err(e) = take_over_per_user_data(&dir) {
        crate::error!("copying the old data {e}");
    }
    let store = match store::Store::open(&paths::db_file().to_string_lossy()) {
        Ok(s) => s,
        Err(e) => {
            crate::error!("service database {e}");
            return false;
        }
    };
    ready();
    let hub = Hub::new();
    let weak = std::sync::OnceLock::<Weak<Core>>::new();
    let weak = Arc::new(weak);
    let (h, w) = (hub.clone(), weak.clone());
    let core = Core::new(
        version,
        store,
        Arc::new(http::RealHttp::new(version)),
        server_config::ServerConfig::from_env(),
        Arc::new(move |e| {
            if let Some(c) = w.get().and_then(Weak::upgrade) {
                if let Some(v) = c.event_json(&e) {
                    h.broadcast(&v);
                }
            }
        }),
    );
    let _ = weak.set(Arc::downgrade(&core));
    core.set_role(Role::Service(hub.clone()));
    core.start_indicator();
    core.start_camera();
    let packaged = cfg!(all(windows, not(debug_assertions))) && std::env::var_os("WB_NO_UPDATES").is_none();
    core.start_background(packaged);
    let token = ipc::token(&paths::ipc_token_file());
    let port = std::env::var("WB_IPC_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(ipc::PORT);
    if let Err(e) = ipc::serve_on(port, Arc::new(Link(Arc::downgrade(&core), version.to_string())), hub, token) {
        crate::error!("service link 127.0.0.1:{port} {e}");
    }
    let _ = stop.recv();
    core.shutdown();
    crate::info!("service stop");
    true
}

/// First start of the service on a PC that ran 2.x: copy that app's data (newest of any user)
/// into the PC's folder, so weighings, settings, server choice and photos carry on. The 2.x files
/// stay where they were.
fn take_over_per_user_data(dir: &Path) -> std::io::Result<()> {
    if dir.join("weighbridge.db").exists() {
        return Ok(());
    }
    let Some(old) = paths::per_user_copies().into_iter().find(|d| d != dir) else { return Ok(()) };
    crate::info!("service copying 2.x data from {}", old.display());
    for f in ["weighbridge.db", "weighbridge.db-wal", "weighbridge.db-shm", "server.json"] {
        if old.join(f).exists() {
            std::fs::copy(old.join(f), dir.join(f))?;
        }
    }
    copy_dir(&old.join("photos"), &dir.join("photos"))?;
    // photo paths in the database point at the old folder
    let s = store::Store::open(&dir.join("weighbridge.db").to_string_lossy()).map_err(|e| std::io::Error::other(e.to_string()))?;
    s.move_photo_paths(&old.to_string_lossy(), &dir.to_string_lossy()).map_err(|e| std::io::Error::other(e.to_string()))?;
    Ok(())
}

fn copy_dir(from: &Path, to: &Path) -> std::io::Result<()> {
    if !from.is_dir() {
        return Ok(());
    }
    std::fs::create_dir_all(to)?;
    for e in std::fs::read_dir(from)?.flatten() {
        let (src, dst): (PathBuf, PathBuf) = (e.path(), to.join(e.file_name()));
        if src.is_dir() {
            copy_dir(&src, &dst)?;
        } else if !dst.exists() {
            std::fs::copy(&src, &dst)?;
        }
    }
    Ok(())
}

/// The screen after an update: "--relaunch <exe> <old version>", run from a temporary copy of the
/// old exe. Waits for the service to come back on a newer version (a few minutes at most), then
/// starts the screen again.
pub fn relaunch(exe: &Path, old_version: &str) {
    let token = paths::ipc_token_file();
    for _ in 0..60 {
        std::thread::sleep(Duration::from_secs(2));
        let (tx, rx) = mpsc::channel();
        let tx = std::sync::Mutex::new(tx);
        let port = std::env::var("WB_IPC_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(ipc::PORT);
        let r = ipc::Remote::start(port, token.clone(), move |v| {
            if v["t"] == "connected" {
                let _ = tx.lock().unwrap().send(v["version"].as_str().unwrap_or("").to_string());
            }
        });
        let v = rx.recv_timeout(Duration::from_secs(3)).ok();
        drop(r);
        if let Some(v) = v.filter(|v| !v.is_empty() && v != old_version) {
            crate::info!("update installed ({old_version} -> {v}): starting the screen again");
            let _ = std::process::Command::new(exe).spawn();
            return;
        }
    }
    // the service didn't come back on a new version: start the screen anyway
    let _ = std::process::Command::new(exe).spawn();
}

/// Before closing for an update: a copy of this exe in %TEMP% that starts the new screen later
/// (this exe is about to be replaced).
pub fn spawn_relauncher(version: &str) {
    let Ok(exe) = std::env::current_exe() else { return };
    let tmp = std::env::temp_dir().join(format!("wb-relaunch-{}.exe", std::process::id()));
    if std::fs::copy(&exe, &tmp).is_err() {
        return;
    }
    let _ = std::process::Command::new(&tmp).arg("--relaunch").arg(&exe).arg(version).spawn();
}

/// Screen of a 3.0 install: this user's 2.x copy (installed per user under
/// %LOCALAPPDATA%\Programs) is removed quietly, so its shortcuts don't start the old version.
/// Its data stays (the service copied it).
pub fn remove_per_user_install() {
    if !cfg!(windows) {
        return;
    }
    let Some(dir) = dirs::data_local_dir().map(|d| d.join("Programs").join(paths::APP_NAME)) else { return };
    let uninstaller = dir.join("Uninstall.exe");
    let inside = std::env::current_exe().is_ok_and(|e| e.starts_with(&dir));
    if uninstaller.exists() && !inside {
        crate::info!("removing the old per-user install {}", dir.display());
        let _ = std::process::Command::new(uninstaller).arg("/S").spawn();
    }
}

/// Old relaunch copies, once they're done.
pub fn clean_relaunchers() {
    let Ok(rd) = std::fs::read_dir(std::env::temp_dir()) else { return };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        if name.starts_with("wb-relaunch-") && name.ends_with(".exe") {
            let _ = std::fs::remove_file(e.path());
        }
    }
}

/// Under the Windows service manager.
#[cfg(windows)]
pub mod windows_svc {
    use std::ffi::OsString;
    use std::sync::mpsc;
    use std::time::Duration;
    use windows_service::service::{ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType};
    use windows_service::service_control_handler::{self, ServiceControlHandlerResult};
    use windows_service::{define_windows_service, service_dispatcher};

    define_windows_service!(ffi_main, service_main);

    pub fn start() -> bool {
        service_dispatcher::start(super::NAME, ffi_main).is_ok()
    }

    fn status(state: ServiceState, accept: ServiceControlAccept) -> ServiceStatus {
        status_code(state, accept, 0)
    }

    fn status_code(state: ServiceState, accept: ServiceControlAccept, code: u32) -> ServiceStatus {
        ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: state,
            controls_accepted: accept,
            exit_code: ServiceExitCode::Win32(code),
            checkpoint: 0,
            wait_hint: Duration::from_secs(120),
            process_id: None,
        }
    }

    fn service_main(_args: Vec<OsString>) {
        let (tx, rx) = mpsc::channel();
        let tx = std::sync::Mutex::new(tx);
        let handler = move |c| match c {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                let _ = tx.lock().unwrap().send(());
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        };
        let Ok(h) = service_control_handler::register(super::NAME, handler) else { return };
        // "starting" while the first start copies the 2.x data; "net start" in the installer waits
        let _ = h.set_service_status(status(ServiceState::StartPending, ServiceControlAccept::empty()));
        let running = || {
            let _ = h.set_service_status(status(ServiceState::Running, ServiceControlAccept::STOP | ServiceControlAccept::SHUTDOWN));
        };
        let ok = super::run(crate::VERSION, rx, &running);
        // a failed start counts as a failure, so Windows starts it again (sc failureflag)
        let _ = h.set_service_status(status_code(ServiceState::Stopped, ServiceControlAccept::empty(), if ok { 0 } else { 1064 }));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_data_copied_once_with_photo_paths_moved() {
        let base = std::env::temp_dir().join(format!("wb-svc-{}", uuid::Uuid::new_v4()));
        let old = base.join("old");
        let new = base.join("new");
        std::fs::create_dir_all(old.join("photos").join("2026-10")).unwrap();
        std::fs::create_dir_all(&new).unwrap();
        let photo = old.join("photos").join("2026-10").join("p.jpg");
        std::fs::write(&photo, [0xff, 0xd8]).unwrap();
        std::fs::write(old.join("server.json"), "{}").unwrap();
        {
            let s = store::Store::open(&old.join("weighbridge.db").to_string_lossy()).unwrap();
            s.add_engage_with_photo(9000.0, "WB1", None, Some((&photo.to_string_lossy(), true))).unwrap();
        }
        copy_dir(&old.join("photos"), &new.join("photos")).unwrap();
        for f in ["weighbridge.db", "weighbridge.db-wal", "weighbridge.db-shm", "server.json"] {
            if old.join(f).exists() {
                std::fs::copy(old.join(f), new.join(f)).unwrap();
            }
        }
        let s = store::Store::open(&new.join("weighbridge.db").to_string_lossy()).unwrap();
        s.move_photo_paths(&old.to_string_lossy(), &new.to_string_lossy()).unwrap();
        let path = s.engage_photo_paths().pop().unwrap();
        assert!(path.starts_with(&*new.to_string_lossy()), "{path}");
        assert!(Path::new(&path).exists());
        assert!(new.join("server.json").exists());
        // the folder already has a database: nothing is copied again
        take_over_per_user_data(&new).unwrap();
        let _ = std::fs::remove_dir_all(base);
    }
}
