/**
 * Scheme evaluation engine — mirrors Qt's NPOS::checkSchemeCriteria logic.
 *
 * Supported scheme types:
 *   "Category wise total amount"  — sum of amounts for items in that category >= threshold
 *   "Category wise total qty"     — any single item in that category has qty >= required qty
 *   "Item wise total qty"         — specific item has qty >= eligibility qty
 *   "Item wise total amount"      — specific item has amount >= eligibility amount
 *   "Total Invoice Amount"        — cart total >= eligibility amount
 *
 * Supported offer types:
 *   "Free Qty"               — add offerItem at qty=offerQty, price=0
 *   "Item Discount Percent"  — apply discount % to offerItem in the cart
 *   "Cash Back"              — return cashBackAmount (informational row)
 *
 * Appending "-MULTI" to the scheme name activates proportional multiplier.
 */

/**
 * @param {Array}  cartItems    — items in the cart (each has item_id, item_name, qty, amount, category)
 * @param {Array}  schemes      — schemes fetched from /api/{tenantId}/scheme
 * @param {Object} categoryMap  — { [itemId]: string[] } from /api/{tenantId}/item-category-map/all
 * @returns {Array}             — list of { schemeName, offerType, offerItemName, offerQty, offerDiscountPercent, cashBackAmount }
 */
export function evaluateSchemes(cartItems, schemes, categoryMap = {}) {
  if (!schemes?.length) return [];

  // Ignore rows that are already offer injections
  const realItems = cartItems.filter((r) => !r.is_offer);
  if (!realItems.length) return [];

  // Return all categories for an item, using categoryMap first then falling back to item.category
  const getCategories = (item) => {
    const fromMap = categoryMap[String(item.item_id || "")];
    if (fromMap?.length) return fromMap.map((c) => String(c).trim().toLowerCase());
    const fallback = String(item.category || "").trim().toLowerCase();
    return fallback ? [fallback] : [];
  };

  // ── Build category-wise totals (keyed lowercase) ──
  const categoryAmounts = {};
  const categoryQtys = {};
  for (const item of realItems) {
    const cats = getCategories(item);
    const amt = Number(item.amount) || 0;
    const qty = Number(item.qty) || 0;
    for (const cat of cats) {
      categoryAmounts[cat] = (categoryAmounts[cat] || 0) + amt;
      categoryQtys[cat] = (categoryQtys[cat] || 0) + qty;
    }
  }

  const totalInvoiceAmount = realItems.reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0
  );

  const offers = [];

  for (const scheme of schemes) {
    const multi = (name) =>
      String(name).includes("-MULTI");

    let offerQty = 0;
    let matched = false;

    if (scheme.schemeType === "Category wise total amount") {
      const schemeCat = String(scheme.categoryName || "").trim().toLowerCase();
      const catAmt = categoryAmounts[schemeCat] || 0;
      if (schemeCat && catAmt >= Number(scheme.totalEligibilityAmount || 0)) {
        matched = true;
        const n = multi(scheme.schemeName)
          ? Math.floor(catAmt / scheme.totalEligibilityAmount)
          : 1;
        offerQty = (Number(scheme.offerQty) || 0) * n;
      }

    } else if (scheme.schemeType === "Category wise total qty") {
      const schemeCat = String(scheme.categoryName || "").trim().toLowerCase();
      const totalCatQty = categoryQtys[schemeCat] || 0;
      if (schemeCat && totalCatQty >= Number(scheme.requiredCategoryQty || 0)) {
        matched = true;
        const n = multi(scheme.schemeName)
          ? Math.floor(totalCatQty / Number(scheme.requiredCategoryQty))
          : 1;
        offerQty = (Number(scheme.offerQty) || 0) * n;
      }

    } else if (scheme.schemeType === "Item wise total qty") {
      const hit = realItems.find(
        (i) => i.item_name === scheme.eligibilityItemName
      );
      if (hit && (Number(hit.qty) || 0) >= Number(scheme.eligibilityQty || 0)) {
        matched = true;
        const n = multi(scheme.schemeName)
          ? Math.floor((Number(hit.qty) || 0) / scheme.eligibilityQty)
          : 1;
        offerQty = (Number(scheme.offerQty) || 0) * n;
      }

    } else if (scheme.schemeType === "Item wise total amount") {
      const hit = realItems.find(
        (i) => i.item_name === scheme.eligibilityItemName
      );
      if (hit && (Number(hit.amount) || 0) >= Number(scheme.eligibilityAmount || 0)) {
        matched = true;
        offerQty = Number(scheme.offerQty) || 0;
      }

    } else if (scheme.schemeType === "Total Invoice Amount") {
      if (totalInvoiceAmount >= Number(scheme.eligibilityAmount || 0)) {
        matched = true;
        const n = multi(scheme.schemeName)
          ? Math.floor(totalInvoiceAmount / scheme.eligibilityAmount)
          : 1;
        offerQty = (Number(scheme.offerQty) || 0) * n;
      }
    }

    if (!matched) continue;

    if (scheme.offerType === "Free Qty" && offerQty > 0 && scheme.offerItem) {
      offers.push({
        schemeName: scheme.schemeName,
        offerType: "Free Qty",
        offerItemName: scheme.offerItem,
        offerQty,
      });
    } else if (
      scheme.offerType === "Item Discount Percent" &&
      Number(scheme.offerDiscountPercent) > 0
    ) {
      offers.push({
        schemeName: scheme.schemeName,
        offerType: "Item Discount Percent",
        offerItemName: scheme.offerItem,
        offerDiscountPercent: Number(scheme.offerDiscountPercent),
      });
    } else if (
      scheme.offerType === "Cash Back" &&
      Number(scheme.cashBackAmount) > 0
    ) {
      offers.push({
        schemeName: scheme.schemeName,
        offerType: "Cash Back",
        cashBackAmount: Number(scheme.cashBackAmount),
      });
    }
  }

  return offers;
}

/**
 * Given evaluated offers and a lookup function for item master data,
 * returns an array of cart row objects to inject as offer lines.
 *
 * @param {Array}    offers         — result of evaluateSchemes()
 * @param {Function} findItem       — async (name) => cached item | null
 * @returns {Array}                 — rows ready to push onto the cart
 */
export async function buildOfferRows(offers, findItem) {
  const rows = [];
  for (const offer of offers) {
    if (offer.offerType !== "Free Qty") continue;

    const found = await findItem(offer.offerItemName);
    if (!found) continue;

    rows.push({
      key: `offer_${offer.schemeName}_${offer.offerItemName}`,
      item_id: found.itemId,
      item_name: found.itemName,
      barcode: found.barcode || "",
      qty: offer.offerQty,
      standard_price: 0,
      amount: 0,
      tax_rate: Number(found.taxRate) || 0,
      unit: found.unitName || "",
      batch: found.batchCode || "",
      expiry: found.expiry || "",
      available_qty: null,
      category: found.category || "",
      is_offer: true,
      description: `Scheme: ${offer.schemeName}`,
    });
  }
  return rows;
}
