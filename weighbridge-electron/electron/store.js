// Local database for one weighbridge PC. Every weighing is saved and numbered here first,
// so the bridge keeps working when the internet or the server is down; sync.js uploads it.
// Column names follow the Qt app's local tables (wb_weights, wb_vehicles, wb_rates,
// voucher_series) so the data reads the same to anyone who knows the old system.

const Database = require("better-sqlite3");
const crypto = require("crypto");
const { rateFor, currentRates, quote, roundTripFor, netWeight } = require("./charge");

const SCHEMA = `
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

-- Wheel types the server knows for vehicles this PC has not weighed yet (other branches, older trips).
CREATE TABLE IF NOT EXISTS wb_vehicle_wheel (
  vehicle_number TEXT PRIMARY KEY,
  wheel_type TEXT,
  voucher_date TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`;

const pad2 = (n) => String(n).padStart(2, "0");

// Local wall-clock time as "yyyy-MM-dd HH:mm:ss", the format the Qt app and the server use.
function localStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// Server dates come back as ISO strings with an offset; store them as local wall-clock time.
function fromServerDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : localStamp(d);
}

// "kl 07-ab 1234" → "KL07AB1234": the Qt screen only allowed letters and digits.
function normalizeVehicle(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

class ValidationError extends Error {}

class Store {
  constructor(file) {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL"); // a voucher that printed must survive a power cut
    this.db.exec(SCHEMA);
  }

  close() { this.db.close(); }

  // ── settings ─────────────────────────────────────────────────────────────
  getSetting(key, fallback = null) {
    const row = this.db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    if (!row) return fallback;
    try { return JSON.parse(row.value); } catch (_) { return fallback; }
  }

  setSetting(key, value) {
    this.db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, JSON.stringify(value));
  }

  // ── voucher numbers ─────────────────────────────────────────────────────
  // Same as Qt's VoucherSystem::getNextVoucher: a per-type counter, 6 digits zero-padded.
  nextVoucher(type) {
    const row = this.db.prepare("SELECT last_number FROM voucher_series WHERE voucher_type = ?").get(type);
    const next = (row ? row.last_number : 0) + 1;
    this.db.prepare("INSERT INTO voucher_series (voucher_type, last_number) VALUES (?, ?) ON CONFLICT(voucher_type) DO UPDATE SET last_number = excluded.last_number")
      .run(type, next);
    return String(next).padStart(6, "0");
  }

  // So a new PC carries on the branch's numbering instead of starting at 000001.
  ensureSeriesAtLeast(type, n) {
    const num = Math.floor(Number(n) || 0);
    if (num <= 0) return;
    this.db.prepare(`INSERT INTO voucher_series (voucher_type, last_number) VALUES (?, ?)
      ON CONFLICT(voucher_type) DO UPDATE SET last_number = MAX(last_number, excluded.last_number)`).run(type, num);
  }

  lastVoucher(type) {
    const row = this.db.prepare("SELECT last_number FROM voucher_series WHERE voucher_type = ?").get(type);
    return row ? row.last_number : 0;
  }

  // ── rates ────────────────────────────────────────────────────────────────
  allRates() {
    return this.db.prepare("SELECT id, wheel_type AS wheelType, wheel_rate AS wheelRate, voucher_date AS voucherDate FROM wb_rates").all();
  }

  rates() { return currentRates(this.allRates()); }

  replaceRates(list) {
    const tx = this.db.transaction((rows) => {
      this.db.prepare("DELETE FROM wb_rates").run();
      const ins = this.db.prepare("INSERT INTO wb_rates (id, wheel_type, wheel_rate, voucher_date) VALUES (?, ?, ?, ?)");
      for (const r of rows) {
        if (!r || !r.wheelType) continue;
        ins.run(String(r.id || crypto.randomUUID()), r.wheelType, Number(r.wheelRate) || 0, fromServerDate(r.voucherDate) || "");
      }
    });
    tx(list || []);
  }

  // ── lookups for the weighing screen ─────────────────────────────────────
  vehicles(prefix = "", limit = 20) {
    const p = normalizeVehicle(prefix);
    return this.db.prepare(`
      SELECT vehicle_number AS vehicleNumber,
             (SELECT w2.wheel_type FROM wb_weights w2 WHERE w2.vehicle_number = w.vehicle_number AND w2.wheel_type <> ''
               ORDER BY w2.voucher_date DESC LIMIT 1) AS wheelType,
             MAX(voucher_date) AS lastDate
      FROM wb_weights w WHERE vehicle_number LIKE ? GROUP BY vehicle_number ORDER BY lastDate DESC LIMIT ?`).all(p + "%", limit);
  }

  materials(prefix = "", limit = 20) {
    return this.db.prepare(`SELECT material FROM wb_weights WHERE material <> '' AND material LIKE ?
      GROUP BY material ORDER BY MAX(voucher_date) DESC LIMIT ?`).all(String(prefix || "") + "%", limit).map((r) => r.material);
  }

  // The wheel type a vehicle is saved with: its newest weighing or tare here, else what the
  // server reported. Once a vehicle has one, the operator can't pick another (see checkWheelType).
  wheelTypeOf(vehicle) {
    const v = normalizeVehicle(vehicle);
    if (!v) return "";
    const row = this.db.prepare(`SELECT wheel_type FROM (
        SELECT wheel_type, voucher_date FROM wb_weights WHERE vehicle_number = ? AND COALESCE(wheel_type, '') <> ''
        UNION ALL
        SELECT wheel_type, voucher_date FROM wb_vehicles WHERE vehicle_number = ? AND COALESCE(wheel_type, '') <> ''
      ) ORDER BY voucher_date DESC LIMIT 1`).get(v, v);
    if (row) return row.wheel_type;
    const known = this.db.prepare("SELECT wheel_type FROM wb_vehicle_wheel WHERE vehicle_number = ?").get(v);
    return known ? known.wheel_type : "";
  }

  rememberWheelType(vehicle, wheelType, voucherDate) {
    const v = normalizeVehicle(vehicle);
    if (!v || !wheelType) return;
    this.db.prepare(`INSERT INTO wb_vehicle_wheel (vehicle_number, wheel_type, voucher_date) VALUES (?, ?, ?)
      ON CONFLICT(vehicle_number) DO UPDATE SET wheel_type = excluded.wheel_type, voucher_date = excluded.voucher_date`)
      .run(v, String(wheelType), voucherDate || "");
  }

  // Throws unless wheelType matches the vehicle's saved one. allowChange is for admins.
  checkWheelType(vehicle, wheelType, allowChange) {
    const saved = this.wheelTypeOf(vehicle);
    if (saved && wheelType && saved !== wheelType && !allowChange) {
      throw new ValidationError(`${normalizeVehicle(vehicle)} is saved as ${saved}. Only an admin can change its wheel type.`);
    }
    return saved;
  }

  // Previous weighings (newest first) and saved tares for one vehicle.
  history(vehicle, limit = 30) {
    const v = normalizeVehicle(vehicle);
    const weights = this.db.prepare(`SELECT id, voucher_number AS voucherNumber, voucher_date AS voucherDate,
        lcd_number AS weight, first_weight AS firstWeight, amount, round_trip AS roundTrip, wheel_type AS wheelType,
        material
      FROM wb_weights WHERE vehicle_number = ? ORDER BY voucher_date DESC LIMIT ?`).all(v, limit);
    const tares = this.db.prepare(`SELECT id, voucher_number AS voucherNumber, voucher_date AS voucherDate,
        tare_weight AS tareWeight, wheel_type AS wheelType
      FROM wb_vehicles WHERE vehicle_number = ? ORDER BY voucher_date DESC LIMIT ?`).all(v, limit);
    return { weights, tares };
  }

  // The first weight a new weighing pairs with. Returns { kind, id, weight, date, roundTrip } or none.
  _source(source, vehicle) {
    const kind = source?.kind || "none";
    if (kind === "previous") {
      const r = this.db.prepare("SELECT id, lcd_number, voucher_date, round_trip, vehicle_number FROM wb_weights WHERE id = ?").get(source.id);
      if (!r || r.vehicle_number !== vehicle) throw new ValidationError("Pick a previous weighing of this vehicle");
      return { kind, id: r.id, weight: r.lcd_number, date: r.voucher_date, roundTrip: r.round_trip };
    }
    if (kind === "tare") {
      const r = this.db.prepare("SELECT id, tare_weight, voucher_date, vehicle_number FROM wb_vehicles WHERE id = ?").get(source.id);
      if (!r || r.vehicle_number !== vehicle) throw new ValidationError("Pick a saved tare weight of this vehicle");
      return { kind, id: r.id, weight: r.tare_weight, date: r.voucher_date };
    }
    return { kind: "none" };
  }

  // What the screen shows before saving. Same code path as the save, so they can't disagree.
  quote({ vehicleNumber, wheelType, source, weight }) {
    const vehicle = normalizeVehicle(vehicleNumber);
    let src = { kind: "none" };
    try { src = this._source(source, vehicle); } catch (_) { /* nothing picked yet */ }
    const rate = rateFor(this.allRates(), wheelType);
    const q = quote(rate, src);
    return {
      rate,
      amount: q.amount,
      reason: q.reason,
      firstWeight: src.weight || 0,
      firstWeightDate: src.date || "",
      netWeight: netWeight(weight, src.weight),
      roundTrip: roundTripFor(src),
    };
  }

  // Saves one weighing and returns the stored row. weight comes from the live indicator,
  // never from the screen. Throws ValidationError for anything the operator must fix.
  saveWeighing({ vehicleNumber, wheelType, material, mobileNumber, weight, source, branchCode, userId, now, allowWheelChange }) {
    const vehicle = normalizeVehicle(vehicleNumber);
    if (!vehicle) throw new ValidationError("Enter the vehicle number");
    if (!wheelType) throw new ValidationError("Select the wheel type");
    const w = Number(weight);
    if (!Number.isFinite(w) || w === 0) throw new ValidationError("No weight on the bridge");
    const mobile = String(mobileNumber || "").replace(/\D/g, "").slice(-15);

    const tx = this.db.transaction(() => {
      this.checkWheelType(vehicle, wheelType, allowWheelChange);
      const src = this._source(source, vehicle);
      const rate = rateFor(this.allRates(), wheelType);
      if (!(rate > 0)) throw new ValidationError(`No rate set for wheel type ${wheelType}`);
      const { amount } = quote(rate, src);
      const roundTrip = roundTripFor(src);
      const id = crypto.randomUUID();
      const row = {
        id,
        voucher_number: this.nextVoucher("WB"),
        voucher_date: localStamp(now || new Date()),
        vehicle_number: vehicle,
        wheel_type: wheelType,
        material: String(material || "").trim().slice(0, 50),
        mobile_number: mobile,
        lcd_number: w,
        first_weight: src.weight || 0,
        first_weight_date: src.date || null,
        first_weight_id: src.id || null,
        first_weight_kind: src.kind,
        amount,
        round_trip: roundTrip,
        branch_code: branchCode || "",
        user_id: userId || "",
      };
      this.db.prepare(`INSERT INTO wb_weights (id, voucher_number, voucher_date, vehicle_number, wheel_type, material,
          mobile_number, lcd_number, first_weight, first_weight_date, first_weight_id, first_weight_kind, amount,
          round_trip, branch_code, user_id, origin, synced)
        VALUES (@id, @voucher_number, @voucher_date, @vehicle_number, @wheel_type, @material, @mobile_number,
          @lcd_number, @first_weight, @first_weight_date, @first_weight_id, @first_weight_kind, @amount,
          @round_trip, @branch_code, @user_id, 'local', 0)`).run(row);

      // Qt's updateRoundTrip: a vehicle keeps at most one open weighing, and it is the
      // newest first weighing. A return weighing closes it; a new first weighing closes the rest.
      if (roundTrip === 1) {
        this.db.prepare("UPDATE wb_weights SET round_trip = 1 WHERE vehicle_number = ? AND id <> ? AND round_trip = 0").run(vehicle, id);
      } else {
        this.db.prepare("UPDATE wb_weights SET round_trip = 1 WHERE vehicle_number = ? AND id <> ?").run(vehicle, id);
      }
      return row;
    });
    return this.getWeighing(tx().id);
  }

  getWeighing(id) {
    return this.db.prepare("SELECT * FROM wb_weights WHERE id = ?").get(id) || null;
  }

  getWeighingByVoucher(voucherNumber) {
    return this.db.prepare("SELECT * FROM wb_weights WHERE voucher_number = ? ORDER BY voucher_date DESC LIMIT 1").get(voucherNumber) || null;
  }

  markPrinted(id) {
    this.db.prepare("UPDATE wb_weights SET printed = printed + 1 WHERE id = ?").run(id);
  }

  // ── tare weights ─────────────────────────────────────────────────────────
  saveTare({ vehicleNumber, wheelType, tareWeight, branchCode, userId, now, allowWheelChange }) {
    const vehicle = normalizeVehicle(vehicleNumber);
    const t = Number(tareWeight);
    if (!vehicle) throw new ValidationError("Enter the vehicle number");
    if (!Number.isFinite(t) || t <= 0) throw new ValidationError("Tare weight must be more than 0");
    const tx = this.db.transaction(() => {
      this.checkWheelType(vehicle, wheelType, allowWheelChange);
      const row = {
        id: crypto.randomUUID(),
        voucher_number: this.nextVoucher("WT"),
        voucher_date: localStamp(now || new Date()),
        vehicle_number: vehicle,
        wheel_type: wheelType || this.wheelTypeOf(vehicle) || "",
        tare_weight: t,
        branch_code: branchCode || "",
        user_id: userId || "",
      };
      this.db.prepare(`INSERT INTO wb_vehicles (id, voucher_number, voucher_date, vehicle_number, wheel_type, tare_weight,
          branch_code, user_id, origin, synced)
        VALUES (@id, @voucher_number, @voucher_date, @vehicle_number, @wheel_type, @tare_weight, @branch_code, @user_id, 'local', 0)`).run(row);
      return row;
    });
    return tx();
  }

  tares(limit = 500) {
    return this.db.prepare(`SELECT id, voucher_number AS voucherNumber, voucher_date AS voucherDate, vehicle_number AS vehicleNumber,
        wheel_type AS wheelType, tare_weight AS tareWeight, synced FROM wb_vehicles ORDER BY voucher_date DESC LIMIT ?`).all(limit);
  }

  // ── report ───────────────────────────────────────────────────────────────
  report(from, to) {
    const rows = this.db.prepare(`SELECT id, voucher_number AS voucherNumber, voucher_date AS voucherDate,
        vehicle_number AS vehicleNumber, wheel_type AS wheelType, material, mobile_number AS mobileNumber,
        lcd_number AS weight, first_weight AS firstWeight, amount, round_trip AS roundTrip, synced, printed
      FROM wb_weights WHERE voucher_date >= ? AND voucher_date < ? ORDER BY voucher_date`).all(from, to);
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return { rows, total, count: rows.length, lastVoucher: rows.length ? rows[rows.length - 1].voucherNumber : "" };
  }

  // ── engage events ────────────────────────────────────────────────────────
  addEngage({ weight, branchCode, at }) {
    this.db.prepare("INSERT INTO wb_engage (id, date_time, weight, branch_code, synced) VALUES (?, ?, ?, ?, 0)")
      .run(crypto.randomUUID(), localStamp(at ? new Date(at) : new Date()), Math.round(Number(weight) || 0), branchCode || "");
  }

  // ── sync bookkeeping ─────────────────────────────────────────────────────
  pendingWeights(limit = 50) {
    return this.db.prepare("SELECT * FROM wb_weights WHERE synced = 0 ORDER BY voucher_date LIMIT ?").all(limit);
  }

  pendingTares(limit = 50) {
    return this.db.prepare("SELECT * FROM wb_vehicles WHERE synced = 0 ORDER BY voucher_date LIMIT ?").all(limit);
  }

  pendingEngage(limit = 100) {
    return this.db.prepare("SELECT * FROM wb_engage WHERE synced = 0 ORDER BY date_time LIMIT ?").all(limit);
  }

  pendingCount() {
    const q = (sql) => this.db.prepare(sql).get().n;
    return {
      weights: q("SELECT COUNT(*) n FROM wb_weights WHERE synced = 0"),
      tares: q("SELECT COUNT(*) n FROM wb_vehicles WHERE synced = 0"),
      engage: q("SELECT COUNT(*) n FROM wb_engage WHERE synced = 0"),
    };
  }

  markSynced(table, id, error = null) {
    const t = { weights: "wb_weights", tares: "wb_vehicles", engage: "wb_engage" }[table];
    if (!t) throw new Error("unknown table " + table);
    if (error && t !== "wb_engage") this.db.prepare(`UPDATE ${t} SET sync_error = ? WHERE id = ?`).run(String(error).slice(0, 300), id);
    else if (!error) this.db.prepare(`UPDATE ${t} SET synced = 1${t !== "wb_engage" ? ", sync_error = NULL" : ""} WHERE id = ?`).run(id);
  }

  // A resync request from the back office: put that day's weighings back in the outbox.
  requeueDate(date) {
    const day = String(date).slice(0, 10);
    const a = this.db.prepare("UPDATE wb_weights SET synced = 0 WHERE origin = 'local' AND substr(voucher_date, 1, 10) = ?").run(day).changes;
    const b = this.db.prepare("UPDATE wb_vehicles SET synced = 0 WHERE origin = 'local' AND substr(voucher_date, 1, 10) = ?").run(day).changes;
    return a + b;
  }

  // First run on a PC: bring in the branch's recent weighings (made by the Qt app or another
  // PC) so open first weighings and vehicle history are there. Rows this PC saved win.
  importFromServer({ weights = [], tares = [] }) {
    const tx = this.db.transaction(() => {
      const insW = this.db.prepare(`INSERT OR IGNORE INTO wb_weights (id, voucher_number, voucher_date, vehicle_number,
          wheel_type, material, mobile_number, lcd_number, first_weight, first_weight_date, amount, round_trip,
          branch_code, origin, synced)
        VALUES (@id, @voucher_number, @voucher_date, @vehicle_number, @wheel_type, @material, @mobile_number,
          @lcd_number, @first_weight, @first_weight_date, @amount, @round_trip, @branch_code, 'server', 1)`);
      let w = 0;
      for (const s of weights) {
        const id = s.ddId || s.id;
        if (!id || !s.vehicleNumber) continue;
        w += insW.run({
          id: String(id),
          voucher_number: s.voucherNumber || "",
          voucher_date: fromServerDate(s.voucherDate) || "",
          vehicle_number: normalizeVehicle(s.vehicleNumber),
          wheel_type: s.wheelType || "",
          material: s.material || "",
          mobile_number: s.mobileNumber || "",
          lcd_number: Number(s.lcdNumber) || 0,
          first_weight: Number(s.firstWeight) || 0,
          first_weight_date: fromServerDate(s.firstWeightDate),
          amount: Number(s.amount) || 0,
          round_trip: Number(s.roundTrip) === 1 ? 1 : 0,
          branch_code: s.branchCode || "",
        }).changes;
      }
      // The server keys tares by its own id, so match on voucher + vehicle + branch to skip ones this PC sent.
      const insT = this.db.prepare(`INSERT OR IGNORE INTO wb_vehicles (id, voucher_number, voucher_date, vehicle_number,
          wheel_type, tare_weight, branch_code, origin, synced)
        SELECT @id, @voucher_number, @voucher_date, @vehicle_number, @wheel_type, @tare_weight, @branch_code, 'server', 1
        WHERE NOT EXISTS (SELECT 1 FROM wb_vehicles WHERE voucher_number = @voucher_number
          AND vehicle_number = @vehicle_number AND branch_code = @branch_code AND @voucher_number <> '')`);
      let t = 0;
      for (const s of tares) {
        if (!s.id || !s.vehicleNumber) continue;
        t += insT.run({
          id: "srv-" + s.id,
          voucher_number: s.voucherNumber || "",
          voucher_date: fromServerDate(s.voucherDate) || "",
          vehicle_number: normalizeVehicle(s.vehicleNumber),
          wheel_type: s.wheelType || "",
          tare_weight: Number(s.tareWeight) || 0,
          branch_code: s.branchCode || "",
        }).changes;
      }
      return { weights: w, tares: t };
    });
    return tx();
  }
}

module.exports = { Store, ValidationError, normalizeVehicle, localStamp, fromServerDate };
