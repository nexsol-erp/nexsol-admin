// Indicator profiles: everything that differs between weighbridge indicator makes lives in one
// plain JSON object, so a new model is commissioned on site from the Settings screen (or by
// importing a profile file) without a new build. Same presets, field names and JSON shape as the
// Electron app (electron/indicator/profiles.js), so a saved setup or an exported profile file
// works in both.
//
// A profile has four parts:
//   transport  how bytes arrive: a serial port, or a TCP socket (serial-to-Ethernet converters
//              and network indicators)
//   poll       optional: a command the indicator needs before it answers
//   frame      how the byte stream is cut into messages
//   decode     how the weight, unit, sign and stable flag are read out of one message
//
// Control characters are written with escapes so they survive JSON and text boxes:
// \x02, \r, \n, \t, or the names <STX> <ETX> <CR> <LF> <ENQ> <ACK> <NUL> <ESC>.

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{json, Map, Value};

const NAMED: &[(&str, u8)] = &[
    ("NUL", 0x00), ("SOH", 0x01), ("STX", 0x02), ("ETX", 0x03), ("EOT", 0x04), ("ENQ", 0x05),
    ("ACK", 0x06), ("CR", b'\r'), ("LF", b'\n'), ("ESC", 0x1b), ("NAK", 0x15), ("SP", b' '),
];

/// Bytes as text, one char per byte (latin1), the way the parser handles them.
pub fn latin1(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| b as char).collect()
}

/// Text back to bytes; chars above 0xFF can't come from the indicator and are dropped.
pub fn to_bytes(s: &str) -> Vec<u8> {
    s.chars().filter(|c| (*c as u32) <= 0xFF).map(|c| c as u8).collect()
}

/// "<STX>\x41\r" → "\u{2}A\r". Unknown escapes are left as typed.
pub fn unescape_ctl(s: &str) -> String {
    let chars: Vec<char> = s.chars().collect();
    let mut out = String::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        if c == '<' {
            // <NAME> with 2 or 3 capitals
            if let Some(close) = (i + 3..=i + 4).find(|&j| j < chars.len() && chars[j] == '>') {
                let name: String = chars[i + 1..close].iter().collect();
                if name.chars().all(|ch| ch.is_ascii_uppercase()) {
                    if let Some((_, b)) = NAMED.iter().find(|(n, _)| *n == name) {
                        out.push(*b as char);
                        i = close + 1;
                        continue;
                    }
                }
            }
        } else if c == '\\' && i + 1 < chars.len() {
            match chars[i + 1] {
                'x' if i + 3 < chars.len() && chars[i + 2].is_ascii_hexdigit() && chars[i + 3].is_ascii_hexdigit() => {
                    let h: String = chars[i + 2..i + 4].iter().collect();
                    out.push(u8::from_str_radix(&h, 16).unwrap_or(0) as char);
                    i += 4;
                    continue;
                }
                'r' => { out.push('\r'); i += 2; continue; }
                'n' => { out.push('\n'); i += 2; continue; }
                't' => { out.push('\t'); i += 2; continue; }
                _ => {}
            }
        }
        out.push(c);
        i += 1;
    }
    out
}

/// The reverse, for showing raw bytes and writing presets readably.
pub fn escape_ctl(s: &str) -> String {
    let mut out = String::new();
    for ch in s.chars() {
        let c = ch as u32;
        if let Some((n, _)) = NAMED.iter().find(|(n, b)| *n != "SP" && *b as u32 == c) {
            out.push_str(&format!("<{n}>"));
        } else if !(0x20..0x7f).contains(&c) {
            out.push_str(&format!("\\x{:02X}", c & 0xFF));
        } else {
            out.push(ch);
        }
    }
    out
}

/// A plain ASCII number anywhere in the message, with optional sign and unit.
pub const GENERIC_WEIGHT: &str = r"(?<sign>[-+])?\s*(?<weight>\d+(?:[.,]\d+)?)\s*(?<unit>kg|KG|Kg|t|T|lb|LB|lbs|g)?";

