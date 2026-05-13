// Writes to browser console AND (in Electron) to <userData>/logs/pos.log
// via the IPC bridge exposed in preload.js.

function format(...args) {
  return args.map((a) => {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === "object") { try { return JSON.stringify(a); } catch (_) { return String(a); } }
    return String(a);
  }).join(" ");
}

function send(level, ...args) {
  const message = format(...args);
  // Write to browser console
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else console.log(...args);
  // Write to file via Electron IPC (no-op in browser dev mode)
  window.POS?.log?.(level, message);
}

export const log   = (...args) => send("info",  ...args);
export const warn  = (...args) => send("warn",  ...args);
export const error = (...args) => send("error", ...args);
