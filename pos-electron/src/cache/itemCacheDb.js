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
