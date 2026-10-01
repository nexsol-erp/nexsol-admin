// Local database for one weighbridge PC. Every weighing is saved and numbered here first, so the
// bridge keeps working when the internet or the server is down; sync.rs uploads it.
//
// This is the same SQLite file, schema and settings rows as the Electron app (electron/store.js):
// the Slint app opens the Electron app's weighbridge.db as it is, so switching between the two
// keeps every weighing, counter, setting and photo. Column names follow the Qt app's local tables
// (wb_weights, wb_vehicles, wb_rates, voucher_series).

use crate::charge::{self, Rate, Source};
use crate::error::{AppError, Res};
use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, TimeZone};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::Serialize;
use serde_json::Value;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS wb_weights (
  id TEXT PRIMARY KEY,
  voucher_number TEXT,
  voucher_date TEXT,
  vehicle_number TEXT,
  wheel_type TEXT,
  material TEXT,
  mobile_number TEXT,
  lcd_number REAL,
  first_weight REAL,
  first_weight_date TEXT,
  first_weight_id TEXT,
  first_weight_kind TEXT,
  amount REAL,
  round_trip INTEGER DEFAULT 0,
  branch_code TEXT,
  user_id TEXT,
  origin TEXT DEFAULT 'local',
  synced INTEGER DEFAULT 0,
  sync_error TEXT,
  printed INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_wb_weights_vehicle ON wb_weights(vehicle_number, voucher_date);
CREATE INDEX IF NOT EXISTS ix_wb_weights_date ON wb_weights(voucher_date);
CREATE INDEX IF NOT EXISTS ix_wb_weights_synced ON wb_weights(synced);

CREATE TABLE IF NOT EXISTS wb_vehicles (
  id TEXT PRIMARY KEY,
  voucher_number TEXT,
  voucher_date TEXT,
  vehicle_number TEXT,
  wheel_type TEXT,
  tare_weight REAL,
  branch_code TEXT,
  user_id TEXT,
  origin TEXT DEFAULT 'local',
  synced INTEGER DEFAULT 0,
  sync_error TEXT
);
CREATE INDEX IF NOT EXISTS ix_wb_vehicles_vehicle ON wb_vehicles(vehicle_number, voucher_date);

CREATE TABLE IF NOT EXISTS wb_rates (
  id TEXT PRIMARY KEY,
  wheel_type TEXT,
  wheel_rate REAL,
  voucher_date TEXT
);

CREATE TABLE IF NOT EXISTS voucher_series (
  voucher_type TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS wb_engage (
  id TEXT PRIMARY KEY,
  date_time TEXT,
  weight INTEGER,
  branch_code TEXT,
  synced INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wb_vehicle_wheel (
  vehicle_number TEXT PRIMARY KEY,
  wheel_type TEXT,
  voucher_date TEXT,
  set_on_server INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
";

/// Local wall-clock time as "yyyy-MM-dd HH:mm:ss", the format the Qt app and the server use.
pub fn local_stamp(d: NaiveDateTime) -> String {
    d.format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn now_stamp() -> String {
    local_stamp(Local::now().naive_local())
}

/// Server dates come back as ISO strings with an offset; store them as local wall-clock time.
/// Read the way JavaScript's Date reads them: no offset means local time, a bare date means UTC.
pub fn from_server_date(v: &str) -> Option<String> {
    let v = v.trim();
    if v.is_empty() {
        return None;
    }
    if let Ok(d) = DateTime::parse_from_rfc3339(v) {
        return Some(local_stamp(d.with_timezone(&Local).naive_local()));
    }
    // "+05:30"-less offsets like "+0000" and a space instead of T
    for f in ["%Y-%m-%dT%H:%M:%S%.f%z", "%Y-%m-%d %H:%M:%S%.f%z"] {
        if let Ok(d) = DateTime::parse_from_str(v, f) {
            return Some(local_stamp(d.with_timezone(&Local).naive_local()));
        }
    }
    for f in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%d %H:%M:%S%.f", "%Y-%m-%dT%H:%M"] {
        if let Ok(d) = NaiveDateTime::parse_from_str(v, f) {
            return Some(local_stamp(d));
        }
    }
    if let Ok(d) = NaiveDate::parse_from_str(v, "%Y-%m-%d") {
        let utc = chrono::Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap());
        return Some(local_stamp(utc.with_timezone(&Local).naive_local()));
    }
    Some(v.to_string())
}

/// "kl 07-ab 1234" → "KL07AB1234": the Qt screen only allowed letters and digits.
pub fn normalize_vehicle(v: &str) -> String {
    v.to_uppercase().chars().filter(|c| c.is_ascii_uppercase() || c.is_ascii_digit()).collect()
}

fn uuid() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct Weighing {
    pub id: String,
    pub voucher_number: String,
    pub voucher_date: String,
    pub vehicle_number: String,
    pub wheel_type: String,
    pub material: String,
    pub mobile_number: String,
    pub lcd_number: f64,
    pub first_weight: f64,
    pub first_weight_date: Option<String>,
    pub first_weight_id: Option<String>,
    pub first_weight_kind: Option<String>,
    pub amount: f64,
    pub round_trip: i64,
    pub branch_code: String,
    pub user_id: String,
    pub origin: String,
    pub synced: i64,
    pub sync_error: Option<String>,
    pub printed: i64,
    pub photo_path: Option<String>,
    pub photo_synced: i64,
    pub photo_error: Option<String>,
}

impl Weighing {
    fn from_row(r: &Row) -> rusqlite::Result<Self> {
        let s = |k: &str| -> rusqlite::Result<String> { Ok(r.get::<_, Option<String>>(k)?.unwrap_or_default()) };
        let f = |k: &str| -> rusqlite::Result<f64> { Ok(r.get::<_, Option<f64>>(k)?.unwrap_or(0.0)) };
        let i = |k: &str| -> rusqlite::Result<i64> { Ok(r.get::<_, Option<i64>>(k)?.unwrap_or(0)) };
        Ok(Weighing {
            id: s("id")?,
            voucher_number: s("voucher_number")?,
            voucher_date: s("voucher_date")?,
            vehicle_number: s("vehicle_number")?,
            wheel_type: s("wheel_type")?,
            material: s("material")?,
            mobile_number: s("mobile_number")?,
            lcd_number: f("lcd_number")?,
            first_weight: f("first_weight")?,
            first_weight_date: r.get("first_weight_date")?,
            first_weight_id: r.get("first_weight_id")?,
            first_weight_kind: r.get("first_weight_kind")?,
            amount: f("amount")?,
            round_trip: i("round_trip")?,
            branch_code: s("branch_code")?,
            user_id: s("user_id")?,
            origin: s("origin")?,
            synced: i("synced")?,
            sync_error: r.get("sync_error")?,
            printed: i("printed")?,
            photo_path: r.get("photo_path")?,
            photo_synced: i("photo_synced")?,
            photo_error: r.get("photo_error")?,
        })
    }

    pub fn net_weight(&self) -> f64 {
        charge::net_weight(self.lcd_number, self.first_weight)
    }
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct Tare {
    pub id: String,
    pub voucher_number: String,
    pub voucher_date: String,
    pub vehicle_number: String,
    pub wheel_type: String,
    pub tare_weight: f64,
    pub branch_code: String,
    pub user_id: String,
    pub synced: i64,
    pub sync_error: Option<String>,
}

impl Tare {
    fn from_row(r: &Row) -> rusqlite::Result<Self> {
        let s = |k: &str| -> rusqlite::Result<String> { Ok(r.get::<_, Option<String>>(k)?.unwrap_or_default()) };
        Ok(Tare {
            id: s("id")?,
            voucher_number: s("voucher_number")?,
            voucher_date: s("voucher_date")?,
            vehicle_number: s("vehicle_number")?,
            wheel_type: s("wheel_type")?,
            tare_weight: r.get::<_, Option<f64>>("tare_weight")?.unwrap_or(0.0),
            branch_code: s("branch_code")?,
            user_id: s("user_id")?,
            synced: r.get::<_, Option<i64>>("synced")?.unwrap_or(0),
            sync_error: r.get("sync_error")?,
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Engage {
    pub id: String,
    pub date_time: String,
    pub weight: i64,
    pub branch_code: String,
}

/// What the operator picked as the first weight.
#[derive(Debug, Clone, PartialEq, Default)]
pub enum Pick {
    #[default]
    None,
    Previous(String),
    Tare(String),
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct PickedSource {
    pub kind: &'static str,
    pub id: Option<String>,
    pub weight: f64,
    pub date: Option<String>,
    pub round_trip: i64,
}

#[derive(Debug, Clone, PartialEq, Default)]
pub struct QuoteOut {
    pub rate: f64,
    pub amount: f64,
    pub reason: String,
    pub first_weight: f64,
    pub first_weight_date: String,
    pub net_weight: f64,
    pub round_trip: i64,
}

#[derive(Debug, Clone, Default)]
pub struct NewWeighing {
    pub vehicle_number: String,
    pub wheel_type: String,
    pub material: String,
    pub mobile_number: String,
    pub weight: f64,
    pub source: Pick,
    pub branch_code: String,
    pub user_id: String,
    pub now: Option<NaiveDateTime>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct HistoryWeighing {
    pub id: String,
    pub voucher_number: String,
    pub voucher_date: String,
    pub weight: f64,
    pub first_weight: f64,
    pub amount: f64,
    pub round_trip: i64,
    pub wheel_type: String,
    pub material: String,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct Pending {
    pub weights: i64,
    pub tares: i64,
    pub engage: i64,
    pub photos: i64,
}

impl Pending {
    pub fn total(&self) -> i64 {
        self.weights + self.tares
    }
}

pub struct Report {
    pub rows: Vec<Weighing>,
    pub total: f64,
    pub count: usize,
    pub last_voucher: String,
}

pub struct Store {
    pub db: Connection,
}

impl Store {
    pub fn open(file: &str) -> Res<Store> {
        let db = Connection::open(file)?;
        db.pragma_update(None, "journal_mode", "WAL")?;
        db.pragma_update(None, "synchronous", "FULL")?; // a voucher that printed must survive a power cut
        db.busy_timeout(std::time::Duration::from_secs(5))?;
        db.execute_batch(SCHEMA)?;
        let s = Store { db };
        // columns added after a table first shipped
        if !s.columns("wb_vehicle_wheel")?.iter().any(|c| c == "set_on_server") {
            s.db.execute_batch("ALTER TABLE wb_vehicle_wheel ADD COLUMN set_on_server INTEGER DEFAULT 0")?;
        }
        // camera photo of a weighing: photo_synced 0 = to upload, 1 = on the server, 2 = this PC only
        let w = s.columns("wb_weights")?;
        for (col, ddl) in [
            ("photo_path", "ALTER TABLE wb_weights ADD COLUMN photo_path TEXT"),
            ("photo_synced", "ALTER TABLE wb_weights ADD COLUMN photo_synced INTEGER DEFAULT 0"),
            ("photo_error", "ALTER TABLE wb_weights ADD COLUMN photo_error TEXT"),
        ] {
            if !w.iter().any(|c| c == col) {
                s.db.execute_batch(ddl)?;
            }
        }
        Ok(s)
    }

    pub fn memory() -> Store {
        Store::open(":memory:").expect("in-memory database")
    }

    fn columns(&self, table: &str) -> Res<Vec<String>> {
        let mut st = self.db.prepare(&format!("PRAGMA table_info({table})"))?;
        let cols = st.query_map([], |r| r.get::<_, String>(1))?.collect::<Result<Vec<_>, _>>()?;
        Ok(cols)
    }

    // ── settings ─────────────────────────────────────────────────────────────
    // Stored as JSON text, the same rows the Electron app reads.
    pub fn get_setting(&self, key: &str) -> Option<Value> {
        let text: Option<String> = self.db.query_row("SELECT value FROM settings WHERE key = ?", [key], |r| r.get(0)).optional().ok().flatten();
        text.and_then(|t| serde_json::from_str(&t).ok())
    }

    pub fn set_setting(&self, key: &str, value: &Value) -> Res<()> {
        self.db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, serde_json::to_string(value)?],
        )?;
        Ok(())
    }

    pub fn get_str(&self, key: &str) -> String {
        self.get_setting(key).and_then(|v| v.as_str().map(String::from)).unwrap_or_default()
    }

    // ── voucher numbers ─────────────────────────────────────────────────────
    // Same as Qt's VoucherSystem::getNextVoucher: a per-type counter, 6 digits zero-padded.
    fn next_voucher(&self, kind: &str) -> Res<String> {
        let next = self.last_voucher(kind) + 1;
        self.db.execute(
            "INSERT INTO voucher_series (voucher_type, last_number) VALUES (?, ?) ON CONFLICT(voucher_type) DO UPDATE SET last_number = excluded.last_number",
            params![kind, next],
        )?;
        Ok(format!("{next:06}"))
    }

    /// So a new PC carries on the branch's numbering instead of starting at 000001. Never lowers.
    pub fn ensure_series_at_least(&self, kind: &str, n: i64) -> Res<()> {
        if n <= 0 {
            return Ok(());
        }
        self.db.execute(
            "INSERT INTO voucher_series (voucher_type, last_number) VALUES (?, ?)
             ON CONFLICT(voucher_type) DO UPDATE SET last_number = MAX(last_number, excluded.last_number)",
            params![kind, n],
        )?;
        Ok(())
    }

    pub fn last_voucher(&self, kind: &str) -> i64 {
        self.db
            .query_row("SELECT last_number FROM voucher_series WHERE voucher_type = ?", [kind], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
            .unwrap_or(0)
    }

    // ── rates ────────────────────────────────────────────────────────────────
    pub fn all_rates(&self) -> Vec<Rate> {
        let Ok(mut st) = self.db.prepare("SELECT id, wheel_type, wheel_rate, voucher_date FROM wb_rates") else { return vec![] };
        st.query_map([], |r| {
            Ok(Rate {
                id: r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                wheel_type: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                wheel_rate: r.get::<_, Option<f64>>(2)?.unwrap_or(0.0),
                voucher_date: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
            })
        })
        .map(|it| it.filter_map(Result::ok).collect())
        .unwrap_or_default()
    }

    pub fn rates(&self) -> Vec<(String, f64)> {
        charge::current_rates(&self.all_rates())
    }

    /// Rates from the server ([{ id, wheelType, wheelRate, voucherDate }]).
    pub fn replace_rates(&mut self, list: &[Value]) -> Res<()> {
        let tx = self.db.transaction()?;
        tx.execute("DELETE FROM wb_rates", [])?;
        for r in list {
            let wt = vstr(r, "wheelType");
            if wt.is_empty() {
                continue;
            }
            let id = { let id = vstr(r, "id"); if id.is_empty() { uuid() } else { id } };
            tx.execute(
                "INSERT INTO wb_rates (id, wheel_type, wheel_rate, voucher_date) VALUES (?, ?, ?, ?)",
                params![id, wt, vnum(r, "wheelRate"), from_server_date(&vstr(r, "voucherDate")).unwrap_or_default()],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    // ── lookups for the weighing screen ─────────────────────────────────────
    /// (vehicle, wheel type) for the vehicle box suggestions, newest first.
    pub fn vehicles(&self, prefix: &str, limit: i64) -> Vec<(String, String)> {
        let p = normalize_vehicle(prefix);
        let Ok(mut st) = self.db.prepare(
            "SELECT vehicle_number,
                    (SELECT w2.wheel_type FROM wb_weights w2 WHERE w2.vehicle_number = w.vehicle_number AND w2.wheel_type <> ''
                      ORDER BY w2.voucher_date DESC LIMIT 1),
                    MAX(voucher_date) AS lastDate
             FROM wb_weights w WHERE vehicle_number LIKE ? GROUP BY vehicle_number ORDER BY lastDate DESC LIMIT ?",
        ) else { return vec![] };
        st.query_map(params![format!("{p}%"), limit], |r| {
            Ok((r.get::<_, Option<String>>(0)?.unwrap_or_default(), r.get::<_, Option<String>>(1)?.unwrap_or_default()))
        })
        .map(|it| it.filter_map(Result::ok).collect())
        .unwrap_or_default()
    }

    pub fn materials(&self, prefix: &str, limit: i64) -> Vec<String> {
        let Ok(mut st) = self.db.prepare(
            "SELECT material FROM wb_weights WHERE material <> '' AND material LIKE ?
             GROUP BY material ORDER BY MAX(voucher_date) DESC LIMIT ?",
        ) else { return vec![] };
        st.query_map(params![format!("{prefix}%"), limit], |r| r.get::<_, String>(0))
            .map(|it| it.filter_map(Result::ok).collect())
            .unwrap_or_default()
    }

    /// The wheel type a vehicle is locked to: the one set in the web admin, else its newest weighing
    /// or tare here, else the server's newest. Only the web admin changes it.
    pub fn wheel_type_of(&self, vehicle: &str) -> String {
        let v = normalize_vehicle(vehicle);
        if v.is_empty() {
            return String::new();
        }
        let q = |sql: &str, p: &[&dyn rusqlite::ToSql]| -> Option<String> {
            self.db.query_row(sql, p, |r| r.get::<_, Option<String>>(0)).optional().ok().flatten().flatten().filter(|s| !s.is_empty())
        };
        if let Some(set) = q("SELECT wheel_type FROM wb_vehicle_wheel WHERE vehicle_number = ? AND set_on_server = 1", &[&v]) {
            return set;
        }
        if let Some(w) = q(
            "SELECT wheel_type FROM (
               SELECT wheel_type, voucher_date FROM wb_weights WHERE vehicle_number = ? AND COALESCE(wheel_type, '') <> ''
               UNION ALL
               SELECT wheel_type, voucher_date FROM wb_vehicles WHERE vehicle_number = ? AND COALESCE(wheel_type, '') <> ''
             ) ORDER BY voucher_date DESC LIMIT 1",
            &[&v, &v],
        ) {
            return w;
        }
        q("SELECT wheel_type FROM wb_vehicle_wheel WHERE vehicle_number = ?", &[&v]).unwrap_or_default()
    }

    /// set_on_server: a wheel type set in the web admin. A server-history answer never replaces one
    /// set in the web admin.
    pub fn remember_wheel_type(&self, vehicle: &str, wheel_type: &str, voucher_date: &str, set_on_server: bool) -> Res<()> {
        let v = normalize_vehicle(vehicle);
        if v.is_empty() || wheel_type.is_empty() {
            return Ok(());
        }
        let sql = if set_on_server {
            "INSERT INTO wb_vehicle_wheel (vehicle_number, wheel_type, voucher_date, set_on_server) VALUES (?, ?, ?, 1)
             ON CONFLICT(vehicle_number) DO UPDATE SET wheel_type = excluded.wheel_type, voucher_date = excluded.voucher_date, set_on_server = 1"
        } else {
            "INSERT INTO wb_vehicle_wheel (vehicle_number, wheel_type, voucher_date, set_on_server) VALUES (?, ?, ?, 0)
             ON CONFLICT(vehicle_number) DO UPDATE SET wheel_type = excluded.wheel_type, voucher_date = excluded.voucher_date
             WHERE wb_vehicle_wheel.set_on_server = 0"
        };
        self.db.execute(sql, params![v, wheel_type, voucher_date])?;
        Ok(())
    }

    /// Errors unless wheel_type matches the vehicle's locked one.
    pub fn check_wheel_type(&self, vehicle: &str, wheel_type: &str) -> Res<String> {
        let saved = self.wheel_type_of(vehicle);
        if !saved.is_empty() && !wheel_type.is_empty() && saved != wheel_type {
            return Err(AppError::validation(format!(
                "{} is saved as {saved}. Its wheel type can only be changed in the web admin (Vehicle Wheel Type).",
                normalize_vehicle(vehicle)
            )));
        }
        Ok(saved)
    }

    /// Previous weighings (newest first) and saved tares for one vehicle.
    pub fn history(&self, vehicle: &str, limit: i64) -> (Vec<HistoryWeighing>, Vec<Tare>) {
        let v = normalize_vehicle(vehicle);
        let weights = self
            .db
            .prepare(
                "SELECT id, voucher_number, voucher_date, lcd_number, first_weight, amount, round_trip, wheel_type, material
                 FROM wb_weights WHERE vehicle_number = ? ORDER BY voucher_date DESC LIMIT ?",
            )
            .and_then(|mut st| {
                st.query_map(params![v, limit], |r| {
                    Ok(HistoryWeighing {
                        id: r.get::<_, Option<String>>(0)?.unwrap_or_default(),
                        voucher_number: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                        voucher_date: r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                        weight: r.get::<_, Option<f64>>(3)?.unwrap_or(0.0),
                        first_weight: r.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                        amount: r.get::<_, Option<f64>>(5)?.unwrap_or(0.0),
                        round_trip: r.get::<_, Option<i64>>(6)?.unwrap_or(0),
                        wheel_type: r.get::<_, Option<String>>(7)?.unwrap_or_default(),
                        material: r.get::<_, Option<String>>(8)?.unwrap_or_default(),
                    })
                })
                .map(|it| it.filter_map(Result::ok).collect())
            })
            .unwrap_or_default();
        let tares = self
            .db
            .prepare("SELECT * FROM wb_vehicles WHERE vehicle_number = ? ORDER BY voucher_date DESC LIMIT ?")
            .and_then(|mut st| st.query_map(params![v, limit], Tare::from_row).map(|it| it.filter_map(Result::ok).collect()))
            .unwrap_or_default();
        (weights, tares)
    }

    /// The first weight a new weighing pairs with.
    fn source(&self, pick: &Pick, vehicle: &str) -> Res<PickedSource> {
        match pick {
            Pick::Previous(id) => {
                let r: Option<(String, f64, String, i64, String)> = self
                    .db
                    .query_row(
                        "SELECT id, lcd_number, voucher_date, round_trip, vehicle_number FROM wb_weights WHERE id = ?",
                        [id],
                        |r| {
                            Ok((
                                r.get(0)?,
                                r.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                                r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                                r.get::<_, Option<i64>>(3)?.unwrap_or(0),
                                r.get::<_, Option<String>>(4)?.unwrap_or_default(),
                            ))
                        },
                    )
                    .optional()?;
                match r {
                    Some(r) if r.4 == vehicle => Ok(PickedSource { kind: "previous", id: Some(r.0), weight: r.1, date: Some(r.2), round_trip: r.3 }),
                    _ => Err(AppError::validation("Pick a previous weighing of this vehicle")),
                }
            }
            Pick::Tare(id) => {
                let r: Option<(String, f64, String, String)> = self
                    .db
                    .query_row("SELECT id, tare_weight, voucher_date, vehicle_number FROM wb_vehicles WHERE id = ?", [id], |r| {
                        Ok((
                            r.get(0)?,
                            r.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                            r.get::<_, Option<String>>(2)?.unwrap_or_default(),
                            r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                        ))
                    })
                    .optional()?;
                match r {
                    Some(r) if r.3 == vehicle => Ok(PickedSource { kind: "tare", id: Some(r.0), weight: r.1, date: Some(r.2), round_trip: 0 }),
                    _ => Err(AppError::validation("Pick a saved tare weight of this vehicle")),
                }
            }
            Pick::None => Ok(PickedSource { kind: "none", ..Default::default() }),
        }
    }

    fn charge_source(src: &PickedSource) -> Source {
        match src.kind {
            "previous" => Source::Previous { round_trip: src.round_trip },
            "tare" => Source::Tare,
            _ => Source::None,
        }
    }

    /// What the screen shows before saving. Same code path as the save, so they can't disagree.
    pub fn quote(&self, vehicle_number: &str, wheel_type: &str, pick: &Pick, weight: f64) -> QuoteOut {
        let vehicle = normalize_vehicle(vehicle_number);
        let src = self.source(pick, &vehicle).unwrap_or(PickedSource { kind: "none", ..Default::default() });
        let rate = charge::rate_for(&self.all_rates(), wheel_type);
        let cs = Self::charge_source(&src);
        let q = charge::quote(rate, &cs);
        QuoteOut {
            rate,
            amount: q.amount,
            reason: q.reason.to_string(),
            first_weight: src.weight,
            first_weight_date: src.date.clone().unwrap_or_default(),
            net_weight: charge::net_weight(weight, src.weight),
            round_trip: charge::round_trip_for(&cs),
        }
    }

    /// Saves one weighing and returns the stored row. The weight comes from the live indicator,
    /// never from the screen. Validation errors are things the operator must fix.
    pub fn save_weighing(&self, n: NewWeighing) -> Res<Weighing> {
        let vehicle = normalize_vehicle(&n.vehicle_number);
        if vehicle.is_empty() {
            return Err(AppError::validation("Enter the vehicle number"));
        }
        if n.wheel_type.is_empty() {
            return Err(AppError::validation("Select the wheel type"));
        }
        if !n.weight.is_finite() || n.weight == 0.0 {
            return Err(AppError::validation("No weight on the bridge"));
        }
        let digits: String = n.mobile_number.chars().filter(|c| c.is_ascii_digit()).collect();
        let mobile: String = digits.chars().skip(digits.chars().count().saturating_sub(15)).collect();
        let material: String = n.material.trim().chars().take(50).collect();
        let id = uuid();
        {
            // the checks and the counter in one transaction: a refused save doesn't use up a number
            let tx = self.db.unchecked_transaction()?;
            let me = &*self;
            let result = (|| -> Res<()> {
                me.check_wheel_type(&vehicle, &n.wheel_type)?;
                let src = me.source(&n.source, &vehicle)?;
                let rate = charge::rate_for(&me.all_rates(), &n.wheel_type);
                if !(rate > 0.0) {
                    return Err(AppError::validation(format!("No rate set for wheel type {}", n.wheel_type)));
                }
                let cs = Self::charge_source(&src);
                let amount = charge::quote(rate, &cs).amount;
                let round_trip = charge::round_trip_for(&cs);
                let voucher = me.next_voucher("WB")?;
                let date = local_stamp(n.now.unwrap_or_else(|| Local::now().naive_local()));
                me.db.execute(
                    "INSERT INTO wb_weights (id, voucher_number, voucher_date, vehicle_number, wheel_type, material,
                        mobile_number, lcd_number, first_weight, first_weight_date, first_weight_id, first_weight_kind, amount,
                        round_trip, branch_code, user_id, origin, synced)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', 0)",
                    params![
                        id, voucher, date, vehicle, n.wheel_type, material, mobile, n.weight, src.weight, src.date, src.id,
                        src.kind, amount, round_trip, n.branch_code, n.user_id
                    ],
                )?;
                // Qt's updateRoundTrip: a vehicle keeps at most one open weighing, and it is the newest
                // first weighing. A return weighing closes it; a new first weighing closes the rest.
                if round_trip == 1 {
                    me.db.execute("UPDATE wb_weights SET round_trip = 1 WHERE vehicle_number = ? AND id <> ? AND round_trip = 0", params![vehicle, id])?;
                } else {
                    me.db.execute("UPDATE wb_weights SET round_trip = 1 WHERE vehicle_number = ? AND id <> ?", params![vehicle, id])?;
                }
                Ok(())
            })();
            result?;
            tx.commit()?;
        }
        self.get_weighing(&id).ok_or_else(|| AppError::other("saved weighing not found"))
    }

    pub fn get_weighing(&self, id: &str) -> Option<Weighing> {
        self.db.query_row("SELECT * FROM wb_weights WHERE id = ?", [id], Weighing::from_row).optional().ok().flatten()
    }

    // ── camera photos ────────────────────────────────────────────────────────
    /// upload false: the photo stays on this PC only (photo_synced 2)
    pub fn set_photo(&self, id: &str, path: &str, upload: bool) -> Res<()> {
        self.db.execute(
            "UPDATE wb_weights SET photo_path = ?, photo_synced = ?, photo_error = NULL WHERE id = ?",
            params![path, if upload { 0 } else { 2 }, id],
        )?;
        Ok(())
    }

    /// Photos to upload: their weighing is on the server already.
    pub fn pending_photos(&self, limit: i64) -> Vec<Weighing> {
        self.rows(
            "SELECT * FROM wb_weights WHERE photo_path IS NOT NULL AND photo_synced = 0
             AND synced = 1 AND photo_error IS NULL ORDER BY voucher_date LIMIT ?",
            limit,
        )
    }

    pub fn mark_photo_synced(&self, id: &str, error: Option<&str>) -> Res<()> {
        match error {
            Some(e) => self.db.execute("UPDATE wb_weights SET photo_error = ? WHERE id = ?", params![clip(e, 300), id])?,
            None => self.db.execute("UPDATE wb_weights SET photo_synced = 1, photo_error = NULL WHERE id = ?", [id])?,
        };
        Ok(())
    }

    pub fn mark_printed(&self, id: &str) -> Res<()> {
        self.db.execute("UPDATE wb_weights SET printed = printed + 1 WHERE id = ?", [id])?;
        Ok(())
    }

    // ── tare weights ─────────────────────────────────────────────────────────
    pub fn save_tare(&self, vehicle_number: &str, wheel_type: &str, tare_weight: f64, branch_code: &str, user_id: &str, now: Option<NaiveDateTime>) -> Res<Tare> {
        let vehicle = normalize_vehicle(vehicle_number);
        if vehicle.is_empty() {
            return Err(AppError::validation("Enter the vehicle number"));
        }
        if !tare_weight.is_finite() || tare_weight <= 0.0 {
            return Err(AppError::validation("Tare weight must be more than 0"));
        }
        let id = uuid();
        {
            let tx = self.db.unchecked_transaction()?;
            let me = &*self;
            let result = (|| -> Res<()> {
                me.check_wheel_type(&vehicle, wheel_type)?;
                let wt = if wheel_type.is_empty() { me.wheel_type_of(&vehicle) } else { wheel_type.to_string() };
                let voucher = me.next_voucher("WT")?;
                let date = local_stamp(now.unwrap_or_else(|| Local::now().naive_local()));
                me.db.execute(
                    "INSERT INTO wb_vehicles (id, voucher_number, voucher_date, vehicle_number, wheel_type, tare_weight,
                        branch_code, user_id, origin, synced)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'local', 0)",
                    params![id, voucher, date, vehicle, wt, tare_weight, branch_code, user_id],
                )?;
                Ok(())
            })();
            result?;
            tx.commit()?;
        }
        self.db
            .query_row("SELECT * FROM wb_vehicles WHERE id = ?", [&id], Tare::from_row)
            .map_err(AppError::from)
    }

    pub fn tares(&self, limit: i64) -> Vec<Tare> {
        self.db
            .prepare("SELECT * FROM wb_vehicles ORDER BY voucher_date DESC LIMIT ?")
            .and_then(|mut st| st.query_map([limit], Tare::from_row).map(|it| it.filter_map(Result::ok).collect()))
            .unwrap_or_default()
    }

    // ── report ───────────────────────────────────────────────────────────────
    pub fn report(&self, from: &str, to: &str) -> Report {
        let rows: Vec<Weighing> = self
            .db
            .prepare("SELECT * FROM wb_weights WHERE voucher_date >= ? AND voucher_date < ? ORDER BY voucher_date")
            .and_then(|mut st| st.query_map(params![from, to], Weighing::from_row).map(|it| it.filter_map(Result::ok).collect()))
            .unwrap_or_default();
        let total = rows.iter().map(|r| r.amount).sum();
        let last_voucher = rows.last().map(|r| r.voucher_number.clone()).unwrap_or_default();
        Report { count: rows.len(), total, last_voucher, rows }
    }

    // ── engage events ────────────────────────────────────────────────────────
    pub fn add_engage(&self, weight: f64, branch_code: &str, at: Option<NaiveDateTime>) -> Res<()> {
        self.db.execute(
            "INSERT INTO wb_engage (id, date_time, weight, branch_code, synced) VALUES (?, ?, ?, ?, 0)",
            params![uuid(), local_stamp(at.unwrap_or_else(|| Local::now().naive_local())), weight.round() as i64, branch_code],
        )?;
        Ok(())
    }

    // ── sync bookkeeping ─────────────────────────────────────────────────────
    fn rows(&self, sql: &str, limit: i64) -> Vec<Weighing> {
        self.db
            .prepare(sql)
            .and_then(|mut st| st.query_map([limit], Weighing::from_row).map(|it| it.filter_map(Result::ok).collect()))
            .unwrap_or_default()
    }

    pub fn pending_weights(&self, limit: i64) -> Vec<Weighing> {
        self.rows("SELECT * FROM wb_weights WHERE synced = 0 ORDER BY voucher_date LIMIT ?", limit)
    }

    pub fn pending_tares(&self, limit: i64) -> Vec<Tare> {
        self.db
            .prepare("SELECT * FROM wb_vehicles WHERE synced = 0 ORDER BY voucher_date LIMIT ?")
            .and_then(|mut st| st.query_map([limit], Tare::from_row).map(|it| it.filter_map(Result::ok).collect()))
            .unwrap_or_default()
    }

    pub fn pending_engage(&self, limit: i64) -> Vec<Engage> {
        self.db
            .prepare("SELECT id, date_time, weight, branch_code FROM wb_engage WHERE synced = 0 ORDER BY date_time LIMIT ?")
            .and_then(|mut st| {
                st.query_map([limit], |r| {
                    Ok(Engage {
                        id: r.get(0)?,
                        date_time: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                        weight: r.get::<_, Option<i64>>(2)?.unwrap_or(0),
                        branch_code: r.get::<_, Option<String>>(3)?.unwrap_or_default(),
                    })
                })
                .map(|it| it.filter_map(Result::ok).collect())
            })
            .unwrap_or_default()
    }

    pub fn pending_count(&self) -> Pending {
        let q = |sql: &str| -> i64 { self.db.query_row(sql, [], |r| r.get(0)).unwrap_or(0) };
        Pending {
            weights: q("SELECT COUNT(*) FROM wb_weights WHERE synced = 0"),
            tares: q("SELECT COUNT(*) FROM wb_vehicles WHERE synced = 0"),
            engage: q("SELECT COUNT(*) FROM wb_engage WHERE synced = 0"),
            photos: q("SELECT COUNT(*) FROM wb_weights WHERE photo_path IS NOT NULL AND photo_synced = 0 AND photo_error IS NULL"),
        }
    }

    /// table: weights | tares | engage
    pub fn mark_synced(&self, table: &str, id: &str, error: Option<&str>) -> Res<()> {
        let t = match table {
            "weights" => "wb_weights",
            "tares" => "wb_vehicles",
            "engage" => "wb_engage",
            _ => return Err(AppError::other(format!("unknown table {table}"))),
        };
        match error {
            Some(e) if t != "wb_engage" => {
                self.db.execute(&format!("UPDATE {t} SET sync_error = ? WHERE id = ?"), params![clip(e, 300), id])?;
            }
            Some(_) => {}
            None => {
                let extra = if t != "wb_engage" { ", sync_error = NULL" } else { "" };
                self.db.execute(&format!("UPDATE {t} SET synced = 1{extra} WHERE id = ?"), [id])?;
            }
        }
        Ok(())
    }

    /// A resync request from the back office: put that day's weighings back in the outbox.
    pub fn requeue_date(&self, date: &str) -> Res<usize> {
        let day: String = date.chars().take(10).collect();
        let a = self.db.execute("UPDATE wb_weights SET synced = 0 WHERE origin = 'local' AND substr(voucher_date, 1, 10) = ?", [&day])?;
        let b = self.db.execute("UPDATE wb_vehicles SET synced = 0 WHERE origin = 'local' AND substr(voucher_date, 1, 10) = ?", [&day])?;
        Ok(a + b)
    }

    /// First run on a PC: bring in the branch's recent weighings (made by the Qt app or another PC)
    /// so open first weighings and vehicle history are there. Rows this PC saved win.
    /// Returns (weighings added, tares added).
    pub fn import_from_server(&mut self, weights: &[Value], tares: &[Value]) -> Res<(usize, usize)> {
        let tx = self.db.transaction()?;
        let mut w = 0;
        for s in weights {
            let id = { let d = vstr(s, "ddId"); if d.is_empty() { vstr(s, "id") } else { d } };
            let vehicle = vstr(s, "vehicleNumber");
            if id.is_empty() || vehicle.is_empty() {
                continue;
            }
            w += tx.execute(
                "INSERT OR IGNORE INTO wb_weights (id, voucher_number, voucher_date, vehicle_number,
                    wheel_type, material, mobile_number, lcd_number, first_weight, first_weight_date, amount, round_trip,
                    branch_code, origin, synced)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'server', 1)",
                params![
                    id,
                    vstr(s, "voucherNumber"),
                    from_server_date(&vstr(s, "voucherDate")).unwrap_or_default(),
                    normalize_vehicle(&vehicle),
                    vstr(s, "wheelType"),
                    vstr(s, "material"),
                    vstr(s, "mobileNumber"),
                    vnum(s, "lcdNumber"),
                    vnum(s, "firstWeight"),
                    from_server_date(&vstr(s, "firstWeightDate")),
                    vnum(s, "amount"),
                    if vnum(s, "roundTrip") == 1.0 { 1 } else { 0 },
                    vstr(s, "branchCode"),
                ],
            )?;
        }
        // The server keys tares by its own id, so match on voucher + vehicle + branch to skip ones this PC sent.
        let mut t = 0;
        for s in tares {
            let sid = vstr(s, "id");
            let vehicle = vstr(s, "vehicleNumber");
            if sid.is_empty() || vehicle.is_empty() {
                continue;
            }
            let voucher = vstr(s, "voucherNumber");
            let vehicle = normalize_vehicle(&vehicle);
            let branch = vstr(s, "branchCode");
            t += tx.execute(
                "INSERT OR IGNORE INTO wb_vehicles (id, voucher_number, voucher_date, vehicle_number,
                    wheel_type, tare_weight, branch_code, origin, synced)
                 SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'server', 1
                 WHERE NOT EXISTS (SELECT 1 FROM wb_vehicles WHERE voucher_number = ?2
                   AND vehicle_number = ?4 AND branch_code = ?7 AND ?2 <> '')",
                params![
                    format!("srv-{sid}"),
                    voucher,
                    from_server_date(&vstr(s, "voucherDate")).unwrap_or_default(),
                    vehicle,
                    vstr(s, "wheelType"),
                    vnum(s, "tareWeight"),
                    branch
                ],
            )?;
        }
        tx.commit()?;
        Ok((w, t))
    }

    /// Weighings the web admin reopened (Weighbridge Entry > Reopen): open again here, so the
    /// vehicle's next weighing pairs with it as a free return, and the vehicle's other open ones
    /// close, as on the server. A vehicle with a weighing still waiting to upload is skipped: the
    /// server reopened without knowing it, and that upload closes the reopened one there too.
    pub fn apply_reopened(&mut self, rows: &[Value]) -> Res<usize> {
        let mut n = 0;
        for s in rows {
            let id = { let d = vstr(s, "ddId"); if d.is_empty() { vstr(s, "id") } else { d } };
            let vehicle = normalize_vehicle(&vstr(s, "vehicleNumber"));
            if id.is_empty() || vehicle.is_empty() {
                continue;
            }
            let pending: bool = self
                .db
                .query_row("SELECT 1 FROM wb_weights WHERE vehicle_number = ? AND synced = 0 LIMIT 1", [&vehicle], |_| Ok(true))
                .optional()?
                .unwrap_or(false);
            if pending {
                continue;
            }
            let before: Option<i64> = self.db.query_row("SELECT round_trip FROM wb_weights WHERE id = ?", [&id], |r| r.get(0)).optional()?;
            let mut open = s.clone();
            open["roundTrip"] = Value::from(0);
            self.import_from_server(&[open], &[])?; // older than this PC's history: bring it in
            self.db.execute("UPDATE wb_weights SET round_trip = 1 WHERE vehicle_number = ? AND id <> ? AND round_trip = 0", params![vehicle, id])?;
            self.db.execute("UPDATE wb_weights SET round_trip = 0 WHERE id = ?", [&id])?;
            if before != Some(0) {
                n += 1;
            }
        }
        Ok(n)
    }
}

fn clip(s: &str, n: usize) -> String {
    s.chars().take(n).collect()
}

pub fn vstr(v: &Value, k: &str) -> String {
    match v.get(k) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        _ => String::new(),
    }
}

pub fn vnum(v: &Value, k: &str) -> f64 {
    match v.get(k) {
        Some(Value::Number(n)) => n.as_f64().unwrap_or(0.0),
        Some(Value::String(s)) => s.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    struct T {
        s: Store,
        clock: NaiveDateTime,
    }

    impl T {
        fn new() -> T {
            let mut s = Store::memory();
            s.replace_rates(&[
                json!({ "id": "r1", "wheelType": "6 WHEEL", "wheelRate": 80, "voucherDate": "2026-01-01T00:00:00.000+00:00" }),
                json!({ "id": "r2", "wheelType": "6 WHEEL", "wheelRate": 100, "voucherDate": "2026-06-01T00:00:00.000+00:00" }),
                json!({ "id": "r3", "wheelType": "10 WHEEL", "wheelRate": 150, "voucherDate": "2026-06-01T00:00:00.000+00:00" }),
                json!({ "id": "r4", "wheelType": "10 WHEEL", "wheelRate": 0, "voucherDate": "2026-09-01T00:00:00.000+00:00" }),
            ])
            .unwrap();
            T { s, clock: NaiveDate::from_ymd_opt(2026, 9, 30).unwrap().and_hms_opt(8, 0, 0).unwrap() }
        }

        fn tick(&mut self) -> NaiveDateTime {
            self.clock += chrono::Duration::minutes(1);
            self.clock
        }

        fn weigh_with(&mut self, f: impl FnOnce(&mut NewWeighing)) -> Res<Weighing> {
            let mut n = NewWeighing {
                vehicle_number: "KL07AB1234".into(),
                wheel_type: "6 WHEEL".into(),
                weight: 12000.0,
                branch_code: "WB1".into(),
                user_id: "op".into(),
                now: Some(self.tick()),
                ..Default::default()
            };
            f(&mut n);
            self.s.save_weighing(n)
        }

        fn weigh(&mut self) -> Weighing {
            self.weigh_with(|_| {}).unwrap()
        }
    }

    #[test]
    fn newest_positive_rate_wins() {
        let t = T::new();
        assert_eq!(charge::rate_for(&t.s.all_rates(), "6 WHEEL"), 100.0);
        assert_eq!(charge::rate_for(&t.s.all_rates(), "10 WHEEL"), 150.0, "a newer 0 rate is ignored");
        assert_eq!(t.s.rates().iter().map(|r| r.1).collect::<Vec<_>>(), vec![150.0, 100.0]);
    }

    #[test]
    fn first_charged_return_free_second_return_charged() {
        let mut t = T::new();
        let first = t.weigh_with(|n| n.weight = 5000.0).unwrap();
        assert_eq!((first.amount, first.round_trip, first.voucher_number.as_str()), (100.0, 0, "000001"));
        let back = t.weigh_with(|n| { n.weight = 17000.0; n.source = Pick::Previous(first.id.clone()) }).unwrap();
        assert_eq!((back.amount, back.round_trip, back.first_weight), (0.0, 1, 5000.0));
        assert_eq!(t.s.get_weighing(&first.id).unwrap().round_trip, 1, "return closes the first weighing");
        let again = t.weigh_with(|n| { n.weight = 17100.0; n.source = Pick::Previous(first.id.clone()) }).unwrap();
        assert_eq!(again.amount, 100.0, "the first weighing was already used");
    }

    #[test]
    fn a_new_first_weighing_closes_older_open_ones() {
        let mut t = T::new();
        let a = t.weigh();
        let b = t.weigh();
        assert_eq!(t.s.get_weighing(&a.id).unwrap().round_trip, 1);
        assert_eq!(t.s.get_weighing(&b.id).unwrap().round_trip, 0, "only the newest stays open");
        assert_eq!(t.weigh_with(|n| n.source = Pick::Previous(a.id.clone())).unwrap().amount, 100.0);
    }

    #[test]
    fn tare_charged_in_full_and_round_trip() {
        let mut t = T::new();
        let now = t.tick();
        let tare = t.s.save_tare("kl 07 ab 1234", "", 6500.0, "WB1", "", Some(now)).unwrap();
        assert_eq!(tare.vehicle_number, "KL07AB1234");
        assert_eq!(tare.voucher_number, "000001", "WT has its own series");
        let w = t.weigh_with(|n| { n.weight = 20000.0; n.source = Pick::Tare(tare.id.clone()) }).unwrap();
        assert_eq!((w.amount, w.first_weight, w.round_trip), (100.0, 6500.0, 1));
        assert_eq!(w.first_weight_kind.as_deref(), Some("tare"));
    }

    #[test]
    fn quote_matches_save() {
        let mut t = T::new();
        let first = t.weigh_with(|n| n.weight = 5000.0).unwrap();
        let q = t.s.quote("KL07AB1234", "6 WHEEL", &Pick::Previous(first.id), 17000.0);
        assert_eq!((q.amount, q.first_weight, q.net_weight, q.round_trip), (0.0, 5000.0, 12000.0, 1));
    }

    #[test]
    fn save_refuses_what_qt_refused() {
        let mut t = T::new();
        assert!(matches!(t.weigh_with(|n| n.weight = 0.0), Err(AppError::Validation(_))));
        assert!(matches!(t.weigh_with(|n| n.vehicle_number = " - ".into()), Err(AppError::Validation(_))));
        assert!(matches!(t.weigh_with(|n| n.wheel_type = String::new()), Err(AppError::Validation(_))));
        assert!(t.weigh_with(|n| n.wheel_type = "3 WHEEL".into()).unwrap_err().to_string().contains("No rate"));
        let other = t.weigh_with(|n| { n.vehicle_number = "TN01X1".into(); n.weight = 5000.0 }).unwrap();
        assert!(t.weigh_with(|n| n.source = Pick::Previous(other.id.clone())).unwrap_err().to_string().contains("this vehicle"));
        assert_eq!(t.s.last_voucher("WB"), 1, "refused saves don't use up a voucher number");
    }

    #[test]
    fn voucher_numbers_continue() {
        let mut t = T::new();
        t.s.ensure_series_at_least("WB", 4521).unwrap();
        t.s.ensure_series_at_least("WB", 12).unwrap();
        assert_eq!(t.weigh().voucher_number, "004522");
    }

    #[test]
    fn outbox_resync_and_import() {
        let mut t = T::new();
        let a = t.weigh();
        t.s.add_engage(800.0, "WB1", None).unwrap();
        assert_eq!(t.s.pending_count(), Pending { weights: 1, tares: 0, engage: 1, photos: 0 });
        t.s.mark_synced("weights", &a.id, None).unwrap();
        assert_eq!(t.s.pending_count().weights, 0);
        assert_eq!(t.s.requeue_date(&a.voucher_date).unwrap(), 1);

        let imported = t
            .s
            .import_from_server(
                &[
                    json!({ "ddId": a.id, "vehicleNumber": "KL07AB1234", "lcdNumber": 1 }),
                    json!({ "ddId": "qt-1", "vehicleNumber": "tn 22 z 9", "voucherNumber": "000900", "voucherDate": "2026-09-29T04:30:00.000+00:00", "lcdNumber": 7000, "amount": 100, "roundTrip": 0, "wheelType": "10 WHEEL" }),
                ],
                &[json!({ "id": 5, "vehicleNumber": "TN22Z9", "tareWeight": 6000, "voucherNumber": "000003", "branchCode": "WB1" })],
            )
            .unwrap();
        assert_eq!(imported, (1, 1));
        assert_eq!(t.s.get_weighing(&a.id).unwrap().lcd_number, 12000.0, "local row not overwritten");
        assert_eq!(t.s.wheel_type_of("TN22Z9"), "10 WHEEL");
        let again = t.s.import_from_server(&[], &[json!({ "id": 5, "vehicleNumber": "TN22Z9", "tareWeight": 6000, "voucherNumber": "000003", "branchCode": "WB1" })]).unwrap();
        assert_eq!(again, (0, 0));
        let (h, _) = t.s.history("TN22Z9", 30);
        let back = t.weigh_with(|n| { n.wheel_type = "10 WHEEL".into(); n.vehicle_number = "TN22Z9".into(); n.weight = 15000.0; n.source = Pick::Previous(h[0].id.clone()) }).unwrap();
        assert_eq!(back.amount, 0.0, "an open first weighing from the Qt app still gives a free return");
    }

    #[test]
    fn report_totals() {
        let mut t = T::new();
        t.weigh();
        t.weigh();
        let r = t.s.report("2000-01-01", "2100-01-01");
        assert_eq!((r.count, r.total, r.last_voucher.as_str()), (2, 200.0, "000002"));
    }

    #[test]
    fn vehicle_numbers_normalised() {
        assert_eq!(normalize_vehicle(" kl-07 ab 1234 "), "KL07AB1234");
    }

    #[test]
    fn saved_wheel_type_is_locked() {
        let mut t = T::new();
        t.weigh();
        assert_eq!(t.s.wheel_type_of("kl07 ab1234"), "6 WHEEL");
        let e = t.weigh_with(|n| n.wheel_type = "10 WHEEL".into()).unwrap_err();
        assert!(matches!(e, AppError::Validation(_)));
        assert!(e.to_string().contains("saved as 6 WHEEL") && e.to_string().contains("web admin"));
        assert!(t.s.save_tare("KL07AB1234", "10 WHEEL", 7000.0, "", "", None).is_err());
        assert_eq!(t.weigh().wheel_type, "6 WHEEL");
    }

    #[test]
    fn web_admin_wheel_type_overrides_history() {
        let mut t = T::new();
        t.weigh();
        t.s.remember_wheel_type("KL07AB1234", "10 WHEEL", "2026-10-01 05:00:00", true).unwrap();
        assert_eq!(t.s.wheel_type_of("KL07AB1234"), "10 WHEEL");
        assert!(t.weigh_with(|_| {}).is_err());
        assert_eq!(t.weigh_with(|n| n.wheel_type = "10 WHEEL".into()).unwrap().amount, 150.0);
        t.s.remember_wheel_type("KL07AB1234", "6 WHEEL", "2026-10-01 06:00:00", false).unwrap();
        assert_eq!(t.s.wheel_type_of("KL07AB1234"), "10 WHEEL", "server history never replaces a web admin setting");
    }

    #[test]
    fn tare_or_server_history_fixes_wheel_type() {
        let mut t = T::new();
        let now = t.tick();
        t.s.save_tare("TN22Z9", "10 WHEEL", 7000.0, "", "", Some(now)).unwrap();
        assert!(t.weigh_with(|n| n.vehicle_number = "TN22Z9".into()).is_err());
        assert_eq!(t.weigh_with(|n| { n.vehicle_number = "TN22Z9".into(); n.wheel_type = "10 WHEEL".into() }).unwrap().amount, 150.0);
        assert_eq!(t.s.wheel_type_of("KA01X1"), "");
        t.s.remember_wheel_type("KA01X1", "6 WHEEL", "2026-09-01 10:00:00", false).unwrap();
        assert!(t.weigh_with(|n| { n.vehicle_number = "KA01X1".into(); n.wheel_type = "10 WHEEL".into() }).is_err());
    }

    #[test]
    fn reopened_weighing_gives_free_return_again() {
        let mut t = T::new();
        let first = t.weigh_with(|n| n.weight = 5000.0).unwrap();
        let back = t.weigh_with(|n| n.source = Pick::Previous(first.id.clone())).unwrap();
        assert_eq!(back.amount, 0.0);
        t.s.mark_synced("weights", &first.id, None).unwrap();
        assert_eq!(t.s.apply_reopened(&[json!({ "ddId": first.id, "vehicleNumber": "KL07AB1234" })]).unwrap(), 0, "skipped while the return waits");
        t.s.mark_synced("weights", &back.id, None).unwrap();
        assert_eq!(t.s.apply_reopened(&[json!({ "ddId": first.id, "id": "srv-1", "vehicleNumber": "kl 07 ab 1234" })]).unwrap(), 1);
        assert_eq!(t.s.get_weighing(&first.id).unwrap().round_trip, 0);
        assert_eq!(t.s.apply_reopened(&[json!({ "ddId": first.id, "vehicleNumber": "KL07AB1234" })]).unwrap(), 0, "already open");
        let again = t.weigh_with(|n| n.source = Pick::Previous(first.id.clone())).unwrap();
        assert_eq!(again.amount, 0.0);

        let fresh2 = t.weigh_with(|n| { n.vehicle_number = "TN22Z9".into(); n.weight = 7000.0 }).unwrap();
        t.s.mark_synced("weights", &fresh2.id, None).unwrap();
        let n = t.s.apply_reopened(&[json!({ "ddId": "qt-old", "vehicleNumber": "TN22Z9", "voucherNumber": "000100", "voucherDate": "2026-08-01T04:30:00.000+00:00", "lcdNumber": 6000, "roundTrip": 0 })]).unwrap();
        assert_eq!(n, 1);
        assert_eq!(t.s.get_weighing("qt-old").unwrap().round_trip, 0);
        assert_eq!(t.s.get_weighing(&fresh2.id).unwrap().round_trip, 1);
    }

    #[test]
    fn settings_round_trip_as_json() {
        let s = Store::memory();
        s.set_setting("print", &json!({ "copies": 2, "header": ["A"] })).unwrap();
        assert_eq!(s.get_setting("print").unwrap()["copies"], 2);
        assert!(s.get_setting("missing").is_none());
    }

    #[test]
    fn server_dates() {
        assert_eq!(from_server_date("2026-10-01 05:00:00").unwrap(), "2026-10-01 05:00:00");
        assert_eq!(from_server_date("2026-10-01T05:00:00.123456").unwrap(), "2026-10-01 05:00:00");
        assert!(from_server_date("").is_none());
        let utc = from_server_date("2026-09-29T04:30:00.000+00:00").unwrap();
        assert_eq!(utc.len(), 19);
    }
}
