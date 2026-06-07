/**
 * TradeLink247 POS Launcher
 *
 * Permanent entry point for the POS application.
 * Responsibilities:
 *   1. Read installed version from versions/current.txt
 *   2. Check update server for newer version
 *   3. Present OPTIONAL / REQUIRED / OBSOLETE update UI
 *   4. Attempt delta patch download (POSDELTA1 format, ~90% smaller)
 *      → Fall back to full exe download if patch fails
 *   5. Verify SHA-256 checksum
 *   6. Update versions/current.txt
 *   7. Clean up old versions (keep current + 1 previous)
 *   8. Launch versions/{version}/pos-electron.exe and exit
 *
 * Delta patch format (POSDELTA1):
 *   "POSDELTA1"        9 bytes  magic
 *   newFileSize        8 bytes  big-endian int64
 *   sha256(newFile)   64 bytes  ASCII hex
 *   gzip(commands)             compressed command stream
 *     0x01 | srcOffset(8B BE) | length(4B BE)  COPY from old file
 *     0x02 | length(4B BE)    | data[length]   NEW literal bytes
 */

const { app, BrowserWindow, ipcMain, net } = require("electron");
const path   = require("path");
const fs     = require("fs");
const crypto = require("crypto");
const zlib   = require("zlib");
const { spawn } = require("child_process");

// ── Paths ──────────────────────────────────────────────────────────────────────

function launcherDir() {
  return app.isPackaged
    ? path.dirname(process.execPath)
    : path.join(__dirname, "..");
}

const VERSIONS_DIR   = () => path.join(launcherDir(), "versions");
const CURRENT_FILE   = () => path.join(VERSIONS_DIR(), "current.txt");
const CONFIG_FILE    = () => path.join(launcherDir(), "launcher-config.json");
const POS_EXE_NAME   = "pos-electron.exe";

// ── Logger ────────────────────────────────────────────────────────────────────

const logFile = path.join(app.getPath("userData"), "launcher.log");
fs.mkdirSync(path.dirname(logFile), { recursive: true });

function log(level, ...args) {
  const msg = args.map(a =>
    a instanceof Error ? (a.stack || a.message)
    : typeof a === "object" ? JSON.stringify(a)
    : String(a)
  ).join(" ");
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try { fs.appendFileSync(logFile, line); } catch (_) {}
  process.stdout.write(line);
}

// ── Config ────────────────────────────────────────────────────────────────────

function readConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), "utf8")); } catch (_) { return {}; }
}

function getApiServer() {
  const cfg = readConfig();
  if (cfg.apiServer) return String(cfg.apiServer).replace(/\/$/, "");
  return "https://www.tradelink247.com";
}

// ── Version management ────────────────────────────────────────────────────────

function getInstalledVersion() {
  try {
    const v = fs.readFileSync(CURRENT_FILE(), "utf8").trim();
    if (v) return v;
  } catch (_) {}
  // Scan versions dir as fallback
  try {
    const dirs = fs.readdirSync(VERSIONS_DIR())
      .filter(d => fs.statSync(path.join(VERSIONS_DIR(), d)).isDirectory())
      .sort((a, b) => compareVersions(b, a));
    if (dirs.length > 0) return dirs[0];
  } catch (_) {}
  return null;
}

function setInstalledVersion(version) {
  fs.mkdirSync(VERSIONS_DIR(), { recursive: true });
  fs.writeFileSync(CURRENT_FILE(), version, "utf8");
}

function versionExeExists(version) {
  const exePath = path.join(VERSIONS_DIR(), version, POS_EXE_NAME);
  return fs.existsSync(exePath);
}

function getPosExePath(version) {
  return path.join(VERSIONS_DIR(), version, POS_EXE_NAME);
}

// ── Version comparison ────────────────────────────────────────────────────────

function parseVer(v) {
  return (v || "0.0.0").split(".").map(s => parseInt(s, 10) || 0);
}

function compareVersions(a, b) {
  const av = parseVer(a), bv = parseVer(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] > bv[i]) return 1;
    if (av[i] < bv[i]) return -1;
  }
  return 0;
}

function isNewer(remote, local) {
  return compareVersions(remote, local) > 0;
}

// ── Cleanup old versions ──────────────────────────────────────────────────────

