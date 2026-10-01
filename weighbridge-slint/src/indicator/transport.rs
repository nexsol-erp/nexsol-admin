// Gets bytes from the indicator: a serial port, or a TCP socket (serial-to-Ethernet converters
// and network indicators). Reconnects on its own, sends the poll command for indicators that only
// answer when asked, and never writes anything else. Runs on its own thread.

use super::profiles::{to_bytes, unescape_ctl, Profile};
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

const RETRY: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, PartialEq)]
pub enum TransportEvent {
    Data(Vec<u8>),
    /// state: connecting | connected | error
    Status { state: String, message: String },
}

#[derive(Debug, Clone)]
pub struct PortInfo {
    pub path: String,
    pub manufacturer: String,
}

pub fn list_ports() -> Vec<PortInfo> {
    serialport::available_ports()
        .map(|ports| {
            ports
                .into_iter()
                .map(|p| {
                    let manufacturer = match p.port_type {
                        serialport::SerialPortType::UsbPort(u) => u.manufacturer.or(u.product).unwrap_or_default(),
                        _ => String::new(),
                    };
                    PortInfo { path: p.port_name, manufacturer }
                })
                .collect()
        })
        .unwrap_or_default()
}

trait Conn: Read + Write + Send {}
impl<T: Read + Write + Send> Conn for T {}

pub struct Transport {
    stop: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

impl Transport {
    /// Starts reading; every event goes to `on_event` (called on the transport thread).
    pub fn start(profile: Profile, on_event: impl Fn(TransportEvent) + Send + 'static) -> Transport {
        let stop = Arc::new(AtomicBool::new(false));
        let s = stop.clone();
        let handle = thread::Builder::new()
            .name("indicator".into())
            .spawn(move || run(profile, s, on_event))
            .ok();
        Transport { stop, handle }
    }

