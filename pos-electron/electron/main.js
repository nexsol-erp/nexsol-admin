const { app, BrowserWindow, ipcMain, Menu, session, screen } = require("electron");
const path = require("path");
const fs = require("fs");
let QRCode = null;
try { QRCode = require("qrcode"); } catch (_) { console.warn("qrcode module not available — run npm install"); }

// Set custom userData path to avoid cache permission issues
if (!app.isPackaged) {
  app.setPath("userData", path.join(__dirname, "../.electron-cache"));
}

// ── File logger ───────────────────────────────────────────────────────────────
// Writes to <userData>/logs/pos.log — readable while the app is running.
let _logStream = null;

function getLogStream() {
  if (_logStream) return _logStream;
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logFile = path.join(logDir, "pos.log");
    // Keep last 500 KB — rotate if larger
    try {
      if (fs.statSync(logFile).size > 512 * 1024) {
        fs.renameSync(logFile, logFile + ".old");
      }
    } catch (_) { /* file doesn't exist yet */ }
    _logStream = fs.createWriteStream(logFile, { flags: "a" });
    // Log the file path once so the user can find it
    const header = `\n${"=".repeat(60)}\nPOS started ${new Date().toISOString()}\nLog file: ${logFile}\n${"=".repeat(60)}\n`;
    _logStream.write(header);
    process.stdout.write(header);
  } catch (e) {
    process.stderr.write("Failed to open log file: " + e.message + "\n");
  }
  return _logStream;
}