function cleanupOldVersions(currentVersion) {
  try {
    const versionsDir = VERSIONS_DIR();
    const dirs = fs.readdirSync(versionsDir)
      .filter(d => {
        try { return fs.statSync(path.join(versionsDir, d)).isDirectory(); } catch (_) { return false; }
      })
      .sort((a, b) => compareVersions(b, a)); // newest first

    // Keep the two newest versions
    const toDelete = dirs.slice(2);
    for (const dir of toDelete) {
      const dirPath = path.join(versionsDir, dir);
      log("info", `[cleanup] Removing old version: ${dir}`);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {
    log("warn", "[cleanup] Error:", e.message);
  }
}

// ── Checksum verification ─────────────────────────────────────────────────────

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", chunk => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// ── Download ──────────────────────────────────────────────────────────────────

function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);
    const tmp = destPath + ".tmp";
    const file = fs.createWriteStream(tmp);
    let received = 0, total = 0;

    request.on("response", (response) => {
      if (response.statusCode !== 200) {
        file.destroy();
        try { fs.unlinkSync(tmp); } catch (_) {}
        reject(new Error(`Server returned ${response.statusCode}`));
        return;
      }
      total = parseInt(response.headers["content-length"] || "0", 10);

      response.on("data", (chunk) => {
        file.write(chunk);
        received += chunk.length;
        if (total > 0) onProgress(Math.min(99, Math.round((received / total) * 100)));
      });

      response.on("end", () => {
        file.end(() => {
          try { fs.renameSync(tmp, destPath); } catch (e) {
            try { fs.copyFileSync(tmp, destPath); fs.unlinkSync(tmp); } catch (_) {}
          }
          onProgress(100);
          resolve();
        });
      });

      response.on("error", (err) => {
        file.destroy();
        try { fs.unlinkSync(tmp); } catch (_) {}
        reject(err);
      });
    });

    request.on("error", (err) => {
      file.destroy();
      try { fs.unlinkSync(tmp); } catch (_) {}
      reject(err);
    });

    request.end();
  });
}

// ── Main window ───────────────────────────────────────────────────────────────

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    backgroundColor: "#0b3a75",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(path.join(__dirname, "../ui/launcher.html"));

  win.webContents.once("did-finish-load", () => {
    win.webContents.send("launcher:version", app.getVersion());
    main().catch(e => {
      log("error", "[main] Fatal:", e.message);
      sendState("error", { message: e.message, canLaunch: false });
    });
  });
}

// ── IPC helpers ───────────────────────────────────────────────────────────────

function sendState(state, data = {}) {
  win?.webContents?.send("launcher:state", { state, data });
}

function sendProgress(pct) {
  win?.webContents?.send("launcher:progress", pct);
}

function waitForUserChoice() {
  return new Promise((resolve) => {
    function cleanup() {
      ipcMain.removeAllListeners("user:download");
      ipcMain.removeAllListeners("user:later");
      ipcMain.removeAllListeners("user:skip");
    }
    ipcMain.once("user:download", () => { cleanup(); resolve("download"); });
    ipcMain.once("user:later",    () => { cleanup(); resolve("later"); });
    ipcMain.once("user:skip",     () => { cleanup(); resolve("skip"); });
  });
}

function waitForRetry() {
  return new Promise((resolve) => {
    ipcMain.once("user:retry",        () => resolve("retry"));
    ipcMain.once("user:launch-anyway",() => resolve("launch-anyway"));
  });
}

// ── Launch POS ────────────────────────────────────────────────────────────────

function launchPos(version) {
  const exePath = getPosExePath(version);
  if (!fs.existsSync(exePath)) {
    throw new Error(`pos-electron.exe not found for version ${version}`);
  }

  // Copy launcher-config.json as pos-config.json into the version folder
  // so pos-electron can find its API server URL
  try {
    const cfg = readConfig();
    const posConfig = {
      apiServer: cfg.apiServer || "https://www.tradelink247.com",
      wsServer:  cfg.wsServer  || undefined,
    };
    const posConfigPath = path.join(VERSIONS_DIR(), version, "pos-config.json");
    fs.writeFileSync(posConfigPath, JSON.stringify(posConfig, null, 2), "utf8");
  } catch (e) {
    log("warn", "[launch] Could not write pos-config.json:", e.message);
  }

  log("info", `[launch] Starting ${exePath}`);
  const child = spawn(exePath, [], {
    detached: true,
    stdio:    "ignore",
    env: {
      ...process.env,
      PORTABLE_EXECUTABLE_DIR: path.join(VERSIONS_DIR(), version),
    },
  });
  child.unref();
}

// ── Delta patch applicator ────────────────────────────────────────────────────

const DELTA_MAGIC    = "POSDELTA1";
const DELTA_CMD_COPY = 0x01;
const DELTA_CMD_NEW  = 0x02;

/**
 * Apply a POSDELTA1 binary patch.
 * Reads oldPath + patchPath entirely into memory, writes result to newPath.
 * RAM usage: ~2 × exeSize (acceptable for a 79 MB file on a desktop PC).
 *
 * Throws if magic is wrong, write position is off, or checksum fails.
 */
