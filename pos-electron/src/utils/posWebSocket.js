import { log, warn, error as logError } from "./logger";

// ─── Config ──────────────────────────────────────────────────────────────────

const RECONNECT_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]; // backoff steps
const PING_INTERVAL_MS = 30_000; // keep-alive ping

// Close code nexsol-connect uses when a new connection replaces a PRIOR connection from this
// SAME machine (e.g. this terminal reconnecting after a crash while the old socket hadn't
// timed out yet). Must NOT auto-reconnect on this code — the fresh connection already took
// over, reconnecting again would just fight with it.
const REPLACED_CLOSE_CODE = 4001;

// Close code the admin backend uses to force-disconnect this terminal (e.g. to push a
// re-login/upgrade). Must NOT auto-reconnect — the app should log out instead.
const KICKED_CLOSE_CODE = 4002;

// Per-launch fallback identity for terminals that don't have an approved machine code yet
// (e.g. still PENDING approval) — keeps them from colliding with each other under a shared
// default. Once a real machine code is assigned, subsequent connects use that instead.
const sessionFallbackMachineId = (typeof crypto !== "undefined" && crypto.randomUUID)
  ? crypto.randomUUID()
  : `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ─── State ───────────────────────────────────────────────────────────────────

let ws            = null;
let tenantId      = "";
let branchCode    = "";
let wsBaseUrl     = "";
let reconnectIdx  = 0;
let reconnectTimer = null;
let pingTimer     = null;
let intentionalClose = false;

// handler registry: action → [fn, ...]
const handlers = {};

// connection-state listeners
const stateListeners = new Set();

// listeners notified when this connection was forcibly replaced by another device/window
const replacedListeners = new Set();

// listeners notified when an admin force-disconnected this terminal
const kickedListeners = new Set();

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildWsUrl() {
  const base    = wsBaseUrl || deriveWsBase();
  const version = import.meta.env.VITE_APP_VERSION || "0.0.0";
  const machine = localStorage.getItem(`posMachineCode_${branchCode}`) || sessionFallbackMachineId;
  return `${base}/ws?company=${encodeURIComponent(tenantId)}&branch=${encodeURIComponent(branchCode)}` +
    `&machine=${encodeURIComponent(machine)}&version=${encodeURIComponent(version)}`;
}

/** Derive WebSocket base from the REST API server URL in pos-config. */
function deriveWsBase() {
  const api = typeof window !== "undefined" ? window.POS?.apiServer : null;
  if (!api) return "ws://localhost:8083";
  // https://host → wss://host (nexsol-connect shares the same host via nginx)
  return api.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Connect to nexsol-connect.
 * @param {string} tenant  - tenantId / company
 * @param {string} branch  - branchCode
 * @param {string} [wsUrl] - optional override, e.g. "wss://myserver.com"
 */
export function connect(tenant, branch, wsUrl = "") {
  tenantId   = tenant;
  branchCode = branch;
  wsBaseUrl  = wsUrl;
  intentionalClose = false;
  reconnectIdx = 0;
  _open();
}

export function disconnect() {
  intentionalClose = true;
  _clearTimers();
  if (ws) {
    ws.close(1000, "App closing");
    ws = null;
  }
  _notifyState(false);
}

export function send(payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    warn("posWebSocket: send called but not connected");
    return false;
  }
  ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
  return true;
}

export function isConnected() {
  return ws?.readyState === WebSocket.OPEN;
}

/**
 * Register a handler for an incoming message action.
 * @param {string}   action  - e.g. "PRICE_CHANGE", "NOTIFICATION", "*" for all
 * @param {Function} fn      - fn(parsedMessage)
 * @returns {Function} unsubscribe
 */
export function onMessage(action, fn) {
  if (!handlers[action]) handlers[action] = [];
  handlers[action].push(fn);
  return () => {
    handlers[action] = handlers[action].filter((h) => h !== fn);
  };
}

/**
 * Listen for connection state changes.
 * @param {Function} fn - fn(isOnline: boolean)
 * @returns {Function} unsubscribe
 */
export function onStateChange(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

/**
 * Listen for this connection being forcibly replaced by another device/window connecting
 * as the same branch. Fires instead of an automatic reconnect — the caller should surface
 * this to the user rather than silently retrying.
 * @param {Function} fn - fn()
 * @returns {Function} unsubscribe
 */
export function onReplaced(fn) {
  replacedListeners.add(fn);
  return () => replacedListeners.delete(fn);
}

/**
 * Listen for this terminal being force-disconnected by an admin. Fires instead of an
 * automatic reconnect — the caller should log the user out so they have to re-authenticate
 * (and pick up any pending app update) rather than silently reconnecting.
 * @param {Function} fn - fn(reason: string)
 * @returns {Function} unsubscribe
 */
export function onKicked(fn) {
  kickedListeners.add(fn);
  return () => kickedListeners.delete(fn);
}

// ─── Internal ────────────────────────────────────────────────────────────────

function _open() {
  if (ws) {
    ws.onclose = null; // prevent old socket from triggering reconnect
    ws.close();
    ws = null;
  }

  const url = buildWsUrl();
  log("posWebSocket: connecting →", url);

  try {
    ws = new WebSocket(url, ["nex1.0"]);
  } catch (e) {
    logError("posWebSocket: WebSocket constructor failed:", e.message);
    _scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    log("posWebSocket: connected | branch:", branchCode);
    reconnectIdx = 0;
    _notifyState(true);
    _startPing();
  };

  ws.onmessage = (evt) => {
    _dispatch(evt.data);
  };

  ws.onerror = (e) => {
    logError("posWebSocket: error", e);
  };

  ws.onclose = (evt) => {
    log("posWebSocket: closed | code:", evt.code, "reason:", evt.reason);
    _clearTimers();
    _notifyState(false);

    if (evt.code === REPLACED_CLOSE_CODE) {
      // Another device/window connected as this same branch — don't fight over the slot.
      warn("posWebSocket: connection replaced by another device/window for this branch — not reconnecting");
      _notifyReplaced();
      return;
    }
    if (evt.code === KICKED_CLOSE_CODE) {
      warn("posWebSocket: terminal was disconnected by admin — not reconnecting:", evt.reason);
      _notifyKicked(evt.reason || "Disconnected by admin");
      return;
    }
    if (!intentionalClose) _scheduleReconnect();
  };
}

function _dispatch(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    // plain text message — wrap it
    msg = { action: "RAW", payload: raw };
  }

  const action = (msg.action || "").toUpperCase();
  log("posWebSocket: received action:", action);

  // call specific handlers then wildcard handlers
  [...(handlers[action] || []), ...(handlers["*"] || [])].forEach((fn) => {
    try { fn(msg); } catch (e) { logError("posWebSocket handler error:", e); }
  });
}

function _scheduleReconnect() {
  const delay = RECONNECT_DELAYS[Math.min(reconnectIdx, RECONNECT_DELAYS.length - 1)];
  reconnectIdx++;
  log("posWebSocket: reconnecting in", delay, "ms (attempt", reconnectIdx, ")");
  reconnectTimer = setTimeout(() => _open(), delay);
}

function _startPing() {
  const version = import.meta.env.VITE_APP_VERSION || "0.0.0";
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "PING", version }));
    }
  }, PING_INTERVAL_MS);
}

function _clearTimers() {
  if (reconnectTimer) { clearTimeout(reconnectTimer);  reconnectTimer = null; }
  if (pingTimer)      { clearInterval(pingTimer);      pingTimer      = null; }
}

function _notifyState(online) {
  stateListeners.forEach((fn) => { try { fn(online); } catch {} });
}

function _notifyReplaced() {
  replacedListeners.forEach((fn) => { try { fn(); } catch {} });
}

function _notifyKicked(reason) {
  kickedListeners.forEach((fn) => { try { fn(reason); } catch {} });
}
