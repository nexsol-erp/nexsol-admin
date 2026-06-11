import { db } from "./itemCacheDb";
import { apiUrl } from "../utils/apiUrl";

function getActiveBranchCode() {
  const fromGlobal = String(globalThis.POS_BRANCH_CODE || "").trim();
  if (fromGlobal) return fromGlobal;
  return String(localStorage.getItem("selectedBranchCode") || "").trim();
}

// Backend fetch (paged)
async function fetchItemsPage({ query, page, size }) {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  if (!tenancyId || !token) throw new Error("Missing tenancyId/token. Please login again.");
  const branchCode = getActiveBranchCode();

  const params = new URLSearchParams();
  params.set("query", query || "");  // Always send query param (empty string if no query)
  params.set("page", String(page));
  params.set("size", String(size));
  params.set("sortField", "itemName");
  params.set("sortOrder", "asc");
  if (branchCode) params.set("branchCode", branchCode);

  const urls = [
    apiUrl(`/api/${tenancyId}/items-search-with-stock?${params.toString()}`),
    apiUrl(`/api/${tenancyId}/items-search?${params.toString()}`),
  ];

  let lastError = "";
  for (const url of urls) {
    console.log("Fetching items from:", url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Response status:", res.status);
    if (res.ok) {
      const data = await res.json();
      console.log("Fetched items page:", data);
      return data; // Spring Page
    }

    const t = await res.text().catch(() => "");
    lastError = `${url} -> (${res.status}) ${t || res.statusText}`;
    if (res.status !== 404 && res.status !== 403) break;
  }

  const err = `Item search failed: ${lastError}`;
  console.error(err);
  throw new Error(err);
}

// Normalize to one shape used by POS
function normalizeItem(x) {
  const rawAvailable =
    x.availableQty ??
    x.availableStock ??
    x.stockQty ??
    x.stock ??
    x.qty;

  const parsedAvailable = Number(rawAvailable);

  return {
    itemId: x.itemId ?? x.id ?? "",
    itemName: x.itemName ?? "",
    barcode: x.barcode ?? "",
    standardPrice: Number(x.standardPrice ?? 0),
    taxRate: Number(x.taxRate ?? 0),
    unitName: x.unitName ?? "",
    batchCode: x.batchCode ?? "",
    expiry: x.expiry ?? "",
    availableQty: Number.isFinite(parsedAvailable) ? parsedAvailable : null,
    category: x.category ?? "",
  };
}

// Directly set availableQty in cache from a physical stock count.
// Safer than relying on loadAllItemsToCache because the backend groups by batchCode;
// if the adjustment entry uses a different batchCode than the original stock, the
// last-batch-wins bulkPut can ignore the adjustment.
export async function applyPhysicalStockToCache(lines = []) {
  if (!Array.isArray(lines) || !lines.length) return;
  await db.transaction("rw", db.items, async () => {
    for (const line of lines) {
      const itemId = String(line.itemId ?? "").trim();
      const qty = Number(line.qty ?? 0);
      if (!itemId) continue;
      const item = await db.items.get(itemId);
      if (!item) continue;
      await db.items.put({ ...item, availableQty: qty });
    }
  });
}

export async function applyStockReceiptToCache(lines = []) {
  if (!Array.isArray(lines) || !lines.length) return;
  await db.transaction("rw", db.items, async () => {
    for (const line of lines) {
      const itemId = String(line.itemId ?? "").trim();
      const qty = Number(line.qty ?? 0);
      if (!itemId || qty <= 0) continue;
      const item = await db.items.get(itemId);
      if (!item) continue;
      const current = Number(item.availableQty);
      await db.items.put({
        ...item,
        availableQty: Number.isFinite(current) ? current + qty : qty,
      });
    }
  });
}

export async function clearItemCache() {
  await db.transaction("rw", db.items, db.meta, async () => {
    await db.items.clear();
    await db.meta.put({ key: "items_loaded", value: "0" });
    await db.meta.put({ key: "items_count", value: "0" });
  });
}

// ── Receipt mode cache ────────────────────────────────────────────────────────

export async function saveReceiptModesToCache(modes) {
  if (!Array.isArray(modes) || !modes.length) return;
  await db.receipt_modes.put({ key: "receipt_modes", data: modes });
}

export async function loadReceiptModesFromCache() {
  const row = await db.receipt_modes.get("receipt_modes");
  return Array.isArray(row?.data) ? row.data : [];
}

export async function refreshReceiptModesCache() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  if (!tenancyId || !token) return;
  try {
    const res = await fetch(apiUrl(`/api/${tenancyId}/receipt-modes`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      await saveReceiptModesToCache(rows);
    }
  } catch (_) {
    // network unavailable — cached data remains
  }
}

export async function hasCache() {
  const v = await db.meta.get("items_loaded");
  return v?.value === "1";
}

export async function loadAllItemsToCache({ pageSize = 500, onProgress } = {}) {
  console.log("loadAllItemsToCache started");

  // wipe old
  await db.transaction("rw", db.items, db.meta, async () => {
    await db.items.clear();
    await db.meta.put({ key: "items_loaded", value: "0" });
    await db.meta.put({ key: "items_count", value: "0" });
  });

  let page = 0;
  let total = 0;
  // Collect every raw row first so we can aggregate across batches correctly.
  // The server query groups by (itemId, batchCode, expiry), so one item can appear in
  // multiple rows (e.g. one batch with availableQty=2 and another with -1 from a
  // stock adjustment). bulkPut last-batch-wins would store 2 instead of the correct 1.
  const allRows = [];

  while (true) {
    const data = await fetchItemsPage({ query: "", page, size: pageSize });

    const content = Array.isArray(data?.content) ? data.content : [];
    total = Number(data?.totalElements || 0);

    const rows = content.map(normalizeItem).filter((r) => r.itemId);
    allRows.push(...rows);
    console.log("Page", page, "loaded", rows.length, "rows (running total:", allRows.length, ")");

    onProgress?.({ loaded: allRows.length, total, page });

    const last = Boolean(data?.last);
    if (last || rows.length === 0) break;
    page += 1;
  }

  // Aggregate per itemId: sum availableQty across all (batchCode, expiry) groups.
  // This matches sum(qtyIn) - sum(qtyOut) from item_batch_mst, which is the true stock.
  const byItemId = new Map();
  for (const row of allRows) {
    if (byItemId.has(row.itemId)) {
      const existing = byItemId.get(row.itemId);
      const a = Number(existing.availableQty);
      const b = Number(row.availableQty);
      existing.availableQty =
        Number.isFinite(a) && Number.isFinite(b) ? a + b
        : Number.isFinite(a) ? a
        : Number.isFinite(b) ? b
        : null;
    } else {
      byItemId.set(row.itemId, { ...row });
    }
  }

  const aggregated = Array.from(byItemId.values());
  await db.items.bulkPut(aggregated);
  const loaded = aggregated.length;
  console.log("loadAllItemsToCache: aggregated", allRows.length, "rows →", loaded, "unique items");

  await db.transaction("rw", db.meta, async () => {
    await db.meta.put({ key: "items_loaded", value: "1" });
    await db.meta.put({ key: "items_count", value: String(loaded) });
    await db.meta.put({ key: "items_loaded_at", value: new Date().toISOString() });
  });

  console.log("loadAllItemsToCache completed. Unique items:", loaded);

  // Refresh receipt modes alongside items so offline billing always has fresh data
  await refreshReceiptModesCache();

  return { loaded, total };
}

// Very fast local search (barcode exact OR name contains)
export async function localSearchItems(q, limit = 50) {
  const query = (q || "").trim().toLowerCase();
  console.log("localSearchItems called with query:", query);
  
  if (!query) {
    console.log("Query is empty, returning all items");
    // Return all items when query is empty
    const all = await db.items.limit(limit).toArray();
    console.log("Found items for empty query:", all.length);
    return all;
  }

  // barcode-first: exact barcode match first
  const exactBarcode = await db.items.where("barcode").equals(query).first();
  console.log("Exact barcode match:", exactBarcode);
  if (exactBarcode) return [exactBarcode];

  // name contains (simple)
  // (For huge item lists, upgrade to MiniSearch/Fuse later)
  const all = await db.items
    .filter((it) => (it.itemName || "").toLowerCase().includes(query) || (it.barcode || "").includes(query))
    .limit(limit)
    .toArray();

  console.log("localSearchItems found", all.length, "items matching:", query);
  return all;
}

export async function getItemByBarcode(barcode) {
  const b = (barcode || "").trim();
  if (!b) return null;
  return db.items.where("barcode").equals(b).first();
}

export async function findItemByName(name) {
  const q = (name || "").trim().toLowerCase();
  if (!q) return null;
  return db.items
    .filter((it) => (it.itemName || "").toLowerCase() === q)
    .first();
}

export async function applySaleToCache(lines = []) {
  if (!Array.isArray(lines) || !lines.length) return;

  await db.transaction("rw", db.items, async () => {
    for (const line of lines) {
      const itemId = String(line.itemId ?? "").trim();
      const batchCode = String(line.batchCode ?? "").trim();
      const soldQty = Number(line.qty ?? 0);

      if (!itemId || soldQty <= 0) continue;

      const candidates = await db.items.where("itemId").equals(itemId).toArray();
      if (!candidates.length) continue;

      const preferred = batchCode
        ? candidates.find((x) => String(x.batchCode ?? "").trim() === batchCode)
        : null;
      const target = preferred || candidates[0];
      if (!target) continue;

      const current = Number(target.availableQty);
      if (!Number.isFinite(current)) continue;
      const next = Math.max(current - soldQty, 0);
      await db.items.put({ ...target, availableQty: next });
    }
  });
}

// ── Quick-pick frequency tracking ────────────────────────────────────────────

export async function incrementItemFreq(itemId) {
  if (!itemId) return;
  const existing = await db.item_freq.get(itemId);
  await db.item_freq.put({ itemId, count: (existing?.count || 0) + 1 });
}

export async function getTopItems(n = 10) {
  const freqRows = await db.item_freq.toArray();
  freqRows.sort((a, b) => b.count - a.count);
  const topIds = freqRows.slice(0, n).map((r) => r.itemId);
  if (!topIds.length) return [];
  const items = await Promise.all(topIds.map((id) => db.items.get(id)));
  return items.filter(Boolean);
}

// TEST FUNCTION - check what's in the local cache database
export async function testLocalCache() {
  console.log("=== TEST LOCAL CACHE ===");
  try {
    const count = await db.items.count();
    console.log("Items in local cache:", count);
    
    if (count === 0) {
      console.log("⚠️ Cache is empty");
      return;
    }
    
    const items = await db.items.limit(10).toArray();
    console.log("Sample items:", items);
  } catch (e) {
    console.error("Error checking cache:", e);
  }
}

// TEST FUNCTION - add mock items for testing
export async function testAddMockItems() {
  console.log("=== ADDING MOCK ITEMS ===");
  const mockItems = [
    {
      itemId: "ITM001",
      itemName: "Apple",
      barcode: "EAN123",
      standardPrice: 50,
      taxRate: 5,
      unitName: "Kg",
      batchCode: "BATCH01",
      expiry: "2025-12-31",
    },
    {
      itemId: "ITM002",
      itemName: "Banana",
      barcode: "EAN124",
      standardPrice: 30,
      taxRate: 5,
      unitName: "Kg",
      batchCode: "BATCH02",
      expiry: "2025-12-31",
    },
    {
      itemId: "ITM003",
      itemName: "Orange Juice",
      barcode: "EAN125",
      standardPrice: 100,
      taxRate: 12,
      unitName: "Ltr",
      batchCode: "BATCH03",
      expiry: "2025-06-30",
    },
  ];
  
  try {
    await db.items.bulkPut(mockItems);
    console.log("✅ Added", mockItems.length, "mock items");
    
    const count = await db.items.count();
    console.log("Total items in cache now:", count);
  } catch (e) {
    console.error("Error adding mock items:", e);
  }
}

// TEST FUNCTION - call this from browser console to debug
export async function testBackendAPI() {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  
  console.log("=== TEST BACKEND API ===");
  console.log("tenancyId:", tenancyId);
  console.log("token:", token ? token.substring(0, 20) + "..." : "NO TOKEN");
  
  if (!tenancyId || !token) {
    console.error("Missing credentials!");
    return;
  }

  // Test 1: No filter
  console.log("\n--- Test 1: No query filter ---");
  try {
    const url1 = apiUrl(`/api/${tenancyId}/items-search?page=0&size=100&sortField=itemName&sortOrder=asc`);
    console.log("🔵 Calling API:", url1);
    
    const res1 = await fetch(url1, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data1 = await res1.json();
    console.log("   Total items found:", data1?.totalElements);
    console.log("   Content:", data1?.content?.length, "items");
  } catch (e) {
    console.error("Error:", e);
  }

  // Test 2: With "K" filter
  console.log("\n--- Test 2: With query='K' filter ---");
  try {
    const url2 = apiUrl(`/api/${tenancyId}/items-search?query=K&page=0&size=100&sortField=itemName&sortOrder=asc`);
    console.log("🔵 Calling API:", url2);
    
    const res2 = await fetch(url2, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data2 = await res2.json();
    console.log("   Total items found:", data2?.totalElements);
    console.log("   Content:", data2?.content?.length, "items");
    if (data2?.content?.length > 0) {
      console.log("✅ First item:", data2.content[0]);
      console.log("✅ Item keys:", Object.keys(data2.content[0]));
    }
    
    return data2;
  } catch (e) {
    console.error("Error:", e);
  }

  // Test 3: With empty string filter
  console.log("\n--- Test 3: With query='' (empty string) ---");
  try {
    const url3 = apiUrl(`/api/${tenancyId}/items-search?query=&page=0&size=100&sortField=itemName&sortOrder=asc`);
    console.log("🔵 Calling API:", url3);
    
    const res3 = await fetch(url3, {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    const data3 = await res3.json();
    console.log("   Total items found:", data3?.totalElements);
    console.log("   Content:", data3?.content?.length, "items");
    if (data3?.content?.length > 0) {
      console.log("✅ First item:", data3.content[0]);
    }
    
    return data3;
  } catch (e) {
    console.error("Error:", e);
  }
}
