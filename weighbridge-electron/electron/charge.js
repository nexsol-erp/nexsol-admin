// What a weighing costs. Mirrors the Qt weighbridge screen (nexsol-pos, NWeighBridgeMain),
// see plans/weighbridge-qt-logic-extraction.md in the project files:
//
//   fresh weighing                                      → full rate
//   previous weighing picked, still open (round_trip 0) → 0 (the paid first weighing's free return)
//   previous weighing picked, already closed (1)        → full rate
//   saved tare weight used                              → full rate
//
// The amount is never typed by the operator.

// Newest positive rate for a wheel type. rates: [{ wheelType, wheelRate, voucherDate }]
function rateFor(rates, wheelType) {
  if (!wheelType) return 0;
  let best = null;
  for (const r of rates || []) {
    if (r.wheelType !== wheelType || !(Number(r.wheelRate) > 0)) continue;
    if (!best || String(r.voucherDate || "") > String(best.voucherDate || "")) best = r;
  }
  return best ? Number(best.wheelRate) : 0;
}

// Newest rate per wheel type, for the wheel type picker.
function currentRates(rates) {
  const types = [...new Set((rates || []).map((r) => r.wheelType).filter(Boolean))];
  return types
    .map((wheelType) => ({ wheelType, wheelRate: rateFor(rates, wheelType) }))
    .filter((r) => r.wheelRate > 0)
    .sort((a, b) => a.wheelType.localeCompare(b.wheelType));
}

// source: { kind: "none" } | { kind: "previous", roundTrip } | { kind: "tare" }
function quote(rate, source) {
  const kind = source?.kind || "none";
  if (kind === "previous" && Number(source.roundTrip) !== 1) {
    return { amount: 0, reason: "Return weighing of a paid first weighing" };
  }
  if (kind === "previous") return { amount: rate, reason: "That weighing was already used for a return" };
  if (kind === "tare") return { amount: rate, reason: "Saved tare weight" };
  return { amount: rate, reason: "New weighing" };
}

// round_trip stored on the new row: 1 when it pairs with a first weight (previous or tare).
function roundTripFor(source) {
  const kind = source?.kind || "none";
  return kind === "previous" || kind === "tare" ? 1 : 0;
}

function netWeight(weight, firstWeight) {
  const fw = Number(firstWeight) || 0;
  if (!fw) return 0;
  return Math.abs((Number(weight) || 0) - fw);
}

module.exports = { rateFor, currentRates, quote, roundTripFor, netWeight };
