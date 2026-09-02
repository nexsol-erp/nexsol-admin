/**
 * Catches a barcode typed into a quantity box, at the point of entry.
 *
 * V047 put `CHECK (qty < 10000000)` on the stock tables because this had already happened in
 * production: a scanner fired into the quantity field and an EAN-13 was stored as a count.
 * Seven rows still need a physical count as a result, and the true quantities are not
 * recoverable.
 *
 * The constraint is the floor, not the answer. It rejects the row *after* the user has filled
 * in the whole form, and reports a raw violation nobody can act on:
 *
 *     ERROR: new row for relation "physical_stock_mst" violates check constraint
 *     "ck_physical_stock_qty_sane"
 *
 * This says "that looks like a barcode" while the cursor is still in the field.
 *
 * Deliberately not a replacement for the constraint. Client-side checks are a courtesy - the
 * API is still reachable without them - so both exist and the database stays the authority.
 */

/** Matches the V047 constraint exactly. A real quantity has at most seven digits. */
export const MAX_QUANTITY = 10000000;

/**
 * The digit lengths of the retail barcode symbologies in use: EAN-8, UPC-A, EAN-13 and
 * ITF-14. A value with one of these lengths is almost certainly a scan rather than a count.
 *
 * Every one of these lengths already exceeds the seven-digit maximum, so they never widen
 * what is rejected - they only make the message say why.
 */
const BARCODE_LENGTHS = [8, 12, 13, 14];

/**
 * @param {string|number} value the raw field value
 * @returns {{ok: boolean, error: string|null, warning: string|null}}
 *
 * `error` means do not submit. `warning` is kept in the shape for callers that already read
 * it, but nothing sets it today - see the note in the over-limit branch.
 */
export function checkQuantity(value) {
  const raw = String(value ?? "").trim();

  if (raw === "") {
    return { ok: false, error: "Enter a quantity", warning: null };
  }

  const n = Number(raw);

  if (!Number.isFinite(n)) {
    return { ok: false, error: "Quantity must be a number", warning: null };
  }
  if (n < 0) {
    return { ok: false, error: "Quantity cannot be negative", warning: null };
  }

  // Digits only, so "12.5" is three digits rather than four and a decimal quantity is not
  // mistaken for a barcode.
  const digits = raw.replace(/[^0-9]/g, "");

  if (n >= MAX_QUANTITY) {
    // Say both things rather than choosing between them. The limit is the rule; the digit
    // count is the likely cause, and naming it tells the user what to do differently.
    //
    // Note there is no "barcode-shaped but legal" case to warn about: the shortest barcode
    // symbology here is 8 digits, and any 8-digit integer already exceeds the seven-digit
    // maximum. An earlier draft had a warning branch for that, which could never run.
    const scanned = BARCODE_LENGTHS.includes(digits.length) && !raw.includes(".");
    return {
      ok: false,
      error:
        `Quantity looks wrong - the maximum is ${MAX_QUANTITY - 1} (seven digits).` +
        (scanned
          ? ` ${digits.length} digits suggests a scanned barcode - scan into the item field instead.`
          : ""),
      warning: null,
    };
  }

  return { ok: true, error: null, warning: null };
}

/** Convenience for a submit handler: the first offending row, or null when all are fine. */
export function firstQuantityError(rows, getQty) {
  for (let i = 0; i < rows.length; i += 1) {
    const { ok, error } = checkQuantity(getQty(rows[i]));
    if (!ok) return { index: i, error };
  }
  return null;
}
