// The one door to the network, behind a trait so sync, sign-in and updates can be tested with a
// fake server. The real one is reqwest (blocking): Windows certificates (schannel) and the Windows
// proxy settings, like the Electron app's net.fetch.

use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Response {
    pub status: u16,
    pub body: Vec<u8>,
    pub content_length: Option<u64>,
}

impl Response {
    pub fn ok(&self) -> bool {
        (200..300).contains(&self.status)
    }
    pub fn text(&self) -> String {
        String::from_utf8_lossy(&self.body).into_owned()
    }
    pub fn json(&self) -> Option<serde_json::Value> {
        serde_json::from_slice(&self.body).ok()
    }
}

pub trait Http: Send + Sync {
    /// Err is a network failure (no answer); any HTTP status is Ok.
    fn send(&self, method: &str, url: &str, headers: &[(String, String)], body: Option<Vec<u8>>, timeout: Duration) -> Result<Response, String>;
}

pub struct RealHttp {
    client: reqwest::blocking::Client,
}

impl RealHttp {
    pub fn new(version: &str) -> RealHttp {
        let client = reqwest::blocking::Client::builder()
            .user_agent(format!("TradeLink247-Weighbridge/{version}"))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| reqwest::blocking::Client::new());
        RealHttp { client }
    }
}

impl Http for RealHttp {
    fn send(&self, method: &str, url: &str, headers: &[(String, String)], body: Option<Vec<u8>>, timeout: Duration) -> Result<Response, String> {
        let m = reqwest::Method::from_bytes(method.as_bytes()).map_err(|e| e.to_string())?;
        let mut rq = self.client.request(m, url).timeout(timeout);
        for (k, v) in headers {
            rq = rq.header(k.as_str(), v.as_str());
        }
        if let Some(b) = body {
            rq = rq.body(b);
        }
        let res = rq.send().map_err(|e| short_error(&e))?;
        let status = res.status().as_u16();
        let content_length = res.content_length();
        let body = res.bytes().map_err(|e| short_error(&e))?.to_vec();
        Ok(Response { status, body, content_length })
    }
}

fn short_error(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        return "The server did not answer in time".into();
    }
    if e.is_connect() {
        return "Could not connect to the server".into();
    }
    let mut msg = e.to_string();
    let mut src = std::error::Error::source(e);
    while let Some(s) = src {
        msg = s.to_string();
        src = s.source();
    }
    msg
}

/// Percent-encodes one URL path segment or query value (encodeURIComponent).
pub fn enc(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')' => out.push(b as char),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
pub mod fake {
    use super::*;
    use serde_json::Value;
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Debug, Clone)]
    pub struct Call {
        pub method: String,
        pub path: String,
        pub body: Option<Value>,
    }

    type Handler = Box<dyn Fn(&Call) -> (u16, Value) + Send + Sync>;

    /// A server at https://srv/api/T1 answering from a table of "METHOD /path" handlers.
    #[derive(Default)]
    pub struct FakeServer {
        pub calls: Mutex<Vec<Call>>,
        handlers: HashMap<String, Handler>,
        pub down: Mutex<bool>,
    }

    impl FakeServer {
        pub fn on(mut self, key: &str, h: impl Fn(&Call) -> (u16, Value) + Send + Sync + 'static) -> Self {
            self.handlers.insert(key.to_string(), Box::new(h));
            self
        }
        pub fn calls(&self) -> Vec<Call> {
            self.calls.lock().unwrap().clone()
        }
    }

    impl Http for FakeServer {
        fn send(&self, method: &str, url: &str, _h: &[(String, String)], body: Option<Vec<u8>>, _t: Duration) -> Result<Response, String> {
            if *self.down.lock().unwrap() {
                return Err("getaddrinfo ENOTFOUND".into());
            }
            let path = url.trim_start_matches("https://srv/api/T1").trim_start_matches("https://srv").to_string();
            let call = Call { method: method.into(), path: path.clone(), body: body.and_then(|b| serde_json::from_slice(&b).ok()) };
            self.calls.lock().unwrap().push(call.clone());
            let key = format!("{method} {}", path.split('?').next().unwrap_or(""));
            match self.handlers.get(&key) {
                None => Ok(Response { status: 404, body: b"not found".to_vec(), content_length: None }),
                Some(h) => {
                    let (status, v) = h(&call);
                    let body = serde_json::to_vec(&v).unwrap();
                    Ok(Response { status, content_length: Some(body.len() as u64), body })
                }
            }
        }
    }
}
