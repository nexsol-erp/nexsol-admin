// Keeps the app up to date from the server it is connected to. The server publishes the newest
// installer at /api/updates/weighbridge (latest.json + download, filled by the weighbridge CI).
// A newer version is downloaded in the background; it is installed only when the operator clicks
// "Restart to update" or when the app is closed, never in the middle of a weighing.

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const CHECK_EVERY_MS = 30 * 60 * 1000;
const FIRST_CHECK_MS = 20 * 1000;
const MIN_INSTALLER_BYTES = 1024 * 1024;

// "1.2.10" > "1.2.9". Anything that isn't dotted numbers compares as 0.
function compareVersions(a, b) {
  const pa = String(a || "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "").split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

class Updater extends EventEmitter {
  // serverUrl(): the API server, e.g. https://www.tradelink247.com; fetchImpl: fetch-compatible
  constructor({ currentVersion, serverUrl, fetchImpl, dir, log = () => {} }) {
    super();
    this.currentVersion = currentVersion;
    this.serverUrl = serverUrl;
    this.fetch = fetchImpl;
    this.dir = dir;
    this.log = log;
    this.timer = null;
    this.busy = false;
    // idle | checking | downloading | ready | error | none
    this.state = { status: "idle", currentVersion, version: null, file: null, error: "", checkedAt: null };
  }

  start() {
    this.stop();
    setTimeout(() => this.check().catch(() => {}), FIRST_CHECK_MS);
    this.timer = setInterval(() => this.check().catch(() => {}), CHECK_EVERY_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  _set(patch) {
    this.state = { ...this.state, ...patch };
    this.emit("state", this.state);
  }

  installerPath(version) {
    return path.join(this.dir, `TradeLink247-Weighbridge-Setup-${version}.exe`);
  }

  // Asks the server for the newest version and downloads it if it is newer than this app.
  async check() {
    if (this.busy) return this.state;
    if (this.state.status === "ready") return this.state;
    const server = this.serverUrl();
    if (!server) return this.state;
    this.busy = true;
    try {
      this._set({ status: "checking", error: "" });
      const res = await this.fetch(`${server}/api/updates/weighbridge/latest.json`, { headers: { Accept: "application/json" } });
      if (res.status === 404) { this._set({ status: "none", checkedAt: new Date().toISOString() }); return this.state; }
      if (!res.ok) throw new Error(`update check: HTTP ${res.status}`);
      const info = await res.json();
      const version = String(info?.version || "");
      if (!version || compareVersions(version, this.currentVersion) <= 0) {
        this._set({ status: "none", version: version || null, checkedAt: new Date().toISOString() });
        return this.state;
      }
      const file = this.installerPath(version);
      if (!this._valid(file)) {
        this._set({ status: "downloading", version });
        await this._download(new URL(info.url || "/api/updates/weighbridge/download", server).toString(), file);
      }
      this.log("INFO", "update ready", version, file);
      this._set({ status: "ready", version, file, checkedAt: new Date().toISOString() });
      return this.state;
    } catch (e) {
      this.log("WARN", "update check failed", e.message);
      this._set({ status: "error", error: e.message, checkedAt: new Date().toISOString() });
      return this.state;
    } finally {
      this.busy = false;
    }
  }

  // A Windows program ("MZ" header) of a plausible size. Partial downloads never get this name.
  _valid(file) {
    try {
      const st = fs.statSync(file);
      if (st.size < MIN_INSTALLER_BYTES) return false;
      const fd = fs.openSync(file, "r");
      const head = Buffer.alloc(2);
      fs.readSync(fd, head, 0, 2, 0);
      fs.closeSync(fd);
      return head.toString("latin1") === "MZ";
    } catch (_) {
      return false;
    }
  }

  async _download(url, file) {
    fs.mkdirSync(this.dir, { recursive: true });
    const part = `${file}.part`;
    const res = await this.fetch(url);
    if (!res.ok) throw new Error(`download: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const expected = Number(res.headers?.get?.("content-length") || 0);
    if (expected && buf.length !== expected) throw new Error(`download incomplete (${buf.length} of ${expected} bytes)`);
    fs.writeFileSync(part, buf);
    if (!this._valid(part)) {
      try { fs.unlinkSync(part); } catch (_) { /* gone */ }
      throw new Error("downloaded file is not a Windows installer");
    }
    fs.renameSync(part, file);
    // keep only this installer
    for (const f of fs.readdirSync(this.dir)) {
      const p = path.join(this.dir, f);
      if (p !== file) { try { fs.unlinkSync(p); } catch (_) { /* in use */ } }
    }
  }
}

module.exports = { Updater, compareVersions };
