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
