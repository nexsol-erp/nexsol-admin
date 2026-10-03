// Moves data between this PC's local store and the server. Runs on a timer, so uploads happen
// whatever screen is open. Nothing here blocks weighing: if the server is down or the sign-in has
// expired, rows simply wait in the outbox. Port of electron/sync.js; same endpoints and bodies.

use crate::error::{AppError, Res};
use crate::http::{enc, Http};
use crate::store::{vstr, Pending, Store};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub const PUSH_EVERY: Duration = Duration::from_secs(30);
pub const PULL_EVERY: Duration = Duration::from_secs(10 * 60);

#[derive(Debug, Clone, Default)]
pub struct Auth {
    pub api_server: String,
    pub tenant_id: String,
    pub token: String,
    pub branch_code: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct SyncState {
    /// None until the first attempt
    pub online: Option<bool>,
    pub needs_login: bool,
    /// local "yyyy-MM-dd HH:mm:ss"
    pub last_sync_at: Option<String>,
    pub last_error: String,
    pub pending: Pending,
}

pub type Shared = Arc<Mutex<Store>>;
type AuthFn = Arc<dyn Fn() -> Option<Auth> + Send + Sync>;

#[derive(Clone)]
pub struct Api {
    pub http: Arc<dyn Http>,
    auth: AuthFn,
}

impl Api {
    pub fn new(http: Arc<dyn Http>, auth: impl Fn() -> Option<Auth> + Send + Sync + 'static) -> Api {
        Api { http, auth: Arc::new(auth) }
    }

    pub fn auth(&self) -> Option<Auth> {
        (self.auth)()
    }

    /// A call to /api/{tenant}{path}. 401/403 → Auth, no answer → Network, other errors → Http.
    pub fn call(&self, method: &str, path: &str, body: Option<&Value>) -> Res<Value> {
        let a = self.auth().filter(|a| !a.token.is_empty() && !a.tenant_id.is_empty()).ok_or_else(|| AppError::Auth("Not signed in".into()))?;
        let url = format!("{}/api/{}{}", a.api_server, enc(&a.tenant_id), path);
        let headers = vec![
            ("Authorization".to_string(), format!("Bearer {}", a.token)),
            ("Content-Type".to_string(), "application/json".to_string()),
            ("Accept".to_string(), "application/json".to_string()),
        ];
        let res = self
            .http
            .send(method, &url, &headers, body.map(|b| serde_json::to_vec(b).unwrap_or_default()), Duration::from_secs(30))
            .map_err(AppError::Network)?;
        if res.status == 401 || res.status == 403 {
            return Err(AppError::Auth("Sign in again to sync".into()));
        }
        let text = res.text();
        let data: Value = if text.is_empty() { Value::Null } else { serde_json::from_str(&text).unwrap_or(Value::String(text.clone())) };
        if !res.ok() {
            let msg = match &data {
                Value::Object(m) if m.get("error").and_then(|e| e.as_str()).is_some_and(|s| !s.is_empty()) => m["error"].as_str().unwrap().to_string(),
                Value::String(s) if !s.is_empty() => s.clone(),
                _ => format!("HTTP {}", res.status),
            };
            return Err(AppError::Http { status: res.status, message: msg.chars().take(200).collect() });
        }
        Ok(data)
    }
}

/// Offline or signed out: stop and retry later (a row-level error is anything else).
fn stops(e: &AppError) -> bool {
    matches!(e, AppError::Auth(_) | AppError::Network(_) | AppError::Other(_) | AppError::Validation(_))
}

pub enum SyncEvent {
    State(SyncState),
    Warn(String),
    Reopened(usize),
}

pub struct Syncer {
    pub store: Shared,
    pub api: Api,
    running: Mutex<()>,
    last_pull: Mutex<Option<Instant>>,
    state: Mutex<SyncState>,
    on_event: Box<dyn Fn(SyncEvent) + Send + Sync>,
    /// every tare on the server downloaded since the app started
    tares_pulled: std::sync::atomic::AtomicBool,
}

impl Syncer {
    pub fn new(store: Shared, api: Api, on_event: impl Fn(SyncEvent) + Send + Sync + 'static) -> Syncer {
        let pending = store.lock().unwrap().pending_count();
        Syncer {
            store,
            api,
            running: Mutex::new(()),
            last_pull: Mutex::new(None),
            state: Mutex::new(SyncState { pending, ..Default::default() }),
            on_event: Box::new(on_event),
            tares_pulled: Default::default(),
        }
    }

    pub fn state(&self) -> SyncState {
        self.state.lock().unwrap().clone()
    }

    fn set(&self, f: impl FnOnce(&mut SyncState)) {
        let pending = self.store.lock().unwrap().pending_count();
        let st = {
            let mut s = self.state.lock().unwrap();
            f(&mut s);
            s.pending = pending;
            s.clone()
        };
        (self.on_event)(SyncEvent::State(st));
    }

    fn db(&self) -> std::sync::MutexGuard<'_, Store> {
        self.store.lock().unwrap()
    }

