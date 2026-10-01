// TradeLink247 Weighbridge: main process.
// Owns everything that must not depend on the screen: the indicator connection, the local
// database, voucher numbering, printing and the upload queue. The React UI (src/) talks to
// it only through the window.WB bridge in preload.js.

const { app, BrowserWindow, ipcMain, dialog, net, Menu, shell } = require("electron");
const path = require("path");
const fs = require("fs");

const serverConfig = require("./serverConfig");
const { Store, ValidationError, localStamp, normalizeVehicle } = require("./store");
const { Sync } = require("./sync");
const { PRESETS, buildProfile, escapeCtl, unescapeCtl } = require("./indicator/profiles");
const { IndicatorSession, FrameSplitter, decodeFrame } = require("./indicator/parser");
const { Transport, listPorts } = require("./indicator/transport");
const { voucherHtml, pdfFileName } = require("./voucher");
const { Updater } = require("./updater");
const { spawn } = require("child_process");

if (!app.isPackaged) app.setPath("userData", path.join(__dirname, "../.electron-cache"));

// Two copies would fight over the COM port and the voucher counter.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// ── log file: <userData>/logs/weighbridge.log ────────────────────────────────
let logStream = null;
function log(level, ...args) {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map((a) => (a instanceof Error ? a.stack : typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")}\n`;
  try {
    if (!logStream) {
      const dir = path.join(app.getPath("userData"), "logs");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, "weighbridge.log");
      try { if (fs.statSync(file).size > 8 * 1024 * 1024) fs.renameSync(file, file + ".old"); } catch (_) { /* new file */ }
      logStream = fs.createWriteStream(file, { flags: "a" });
    }
    logStream.write(line);
  } catch (_) { /* logging must never break weighing */ }
  process.stdout.write(line);
}

let win = null;
let store = null;
let sync = null;
let updater = null;
let installing = false;

// ── settings ─────────────────────────────────────────────────────────────────
const DEFAULT_PRINT = {
  printer: "",        // "" = Windows default printer, like the Qt app
  layout: "a5",       // a5 | 80mm
  copies: 1,
  autoPrint: true,
  keepPdf: true,
  pdfFolder: "",      // "" = Documents\TradeLink247 Weighbridge\Vouchers
  header: [],         // lines; filled from the branch record at sign-in
  footer: "Thank you for your business!",
  currency: "₹",
};

const DEFAULT_WEIGHING = {
  requireStable: true, // save only on a stable reading
  simulator: false,    // admin-only, for commissioning and training
};

function auth() { return store.getSetting("auth", null); }
function printSettings() { return { ...DEFAULT_PRINT, ...(store.getSetting("print", {}) || {}) }; }
function weighingSettings() { return { ...DEFAULT_WEIGHING, ...(store.getSetting("weighing", {}) || {}) }; }
function indicatorConfig() { return store.getSetting("indicator", { presetId: "qt-default", overrides: {} }); }

function isAdmin() {
  const roles = auth()?.roles || [];
  return roles.some((r) => ["ADMIN", "admin", "SYSTEM_ADMIN", "system-admin"].includes(r));
}

function requireAdmin() {
  if (!isAdmin()) throw new ValidationError("Only an admin can change this");
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ── indicator ────────────────────────────────────────────────────────────────
let transport = null;
let session = null;
let indicatorStatus = { state: "closed", message: "" };
let monitorOn = false;
let simulated = null; // { weight, at } while the simulator drives the display

function startIndicator() {
  stopIndicator();
  const cfg = indicatorConfig();
  const profile = buildProfile(cfg.presetId, cfg.overrides);
  session = new IndicatorSession(profile);
  session.on("reading", (r) => { if (!simulated) send("wb:reading", publicReading(r)); });
  session.on("signal", (s) => send("wb:signal", s));
  session.on("frame", (f) => { if (monitorOn) send("wb:frame", { text: escapeCtl(f.raw), ok: f.ok, at: Date.now() }); });
  session.on("engage", (e) => {
    const branchCode = auth()?.branchCode || "";
    try { store.addEngage({ weight: e.weight, branchCode, at: e.at }); } catch (err) { log("ERROR", "engage save", err); }
    log("INFO", "bridge engaged", e.weight);
  });
  transport = new Transport(profile);
  transport.on("data", (d) => {
    if (monitorOn) send("wb:raw", { hex: d.toString("hex").replace(/(..)/g, "$1 ").trim(), text: escapeCtl(d.toString("latin1")), at: Date.now() });
    session.feed(d);
  });
  transport.on("status", (s) => {
    indicatorStatus = s;
    log(s.state === "error" ? "WARN" : "INFO", "indicator", s.state, s.message);
    send("wb:indicator-status", s);
  });
  transport.start();
}

function stopIndicator() {
  if (transport) transport.stop();
  transport = null;
  if (session) session.removeAllListeners();
  session = null;
}

function publicReading(r) {
  return { weight: r.weight, stable: r.stable, overload: r.overload, at: r.at, simulated: !!r.simulated };
}

// The reading a save may use: fresh, stable (unless allowed), above zero.
function currentWeight() {
  const ws = weighingSettings();
  const r = simulated && ws.simulator ? { ...simulated, stable: true, overload: false } : session?.last;
  const limit = Number(session?.profile?.noSignalMs) || 3000;
  if (!r || Date.now() - r.at > limit) throw new ValidationError("No reading from the weighbridge");
  if (r.overload) throw new ValidationError("Indicator shows overload");
  if (ws.requireStable && !r.stable) throw new ValidationError("Weight is not stable yet");
  const zero = Number(session?.profile?.zeroBandKg) || 0;
  if (!(r.weight > zero)) throw new ValidationError("No weight on the bridge");
  return r.weight;
}

setInterval(() => {
  if (session) session.tick();
  if (simulated && Date.now() - simulated.at > 1000) {
    simulated = { ...simulated, at: Date.now() };
    send("wb:reading", publicReading({ ...simulated, stable: true, simulated: true }));
  }
}, 1000);

// ── printing ─────────────────────────────────────────────────────────────────
function pdfFolder() {
  const p = printSettings().pdfFolder;
  return p || path.join(app.getPath("documents"), "TradeLink247 Weighbridge", "Vouchers");
}

async function renderHtml(html, fn) {
  const tmp = path.join(app.getPath("temp"), `wb-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmp, html, "utf-8");
  const w = new BrowserWindow({ show: false, width: 800, height: 1100, webPreferences: { contextIsolation: true } });
  try {
    await w.loadFile(tmp);
    return await fn(w);
  } finally {
    w.destroy();
    try { fs.unlinkSync(tmp); } catch (_) { /* temp file */ }
  }
}

function pageSize(layout) {
  return layout === "80mm" ? { width: 80000, height: 200000 } : "A5";
}

async function printVoucher(row, { reprint = false } = {}) {
  const ps = printSettings();
  const copies = Math.max(1, Math.min(5, Number(ps.copies) || 1));
  const result = { printed: false, pdf: null, error: "" };
  for (let i = 0; i < copies; i++) {
    const html = voucherHtml(row, { ...ps, copyLabel: reprint ? "DUPLICATE" : copies > 1 ? (i === 0 ? "ORIGINAL" : "COPY") : "" });
    try {
      await renderHtml(html, (w) => new Promise((resolve, reject) => {
        w.webContents.print({
          silent: true,
          deviceName: ps.printer || "",
          printBackground: true,
          pageSize: pageSize(ps.layout),
          margins: { marginType: ps.layout === "80mm" ? "none" : "default" },
        }, (ok, err) => (ok ? resolve() : reject(new Error(err || "Print failed"))));
      }));
      result.printed = true;
    } catch (e) {
      result.error = e.message;
      log("ERROR", "print", row.voucher_number, e.message);
      break;
    }
  }
  if (result.printed) store.markPrinted(row.id);
  if (ps.keepPdf && !reprint) {
    try {
      const dir = pdfFolder();
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, pdfFileName(row));
      const pdf = await renderHtml(voucherHtml(row, ps), (w) => w.webContents.printToPDF({ printBackground: true, pageSize: ps.layout === "80mm" ? { width: 3.15, height: 7.87 } : "A5" }));
      fs.writeFileSync(file, pdf);
      result.pdf = file;
    } catch (e) {
      log("ERROR", "pdf copy", row.voucher_number, e.message);
    }
  }
  return result;
}

// ── IPC helpers ──────────────────────────────────────────────────────────────
// Every handler returns { ok: true, ...data } or { ok: false, error } so the UI never has
// to parse Electron's wrapped exceptions.
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, arg) => {
    try {
      const out = await fn(arg || {});
      return { ok: true, ...(out && typeof out === "object" && !Array.isArray(out) ? out : { data: out }) };
    } catch (e) {
      if (!(e instanceof ValidationError)) log("ERROR", channel, e);
      return { ok: false, error: e.message || String(e) };
    }
  });
}

function registerIpc() {
  ipcMain.on("app:info-sync", (e) => {
    e.returnValue = { version: app.getVersion(), packaged: app.isPackaged, server: serverConfig.getServerState() };
  });

  // server connection (same screen as the POS)
  handle("server:check", ({ address }) => serverConfig.checkServer(address));
  handle("update:state", () => ({ state: updater.state }));
  handle("update:check", async () => ({ state: await updater.check() }));
  handle("update:install", () => {
    if (!runInstaller(true)) throw new ValidationError("No update is ready to install");
    setTimeout(() => app.quit(), 300);
    return {};
  });
  handle("server:save", ({ config }) => ({ config: serverConfig.save(config) }));
  ipcMain.on("app:relaunch", () => { app.relaunch(); app.exit(0); });

  // sign-in
  handle("auth:state", () => ({ auth: publicAuth(), isAdmin: isAdmin(), seededAt: store.getSetting("seededAt", null) }));
  handle("auth:login", async ({ username, password }) => {
    const api = serverConfig.getServerState().apiServer;
    const res = await net.fetch(`${api}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (_) { throw new Error("The server did not answer the sign-in"); }
    if (!data?.success || !data.token) throw new ValidationError(data?.message || "Sign-in failed");
    const payload = decodeJwt(data.token) || {};
    const branches = (Array.isArray(payload.branches) ? payload.branches : [])
      .map((b) => (typeof b === "string" ? b : String(b?.branchCode ?? b?.code ?? b?.branch ?? "")))
      .filter(Boolean);
    const prev = auth();
    const next = {
      token: data.token,
      tenantId: data.tenancyId,
      username,
      roles: data.roles || [],
      branches,
      branchCode: prev?.tenantId === data.tenancyId ? prev.branchCode : "",
      apiServer: api,
    };
    const autoBranch = !next.branchCode && branches.length === 1 ? branches[0] : "";
    store.setSetting("auth", next);
    log("INFO", "signed in", username, data.tenancyId, next.branchCode || autoBranch);
    if (autoBranch) await applyBranch(autoBranch);
    sync.run({ forcePull: true });
    return { auth: publicAuth(), isAdmin: isAdmin() };
  });
  handle("auth:logout", () => {
    const a = auth();
    // Keep tenant and branch so the next person signs in to the same bridge; drop the token.
    if (a) store.setSetting("auth", { ...a, token: "", username: "", roles: [] });
    return {};
  });
  handle("branch:list", async () => {
    const a = auth();
    const list = await apiGet(`/api/${encodeURIComponent(a.tenantId)}/branches`).catch(() => []);
    return { branches: Array.isArray(list) ? list : [], allowed: a?.branches || [] };
  });
  handle("branch:set", async ({ branchCode }) => {
    const a = auth();
    if (!a) throw new ValidationError("Sign in first");
    if (a.branchCode && a.branchCode !== branchCode) requireAdmin();
    const seeded = await applyBranch(branchCode);
    return { auth: publicAuth(), seeded };
  });

  // indicator
  handle("indicator:presets", () => ({ presets: PRESETS }));
  handle("indicator:config", () => ({ config: indicatorConfig(), profile: session?.profile || null, status: indicatorStatus }));
  handle("indicator:save", ({ presetId, overrides }) => {
    requireAdmin();
    store.setSetting("indicator", { presetId, overrides: overrides || {} });
    startIndicator();
    return { profile: session.profile };
  });
  handle("indicator:ports", async () => ({ ports: await listPorts() }));
  handle("indicator:restart", () => { startIndicator(); return {}; });
  handle("indicator:monitor", ({ on }) => { monitorOn = !!on; return {}; });
  // Paste what the monitor showed, see what a profile makes of it.
  handle("indicator:test", ({ presetId, overrides, sample }) => {
    const profile = buildProfile(presetId, overrides);
    const splitter = new FrameSplitter(profile.frame);
    const frames = splitter.push(Buffer.from(unescapeCtl(String(sample || "")), "latin1"));
    return { results: frames.map((f) => ({ frame: escapeCtl(f), reading: decodeFrame(f, profile) })) };
  });
  handle("indicator:export", async ({ presetId, overrides }) => {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "Save indicator profile", defaultPath: "indicator-profile.json", filters: [{ name: "Profile", extensions: ["json"] }],
    });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, JSON.stringify({ kind: "tradelink247-weighbridge-indicator", presetId, overrides }, null, 2));
    return { saved: true, filePath };
  });
  handle("indicator:import", async () => {
    requireAdmin();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: "Load indicator profile", filters: [{ name: "Profile", extensions: ["json"] }], properties: ["openFile"] });
    if (canceled || !filePaths?.length) return { loaded: false };
    const data = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    if (data?.kind !== "tradelink247-weighbridge-indicator") throw new ValidationError("That file is not an indicator profile");
    return { loaded: true, presetId: data.presetId, overrides: data.overrides || {} };
  });
  handle("indicator:simulate", ({ weight }) => {
    if (!weighingSettings().simulator) throw new ValidationError("Turn on the simulator in Settings first");
    simulated = weight === null || weight === undefined ? null : { weight: Number(weight) || 0, at: Date.now() };
    if (simulated) send("wb:reading", publicReading({ ...simulated, stable: true, simulated: true }));
    return {};
  });

  // weighing
  handle("wb:rates", () => ({ rates: store.rates() }));
  handle("wb:vehicles", ({ prefix }) => ({ vehicles: store.vehicles(prefix) }));
  handle("wb:materials", ({ prefix }) => ({ materials: store.materials(prefix) }));
  handle("wb:history", async ({ vehicleNumber }) => {
    const vehicle = normalizeVehicle(vehicleNumber);
    // Ask the server too: a change made in the web admin (Vehicle Wheel Type) applies at once, and a
    // lorry known only at another branch is locked as well. Offline, the local answer stands.
    if (vehicle.length >= 4 && sync.state.online !== false) {
      try {
        await Promise.race([sync.lookupWheelType(vehicle), new Promise((r) => setTimeout(r, 2000))]);
      } catch (_) { /* offline or signed out */ }
    }
    const wheelType = store.wheelTypeOf(vehicle);
    return { ...store.history(vehicle), wheelType, wheelLocked: !!wheelType };
  });
  handle("wb:quote", (q) => ({ quote: store.quote(q) }));
  handle("wb:save", async (form) => {
    const a = auth();
    if (!a?.branchCode) throw new ValidationError("Choose the branch in Settings first");
    const weight = currentWeight();
    const row = store.saveWeighing({ ...form, weight, branchCode: a.branchCode, userId: a.username || "" });
    log("INFO", "saved", row.voucher_number, row.vehicle_number, row.lcd_number, row.amount, row.first_weight_kind);
    let print = { printed: false, pdf: null, error: "" };
    if (printSettings().autoPrint) print = await printVoucher(row);
    sync.run();
    return { row, print };
  });
  handle("wb:reprint", async ({ id }) => {
    const row = store.getWeighing(id);
    if (!row) throw new ValidationError("Voucher not found");
    log("INFO", "reprint", row.voucher_number, "by", auth()?.username);
    return { print: await printVoucher(row, { reprint: true }) };
  });
  handle("wb:preview", ({ id }) => {
    const row = store.getWeighing(id);
    if (!row) throw new ValidationError("Voucher not found");
    return { html: voucherHtml(row, printSettings()) };
  });

  // tare weights
  handle("tare:list", () => ({ tares: store.tares() }));
  handle("tare:save", ({ vehicleNumber, wheelType, tareWeight, fromBridge }) => {
    const a = auth();
    if (!a?.branchCode) throw new ValidationError("Choose the branch in Settings first");
    const t = fromBridge ? currentWeight() : Number(tareWeight);
    const row = store.saveTare({ vehicleNumber, wheelType, tareWeight: t, branchCode: a.branchCode, userId: a.username || "" });
    sync.run();
    return { tare: row };
  });

  // rates (kept on the server so every branch and the web admin see the same list)
  handle("rates:add", async ({ wheelType, wheelRate }) => {
    requireAdmin();
    if (!String(wheelType || "").trim()) throw new ValidationError("Enter the wheel type");
    if (!(Number(wheelRate) > 0)) throw new ValidationError("Rate must be more than 0");
    await sync.addRate(String(wheelType).trim().toUpperCase(), Number(wheelRate));
    return { rates: store.rates() };
  });

  // report
  handle("report:get", ({ from, to }) => store.report(from, to));
  handle("report:csv", async ({ from, to }) => {
    const r = store.report(from, to);
    const cols = ["voucherNumber", "voucherDate", "vehicleNumber", "wheelType", "material", "mobileNumber", "weight", "firstWeight", "amount", "roundTrip"];
    const csv = [cols.join(",")].concat(r.rows.map((x) => cols.map((c) => `"${String(x[c] ?? "").replace(/"/g, '""')}"`).join(","))).join("\r\n");
    const { canceled, filePath } = await dialog.showSaveDialog(win, { title: "Save report", defaultPath: `weighbridge-${String(from).slice(0, 10)}.csv`, filters: [{ name: "CSV", extensions: ["csv"] }] });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, "﻿" + csv, "utf8");
    return { saved: true, filePath };
  });

  // settings
  handle("settings:get", () => ({ print: printSettings(), weighing: weighingSettings(), pdfFolder: pdfFolder() }));
  handle("settings:save-print", ({ print }) => { requireAdmin(); store.setSetting("print", { ...printSettings(), ...print }); return { print: printSettings() }; });
  handle("settings:save-weighing", ({ weighing }) => { requireAdmin(); store.setSetting("weighing", { ...weighingSettings(), ...weighing }); simulated = null; return { weighing: weighingSettings() }; });
  handle("settings:pick-folder", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { properties: ["openDirectory", "createDirectory"] });
    return canceled ? { folder: "" } : { folder: filePaths[0] };
  });
  handle("settings:open-folder", ({ which }) => {
    const target = which === "logs" ? path.join(app.getPath("userData"), "logs") : pdfFolder();
    fs.mkdirSync(target, { recursive: true });
    shell.openPath(target);
    return {};
  });
  handle("printers:list", async () => ({ printers: win ? await win.webContents.getPrintersAsync() : [] }));
  handle("print:test", async () => {
    const row = {
      id: "test", voucher_number: "TEST", voucher_date: localStamp(), vehicle_number: "KL07AB1234", wheel_type: "10 WHEEL",
      material: "Sand", mobile_number: "", lcd_number: 18250, first_weight: 7120, first_weight_date: localStamp(), first_weight_kind: "previous", amount: 0,
    };
    return { print: await printVoucher(row, { reprint: true }) };
  });

  // sync
  handle("sync:state", () => ({ state: sync.state }));
  handle("sync:now", async () => ({ state: await sync.run({ forcePull: true }) }));
  handle("sync:seed", async () => ({ seeded: await sync.seed() }));
}

