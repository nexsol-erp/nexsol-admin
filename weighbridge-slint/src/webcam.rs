// USB / built-in cameras (Windows Media Foundation, through nokhwa). A camera is found by its
// name, since ids differ between PCs. While open, a thread keeps the newest frame: the Weighing
// screen shows it live, and a save takes it as the weighing's photo (at most 960 px wide).
// MJPEG frames are decoded with the image crate, other formats (YUYV, NV12) by nokhwa.

use image::RgbImage;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;

pub struct Webcam {
    stop: Arc<AtomicBool>,
    latest: Arc<Mutex<Option<RgbImage>>>,
    handle: Option<thread::JoinHandle<()>>,
}

impl Webcam {
    /// Opens the camera with this name ("" = the first one). Frames go to `on_frame` (on the
    /// camera thread) and errors to `on_error`.
    pub fn open(name: &str, on_frame: impl Fn(&RgbImage) + Send + 'static, on_error: impl Fn(String) + Send + 'static) -> Webcam {
        let stop = Arc::new(AtomicBool::new(false));
        let latest = Arc::new(Mutex::new(None));
        let (s, l, n) = (stop.clone(), latest.clone(), name.to_string());
        let handle = thread::Builder::new().name("webcam".into()).spawn(move || imp::run(&n, &s, &l, &on_frame, &on_error)).ok();
        Webcam { stop, latest, handle }
    }

    /// The newest frame as the weighing's photo (JPEG), or None when the camera has none.
    pub fn capture(&self) -> Option<Vec<u8>> {
        let frame = self.latest.lock().ok()?.clone()?;
        crate::camera::encode(frame, 960).ok()
    }

    /// Stops the camera thread, waiting at most 3 s: a camera driver can block inside a frame
    /// read, and the app must not hang on it (the thread then ends by itself when the read returns).
    pub fn close(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let (tx, rx) = std::sync::mpsc::channel();
            let _ = thread::Builder::new().name("webcam-close".into()).spawn(move || {
                let _ = h.join();
                let _ = tx.send(());
            });
            if rx.recv_timeout(std::time::Duration::from_secs(3)).is_err() {
                crate::warn!("camera did not stop in 3 s; left to stop by itself");
            }
        }
    }
}

impl Drop for Webcam {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

pub fn list() -> Vec<String> {
    imp::list()
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    pub fn list() -> Vec<String> {
        vec![]
    }
    pub fn run(_n: &str, _s: &AtomicBool, _l: &Mutex<Option<RgbImage>>, _f: &dyn Fn(&RgbImage), on_error: &dyn Fn(String)) {
        on_error("USB cameras work on Windows only".into());
    }
}

#[cfg(windows)]
mod imp {
    use super::*;
    use nokhwa::pixel_format::RgbFormat;
    use nokhwa::utils::{ApiBackend, FrameFormat, RequestedFormat, RequestedFormatType};
    use nokhwa::Camera;
    use std::time::{Duration, Instant};

    pub fn list() -> Vec<String> {
        nokhwa::query(ApiBackend::MediaFoundation).map(|l| l.into_iter().map(|c| c.human_name()).collect()).unwrap_or_default()
    }

    fn decode(buf: &nokhwa::Buffer) -> Option<RgbImage> {
        if buf.source_frame_format() == FrameFormat::MJPEG {
            image::load_from_memory_with_format(buf.buffer(), image::ImageFormat::Jpeg).ok().map(|i| i.to_rgb8())
        } else {
            let img = buf.decode_image::<RgbFormat>().ok()?;
            RgbImage::from_raw(img.width(), img.height(), img.into_raw())
        }
    }

    pub fn run(name: &str, stop: &AtomicBool, latest: &Mutex<Option<RgbImage>>, on_frame: &dyn Fn(&RgbImage), on_error: &dyn Fn(String)) {
        while !stop.load(Ordering::SeqCst) {
            let cams = nokhwa::query(ApiBackend::MediaFoundation).unwrap_or_default();
            let info = cams.iter().find(|c| !name.is_empty() && c.human_name() == name).or_else(|| if name.is_empty() { cams.first() } else { None });
            let Some(info) = info else {
                on_error(if name.is_empty() { "No camera found".into() } else { format!("Camera \"{name}\" not found (unplugged?)") });
                sleep(stop, Duration::from_secs(3));
                continue;
            };
            let format = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
            let mut cam = match Camera::new(info.index().clone(), format).and_then(|mut c| c.open_stream().map(|_| c)) {
                Ok(c) => c,
                Err(e) => {
                    on_error(format!("Camera: {e}"));
                    sleep(stop, Duration::from_secs(3));
                    continue;
                }
            };
            let mut last_shown = Instant::now() - Duration::from_secs(1);
            let mut fails = 0;
            while !stop.load(Ordering::SeqCst) && fails < 20 {
                match cam.frame().ok().as_ref().and_then(decode) {
                    Some(img) => {
                        fails = 0;
                        if last_shown.elapsed() >= Duration::from_millis(120) {
                            last_shown = Instant::now();
                            on_frame(&img);
                        }
                        if let Ok(mut l) = latest.lock() {
                            *l = Some(img);
                        }
                    }
                    None => {
                        fails += 1;
                        thread::sleep(Duration::from_millis(50));
                    }
                }
            }
            let _ = cam.stop_stream();
            if fails >= 20 {
                on_error("The camera stopped sending pictures".into());
                if let Ok(mut l) = latest.lock() {
                    *l = None;
                }
                sleep(stop, Duration::from_secs(2));
            }
        }
    }

    fn sleep(stop: &AtomicBool, d: Duration) {
        let until = Instant::now() + d;
        while Instant::now() < until && !stop.load(Ordering::SeqCst) {
            thread::sleep(Duration::from_millis(50));
        }
    }
}
