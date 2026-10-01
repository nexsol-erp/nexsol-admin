// Weighbridge camera: a photo is taken when a weighing is saved and kept with it, on the PC
// (<userData>/photos/<yyyy-MM>/) and, once the weighing has uploaded, on the server (unless the
// "upload" switch is off).
//
// Two kinds of camera (Settings > Camera):
//   webcam  a USB / built-in camera, found by its name (webcam.rs). The latest frame is kept and
//           saved at the moment of the save, at most 960 px wide.
//   url     an IP camera's snapshot address (http://…/snapshot.jpg). One JPEG is fetched at the
//           moment of saving; user:password@ in the address is sent as basic auth. Shrunk to at
//           most 1280 px wide.

use crate::http::Http;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const MAX_PHOTO_BYTES: usize = 1500 * 1024;

/// Same JSON as the Electron app's "camera" settings row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct CameraSettings {
    /// none | webcam | url
    pub source: String,
    pub device_id: String,
    pub device_label: String,
    pub url: String,
    /// send photos to the server too (else they stay on this PC only)
    pub upload: bool,
    /// print the photo on the voucher
    pub print_photo: bool,
}

impl Default for CameraSettings {
    fn default() -> Self {
        CameraSettings { source: "none".into(), device_id: String::new(), device_label: String::new(), url: String::new(), upload: true, print_photo: false }
    }
}

pub fn is_jpeg(b: &[u8]) -> bool {
    b.len() > 3 && b[0] == 0xFF && b[1] == 0xD8
}

/// Splits "http://user:pw@host/path" into the address without the credentials and a basic-auth
/// header value.
pub fn split_auth(url: &str) -> Result<(String, Option<String>), String> {
    use base64::Engine;
    let u = reqwest::Url::parse(url.trim()).map_err(|_| "The camera address is not valid".to_string())?;
    if u.scheme() != "http" && u.scheme() != "https" {
        return Err("The camera address must start with http:// or https://".into());
    }
    let mut clean = u.clone();
    let auth = if !u.username().is_empty() || u.password().is_some() {
        let dec = |s: &str| percent_decode(s);
        let pair = format!("{}:{}", dec(u.username()), dec(u.password().unwrap_or("")));
        let _ = clean.set_username("");
        let _ = clean.set_password(None);
        Some(format!("Basic {}", base64::engine::general_purpose::STANDARD.encode(pair)))
    } else {
        None
    };
    Ok((clean.to_string(), auth))
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// One JPEG from an IP camera snapshot address. Err is a short reason for the operator.
pub fn fetch_snapshot(http: &dyn Http, url: &str) -> Result<Vec<u8>, String> {
    let (clean, auth) = split_auth(url)?;
    let headers: Vec<(String, String)> = auth.map(|a| vec![("Authorization".to_string(), a)]).unwrap_or_default();
    let res = http.send("GET", &clean, &headers, None, Duration::from_secs(4)).map_err(|e| {
        if e.contains("in time") { "The camera did not answer in time".to_string() } else { format!("Camera: {e}") }
    })?;
    if !res.ok() {
        return Err(format!("The camera answered HTTP {}", res.status));
    }
    if !is_jpeg(&res.body) {
        return Err("The camera did not send a JPEG picture".into());
    }
    if res.body.len() > 8 * MAX_PHOTO_BYTES {
        return Err("The camera picture is too large".into());
    }
    Ok(res.body)
}

/// At most `max_width` wide, as JPEG. A picture already small enough is kept as it is.
pub fn shrink(jpeg: &[u8], max_width: u32) -> Result<Vec<u8>, String> {
    if let Some((w, _, _)) = crate::pdf::jpeg_info(jpeg) {
        if w <= max_width && jpeg.len() <= MAX_PHOTO_BYTES {
            return Ok(jpeg.to_vec());
        }
    }
    let img = image::load_from_memory_with_format(jpeg, image::ImageFormat::Jpeg).map_err(|e| format!("Camera picture: {e}"))?;
    encode(img.to_rgb8(), max_width)
}

/// An RGB frame (from a webcam) as a JPEG at most `max_width` wide.
pub fn encode(img: image::RgbImage, max_width: u32) -> Result<Vec<u8>, String> {
    let img = if img.width() > max_width {
        let h = (img.height() as f64 * max_width as f64 / img.width() as f64).round() as u32;
        image::imageops::resize(&img, max_width, h.max(1), image::imageops::FilterType::Triangle)
    } else {
        img
    };
    let mut out = Vec::new();
    for q in [80u8, 65, 50] {
        out.clear();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, q).encode_image(&img).map_err(|e| e.to_string())?;
        if out.len() <= MAX_PHOTO_BYTES {
            break;
        }
    }
    Ok(out)
}

