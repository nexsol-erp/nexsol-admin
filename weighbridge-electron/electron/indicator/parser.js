// Turns the raw byte stream from a weighbridge indicator into weight readings.
// Pure logic, no serial port: the transport feeds bytes in, so every indicator format can
// be tested by replaying captured bytes (test/parser.test.js).
//
// Bytes are handled as latin1 text (one char per byte), which keeps binary status bytes
// (Mettler Toledo) intact and makes delimiter searches simple.

const { EventEmitter } = require("events");
const { unescapeCtl } = require("./profiles");

const MAX_BUFFER = 4096;

const UNIT_TO_KG = { kg: 1, kgs: 1, t: 1000, ton: 1000, tonne: 1000, lb: 0.45359237, lbs: 0.45359237, g: 0.001 };

// "<CR>|<LF>" → ["\r", "\n"]. "|" separates alternatives; a literal pipe is \x7C.
function endMarkers(end) {
  return String(end || "")
    .split("|")
    .map(unescapeCtl)
    .filter((e) => e.length > 0);
}

class FrameSplitter {
  constructor(frame = {}) {
    this.type = frame.type || "delimited";
    this.start = unescapeCtl(frame.start || "");
    this.ends = endMarkers(frame.end);
    this.length = Number(frame.length) || 0;
    this.buf = "";
  }

  // Returns the complete frames found so far; partial data waits for the next push.
  push(chunk) {
    this.buf += Buffer.isBuffer(chunk) ? chunk.toString("latin1") : String(chunk);
    const frames = this.type === "fixed" ? this._fixed() : this._delimited();
    if (this.buf.length > MAX_BUFFER) this.buf = this.buf.slice(-MAX_BUFFER / 4);
    return frames;
  }

  _delimited() {
    const out = [];
    const { start } = this;
    for (;;) {
      let from = 0;
      if (start) {
        const s = this.buf.indexOf(start);
        if (s < 0) {
          // Keep a possible partial start marker at the tail, drop the rest.
          this.buf = this.buf.slice(-Math.max(0, start.length - 1));
          break;
        }
        this.buf = this.buf.slice(s);
        from = start.length;
      }
      if (!this.ends.length) break;

      let pos = -1;
      let marker = "";
      for (const e of this.ends) {
        const p = this.buf.indexOf(e, from);
        if (p >= 0 && (pos < 0 || p < pos)) { pos = p; marker = e; }
      }
      if (pos < 0) break;

      let body = this.buf.slice(from, pos);
      // A start marker inside the body means the earlier frame was cut short: keep the last one.
      if (start && start !== marker) {
        const again = body.lastIndexOf(start);
        if (again >= 0) body = body.slice(again + start.length);
      }
      // When the end marker is also the next frame's start ("=" formats), leave it in place.
      this.buf = start && marker === start ? this.buf.slice(pos) : this.buf.slice(pos + marker.length);
      if (body.length) out.push(body);
    }
    return out;
  }

  _fixed() {
    const out = [];
    if (this.length <= 0) return out;
    for (;;) {
      let from = 0;
      if (this.start) {
        const s = this.buf.indexOf(this.start);
        if (s < 0) { this.buf = this.buf.slice(-Math.max(0, this.start.length - 1)); break; }
        this.buf = this.buf.slice(s);
        from = this.start.length;
      }
      if (this.buf.length < from + this.length) break;
      out.push(this.buf.slice(from, from + this.length));
      this.buf = this.buf.slice(from + this.length);
    }
    return out;
  }
}

function toNumber(text, { decimalComma, impliedDecimals }) {
  let t = String(text).replace(/\s+/g, "");
  t = decimalComma ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  let v = parseFloat(t);
  if (!t.includes(".") && impliedDecimals > 0) v = v / Math.pow(10, impliedDecimals);
  return v;
}

function testPattern(pattern, value) {
  if (!pattern || value === undefined || value === null) return false;
  try { return new RegExp(pattern).test(value); } catch (_) { return false; }
}

function decodeRegex(frame, d, profile) {
  const text = d.reverse ? Array.from(frame).reverse().join("") : frame;
  let re;
  try { re = new RegExp(d.pattern, d.flags || ""); } catch (_) { return null; }
  const m = re.exec(text);
  if (!m || !m.groups || m.groups.weight === undefined) return null;
  const g = m.groups;
  const value = toNumber(g.weight, profile);
  if (value === null) return null;
  const status = g.status !== undefined ? g.status : undefined;
  let stable = null;
  if (testPattern(d.stablePattern, status)) stable = true;
  else if (testPattern(d.motionPattern, status)) stable = false;
  const overload = testPattern(d.overloadPattern, g.over !== undefined ? g.over : status);
  return {
    value,
    negative: g.sign === "-",
    unit: g.unit ? g.unit.toLowerCase() : null,
    stable,
    overload,
  };
}

function decodeFixed(frame, d, profile) {
  const at = (i) => (i === undefined || i === null || i === "" ? null : Number(i));
  const wAt = at(d.weightAt) ?? 0;
  const wLen = at(d.weightLength) ?? frame.length - wAt;
  const digits = frame.slice(wAt, wAt + wLen).replace(/ /g, "0");
  if (!/^\d+$/.test(digits)) return null;
  let value = parseInt(digits, 10);
  const dAt = at(d.decimalsAt);
  const n = dAt !== null ? parseInt(frame.charAt(dAt), 10) : Number(profile.impliedDecimals) || 0;
  if (!Number.isNaN(n) && n > 0) value = value / Math.pow(10, n);
  const sAt = at(d.signAt);
  return { value, negative: sAt !== null && frame.charAt(sAt) === "-", unit: null, stable: null, overload: false };
}

