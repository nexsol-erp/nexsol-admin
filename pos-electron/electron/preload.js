const { contextBridge, ipcRenderer } = require("electron");

// Read the runtime API server (from pos-config.json) synchronously before
// any React code runs, so apiUrl() can use it instead of the build-time default.
const _apiServer = ipcRenderer.sendSync("config:get-api-server");

contextBridge.exposeInMainWorld("POS", {
  apiServer: _apiServer,
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  printHtml: (payload) => ipcRenderer.invoke("print:html", payload),
  getPrinterPaperSize: (deviceName) => ipcRenderer.invoke("printer:get-paper-size", deviceName),
  savePrinterConfig: (settings) => ipcRenderer.invoke("config:save-printer", settings),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  onNavigate: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_event, page) => cb(page);
    ipcRenderer.on("app:navigate", handler);
    return () => ipcRenderer.removeListener("app:navigate", handler);
  },

  // Logger — writes to <userData>/logs/pos.log
  log: (level, message) => ipcRenderer.invoke("log:write", level, message),

  // Auto-updater
  downloadAndInstall: (url) => ipcRenderer.invoke("update:download-install", url),
  onDownloadProgress: (cb) => {
    const handler = (_evt, pct) => cb(pct);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },
  onDownloadDone: (cb) => {
    ipcRenderer.once("update:done", () => cb());
  },
  onDownloadError: (cb) => {
    ipcRenderer.once("update:error", (_evt, msg) => cb(msg));
  },

  // UPI customer display (second monitor)
  upi: {
    showCustomerDisplay: (payload) => ipcRenderer.invoke("upi:show-customer-display", payload),
    paymentSuccess: () => ipcRenderer.invoke("upi:payment-success"),
    hideCustomerDisplay: () => ipcRenderer.invoke("upi:hide-customer-display"),
  },

  // WeighBridge serial port
  wb: {
    listPorts: () => ipcRenderer.invoke("wb:list-ports"),
    openPort: (cfg) => ipcRenderer.invoke("wb:open-port", cfg),
    closePort: () => ipcRenderer.invoke("wb:close-port"),
    onWeight: (cb) => {
      const h = (_evt, w) => cb(w);
      ipcRenderer.on("wb:weight", h);
      return () => ipcRenderer.removeListener("wb:weight", h);
    },
  },
});
