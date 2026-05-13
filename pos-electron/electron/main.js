const { app, BrowserWindow, ipcMain, Menu, session, net } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

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

// Resolve the backend API server URL.
// Priority: pos-config.json (next to .exe) → env var → hardcoded default.
function getApiServer() {
  if (app.isPackaged) {
    try {
      const cfgPath = path.join(path.dirname(process.execPath), "pos-config.json");
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (cfg.apiServer) return String(cfg.apiServer).replace(/\/$/, "");
    } catch (_) { /* no config file, fall through */ }
  }
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

ipcMain.handle("printers:list", async () => {
  return win.webContents.getPrintersAsync();
});

ipcMain.handle("print:html", async (_evt, { html, silent, deviceName }) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true },
  });
  await printWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return new Promise((resolve, reject) => {
    printWin.webContents.print(
      { silent: !!silent, deviceName: deviceName || "", printBackground: true },
      (success, errorType) => {
        printWin.close();
        if (!success) reject(new Error(errorType));
        else resolve(true);
      }
    );
  });
});

ipcMain.handle("window:close", async () => {
  if (!win) return false;
  win.close();
  return true;
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
    setTimeout(() => {
      spawn(dest, [], { detached: true, stdio: "ignore" }).unref();
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