// Ties this PC to a branch: voucher header from the branch record (unless one was typed),
// then carry on the branch's voucher numbers and copy its recent weighings.
async function applyBranch(branchCode) {
  const a = auth();
  store.setSetting("auth", { ...a, branchCode });
  if (!branchCode) return null;
  const ps = printSettings();
  if (!(ps.header || []).some(Boolean)) {
    try {
      const list = await apiGet(`/api/${encodeURIComponent(a.tenantId)}/branches`);
      const b = (Array.isArray(list) ? list : []).find((x) => String(x.branchCode).toLowerCase() === String(branchCode).toLowerCase());
      if (b) {
        const header = [b.branchName, b.branchBuildingAddress, b.branchAddress1, b.branchAddress2, b.branchGst ? `GSTIN: ${b.branchGst}` : ""]
          .map((x) => String(x || "").trim()).filter(Boolean);
        store.setSetting("print", { ...ps, header });
      }
    } catch (e) { log("WARN", "branch header", e.message); }
  }
  try {
    return await sync.seed();
  } catch (e) {
    log("WARN", "seed", e.message);
    return null;
  }
}

function publicAuth() {
  const a = auth();
  if (!a) return null;
  const { token, ...rest } = a;
  return { ...rest, signedIn: !!token };
}

function decodeJwt(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(part, "base64").toString("utf8"));
  } catch (_) {
    return null;
  }
}

