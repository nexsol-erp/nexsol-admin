// The link between the weighbridge service and the screens on the same PC (3.0+). The service
// owns the indicator, the camera, uploads and updates, and keeps running when nobody is logged in;
// the screens connect to it for the live weight, camera pictures and photos.
//
// One TCP connection on 127.0.0.1, one JSON object per line both ways. The first line from the
// screen is {"t":"auth","token":…} with the token from <data>/ipc.token (only readable on this
// PC); the service answers {"t":"hello","version":…} and then sends events as they happen.
// Requests carry an "id" and get {"t":"reply","id":…} back.

use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

pub const PORT: u16 = 47247;

/// The token, made once per PC (kept across restarts so a screen can reconnect).
pub fn token(file: &Path) -> String {
    if let Ok(t) = std::fs::read_to_string(file) {
        let t = t.trim().to_string();
        if t.len() >= 16 {
            return t;
        }
    }
    let t = uuid::Uuid::new_v4().simple().to_string();
    if let Some(dir) = file.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(file, &t);
    t
}

// ── service side ─────────────────────────────────────────────────────────────

struct Conn {
    id: u64,
    tx: mpsc::Sender<String>,
    preview: Arc<AtomicBool>,
    idle: Arc<AtomicBool>,
}

/// The connected screens.
#[derive(Default)]
pub struct Hub {
    conns: Mutex<Vec<Conn>>,
    next: AtomicU64,
}

impl Hub {
    pub fn new() -> Arc<Hub> {
        Arc::new(Hub::default())
    }

    /// To every screen; a camera frame only to those showing the live view.
    pub fn broadcast(&self, msg: &Value) {
        let frame = msg["t"] == "frame";
        let line = msg.to_string();
        self.conns.lock().unwrap().retain(|c| {
            if frame && !c.preview.load(Ordering::Relaxed) {
                return true;
            }
            c.tx.send(line.clone()).is_ok()
        });
    }

    #[cfg(test)]
    pub fn clients(&self) -> usize {
        self.conns.lock().unwrap().len()
    }

    /// A screen shows the live camera view.
    pub fn any_preview(&self) -> bool {
        self.conns.lock().unwrap().iter().any(|c| c.preview.load(Ordering::Relaxed))
    }

    /// No screen is in the middle of a weighing (or none is open).
    pub fn all_idle(&self) -> bool {
        self.conns.lock().unwrap().iter().all(|c| c.idle.load(Ordering::Relaxed))
    }

    fn add(&self, tx: mpsc::Sender<String>) -> (u64, Arc<AtomicBool>, Arc<AtomicBool>) {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let (preview, idle) = (Arc::new(AtomicBool::new(false)), Arc::new(AtomicBool::new(true)));
        self.conns.lock().unwrap().push(Conn { id, tx, preview: preview.clone(), idle: idle.clone() });
        (id, preview, idle)
    }

    fn remove(&self, id: u64) {
        self.conns.lock().unwrap().retain(|c| c.id != id);
    }
}

/// What the service does for a screen. `request` answers one command; its reply (if any) goes
/// back with the command's id. `changed` is called when a screen's live view or idle state changes.
pub trait Service: Send + Sync + 'static {
    fn version(&self) -> String;
    /// The current state a screen needs when it connects (indicator, sync, update).
    fn greeting(&self) -> Vec<Value>;
    fn request(&self, cmd: &Value) -> Option<Value>;
    fn changed(&self);
}

/// Listens on 127.0.0.1:port (normally PORT) until the process ends.
pub fn serve_on(port: u16, service: Arc<dyn Service>, hub: Arc<Hub>, token: String) -> std::io::Result<()> {
    let listener = TcpListener::bind(("127.0.0.1", port))?;
    thread::Builder::new().name("ipc".into()).spawn(move || {
        for stream in listener.incoming().flatten() {
            let (s, h, t) = (service.clone(), hub.clone(), token.clone());
            let _ = thread::Builder::new().name("ipc-conn".into()).spawn(move || connection(stream, s, h, &t));
        }
    })?;
    Ok(())
}

