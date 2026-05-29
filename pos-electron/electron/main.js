const { app, BrowserWindow, ipcMain, Menu, session, net, shell, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");

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

// Reads pos-config.json — next to the .exe when packaged, or in project root in dev.
function getPosConfig() {
  const locations = app.isPackaged
    ? [path.join(path.dirname(process.execPath), "pos-config.json")]
    : [path.join(__dirname, "../pos-config.json")];
  for (const p of locations) {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) {}
  }
  return {};
}

// Resolve the backend API server URL.
// Priority: pos-config.json (next to .exe) → env var → hardcoded default.
function getApiServer() {
  const cfg = getPosConfig();
  if (cfg.apiServer) return String(cfg.apiServer).replace(/\/$/, "");
  if (process.env.VITE_API_SERVER) return String(process.env.VITE_API_SERVER).replace(/\/$/, "");
  return "http://localhost:8084";
}

function buildAppMenu() {
  const template = [
    {
      label: "Navigate",
      submenu: [
        { label: "POS", click: () => win?.webContents?.send("app:navigate", "pos") },
        { label: "Day End", click: () => win?.webContents?.send("app:navigate", "day-end") },
        { label: "Stock Transfer", click: () => win?.webContents?.send("app:navigate", "stock-transfer") },
        { label: "Accept Stock", click: () => win?.webContents?.send("app:navigate", "accept-stock") },
        { label: "Weigh Bridge", click: () => win?.webContents?.send("app:navigate", "weigh-bridge") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  console.log("createWindow called");
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // Packaged desktop app: disable web-security so file:// can reach the backend API
      webSecurity: !app.isPackaged,
    },
  });

  win.webContents.on("dom-ready", () => console.log("window dom-ready (HTML parsed, scripts starting)"));
  win.webContents.on("did-finish-load", () => console.log("window did-finish-load (all resources loaded)"));
  win.webContents.on("did-fail-load", (e, code, desc, url) =>
    console.error("window did-fail-load | code:", code, "| desc:", desc, "| url:", url)
  );
  win.webContents.on("render-process-gone", (e, details) =>
    console.error("render-process-gone:", JSON.stringify(details))
  );
  win.webContents.on("console-message", (e, level, msg, line, src) => {
    const lvl = ["verbose", "info", "warn", "error"][level] || "info";
    writeLog("renderer-console", lvl, `${msg}  (${src}:${line})`);
  });

  // Log any resource (JS/CSS) that fails to load — catches missing bundles early
  session.defaultSession.webRequest.onErrorOccurred((details) => {
    if (details.error !== "net::ERR_ABORTED") {
      console.error("resource load error:", details.error, "|", details.url);
    }
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
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Synchronous IPC so preload.js can read the runtime API server before
// the renderer starts, without an async round-trip.
ipcMain.on("config:get-api-server", (event) => {
  event.returnValue = getApiServer();
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
    ? path.join(path.dirname(process.execPath), "pos-config.json")
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

// ── Auto-updater ─────────────────────────────────────────────────────────────
// Downloads the new installer, reports progress to renderer, then launches it and quits.
ipcMain.handle("update:download-install", async (_evt, rawUrl) => {
  // Resolve relative URLs against the configured API server
  const url = rawUrl.startsWith("/") ? getApiServer() + rawUrl : rawUrl;
  const dest = path.join(os.tmpdir(), "TradeLink247-POS-Update.exe");

  try {
    await downloadFile(url, dest, (pct) => {
      win?.webContents?.send("update:progress", pct);
    });
    win?.webContents?.send("update:done");

    // Give the renderer a moment to show the success state, then launch and quit
    setTimeout(async () => {
      await shell.openPath(dest);
      app.quit();
    }, 1500);
  } catch (err) {
    win?.webContents?.send("update:error", err.message);
  }
});

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    const file = fs.createWriteStream(destPath);
    let received = 0;
    let total = 0;

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        file.destroy();
        reject(new Error(`Download failed: server returned ${response.statusCode}`));
        return;
      }
      total = parseInt(response.headers["content-length"] || "0", 10);

      response.on("data", (chunk) => {
        file.write(chunk);
        received += chunk.length;
        if (total > 0) onProgress(Math.round((received / total) * 100));
      });

      response.on("end", () => {
        file.end(resolve);
      });

      response.on("error", (err) => {
        file.destroy();
        reject(err);
      });
    });

    request.on("error", (err) => {
      file.destroy();
      reject(err);
    });

    request.end();
  });
}
