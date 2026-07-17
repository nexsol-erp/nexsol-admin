const { contextBridge, ipcRenderer } = require("electron");

// Read the runtime API server (from pos-config.json) synchronously before
// any React code runs, so apiUrl() can use it instead of the build-time default.
const _apiServer = ipcRenderer.sendSync("config:get-api-server");
const _wsServer  = ipcRenderer.sendSync("config:get-ws-server");

contextBridge.exposeInMainWorld("POS", {
  apiServer: _apiServer,
  wsServer:  _wsServer,
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  printHtml: (payload) => ipcRenderer.invoke("print:html", payload),
  printToPDF: (payload) => ipcRenderer.invoke("print:to-pdf", payload),
  getPrinterPaperSize: (deviceName) => ipcRenderer.invoke("printer:get-paper-size", deviceName),
  savePrinterConfig: (settings) => ipcRenderer.invoke("config:save-printer", settings),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  // Quits the whole app (used to force-pick-up a pending update after being disconnected by an admin)
  quitApp: () => ipcRenderer.send("app:quit"),
  onNavigate: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_event, page) => cb(page);
    ipcRenderer.on("app:navigate", handler);
    return () => ipcRenderer.removeListener("app:navigate", handler);
  },

  // Notify main process of the logged-in user's roles so it can show/hide DevTools menu
  setUserRoles: (roles) => ipcRenderer.send("auth:roles-changed", roles),

  // Logger — writes to <userData>/logs/pos.log
  log: (level, message) => ipcRenderer.invoke("log:write", level, message),

  // Persistent device key — survives localStorage clears (stored in app userData dir)
  getDeviceKey: () => ipcRenderer.invoke("device:get-key"),
  setDeviceKey: (key) => ipcRenderer.invoke("device:set-key", key),


  // Update the Electron window title to include the active machine code
  setWindowTitle: (machineCode) => ipcRenderer.send("window:set-title", machineCode),


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
