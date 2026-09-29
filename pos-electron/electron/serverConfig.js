// Which backend server this POS talks to.
//
// One build works against any server (ours, a customer's own, or a new domain after a
// move). The choice is saved in <userData>/server.json, which survives reinstalls and
// upgrades. Resolution, first match wins:
//   1. <userData>/server.json            the confirmed choice
//   2. --server=https://…                passed by the Qt launcher, which got it from the
//                                         server.json stamped into its download zip
//   3. pos-config.json next to the exe   legacy installs; migrated silently
//   4. build default                     used but NOT confirmed: the renderer shows the
//                                         "Connect to server" screen unless this PC already
//                                         has a login session (then it silently confirms)
// When 2 disagrees with a saved 1, the renderer decides whether it's safe to switch
// (nothing waiting to sync) and calls save() + relaunch.
const { app, net } = require("electron");
const path = require("path");
const fs = require("fs");

const DEFAULT_SERVER = "https://www.tradelink247.com";
const SERVER_INFO_PATH = "/api/updates/pos/server-info";
const LEGACY_CHECK_PATH = "/api/pos-app/update-check?platform=WINDOWS&currentVersion=0.0.0";
const BASE_URL = /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/;

// Directory where the .exe lives — works for both portable and installed builds.
function exeDir() {
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
}

function userConfigPath() {
  return path.join(app.getPath("userData"), "server.json");
}

function legacyConfigPath() {
  return app.isPackaged
    ? path.join(exeDir(), "pos-config.json")
    : path.join(__dirname, "../pos-config.json");
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; }
}

function isPrivateHost(host) {
  return host === "localhost"
    || /^127\./.test(host)
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
}

// "erp.example.com/" → "https://erp.example.com". Returns null for anything that isn't a
// bare scheme://host[:port]. Plain http is only accepted for localhost and LAN addresses,
// so an on-premise box without a certificate still works but a public one can't downgrade.
function normalizeServer(input) {
  if (typeof input !== "string") return null;
  let u = input.trim().toLowerCase();
  if (!u) return null;
  if (!/^[a-z]+:\/\//.test(u)) u = "https://" + u;
  u = u.replace(/\/+$/, "");
  if (!BASE_URL.test(u)) return null;
  if (u.startsWith("http://")) {
    const host = u.slice("http://".length).replace(/:\d+$/, "");
    if (!isPrivateHost(host)) return null;
  }
  return u;
}

function deriveWs(api) {
  return api ? api.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://") : "";
}

function argServer() {
  const arg = process.argv.find((a) => a.startsWith("--server="));
  return arg ? normalizeServer(arg.slice("--server=".length)) : null;
}

function withDefaults(cfg) {
  const apiServer = cfg.apiServer;
  return {
    apiServer,
    wsServer: normalizeWs(cfg.wsServer) || deriveWs(apiServer),
    aiServer: normalizeServer(cfg.aiServer) || apiServer,
    name: typeof cfg.name === "string" ? cfg.name : "",
  };
}

function normalizeWs(ws) {
  if (typeof ws !== "string" || !ws.trim()) return null;
  const asHttp = ws.trim().replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
  const n = normalizeServer(asHttp);
  return n ? deriveWs(n) : null;
}

function save(cfg) {
  const apiServer = normalizeServer(cfg?.apiServer);
  if (!apiServer) throw new Error("Invalid server address");
  const out = { ...withDefaults({ ...cfg, apiServer }), savedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(userConfigPath()), { recursive: true });
  fs.writeFileSync(userConfigPath(), JSON.stringify(out, null, 2), "utf8");
  _state = null; // next read reflects the file
  return out;
}

let _state = null;

// { apiServer, wsServer, aiServer, name, confirmed, source, suggestion, pendingSwitch }
function getServerState() {
  if (_state) return _state;

  const saved = readJson(userConfigPath());
  const savedApi = normalizeServer(saved?.apiServer);
  const fromArg = argServer();

  if (savedApi) {
    _state = {
      ...withDefaults({ ...saved, apiServer: savedApi }),
      confirmed: true,
      source: "saved",
      pendingSwitch: fromArg && fromArg !== savedApi ? fromArg : null,
    };
    return _state;
  }

  // The launcher only passes a server it confirmed (stamped zip or typed in), so trust it.
  if (fromArg) {
    try { save({ apiServer: fromArg }); } catch (e) { console.error("serverConfig: save failed", e.message); }
    _state = { ...withDefaults({ apiServer: fromArg }), confirmed: true, source: "launcher", pendingSwitch: null };
    return _state;
  }

  const legacy = readJson(legacyConfigPath());
  const legacyApi = normalizeServer(legacy?.apiServer);
  if (legacyApi) {
    const cfg = { apiServer: legacyApi, wsServer: legacy.wsServer, aiServer: legacy.aiServer };
    try { save(cfg); } catch (e) { console.error("serverConfig: migrate failed", e.message); }
    _state = { ...withDefaults(cfg), confirmed: true, source: "legacy", pendingSwitch: null };
    return _state;
  }

  const fallback = normalizeServer(process.env.VITE_API_SERVER) || DEFAULT_SERVER;
  _state = { ...withDefaults({ apiServer: fallback }), confirmed: false, source: "default", pendingSwitch: null };
  return _state;
}

async function fetchJson(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await net.fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch (_) { /* not JSON */ }
    return { status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

// Asks a server who it is. Resolves { ok, config, movedTo, error }.
// Servers without the server-info endpoint yet are still accepted if they answer the
// (older, public) launcher update-check, so a customer box on an older backend works.
async function checkServer(input) {
  const base = normalizeServer(input);
  if (!base) return { ok: false, error: "Enter an address like https://erp.example.com" };
  try {
    const info = await fetchJson(base + SERVER_INFO_PATH);
    if (info.status === 200 && info.body && info.body.product === "TradeLink247") {
      const apiServer = normalizeServer(info.body.apiServer) || base;
      return {
        ok: true,
        config: withDefaults({
          apiServer,
          wsServer: info.body.wsServer,
          aiServer: info.body.aiServer,
          name: info.body.name || "",
        }),
        movedTo: normalizeServer(info.body.movedTo),
      };
    }
    const legacy = await fetchJson(base + LEGACY_CHECK_PATH);
    if (legacy.status === 200 && legacy.body && typeof legacy.body.updateAvailable === "boolean") {
      return { ok: true, config: withDefaults({ apiServer: base }), movedTo: null };
    }
    return { ok: false, error: "That address didn't answer as a TradeLink247 server." };
  } catch (e) {
    return { ok: false, error: "Could not reach the server: " + (e?.message || e) };
  }
}

// On an online start: is the current server retired? Resolves the replacement's config
// (already checked to answer) or null. Never throws.
async function checkMoved() {
  const current = getServerState();
  if (!current.confirmed) return null;
  try {
    const here = await checkServer(current.apiServer);
    if (!here.ok || !here.movedTo || here.movedTo === current.apiServer) return null;
    const there = await checkServer(here.movedTo);
    return there.ok ? there.config : null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  DEFAULT_SERVER,
  exeDir,
  normalizeServer,
  getServerState,
  save,
  checkServer,
  checkMoved,
};
