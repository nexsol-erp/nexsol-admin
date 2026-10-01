// Everything that must not depend on the screen: the indicator connection, the local database,
// voucher numbering, printing, the camera and the upload queue. Port of the Electron main
// process (electron/main.js): every screen action is a method here, and anything the screen must
// hear about (a reading, sync state, the Settings lock, an update) goes out as a UiEvent.
//
// Methods may block (network, printer), so the screen calls them off its own thread.

use crate::camera::{self, CameraSettings};
use crate::error::{AppError, Res};
use crate::http::Http;
use crate::indicator::parser::{decode_frame, Decoded, Event, FrameSplitter, IndicatorSession, Reading};
use crate::indicator::profiles::{build_profile, build_profile_value, escape_ctl, latin1, unescape_ctl, Profile};
use crate::indicator::transport::{Transport, TransportEvent};
use crate::server_config::ServerConfig;
use crate::settings::{self, AuthRec, IndicatorConfig, PrintSettings, WeighingSettings};
use crate::settings_lock::{LockState, SettingsLock};
use crate::store::{normalize_vehicle, HistoryWeighing, NewWeighing, Pick, QuoteOut, Report, Store, Tare, Weighing};
use crate::sync::{Api, Auth, Shared, SyncEvent, SyncState, Syncer};
use crate::updater::{UpdateState, Updater};
use crate::voucher::{self, VoucherOptions};
use crate::webcam::Webcam;
use crate::{print_win, paths};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::{mpsc, Arc, Mutex, Weak};
use std::thread;
use std::time::{Duration, Instant};

// payloads are read by the tests and the event log; the screen re-reads state itself
#[allow(dead_code)]
pub enum UiEvent {
    Reading(Reading),
    Signal(bool),
    /// state: connecting | connected | error | closed
    IndicatorStatus { state: String, message: String },
    /// one line for the raw data monitor
    Monitor(String),
    Sync(SyncState),
    Update(UpdateState),
    Lock(LockState),
    /// weighings reopened from the web admin: history on screen is stale
    Reopened(usize),
    /// a camera picture for the live view
    Frame(image::RgbImage),
    CameraError(String),
}

pub type Emit = Arc<dyn Fn(UiEvent) + Send + Sync>;

#[derive(Default)]
struct Ind {
    session: Option<IndicatorSession>,
    transport: Option<Transport>,
    state: String,
    message: String,
    monitor: bool,
    /// (weight, at) while the simulator drives the display
    simulated: Option<(f64, u64)>,
}

#[derive(Debug, Clone, Default)]
pub struct PrintResult {
    pub printed: bool,
    pub pdf: Option<PathBuf>,
    pub error: String,
}

#[derive(Debug, Clone, Default)]
pub struct SaveForm {
    pub vehicle_number: String,
    pub wheel_type: String,
    pub material: String,
    pub mobile_number: String,
    pub source: Pick,
}

#[derive(Debug)]
pub struct SaveOut {
    pub row: Weighing,
    pub print: PrintResult,
    /// "" or why there is no photo
    pub photo_error: String,
    pub photo: bool,
}

pub struct History {
    pub weights: Vec<HistoryWeighing>,
    pub tares: Vec<Tare>,
    pub wheel_type: String,
    pub wheel_locked: bool,
}

/// The copy of Settings kept on the server (V084).
#[derive(Debug, Clone, Default)]
pub struct ServerCopy {
    pub supported: bool,
    pub found: bool,
    pub saved_at: String,
    pub saved_by: String,
    pub machine_name: String,
    pub this_pc: bool,
}

pub struct Branch {
    pub code: String,
    pub name: String,
}

pub struct Core {
    pub version: String,
    pub store: Shared,
    pub http: Arc<dyn Http>,
    pub server: ServerConfig,
    pub sync: Arc<Syncer>,
    pub lock: Arc<SettingsLock>,
    pub updater: Arc<Updater>,
    ind: Mutex<Ind>,
    webcam: Mutex<Option<Webcam>>,
    preview: Mutex<bool>,
    emit: Emit,
    t0: Instant,
    me: Weak<Core>,
}

pub fn machine_name() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .or_else(|| std::fs::read_to_string("/etc/hostname").ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "PC".into())
}

fn auth_of(store: &Store) -> AuthRec {
    settings::read(store.get_setting("auth"))
}

/// What "Settings" means for the copy kept on the server and "Fetch from server".
fn snapshot(store: &Store) -> Value {
    json!({
        "indicator": serde_json::to_value(settings::read::<IndicatorConfig>(store.get_setting("indicator"))).unwrap_or_default(),
        "print": serde_json::to_value(settings::read::<PrintSettings>(store.get_setting("print"))).unwrap_or_default(),
        "weighing": serde_json::to_value(settings::read::<WeighingSettings>(store.get_setting("weighing"))).unwrap_or_default(),
        "camera": serde_json::to_value(settings::read::<CameraSettings>(store.get_setting("camera"))).unwrap_or_default(),
    })
}

fn decode_jwt(token: &str) -> Option<Value> {
    use base64::Engine;
    let part = token.split('.').nth(1)?;
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(part.trim_end_matches('=')).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect::<Vec<_>>().join(" ")
}

impl Core {
    pub fn new(version: &str, store: Store, http: Arc<dyn Http>, server: ServerConfig, emit: Emit) -> Arc<Core> {
        let store: Shared = Arc::new(Mutex::new(store));
        Arc::new_cyclic(|me: &Weak<Core>| {
            let st = store.clone();
            let default_api = server.state().api_server;
            let api = Api::new(http.clone(), move || {
                let a = auth_of(&st.lock().unwrap());
                if a.tenant_id.is_empty() {
                    return None;
                }
                let api_server = if a.api_server.is_empty() { default_api.clone() } else { a.api_server };
                Some(Auth { api_server, tenant_id: a.tenant_id, token: a.token, branch_code: a.branch_code })
            });
            let e = emit.clone();
            let sync = Arc::new(Syncer::new(store.clone(), api, move |ev| match ev {
                SyncEvent::State(s) => e(UiEvent::Sync(s)),
                SyncEvent::Warn(m) => crate::warn!("sync {m}"),
                SyncEvent::Reopened(n) => {
                    crate::info!("sync {n} weighing(s) reopened from the web admin");
                    e(UiEvent::Reopened(n));
                }
            }));
            let s2 = sync.clone();
            let st2 = store.clone();
            let st3 = store.clone();
            let ver = version.to_string();
            let lock = Arc::new(SettingsLock::new(
                store.clone(),
                Box::new(move |body| s2.checkin_terminal(body)),
                Box::new(move || {
                    let mut m = serde_json::Map::new();
                    m.insert("branchCode".into(), json!(auth_of(&st2.lock().unwrap()).branch_code));
                    m.insert("machineName".into(), json!(machine_name()));
                    m.insert("appVersion".into(), json!(ver));
                    m
                }),
                Some(Box::new(move || snapshot(&st3.lock().unwrap()))),
            ));
            Core {
                version: version.into(),
                updater: Arc::new(Updater::new(version, paths::updates_dir())),
                store,
                http,
                server,
                sync,
                lock,
                ind: Mutex::new(Ind { state: "closed".into(), ..Default::default() }),
                webcam: Mutex::new(None),
                preview: Mutex::new(false),
                emit,
                t0: Instant::now(),
                me: me.clone(),
            }
        })
    }

