import Dexie from "dexie";

export const db = new Dexie("pos_cache");

db.version(1).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
});

db.version(2).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
});

db.version(3).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
  pos_holds: "++id, heldAt, branchCode",
});

db.version(4).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
  pos_holds: "++id, heldAt, branchCode",
  pos_receipts: "++id, voucherNumber, savedAt, branchCode",
});

db.version(3).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
  pending_stock_transfers: "++id, status, queuedAt",
});

db.version(4).stores({
  items: "itemId, barcode, itemName",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
  pending_stock_transfers: "++id, status, queuedAt",
  kot_headers: "++id, tableId, kotDate, status",
  kot_lines: "++id, headerId",
  kot_sequence: "seqDate",
});

// v5: adds category index; clear items so they are re-fetched with category from backend
db.version(5).stores({
  items: "itemId, barcode, itemName, category",
  meta: "key",
  pending_sales: "++id, status, queuedAt",
  pending_stock_transfers: "++id, status, queuedAt",
  kot_headers: "++id, tableId, kotDate, status",
  kot_lines: "++id, headerId",
  kot_sequence: "seqDate",
}).upgrade(async (tx) => {
  await tx.table("items").clear();
  await tx.table("meta").put({ key: "items_loaded", value: "0" });
});
