const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("POS", {
  listPrinters: () => ipcRenderer.invoke("printers:list"),
  printHtml: (payload) => ipcRenderer.invoke("print:html", payload),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  onNavigate: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_event, page) => cb(page);
    ipcRenderer.on("app:navigate", handler);
    return () => ipcRenderer.removeListener("app:navigate", handler);
  },

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
});