// Mettler Toledo continuous output. Status word A bits 0-2 place the decimal point,
// status word B: bit0 net, bit1 negative, bit2 over/under range, bit3 motion, bit4 kg (1) / lb (0).
const TOLEDO_SCALE = [100, 10, 1, 0.1, 0.01, 0.001, 0.0001, 0.00001];
function decodeToledo(frame, d) {
  if (frame.length < 9) return null;
  const b = (i) => frame.charCodeAt(i) & 0x7f; // tolerate a port set to 8 bits on a 7E1 line
  const swa = b(0);
  const swb = b(1);
  const digits = Array.from(frame.slice(3, 9)).map((c) => String.fromCharCode(c.charCodeAt(0) & 0x7f)).join("").replace(/ /g, "0");
  if (!/^\d{6}$/.test(digits)) return null;
  const value = parseInt(digits, 10) * TOLEDO_SCALE[swa & 0x07];
  return {
    value: Math.round(value * 100000) / 100000,
    negative: (swb & 0x02) !== 0,
    unit: d.unitFromStatus ? ((swb & 0x10) !== 0 ? "kg" : "lb") : null,
    stable: (swb & 0x08) === 0,
    overload: (swb & 0x04) !== 0,
  };
}

// One frame → { weight (kg), negative, unit, stable (true|false|null), overload } or null.
function decodeFrame(frame, profile) {
  const d = profile.decode || {};
  let r = null;
  if (d.type === "fixed") r = decodeFixed(frame, d, profile);
  else if (d.type === "toledo") r = decodeToledo(frame, d);
  else r = decodeRegex(frame, d, profile);
  if (!r) return null;

  const value = r.value;
  const unit = r.unit || String(profile.unit || "kg").toLowerCase();
  const factor = UNIT_TO_KG[unit] ?? 1;
  let kg = value * factor * (Number(profile.multiplier) || 1);
  if (r.negative) kg = -kg;
  const step = Number(profile.resolution) || 0;
  if (step > 0) kg = Math.round(kg / step) * step;
  kg = Math.round(kg * 1000) / 1000;
  if (Object.is(kg, -0)) kg = 0;
  return { weight: kg, unit, stable: r.stable, overload: !!r.overload };
}

// Decides "stable" when the indicator doesn't say: N readings in a row within tolerance.
class Stabilizer {
  constructor(count = 3, toleranceKg = 0) {
    this.count = Math.max(1, Number(count) || 1);
    this.tol = Math.max(0, Number(toleranceKg) || 0);
    this.recent = [];
  }

  update(reading) {
    if (reading.stable === false || reading.overload) { this.recent = [reading.weight]; return false; }
    this.recent.push(reading.weight);
    if (this.recent.length > this.count) this.recent.shift();
    if (reading.stable === true) return true;
    if (this.recent.length < this.count) return false;
    return Math.max(...this.recent) - Math.min(...this.recent) <= this.tol;
  }
}

// Everything between the transport and the screen: framing, decoding, stability,
// "bridge engaged" detection and the no-signal watchdog.
// Events: reading {weight, stable, overload, unit, raw, at}, frame {raw, ok},
//         engage {weight, at}, signal {ok}
class IndicatorSession extends EventEmitter {
  constructor(profile, { now = () => Date.now() } = {}) {
    super();
    this.profile = profile;
    this.now = now;
    this.splitter = new FrameSplitter(profile.frame);
    this.stabilizer = new Stabilizer(profile.stableCount, profile.stableToleranceKg);
    this.armed = true;
    this.last = null;
    this.lastAt = 0;
    this.signal = false;
  }

  feed(chunk) {
    for (const raw of this.splitter.push(chunk)) {
      const r = decodeFrame(raw, this.profile);
      this.emit("frame", { raw, ok: !!r });
      if (!r) continue;
      const at = this.now();
      const reading = { ...r, stable: this.stabilizer.update(r), raw, at };
      this.last = reading;
      this.lastAt = at;
      if (!this.signal) { this.signal = true; this.emit("signal", { ok: true }); }
      this.emit("reading", reading);
      this._engage(reading);
    }
  }

  _engage(r) {
    const threshold = Number(this.profile.engageThresholdKg) || 0;
    const zero = Number(this.profile.zeroBandKg) || 0;
    if (threshold <= 0) return;
    if (this.armed && r.weight > threshold) {
      this.armed = false;
      this.emit("engage", { weight: r.weight, at: r.at });
    } else if (!this.armed && Math.abs(r.weight) <= zero) {
      this.armed = true;
    }
  }

  // Called on a timer; flips to "no signal" when readings stop.
  tick() {
    const limit = Number(this.profile.noSignalMs) || 3000;
    if (this.signal && this.now() - this.lastAt > limit) {
      this.signal = false;
      this.emit("signal", { ok: false });
    }
  }
}

module.exports = { FrameSplitter, decodeFrame, Stabilizer, IndicatorSession, endMarkers };
