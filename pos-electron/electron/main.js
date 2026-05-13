const { app, BrowserWindow, ipcMain, Menu, session, net } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

// Set custom userData path to avoid cache permission issues
if (!app.isPackaged) {
  app.setPath("userData", path.join(__dirname, "../.electron-cache"));
}

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

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    const devUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";
    win.loadURL(devUrl);
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // In the packaged app, intercept fetch('/api/...') calls (which resolve to
  // file:///api/... from the file:// origin) and forward them to the backend.
  if (app.isPackaged) {
    const apiServer = getApiServer();
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["file:///api/*"] },
      (details, callback) => {
        // details.url is like: file:///api/1/login?x=y
        const suffix = details.url.slice("file://".length); // /api/1/login?x=y
        callback({ redirectURL: apiServer + suffix });
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