    pub fn stop(mut self) {
        self.stop.store(true, Ordering::SeqCst);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

fn status(on: &impl Fn(TransportEvent), state: &str, message: impl Into<String>) {
    on(TransportEvent::Status { state: state.into(), message: message.into() });
}

fn sleep_unless_stopped(stop: &AtomicBool, d: Duration) {
    let until = Instant::now() + d;
    while Instant::now() < until && !stop.load(Ordering::SeqCst) {
        thread::sleep(Duration::from_millis(50));
    }
}

fn run(profile: Profile, stop: Arc<AtomicBool>, on: impl Fn(TransportEvent)) {
    let t = &profile.transport;
    let poll_cmd = if profile.mode == "poll" { to_bytes(&unescape_ctl(&profile.poll.command)) } else { Vec::new() };
    let poll_every = Duration::from_millis(profile.poll.interval_ms.unwrap_or(500.0).max(100.0) as u64);
    while !stop.load(Ordering::SeqCst) {
        let (conn, label): (Result<Box<dyn Conn>, String>, String) = if profile.is_tcp() {
            if t.host.trim().is_empty() {
                status(&on, "error", "Enter the indicator's IP address in Settings");
                sleep_unless_stopped(&stop, RETRY);
                continue;
            }
            let port = t.port.unwrap_or(4001.0) as u16;
            let label = format!("{}:{}", t.host.trim(), port);
            status(&on, "connecting", &label);
            (open_tcp(t.host.trim(), port), label)
        } else {
            if t.path.is_empty() {
                status(&on, "error", "Choose the COM port in Settings");
                sleep_unless_stopped(&stop, RETRY);
                continue;
            }
            status(&on, "connecting", &t.path);
            (open_serial(&profile), t.path.clone())
        };
        let mut conn = match conn {
            Ok(c) => c,
            Err(e) => {
                status(&on, "error", format!("{label}: {e}"));
                sleep_unless_stopped(&stop, RETRY);
                continue;
            }
        };
        status(&on, "connected", &label);
        let mut buf = [0u8; 1024];
        let mut last_poll = Instant::now() - poll_every;
        let reason = loop {
            if stop.load(Ordering::SeqCst) {
                return;
            }
            if !poll_cmd.is_empty() && last_poll.elapsed() >= poll_every {
                last_poll = Instant::now();
                if let Err(e) = conn.write_all(&poll_cmd) {
                    break e.to_string();
                }
            }
            match conn.read(&mut buf) {
                Ok(0) if profile.is_tcp() => break "Connection closed".to_string(),
                Ok(0) => {}
                Ok(n) => on(TransportEvent::Data(buf[..n].to_vec())),
                Err(e) if matches!(e.kind(), std::io::ErrorKind::TimedOut | std::io::ErrorKind::WouldBlock | std::io::ErrorKind::Interrupted) => {}
                Err(e) => break if profile.is_tcp() { e.to_string() } else { format!("{e} (cable unplugged?)") },
            }
        };
        status(&on, "error", reason);
        sleep_unless_stopped(&stop, RETRY);
    }
}

fn open_tcp(host: &str, port: u16) -> Result<Box<dyn Conn>, String> {
    let addr = (host, port).to_socket_addrs().map_err(|e| e.to_string())?.next().ok_or("Address not found")?;
    let s = TcpStream::connect_timeout(&addr, Duration::from_secs(5)).map_err(|e| e.to_string())?;
    s.set_read_timeout(Some(Duration::from_millis(100))).map_err(|e| e.to_string())?;
    let _ = s.set_nodelay(true);
    Ok(Box::new(s))
}

fn open_serial(p: &Profile) -> Result<Box<dyn Conn>, String> {
    use serialport::{DataBits, FlowControl, Parity, StopBits};
    let t = &p.transport;
    let data_bits = match t.data_bits.unwrap_or(8.0) as u8 {
        5 => DataBits::Five,
        6 => DataBits::Six,
        7 => DataBits::Seven,
        _ => DataBits::Eight,
    };
    // mark/space parity is not offered by the serial driver API; treat as none
    let parity = match t.parity.as_str() {
        "even" => Parity::Even,
        "odd" => Parity::Odd,
        _ => Parity::None,
    };
    let stop_bits = if t.stop_bits.unwrap_or(1.0) >= 1.5 { StopBits::Two } else { StopBits::One };
    let flow = match t.flow_control.as_str() {
        "hardware" => FlowControl::Hardware,
        "software" => FlowControl::Software,
        _ => FlowControl::None,
    };
    let mut port = serialport::new(&t.path, t.baud_rate.unwrap_or(9600.0) as u32)
        .data_bits(data_bits)
        .parity(parity)
        .stop_bits(stop_bits)
        .flow_control(flow)
        .timeout(Duration::from_millis(100))
        .open()
        .map_err(|e| e.to_string())?;
    // Some indicators only transmit (or take power) when DTR/RTS are raised.
    if t.flow_control != "hardware" {
        let _ = port.write_data_terminal_ready(t.dtr != Some(false));
        let _ = port.write_request_to_send(t.rts != Some(false));
    }
    Ok(Box::new(port))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::mpsc;

    #[test]
    fn tcp_indicator_streams_and_polls() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let srv = thread::spawn(move || {
            let (mut s, _) = listener.accept().unwrap();
            let mut cmd = [0u8; 4];
            s.read_exact(&mut cmd).unwrap();
            assert_eq!(&cmd, b"SI\r\n");
            s.write_all(b"S S 12340 kg\r\n").unwrap();
            thread::sleep(Duration::from_millis(300));
        });
        let profile = super::super::profiles::build_profile(
            "mt-sics",
            &serde_json::json!({ "transport": { "type": "tcp", "host": "127.0.0.1", "port": port } }),
        );
        let (tx, rx) = mpsc::channel();
        let t = Transport::start(profile, move |e| { let _ = tx.send(e); });
        let mut data = Vec::new();
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline && !data.ends_with(b"\r\n") {
            if let Ok(TransportEvent::Data(d)) = rx.recv_timeout(Duration::from_millis(200)) {
                data.extend(d);
            }
        }
        assert_eq!(data, b"S S 12340 kg\r\n");
        t.stop();
        srv.join().unwrap();
    }
}
