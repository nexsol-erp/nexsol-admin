import Dexie from "dexie";

export const db = new Dexie("pos_cache");

db.version(1).stores({
  items: "itemId, barcode, itemName", // indexes
  meta: "key",
});
