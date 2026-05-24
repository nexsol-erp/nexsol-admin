import { db } from "../cache/itemCacheDb";
import { apiUrl } from "../utils/apiUrl";
import { log, warn, error as logError } from "../utils/logger";

export async function queueStockTransfer({ tenantId, branchCode, token, payload, voucherNumber }) {
  await db.pending_stock_transfers.add({
    tenantId,
    branchCode,
    token,
    payload,
    voucherNumber,
    queuedAt: new Date().toISOString(),
    retryCount: 0,
    status: "pending",
  });
  log("offlineStockQueue: queued transfer:", voucherNumber);
}

export async function getPendingStockCount() {
  return db.pending_stock_transfers.where("status").equals("pending").count();
}

export async function syncPendingStockTransfers() {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  const pending = await db.pending_stock_transfers.where("status").equals("pending").toArray();
  if (!pending.length) return { synced: 0, failed: 0 };

  log("offlineStockQueue: attempting sync of", pending.length, "pending transfers");
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    const urls = [
      apiUrl(`/api/${item.tenantId}/stock-transfers/out`),
      apiUrl(`/api/${item.tenantId}/stock-transfer/out`),
      apiUrl(`/api/${item.tenantId}/stock-transfer`),
    ];

    let ok = false;
    let lastErr = "";
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${item.token}`,
            "X-Tenant-Id": item.tenantId,
          },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          ok = true;
          break;
        }
        const text = await res.text().catch(() => "");
        lastErr = `${res.status} ${text || res.statusText}`;
        if (res.status !== 404) break;
      } catch (e) {
        lastErr = e.message;
        break;
      }
    }

    if (ok) {
      await db.pending_stock_transfers.delete(item.id);
      log("offlineStockQueue: synced transfer:", item.voucherNumber);
      synced++;
    } else {
      logError("offlineStockQueue: failed transfer:", item.voucherNumber, lastErr);
      await db.pending_stock_transfers.update(item.id, { retryCount: item.retryCount + 1 });
      failed++;
    }
  }

  log("offlineStockQueue: sync complete | synced:", synced, "| failed:", failed);
  return { synced, failed };
}