pub fn presets() -> Vec<Value> {
    vec![
        json!({
            "id": "qt-default",
            "name": "Current sites (STX + digits + CR)",
            "makes": "What the Qt weighbridge screen reads today: most Indian continuous-output indicators",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "<STX>", "end": "<CR>" },
            "decode": { "type": "regex", "pattern": GENERIC_WEIGHT },
        }),
        json!({
            "id": "ascii-line",
            "name": "Generic ASCII line (any text ending in CR or LF)",
            "makes": "Essae, Leo, Avery, Rice Lake, Cardinal and most indicators in continuous ASCII mode",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "", "end": "<CR>|<LF>" },
            "decode": { "type": "regex", "pattern": GENERIC_WEIGHT },
        }),
        json!({
            "id": "yaohua-reversed",
            "name": "Yaohua / Keli XK3190 continuous \"=\" (reversed digits)",
            "makes": "Yaohua XK3190-A9, A12, A12E, A27E, DS1 (tf=1/2), Keli D2008 and clones",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "=", "end": "=" },
            "decode": { "type": "regex", "pattern": r"(?<sign>-)?(?<weight>\d+(?:\.\d+)?)", "reverse": true },
        }),
        json!({
            "id": "yaohua-tf0",
            "name": "Yaohua XK3190 tf=0 (STX sign 6 digits decimals XOR ETX)",
            "makes": "Yaohua XK3190-A9/A12/A15 set to continuous format tf=0",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "<STX>", "end": "<ETX>" },
            "decode": { "type": "fixed", "signAt": 0, "weightAt": 1, "weightLength": 6, "decimalsAt": 7 },
        }),
        json!({
            "id": "toledo-continuous",
            "name": "Mettler Toledo continuous (status bytes)",
            "makes": "Mettler Toledo IND131/IND310/IND560/IND570/IND780, Jaguar, 8142 and Toledo-compatible indicators",
            "transport": { "baudRate": 9600, "dataBits": 7, "parity": "even", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "<STX>", "end": "<CR>" },
            "decode": { "type": "toledo", "unitFromStatus": false },
        }),
        json!({
            "id": "mt-sics",
            "name": "Mettler Toledo MT-SICS (polled, SI command)",
            "makes": "Mettler Toledo indicators and terminals with MT-SICS",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "poll",
            "poll": { "command": "SI<CR><LF>", "intervalMs": 300 },
            "frame": { "type": "delimited", "start": "", "end": "<CR><LF>" },
            "decode": {
                "type": "regex",
                "pattern": r"^S\s+(?<status>[SD])\s+(?<sign>-)?\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>kg|t|lb|g)?",
                "stablePattern": "^S$",
                "motionPattern": "^D$",
            },
        }),
        json!({
            "id": "and-st-gs",
            "name": "A&D / header format (ST,GS,+001234kg)",
            "makes": "A&D AD-4402/AD-4406/AD-4407, Avery Weigh-Tronix, Essae and others using ST/US/OL headers",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "", "end": "<CR><LF>" },
            "decode": {
                "type": "regex",
                "pattern": r"(?<status>ST|US|OL|QT|WT)\s*,\s*(?:GS|NT|TR|G|N)?\s*,?\s*(?<sign>[-+])?\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>kg|t|lb|g)?",
                "stablePattern": "^(ST|QT)$",
                "motionPattern": "^US$",
                "overloadPattern": "^OL$",
            },
        }),
        json!({
            "id": "sma-polled",
            "name": "SMA standard (polled W<CR>)",
            "makes": "Indicators following the SMA scale protocol: Rice Lake, Cardinal, Fairbanks, Avery",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "poll",
            "poll": { "command": "W<CR>", "intervalMs": 300 },
            "frame": { "type": "delimited", "start": "<LF>", "end": "<CR>" },
            "decode": {
                // <LF> s r n m f xxxxxx.xxx uuu <CR>: s = scale status (Z zero, O overload, E error,
                // space ok), r = range, n = gross/net, m = motion (M) or space, f = future use.
                "type": "regex",
                "pattern": r"^(?<over>.)(?:.)(?:.)(?<status>.)(?:.)\s*(?<sign>-)?\s*(?<weight>\d+(?:\.\d+)?)\s*(?<unit>kg|lb|t|g)?",
                "stablePattern": "^ $",
                "motionPattern": "^M$",
                "overloadPattern": "^O$",
            },
        }),
        json!({
            "id": "custom",
            "name": "Custom (set every field yourself)",
            "makes": "Any other indicator: use the raw data monitor to work out its format",
            "transport": { "baudRate": 9600, "dataBits": 8, "parity": "none", "stopBits": 1 },
            "mode": "continuous",
            "frame": { "type": "delimited", "start": "", "end": "<CR>|<LF>" },
            "decode": { "type": "regex", "pattern": GENERIC_WEIGHT },
        }),
    ]
}