    /// One pass: upload, then (every few minutes) download rates, wheel types, reopened weighings
    /// and resync requests.
    pub fn run(&self, force_pull: bool) -> SyncState {
        let Ok(_guard) = self.running.try_lock() else { return self.state() };
        let result = (|| -> Res<()> {
            self.push()?;
            let due = force_pull || self.last_pull.lock().unwrap().is_none_or(|t| t.elapsed() > PULL_EVERY);
            if due {
                self.pull_rates()?;
                self.pull_wheel_types()?;
                self.pull_reopened()?;
                if let Err(e) = self.handle_resync_requests() {
                    // a server problem with resync requests must not show the PC as offline or stop uploads
                    if stops(&e) {
                        return Err(e);
                    }
                    (self.on_event)(SyncEvent::Warn(format!("resync requests: {e}")));
                }
                *self.last_pull.lock().unwrap() = Some(Instant::now());
            }
            Ok(())
        })();
        match result {
            Ok(()) => self.set(|s| {
                s.online = Some(true);
                s.needs_login = false;
                s.last_sync_at = Some(crate::store::now_stamp());
                s.last_error.clear();
            }),
            Err(AppError::Auth(m)) => self.set(|s| {
                s.needs_login = true;
                s.last_error = m;
            }),
            Err(e) => self.set(|s| {
                s.online = Some(false);
                s.last_error = e.to_string();
            }),
        }
        self.state()
    }

    pub fn push(&self) -> Res<()> {
        let branch = self.api.auth().map(|a| a.branch_code).unwrap_or_default();
        let or_branch = |b: &str| if b.is_empty() { branch.clone() } else { b.to_string() };
        let rows = self.db().pending_weights(50);
        for r in rows {
            let body = json!({
                "ddId": r.id,
                "branchCode": or_branch(&r.branch_code),
                "voucherNumber": r.voucher_number,
                "voucherDate": r.voucher_date,
                "vehicleNumber": r.vehicle_number,
                "wheelType": r.wheel_type,
                "material": r.material,
                "mobileNumber": r.mobile_number,
                "lcdNumber": r.lcd_number,
                "firstWeight": r.first_weight,
                "firstWeightDate": r.first_weight_date,
                "amount": r.amount,
                "roundTrip": r.round_trip,
                "userId": r.user_id,
            });
            match self.api.call("POST", "/weighbridge/save", Some(&body)) {
                Ok(_) => self.db().mark_synced("weights", &r.id, None)?,
                Err(e) if stops(&e) => return Err(e),
                // the server rejected this row: keep it, show why
                Err(e) => self.db().mark_synced("weights", &r.id, Some(&e.to_string()))?,
            }
        }
        self.push_photos()?;
        let tares = self.db().pending_tares(50);
        for r in tares {
            let body = json!({
                "branchCode": or_branch(&r.branch_code),
                "vehicleNumber": r.vehicle_number,
                "wheelType": r.wheel_type,
                "tareWeight": r.tare_weight,
                "voucherNumber": r.voucher_number,
                "voucherDate": r.voucher_date,
                "userId": r.user_id,
            });
            match self.api.call("POST", "/weighbridge/tare", Some(&body)) {
                Ok(_) => self.db().mark_synced("tares", &r.id, None)?,
                Err(e) if stops(&e) => return Err(e),
                Err(e) => self.db().mark_synced("tares", &r.id, Some(&e.to_string()))?,
            }
        }
        let engage = self.db().pending_engage(100);
        for r in engage {
            let body = json!({ "branchCode": or_branch(&r.branch_code), "weight": r.weight, "dateTime": r.date_time });
            match self.api.call("POST", "/weighbridge/engage", Some(&body)) {
                Err(e) if stops(&e) => return Err(e),
                // a bad engage row is not worth blocking the queue
                _ => self.db().mark_synced("engage", &r.id, None)?,
            }
        }
        self.push_engage_photos()
    }

    /// Photos of bridge events (V087), after their event is on the server; same rules as
    /// push_photos. The server finds the event by branch and time.
    pub fn push_engage_photos(&self) -> Res<()> {
        use base64::Engine;
        let branch = self.api.auth().map(|a| a.branch_code).unwrap_or_default();
        let rows = self.db().pending_engage_photos(20);
        for (r, path) in rows {
            let image = match std::fs::read(&path) {
                Ok(b) => base64::engine::general_purpose::STANDARD.encode(b),
                Err(e) => {
                    self.db().mark_engage_photo(&r.id, Some(&format!("photo file missing: {e}")))?;
                    continue;
                }
            };
            let body = json!({
                "branchCode": if r.branch_code.is_empty() { branch.clone() } else { r.branch_code.clone() },
                "dateTime": r.date_time,
                "weight": r.weight,
                "image": image,
            });
            match self.api.call("POST", "/weighbridge/engage/photo", Some(&body)) {
                Ok(_) => self.db().mark_engage_photo(&r.id, None)?,
                Err(e) if stops(&e) => return Err(e),
                Err(e) if matches!(e.status(), Some(404 | 409)) => return Ok(()), // server not ready for them yet
                Err(e) => self.db().mark_engage_photo(&r.id, Some(&e.to_string()))?,
            }
        }
        Ok(())
    }