    fn db(&self) -> std::sync::MutexGuard<'_, Store> {
        self.store.lock().unwrap()
    }

    fn now_ms(&self) -> u64 {
        self.t0.elapsed().as_millis() as u64
    }

    // ── settings ─────────────────────────────────────────────────────────────
    pub fn auth(&self) -> AuthRec {
        auth_of(&self.db())
    }
    fn set_auth(&self, a: &AuthRec) -> Res<()> {
        self.db().set_setting("auth", &serde_json::to_value(a)?)
    }
    pub fn is_admin(&self) -> bool {
        self.auth().is_admin()
    }
    pub fn print_settings(&self) -> PrintSettings {
        settings::read(self.db().get_setting("print"))
    }
    pub fn weighing_settings(&self) -> WeighingSettings {
        settings::read(self.db().get_setting("weighing"))
    }
    pub fn camera_settings(&self) -> CameraSettings {
        settings::read(self.db().get_setting("camera"))
    }
    pub fn indicator_config(&self) -> IndicatorConfig {
        settings::read(self.db().get_setting("indicator"))
    }
    /// Settings changes: an admin, and Settings not locked (see settings_lock.rs).
    fn require_settings(&self) -> Res<()> {
        if !self.is_admin() {
            return Err(AppError::validation("Only an admin can change this"));
        }
        self.lock.require()
    }

    fn settings_saved(&self) {
        self.lock.saved();
        (self.emit)(UiEvent::Lock(self.lock.state()));
    }

    pub fn lock_state(&self) -> LockState {
        self.lock.state()
    }

    /// Asks the server whether Settings are open (and sends the PC's check-in).
    pub fn refresh_lock(&self) -> LockState {
        let st = match self.lock.refresh() {
            Ok(s) => s,
            Err((s, e)) => {
                if !matches!(e, AppError::Auth(_) | AppError::Network(_)) {
                    crate::warn!("settings lock {e}");
                }
                s
            }
        };
        (self.emit)(UiEvent::Lock(st.clone()));
        st
    }

    pub fn save_print(&self, p: &PrintSettings) -> Res<PrintSettings> {
        self.require_settings()?;
        let mut p = p.clone();
        p.copies = p.copies.clamp(1, 5);
        if !["a5", "80mm", "text"].contains(&p.layout.as_str()) {
            p.layout = "a5".into();
        }
        self.db().set_setting("print", &serde_json::to_value(&p)?)?;
        self.settings_saved();
        Ok(self.print_settings())
    }

    pub fn save_weighing_settings(&self, w: &WeighingSettings) -> Res<WeighingSettings> {
        self.require_settings()?;
        self.db().set_setting("weighing", &serde_json::to_value(w)?)?;
        self.settings_saved();
        self.ind.lock().unwrap().simulated = None;
        Ok(self.weighing_settings())
    }

    pub fn save_camera(&self, c: &CameraSettings) -> Res<CameraSettings> {
        self.require_settings()?;
        let mut next = c.clone();
        if !["none", "webcam", "url"].contains(&next.source.as_str()) {
            next.source = "none".into();
        }
        next.url = next.url.trim().to_string();
        if next.source == "url" && !(next.url.to_lowercase().starts_with("http://") || next.url.to_lowercase().starts_with("https://")) {
            return Err(AppError::validation("Enter the camera's snapshot address, starting with http://"));
        }
        self.db().set_setting("camera", &serde_json::to_value(&next)?)?;
        self.settings_saved();
        self.start_camera();
        Ok(self.camera_settings())
    }

    pub fn save_indicator(&self, preset_id: &str, overrides: &Value) -> Res<Profile> {
        self.require_settings()?;
        let cfg = IndicatorConfig { preset_id: preset_id.into(), overrides: overrides.clone() };
        self.db().set_setting("indicator", &serde_json::to_value(&cfg)?)?;
        self.settings_saved();
        self.start_indicator();
        Ok(self.profile())
    }

    // ── server copy of Settings ──────────────────────────────────────────────
    pub fn server_copy(&self) -> Res<ServerCopy> {
        let r = self.sync.saved_settings(&self.lock.terminal_id(), &self.auth().branch_code)?;
        Ok(ServerCopy {
            supported: r["supported"].as_bool().unwrap_or(false),
            found: r["found"].as_bool().unwrap_or(false),
            saved_at: crate::store::vstr(&r, "savedAt"),
            saved_by: crate::store::vstr(&r, "savedBy"),
            machine_name: crate::store::vstr(&r, "machineName"),
            this_pc: r["thisPc"].as_bool().unwrap_or(false),
        })
    }

    pub fn fetch_server_settings(&self) -> Res<ServerCopy> {
        self.require_settings()?;
        let r = self.sync.saved_settings(&self.lock.terminal_id(), &self.auth().branch_code)?;
        if !r["supported"].as_bool().unwrap_or(false) {
            return Err(AppError::validation("The server doesn't keep settings yet (V084 migration)."));
        }
        if !r["found"].as_bool().unwrap_or(false) {
            return Err(AppError::validation("No settings saved on the server for this PC or branch yet"));
        }
        let this_pc = r["thisPc"].as_bool().unwrap_or(false);
        self.apply_settings_copy(&r["settings"], this_pc)?;
        self.settings_saved();
        self.ind.lock().unwrap().simulated = None;
        self.start_indicator();
        self.start_camera();
        let copy = ServerCopy {
            supported: true,
            found: true,
            saved_at: crate::store::vstr(&r, "savedAt"),
            saved_by: crate::store::vstr(&r, "savedBy"),
            machine_name: crate::store::vstr(&r, "machineName"),
            this_pc,
        };
        crate::info!("settings fetched from server {} {}", if this_pc { "(this PC)".into() } else { format!("(from {})", copy.machine_name) }, copy.saved_at);
        Ok(copy)
    }

    /// Puts a copy from the server in place. A copy made on another PC keeps this PC's voucher
    /// folder, since that path may not exist here, and its camera id (ids differ between PCs).
    pub fn apply_settings_copy(&self, copy: &Value, from_this_pc: bool) -> Res<()> {
        let ok = |k: &str| copy.get(k).is_some_and(|v| v.is_object());
        if !ok("indicator") && !ok("print") && !ok("weighing") {
            return Err(AppError::validation("The copy on the server has no settings in it"));
        }
        let pdf_folder = self.print_settings().pdf_folder;
        let db = self.db();
        if ok("indicator") && copy["indicator"]["presetId"].as_str().is_some_and(|s| !s.is_empty()) {
            let o = if copy["indicator"]["overrides"].is_object() { copy["indicator"]["overrides"].clone() } else { json!({}) };
            db.set_setting("indicator", &json!({ "presetId": copy["indicator"]["presetId"], "overrides": o }))?;
        }
        if ok("print") {
            let mut p = copy["print"].clone();
            if !from_this_pc {
                p["pdfFolder"] = json!(pdf_folder);
            }
            db.set_setting("print", &p)?;
        }
        if ok("weighing") {
            db.set_setting("weighing", &copy["weighing"])?;
        }
        if ok("camera") {
            let mut c = copy["camera"].clone();
            if !from_this_pc {
                c["deviceId"] = json!("");
            }
            db.set_setting("camera", &c)?;
        }
        Ok(())
    }

    // ── indicator ────────────────────────────────────────────────────────────
    pub fn profile(&self) -> Profile {
        let c = self.indicator_config();
        build_profile(&c.preset_id, &c.overrides)
    }

    pub fn profile_value(&self, preset_id: &str, overrides: &Value) -> Value {
        build_profile_value(preset_id, overrides)
    }

    pub fn indicator_status(&self) -> (String, String) {
        let i = self.ind.lock().unwrap();
        (i.state.clone(), i.message.clone())
    }

    pub fn start_indicator(&self) {
        self.stop_indicator();
        let profile = self.profile();
        self.ind.lock().unwrap().session = Some(IndicatorSession::new(profile.clone()));
        let me = self.me.clone();
        let t = Transport::start(profile, move |ev| {
            if let Some(c) = me.upgrade() {
                c.on_transport(ev);
            }
        });
        self.ind.lock().unwrap().transport = Some(t);
    }

    pub fn stop_indicator(&self) {
        let t = {
            let mut i = self.ind.lock().unwrap();
            i.session = None;
            i.transport.take()
        };
        if let Some(t) = t {
            t.stop();
        }
    }

    fn on_transport(&self, ev: TransportEvent) {
        let mut out = Vec::new();
        let mut engaged = Vec::new();
        match ev {
            TransportEvent::Data(d) => {
                let now = self.now_ms();
                let mut i = self.ind.lock().unwrap();
                if i.monitor {
                    out.push(UiEvent::Monitor(format!("RAW  {}    [{}]", escape_ctl(&latin1(&d)), hex(&d))));
                }
                let monitor = i.monitor;
                let simulated = i.simulated.is_some();
                let Some(s) = i.session.as_mut() else { return };
                for e in s.feed(&d, now) {
                    match e {
                        Event::Frame { raw, ok } => {
                            if monitor {
                                out.push(UiEvent::Monitor(format!("{} {}", if ok { "OK  " } else { "BAD " }, escape_ctl(&raw))));
                            }
                        }
                        Event::Reading(r) => {
                            if !simulated {
                                out.push(UiEvent::Reading(r));
                            }
                        }
                        Event::Signal(s) => out.push(UiEvent::Signal(s)),
                        Event::Engage { weight, .. } => engaged.push(weight),
                    }
                }
            }
            TransportEvent::Status { state, message } => {
                if state == "error" {
                    crate::warn!("indicator {state} {message}");
                } else {
                    crate::info!("indicator {state} {message}");
                }
                let mut i = self.ind.lock().unwrap();
                i.state = state.clone();
                i.message = message.clone();
                out.push(UiEvent::IndicatorStatus { state, message });
            }
        }
        if !engaged.is_empty() {
            let branch = self.auth().branch_code;
            for w in engaged {
                if let Err(e) = self.db().add_engage(w, &branch, None) {
                    crate::error!("engage save {e}");
                }
                crate::info!("bridge engaged {w}");
            }
        }
        for e in out {
            (self.emit)(e);
        }
    }

    /// Called every second: the no-signal watchdog and the simulator's display.
    pub fn tick(&self) {
        let now = self.now_ms();
        let mut out = Vec::new();
        {
            let mut i = self.ind.lock().unwrap();
            if let Some(e) = i.session.as_mut().and_then(|s| s.tick(now)) {
                if let Event::Signal(s) = e {
                    out.push(UiEvent::Signal(s));
                }
            }
            if let Some((w, at)) = i.simulated {
                if now.saturating_sub(at) > 1000 {
                    i.simulated = Some((w, now));
                    out.push(UiEvent::Reading(Self::sim_reading(w, now)));
                }
            }
        }
        for e in out {
            (self.emit)(e);
        }
    }

    fn sim_reading(weight: f64, at: u64) -> Reading {
        Reading { weight, stable: true, overload: false, unit: "kg".into(), raw: String::new(), at, simulated: true }
    }

    pub fn set_monitor(&self, on: bool) {
        self.ind.lock().unwrap().monitor = on;
    }

    pub fn simulate(&self, weight: Option<f64>) -> Res<()> {
        if !self.weighing_settings().simulator {
            return Err(AppError::validation("Turn on the simulator in Settings first"));
        }
        let now = self.now_ms();
        self.ind.lock().unwrap().simulated = weight.map(|w| (w, now));
        if let Some(w) = weight {
            (self.emit)(UiEvent::Reading(Self::sim_reading(w, now)));
        }
        Ok(())
    }

    /// Paste what the monitor showed, see what a profile makes of it.
    pub fn test_parse(&self, preset_id: &str, overrides: &Value, sample: &str) -> Vec<(String, Option<Decoded>)> {
        let profile = build_profile(preset_id, overrides);
        let mut splitter = FrameSplitter::new(&profile.frame);
        splitter
            .push(&crate::indicator::profiles::to_bytes(&unescape_ctl(sample)))
            .into_iter()
            .map(|f| {
                let r = decode_frame(&f, &profile);
                (escape_ctl(&f), r)
            })
            .collect()
    }

    /// The reading a save may use: fresh, stable (unless allowed), above zero.
    pub fn current_weight(&self) -> Res<f64> {
        let ws = self.weighing_settings();
        let now = self.now_ms();
        let i = self.ind.lock().unwrap();
        let r = match (i.simulated, ws.simulator) {
            (Some((w, at)), true) => Some(Self::sim_reading(w, at)),
            _ => i.session.as_ref().and_then(|s| s.last.clone()),
        };
        let limit = i.session.as_ref().map(|s| s.profile.no_signal_ms()).unwrap_or(3000);
        let zero = i.session.as_ref().map(|s| s.profile.zero_band()).unwrap_or(0.0);
        let Some(r) = r.filter(|r| now.saturating_sub(r.at) <= limit) else {
            return Err(AppError::validation("No reading from the weighbridge"));
        };
        if r.overload {
            return Err(AppError::validation("Indicator shows overload"));
        }
        if ws.require_stable && !r.stable {
            return Err(AppError::validation("Weight is not stable yet"));
        }
        if !(r.weight > zero) {
            return Err(AppError::validation("No weight on the bridge"));
        }
        Ok(r.weight)
    }

    // ── camera ───────────────────────────────────────────────────────────────
    /// Opens the USB camera (kept open while the app runs, so a photo is there at every save) or
    /// closes it when Settings say another source.
    pub fn start_camera(&self) {
        if let Some(w) = self.webcam.lock().unwrap().take() {
            w.close();
        }
        let cam = self.camera_settings();
        if cam.source != "webcam" {
            return;
        }
        let (e1, e2) = (self.emit.clone(), self.emit.clone());
        let me = self.me.clone();
        let w = Webcam::open(
            &cam.device_label,
            move |img| {
                if me.upgrade().is_some_and(|c| *c.preview.lock().unwrap()) {
                    e1(UiEvent::Frame(img.clone()));
                }
            },
            move |m| e2(UiEvent::CameraError(m)),
        );
        *self.webcam.lock().unwrap() = Some(w);
    }

    /// The live view is only sent while a screen shows it.
    pub fn set_preview(&self, on: bool) {
        *self.preview.lock().unwrap() = on;
    }

    pub fn preview_on(&self) -> bool {
        *self.preview.lock().unwrap()
    }

    /// One picture from an IP camera (the live view and the Settings test), shrunk for showing.
    pub fn snapshot(&self, url: &str) -> Result<Vec<u8>, String> {
        let u = if url.is_empty() { self.camera_settings().url } else { url.to_string() };
        camera::fetch_snapshot(&*self.http, &u)
    }

    pub fn webcams(&self) -> Vec<String> {
        crate::webcam::list()
    }

    /// Starts taking the photo at the moment of saving; the result is collected after the save.
    fn start_photo(&self) -> Option<mpsc::Receiver<Result<Vec<u8>, String>>> {
        let cam = self.camera_settings();
        let (tx, rx) = mpsc::channel();
        match cam.source.as_str() {
            "webcam" => {
                let shot = self.webcam.lock().unwrap().as_ref().and_then(|w| w.capture()).ok_or_else(|| "No picture from the camera".to_string());
                let _ = tx.send(shot);
            }
            "url" => {
                let http = self.http.clone();
                thread::spawn(move || {
                    let _ = tx.send(camera::fetch_snapshot(&*http, &cam.url).and_then(|b| camera::shrink(&b, 1280)));
                });
            }
            _ => return None,
        }
        Some(rx)
    }

    /// Returns "" or why there is no photo. Never stops the save.
    fn finish_photo(&self, row: &Weighing, shot: Option<mpsc::Receiver<Result<Vec<u8>, String>>>) -> String {
        let Some(rx) = shot else { return String::new() };
        let r = rx.recv_timeout(Duration::from_secs(8)).unwrap_or_else(|_| Err("The camera did not answer in time".into()));
        let result = r.and_then(|jpeg| {
            let file = camera::save_photo(&paths::photos_dir(), &row.voucher_date, &row.voucher_number, &row.vehicle_number, &row.id, &jpeg).map_err(|e| e.to_string())?;
            let upload = self.camera_settings().upload; // before taking the database lock: it takes it too
            self.db().set_photo(&row.id, &file.to_string_lossy(), upload).map_err(|e| e.to_string())
        });
        match result {
            Ok(()) => String::new(),
            Err(e) => {
                crate::warn!("camera {} {e}", row.voucher_number);
                e
            }
        }
    }

    pub fn photo_of(&self, row: &Weighing) -> Option<Vec<u8>> {
        row.photo_path.as_ref().and_then(|p| std::fs::read(p).ok()).filter(|b| camera::is_jpeg(b))
    }

    // ── printing ─────────────────────────────────────────────────────────────
    pub fn pdf_folder(&self) -> PathBuf {
        let p = self.print_settings().pdf_folder;
        if p.is_empty() { paths::default_pdf_dir() } else { PathBuf::from(p) }
    }

    fn voucher_options(&self, ps: &PrintSettings, row: &Weighing, copy_label: &str) -> VoucherOptions {
        let photo = if self.camera_settings().print_photo { self.photo_of(row) } else { None };
        VoucherOptions {
            header: ps.header.clone(),
            layout: ps.layout.clone(),
            currency: ps.currency.clone(),
            footer: ps.footer.clone(),
            copy_label: copy_label.into(),
            photo,
        }
    }

    pub fn print_voucher(&self, row: &Weighing, reprint: bool) -> PrintResult {
        let ps = self.print_settings();
        let copies = ps.copies.clamp(1, 5);
        let mut result = PrintResult::default();
        for i in 0..copies {
            let label = if reprint { "DUPLICATE" } else if copies > 1 { if i == 0 { "ORIGINAL" } else { "COPY" } } else { "" };
            let items = voucher::layout(row, &self.voucher_options(&ps, row, label));
            let title = format!("Weighbridge voucher {}", row.voucher_number);
            let r = if !print_win::is_supported() {
                Err("Printing works on Windows only".to_string())
            } else if ps.layout == "text" {
                let lines = voucher::text_lines(&items, ps.text_width as usize);
                print_win::print_raw(&ps.printer, &print_win::escp_bytes(&lines, ps.form_feed), &title)
            } else {
                print_win::print_gdi(&ps.printer, &items, &ps.layout, &title)
            };
            match r {
                Ok(()) => result.printed = true,
                Err(e) => {
                    crate::error!("print {} {e}", row.voucher_number);
                    result.error = e;
                    break;
                }
            }
        }
        if result.printed && !row.id.is_empty() && row.id != "test" {
            let _ = self.db().mark_printed(&row.id);
        }
        if ps.keep_pdf && !reprint {
            let dir = self.pdf_folder();
            let items = voucher::layout(row, &self.voucher_options(&ps, row, ""));
            let layout = if ps.layout == "80mm" { "80mm" } else { "a5" };
            let file = dir.join(voucher::pdf_file_name(row));
            match std::fs::create_dir_all(&dir).and_then(|_| std::fs::write(&file, crate::pdf::render(&items, layout))) {
                Ok(()) => result.pdf = Some(file),
                Err(e) => crate::error!("pdf copy {} {e}", row.voucher_number),
            }
        }
        result
    }

    pub fn reprint(&self, id: &str) -> Res<PrintResult> {
        let row = self.db().get_weighing(id).ok_or_else(|| AppError::validation("Voucher not found"))?;
        crate::info!("reprint {} by {}", row.voucher_number, self.auth().username);
        Ok(self.print_voucher(&row, true))
    }

    pub fn test_print(&self) -> PrintResult {
        let now = crate::store::now_stamp();
        let row = Weighing {
            id: "test".into(),
            voucher_number: "TEST".into(),
            voucher_date: now.clone(),
            vehicle_number: "KL07AB1234".into(),
            wheel_type: "10 WHEEL".into(),
            material: "Sand".into(),
            lcd_number: 18250.0,
            first_weight: 7120.0,
            first_weight_date: Some(now),
            first_weight_kind: Some("previous".into()),
            ..Default::default()
        };
        self.print_voucher(&row, true)
    }

    pub fn printers(&self) -> Vec<String> {
        print_win::printers()
    }

    // ── weighing ─────────────────────────────────────────────────────────────
    pub fn rates(&self) -> Vec<(String, f64)> {
        self.db().rates()
    }
    pub fn vehicles(&self, prefix: &str) -> Vec<(String, String)> {
        self.db().vehicles(prefix, 12)
    }
    pub fn materials(&self, prefix: &str) -> Vec<String> {
        self.db().materials(prefix, 12)
    }

    /// The vehicle's history and locked wheel type. Asks the server too: a change made in the web
    /// admin (Vehicle Wheel Type) applies at once, and a lorry known only at another branch is
    /// locked as well. Offline, the local answer stands.
    pub fn history(&self, vehicle_number: &str) -> History {
        let vehicle = normalize_vehicle(vehicle_number);
        if vehicle.len() >= 4 && self.sync.state().online != Some(false) && self.auth().signed_in() {
            let (tx, rx) = mpsc::channel();
            let sync = self.sync.clone();
            let v = vehicle.clone();
            thread::spawn(move || {
                let _ = tx.send(sync.lookup_wheel_type(&v));
            });
            let _ = rx.recv_timeout(Duration::from_secs(2));
        }
        let db = self.db();
        let wheel_type = db.wheel_type_of(&vehicle);
        let (weights, tares) = db.history(&vehicle, 50);
        History { weights, tares, wheel_locked: !wheel_type.is_empty(), wheel_type }
    }

    pub fn quote(&self, vehicle: &str, wheel_type: &str, pick: &Pick, weight: f64) -> QuoteOut {
        self.db().quote(vehicle, wheel_type, pick, weight)
    }

    pub fn save(&self, form: SaveForm) -> Res<SaveOut> {
        let a = self.auth();
        if a.branch_code.is_empty() {
            return Err(AppError::validation("Choose the branch in Settings first"));
        }
        let weight = self.current_weight()?;
        let shot = self.start_photo();
        let had_camera = shot.is_some();
        let row = self.db().save_weighing(NewWeighing {
            vehicle_number: form.vehicle_number,
            wheel_type: form.wheel_type,
            material: form.material,
            mobile_number: form.mobile_number,
            weight,
            source: form.source,
            branch_code: a.branch_code.clone(),
            user_id: a.username.clone(),
            now: None,
        })?;
        crate::info!("saved {} {} {} {} {:?}", row.voucher_number, row.vehicle_number, row.lcd_number, row.amount, row.first_weight_kind);
        // the photo first, so it can go on the voucher
        let photo_error = self.finish_photo(&row, shot);
        let row = self.db().get_weighing(&row.id).unwrap_or(row);
        let print = if self.print_settings().auto_print { self.print_voucher(&row, false) } else { PrintResult::default() };
        self.sync_soon();
        let row = self.db().get_weighing(&row.id).unwrap_or(row);
        Ok(SaveOut { row, print, photo: had_camera && photo_error.is_empty(), photo_error })
    }

    /// Tare weights: the empty weight always comes from the indicator.
    pub fn save_tare(&self, vehicle_number: &str, wheel_type: &str) -> Res<Tare> {
        let a = self.auth();
        if a.branch_code.is_empty() {
            return Err(AppError::validation("Choose the branch in Settings first"));
        }
        let t = self.current_weight()?;
        let row = self.db().save_tare(vehicle_number, wheel_type, t, &a.branch_code, &a.username, None)?;
        self.sync_soon();
        Ok(row)
    }

    pub fn tares(&self) -> Vec<Tare> {
        self.db().tares(2000)
    }

    // ── rates ────────────────────────────────────────────────────────────────
    pub fn add_rate(&self, wheel_type: &str, rate: f64) -> Res<()> {
        self.lock.require_rates(self.is_admin())?;
        let wt = wheel_type.trim().to_uppercase();
        if wt.is_empty() {
            return Err(AppError::validation("Enter the wheel type"));
        }
        if !(rate > 0.0) {
            return Err(AppError::validation("Rate must be more than 0"));
        }
        self.sync.add_rate(&wt, rate, &self.lock.terminal_id())
    }

    // ── report ───────────────────────────────────────────────────────────────
    pub fn report(&self, from: &str, to: &str) -> Report {
        self.db().report(from, to)
    }

    pub fn report_csv(&self, from: &str, to: &str) -> String {
        let r = self.report(from, to);
        let q = |s: String| format!("\"{}\"", s.replace('"', "\"\""));
        let mut lines = vec!["voucherNumber,voucherDate,vehicleNumber,wheelType,material,mobileNumber,weight,firstWeight,amount,roundTrip".to_string()];
        for x in r.rows {
            lines.push(
                [
                    x.voucher_number,
                    x.voucher_date,
                    x.vehicle_number,
                    x.wheel_type,
                    x.material,
                    x.mobile_number,
                    x.lcd_number.to_string(),
                    x.first_weight.to_string(),
                    x.amount.to_string(),
                    x.round_trip.to_string(),
                ]
                .into_iter()
                .map(q)
                .collect::<Vec<_>>()
                .join(","),
            );
        }
        format!("\u{feff}{}", lines.join("\r\n"))
    }

    // ── sign-in and branch ───────────────────────────────────────────────────
    pub fn login(&self, username: &str, password: &str) -> Res<AuthRec> {
        let api = self.server.state().api_server;
        let body = serde_json::to_vec(&json!({ "username": username, "password": password }))?;
        let res = self
            .http
            .send("POST", &format!("{api}/api/login"), &[("Content-Type".into(), "application/json".into())], Some(body), Duration::from_secs(20))
            .map_err(|e| AppError::Network(format!("Could not reach the server: {e}")))?;
        let data = res.json().ok_or_else(|| AppError::other("The server did not answer the sign-in"))?;
        let token = data["token"].as_str().unwrap_or("").to_string();
        if !data["success"].as_bool().unwrap_or(false) || token.is_empty() {
            let m = data["message"].as_str().filter(|m| !m.is_empty()).unwrap_or("Sign-in failed");
            return Err(AppError::validation(m));
        }
        let payload = decode_jwt(&token).unwrap_or(json!({}));
        let branches: Vec<String> = payload["branches"]
            .as_array()
            .map(|a| {
                a.iter()
                    .map(|b| match b {
                        Value::String(s) => s.clone(),
                        _ => ["branchCode", "code", "branch"].iter().find_map(|k| b.get(*k).map(|v| v.as_str().map(String::from).unwrap_or_else(|| v.to_string()))).unwrap_or_default(),
                    })
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();
        let tenant = match &data["tenancyId"] {
            Value::String(s) => s.clone(),
            Value::Null => String::new(),
            v => v.to_string(),
        };
        let prev = self.auth();
        let roles: Vec<String> = data["roles"].as_array().map(|a| a.iter().filter_map(|r| r.as_str().map(String::from)).collect()).unwrap_or_default();
        let next = AuthRec {
            token,
            branch_code: if prev.tenant_id == tenant { prev.branch_code } else { String::new() },
            tenant_id: tenant,
            username: username.into(),
            roles,
            branches,
            api_server: api,
        };
        let auto_branch = if next.branch_code.is_empty() && next.branches.len() == 1 { next.branches[0].clone() } else { String::new() };
        self.set_auth(&next)?;
        crate::info!("signed in {username} {} {}", next.tenant_id, if next.branch_code.is_empty() { &auto_branch } else { &next.branch_code });
        if !auto_branch.is_empty() {
            self.apply_branch(&auto_branch);
        }
        let me = self.me.clone();
        thread::spawn(move || {
            if let Some(c) = me.upgrade() {
                c.sync.run(true);
                c.refresh_lock();
            }
        });
        Ok(self.auth())
    }

    /// Keeps tenant and branch so the next person signs in to the same bridge; drops the token.
    pub fn logout(&self) -> Res<()> {
        let mut a = self.auth();
        a.token.clear();
        a.username.clear();
        a.roles.clear();
        self.set_auth(&a)
    }

    pub fn branches(&self) -> Res<Vec<Branch>> {
        let a = self.auth();
        let list = self.sync.api.call("GET", "/branches", None).unwrap_or(Value::Array(vec![]));
        let allowed: Vec<String> = a.branches.iter().map(|b| b.to_lowercase()).collect();
        let mut out: Vec<Branch> = list
            .as_array()
            .map(|l| {
                l.iter()
                    .map(|b| Branch { code: crate::store::vstr(b, "branchCode"), name: crate::store::vstr(b, "branchName") })
                    .filter(|b| !b.code.is_empty() && (allowed.is_empty() || allowed.contains(&b.code.to_lowercase())))
                    .collect()
            })
            .unwrap_or_default();
        if out.is_empty() {
            out = a.branches.iter().map(|c| Branch { code: c.clone(), name: c.clone() }).collect();
        }
        Ok(out)
    }

    /// Ties this PC to a branch. Changing it later needs Settings open.
    pub fn set_branch(&self, branch_code: &str) -> Res<Option<(usize, usize, i64, i64)>> {
        let a = self.auth();
        if !a.signed_in() {
            return Err(AppError::validation("Sign in first"));
        }
        let change = !a.branch_code.is_empty() && a.branch_code != branch_code;
        if change {
            self.require_settings()?;
        }
        let seeded = self.apply_branch(branch_code);
        if change {
            self.settings_saved();
        }
        Ok(seeded)
    }

    /// Voucher header from the branch record (unless one was typed), then carry on the branch's
    /// voucher numbers and copy its recent weighings.
    fn apply_branch(&self, branch_code: &str) -> Option<(usize, usize, i64, i64)> {
        let mut a = self.auth();
        a.branch_code = branch_code.into();
        let _ = self.set_auth(&a);
        if branch_code.is_empty() {
            return None;
        }
        let ps = self.print_settings();
        if !ps.header.iter().any(|l| !l.trim().is_empty()) {
            match self.sync.api.call("GET", "/branches", None) {
                Ok(list) => {
                    if let Some(b) = list.as_array().and_then(|l| l.iter().find(|x| crate::store::vstr(x, "branchCode").eq_ignore_ascii_case(branch_code))) {
                        let gst = crate::store::vstr(b, "branchGst");
                        let header: Vec<String> = [
                            crate::store::vstr(b, "branchName"),
                            crate::store::vstr(b, "branchBuildingAddress"),
                            crate::store::vstr(b, "branchAddress1"),
                            crate::store::vstr(b, "branchAddress2"),
                            if gst.is_empty() { String::new() } else { format!("GSTIN: {gst}") },
                        ]
                        .into_iter()
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect();
                        let mut p = ps.clone();
                        p.header = header;
                        let _ = self.db().set_setting("print", &serde_json::to_value(&p).unwrap_or_default());
                    }
                }
                Err(e) => crate::warn!("branch header {e}"),
            }
        }
        match self.sync.seed() {
            Ok(s) => Some(s),
            Err(e) => {
                crate::warn!("seed {e}");
                None
            }
        }
    }

    // ── server address and updates ───────────────────────────────────────────
    pub fn check_server(&self, address: &str) -> Result<(String, String), String> {
        crate::server_config::check_server(&*self.http, address)
    }

    pub fn save_server(&self, api: &str, name: &str) -> Result<String, String> {
        self.server.save(api, name)
    }

    pub fn check_update(&self) -> UpdateState {
        let e = self.emit.clone();
        self.updater.check(&*self.http, &self.server.state().api_server, &move |s| e(UiEvent::Update(s.clone())))
    }

    // ── sync ─────────────────────────────────────────────────────────────────
    pub fn sync_soon(&self) {
        let me = self.me.clone();
        thread::spawn(move || {
            if let Some(c) = me.upgrade() {
                c.sync.run(false);
            }
        });
    }

    /// The timers: indicator watchdog every second, Settings lock / rates / reopened weighings
    /// every minute, uploads every 30 seconds, and the update check.
    pub fn start_background(&self, check_updates: bool) {
        let every = |name: &str, first: Duration, period: Duration, f: Box<dyn Fn(&Core) + Send>| {
            let me = self.me.clone();
            let _ = thread::Builder::new().name(name.into()).spawn(move || {
                thread::sleep(first);
                loop {
                    let Some(c) = me.upgrade() else { return };
                    f(&c);
                    drop(c);
                    thread::sleep(period);
                }
            });
        };
        every("tick", Duration::from_secs(1), Duration::from_secs(1), Box::new(|c| c.tick()));
        // the web admin's "allow changes", rate changes and reopened weighings reach the PC within a minute
        every(
            "lock",
            Duration::from_secs(3),
            Duration::from_secs(60),
            Box::new(|c| {
                c.refresh_lock();
                let _ = c.sync.pull_rates();
                let _ = c.sync.pull_reopened();
            }),
        );
        every("sync", Duration::from_secs(2), crate::sync::PUSH_EVERY, Box::new(|c| {
            c.sync.run(false);
        }));
        if check_updates {
            every("updates", crate::updater::FIRST_CHECK, crate::updater::CHECK_EVERY, Box::new(|c| {
                c.check_update();
            }));
        }
        // IP camera live view: a fresh picture every 1.5 s while a screen shows it
        every(
            "ipcam",
            Duration::from_secs(1),
            Duration::from_millis(1500),
            Box::new(|c| {
                if !c.preview_on() {
                    return;
                }
                let cam = c.camera_settings();
                if cam.source != "url" {
                    return;
                }
                match camera::fetch_snapshot(&*c.http, &cam.url).and_then(|b| {
                    image::load_from_memory_with_format(&b, image::ImageFormat::Jpeg).map(|i| i.to_rgb8()).map_err(|e| e.to_string())
                }) {
                    Ok(img) => (c.emit)(UiEvent::Frame(img)),
                    Err(e) => (c.emit)(UiEvent::CameraError(e)),
                }
            }),
        );
    }

    /// At close: stop the indicator and camera, and install a downloaded update.
    pub fn shutdown(&self) {
        self.stop_indicator();
        if let Some(w) = self.webcam.lock().unwrap().take() {
            w.close();
        }
        self.updater.run_installer(false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::http::fake::FakeServer;

    fn core_with(srv: FakeServer) -> (Arc<Core>, Arc<Mutex<Vec<String>>>) {
        let dir = std::env::temp_dir().join(format!("wbcore-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let server = ServerConfig { user_file: dir.join("server.json"), legacy_file: dir.join("none.json"), arg: None };
        server.save("https://srv", "Test").unwrap();
        let seen = Arc::new(Mutex::new(Vec::new()));
        let s2 = seen.clone();
        let core = Core::new(
            "2.0.0",
            Store::memory(),
            Arc::new(srv),
            server,
            Arc::new(move |e| {
                let name = match e {
                    UiEvent::Reading(_) => "reading",
                    UiEvent::Lock(_) => "lock",
                    UiEvent::Sync(_) => "sync",
                    _ => "other",
                };
                s2.lock().unwrap().push(name.into());
            }),
        );
        (core, seen)
    }

    fn jwt(payload: Value) -> String {
        use base64::Engine;
        let p = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(serde_json::to_vec(&payload).unwrap());
        format!("h.{p}.s")
    }

    #[test]
    fn login_keeps_branch_for_same_company_and_picks_the_only_branch() {
        let token = jwt(json!({ "branches": [{ "branchCode": "WB1" }] }));
        let srv = FakeServer::default()
            .on("POST /api/login", move |_| (200, json!({ "success": true, "token": token, "tenancyId": "T1", "roles": ["ADMIN"] })))
            .on("GET /branches", |_| (200, json!([{ "branchCode": "WB1", "branchName": "Kochi Bridge", "branchGst": "32ABC" }])))
            .on("GET /weighbridge/last-voucher", |_| (200, json!({ "lastNumber": 41 })))
            .on("GET /weighbridge/sync", |_| (200, json!({ "weights": [], "tares": [] })))
            .on("GET /wb-rates", |_| (200, json!([])))
            .on("GET /weighbridge/wheel-types/changes", |_| (200, json!([])));
        let (core, _) = core_with(srv);
        let a = core.login("op", "pw").unwrap();
        assert_eq!((a.tenant_id.as_str(), a.branch_code.as_str()), ("T1", "WB1"));
        assert!(a.is_admin());
        assert_eq!(core.print_settings().header, vec!["Kochi Bridge".to_string(), "GSTIN: 32ABC".to_string()]);
        assert_eq!(core.db().last_voucher("WB"), 41);
        core.logout().unwrap();
        let a = core.auth();
        assert!(!a.signed_in() && a.branch_code == "WB1", "branch kept for the next person");
    }

    #[test]
    fn login_failure_shows_the_server_message() {
        let srv = FakeServer::default().on("POST /api/login", |_| (200, json!({ "success": false, "message": "Wrong password" })));
        let (core, _) = core_with(srv);
        assert_eq!(core.login("op", "x").unwrap_err().to_string(), "Wrong password");
    }

    #[test]
    fn weight_rules() {
        let (core, _) = core_with(FakeServer::default());
        assert!(core.current_weight().unwrap_err().to_string().contains("No reading"));
        core.db().set_setting("weighing", &json!({ "simulator": true })).unwrap();
        core.simulate(Some(12500.0)).unwrap();
        assert_eq!(core.current_weight().unwrap(), 12500.0);
        core.simulate(Some(0.0)).unwrap();
        assert!(core.current_weight().unwrap_err().to_string().contains("No weight"));
        core.db().set_setting("weighing", &json!({ "simulator": false })).unwrap();
        assert!(core.simulate(Some(1.0)).is_err());
    }

    #[test]
    fn save_needs_branch_then_saves_with_simulated_weight() {
        let (core, _) = core_with(FakeServer::default());
        core.db().set_setting("weighing", &json!({ "simulator": true })).unwrap();
        core.db().set_setting("print", &json!({ "autoPrint": false, "keepPdf": false })).unwrap();
        core.db().replace_rates(&[json!({ "id": "r", "wheelType": "6 WHEEL", "wheelRate": 100, "voucherDate": "2026-01-01" })]).unwrap();
        core.simulate(Some(9000.0)).unwrap();
        let form = SaveForm { vehicle_number: "kl07ab1234".into(), wheel_type: "6 WHEEL".into(), ..Default::default() };
        assert!(core.save(form.clone()).unwrap_err().to_string().contains("branch"));
        core.set_auth(&AuthRec { token: "t".into(), tenant_id: "T1".into(), branch_code: "WB1".into(), username: "op".into(), ..Default::default() }).unwrap();
        let out = core.save(form).unwrap();
        assert_eq!((out.row.vehicle_number.as_str(), out.row.lcd_number, out.row.amount), ("KL07AB1234", 9000.0, 100.0));
        assert!(!out.print.printed && out.photo_error.is_empty() && !out.photo);
        let h = core.history("KL07AB1234");
        assert!(h.wheel_locked && h.wheel_type == "6 WHEEL");
        assert_eq!(h.weights.len(), 1);
        let csv = core.report_csv("2000-01-01 00:00:00", "2100-01-01 00:00:00");
        assert!(csv.starts_with('\u{feff}') && csv.contains("\"KL07AB1234\""));
    }

    #[test]
    fn photo_on_save_is_stored_without_locking_up() {
        // set_photo used to take the database lock twice in one statement and hang the save
        let dir = std::env::temp_dir().join(format!("wb-photo-{}", std::process::id()));
        unsafe { std::env::set_var("WB_USERDATA", &dir) };
        let (core, _) = core_with(FakeServer::default());
        core.db().set_setting("weighing", &json!({ "simulator": true })).unwrap();
        core.db().set_setting("camera", &json!({ "source": "webcam", "upload": true })).unwrap();
        core.db().set_setting("print", &json!({ "autoPrint": false, "keepPdf": false })).unwrap();
        core.db().replace_rates(&[json!({ "id": "r", "wheelType": "6 WHEEL", "wheelRate": 100, "voucherDate": "2026-01-01" })]).unwrap();
        core.set_auth(&AuthRec { token: "t".into(), tenant_id: "T1".into(), branch_code: "WB1".into(), username: "op".into(), ..Default::default() }).unwrap();
        core.simulate(Some(9000.0)).unwrap();
        let row = core.save(SaveForm { vehicle_number: "KL07AB1234".into(), wheel_type: "6 WHEEL".into(), ..Default::default() }).unwrap().row;
        let jpeg = camera::encode(image::RgbImage::new(16, 8), 960).unwrap();
        let (tx, rx) = mpsc::channel();
        tx.send(Ok(jpeg)).unwrap();
        let (done_tx, done_rx) = mpsc::channel();
        let (c, r) = (core.clone(), row.clone());
        thread::spawn(move || {
            let _ = done_tx.send(c.finish_photo(&r, Some(rx)));
        });
        let err = done_rx.recv_timeout(Duration::from_secs(5)).expect("finish_photo hung");
        assert_eq!(err, "");
        assert!(core.db().get_weighing(&row.id).unwrap().photo_path.is_some_and(|p| p.contains("KL07AB1234")));
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn settings_need_an_admin() {
        let (core, seen) = core_with(FakeServer::default());
        core.set_auth(&AuthRec { token: "t".into(), roles: vec!["USER".into()], ..Default::default() }).unwrap();
        assert!(core.save_print(&PrintSettings::default()).unwrap_err().to_string().contains("admin"));
        core.set_auth(&AuthRec { token: "t".into(), roles: vec!["ADMIN".into()], ..Default::default() }).unwrap();
        let p = core.save_print(&PrintSettings { layout: "text".into(), copies: 9, ..Default::default() }).unwrap();
        assert_eq!((p.layout.as_str(), p.copies), ("text", 5));
        assert!(seen.lock().unwrap().iter().any(|e| e == "lock"));
        assert!(core.lock_state().locks_on_restart || !core.lock_state().server_supports);
    }

    #[test]
    fn settings_copy_from_another_pc_keeps_local_folder_and_camera() {
        let (core, _) = core_with(FakeServer::default());
        core.db().set_setting("print", &json!({ "pdfFolder": "D:\\Vouchers" })).unwrap();
        core.apply_settings_copy(
            &json!({ "indicator": { "presetId": "ascii-line", "overrides": { "unit": "kg" } }, "print": { "layout": "80mm", "pdfFolder": "C:\\Other" },
                     "weighing": { "requireStable": false }, "camera": { "source": "webcam", "deviceId": "abc", "deviceLabel": "USB Cam" } }),
            false,
        )
        .unwrap();
        assert_eq!(core.indicator_config().preset_id, "ascii-line");
        let p = core.print_settings();
        assert_eq!((p.layout.as_str(), p.pdf_folder.as_str()), ("80mm", "D:\\Vouchers"));
        assert!(!core.weighing_settings().require_stable);
        let c = core.camera_settings();
        assert_eq!((c.device_id.as_str(), c.device_label.as_str()), ("", "USB Cam"));
        assert!(core.apply_settings_copy(&json!({}), true).is_err());
    }

    #[test]
    fn parse_test_on_a_sample() {
        let (core, _) = core_with(FakeServer::default());
        let r = core.test_parse("qt-default", &json!({}), "<STX>  12340<CR><STX>bad<CR>");
        assert_eq!(r.len(), 2);
        assert_eq!(r[0].1.as_ref().map(|d| d.weight), Some(12340.0));
        assert!(r[1].1.is_none());
    }
}