function writeLog(source, level, ...args) {
  const message = args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object") { try { return JSON.stringify(a); } catch (_) { return String(a); } }
    return String(a);
  }).join(" ");

  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${source}] ${message}\n`;
  try { getLogStream()?.write(line); } catch (_) { /* ignore write errors */ }
  process.stdout.write(line);
}

// Capture all main-process console output to the log file
const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log   = (...a) => { writeLog("main", "info",  ...a); };
console.warn  = (...a) => { writeLog("main", "warn",  ...a); };
console.error = (...a) => { writeLog("main", "error", ...a); };

// IPC channel so the renderer process can also write to the same log file
ipcMain.handle("log:write", (_evt, level, message) => {
  writeLog("renderer", level, message);
});

let win;
let customerDisplayWin = null;

// Directory where the .exe lives — works for both portable and installed builds.
function exeDir() {
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
}

// Reads pos-config.json — next to the .exe when packaged, or in project root in dev.
function getPosConfig() {
  const locations = app.isPackaged
    ? [path.join(exeDir(), "pos-config.json")]
    : [path.join(__dirname, "../pos-config.json")];
  for (const p of locations) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {}
  }
  return {};
}

function savePosConfig(cfg) {
  const p = app.isPackaged
    ? path.join(exeDir(), "pos-config.json")
    : path.join(__dirname, "../pos-config.json");
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), "utf8");
}

// Resolve the backend API server URL.
// Priority: pos-config.json (next to .exe) → env var → hardcoded default.
function getApiServer() {
  const cfg = getPosConfig();
  if (cfg.apiServer) return String(cfg.apiServer).replace(/\/$/, "");
  if (process.env.VITE_API_SERVER) return String(process.env.VITE_API_SERVER).replace(/\/$/, "");
  return "https://www.tradelink247.com";
}

function getWsServer() {
  const cfg = getPosConfig();
  if (cfg.wsServer) return String(cfg.wsServer).replace(/\/$/, "");
  // Derive from apiServer: https → wss, http → ws
  const api = getApiServer();
  return api.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
}

let _userRoles = [];

function isDevUser() {
  return _userRoles.some((r) =>
    r === "ADMIN" || r === "admin" || r === "SYSTEM_ADMIN" || r === "system-admin"
  );
}

function buildAppMenu() {
  const template = [
    {
      label: "Navigate",
      submenu: [
        { label: "POS",            click: () => win?.webContents?.send("app:navigate", "pos") },
        { label: "Day End",        click: () => win?.webContents?.send("app:navigate", "day-end") },
        { label: "Stock Transfer", click: () => win?.webContents?.send("app:navigate", "stock-transfer") },
        { label: "Accept Stock",   click: () => win?.webContents?.send("app:navigate", "accept-stock") },
        { label: "Weigh Bridge",   click: () => win?.webContents?.send("app:navigate", "weigh-bridge") },
      ],
    },
  ];

  if (isDevUser()) {
    template.push({
      label: "Tools",
      submenu: [
        {
          label: "Developer Tools",
          accelerator: "F11",
          click: () => win?.webContents?.toggleDevTools(),
        },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.on("auth:roles-changed", (_evt, roles) => {
  _userRoles = Array.isArray(roles) ? roles : [];
  buildAppMenu();
});


function createSplash() {
  const splash = new BrowserWindow({
    width: 420,
    height: 260,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#0b3a75",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splash.loadFile(path.join(__dirname, "splash.html"));
  return splash;
}

function createWindow() {
  console.log("createWindow called");

  const splash = createSplash();

  win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: `TradeLink POS v${app.getVersion()}`,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !app.isPackaged,
    },
  });

  const appTitle = `TradeLink POS v${app.getVersion()}`;

  win.webContents.once("did-finish-load", () => {
    win.maximize();
    win.show();
    win.setTitle(appTitle);
    setTimeout(() => { if (!splash.isDestroyed()) splash.close(); }, 300);
  });

  // Prevent the page <title> tag from overriding the window title.
  win.on("page-title-updated", (e) => e.preventDefault());

  win.webContents.on("did-finish-load", () => console.log("page did-finish-load"));
  win.webContents.on("did-fail-load", (e, code, desc, url) => {
    console.error("did-fail-load | code:", code, "| desc:", desc, "| url:", url);
    if (!splash.isDestroyed()) splash.close();
  });
  win.webContents.on("render-process-gone", (e, details) =>
    console.error("render-process-gone:", JSON.stringify(details))
  );
  win.webContents.on("console-message", (e, level, msg, line, src) => {
    const lvl = ["verbose", "info", "warn", "error"][level] || "info";
    writeLog("renderer-console", lvl, `${msg}  (${src}:${line})`);
  });

  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (details.error !== "net::ERR_ABORTED")
      console.error("resource load error:", details.error, "|", details.url);
  });

  if (app.isPackaged) {
    const indexFile = path.join(__dirname, "../dist/index.html");
    console.log("loading file:", indexFile, "| exists:", fs.existsSync(indexFile));
    win.loadFile(indexFile);
  } else {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";
    console.log("loading dev url:", devUrl);
    win.loadURL(devUrl);
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  console.log("app ready | packaged:", app.isPackaged, "| version:", app.getVersion());
  console.log("userData:", app.getPath("userData"));

  if (app.isPackaged) {
    const apiServer = getApiServer();
    console.log("API server:", apiServer);
    // On Windows, fetch("/api/login") from a file:// page resolves to
    // file:///C:/api/login (drive-relative), not file:///api/login.
    // We match all file:// URLs and redirect any whose path contains /api/.
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["file:///*"] },
      (details, callback) => {
        const apiIdx = details.url.indexOf("/api/");
        if (apiIdx < 0) { callback({}); return; }
        const suffix = details.url.slice(apiIdx); // "/api/login" etc.
        const redirectURL = apiServer + suffix;
        console.log("webRequest redirect:", details.url, "->", redirectURL);
        callback({ redirectURL });
      }
    );
  }

  createWindow();
  buildAppMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Updates are handled by the TradeLink247-POS-Launcher.exe
  // This application no longer self-updates.
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Synchronous IPC so preload.js can read the runtime API server before
// the renderer starts, without an async round-trip.
ipcMain.on("app:version", (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.on("config:get-api-server", (event) => {
  event.returnValue = getApiServer();
});

ipcMain.on("config:get-ws-server", (event) => {
  event.returnValue = getWsServer();
});

ipcMain.handle("printers:list", async () => {
  return win.webContents.getPrintersAsync();
});

ipcMain.handle("print:html", (_evt, { html, silent, deviceName }) => {
  return new Promise((resolve, reject) => {
    // opacity:0 keeps the window on-screen so Chromium's compositor fully
    // renders it, while making it invisible to the user.
    // show:false / offscreen both skip the paint cycle, causing silent prints
    // to fire before the page is rendered and come out blank.
    const printWin = new BrowserWindow({
      width: 400,
      height: 1200,
      x: 0,
      y: 0,
      show: true,
      opacity: 0,
      frame: false,
      skipTaskbar: true,
      alwaysOnTop: false,
      webPreferences: { contextIsolation: true },
    });

    printWin.webContents.once("did-finish-load", () => {
      const cfg = getPosConfig();
      const wMm = cfg.printer?.paperWidthMm  || 72;
      const hMm = cfg.printer?.paperHeightMm || 3276;
      printWin.webContents.print(
        {
          silent: !!silent,
          deviceName: deviceName || "",
          printBackground: true,
          pageSize: { width: wMm * 1000, height: hMm * 1000 },
          margins: { marginType: "none" },
          scaleFactor: 100,
        },
        (success, errorType) => {
          printWin.destroy();
          if (!success) reject(new Error(errorType));
          else resolve(true);
        }
      );
    });

    printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  });
});

ipcMain.handle("window:close", async () => {
  if (!win) return false;
  win.close();
  return true;
});

ipcMain.handle("printer:get-paper-size", async (_evt, deviceName) => {
  try {
    const printers = await win.webContents.getPrintersAsync();
    const printer = printers.find((p) => p.name === deviceName);
    if (!printer) return null;
    const opts = printer.options || {};
    console.log("printer:get-paper-size | printer:", deviceName, "| options:", JSON.stringify(opts));
    // Look for dimensions in any option value, e.g. "Custom.72x3276mm" or "70x3276mm"
    const allText = Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(" ");
    const match = allText.match(/(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)\s*mm/);
    if (match) {
      return { paperWidthMm: parseFloat(match[1]), paperHeightMm: parseFloat(match[2]), raw: opts };
    }
    return { raw: opts };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle("config:save-printer", (_evt, printerSettings) => {
  const cfgPath = app.isPackaged
    ? path.join(exeDir(), "pos-config.json")
    : path.join(__dirname, "../pos-config.json");
  try {
    let current = {};
    try { current = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch (_) {}
    current.printer = { ...(current.printer || {}), ...printerSettings };
    fs.writeFileSync(cfgPath, JSON.stringify(current, null, 2), "utf8");
    console.log("config:save-printer | saved:", JSON.stringify(current.printer));
    return true;
  } catch (e) {
    console.error("config:save-printer | error:", e.message);
    return false;
  }
});

// ── WeighBridge serial port ───────────────────────────────────────────────────
let SerialPort = null;
let SerialPortList = null;
try {
  const sp = require("serialport");
  SerialPort = sp.SerialPort;
  SerialPortList = sp.SerialPort.list || sp.list;
} catch (_) {
  console.warn("serialport module not available — WB serial disabled");
}

let wbSerialPort = null;

ipcMain.handle("wb:list-ports", async () => {
  if (!SerialPort) return [];
  try { return await SerialPort.list(); } catch (e) { return []; }
});

ipcMain.handle("wb:open-port", async (_evt, { path, baudRate = 9600 }) => {
  try {
    if (wbSerialPort && wbSerialPort.isOpen) wbSerialPort.close();
    if (!SerialPort) return { error: "serialport not available" };
    wbSerialPort = new SerialPort({ path, baudRate, autoOpen: false });
    let buf = "";
    wbSerialPort.on("data", (data) => {
      for (const ch of data.toString()) {
        if (ch === "\x02") { buf = ""; }
        else if (ch === "\r" || ch === "\n") {
          const w = parseInt(buf.trim(), 10);
          if (!isNaN(w)) win?.webContents?.send("wb:weight", w);
          buf = "";
        } else { buf += ch; }
      }
    });
    wbSerialPort.on("error", (e) => console.error("wb serial error:", e.message));
    return await new Promise((resolve) => {
      wbSerialPort.open((err) => {
        if (err) { wbSerialPort = null; resolve({ error: err.message }); }
        else resolve({ ok: true });
      });
    });
  } catch (e) { return { error: e.message }; }
});

ipcMain.handle("wb:close-port", async () => {
  try {
    if (wbSerialPort && wbSerialPort.isOpen) wbSerialPort.close();
    wbSerialPort = null;
  } catch (_) {}
  return { ok: true };
});

// ── UPI Customer Display ──────────────────────────────────────────────────────

function buildCustomerDisplayHtml({ qrDataUrl, amount, shopName }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0b3a75;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; overflow: hidden;
    user-select: none;
  }
  .shop-name { font-size: 28px; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px; opacity: 0.9; }
  .subtitle  { font-size: 16px; opacity: 0.65; margin-bottom: 32px; }
  .qr-card {
    background: #fff; border-radius: 16px; padding: 24px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
  }
  .qr-card img { width: 280px; height: 280px; display: block; }
  .amount-label { font-size: 14px; color: #555; font-weight: 600; }
  .amount-value { font-size: 48px; font-weight: 800; color: #0b3a75; letter-spacing: -1px; }
  .instruction  { font-size: 14px; color: #666; margin-top: 4px; }
  .upi-apps { display: flex; gap: 12px; align-items: center; margin-top: 4px; }
  .upi-badge {
    background: #f5f5f5; border-radius: 8px; padding: 4px 10px;
    font-size: 12px; color: #333; font-weight: 600;
  }
  /* ── Success overlay ── */
  .success-overlay {
    display: none; position: fixed; inset: 0;
    background: #00b96b;
    flex-direction: column; align-items: center; justify-content: center;
    animation: fadeIn 0.4s ease;
  }
  .success-overlay.show { display: flex; }
  .success-icon { font-size: 100px; margin-bottom: 24px; }
  .success-text { font-size: 48px; font-weight: 800; }
  .success-sub  { font-size: 22px; opacity: 0.85; margin-top: 12px; }
  @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
  /* ── Waiting pulse ── */
  .waiting {
    display: flex; align-items: center; gap: 8px;
    margin-top: 20px; font-size: 15px; opacity: 0.75;
  }
  .dot {
    width: 8px; height: 8px; border-radius: 50%; background: #90caf9;
    animation: pulse 1.2s ease-in-out infinite;
  }
  .dot:nth-child(2) { animation-delay: 0.2s; }
  .dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
</style>
</head>
<body>
  <div class="shop-name">${shopName || "Store"}</div>
  <div class="subtitle">Scan QR to pay</div>
  <div class="qr-card">
    <img src="${qrDataUrl}" alt="UPI QR" />
    <div class="amount-label">Amount to Pay</div>
    <div class="amount-value">&#8377;${Number(amount).toFixed(2)}</div>
    <div class="instruction">Scan with any UPI app</div>
    <div class="upi-apps">
      <span class="upi-badge">GPay</span>
      <span class="upi-badge">PhonePe</span>
      <span class="upi-badge">Paytm</span>
      <span class="upi-badge">BHIM</span>
    </div>
  </div>
  <div class="waiting">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    <span>Waiting for payment</span>
  </div>

  <div class="success-overlay" id="successOverlay">
    <div class="success-icon">&#10004;</div>
    <div class="success-text">Payment Received!</div>
    <div class="success-sub">&#8377;${Number(amount).toFixed(2)} &mdash; Thank you</div>
  </div>

  <script>
    // Main process sends this event when PhonePe confirms payment
    const { ipcRenderer } = require("electron");
    ipcRenderer.on("upi:payment-success", () => {
      document.getElementById("successOverlay").classList.add("show");
    });
  </script>
</body>
</html>`;
}

