// Log file: <userData>/logs/weighbridge.log, rotated to .old at 8 MB. Logging never stops weighing.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::Mutex;

static FILE: Mutex<Option<fs::File>> = Mutex::new(None);

pub fn write(level: &str, msg: &str) {
    let line = format!("[{}] [{level}] {msg}\n", chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    eprint!("{line}");
    let Ok(mut f) = FILE.lock() else { return };
    if f.is_none() {
        let dir = crate::paths::logs_dir();
        let _ = fs::create_dir_all(&dir);
        let file = dir.join("weighbridge.log");
        if fs::metadata(&file).map(|m| m.len() > 8 * 1024 * 1024).unwrap_or(false) {
            let _ = fs::rename(&file, dir.join("weighbridge.log.old"));
        }
        *f = OpenOptions::new().create(true).append(true).open(file).ok();
    }
    if let Some(file) = f.as_mut() {
        let _ = file.write_all(line.as_bytes());
    }
}

#[macro_export]
macro_rules! info { ($($t:tt)*) => { $crate::logx::write("INFO", &format!($($t)*)) } }
#[macro_export]
macro_rules! warn { ($($t:tt)*) => { $crate::logx::write("WARN", &format!($($t)*)) } }
#[macro_export]
macro_rules! error { ($($t:tt)*) => { $crate::logx::write("ERROR", &format!($($t)*)) } }
