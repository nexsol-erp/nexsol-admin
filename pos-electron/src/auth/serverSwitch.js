import { db } from "../cache/itemCacheDb";
import { getPendingCount } from "../pos/offlineQueue";
import { getPendingStockCount, getFailedStockCount } from "../stock-transfer/offlineStockQueue";
import { log, error as logError } from "../utils/logger";

// This PC's own preferences, not tied to any server. Everything else in localStorage
// (login, tenant, branch, machine code, branch lock, day-end records, settings) belongs to
// the old server and is cleared on a switch.
const KEEP_KEYS = ["pos_print_prefs", "posPrinter", "language"];

/**
 * Bills and stock transfers saved offline that haven't reached the server yet.
 * Returns -1 when the local database can't be read, which callers treat as "not safe".
 */
export async function countUnsynced() {
  try {
    const [sales, transfers, failed] = await Promise.all([
      getPendingCount(),
      getPendingStockCount(),
      getFailedStockCount(),
    ]);
    return sales + transfers + failed;
  } catch (e) {
    logError("serverSwitch: could not count unsynced records", e?.message);
    return -1;
  }
}

async function clearServerData() {
  const keep = {};
  for (const k of KEEP_KEYS) {
    const v = localStorage.getItem(k);
    if (v != null) keep[k] = v;
  }
  localStorage.clear();
  for (const [k, v] of Object.entries(keep)) localStorage.setItem(k, v);
  try {
    await db.delete(); // item cache, held carts, receipts; offline queues are already empty
  } catch (e) {
    logError("serverSwitch: could not clear local database", e?.message);
  }
}

/**
 * Moves this PC to another server: refuses while anything is waiting to sync (so bills
 * can't be sent to the wrong server), otherwise saves the new server, clears everything
 * that belonged to the old one and restarts the app.
 * Resolves { ok } or { ok: false, unsynced } / { ok: false, error }.
 */
export async function switchServer(config) {
  const unsynced = await countUnsynced();
  if (unsynced !== 0) return { ok: false, unsynced };
  const res = await window.POS?.server?.save(config);
  if (!res?.ok) return { ok: false, error: res?.error || "Could not save the server" };
  log("serverSwitch: switching to", res.config.apiServer);
  await clearServerData();
  window.POS.server.relaunch();
  return { ok: true };
}

/** First confirmation on a PC that has never been used: nothing to clear. */
export async function confirmServer(config) {
  const res = await window.POS?.server?.save(config);
  if (!res?.ok) return { ok: false, error: res?.error || "Could not save the server" };
  log("serverSwitch: confirmed", res.config.apiServer);
  return { ok: true, config: res.config };
}

export function hostOf(url) {
  return String(url || "").replace(/^[a-z]+:\/\//i, "");
}
