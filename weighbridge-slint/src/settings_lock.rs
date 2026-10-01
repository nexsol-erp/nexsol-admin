// Locks the Settings tab once the PC is set up. The first save in Settings (indicator, printing,
// weighing, camera, a branch change) marks the PC as set up; Settings stay open for the rest of
// that run and are locked from the next start. Only the web admin (Weighbridge PCs) opens them
// again. That opening lasts until Settings are saved on the PC and the app is restarted: the PC
// reports the save, and the server closes the opening.
//
// The lock applies only once the server has said it supports it (V078), so a PC is never locked
// with no way to open it. Offline, the last answer from the server stands.
//
// Rates have their own switch (V079): the Rates tab is view only unless the web admin has allowed
// rate changes on this PC. Developer tools (V082) don't exist in this app, but the switch is kept.
//
// After every Settings save the PC sends a copy of its Settings with the next check-in, until the
// server says it kept it (V084). PCs set up before this send one copy too.
//
// Port of electron/settingsLock.js. State is the same "settingsLock" settings row, and the PC id
// is the same "terminalId" row, so the Weighbridge PCs page sees one PC whichever app runs.

use crate::error::{AppError, Res};
use crate::store::Store;
use serde_json::{json, Map, Value};
use std::sync::{Arc, Mutex};

const KEY: &str = "settingsLock";

#[derive(Debug, Clone, Default, PartialEq)]
pub struct LockState {
    pub locked: bool,
    pub terminal_id: String,
    pub setup_done: bool,
    pub server_supports: bool,
    pub unlocked: bool,
    pub unlocked_by: String,
    /// open now only because something was saved this run: locks at the next start
    pub locks_on_restart: bool,
    pub rates_managed: bool,
    pub rates_unlocked: bool,
    pub backup_supported: bool,
    pub backup_pending: bool,
    pub backup_saved_at: String,
}

type Checkin = Box<dyn Fn(&Value) -> Res<Value> + Send + Sync>;
type Info = Box<dyn Fn() -> Map<String, Value> + Send + Sync>;
type Snapshot = Box<dyn Fn() -> Value + Send + Sync>;

pub struct SettingsLock {
    store: Arc<Mutex<Store>>,
    checkin: Checkin,
    info: Info,
    snapshot: Option<Snapshot>,
    saved_this_run: Mutex<bool>,
    busy: Mutex<()>,
}

fn b(v: &Value, k: &str) -> bool {
    v.get(k).and_then(|x| x.as_bool()).unwrap_or(false)
}

