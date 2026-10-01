// Turns the raw byte stream from a weighbridge indicator into weight readings. Pure logic, no
// serial port: the transport feeds bytes in, so every indicator format can be tested by
// replaying captured bytes. Port of electron/indicator/parser.js; same rules.
//
// Bytes are handled as latin1 text (one char per byte), which keeps binary status bytes (Mettler
// Toledo) intact and makes delimiter searches simple.

use super::profiles::{latin1, unescape_ctl, FrameCfg, Profile};
use regex::Regex;

const MAX_BUFFER: usize = 4096;

fn unit_to_kg(unit: &str) -> Option<f64> {
    Some(match unit {
        "kg" | "kgs" => 1.0,
        "t" | "ton" | "tonne" => 1000.0,
        "lb" | "lbs" => 0.45359237,
        "g" => 0.001,
        _ => return None,
    })
}

/// "<CR>|<LF>" → ["\r", "\n"]. "|" separates alternatives; a literal pipe is \x7C.
pub fn end_markers(end: &str) -> Vec<String> {
    end.split('|').map(unescape_ctl).filter(|e| !e.is_empty()).collect()
}

fn tail(s: &str, n: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    chars[chars.len().saturating_sub(n)..].iter().collect()
}

pub struct FrameSplitter {
    fixed: bool,
    start: String,
    ends: Vec<String>,
    length: usize,
    pub buf: String,
}

impl FrameSplitter {
    pub fn new(frame: &FrameCfg) -> Self {
        FrameSplitter {
            fixed: frame.kind == "fixed",
            start: unescape_ctl(&frame.start),
            ends: end_markers(&frame.end),
            length: frame.length.unwrap_or(0.0).max(0.0) as usize,
            buf: String::new(),
        }
    }

    /// Returns the complete frames found so far; partial data waits for the next push.
    pub fn push(&mut self, chunk: &[u8]) -> Vec<String> {
        self.buf.push_str(&latin1(chunk));
        let frames = if self.fixed { self.fixed_frames() } else { self.delimited() };
        if self.buf.chars().count() > MAX_BUFFER {
            self.buf = tail(&self.buf, MAX_BUFFER / 4);
        }
        frames
    }

    #[cfg(test)]
    pub fn push_str(&mut self, s: &str) -> Vec<String> {
        self.push(&super::profiles::to_bytes(s))
    }

    fn delimited(&mut self) -> Vec<String> {
        let mut out = Vec::new();
        let start = self.start.clone();
        loop {
            let mut from = 0;
            if !start.is_empty() {
                match self.buf.find(&start) {
                    None => {
                        // Keep a possible partial start marker at the tail, drop the rest.
                        self.buf = tail(&self.buf, start.chars().count().saturating_sub(1));
                        break;
                    }
                    Some(s) => {
                        self.buf = self.buf[s..].to_string();
                        from = start.len();
                    }
                }
            }
            if self.ends.is_empty() {
                break;
            }
            let mut pos: Option<usize> = None;
            let mut marker = String::new();
            for e in &self.ends {
                if let Some(p) = self.buf[from..].find(e.as_str()).map(|p| p + from) {
                    if pos.is_none_or(|q| p < q) {
                        pos = Some(p);
                        marker = e.clone();
                    }
                }
            }
            let Some(pos) = pos else { break };
            let mut body = self.buf[from..pos].to_string();
            // A start marker inside the body means the earlier frame was cut short: keep the last one.
            if !start.is_empty() && start != marker {
                if let Some(again) = body.rfind(&start) {
                    body = body[again + start.len()..].to_string();
                }
            }
            // When the end marker is also the next frame's start ("=" formats), leave it in place.
            self.buf = if !start.is_empty() && marker == start { self.buf[pos..].to_string() } else { self.buf[pos + marker.len()..].to_string() };
            if !body.is_empty() {
                out.push(body);
            }
        }
        out
    }