function applyPatch(oldPath, patchPath, newPath) {
  const patchBuf = fs.readFileSync(patchPath);

  // ── Validate magic ────────────────────────────────────────────────────────
  if (patchBuf.toString("ascii", 0, 9) !== DELTA_MAGIC)
    throw new Error("Invalid patch file: bad magic header");

  // ── Read header ───────────────────────────────────────────────────────────
  const newSize          = Number(patchBuf.readBigInt64BE(9));
  const expectedChecksum = patchBuf.toString("ascii", 17, 81);

  // ── Decompress command stream ─────────────────────────────────────────────
  const compressed = patchBuf.subarray(81);
  const commands   = zlib.gunzipSync(compressed);

  // ── Read source file ──────────────────────────────────────────────────────
  const oldData = fs.readFileSync(oldPath);
  const newData = Buffer.alloc(newSize);

  let cmdPos = 0, writePos = 0;

  while (writePos < newSize) {
    if (cmdPos >= commands.length)
      throw new Error(`Patch truncated at byte ${writePos} of ${newSize}`);

    const cmd = commands.readUInt8(cmdPos++);

    if (cmd === DELTA_CMD_COPY) {
      const srcOff = Number(commands.readBigInt64BE(cmdPos)); cmdPos += 8;
      const length = commands.readUInt32BE(cmdPos);           cmdPos += 4;
      if (srcOff + length > oldData.length)
        throw new Error(`COPY out of bounds: offset=${srcOff} length=${length}`);
      oldData.copy(newData, writePos, srcOff, srcOff + length);
      writePos += length;

    } else if (cmd === DELTA_CMD_NEW) {
      const length = commands.readUInt32BE(cmdPos); cmdPos += 4;
      commands.copy(newData, writePos, cmdPos, cmdPos + length);
      cmdPos   += length;
      writePos += length;

    } else {
      throw new Error(`Unknown patch command: 0x${cmd.toString(16)} at cmd offset ${cmdPos - 1}`);
    }
  }

  if (writePos !== newSize)
    throw new Error(`Patch incomplete: wrote ${writePos} of ${newSize} bytes`);

  // ── Verify SHA-256 ────────────────────────────────────────────────────────
  const actualChecksum = crypto.createHash("sha256").update(newData).digest("hex");
  if (actualChecksum !== expectedChecksum)
    throw new Error(`Checksum mismatch after patch — file may be corrupt`);

  // ── Write result ──────────────────────────────────────────────────────────
  fs.writeFileSync(newPath, newData);
  log("info", `[patch] Applied successfully → ${writePos} bytes, checksum OK`);
}

// ── Core flow ─────────────────────────────────────────────────────────────────