fn serial_defaults() -> Value {
    json!({
        "type": "serial",
        "path": "COM1",
        "baudRate": 9600,
        "dataBits": 8,
        "parity": "none",      // none | even | odd | mark | space
        "stopBits": 1,         // 1 | 1.5 | 2
        "flowControl": "none", // none | hardware (RTS/CTS) | software (XON/XOFF)
        "dtr": true,           // some indicators take power or a "ready" signal from DTR/RTS
        "rts": true,
        "host": "",            // for type "tcp"
        "port": 4001,
    })
}

/// Settings that apply after decoding, whatever the indicator.
pub const COMMON_KEYS: &[&str] = &[
    "unit", "impliedDecimals", "decimalComma", "multiplier", "resolution", "stableCount",
    "stableToleranceKg", "zeroBandKg", "engageThresholdKg", "noSignalMs",
];

fn common_defaults() -> Value {
    json!({
        "unit": "kg",             // unit to assume when the message carries none
        "impliedDecimals": 0,     // "001234" with 1 implied decimal → 123.4
        "decimalComma": false,    // "123,4" means 123.4
        "multiplier": 1,          // extra scaling, e.g. 10 for an indicator that reports in 10 kg
        "resolution": 1,          // round the kg value to this step (1, 5, 10, 20 kg)
        "stableCount": 3,         // readings in a row within tolerance count as stable
        "stableToleranceKg": 0,
        "zeroBandKg": 0,          // |weight| at or below this counts as an empty bridge
        "engageThresholdKg": 200, // a vehicle on the bridge: first stable weight above this is reported to the server
        "noSignalMs": 3000,       // no valid reading for this long → "No signal"
    })
}

pub fn preset_by_id(id: &str) -> Value {
    let all = presets();
    all.iter().find(|p| p["id"] == id).cloned().unwrap_or_else(|| all[0].clone())
}

fn merge(base: &mut Map<String, Value>, add: &Value) {
    if let Value::Object(m) = add {
        for (k, v) in m {
            base.insert(k.clone(), v.clone());
        }
    }
}

fn obj(parts: &[&Value]) -> Value {
    let mut m = Map::new();
    for p in parts {
        merge(&mut m, p);
    }
    Value::Object(m)
}

fn usable(v: &Value) -> bool {
    !(v.is_null() || v == &Value::String(String::new()))
}

