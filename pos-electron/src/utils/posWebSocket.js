import { log, warn, error as logError } from "./logger";

// ─── Config ──────────────────────────────────────────────────────────────────

const RECONNECT_DELAYS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000]; // backoff steps
const PING_INTERVAL_MS = 30_000; // keep-alive ping

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

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildWsUrl() {
  const base = wsBaseUrl || deriveWsBase();
  return `${base}/ws?company=${encodeURIComponent(tenantId)}&branch=${encodeURIComponent(branchCode)}`;
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
  pingTimer = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "PING" }));
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
