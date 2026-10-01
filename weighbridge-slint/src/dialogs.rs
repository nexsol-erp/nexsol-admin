// Windows file dialogs (save a CSV or profile, open a profile, choose the PDF folder). Other
// systems are for development only: saves go to the Documents folder, and there is no picker.

use std::path::PathBuf;

#[cfg(windows)]
pub fn save_file(title: &str, name: &str, kind: &str, ext: &str) -> Option<PathBuf> {
    rfd::FileDialog::new().set_title(title).set_file_name(name).add_filter(kind, &[ext]).save_file()
}

#[cfg(windows)]
pub fn open_file(title: &str, kind: &str, ext: &str) -> Option<PathBuf> {
    rfd::FileDialog::new().set_title(title).add_filter(kind, &[ext]).pick_file()
}

#[cfg(windows)]
pub fn pick_folder() -> Option<PathBuf> {
    rfd::FileDialog::new().pick_folder()
}

#[cfg(not(windows))]
pub fn save_file(_title: &str, name: &str, _kind: &str, _ext: &str) -> Option<PathBuf> {
    let dir = dirs::document_dir().unwrap_or_else(std::env::temp_dir);
    Some(dir.join(name))
}

#[cfg(not(windows))]
pub fn open_file(_title: &str, _kind: &str, _ext: &str) -> Option<PathBuf> {
    None
}

#[cfg(not(windows))]
pub fn pick_folder() -> Option<PathBuf> {
    None
}