/// A full profile (as JSON) from a preset plus whatever the site overrode. Same merge as the
/// Electron app's buildProfile.
pub fn build_profile_value(preset_id: &str, overrides: &Value) -> Value {
    let p = preset_by_id(preset_id);
    let o = if overrides.is_object() { overrides.clone() } else { json!({}) };
    let empty = json!({});
    let get = |v: &Value, k: &str| -> Value { v.get(k).cloned().unwrap_or_else(|| empty.clone()) };
    let mut out = Map::new();
    out.insert("presetId".into(), p["id"].clone());
    let name = o.get("name").filter(|v| v.as_str().is_some_and(|s| !s.is_empty())).cloned().unwrap_or(p["name"].clone());
    out.insert("name".into(), name);
    out.insert("transport".into(), obj(&[&serial_defaults(), &get(&p, "transport"), &get(&o, "transport")]));
    let mode = o.get("mode").filter(|v| v.as_str().is_some_and(|s| !s.is_empty())).cloned().unwrap_or(p["mode"].clone());
    out.insert("mode".into(), mode);
    out.insert("poll".into(), obj(&[&json!({ "command": "", "intervalMs": 500 }), &get(&p, "poll"), &get(&o, "poll")]));
    out.insert("frame".into(), obj(&[&get(&p, "frame"), &get(&o, "frame")]));
    out.insert("decode".into(), obj(&[&get(&p, "decode"), &get(&o, "decode")]));
    let common = common_defaults();
    for k in COMMON_KEYS {
        let v = [&o, &p].iter().find_map(|src| src.get(*k).filter(|v| usable(v)).cloned()).unwrap_or(common[*k].clone());
        out.insert((*k).into(), v);
    }
    Value::Object(out)
}

pub fn build_profile(preset_id: &str, overrides: &Value) -> Profile {
    Profile::from_value(&build_profile_value(preset_id, overrides))
}

// ── typed view ────────────────────────────────────────────────────────────────
// Lenient readers: a text box may have left a number as a string, or blank.

fn de_f64<'de, D: Deserializer<'de>>(d: D) -> Result<Option<f64>, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => s.trim().parse().ok(),
        Value::Bool(b) => Some(if b { 1.0 } else { 0.0 }),
        _ => None,
    })
}

fn de_string<'de, D: Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => String::new(),
    })
}