fn connection(stream: TcpStream, service: Arc<dyn Service>, hub: Arc<Hub>, token: &str) {
    let _ = stream.set_nodelay(true);
    let Ok(read_half) = stream.try_clone() else { return };
    let mut lines = BufReader::new(read_half).lines();
    // the first line must carry the token, within a few seconds
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let authed = lines.next().and_then(Result::ok).and_then(|l| serde_json::from_str::<Value>(&l).ok()).is_some_and(|v| v["t"] == "auth" && v["token"] == token);
    if !authed {
        let _ = stream.shutdown(Shutdown::Both);
        return;
    }
    let _ = stream.set_read_timeout(None);
    let (tx, rx) = mpsc::channel::<String>();
    let mut out = match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    };
    let writer = thread::spawn(move || {
        for line in rx {
            if out.write_all(line.as_bytes()).and_then(|_| out.write_all(b"\n")).is_err() {
                break;
            }
        }
        let _ = out.shutdown(Shutdown::Both);
    });
    let _ = tx.send(json!({ "t": "hello", "version": service.version() }).to_string());
    for v in service.greeting() {
        let _ = tx.send(v.to_string());
    }
    let (id, preview, idle) = hub.add(tx.clone());
    for line in lines {
        let Ok(line) = line else { break };
        let Ok(cmd) = serde_json::from_str::<Value>(&line) else { continue };
        match cmd["t"].as_str().unwrap_or("") {
            "preview" => {
                preview.store(cmd["on"].as_bool().unwrap_or(false), Ordering::Relaxed);
                service.changed();
            }
            "idle" => {
                idle.store(cmd["on"].as_bool().unwrap_or(true), Ordering::Relaxed);
                service.changed();
            }
            _ => {
                // slow requests (a photo, a sync) must not hold up the readings
                let (s, tx, rid) = (service.clone(), tx.clone(), cmd.get("id").cloned());
                thread::spawn(move || {
                    let reply = s.request(&cmd);
                    if let (Some(rid), Some(mut r)) = (rid, reply) {
                        r["t"] = json!("reply");
                        r["id"] = rid;
                        let _ = tx.send(r.to_string());
                    }
                });
            }
        }
    }
    hub.remove(id);
    drop(tx);
    let _ = stream.shutdown(Shutdown::Both);
    let _ = writer.join();
    service.changed();
}

// ── screen side ──────────────────────────────────────────────────────────────

type Waiters = Mutex<HashMap<u64, mpsc::Sender<Value>>>;

/// The screen's connection to the service; reconnects by itself.
pub struct Remote {
    out: Mutex<Option<TcpStream>>,
    waiters: Waiters,
    next: AtomicU64,
    connected: AtomicBool,
    preview: AtomicBool,
    idle: AtomicBool,
    pub service_version: Mutex<String>,
}

impl Remote {
    /// Connects to 127.0.0.1:port with the token in `token_file`, retrying every 2 s. Every event
    /// goes to `on_event`, plus {"t":"connected"} / {"t":"disconnected"} as the link comes and goes.
    pub fn start(port: u16, token_file: std::path::PathBuf, on_event: impl Fn(Value) + Send + Sync + 'static) -> Arc<Remote> {
        let r = Arc::new(Remote {
            out: Mutex::new(None),
            waiters: Mutex::new(HashMap::new()),
            next: AtomicU64::new(1),
            connected: AtomicBool::new(false),
            preview: AtomicBool::new(false),
            idle: AtomicBool::new(true),
            service_version: Mutex::new(String::new()),
        });
        let me = Arc::downgrade(&r);
        let _ = thread::Builder::new().name("ipc-client".into()).spawn(move || {
            let mut said_down = false;
            loop {
                let Some(r) = me.upgrade() else { return };
                match r.session(port, &token_file, &on_event) {
                    Ok(()) | Err(_) => {}
                }
                let was = r.connected.swap(false, Ordering::SeqCst);
                *r.out.lock().unwrap() = None;
                r.waiters.lock().unwrap().clear();
                if was || !said_down {
                    said_down = true;
                    on_event(json!({ "t": "disconnected" }));
                }
                drop(r);
                thread::sleep(Duration::from_secs(2));
            }
        });
        r
    }

