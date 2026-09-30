// The only door between the React screens and the main process. Every call resolves to
// { ok: true, ...data } or { ok: false, error }.
const { contextBridge, ipcRenderer } = require("electron");

const info = ipcRenderer.sendSync("app:info-sync") || {};

const call = (channel) => (arg) => ipcRenderer.invoke(channel, arg);

function on(channel) {
  return (cb) => {
    if (typeof cb !== "function") return () => {};
    const h = (_e, payload) => cb(payload);
    ipcRenderer.on(channel, h);
    return () => ipcRenderer.removeListener(channel, h);
  };
}

contextBridge.exposeInMainWorld("WB", {
  version: info.version,
  packaged: info.packaged,
  server: info.server,

  checkServer: call("server:check"),
  saveServer: call("server:save"),
  relaunch: () => ipcRenderer.send("app:relaunch"),

  authState: call("auth:state"),
  login: call("auth:login"),
  logout: call("auth:logout"),
  branches: call("branch:list"),
  setBranch: call("branch:set"),

  presets: call("indicator:presets"),
  indicatorConfig: call("indicator:config"),
  saveIndicator: call("indicator:save"),
  ports: call("indicator:ports"),
  restartIndicator: call("indicator:restart"),
  monitor: call("indicator:monitor"),
  testParse: call("indicator:test"),
  exportProfile: call("indicator:export"),
  importProfile: call("indicator:import"),
  simulate: call("indicator:simulate"),

  rates: call("wb:rates"),
  vehicles: call("wb:vehicles"),
  materials: call("wb:materials"),
  history: call("wb:history"),
  quote: call("wb:quote"),
  save: call("wb:save"),
  reprint: call("wb:reprint"),
  preview: call("wb:preview"),

  tares: call("tare:list"),
  saveTare: call("tare:save"),
  addRate: call("rates:add"),

  report: call("report:get"),
  reportCsv: call("report:csv"),

  settings: call("settings:get"),
  savePrint: call("settings:save-print"),
  saveWeighing: call("settings:save-weighing"),
  pickFolder: call("settings:pick-folder"),
  openFolder: call("settings:open-folder"),
  printers: call("printers:list"),
  testPrint: call("print:test"),

  syncState: call("sync:state"),
  syncNow: call("sync:now"),
  seed: call("sync:seed"),

  onReading: on("wb:reading"),
  onSignal: on("wb:signal"),
  onIndicatorStatus: on("wb:indicator-status"),
  onRaw: on("wb:raw"),
  onFrame: on("wb:frame"),
  onSync: on("wb:sync"),
});