async function apiGet(p) {
  const a = auth();
  const res = await net.fetch(`${a.apiServer}${p}`, { headers: { Authorization: `Bearer ${a.token}`, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── window ───────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    show: false,
    title: `TradeLink247 Weighbridge v${app.getVersion()}`,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.on("page-title-updated", (e) => e.preventDefault());
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.webContents.on("render-process-gone", (_e, d) => log("ERROR", "renderer gone", d));
  if (app.isPackaged) win.loadFile(path.join(__dirname, "../dist/index.html"));
  else win.loadURL(process.env.ELECTRON_START_URL || "http://localhost:5174");

  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: "File", submenu: [{ role: "quit" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools", accelerator: "F12" }, { role: "togglefullscreen" }] },
  ]));
}

// Runs the downloaded installer silently (/S keeps the install folder and data) and quits so it
// can replace the files. relaunch: open the new version when done ("Restart to update").
function runInstaller(relaunch) {
  const st = updater?.state;
  if (installing || st?.status !== "ready" || !st.file || process.platform !== "win32") return false;
  installing = true;
  log("INFO", "installing update", st.version, relaunch ? "and restarting" : "on close");
  const args = ["/S"];
  if (relaunch) args.push("--force-run");
  spawn(st.file, args, { detached: true, stdio: "ignore" }).unref();
  return true;
}

app.on("before-quit", () => { runInstaller(false); });

app.on("second-instance", () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(() => {
  log("INFO", "start", app.getVersion(), "userData", app.getPath("userData"));
  store = new Store(path.join(app.getPath("userData"), "weighbridge.db"));
  sync = new Sync(store, () => {
    const a = auth();
    return a ? { ...a, apiServer: a.apiServer || serverConfig.getServerState().apiServer } : null;
  }, (url, opts) => net.fetch(url, opts));
  sync.on("state", (s) => send("wb:sync", s));
  updater = new Updater({
    currentVersion: app.getVersion(),
    serverUrl: () => serverConfig.getServerState().apiServer,
    fetchImpl: (url, opts) => net.fetch(url, opts),
    dir: path.join(app.getPath("userData"), "updates"),
    log,
  });
  updater.on("state", (s) => send("wb:update", s));
  registerIpc();
  createWindow();
  startIndicator();
  sync.start();
  if (app.isPackaged) updater.start(); // a dev build would "update" itself to the published one
});

app.on("window-all-closed", () => {
  stopIndicator();
  sync?.stop();
  try { store?.close(); } catch (_) { /* closing */ }
  app.quit();
});
