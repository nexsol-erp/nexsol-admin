import { db } from "../cache/itemCacheDb";
import { nowIST, todayIST } from "../utils/timeUtils";

function round2(v) { return Math.round(Number(v) * 100) / 100; }
function todayStr() { return todayIST(); }

export async function getNextKotNumber() {
  const today = todayStr();
  return db.transaction("rw", db.kot_sequence, async () => {
    const rec  = await db.kot_sequence.get(today);
    const next = (rec?.nextValue || 0) + 1;
    await db.kot_sequence.put({ seqDate: today, nextValue: next });
    return `KOT-${today.replace(/-/g, "")}-${String(next).padStart(3, "0")}`;
  });
}

export async function getOpenKotForTable(tableId) {
  return db.kot_headers
    .where("tableId").equals(tableId)
    .and((h) => h.status !== "closed" && h.status !== "converted")
    .first();
}

export async function getKotLines(headerId) {
  return db.kot_lines.where("headerId").equals(headerId).toArray();
}

export async function saveKot(header, lines) {
  return db.transaction("rw", db.kot_headers, db.kot_lines, async () => {
    let headerId = header.id;
    if (!headerId) {
      headerId = await db.kot_headers.add({ ...header, createdAt: nowIST() });
    } else {
      await db.kot_headers.put(header);
      await db.kot_lines.where("headerId").equals(headerId).delete();
    }
    for (const line of lines) {
      await db.kot_lines.add({ ...line, headerId });
    }
    return headerId;
  });
}

export async function markKotPrinted(headerId, kotNumber) {
  const h = await db.kot_headers.get(headerId);
  if (!h) return;
  await db.kot_headers.put({ ...h, status: "printed", kotNumber });
}

export async function convertKot(headerId) {
  const h = await db.kot_headers.get(headerId);
  if (!h) return;
  await db.kot_headers.put({ ...h, status: "converted" });
}

export async function closeKot(headerId) {
  const h = await db.kot_headers.get(headerId);
  if (!h) return;
  await db.kot_headers.put({ ...h, status: "closed" });
}

export async function getAllActiveKots() {
  return db.kot_headers
    .filter((h) => h.status !== "closed" && h.status !== "converted")
    .toArray();
}

// Split: move selected items (identified by itemId+batchCode) from source to target table.
// If target has no active KOT, a new one is created automatically.
export async function splitKot(sourceHeaderId, itemsToMove, targetTableId, targetTableName) {
  return db.transaction("rw", db.kot_headers, db.kot_lines, async () => {
    const moveSet  = new Set(itemsToMove.map((m) => `${m.itemId}|${m.batchCode || ""}`));
    const allLines = await db.kot_lines.where("headerId").equals(sourceHeaderId).toArray();
    const toMove   = allLines.filter((l) => moveSet.has(`${l.itemId}|${l.batchCode || ""}`));
    if (!toMove.length) return null;

    // Find or create target KOT header
    let targetHeader = await db.kot_headers
      .where("tableId").equals(targetTableId)
      .and((h) => h.status !== "closed" && h.status !== "converted")
      .first();

    let targetHeaderId;
    if (targetHeader) {
      targetHeaderId = targetHeader.id;
    } else {
      targetHeaderId = await db.kot_headers.add({
        tableId:   targetTableId,
        tableName: targetTableName,
        salesMan:  "",
        status:    "open",
        kotDate:   todayIST(),
        kotNumber: null,
        createdAt: nowIST(),
      });
    }

    // Move each line (merge qty if same item already in target)
    for (const line of toMove) {
      const { id, headerId, ...rest } = line;
      const existing = await db.kot_lines
        .where("headerId").equals(targetHeaderId)
        .and((l) => l.itemId === rest.itemId && (l.batchCode || "") === (rest.batchCode || ""))
        .first();
      if (existing) {
        const newQty = round2((Number(existing.qty) || 0) + (Number(rest.qty) || 0));
        await db.kot_lines.update(existing.id, { qty: newQty, amount: round2(newQty * Number(existing.rate)) });
      } else {
        await db.kot_lines.add({ ...rest, headerId: targetHeaderId, kotPrinted: false });
      }
      await db.kot_lines.delete(id);
    }

    // If source is now empty, close it
    const remaining = await db.kot_lines.where("headerId").equals(sourceHeaderId).count();
    if (remaining === 0) {
      await db.kot_headers.update(sourceHeaderId, { status: "closed" });
    }

    return targetHeaderId;
  });
}

// Merge: bring all lines from sourceHeader into targetHeader, then close source.
export async function mergeKots(sourceHeaderId, targetHeaderId) {
  return db.transaction("rw", db.kot_headers, db.kot_lines, async () => {
    const sourceLines = await db.kot_lines.where("headerId").equals(sourceHeaderId).toArray();
    for (const line of sourceLines) {
      const { id, headerId, ...rest } = line;
      const existing = await db.kot_lines
        .where("headerId").equals(targetHeaderId)
        .and((l) => l.itemId === rest.itemId && (l.batchCode || "") === (rest.batchCode || ""))
        .first();
      if (existing) {
        const newQty = round2((Number(existing.qty) || 0) + (Number(rest.qty) || 0));
        await db.kot_lines.update(existing.id, { qty: newQty, amount: round2(newQty * Number(existing.rate)) });
      } else {
        await db.kot_lines.add({ ...rest, headerId: targetHeaderId, kotPrinted: false });
      }
      await db.kot_lines.delete(id);
    }
    await db.kot_headers.update(sourceHeaderId, { status: "closed" });
  });
}