ipcMain.handle("upi:show-customer-display", async (_evt, { qrData, amount, shopName }) => {
  try {
    if (!QRCode) { console.warn("upi:show-customer-display — qrcode module not loaded"); return { error: "qrcode not available" }; }

    // Find the secondary display; fall back to primary if only one monitor
    const displays = screen.getAllDisplays();
    const primary  = screen.getPrimaryDisplay();
    const secondary = displays.find((d) => d.id !== primary.id) || primary;
    const { x, y, width, height } = secondary.bounds;

    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 320, margin: 1, color: { dark: "#0b3a75", light: "#ffffff" } });

    if (customerDisplayWin && !customerDisplayWin.isDestroyed()) {
      customerDisplayWin.close();
    }

    customerDisplayWin = new BrowserWindow({
      x, y, width, height,
      fullscreen: secondary.id !== primary.id, // fullscreen only on external monitor
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        contextIsolation: false,   // needed so inline <script> can require("electron")
        nodeIntegration: true,
      },
    });

    const html = buildCustomerDisplayHtml({ qrDataUrl, amount, shopName });
    customerDisplayWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    customerDisplayWin.on("closed", () => { customerDisplayWin = null; });

    console.log("upi:show-customer-display | display:", secondary.id, "| amount:", amount);
    return { ok: true };
  } catch (e) {
    console.error("upi:show-customer-display error:", e.message);
    return { error: e.message };
  }
});

ipcMain.handle("upi:payment-success", async () => {
  if (customerDisplayWin && !customerDisplayWin.isDestroyed()) {
    customerDisplayWin.webContents.send("upi:payment-success");
    setTimeout(() => {
      if (customerDisplayWin && !customerDisplayWin.isDestroyed()) customerDisplayWin.close();
      customerDisplayWin = null;
    }, 3000);
  }
});

ipcMain.handle("upi:hide-customer-display", async () => {
  if (customerDisplayWin && !customerDisplayWin.isDestroyed()) {
    customerDisplayWin.close();
    customerDisplayWin = null;
  }
});