    /// Camera photos, after their weighing is on the server (V085). A server without photos yet
    /// (404/409) keeps them waiting; a missing file or a rejected photo is not retried.
    pub fn push_photos(&self) -> Res<()> {
        use base64::Engine;
        let branch = self.api.auth().map(|a| a.branch_code).unwrap_or_default();
        let rows = self.db().pending_photos(20);
        for r in rows {
            let path = r.photo_path.clone().unwrap_or_default();
            let image = match std::fs::read(&path) {
                Ok(b) => base64::engine::general_purpose::STANDARD.encode(b),
                Err(e) => {
                    self.db().mark_photo_synced(&r.id, Some(&format!("photo file missing: {e}")))?;
                    continue;
                }
            };
            let body = json!({
                "ddId": r.id,
                "branchCode": if r.branch_code.is_empty() { branch.clone() } else { r.branch_code.clone() },
                "vehicleNumber": r.vehicle_number,
                "voucherNumber": r.voucher_number,
                "takenAt": r.voucher_date,
                "image": image,
            });
            match self.api.call("POST", "/weighbridge/photo", Some(&body)) {
                Ok(_) => self.db().mark_photo_synced(&r.id, None)?,
                Err(e) if stops(&e) => return Err(e),
                Err(e) if matches!(e.status(), Some(404 | 409)) => return Ok(()), // server not ready for photos yet
                Err(e) => self.db().mark_photo_synced(&r.id, Some(&e.to_string()))?,
            }
        }
        Ok(())
    }

    pub fn pull_rates(&self) -> Res<()> {
        let list = self.api.call("GET", "/wb-rates", None)?;
        if let Value::Array(a) = list {
            if !a.is_empty() {
                self.db().replace_rates(&a)?;
            }
        }
        Ok(())
    }

    /// The back office asked this branch to send a day again (Resync Records in the web admin).
    pub fn handle_resync_requests(&self) -> Res<()> {
        let Some(branch) = self.api.auth().map(|a| a.branch_code).filter(|b| !b.is_empty()) else { return Ok(()) };
        let reqs = self.api.call("GET", &format!("/weighbridge/resync-request?branch={}&status=PENDING", enc(&branch)), None)?;
        for rq in reqs.as_array().cloned().unwrap_or_default() {
            let queued = self.db().requeue_date(&vstr(&rq, "resyncDate"))?;
            self.push()?;
            self.api.call(
                "POST",
                &format!("/weighbridge/resync-request/{}/complete", enc(&vstr(&rq, "id"))),
                Some(&json!({ "queuedCount": queued, "note": "Weighbridge app" })),
            )?;
        }
        Ok(())
    }

