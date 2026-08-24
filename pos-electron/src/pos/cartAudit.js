// Audit trail for everything that changes the bill.
//
// Written because a customer disputed invoice N/2627/M01/044221 — three items they said
// they never ordered — and nothing on either side could answer it. The server showed a
// normal, internally consistent sale; the terminal kept no record of how the cart was
// built. pos_receipts holds only the last 10 bills and pos_holds deletes a hold the
// moment it is recalled, so within minutes there was nothing left to look at.
//
// These lines go to <userData>/logs/pos.log through the existing logger bridge. They are
// tagged [CART] so a day's activity can be pulled out with a single grep:
//
//     findstr "[CART]" pos.log
//
// RECALL is the line that matters most: recalling a held bill drops several items into
// the cart in one click, which is the most plausible way a customer ends up billed for
// something they never asked for.

import { log } from "../utils/logger";

const TAG = "[CART]";

/** Compact "k=v" rendering; blank and undefined fields are dropped rather than logged as noise. */
function fields(detail) {
  return Object.entries(detail)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" && v.includes(" ") ? JSON.stringify(v) : v}`)
    .join(" ");
}

/**
 * Record one cart event.
 * Never throws — an audit line must not be able to break a sale.
 */
export function auditCart(action, detail = {}) {
  try {
    log(`${TAG} ${action} ${fields(detail)}`.trim());
  } catch (_) {
    /* logging is best-effort */
  }
}

/** Summarise a set of cart rows for HOLD / RECALL / SAVE, where the whole basket matters. */
export function summariseItems(items = []) {
  const lines = items.length;
  const total = items.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const names = items
    .map((r) => `${r.item_name}x${r.qty}`)
    .join(", ");
  return { lines, total: Math.round(total * 100) / 100, items: names };
}
