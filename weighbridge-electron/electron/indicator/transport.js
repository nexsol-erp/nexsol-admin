// Gets bytes from the indicator: a serial port (serialport) or a TCP socket (serial-to-
// Ethernet converters and network indicators). Reconnects on its own, sends the poll
// command for indicators that only answer when asked, and never writes anything else.
//
// Events: data (Buffer), status { state: "connecting"|"connected"|"closed"|"error", message }

const { EventEmitter } = require("events");
const net = require("net");
const { unescapeCtl } = require("./profiles");

let SerialPort = null;
try {
  ({ SerialPort } = require("serialport"));
} catch (e) {
  console.warn("serialport module not available:", e.message);
}

const RETRY_MS = 3000;

async function listPorts() {
  if (!SerialPort) return [];
  try {
    return (await SerialPort.list()).map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer || "",
      serialNumber: p.serialNumber || "",
      vendorId: p.vendorId || "",
      productId: p.productId || "",
    }));
  } catch (_) {
    return [];
  }
}

class Transport extends EventEmitter {
  constructor(profile) {
    super();
    this.profile = profile;
    this.t = profile.transport || {};
    this.conn = null;
    this.stopped = true;
    this.retryTimer = null;
    this.pollTimer = null;
  }

  start() {
    this.stopped = false;
    this._open();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    const c = this.conn;
    this.conn = null;
    if (!c) return;
    try {
      if (this.t.type === "tcp") c.destroy();
      else if (c.isOpen) c.close();
    } catch (_) { /* already closed */ }
  }

  _status(state, message = "") {
    this.emit("status", { state, message });
  }

  _retry(message) {
    clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.conn = null;
    if (this.stopped) return;
    this._status("error", message);
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this._open(), RETRY_MS);
  }

  _open() {
    if (this.stopped) return;
    if (this.t.type === "tcp") this._openTcp();
    else this._openSerial();
  }

  _openSerial() {
    if (!SerialPort) { this._status("error", "Serial support is not installed"); return; }
    const t = this.t;
    if (!t.path) { this._status("error", "Choose the COM port in Settings"); return; }
    this._status("connecting", t.path);
    let port;
    try {
      port = new SerialPort({
        path: t.path,
        baudRate: Number(t.baudRate) || 9600,
        dataBits: Number(t.dataBits) || 8,
        parity: t.parity || "none",
        stopBits: Number(t.stopBits) || 1,
        rtscts: t.flowControl === "hardware",
        xon: t.flowControl === "software",
        xoff: t.flowControl === "software",
        autoOpen: false,
      });
    } catch (e) {
      this._retry(e.message);
      return;
    }
    this.conn = port;
    port.on("data", (d) => this.emit("data", d));
    port.on("error", (e) => this._retry(e.message));
    port.on("close", () => { if (this.conn === port) this._retry("Port closed (cable unplugged?)"); });
    port.open((err) => {
      if (err) { this._retry(err.message); return; }
      // Some indicators only transmit (or take power) when DTR/RTS are raised.
      if (t.flowControl !== "hardware") {
        port.set({ dtr: t.dtr !== false, rts: t.rts !== false }, () => {});
      }
      this._status("connected", t.path);
      this._startPolling();
    });
  }

  _openTcp() {
    const t = this.t;
    if (!t.host) { this._status("error", "Enter the indicator's IP address in Settings"); return; }
    this._status("connecting", `${t.host}:${t.port}`);
    const sock = net.createConnection({ host: t.host, port: Number(t.port) || 4001 });
    this.conn = sock;
    sock.setKeepAlive(true, 10000);
    sock.on("connect", () => { this._status("connected", `${t.host}:${t.port}`); this._startPolling(); });
    sock.on("data", (d) => this.emit("data", d));
    sock.on("error", (e) => this._retry(e.message));
    sock.on("close", () => { if (this.conn === sock) this._retry("Connection closed"); });
  }

  _startPolling() {
    clearInterval(this.pollTimer);
    if (this.profile.mode !== "poll") return;
    const cmd = unescapeCtl(this.profile.poll?.command || "");
    if (!cmd) return;
    const every = Math.max(100, Number(this.profile.poll?.intervalMs) || 500);
    this.pollTimer = setInterval(() => this.write(cmd), every);
  }

  write(text) {
    const c = this.conn;
    if (!c) return;
    try { c.write(Buffer.from(text, "latin1")); } catch (_) { /* reconnect will follow */ }
  }
}

module.exports = { Transport, listPorts };