    /// First sign-in on a PC (or "Refresh history from server"): continue the branch's voucher
    /// numbers, and bring in recent weighings so open first weighings and vehicle history are here.
    /// Returns (weighings added, tares added, last WB, last WT).
    pub fn seed(&self) -> Res<(usize, usize, i64, i64)> {
        let branch = self.api.auth().map(|a| a.branch_code).filter(|b| !b.is_empty()).ok_or_else(|| AppError::validation("Choose the branch first"))?;
        let b = enc(&branch);
        let wb = self.api.call("GET", &format!("/weighbridge/last-voucher?branch={b}&type=WB"), None)?;
        let wt = self.api.call("GET", &format!("/weighbridge/last-voucher?branch={b}&type=WT"), None)?;
        {
            let db = self.db();
            db.ensure_series_at_least("WB", last_number(&wb))?;
            db.ensure_series_at_least("WT", last_number(&wt))?;
        }
        let data = self.api.call("GET", &format!("/weighbridge/sync?branch={b}"), None)?;
        let arr = |k: &str| data.get(k).and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let (w, t) = self.db().import_from_server(&arr("weights"), &arr("tares"))?;
        self.pull_rates()?;
        self.pull_wheel_types()?;
        self.pull_all_wheel_types()?;
        self.pull_all_tares()?;
        let (lwb, lwt) = {
            let db = self.db();
            db.set_setting("seededAt", &Value::String(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)))?;
            (db.last_voucher("WB"), db.last_voucher("WT"))
        };
        self.set(|s| {
            s.online = Some(true);
            s.needs_login = false;
        });
        Ok((w, t, lwb, lwt))
    }

    /// Wheel type the server has in force for a vehicle: set in the web admin, else its newest
    /// weighing or tare at any branch. "" when the server has none.
    pub fn lookup_wheel_type(&self, vehicle: &str) -> Res<String> {
        let r = self.api.call("GET", &format!("/weighbridge/wheel-type/{}", enc(vehicle)), None)?;
        let wt = vstr(&r, "wheelType");
        if wt.is_empty() {
            return Ok(String::new());
        }
        let set = vstr(&r, "source") == "set";
        let date = vstr(&r, if set { "updatedAt" } else { "lastDate" });
        self.db().remember_wheel_type(vehicle, &wt, &date, set)?;
        Ok(wt)
    }

    /// Wheel types set or changed in the web admin since the last pull.
    pub fn pull_wheel_types(&self) -> Res<usize> {
        let since = self.db().get_str("wheelTypesSince");
        let q = if since.is_empty() { String::new() } else { format!("?since={}", enc(&since)) };
        let data = match self.api.call("GET", &format!("/weighbridge/wheel-types/changes{q}"), None) {
            Ok(d) => d,
            Err(e @ AppError::Auth(_)) => return Err(e),
            Err(_) => return Ok(0), // a server without the feature yet: nothing to apply
        };
        let mut latest = since;
        let mut n = 0;
        let db = self.db();
        for r in data.get("rows").and_then(|v| v.as_array()).cloned().unwrap_or_default() {
            let (v, wt, at) = (vstr(&r, "vehicleNumber"), vstr(&r, "wheelType"), vstr(&r, "updatedAt"));
            if v.is_empty() || wt.is_empty() {
                continue;
            }
            db.remember_wheel_type(&v, &wt, &at, true)?;
            if !at.is_empty() && at > latest {
                latest = at;
            }
            n += 1;
        }
        if !latest.is_empty() {
            db.set_setting("wheelTypesSince", &Value::String(latest))?;
        }
        Ok(n)
    }

    /// Every vehicle's wheel type from the server, a page at a time, so this PC knows a lorry last
    /// weighed years ago (at any branch) even offline. Runs at branch setup and once on PCs set up
    /// before this existed. A server without the endpoint yet: nothing to do, tried again later.
    pub fn pull_all_wheel_types(&self) -> Res<usize> {
        const PAGE: usize = 5000;
        let mut after = String::new();
        let mut n = 0;
        loop {
            let data = match self.api.call("GET", &format!("/weighbridge/wheel-types/all?limit={PAGE}&after={}", enc(&after)), None) {
                Ok(d) => d,
                Err(e @ AppError::Auth(_)) => return Err(e),
                Err(e) => {
                    crate::warn!("wheel types {e}");
                    return Ok(n);
                }
            };
            let rows = data.get("rows").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            {
                let db = self.db();
                for r in &rows {
                    let (v, wt) = (vstr(r, "vehicleNumber"), vstr(r, "wheelType"));
                    db.remember_wheel_type(&v, &wt, &vstr(r, "date"), vstr(r, "source") == "set")?;
                    n += 1;
                }
            }
            match rows.last() {
                Some(last) if rows.len() >= PAGE => after = vstr(last, "vehicleNumber"),
                _ => break,
            }
        }
        self.db().set_setting("wheelTypesAllAt", &Value::String(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)))?;
        crate::info!("wheel types: {n} vehicle(s) from the server");
        Ok(n)
    }

    /// Every tare weight on the server, every branch, including old ones imported from the Qt
    /// screen (the seed only brings this branch's last 30 days). Already-known ones are skipped,
    /// so it runs at branch setup and once each time the app starts. A server without the
    /// endpoint yet is skipped and tried again next start.
    pub fn pull_all_tares(&self) -> Res<usize> {
        const PAGE: usize = 5000;
        let mut after = String::new();
        let mut n = 0;
        loop {
            let data = match self.api.call("GET", &format!("/weighbridge/tares/all?limit={PAGE}&after={}", enc(&after)), None) {
                Ok(d) => d,
                Err(e @ AppError::Auth(_)) => return Err(e),
                Err(e) => {
                    crate::warn!("tares {e}");
                    return Ok(n);
                }
            };
            let rows = data.get("rows").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            n += self.db().import_from_server(&[], &rows)?.1;
            match rows.last() {
                Some(last) if rows.len() >= PAGE => after = vstr(last, "id"),
                _ => break,
            }
        }
        self.tares_pulled.store(true, std::sync::atomic::Ordering::Relaxed);
        crate::info!("tares: {n} new from the server");
        Ok(n)
    }

    pub fn has_pulled_tares(&self) -> bool {
        self.tares_pulled.load(std::sync::atomic::Ordering::Relaxed)
    }

    /// True once this PC has downloaded every vehicle's wheel type.
    pub fn has_all_wheel_types(&self) -> bool {
        !self.db().get_str("wheelTypesAllAt").is_empty()
    }

    /// Weighings of this branch the web admin reopened since the last pull. Returns how many
    /// changed here. A server without the feature yet answers with an error: nothing to apply.
    pub fn pull_reopened(&self) -> Res<usize> {
        let Some(branch) = self.api.auth().map(|a| a.branch_code).filter(|b| !b.is_empty()) else { return Ok(0) };
        let saved = self.db().get_setting("reopenedSince");
        let since = saved.filter(|s| vstr(s, "branch") == branch).map(|s| vstr(&s, "at")).unwrap_or_default();
        let q = if since.is_empty() { String::new() } else { format!("&since={}", enc(&since)) };
        let data = match self.api.call("GET", &format!("/weighbridge/reopened?branch={}{q}", enc(&branch)), None) {
            Ok(d) => d,
            Err(e @ AppError::Auth(_)) => return Err(e),
            Err(_) => return Ok(0),
        };
        let rows = data.get("rows").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let n = if rows.is_empty() { 0 } else { self.db().apply_reopened(&rows)? };
        let mut latest = since.clone();
        for r in &rows {
            let at = vstr(r, "reopenedAt");
            if !at.is_empty() && at > latest {
                latest = at;
            }
        }
        if !latest.is_empty() && latest != since {
            self.db().set_setting("reopenedSince", &json!({ "branch": branch, "at": latest }))?;
        }
        if n > 0 {
            (self.on_event)(SyncEvent::Reopened(n));
        }
        Ok(n)
    }

    /// This PC checks in (Weighbridge PCs in the web admin) and learns whether its Settings are open.
    pub fn checkin_terminal(&self, body: &Value) -> Res<Value> {
        self.api.call("POST", "/weighbridge/terminals/checkin", Some(body))
    }

    /// The Settings copy kept on the server (V084): this PC's, else the newest at the branch.
    pub fn saved_settings(&self, terminal_id: &str, branch: &str) -> Res<Value> {
        let q = if branch.is_empty() { String::new() } else { format!("?branch={}", enc(branch)) };
        match self.api.call("GET", &format!("/weighbridge/terminals/{}/saved-settings{q}", enc(terminal_id)), None) {
            Err(e) if e.status() == Some(404) => Ok(json!({ "supported": false })),
            other => other,
        }
    }

    pub fn add_rate(&self, wheel_type: &str, wheel_rate: f64, terminal_id: &str) -> Res<()> {
        self.api.call("POST", "/wb-rates", Some(&json!({ "wheelType": wheel_type, "wheelRate": wheel_rate, "terminalId": terminal_id })))?;
        self.pull_rates()
    }
}