    fn session(&self, port: u16, token_file: &Path, on_event: &dyn Fn(Value)) -> std::io::Result<()> {
        let stream = TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_secs(2))?;
        let _ = stream.set_nodelay(true);
        let token = std::fs::read_to_string(token_file).unwrap_or_default();
        let mut w = stream.try_clone()?;
        writeln!(w, "{}", json!({ "t": "auth", "token": token.trim() }))?;
        // what this screen had asked for before the link dropped
        writeln!(w, "{}", json!({ "t": "preview", "on": self.preview.load(Ordering::Relaxed) }))?;
        writeln!(w, "{}", json!({ "t": "idle", "on": self.idle.load(Ordering::Relaxed) }))?;
        *self.out.lock().unwrap() = Some(w);
        for line in BufReader::new(stream).lines() {
            let v: Value = match serde_json::from_str(&line?) {
                Ok(v) => v,
                Err(_) => continue,
            };
            match v["t"].as_str().unwrap_or("") {
                "hello" => {
                    *self.service_version.lock().unwrap() = v["version"].as_str().unwrap_or("").to_string();
                    self.connected.store(true, Ordering::SeqCst);
                    on_event(json!({ "t": "connected", "version": v["version"] }));
                }
                "reply" => {
                    let id = v["id"].as_u64().unwrap_or(0);
                    if let Some(tx) = self.waiters.lock().unwrap().remove(&id) {
                        let _ = tx.send(v);
                    }
                }
                _ => on_event(v),
            }
        }
        Ok(())
    }

    #[cfg(test)]
    pub fn connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    /// Sends a command; false when the service isn't there.
    pub fn send(&self, cmd: Value) -> bool {
        let mut out = self.out.lock().unwrap();
        let Some(s) = out.as_mut() else { return false };
        writeln!(s, "{cmd}").is_ok()
    }

    /// Sends a command and waits for its reply.
    pub fn request(&self, mut cmd: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        cmd["id"] = json!(id);
        let (tx, rx) = mpsc::channel();
        self.waiters.lock().unwrap().insert(id, tx);
        if !self.send(cmd) {
            self.waiters.lock().unwrap().remove(&id);
            return Err("The weighbridge service is not running".into());
        }
        let r = rx.recv_timeout(timeout).map_err(|_| "The weighbridge service did not answer in time".to_string());
        self.waiters.lock().unwrap().remove(&id);
        r
    }

    pub fn set_preview(&self, on: bool) {
        self.preview.store(on, Ordering::Relaxed);
        self.send(json!({ "t": "preview", "on": on }));
    }

    pub fn set_idle(&self, on: bool) {
        if self.idle.swap(on, Ordering::Relaxed) != on {
            self.send(json!({ "t": "idle", "on": on }));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Echo {
        hub: Arc<Hub>,
        changes: AtomicU64,
    }

    impl Service for Echo {
        fn version(&self) -> String {
            "3.0.0".into()
        }
        fn greeting(&self) -> Vec<Value> {
            vec![json!({ "t": "indicator", "state": "connected", "message": "COM1" })]
        }
        fn request(&self, cmd: &Value) -> Option<Value> {
            match cmd["t"].as_str()? {
                "photo" => Some(json!({ "ok": true, "jpeg": "/9j/" })),
                "sync" => {
                    self.hub.broadcast(&json!({ "t": "sync", "online": true }));
                    None
                }
                _ => None,
            }
        }
        fn changed(&self) {
            self.changes.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn wait(f: impl Fn() -> bool) -> bool {
        for _ in 0..200 {
            if f() {
                return true;
            }
            thread::sleep(Duration::from_millis(10));
        }
        false
    }

    #[test]
    fn screen_and_service_talk() {
        let dir = std::env::temp_dir().join(format!("wb-ipc-{}", uuid::Uuid::new_v4()));
        let token_file = dir.join("ipc.token");
        let t = token(&token_file);
        assert_eq!(token(&token_file), t, "kept across restarts");
        let hub = Hub::new();
        let svc = Arc::new(Echo { hub: hub.clone(), changes: AtomicU64::new(0) });
        // a free port for the test instead of PORT
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let (s, h, tk) = (svc.clone() as Arc<dyn Service>, hub.clone(), t.clone());
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let (s, h, tk) = (s.clone(), h.clone(), tk.clone());
                thread::spawn(move || connection(stream, s, h, &tk));
            }
        });

        let seen = Arc::new(Mutex::new(Vec::<Value>::new()));
        let s2 = seen.clone();
        let remote = Remote::start(port, token_file.clone(), move |v| s2.lock().unwrap().push(v));
        assert!(wait(|| remote.connected()));
        assert_eq!(*remote.service_version.lock().unwrap(), "3.0.0");
        assert!(wait(|| hub.clients() == 1));
        assert!(wait(|| seen.lock().unwrap().iter().any(|v| v["t"] == "indicator")), "state on connect");

        // events reach the screen; frames only while it shows the live view
        hub.broadcast(&json!({ "t": "frame", "jpeg": "x" }));
        hub.broadcast(&json!({ "t": "reading", "weight": 12000 }));
        assert!(wait(|| seen.lock().unwrap().iter().any(|v| v["t"] == "reading")));
        assert!(!seen.lock().unwrap().iter().any(|v| v["t"] == "frame"));
        remote.set_preview(true);
        assert!(wait(|| hub.any_preview()));
        hub.broadcast(&json!({ "t": "frame", "jpeg": "x" }));
        assert!(wait(|| seen.lock().unwrap().iter().any(|v| v["t"] == "frame")));

        // a request and its reply
        let r = remote.request(json!({ "t": "photo" }), Duration::from_secs(2)).unwrap();
        assert_eq!(r["jpeg"], "/9j/");
        // idle state for update timing
        remote.set_idle(false);
        assert!(wait(|| !hub.all_idle()));
        remote.set_idle(true);
        assert!(wait(|| hub.all_idle()));
        assert!(svc.changes.load(Ordering::Relaxed) >= 3);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn a_wrong_token_is_turned_away() {
        let hub = Hub::new();
        let svc = Arc::new(Echo { hub: hub.clone(), changes: AtomicU64::new(0) }) as Arc<dyn Service>;
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let h = hub.clone();
        thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let (s, h) = (svc.clone(), h.clone());
                thread::spawn(move || connection(stream, s, h, "right-token-123456"));
            }
        });
        let dir = std::env::temp_dir().join(format!("wb-ipc-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("ipc.token"), "wrong-token-123456").unwrap();
        let remote = Remote::start(port, dir.join("ipc.token"), |_| {});
        thread::sleep(Duration::from_millis(300));
        assert!(!remote.connected());
        assert_eq!(hub.clients(), 0);
        assert!(remote.request(json!({ "t": "photo" }), Duration::from_millis(200)).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }
}