fn s(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

impl SettingsLock {
    pub fn new(store: Arc<Mutex<Store>>, checkin: Checkin, info: Info, snapshot: Option<Snapshot>) -> SettingsLock {
        {
            let db = store.lock().unwrap();
            if db.get_str("terminalId").is_empty() {
                let _ = db.set_setting("terminalId", &Value::String(uuid::Uuid::new_v4().to_string()));
            }
            if db.get_setting(KEY).is_none() {
                // PCs set up before the lock existed: an indicator or weighing setup counts as set up.
                let set_up = db.get_setting("indicator").is_some() || db.get_setting("weighing").is_some();
                let _ = db.set_setting(
                    KEY,
                    &json!({ "setupDone": set_up, "serverSupports": false, "unlocked": false, "unlockedAt": null, "unlockedBy": null, "usedUnlockAt": null }),
                );
            }
            // a PC set up before the server kept copies sends one now
            let cur = db.get_setting(KEY).unwrap_or(json!({}));
            if b(&cur, "setupDone") && cur.get("backupPending").is_none() {
                let mut next = cur.clone();
                next["backupPending"] = json!(true);
                let _ = db.set_setting(KEY, &next);
            }
        }
        SettingsLock { store, checkin, info, snapshot, saved_this_run: Mutex::new(false), busy: Mutex::new(()) }
    }

    pub fn terminal_id(&self) -> String {
        self.store.lock().unwrap().get_str("terminalId")
    }

    fn get(&self) -> Value {
        self.store.lock().unwrap().get_setting(KEY).filter(|v| v.is_object()).unwrap_or(json!({}))
    }

    fn put(&self, v: &Value) {
        let _ = self.store.lock().unwrap().set_setting(KEY, v);
    }

    pub fn locked(&self) -> bool {
        let st = self.get();
        !*self.saved_this_run.lock().unwrap() && b(&st, "setupDone") && b(&st, "serverSupports") && !b(&st, "unlocked")
    }

    pub fn state(&self) -> LockState {
        let st = self.get();
        let saved = *self.saved_this_run.lock().unwrap();
        LockState {
            locked: self.locked(),
            terminal_id: self.terminal_id(),
            setup_done: b(&st, "setupDone"),
            server_supports: b(&st, "serverSupports"),
            unlocked: b(&st, "unlocked"),
            unlocked_by: s(&st, "unlockedBy"),
            locks_on_restart: saved && b(&st, "serverSupports") && !b(&st, "unlocked"),
            rates_managed: self.rates_managed(),
            rates_unlocked: b(&st, "ratesUnlocked"),
            backup_supported: b(&st, "serverSupports") && b(&st, "backupSupported"),
            backup_pending: b(&st, "backupPending"),
            backup_saved_at: s(&st, "backupSavedAt"),
        }
    }

    fn rates_managed(&self) -> bool {
        let st = self.get();
        b(&st, "serverSupports") && b(&st, "ratesSupported")
    }

    /// May this PC change rates? Servers without V079 keep the old rule: admins only.
    pub fn rates_allowed(&self, is_admin: bool) -> bool {
        if self.rates_managed() { b(&self.get(), "ratesUnlocked") } else { is_admin }
    }

    pub fn require_rates(&self, is_admin: bool) -> Res<()> {
        if self.rates_allowed(is_admin) {
            return Ok(());
        }
        Err(AppError::validation(if self.rates_managed() {
            "Rates are locked on this PC. Change them in the web admin (Weighbridge Rates), or ask an admin to allow rate changes here."
        } else {
            "Only an admin can change this"
        }))
    }

    /// Errors when Settings may not be changed now.
    pub fn require(&self) -> Res<()> {
        if self.locked() {
            return Err(AppError::validation("Settings are locked. Ask an admin to allow changes in the web admin (Weighbridge PCs)."));
        }
        Ok(())
    }

    /// A Settings save went through: the PC is set up, and an opening from the web is used up.
    /// The caller should refresh() afterwards (off the screen's thread) to report it.
    pub fn saved(&self) {
        let mut st = self.get();
        st["setupDone"] = json!(true);
        st["backupPending"] = json!(true);
        if b(&st, "unlocked") {
            st["unlocked"] = json!(false);
            st["usedUnlockAt"] = json!(s(&st, "unlockedAt"));
        }
        *self.saved_this_run.lock().unwrap() = true;
        self.put(&st);
    }

    /// Asks the server; returns the state. Errors (offline, signed out, older server) keep the
    /// last answer. Err carries the failure for the log.
    pub fn refresh(&self) -> Result<LockState, (LockState, AppError)> {
        let _busy = self.busy.lock().unwrap();
        let sent = { let u = s(&self.get(), "usedUnlockAt"); if self.get().get("usedUnlockAt").is_some_and(|v| !v.is_null()) { Some(u) } else { None } };
        let backup = if b(&self.get(), "backupPending") { self.snapshot.as_ref().map(|f| f()) } else { None };
        let mut body = Map::new();
        body.insert("terminalId".into(), json!(self.terminal_id()));
        for (k, v) in (self.info)() {
            body.insert(k, v);
        }
        if let Some(u) = &sent {
            body.insert("settingsUsed".into(), json!(u));
        }
        if let Some(bk) = &backup {
            body.insert("settings".into(), bk.clone());
        }
        let r = match (self.checkin)(&Value::Object(body)) {
            Ok(r) => r,
            Err(e) => return Err((self.state(), e)),
        };
        let cur = self.get();
        let pending = cur.get("usedUnlockAt").filter(|v| !v.is_null()).map(|v| v.as_str().unwrap_or("").to_string());
        let mut next = cur.clone();
        if r.get("installed") == Some(&json!(false)) {
            for k in ["serverSupports", "unlocked", "ratesSupported", "ratesUnlocked", "devToolsSupported", "devToolsEnabled"] {
                next[k] = json!(false);
            }
        } else if r.is_object() {
            next["backupSupported"] = json!(b(&r, "settingsBackupSupported"));
            // a save after this copy was taken keeps the copy pending: compare what was sent
            if let Some(bk) = &backup {
                let now = self.snapshot.as_ref().map(|f| f());
                if b(&r, "settingsStored") && now.as_ref() == Some(bk) {
                    next["backupPending"] = json!(false);
                    next["backupSavedAt"] = json!(chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
                }
            }
            next["devToolsSupported"] = json!(b(&r, "devToolsSupported"));
            next["devToolsEnabled"] = json!(b(&r, "devToolsEnabled"));
            next["ratesSupported"] = json!(b(&r, "ratesSupported"));
            next["ratesUnlocked"] = json!(b(&r, "ratesUnlocked"));
            next["serverSupports"] = json!(true);
            // an opening this PC has already used stays closed, whatever an earlier reply said
            let at = r.get("unlockedAt").filter(|v| !v.is_null()).and_then(|v| v.as_str()).map(String::from);
            next["unlocked"] = json!(b(&r, "settingsUnlocked") && !(pending.is_some() && pending == at));
            next["unlockedAt"] = at.map(Value::String).unwrap_or(Value::Null);
            next["unlockedBy"] = r.get("unlockedBy").filter(|v| v.is_string()).cloned().unwrap_or(Value::Null);
        }
        if sent.is_some() && pending == sent {
            next["usedUnlockAt"] = Value::Null;
        }
        self.put(&next);
        Ok(self.state())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // A server that keeps one PC's opening like WbTerminalStore does.
    #[derive(Default)]
    struct Srv {
        installed: bool,
        unlocked: bool,
        unlocked_at: Option<String>,
        calls: Vec<Value>,
        down: bool,
        rates: bool,
        backup: bool,
        kept: Vec<Value>,
    }

    type S = Arc<Mutex<Srv>>;

    fn srv() -> S {
        Arc::new(Mutex::new(Srv { installed: true, ..Default::default() }))
    }

    fn checkin(srv: &S) -> Checkin {
        let srv = srv.clone();
        Box::new(move |body: &Value| {
            let mut s = srv.lock().unwrap();
            s.calls.push(body.clone());
            if s.down {
                return Err(AppError::Network("offline".into()));
            }
            if !s.installed {
                return Ok(json!({ "installed": false, "settingsUnlocked": false }));
            }
            if let Some(used) = body.get("settingsUsed").and_then(|v| v.as_str()) {
                if s.unlocked && s.unlocked_at.as_deref() == Some(used) {
                    s.unlocked = false;
                }
            }
            let stored = s.backup && body.get("settings").is_some();
            if stored {
                let v = body["settings"].clone();
                s.kept.push(v);
            }
            Ok(json!({
                "installed": true, "settingsUnlocked": s.unlocked, "unlockedAt": s.unlocked_at,
                "unlockedBy": if s.unlocked { json!("hcadmin") } else { Value::Null },
                "ratesSupported": true, "ratesUnlocked": s.rates,
                "settingsBackupSupported": s.backup, "settingsStored": stored,
            }))
        })
    }

    fn open(srv: &S, at: &str) {
        let mut s = srv.lock().unwrap();
        s.unlocked = true;
        s.unlocked_at = Some(at.into());
    }

    fn restart(store: &Arc<Mutex<Store>>, srv: &S) -> SettingsLock {
        SettingsLock::new(store.clone(), checkin(srv), Box::new(|| { let mut m = Map::new(); m.insert("branchCode".into(), json!("WB1")); m }), None)
    }

    fn mem() -> Arc<Mutex<Store>> {
        Arc::new(Mutex::new(Store::memory()))
    }

    #[test]
    fn new_pc_open_until_first_save_then_locks_next_start() {
        let store = mem();
        let srv = srv();
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(!lock.locked());
        lock.require().unwrap();
        lock.saved();
        assert!(!lock.locked(), "the run that saved stays open");
        assert!(lock.state().locks_on_restart);
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(lock.locked());
        assert!(lock.require().is_err());
        let calls = srv.lock().unwrap().calls.clone();
        assert_eq!(calls.last().unwrap()["terminalId"], calls[0]["terminalId"], "the PC keeps its id");
    }

    #[test]
    fn web_admin_opens_and_save_plus_restart_locks_again() {
        let store = mem();
        let srv = srv();
        let lock = restart(&store, &srv);
        lock.saved();
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(lock.locked());
        open(&srv, "2026-10-01 10:00:00.123");
        lock.refresh().unwrap();
        assert!(!lock.locked(), "opens without a restart");
        assert_eq!(lock.state().unlocked_by, "hcadmin");
        lock.saved();
        lock.refresh().unwrap();
        assert!(!srv.lock().unwrap().unlocked, "the server closed the opening");
        assert!(!lock.locked(), "still open for this run");
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(lock.locked());
    }

    #[test]
    fn opening_used_offline_reported_later_newer_opening_kept() {
        let store = mem();
        let srv = srv();
        let lock = restart(&store, &srv);
        lock.saved();
        open(&srv, "2026-10-01 10:00:00.0");
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(!lock.locked());
        srv.lock().unwrap().down = true;
        lock.saved();
        assert!(lock.refresh().is_err());
        let lock = restart(&store, &srv);
        let _ = lock.refresh();
        assert!(lock.locked(), "offline, the used opening stays closed on the PC");
        open(&srv, "2026-10-01 11:00:00.0");
        srv.lock().unwrap().down = false;
        lock.refresh().unwrap();
        assert_eq!(srv.lock().unwrap().calls.last().unwrap()["settingsUsed"], "2026-10-01 10:00:00.0");
        assert!(srv.lock().unwrap().unlocked, "the newer opening is not closed by the old report");
        assert!(!lock.locked());
        lock.refresh().unwrap();
        assert!(srv.lock().unwrap().calls.last().unwrap().get("settingsUsed").is_none(), "reported once");
    }

    #[test]
    fn never_locks_against_a_server_without_the_feature() {
        let store = mem();
        let srv = srv();
        srv.lock().unwrap().installed = false;
        let lock = restart(&store, &srv);
        lock.saved();
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(!lock.locked());
        let s2 = mem();
        let down = self::srv();
        down.lock().unwrap().down = true;
        let lock = restart(&s2, &down);
        lock.saved();
        let lock = restart(&s2, &down);
        let _ = lock.refresh();
        assert!(!lock.locked());
    }

    #[test]
    fn pc_set_up_before_the_lock_counts_as_set_up() {
        let store = mem();
        store.lock().unwrap().set_setting("indicator", &json!({ "presetId": "qt-default", "overrides": {} })).unwrap();
        let srv = srv();
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(lock.locked());
    }

    #[test]
    fn rates_view_only_unless_allowed() {
        let store = mem();
        let srv = srv();
        let lock = restart(&store, &srv);
        assert!(lock.rates_allowed(true), "before the server answers, admins keep the old rule");
        assert!(!lock.rates_allowed(false));
        lock.refresh().unwrap();
        assert!(lock.state().rates_managed);
        assert!(lock.require_rates(true).unwrap_err().to_string().contains("web admin"));
        srv.lock().unwrap().rates = true;
        lock.refresh().unwrap();
        lock.require_rates(false).unwrap();
        lock.saved();
        let lock = restart(&store, &srv);
        lock.refresh().unwrap();
        assert!(lock.rates_allowed(false), "a save or restart doesn't close rates");
        srv.lock().unwrap().rates = false;
        lock.refresh().unwrap();
        assert!(!lock.rates_allowed(true));
    }

    #[test]
    fn each_save_sends_a_copy_until_kept() {
        let store = mem();
        let srv = srv();
        let settings = Arc::new(Mutex::new(json!({ "print": { "copies": 1 } })));
        let s2 = settings.clone();
        let lock = SettingsLock::new(store.clone(), checkin(&srv), Box::new(Map::new), Some(Box::new(move || s2.lock().unwrap().clone())));
        lock.refresh().unwrap();
        assert!(srv.lock().unwrap().calls.last().unwrap().get("settings").is_none(), "nothing saved yet, nothing sent");
        lock.saved();
        lock.refresh().unwrap();
        assert_eq!(srv.lock().unwrap().calls.last().unwrap()["settings"], json!({ "print": { "copies": 1 } }));
        assert!(lock.state().backup_pending, "an older server: keep it for later");
        srv.lock().unwrap().backup = true;
        lock.refresh().unwrap();
        assert_eq!(srv.lock().unwrap().kept, vec![json!({ "print": { "copies": 1 } })]);
        assert!(!lock.state().backup_pending);
        assert!(lock.state().backup_supported);
        lock.refresh().unwrap();
        assert!(srv.lock().unwrap().calls.last().unwrap().get("settings").is_none(), "sent once");
        *settings.lock().unwrap() = json!({ "print": { "copies": 2 } });
        lock.saved();
        lock.refresh().unwrap();
        assert_eq!(srv.lock().unwrap().kept.last().unwrap(), &json!({ "print": { "copies": 2 } }));
    }

    #[test]
    fn pc_set_up_before_copies_sends_one() {
        let store = mem();
        store.lock().unwrap().set_setting(KEY, &json!({ "setupDone": true, "serverSupports": true })).unwrap();
        let srv = srv();
        let lock = SettingsLock::new(store, checkin(&srv), Box::new(Map::new), Some(Box::new(|| json!({ "weighing": { "x": 1 } }))));
        lock.refresh().unwrap();
        assert_eq!(srv.lock().unwrap().calls.last().unwrap()["settings"], json!({ "weighing": { "x": 1 } }));
    }
}
