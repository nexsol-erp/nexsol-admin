import { db } from "../cache/itemCacheDb";
import { apiUrl } from "../utils/apiUrl";
import { log, warn, error as logError } from "../utils/logger";

/**
 * Persist a failed sale to IndexedDB so it can be retried when online.
 */
export async function queueSale({ tenantId, branchCode, token, payload, voucherNumber }) {
  await db.pending_sales.add({
    tenantId,
    branchCode,
    token,
    payload,
    voucherNumber,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  });
  log("offlineQueue: queued voucher:", voucherNumber);
}

/**
 * Number of sales waiting to be synced.
 */
export async function getPendingCount() {
  return db.pending_sales.where("status").equals("pending").count();
}

/**
 * Attempt to POST all pending sales to the server.
 * Returns { synced, failed } counts.
 * Safe to call at any time — skips immediately if offline.
 */
export async function syncPendingSales() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = await db.pending_sales.where("status").equals("pending").toArray();
  if (!pending.length) return { synced: 0, failed: 0 };

  log("offlineQueue: attempting sync of", pending.length, "pending sales");
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const url = apiUrl(`/api/${sale.tenantId}/sales-upload/${sale.branchCode}`);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sale.token}`,
          "X-Tenant-Id": sale.tenantId,
        },
        body: JSON.stringify(sale.payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logError("offlineQueue: server rejected voucher:", sale.voucherNumber, "| status:", res.status, "| body:", text);
        await db.pending_sales.update(sale.id, { retryCount: sale.retryCount + 1 });
        failed++;
        continue;
      }

      const text = await res.text().catch(() => "");
      let result = {};
      try { result = JSON.parse(text); } catch {}

      if (result.failedIds?.length > 0) {
        warn("offlineQueue: server failedIds for voucher:", sale.voucherNumber);
        await db.pending_sales.update(sale.id, {
          retryCount: sale.retryCount + 1,
          status: "server_error",
        });
        failed++;
        continue;
      }

      await db.pending_sales.delete(sale.id);
      log("offlineQueue: synced voucher:", sale.voucherNumber);
      synced++;
    } catch (e) {
      // Still offline or transient error — leave in queue
      logError("offlineQueue: network error syncing voucher:", sale.voucherNumber, e.message);
      failed++;
    }
  }

  log("offlineQueue: sync complete | synced:", synced, "| failed:", failed);
  return { synced, failed };
}