fn last_number(v: &Value) -> i64 {
    match v.get("lastNumber") {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0).floor() as i64,
        Some(Value::String(s)) => s.trim().parse::<f64>().map(|f| f.floor() as i64).unwrap_or(0),
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::http::fake::FakeServer;
    use crate::store::{NewWeighing, Pick};

    fn auth() -> Option<Auth> {
        Some(Auth { api_server: "https://srv".into(), tenant_id: "T1".into(), token: "tok".into(), branch_code: "WB1".into() })
    }

    fn store_with_rates() -> Shared {
        let mut s = Store::memory();
        s.replace_rates(&[json!({ "id": "r", "wheelType": "6 WHEEL", "wheelRate": 100, "voucherDate": "2026-01-01" })]).unwrap();
        Arc::new(Mutex::new(s))
    }

    fn weigh(s: &Shared, vehicle: &str, weight: f64, pick: Pick) -> crate::store::Weighing {
        s.lock()
            .unwrap()
            .save_weighing(NewWeighing { vehicle_number: vehicle.into(), wheel_type: "6 WHEEL".into(), weight, branch_code: "WB1".into(), source: pick, ..Default::default() })
            .unwrap()
    }

    fn sync(s: &Shared, srv: FakeServer) -> (Syncer, Arc<FakeServer>) {
        let srv = Arc::new(srv);
        let api = Api::new(srv.clone(), auth);
        (Syncer::new(s.clone(), api, |_| {}), srv)
    }

    fn ok(v: Value) -> impl Fn(&crate::http::fake::Call) -> (u16, Value) + Send + Sync {
        move |_| (200, v.clone())
    }

    #[test]
    fn uploads_weighings() {
        let s = store_with_rates();
        let row = weigh(&s, "KL1", 9000.0, Pick::None);
        let (sy, srv) = sync(&s, FakeServer::default().on("POST /weighbridge/save", ok(json!({ "success": true }))).on("GET /wb-rates", ok(json!([]))).on("GET /weighbridge/resync-request", ok(json!([]))));
        let st = sy.run(false);
        let save = srv.calls().into_iter().find(|c| c.path == "/weighbridge/save").unwrap();
        assert_eq!(save.method, "POST");
        let save = save.body.unwrap();
        assert_eq!(save["ddId"], row.id.as_str());
        assert_eq!(save["voucherNumber"], "000001");
        assert_eq!(save["roundTrip"], 0);
        assert_eq!(save["amount"], 100.0);
        assert_eq!(st.pending.weights, 0);
        assert_eq!(st.online, Some(true));
    }

    #[test]
    fn offline_keeps_rows() {
        let s = store_with_rates();
        weigh(&s, "KL1", 9000.0, Pick::None);
        let f = FakeServer::default();
        *f.down.lock().unwrap() = true;
        let (sy, _) = sync(&s, f);
        let st = sy.run(false);
        assert_eq!(st.online, Some(false));
        assert_eq!(st.pending.weights, 1);
    }

    #[test]
    fn expired_login_keeps_rows() {
        let s = store_with_rates();
        weigh(&s, "KL1", 9000.0, Pick::None);
        let (sy, _) = sync(&s, FakeServer::default().on("POST /weighbridge/save", |_| (401, json!({}))));
        let st = sy.run(false);
        assert!(st.needs_login);
        assert_eq!(st.pending.weights, 1);
    }

    #[test]
    fn rejected_row_kept_with_reason() {
        let s = store_with_rates();
        let bad = weigh(&s, "KL1", 9000.0, Pick::None);
        weigh(&s, "KL2", 9000.0, Pick::None);
        let bad_id = bad.id.clone();
        let (sy, _) = sync(
            &s,
            FakeServer::default()
                .on("POST /weighbridge/save", move |c| if c.body.as_ref().unwrap()["ddId"] == bad_id.as_str() { (500, json!({ "error": "boom" })) } else { (200, json!({ "success": true })) })
                .on("GET /wb-rates", ok(json!([])))
                .on("GET /weighbridge/resync-request", ok(json!([]))),
        );
        let st = sy.run(false);
        assert_eq!(st.pending.weights, 1);
        assert_eq!(s.lock().unwrap().get_weighing(&bad.id).unwrap().sync_error.as_deref(), Some("boom"));
    }

    #[test]
    fn resync_request_resends_the_day() {
        let s = store_with_rates();
        let row = weigh(&s, "KL1", 9000.0, Pick::None);
        s.lock().unwrap().mark_synced("weights", &row.id, None).unwrap();
        let day: String = row.voucher_date.chars().take(10).collect();
        let (sy, srv) = sync(
            &s,
            FakeServer::default()
                .on("POST /weighbridge/save", ok(json!({ "success": true })))
                .on("GET /wb-rates", ok(json!([{ "id": "n", "wheelType": "6 WHEEL", "wheelRate": 120, "voucherDate": "2026-09-01" }])))
                .on("GET /weighbridge/resync-request", ok(json!([{ "id": "rq1", "resyncDate": day }])))
                .on("POST /weighbridge/resync-request/rq1/complete", ok(json!({}))),
        );
        sy.run(false);
        let calls = srv.calls();
        let done = calls.iter().find(|c| c.path.ends_with("/complete")).unwrap();
        assert_eq!(done.body.as_ref().unwrap()["queuedCount"], 1);
        assert_eq!(calls.iter().filter(|c| c.path == "/weighbridge/save").count(), 1);
        assert_eq!(s.lock().unwrap().rates()[0].1, 120.0, "rates refreshed from server");
    }

    #[test]
    fn seed_continues_numbers_and_imports() {
        let s = store_with_rates();
        let (sy, _) = sync(
            &s,
            FakeServer::default()
                .on("GET /weighbridge/last-voucher", |c| (200, json!({ "lastNumber": if c.path.contains("type=WB") { 4521 } else { 33 } })))
                .on("GET /weighbridge/sync", ok(json!({ "weights": [{ "ddId": "q1", "vehicleNumber": "KL9", "lcdNumber": 5000, "roundTrip": 0 }], "tares": [] })))
                .on("GET /wb-rates", ok(json!([]))),
        );
        assert_eq!(sy.seed().unwrap(), (1, 0, 4521, 33));
        assert_eq!(weigh(&s, "KL9", 1.0, Pick::None).voucher_number, "004522");
    }

    #[test]
    fn all_wheel_types_page_through_and_keep_set_ones_first() {
        let s = store_with_rates();
        let (sy, srv) = sync(
            &s,
            FakeServer::default().on("GET /weighbridge/wheel-types/all", |c| {
                if c.path.contains("after=&") || c.path.ends_with("after=") {
                    (200, json!({ "rows": [
                        { "vehicleNumber": "KL01A1", "wheelType": "6 WHEEL", "source": "history", "date": "2024-05-01 09:00:00" },
                        { "vehicleNumber": "KL01A2", "wheelType": "10 WHEEL", "source": "set", "date": "2026-09-30 10:00:00" },
                    ] }))
                } else {
                    (200, json!({ "rows": [] }))
                }
            }),
        );
        assert!(!sy.has_all_wheel_types());
        assert_eq!(sy.pull_all_wheel_types().unwrap(), 2);
        assert!(sy.has_all_wheel_types());
        assert!(srv.calls()[0].path.contains("limit=5000"));
        let db = s.lock().unwrap();
        assert_eq!(db.wheel_type_of("KL01A1"), "6 WHEEL");
        assert_eq!(db.wheel_type_of("kl 01 a2"), "10 WHEEL");
    }

    #[test]
    fn all_wheel_types_on_an_old_server_is_not_an_error() {
        let s = store_with_rates();
        let (sy, _) = sync(&s, FakeServer::default());
        assert_eq!(sy.pull_all_wheel_types().unwrap(), 0);
        assert!(!sy.has_all_wheel_types());
    }

    #[test]
    fn wheel_type_lookup() {
        let s = store_with_rates();
        let (sy, _) = sync(
            &s,
            FakeServer::default()
                .on("GET /weighbridge/wheel-type/MH12Q7", ok(json!({ "vehicleNumber": "MH12Q7", "wheelType": "10 WHEEL", "source": "history", "lastDate": "2026-09-01 10:00:00" })))
                .on("GET /weighbridge/wheel-type/NONE1", ok(json!({ "vehicleNumber": "NONE1", "wheelType": "", "source": "none" }))),
        );
        assert_eq!(sy.lookup_wheel_type("MH12Q7").unwrap(), "10 WHEEL");
        assert_eq!(s.lock().unwrap().wheel_type_of("MH12Q7"), "10 WHEEL");
        assert_eq!(sy.lookup_wheel_type("NONE1").unwrap(), "");
    }

    #[test]
    fn all_tares_come_down_from_every_branch_and_only_once() {
        let s = store_with_rates();
        let (sy, srv) = sync(
            &s,
            FakeServer::default().on("GET /weighbridge/tares/all", ok(json!({ "rows": [
                { "id": "1ca158ac", "vehicleNumber": "KL39T9183", "voucherDate": null, "voucherNumber": "000463", "tareWeight": 13680, "wheelType": "10 WHEEL", "branchCode": "STMWB" },
                { "id": "843147d5", "vehicleNumber": "KL829688", "voucherDate": "2023-09-20 15:03:13", "voucherNumber": "4076", "tareWeight": 1730, "wheelType": "4 WHEEL", "branchCode": "KTR" }
            ], "limit": 5000 }))),
        );
        assert!(!sy.has_pulled_tares());
        assert_eq!(sy.pull_all_tares().unwrap(), 2);
        assert!(sy.has_pulled_tares());
        assert_eq!(sy.pull_all_tares().unwrap(), 0, "already known");
        assert_eq!(srv.calls().last().unwrap().path, "/weighbridge/tares/all?limit=5000&after=");
        let (_, tares) = s.lock().unwrap().history("KL39T9183", 10);
        assert_eq!(tares.len(), 1);
        assert_eq!(tares[0].tare_weight, 13680.0);
        let (old, _) = sync(&store_with_rates(), FakeServer::default());
        assert_eq!(old.pull_all_tares().unwrap(), 0, "a server without the endpoint is skipped");
        assert!(!old.has_pulled_tares(), "and tried again later");
    }

    #[test]
    fn wheel_type_spelled_differently_matches_the_rate() {
        // KL16Y5696 in production: saved as "6 Wheel" by the Qt screen, rate is "6 WHEEL"
        let s = store_with_rates();
        let (sy, _) = sync(&s, FakeServer::default().on("GET /weighbridge/wheel-type/KL16Y5696", ok(json!({ "vehicleNumber": "KL16Y5696", "wheelType": "6 Wheel ", "source": "history", "lastDate": "2025-01-01 10:00:00" }))));
        sy.lookup_wheel_type("KL16Y5696").unwrap();
        let st = s.lock().unwrap();
        assert_eq!(st.wheel_type_of("KL16Y5696"), "6 WHEEL", "shown as the rate's wheel type");
        assert!(st.check_wheel_type("KL16Y5696", "6 WHEEL").is_ok());
        assert!(st.check_wheel_type("KL16Y5696", "10 WHEEL").is_err());
        assert_eq!(crate::charge::rate_for(&st.all_rates(), "6 wheel"), 100.0);
    }

    #[test]
    fn wheel_type_changes_from_where_it_left_off() {
        let s = store_with_rates();
        weigh(&s, "KL07AB1234", 9000.0, Pick::None);
        let (sy, srv) = sync(&s, FakeServer::default().on("GET /weighbridge/wheel-types/changes", ok(json!({ "installed": true, "rows": [{ "vehicleNumber": "KL07AB1234", "wheelType": "10 WHEEL", "updatedAt": "2026-10-01 05:20:11.123456" }] }))));
        assert_eq!(sy.pull_wheel_types().unwrap(), 1);
        assert_eq!(s.lock().unwrap().wheel_type_of("KL07AB1234"), "10 WHEEL");
        sy.pull_wheel_types().unwrap();
        assert_eq!(srv.calls().last().unwrap().path, "/weighbridge/wheel-types/changes?since=2026-10-01%2005%3A20%3A11.123456");
        let (old, _) = sync(&store_with_rates(), FakeServer::default());
        assert_eq!(old.pull_wheel_types().unwrap(), 0, "a server without the feature is ignored");
    }

    #[test]
    fn failing_resync_check_is_not_offline() {
        let s = store_with_rates();
        weigh(&s, "KL1", 9000.0, Pick::None);
        let warns = Arc::new(Mutex::new(Vec::<String>::new()));
        let w2 = warns.clone();
        let srv = Arc::new(
            FakeServer::default()
                .on("POST /weighbridge/save", ok(json!({ "success": true })))
                .on("GET /wb-rates", ok(json!([])))
                .on("GET /weighbridge/resync-request", |_| (500, json!({ "error": "relation wb_resync_request does not exist" }))),
        );
        let sy = Syncer::new(s.clone(), Api::new(srv, auth), move |e| if let SyncEvent::Warn(m) = e { w2.lock().unwrap().push(m) });
        let st = sy.run(true);
        assert_eq!(st.online, Some(true));
        assert_eq!(st.pending.weights, 0);
        assert!(warns.lock().unwrap()[0].contains("wb_resync_request"));
    }

    #[test]
    fn reopened_pull_remembers_cursor() {
        let s = store_with_rates();
        let first = weigh(&s, "KL1", 9000.0, Pick::None);
        let back = weigh(&s, "KL1", 4000.0, Pick::Previous(first.id.clone()));
        s.lock().unwrap().mark_synced("weights", &first.id, None).unwrap();
        s.lock().unwrap().mark_synced("weights", &back.id, None).unwrap();
        let fid = first.id.clone();
        let (sy, srv) = sync(&s, FakeServer::default().on("GET /weighbridge/reopened", move |_| (200, json!({ "installed": true, "rows": [{ "id": "x", "ddId": fid, "vehicleNumber": "KL1", "reopenedAt": "2026-10-01T12:00:00.123456" }] }))));
        assert_eq!(sy.pull_reopened().unwrap(), 1);
        assert_eq!(s.lock().unwrap().get_weighing(&first.id).unwrap().round_trip, 0);
        sy.pull_reopened().unwrap();
        let calls = srv.calls();
        assert_eq!(calls[0].path, "/weighbridge/reopened?branch=WB1");
        assert_eq!(calls[1].path, "/weighbridge/reopened?branch=WB1&since=2026-10-01T12%3A00%3A00.123456");
        let (none, _) = sync(&store_with_rates(), FakeServer::default());
        assert_eq!(none.pull_reopened().unwrap(), 0);
    }

    #[test]
    fn photos_wait_for_a_server_without_v085() {
        let s = store_with_rates();
        let w = weigh(&s, "KL1", 9000.0, Pick::None);
        let dir = std::env::temp_dir().join(format!("wbphoto-{}", w.id));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("p.jpg");
        std::fs::write(&file, [0xff, 0xd8, 0xff, 0xd9]).unwrap();
        s.lock().unwrap().set_photo(&w.id, file.to_str().unwrap(), true).unwrap();
        let (sy, _) = sync(&s, FakeServer::default().on("POST /weighbridge/save", ok(json!({}))).on("GET /wb-rates", ok(json!([]))).on("GET /weighbridge/resync-request", ok(json!([]))));
        sy.run(false);
        assert_eq!(s.lock().unwrap().pending_count().photos, 1, "404 from an older server: keep waiting");
        let (sy2, srv2) = sync(&s, FakeServer::default().on("POST /weighbridge/photo", ok(json!({ "saved": true }))));
        sy2.push_photos().unwrap();
        assert_eq!(s.lock().unwrap().pending_count().photos, 0);
        assert_eq!(srv2.calls()[0].body.as_ref().unwrap()["image"], "/9j/2Q==");
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn bridge_event_photos_follow_their_event() {
        let s = store_with_rates();
        let dir = std::env::temp_dir().join(format!("wbengage-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("e.jpg");
        std::fs::write(&file, [0xff, 0xd8, 0xff, 0xd9]).unwrap();
        let at = chrono::NaiveDate::from_ymd_opt(2026, 10, 3).unwrap().and_hms_opt(9, 15, 0).unwrap();
        s.lock().unwrap().add_engage_with_photo(12000.0, "WB1", Some(at), Some((file.to_str().unwrap(), true))).unwrap();
        s.lock().unwrap().add_engage_with_photo(9000.0, "WB1", Some(at), Some((file.to_str().unwrap(), false))).unwrap(); // upload off
        let base = || FakeServer::default().on("POST /weighbridge/engage", ok(json!({ "success": true }))).on("GET /wb-rates", ok(json!([]))).on("GET /weighbridge/resync-request", ok(json!([])));
        let (sy, _) = sync(&s, base().on("POST /weighbridge/engage/photo", |_| (409, json!({ "error": "run V087" }))));
        sy.run(false);
        assert_eq!(s.lock().unwrap().pending_count().photos, 1, "an older server: keep waiting");
        let (sy2, srv2) = sync(&s, base().on("POST /weighbridge/engage/photo", ok(json!({ "success": true }))));
        sy2.run(false);
        assert_eq!(s.lock().unwrap().pending_count().photos, 0);
        let sent: Vec<_> = srv2.calls().into_iter().filter(|c| c.path == "/weighbridge/engage/photo").collect();
        assert_eq!(sent.len(), 1);
        let body = sent[0].body.as_ref().unwrap();
        assert_eq!((body["branchCode"].as_str(), body["weight"].as_i64(), body["image"].as_str()), (Some("WB1"), Some(12000), Some("/9j/2Q==")));
        assert!(body["dateTime"].as_str().unwrap().starts_with("2026-10-03"));
        let _ = std::fs::remove_dir_all(dir);
    }
}