fn de_bool<'de, D: Deserializer<'de>>(d: D) -> Result<Option<bool>, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::Bool(b) => Some(b),
        Value::Number(n) => Some(n.as_f64().unwrap_or(0.0) != 0.0),
        Value::String(s) => Some(s == "true"),
        _ => None,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct TransportCfg {
    #[serde(rename = "type", deserialize_with = "de_string")]
    pub kind: String,
    #[serde(deserialize_with = "de_string")]
    pub path: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub baud_rate: Option<f64>,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub data_bits: Option<f64>,
    #[serde(deserialize_with = "de_string")]
    pub parity: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub stop_bits: Option<f64>,
    #[serde(deserialize_with = "de_string")]
    pub flow_control: String,
    #[serde(deserialize_with = "de_bool", skip_serializing_if = "Option::is_none")]
    pub dtr: Option<bool>,
    #[serde(deserialize_with = "de_bool", skip_serializing_if = "Option::is_none")]
    pub rts: Option<bool>,
    #[serde(deserialize_with = "de_string")]
    pub host: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub port: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct PollCfg {
    #[serde(deserialize_with = "de_string")]
    pub command: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub interval_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct FrameCfg {
    #[serde(rename = "type", deserialize_with = "de_string")]
    pub kind: String,
    #[serde(deserialize_with = "de_string")]
    pub start: String,
    #[serde(deserialize_with = "de_string")]
    pub end: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub length: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct DecodeCfg {
    #[serde(rename = "type", deserialize_with = "de_string")]
    pub kind: String,
    #[serde(deserialize_with = "de_string", skip_serializing_if = "String::is_empty")]
    pub pattern: String,
    #[serde(deserialize_with = "de_string", skip_serializing_if = "String::is_empty")]
    pub flags: String,
    #[serde(deserialize_with = "de_bool", skip_serializing_if = "Option::is_none")]
    pub reverse: Option<bool>,
    #[serde(deserialize_with = "de_string", skip_serializing_if = "String::is_empty")]
    pub stable_pattern: String,
    #[serde(deserialize_with = "de_string", skip_serializing_if = "String::is_empty")]
    pub motion_pattern: String,
    #[serde(deserialize_with = "de_string", skip_serializing_if = "String::is_empty")]
    pub overload_pattern: String,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub sign_at: Option<f64>,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub weight_at: Option<f64>,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub weight_length: Option<f64>,
    #[serde(deserialize_with = "de_f64", skip_serializing_if = "Option::is_none")]
    pub decimals_at: Option<f64>,
    #[serde(deserialize_with = "de_bool", skip_serializing_if = "Option::is_none")]
    pub unit_from_status: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct Profile {
    #[serde(deserialize_with = "de_string")]
    pub preset_id: String,
    #[serde(deserialize_with = "de_string")]
    pub name: String,
    pub transport: TransportCfg,
    #[serde(deserialize_with = "de_string")]
    pub mode: String,
    pub poll: PollCfg,
    pub frame: FrameCfg,
    pub decode: DecodeCfg,
    #[serde(deserialize_with = "de_string")]
    pub unit: String,
    #[serde(deserialize_with = "de_f64")]
    pub implied_decimals: Option<f64>,
    #[serde(deserialize_with = "de_bool")]
    pub decimal_comma: Option<bool>,
    #[serde(deserialize_with = "de_f64")]
    pub multiplier: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub resolution: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub stable_count: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub stable_tolerance_kg: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub zero_band_kg: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub engage_threshold_kg: Option<f64>,
    #[serde(deserialize_with = "de_f64")]
    pub no_signal_ms: Option<f64>,
}

impl Profile {
    pub fn from_value(v: &Value) -> Profile {
        serde_json::from_value(v.clone()).unwrap_or_default()
    }

    /// What is saved as the site's overrides: the whole edited profile minus presetId, as the
    /// Electron settings screen saves it.
    pub fn overrides(&self) -> Value {
        let mut v = serde_json::to_value(self).unwrap_or(json!({}));
        if let Value::Object(m) = &mut v {
            m.remove("presetId");
        }
        v
    }

    pub fn no_signal_ms(&self) -> u64 {
        match self.no_signal_ms { Some(n) if n > 0.0 => n as u64, _ => 3000 }
    }
    pub fn zero_band(&self) -> f64 { self.zero_band_kg.unwrap_or(0.0) }
    pub fn engage_threshold(&self) -> f64 { self.engage_threshold_kg.unwrap_or(0.0) }
    pub fn implied(&self) -> u32 { self.implied_decimals.unwrap_or(0.0).max(0.0) as u32 }
    pub fn is_tcp(&self) -> bool { self.transport.kind == "tcp" }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escapes_round_trip() {
        assert_eq!(unescape_ctl(r"<STX>12\x41\r\n<ETX>"), "\u{2}12A\r\n\u{3}");
        assert_eq!(escape_ctl("\u{2}001230\r"), "<STX>001230<CR>");
        assert_eq!(unescape_ctl("<FOO>|<CR>"), "<FOO>|\r");
    }

    #[test]
    fn every_preset_builds() {
        for p in presets() {
            let prof = build_profile(p["id"].as_str().unwrap(), &json!({}));
            assert!(!prof.frame.kind.is_empty() && !prof.decode.kind.is_empty(), "{}", p["id"]);
            assert_eq!(prof.transport.baud_rate, Some(9600.0));
        }
    }

    #[test]
    fn overrides_win_and_blank_common_values_fall_back() {
        let p = build_profile("qt-default", &json!({ "transport": { "path": "COM4" }, "resolution": "", "stableCount": 5 }));
        assert_eq!(p.transport.path, "COM4");
        assert_eq!(p.resolution, Some(1.0));
        assert_eq!(p.stable_count, Some(5.0));
        assert_eq!(p.transport.parity, "none");
    }

    #[test]
    fn saved_overrides_rebuild_the_same_profile() {
        let p = build_profile("mt-sics", &json!({ "transport": { "type": "tcp", "host": "10.0.0.5" } }));
        let again = build_profile("mt-sics", &p.overrides());
        assert_eq!(p, again);
        assert!(p.overrides().get("presetId").is_none());
    }
}
