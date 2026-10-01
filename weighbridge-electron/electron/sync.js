// Moves data between this PC's local store and the server. Runs in the main process on a
// timer, so uploads happen whatever screen is open. Nothing here blocks weighing: if the
// server is down or the login has expired, rows simply wait in the outbox.

const { EventEmitter } = require("events");

const PUSH_EVERY_MS = 30 * 1000;
const PULL_EVERY_MS = 10 * 60 * 1000;

class AuthError extends Error {}

class Sync extends EventEmitter {
  // auth(): { apiServer, tenantId, token, branchCode } or null when signed out
  constructor(store, auth, fetchImpl) {
    super();
    this.store = store;
    this.auth = auth;
    this.fetch = fetchImpl;
    this.timer = null;
    this.running = false;
    this.lastPullAt = 0;
    this.state = { online: null, needsLogin: false, lastSyncAt: null, lastError: "", pending: store.pendingCount() };
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this.run(), PUSH_EVERY_MS);
    setTimeout(() => this.run(), 1500);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  _set(patch) {
    this.state = { ...this.state, ...patch, pending: this.store.pendingCount() };
    this.emit("state", this.state);
  }

  async _call(method, path, body) {
    const a = this.auth();
    if (!a || !a.token || !a.tenantId) throw new AuthError("Not signed in");
    const url = `${a.apiServer}/api/${encodeURIComponent(a.tenantId)}${path}`;
    const res = await this.fetch(url, {
      method,
      headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new AuthError("Sign in again to sync");
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const msg = (data && data.error) || (typeof data === "string" && data) || `HTTP ${res.status}`;
      const err = new Error(String(msg).slice(0, 200));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // One pass: upload, then (every few minutes) download rates and resync requests.
  async run({ forcePull = false } = {}) {
    if (this.running) return this.state;
    this.running = true;
    try {
      await this.push();
      if (forcePull || Date.now() - this.lastPullAt > PULL_EVERY_MS) {
        await this.pullRates();
        await this.pullWheelTypes();
        try {
          await this.handleResyncRequests();
        } catch (e) {
          // a server problem with resync requests must not show the PC as offline or stop uploads
          if (e instanceof AuthError || !e.status) throw e;
          this.emit("warn", `resync requests: ${e.message}`);
        }
        this.lastPullAt = Date.now();
      }
      this._set({ online: true, needsLogin: false, lastSyncAt: new Date().toISOString(), lastError: "" });
    } catch (e) {
      if (e instanceof AuthError) this._set({ needsLogin: true, lastError: e.message });
      else this._set({ online: false, lastError: e.message });
    } finally {
      this.running = false;
    }
    return this.state;
  }

  async push() {
    const a = this.auth() || {};
    for (const r of this.store.pendingWeights()) {
      try {
        await this._call("POST", "/weighbridge/save", {
          ddId: r.id,
          branchCode: r.branch_code || a.branchCode,
          voucherNumber: r.voucher_number,
          voucherDate: r.voucher_date,
          vehicleNumber: r.vehicle_number,
          wheelType: r.wheel_type,
          material: r.material,
          mobileNumber: r.mobile_number,
          lcdNumber: r.lcd_number,
          firstWeight: r.first_weight,
          firstWeightDate: r.first_weight_date,
          amount: r.amount,
          roundTrip: r.round_trip,
          userId: r.user_id,
        });
        this.store.markSynced("weights", r.id);
      } catch (e) {
        if (e instanceof AuthError || !e.status) throw e; // offline or signed out: stop, retry later
        this.store.markSynced("weights", r.id, e.message); // server rejected this row: keep it, show why
      }
    }
    for (const r of this.store.pendingTares()) {
      try {
        await this._call("POST", "/weighbridge/tare", {
          branchCode: r.branch_code || a.branchCode,
          vehicleNumber: r.vehicle_number,
          wheelType: r.wheel_type,
          tareWeight: r.tare_weight,
          voucherNumber: r.voucher_number,
          voucherDate: r.voucher_date,
          userId: r.user_id,
        });
        this.store.markSynced("tares", r.id);
      } catch (e) {
        if (e instanceof AuthError || !e.status) throw e;
        this.store.markSynced("tares", r.id, e.message);
      }
    }
    for (const r of this.store.pendingEngage()) {
      try {
        await this._call("POST", "/weighbridge/engage", { branchCode: r.branch_code || a.branchCode, weight: r.weight, dateTime: r.date_time });
        this.store.markSynced("engage", r.id);
      } catch (e) {
        if (e instanceof AuthError || !e.status) throw e;
        this.store.markSynced("engage", r.id); // a bad engage row is not worth blocking the queue
      }
    }
  }

  async pullRates() {
    const list = await this._call("GET", "/wb-rates");
    if (Array.isArray(list) && list.length) this.store.replaceRates(list);
  }

  // The back office asked this branch to send a day again (Weigh Bridge Resync in web admin).
  async handleResyncRequests() {
    const a = this.auth();
    if (!a?.branchCode) return;
    const reqs = await this._call("GET", `/weighbridge/resync-request?branch=${encodeURIComponent(a.branchCode)}&status=PENDING`);
    for (const req of Array.isArray(reqs) ? reqs : []) {
      const queued = this.store.requeueDate(req.resyncDate);
      await this.push();
      await this._call("POST", `/weighbridge/resync-request/${encodeURIComponent(req.id)}/complete`, {
        queuedCount: queued,
        note: "Weighbridge app",
      });
    }
  }

  // First sign-in on a PC (or "Refresh from server"): continue the branch's voucher numbers,
  // and bring in recent weighings so open first weighings and vehicle history are here.
  async seed() {
    const a = this.auth();
    if (!a?.branchCode) throw new Error("Choose the branch first");
    const b = encodeURIComponent(a.branchCode);
    const wb = await this._call("GET", `/weighbridge/last-voucher?branch=${b}&type=WB`);
    const wt = await this._call("GET", `/weighbridge/last-voucher?branch=${b}&type=WT`);
    this.store.ensureSeriesAtLeast("WB", wb?.lastNumber);
    this.store.ensureSeriesAtLeast("WT", wt?.lastNumber);
    const data = await this._call("GET", `/weighbridge/sync?branch=${b}`);
    const imported = this.store.importFromServer(data || {});
    await this.pullRates();
    await this.pullWheelTypes();
    this.store.setSetting("seededAt", new Date().toISOString());
    this._set({ online: true, needsLogin: false });
    return { imported, lastWB: this.store.lastVoucher("WB"), lastWT: this.store.lastVoucher("WT") };
  }

  // Wheel type the server has in force for a vehicle: set in the web admin, else its newest
  // weighing or tare at any branch. "" when the server has none.
  async lookupWheelType(vehicle) {
    const r = await this._call("GET", `/weighbridge/wheel-type/${encodeURIComponent(vehicle)}`);
    if (!r || !r.wheelType) return "";
    const set = r.source === "set";
    this.store.rememberWheelType(vehicle, String(r.wheelType), String((set ? r.updatedAt : r.lastDate) || ""), set);
    return String(r.wheelType);
  }

  // Wheel types set or changed in the web admin since the last pull.
  async pullWheelTypes() {
    let data;
    try {
      data = await this._call("GET", `/weighbridge/wheel-types/changes${this._since()}`);
    } catch (e) {
      if (e instanceof AuthError) throw e;
      return 0; // a server without the feature yet: nothing to apply
    }
    let latest = this.store.getSetting("wheelTypesSince", "");
    let n = 0;
    for (const r of Array.isArray(data?.rows) ? data.rows : []) {
      if (!r?.vehicleNumber || !r.wheelType) continue;
      this.store.rememberWheelType(r.vehicleNumber, String(r.wheelType), String(r.updatedAt || ""), true);
      if (r.updatedAt && String(r.updatedAt) > latest) latest = String(r.updatedAt);
      n++;
    }
    if (latest) this.store.setSetting("wheelTypesSince", latest);
    return n;
  }

  _since() {
    const s = this.store.getSetting("wheelTypesSince", "");
    return s ? `?since=${encodeURIComponent(s)}` : "";
  }

  // This PC checks in (Weighbridge PCs in the web admin) and learns whether its Settings are open.
  async checkinTerminal(body) {
    return this._call("POST", "/weighbridge/terminals/checkin", body);
  }

  async addRate(wheelType, wheelRate, terminalId) {
    const out = await this._call("POST", "/wb-rates", { wheelType, wheelRate, terminalId });
    await this.pullRates();
    return out;
  }
}

module.exports = { Sync, AuthError };