/// Writes the photo next to the others of its month; returns the file path.
pub fn save_photo(dir: &Path, voucher_date: &str, voucher_number: &str, vehicle: &str, id: &str, jpeg: &[u8]) -> std::io::Result<PathBuf> {
    let month: String = voucher_date.chars().take(7).collect();
    let month = if month.len() == 7 { month } else { chrono::Local::now().format("%Y-%m").to_string() };
    let folder = dir.join(month);
    std::fs::create_dir_all(&folder)?;
    let safe = |s: &str| -> String { s.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-').collect() };
    let vn = safe(voucher_number);
    let file = folder.join(format!("{}_{}_{}.jpg", if vn.is_empty() { "WB".into() } else { vn }, safe(vehicle), safe(id).chars().take(8).collect::<String>()));
    std::fs::write(&file, jpeg)?;
    Ok(file)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::http::Response;
    use std::sync::Mutex;

    fn jpeg(w: u32, h: u32) -> Vec<u8> {
        let mut out = vec![];
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 80).encode_image(&image::RgbImage::from_pixel(w, h, image::Rgb([90, 90, 200]))).unwrap();
        out
    }

    struct Cam(Mutex<Vec<(String, Vec<(String, String)>)>>, Vec<u8>);
    impl Http for Cam {
        fn send(&self, _m: &str, url: &str, h: &[(String, String)], _b: Option<Vec<u8>>, _t: Duration) -> Result<Response, String> {
            self.0.lock().unwrap().push((url.into(), h.to_vec()));
            Ok(Response { status: 200, body: self.1.clone(), content_length: None })
        }
    }

    #[test]
    fn credentials_become_basic_auth() {
        let (u, a) = split_auth("http://admin:p%40ss@192.168.1.64/ISAPI/Streaming/channels/101/picture").unwrap();
        assert_eq!(u, "http://192.168.1.64/ISAPI/Streaming/channels/101/picture");
        assert_eq!(a.unwrap(), "Basic YWRtaW46cEBzcw==");
        assert!(split_auth("rtsp://x/y").is_err());
        assert!(split_auth("not a url").is_err());
    }

    #[test]
    fn snapshot_is_fetched_and_checked() {
        let cam = Cam(Mutex::new(vec![]), jpeg(32, 24));
        let b = fetch_snapshot(&cam, "http://admin:pw@cam/snap.jpg").unwrap();
        assert!(is_jpeg(&b));
        let calls = cam.0.lock().unwrap();
        assert_eq!(calls[0].0, "http://cam/snap.jpg");
        assert_eq!(calls[0].1[0].1, "Basic YWRtaW46cHc=");
        let html = Cam(Mutex::new(vec![]), b"<html>".to_vec());
        assert!(fetch_snapshot(&html, "http://cam/x").unwrap_err().contains("JPEG"));
    }

    #[test]
    fn large_pictures_shrink_to_1280() {
        let big = jpeg(1920, 1080);
        let small = shrink(&big, 1280).unwrap();
        assert_eq!(crate::pdf::jpeg_info(&small).map(|i| (i.0, i.1)), Some((1280, 720)));
        let tiny = jpeg(640, 480);
        assert_eq!(shrink(&tiny, 1280).unwrap(), tiny, "kept as it is");
    }

    #[test]
    fn photo_files_by_month() {
        let dir = std::env::temp_dir().join(format!("wbcam-{}", uuid::Uuid::new_v4()));
        let f = save_photo(&dir, "2026-10-01 10:00:00", "000045", "KL07AB6666", "cb2f787e-1111", &jpeg(8, 8)).unwrap();
        assert!(f.ends_with("2026-10/000045_KL07AB6666_cb2f787e.jpg"));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn settings_json_matches_electron() {
        let c: CameraSettings = serde_json::from_value(serde_json::json!({ "source": "url", "url": "http://x", "printPhoto": true })).unwrap();
        assert!(c.upload && c.print_photo);
        assert_eq!(serde_json::to_value(&c).unwrap()["deviceLabel"], "");
    }
}