    fn fixed_frames(&mut self) -> Vec<String> {
        let mut out = Vec::new();
        if self.length == 0 {
            return out;
        }
        loop {
            let mut from = 0;
            if !self.start.is_empty() {
                match self.buf.find(&self.start) {
                    None => {
                        self.buf = tail(&self.buf, self.start.chars().count().saturating_sub(1));
                        break;
                    }
                    Some(s) => {
                        self.buf = self.buf[s..].to_string();
                        from = self.start.chars().count();
                    }
                }
            }
            let chars: Vec<char> = self.buf.chars().collect();
            if chars.len() < from + self.length {
                break;
            }
            out.push(chars[from..from + self.length].iter().collect());
            self.buf = chars[from + self.length..].iter().collect();
        }
        out
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Decoded {
    pub weight: f64,
    pub unit: String,
    /// What the indicator said: Some(true) stable, Some(false) moving, None not said.
    pub stable: Option<bool>,
    pub overload: bool,
}

struct Raw {
    value: f64,
    negative: bool,
    unit: Option<String>,
    stable: Option<bool>,
    overload: bool,
}

fn to_number(text: &str, decimal_comma: bool, implied: u32) -> Option<f64> {
    let t: String = text.chars().filter(|c| !c.is_whitespace()).collect();
    let t = if decimal_comma { t.replace('.', "").replacen(',', ".", 1) } else { t.replace(',', "") };
    let ok = {
        let mut parts = t.splitn(2, '.');
        let a = parts.next().unwrap_or("");
        let b = parts.next();
        !a.is_empty() && a.chars().all(|c| c.is_ascii_digit()) && b.is_none_or(|b| !b.is_empty() && b.chars().all(|c| c.is_ascii_digit()))
    };
    if !ok {
        return None;
    }
    let mut v: f64 = t.parse().ok()?;
    if !t.contains('.') && implied > 0 {
        v /= 10f64.powi(implied as i32);
    }
    Some(v)
}

fn test_pattern(pattern: &str, value: Option<&str>) -> bool {
    match value {
        Some(v) if !pattern.is_empty() => Regex::new(pattern).map(|re| re.is_match(v)).unwrap_or(false),
        _ => false,
    }
}

/// JS flags ("i", "m", "s") as an inline group.
fn with_flags(pattern: &str, flags: &str) -> String {
    let f: String = flags.chars().filter(|c| matches!(c, 'i' | 'm' | 's')).collect();
    if f.is_empty() { pattern.to_string() } else { format!("(?{f}){pattern}") }
}

fn decode_regex(frame: &str, p: &Profile) -> Option<Raw> {
    let d = &p.decode;
    let text: String = if d.reverse.unwrap_or(false) { frame.chars().rev().collect() } else { frame.to_string() };
    let re = Regex::new(&with_flags(&d.pattern, &d.flags)).ok()?;
    let caps = re.captures(&text)?;
    let weight = caps.name("weight")?.as_str();
    let value = to_number(weight, p.decimal_comma.unwrap_or(false), p.implied())?;
    let status = caps.name("status").map(|m| m.as_str());
    let stable = if test_pattern(&d.stable_pattern, status) {
        Some(true)
    } else if test_pattern(&d.motion_pattern, status) {
        Some(false)
    } else {
        None
    };
    let over = caps.name("over").map(|m| m.as_str()).or(status);
    Some(Raw {
        value,
        negative: caps.name("sign").is_some_and(|m| m.as_str() == "-"),
        unit: caps.name("unit").map(|m| m.as_str().to_lowercase()),
        stable,
        overload: test_pattern(&d.overload_pattern, over),
    })
}

fn decode_fixed(frame: &str, p: &Profile) -> Option<Raw> {
    let d = &p.decode;
    let chars: Vec<char> = frame.chars().collect();
    let at = |v: Option<f64>| v.map(|n| n.max(0.0) as usize);
    let w_at = at(d.weight_at).unwrap_or(0);
    let w_len = at(d.weight_length).unwrap_or(chars.len().saturating_sub(w_at));
    let digits: String = chars.iter().skip(w_at).take(w_len).map(|c| if *c == ' ' { '0' } else { *c }).collect();
    if digits.is_empty() || !digits.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let mut value: f64 = digits.parse().ok()?;
    let n = match at(d.decimals_at) {
        Some(i) => chars.get(i).and_then(|c| c.to_digit(10)),
        None => Some(p.implied()),
    };
    if let Some(n) = n.filter(|n| *n > 0) {
        value /= 10f64.powi(n as i32);
    }
    let negative = at(d.sign_at).and_then(|i| chars.get(i)).is_some_and(|c| *c == '-');
    Some(Raw { value, negative, unit: None, stable: None, overload: false })
}

// Mettler Toledo continuous output. Status word A bits 0-2 place the decimal point,
// status word B: bit0 net, bit1 negative, bit2 over/under range, bit3 motion, bit4 kg (1) / lb (0).
const TOLEDO_SCALE: [f64; 8] = [100.0, 10.0, 1.0, 0.1, 0.01, 0.001, 0.0001, 0.00001];

fn decode_toledo(frame: &str, p: &Profile) -> Option<Raw> {
    let b: Vec<u32> = frame.chars().map(|c| (c as u32) & 0x7f).collect(); // tolerate 8 bits on a 7E1 line
    if b.len() < 9 {
        return None;
    }
    let (swa, swb) = (b[0], b[1]);
    let digits: String = b[3..9].iter().map(|&c| if c == 0x20 { '0' } else { char::from_u32(c).unwrap_or('?') }).collect();
    if !digits.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let value = digits.parse::<f64>().ok()? * TOLEDO_SCALE[(swa & 0x07) as usize];
    Some(Raw {
        value: (value * 100000.0).round() / 100000.0,
        negative: swb & 0x02 != 0,
        unit: if p.decode.unit_from_status.unwrap_or(false) { Some(if swb & 0x10 != 0 { "kg".into() } else { "lb".into() }) } else { None },
        stable: Some(swb & 0x08 == 0),
        overload: swb & 0x04 != 0,
    })
}

fn round_js(x: f64) -> f64 {
    // Math.round: halves go up
    (x + 0.5).floor()
}

/// One frame → weight in kg, unit, stable (as the indicator says), overload; or None.
pub fn decode_frame(frame: &str, p: &Profile) -> Option<Decoded> {
    let r = match p.decode.kind.as_str() {
        "fixed" => decode_fixed(frame, p),
        "toledo" => decode_toledo(frame, p),
        _ => decode_regex(frame, p),
    }?;
    let unit = r.unit.clone().unwrap_or_else(|| if p.unit.is_empty() { "kg".into() } else { p.unit.to_lowercase() });
    let factor = unit_to_kg(&unit).unwrap_or(1.0);
    let mult = match p.multiplier { Some(m) if m != 0.0 => m, _ => 1.0 };
    let mut kg = r.value * factor * mult;
    if r.negative {
        kg = -kg;
    }
    let step = p.resolution.unwrap_or(0.0);
    if step > 0.0 {
        kg = round_js(kg / step) * step;
    }
    kg = round_js(kg * 1000.0) / 1000.0;
    if kg == 0.0 {
        kg = 0.0;
    }
    Some(Decoded { weight: kg, unit, stable: r.stable, overload: r.overload })
}

/// Decides "stable" when the indicator doesn't say: N readings in a row within tolerance.
pub struct Stabilizer {
    count: usize,
    tol: f64,
    recent: Vec<f64>,
}

impl Stabilizer {
    pub fn new(count: Option<f64>, tol: Option<f64>) -> Self {
        Stabilizer { count: count.unwrap_or(1.0).max(1.0) as usize, tol: tol.unwrap_or(0.0).max(0.0), recent: Vec::new() }
    }

    pub fn update(&mut self, r: &Decoded) -> bool {
        if r.stable == Some(false) || r.overload {
            self.recent = vec![r.weight];
            return false;
        }
        self.recent.push(r.weight);
        if self.recent.len() > self.count {
            self.recent.remove(0);
        }
        if r.stable == Some(true) {
            return true;
        }
        if self.recent.len() < self.count {
            return false;
        }
        let max = self.recent.iter().cloned().fold(f64::MIN, f64::max);
        let min = self.recent.iter().cloned().fold(f64::MAX, f64::min);
        max - min <= self.tol
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Reading {
    pub weight: f64,
    pub stable: bool,
    pub overload: bool,
    pub unit: String,
    pub raw: String,
    /// milliseconds, from the session's clock
    pub at: u64,
    pub simulated: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Event {
    Frame { raw: String, ok: bool },
    Reading(Reading),
    Engage { weight: f64, at: u64 },
    Signal(bool),
}

/// Everything between the transport and the screen: framing, decoding, stability, "bridge
/// engaged" detection and the no-signal watchdog.
pub struct IndicatorSession {
    pub profile: Profile,
    splitter: FrameSplitter,
    stabilizer: Stabilizer,
    armed: bool,
    pub last: Option<Reading>,
    last_at: u64,
    signal: bool,
}

impl IndicatorSession {
    pub fn new(profile: Profile) -> Self {
        IndicatorSession {
            splitter: FrameSplitter::new(&profile.frame),
            stabilizer: Stabilizer::new(profile.stable_count, profile.stable_tolerance_kg),
            profile,
            armed: true,
            last: None,
            last_at: 0,
            signal: false,
        }
    }

    pub fn feed(&mut self, chunk: &[u8], now: u64) -> Vec<Event> {
        let mut ev = Vec::new();
        for raw in self.splitter.push(chunk) {
            let r = decode_frame(&raw, &self.profile);
            ev.push(Event::Frame { raw: raw.clone(), ok: r.is_some() });
            let Some(r) = r else { continue };
            let stable = self.stabilizer.update(&r);
            let reading = Reading { weight: r.weight, stable, overload: r.overload, unit: r.unit, raw, at: now, simulated: false };
            self.last = Some(reading.clone());
            self.last_at = now;
            if !self.signal {
                self.signal = true;
                ev.push(Event::Signal(true));
            }
            ev.push(Event::Reading(reading.clone()));
            let threshold = self.profile.engage_threshold();
            let zero = self.profile.zero_band();
            if threshold > 0.0 {
                if self.armed && reading.weight > threshold {
                    self.armed = false;
                    ev.push(Event::Engage { weight: reading.weight, at: now });
                } else if !self.armed && reading.weight.abs() <= zero {
                    self.armed = true;
                }
            }
        }
        ev
    }

    /// Called on a timer; flips to "no signal" when readings stop.
    pub fn tick(&mut self, now: u64) -> Option<Event> {
        if self.signal && now.saturating_sub(self.last_at) > self.profile.no_signal_ms() {
            self.signal = false;
            return Some(Event::Signal(false));
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::super::profiles::build_profile;
    use super::*;
    use serde_json::json;

    fn prof(id: &str) -> Profile {
        build_profile(id, &json!({}))
    }

    fn weights(s: &mut IndicatorSession, bytes: &[u8]) -> Vec<f64> {
        s.feed(bytes, 0).into_iter().filter_map(|e| if let Event::Reading(r) = e { Some(r.weight) } else { None }).collect()
    }

    // Feeds bytes one at a time, in one lump, and in odd-sized chunks: a correct parser gives the
    // same readings however the serial driver happens to deliver them.
    fn read_all_ways(p: &Profile, text: &str) -> Vec<f64> {
        let bytes = super::super::profiles::to_bytes(text);
        let mut results = Vec::new();
        for chunk in [1, bytes.len().max(1), 5] {
            let mut s = IndicatorSession::new(p.clone());
            let mut got = Vec::new();
            for part in bytes.chunks(chunk) {
                got.extend(weights(&mut s, part));
            }
            results.push(got);
        }
        assert_eq!(results[1], results[0], "one lump vs byte-by-byte");
        assert_eq!(results[2], results[0], "chunks of 5 vs byte-by-byte");
        results.remove(0)
    }

    #[test]
    fn qt_default() {
        let p = prof("qt-default");
        assert_eq!(read_all_ways(&p, "\x02001230\r\x02012500\r"), vec![1230.0, 12500.0]);
        assert_eq!(read_all_ways(&p, "xx\x0200\x02004560\r\r\n"), vec![4560.0]);
    }

    #[test]
    fn ascii_line_sign_unit_crlf() {
        let p = prof("ascii-line");
        assert_eq!(read_all_ways(&p, "  +012340 kg\r\n-000150kg\r\nGS  25.5 t\r\n"), vec![12340.0, -150.0, 25500.0]);
    }

    #[test]
    fn separators_and_decimal_comma() {
        assert_eq!(decode_frame("1,234 kg", &prof("ascii-line")).unwrap().weight, 1234.0);
        let p = build_profile("ascii-line", &json!({ "decimalComma": true, "resolution": 0.1 }));
        assert_eq!(decode_frame("12,5", &p).unwrap().weight, 12.5);
    }

    #[test]
    fn implied_decimals_multiplier_resolution() {
        let p = build_profile("ascii-line", &json!({ "impliedDecimals": 1, "resolution": 0 }));
        assert_eq!(decode_frame("\x0212345", &p).unwrap().weight, 1234.5);
        assert_eq!(decode_frame("1234", &build_profile("ascii-line", &json!({ "multiplier": 10 }))).unwrap().weight, 12340.0);
        assert_eq!(decode_frame("12347", &build_profile("ascii-line", &json!({ "resolution": 10 }))).unwrap().weight, 12350.0);
    }

    #[test]
    fn yaohua_reversed() {
        let p = build_profile("yaohua-reversed", &json!({ "resolution": 0 }));
        assert_eq!(read_all_ways(&p, "=0.05210=0.05210=5.21000-="), vec![1250.0, 1250.0, -12.5]);
    }

    #[test]
    fn yaohua_tf0() {
        let p = build_profile("yaohua-tf0", &json!({ "resolution": 0 }));
        assert_eq!(read_all_ways(&p, "\x02+0125000AB\x03\x02-0001502CD\x03"), vec![12500.0, -1.5]);
    }

    #[test]
    fn toledo_continuous() {
        let p = build_profile("toledo-continuous", &json!({ "resolution": 0 }));
        let stable = "\x02\x22\x30\x20012340000000\r";
        let moving = "\x02\x22\x3A\x20000150000000\r";
        let decimal = "\x02\x23\x30\x20012345000000\r\x55";
        assert_eq!(read_all_ways(&p, &format!("{stable}{moving}{decimal}")), vec![12340.0, -150.0, 1234.5]);
        let mut s = IndicatorSession::new(p);
        let flags: Vec<bool> = s
            .feed(&super::super::profiles::to_bytes(&format!("{moving}{stable}")), 0)
            .into_iter()
            .filter_map(|e| if let Event::Reading(r) = e { Some(r.stable) } else { None })
            .collect();
        assert_eq!(flags, vec![false, true]);
    }

    #[test]
    fn toledo_on_8_bits() {
        let p = prof("toledo-continuous");
        let mut f = String::from("\u{A2}\u{B0}\u{A0}");
        for c in "012340000000".chars() {
            f.push(char::from_u32(c as u32 | 0x80).unwrap());
        }
        assert_eq!(decode_frame(&f, &p).unwrap().weight, 12340.0);
    }

    #[test]
    fn mt_sics() {
        let p = prof("mt-sics");
        assert_eq!(decode_frame("S S      12340 kg", &p), Some(Decoded { weight: 12340.0, unit: "kg".into(), stable: Some(true), overload: false }));
        assert_eq!(decode_frame("S D      12300 kg", &p).unwrap().stable, Some(false));
        assert_eq!(decode_frame("ES", &p), None);
    }

    #[test]
    fn and_header() {
        let p = prof("and-st-gs");
        assert_eq!(decode_frame("ST,GS,+012340kg", &p), Some(Decoded { weight: 12340.0, unit: "kg".into(), stable: Some(true), overload: false }));
        assert_eq!(decode_frame("US,GS,+012300kg", &p).unwrap().stable, Some(false));
        assert!(decode_frame("OL,GS,+999999kg", &p).unwrap().overload);
    }

    #[test]
    fn sma() {
        let p = prof("sma-polled");
        assert_eq!(read_all_ways(&p, "\n 1G     12340.0kg \r\n 1G M   12360.0kg \r"), vec![12340.0, 12360.0]);
        assert_eq!(decode_frame(" 1GM    12340.0kg ", &p).unwrap().stable, Some(false));
        assert!(decode_frame("O1G     99999.0kg ", &p).unwrap().overload);
    }

    #[test]
    fn units() {
        let p = prof("ascii-line");
        assert_eq!(decode_frame("12.34 t", &p).unwrap().weight, 12340.0);
        assert_eq!(decode_frame("1000 lb", &p).unwrap().weight, 454.0);
        assert_eq!(decode_frame("1000 lb", &build_profile("ascii-line", &json!({ "resolution": 0 }))).unwrap().weight, 453.592);
        assert_eq!(decode_frame("1000", &build_profile("ascii-line", &json!({ "unit": "t" }))).unwrap().weight, 1000000.0);
    }

    #[test]
    fn stability_by_repetition() {
        let p = build_profile("qt-default", &json!({ "stableCount": 3, "stableToleranceKg": 20 }));
        let mut s = IndicatorSession::new(p);
        let flags: Vec<bool> = s
            .feed(b"\x02012000\r\x02012500\r\x02012510\r\x02012490\r\x02012600\r", 0)
            .into_iter()
            .filter_map(|e| if let Event::Reading(r) = e { Some(r.stable) } else { None })
            .collect();
        assert_eq!(flags, vec![false, false, false, true, false]);
    }

    #[test]
    fn bridge_engaged_rearms_at_zero() {
        let mut s = IndicatorSession::new(prof("qt-default"));
        let data: String = ["000100", "000600", "012000", "000300", "000000", "000900"].iter().map(|w| format!("\x02{w}\r")).collect();
        let engaged: Vec<f64> = s.feed(data.as_bytes(), 0).into_iter().filter_map(|e| if let Event::Engage { weight, .. } = e { Some(weight) } else { None }).collect();
        assert_eq!(engaged, vec![600.0, 900.0]);
    }

    #[test]
    fn no_signal_watchdog() {
        let mut s = IndicatorSession::new(prof("qt-default"));
        let ev = s.feed(b"\x02000100\r", 0);
        assert!(ev.contains(&Event::Signal(true)));
        assert_eq!(s.tick(5000), Some(Event::Signal(false)));
        assert_eq!(s.tick(5000), None);
    }

    #[test]
    fn bad_frames_reported_not_weights() {
        let mut s = IndicatorSession::new(prof("qt-default"));
        let ev = s.feed(b"\x02ERR\r\x02000500\r", 0);
        let frames: Vec<bool> = ev.iter().filter_map(|e| if let Event::Frame { ok, .. } = e { Some(*ok) } else { None }).collect();
        assert_eq!(frames, vec![false, true]);
    }

    #[test]
    fn fixed_length_framing() {
        let mut f = FrameSplitter::new(&FrameCfg { kind: "fixed".into(), start: "<STX>".into(), end: String::new(), length: Some(6.0) });
        assert_eq!(f.push_str("zz\x02001230\x020045"), vec!["001230"]);
        assert_eq!(f.push_str("60"), vec!["004560"]);
    }

    #[test]
    fn runaway_input_is_capped() {
        let mut f = FrameSplitter::new(&FrameCfg { kind: "delimited".into(), start: String::new(), end: "<CR>".into(), length: None });
        f.push(&[b'9'; 10000]);
        assert!(f.buf.len() <= 4096);
    }
}
