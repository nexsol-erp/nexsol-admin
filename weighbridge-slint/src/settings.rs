// The settings rows the app keeps in weighbridge.db. Same JSON as the Electron app, so a PC keeps
// its setup whichever app it runs. Missing fields take the defaults below; fields this app doesn't
// know are dropped on the next save.

use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

fn de_string<'de, D: Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::String(s) => s,
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => String::new(),
    })
}

fn de_strings<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<String>, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::Array(a) => a
            .into_iter()
            .map(|v| match v {
                Value::String(s) => s,
                Value::Null => String::new(),
                other => other.to_string(),
            })
            .collect(),
        _ => vec![],
    })
}

fn de_copies<'de, D: Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    let n = match Value::deserialize(d)? {
        Value::Number(n) => n.as_f64().unwrap_or(1.0),
        Value::String(s) => s.trim().parse().unwrap_or(1.0),
        _ => 1.0,
    };
    Ok(n.clamp(1.0, 5.0) as u32)
}

fn de_width<'de, D: Deserializer<'de>>(d: D) -> Result<u32, D::Error> {
    let n = match Value::deserialize(d)? {
        Value::Number(n) => n.as_f64().unwrap_or(40.0),
        Value::String(s) => s.trim().parse().unwrap_or(40.0),
        _ => 40.0,
    };
    Ok(n.clamp(24.0, 136.0) as u32)
}

fn de_bool_or<'de, D: Deserializer<'de>>(d: D) -> Result<bool, D::Error> {
    Ok(match Value::deserialize(d)? {
        Value::Bool(b) => b,
        Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
        Value::String(s) => s == "true",
        _ => false,
    })
}

/// "print" row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct PrintSettings {
    /// "" = the Windows default printer, like the Qt app
    #[serde(deserialize_with = "de_string")]
    pub printer: String,
    /// a5 | 80mm | text (dot-matrix: plain text, the printer's own font)
    #[serde(deserialize_with = "de_string")]
    pub layout: String,
    #[serde(deserialize_with = "de_copies")]
    pub copies: u32,
    #[serde(deserialize_with = "de_bool_or")]
    pub auto_print: bool,
    #[serde(deserialize_with = "de_bool_or")]
    pub keep_pdf: bool,
    /// "" = Documents\TradeLink247 Weighbridge\Vouchers
    #[serde(deserialize_with = "de_string")]
    pub pdf_folder: String,
    /// lines; filled from the branch record at sign-in
    #[serde(deserialize_with = "de_strings")]
    pub header: Vec<String>,
    #[serde(deserialize_with = "de_string")]
    pub footer: String,
    #[serde(deserialize_with = "de_string")]
    pub currency: String,
    /// dot-matrix: characters per line (40 on a 3-inch roll, 80 on 9-inch paper)
    #[serde(deserialize_with = "de_width")]
    pub text_width: u32,
    /// dot-matrix: feed to the next form after each voucher
    #[serde(deserialize_with = "de_bool_or")]
    pub form_feed: bool,
}

impl Default for PrintSettings {
    fn default() -> Self {
        PrintSettings {
            printer: String::new(),
            layout: "a5".into(),
            copies: 1,
            auto_print: true,
            keep_pdf: true,
            pdf_folder: String::new(),
            header: vec![],
            footer: "Thank you for your business!".into(),
            currency: "₹".into(),
            text_width: 40,
            form_feed: true,
        }
    }
}

/// "weighing" row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct WeighingSettings {
    /// save only on a stable reading
    #[serde(deserialize_with = "de_bool_or")]
    pub require_stable: bool,
    /// admin-only, for commissioning and training
    #[serde(deserialize_with = "de_bool_or")]
    pub simulator: bool,
}

impl Default for WeighingSettings {
    fn default() -> Self {
        WeighingSettings { require_stable: true, simulator: false }
    }
}

/// "auth" row: who is signed in, and which company and branch this PC belongs to.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AuthRec {
    #[serde(deserialize_with = "de_string")]
    pub token: String,
    #[serde(deserialize_with = "de_string")]
    pub tenant_id: String,
    #[serde(deserialize_with = "de_string")]
    pub username: String,
    #[serde(deserialize_with = "de_strings")]
    pub roles: Vec<String>,
    #[serde(deserialize_with = "de_strings")]
    pub branches: Vec<String>,
    #[serde(deserialize_with = "de_string")]
    pub branch_code: String,
    #[serde(deserialize_with = "de_string")]
    pub api_server: String,
}

impl AuthRec {
    pub fn is_admin(&self) -> bool {
        self.roles.iter().any(|r| ["ADMIN", "admin", "SYSTEM_ADMIN", "system-admin"].contains(&r.as_str()))
    }
    pub fn signed_in(&self) -> bool {
        !self.token.is_empty()
    }
}

/// "indicator" row.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct IndicatorConfig {
    #[serde(deserialize_with = "de_string")]
    pub preset_id: String,
    pub overrides: Value,
}

impl Default for IndicatorConfig {
    fn default() -> Self {
        IndicatorConfig { preset_id: "qt-default".into(), overrides: Value::Object(Default::default()) }
    }
}

pub fn read<T: for<'de> Deserialize<'de> + Default>(v: Option<Value>) -> T {
    v.filter(|v| v.is_object()).and_then(|v| serde_json::from_value(v).ok()).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn electron_rows_read() {
        let p: PrintSettings = read(Some(json!({ "layout": "80mm", "copies": 2, "header": ["ACME", null], "printer": "EPSON" })));
        assert_eq!((p.layout.as_str(), p.copies, p.printer.as_str()), ("80mm", 2, "EPSON"));
        assert!(p.auto_print && p.keep_pdf, "defaults fill the rest");
        assert_eq!(p.header, vec!["ACME".to_string(), String::new()]);
        assert_eq!(p.text_width, 40);
        let a: AuthRec = read(Some(json!({ "token": "t", "tenantId": 42, "roles": ["ADMIN"], "branchCode": "WB1" })));
        assert!(a.is_admin() && a.signed_in());
        assert_eq!(a.tenant_id, "42");
        let w: WeighingSettings = read(Some(json!({ "simulator": true })));
        assert!(w.require_stable && w.simulator);
        let bad: PrintSettings = read(Some(json!("nonsense")));
        assert_eq!(bad, PrintSettings::default());
        let i: IndicatorConfig = read(None);
        assert_eq!(i.preset_id, "qt-default");
    }

    #[test]
    fn copies_are_kept_between_one_and_five() {
        let p: PrintSettings = read(Some(json!({ "copies": 9 })));
        assert_eq!(p.copies, 5);
        let p: PrintSettings = read(Some(json!({ "copies": "0" })));
        assert_eq!(p.copies, 1);
    }
}