async function main() {
  const apiServer      = getApiServer();
  const currentVersion = getInstalledVersion();

  log("info", `[main] Installed version: ${currentVersion || "none"}`);
  log("info", `[main] API server: ${apiServer}`);

  // ── 1. Check for updates ──────────────────────────────────────────────────
  sendState("checking");

  let updateData = null;
  try {
    const params = new URLSearchParams({ platform: "WINDOWS" });
    if (currentVersion) params.set("currentVersion", currentVersion);

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${apiServer}/pos-app/update-check?${params}`,
                              { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`Update check returned ${res.status}`);
      updateData = await res.json();
      log("info", "[main] Update check:", JSON.stringify(updateData));
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      throw fetchErr;
    }
  } catch (e) {
    log("warn", "[main] Update check failed:", e.message);
    // Non-fatal: launch whatever is installed locally
    if (currentVersion && versionExeExists(currentVersion)) {
      sendState("launching");
      launchPos(currentVersion);
      setTimeout(() => app.quit(), 1500);
      return;
    }
    sendState("error", {
      message: `Cannot reach update server and no local version is installed.\n${e.message}`,
      canLaunch: false,
    });
    return;
  }

  const hasUpdate = updateData?.updateAvailable;

  // ── 2. No update: launch current ──────────────────────────────────────────
  if (!hasUpdate) {
    if (!currentVersion || !versionExeExists(currentVersion)) {
      sendState("error", {
        message: "No POS version is installed. Please contact support.",
        canLaunch: false,
      });
      return;
    }
    sendState("launching");
    launchPos(currentVersion);
    setTimeout(() => app.quit(), 1500);
    return;
  }

  // ── 3. Update available ───────────────────────────────────────────────────
  const { updateType, latestVersion, downloadUrl, checksum, fileSize,
          releaseNotes, reason } = updateData;

  const isObsolete = reason === "CURRENT_VERSION_OBSOLETE";
  const isRequired = updateType === "REQUIRED" || isObsolete;

  // If update is OPTIONAL and we already have a running version, ask the user
  if (!isRequired && currentVersion && versionExeExists(currentVersion)) {
    sendState("update", updateData);
    const choice = await waitForUserChoice();

    if (choice === "later" || choice === "skip") {
      try {
        sendState("launching");
        launchPos(currentVersion);
        setTimeout(() => app.quit(), 1500);
      } catch (e) {
        log("warn", "[main] Launch failed after skip/later:", e.message);
        sendState("error", {
          message: `Could not start the current version.\n${e.message}`,
          canLaunch: false,
        });
      }
      return;
    }
    // choice === "download" → fall through
  } else {
    // REQUIRED or OBSOLETE: show dialog but don't offer skip
    sendState("update", updateData);
    await waitForUserChoice(); // only "download" button is shown
  }

  // ── 4. Download (delta first, full fallback) ──────────────────────────────
  const resolvedUrl = downloadUrl.startsWith("/") ? apiServer + downloadUrl : downloadUrl;
  const destDir     = path.join(VERSIONS_DIR(), latestVersion);
  const destPath    = path.join(destDir, POS_EXE_NAME);

  fs.mkdirSync(destDir, { recursive: true });

  sendState("download");

  let downloadOk = false;

  // ── 4a. Try delta patch ───────────────────────────────────────────────────
  if (updateData.deltaAvailable && currentVersion && versionExeExists(currentVersion)) {
    const patchUrl  = updateData.patchUrl.startsWith("/")
      ? apiServer + updateData.patchUrl : updateData.patchUrl;
    const patchPath = path.join(destDir, `patch-${currentVersion}-to-${latestVersion}.pos-patch`);

    log("info", `[main] Attempting delta: ${patchUrl} (${Math.round((updateData.patchSize || 0) / 1024)} KB)`);

    try {
      await downloadFile(patchUrl, patchPath, (pct) => sendProgress(pct));

      // Verify patch checksum
      if (updateData.patchChecksum) {
        const actual = await sha256File(patchPath);
        if (actual.toLowerCase() !== updateData.patchChecksum.toLowerCase())
          throw new Error("Patch file checksum mismatch — downloaded file may be corrupt");
      }

      log("info", "[main] Applying delta patch…");
      sendProgress(99);

      const currentExe = getPosExePath(currentVersion);
      applyPatch(currentExe, patchPath, destPath);

      // applyPatch already verifies the SHA-256 of the result internally
      // (the expected checksum is embedded in the patch header)
      try { fs.unlinkSync(patchPath); } catch (_) {}

      downloadOk = true;
      log("info", `[main] Delta update complete → ${latestVersion}`);
    } catch (e) {
      log("warn", `[main] Delta failed (${e.message}), falling back to full download`);
      try { fs.rmSync(destDir, { recursive: true, force: true }); } catch (_) {}
      fs.mkdirSync(destDir, { recursive: true });
    }
  }

  // ── 4b. Full download fallback ────────────────────────────────────────────
  if (!downloadOk) {
    log("info", `[main] Full download: ${resolvedUrl}`);
    try {
      await downloadFile(resolvedUrl, destPath, (pct) => sendProgress(pct));
    } catch (e) {
      log("error", "[main] Full download failed:", e.message);
      fs.rmSync(destDir, { recursive: true, force: true });
      sendState("error", {
        message: `Download failed: ${e.message}`,
        canLaunch: !!(currentVersion && versionExeExists(currentVersion)),
      });
      const choice = await waitForRetry();
      if (choice === "launch-anyway" && currentVersion && versionExeExists(currentVersion)) {
        sendState("launching");
        launchPos(currentVersion);
        setTimeout(() => app.quit(), 1500);
      } else {
        app.quit();
      }
      return;
    }

    // ── 5. Verify full exe checksum ─────────────────────────────────────────
    if (checksum) {
      log("info", "[main] Verifying checksum…");
      const actual = await sha256File(destPath);
      if (actual.toLowerCase() !== checksum.toLowerCase()) {
        log("error", `[main] Checksum mismatch! Expected ${checksum}, got ${actual}`);
        fs.rmSync(destDir, { recursive: true, force: true });
        sendState("error", {
          message: "Download verification failed (checksum mismatch). The file may be corrupted.",
          canLaunch: !!(currentVersion && versionExeExists(currentVersion)),
        });
        const choice = await waitForRetry();
        if (choice === "launch-anyway" && currentVersion && versionExeExists(currentVersion)) {
          sendState("launching");
          launchPos(currentVersion);
          setTimeout(() => app.quit(), 1500);
        } else {
          app.quit();
        }
        return;
      }
      log("info", "[main] Checksum OK");
    }
  }

  // ── 6. Activate new version ───────────────────────────────────────────────
  setInstalledVersion(latestVersion);
  cleanupOldVersions(latestVersion);
  log("info", `[main] Activated version ${latestVersion}`);

  // ── 7. Launch ─────────────────────────────────────────────────────────────
  sendState("launching");
  launchPos(latestVersion);
  setTimeout(() => app.quit(), 1500);
}

// ── App bootstrap ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  log("info", `Launcher started | version: ${app.getVersion()} | packaged: ${app.isPackaged}`);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
