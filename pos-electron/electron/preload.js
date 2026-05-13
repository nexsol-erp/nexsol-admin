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
});
