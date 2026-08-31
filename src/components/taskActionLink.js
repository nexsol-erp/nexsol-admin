import { flattenMenu } from "../menuCatalog";

/**
 * Works out which screen a workflow task should open, and with what preselected.
 *
 * A task says "Set a cost for MOOSAMBI JUICE - 104 sales lines across 11 branch(es) have no
 * resolvable cost". Reading that and then hunting for the Item Cost Override screen, then
 * searching it for the item, is most of the work the task was supposed to save.
 *
 * Everything needed is already carried on the instance:
 *
 *   menuName   - the screen, set by each detector (UnresolvedCostDetector -> "Item Cost
 *                Override", DeadStockDetector -> "Branch Stock Report", and so on)
 *   itemId/itemCode/branchCode/voucherNo - what to preselect once there
 *
 * This turns those into a route. The route comes from menuCatalog.js rather than a second
 * hardcoded table: menuName is already written to match a menuKey exactly, and duplicating
 * the mapping would mean a renamed menu breaks task links silently.
 */

/** menuName values that do not match a menuKey verbatim. */
const MENU_ALIASES = {
  // MissingDayEndDetector says "Day End"; the catalog entry is "Day End Report". Renaming
  // either one would be the tidier fix, but not while tasks referencing the old value are
  // still open in production.
  "Day End": "Day End Report",
};

/**
 * Which task variables each screen is given as a preselection.
 *
 * Taken from what the detectors actually put on the instance, not from what the names
 * suggest - TransferNotReceivedDetector writes `voucherNumber`, and a link built around
 * `voucherNo` would have silently carried nothing.
 *
 * Passing a parameter a screen does not read is harmless: it lands on the right screen,
 * which is most of the value. Today only Item Cost Override consumes these; the others
 * still need wiring on their own side.
 */
const SCREEN_PARAMS = {
  // UnresolvedCostDetector
  "Item Cost Override":       ["itemId", "itemCode", "itemName"],
  // DeadStockDetector
  "Branch Stock Report":      ["branchCode"],
  // PurchaseWithoutGrnDetector - no voucher on the condition, it is a period summary
  "Goods Receipt":            ["branchCode"],
  // TransferNotReceivedDetector
  "Stock Transfer In Report": ["branchCode", "voucherNumber", "fromBranch"],
  // MissingDayEndDetector
  "Day End Report":           ["branchCode", "tradeDate"],
};

// Reuses menuCatalog's own flattenMenu rather than re-walking MENU_TREE here: the tree's
// shape (hasSubmenu/submenu) is that module's business, and a second traversal would drift.
let cachedIndex = null;
function menuIndex() {
  if (!cachedIndex) {
    cachedIndex = {};
    for (const leaf of flattenMenu()) {
      if (leaf.menuKey && leaf.link) cachedIndex[leaf.menuKey] = leaf.link;
    }
  }
  return cachedIndex;
}

/**
 * A route for this task, or null when it cannot be resolved.
 *
 * Returns null rather than a guess. A button that opens the wrong screen is worse than no
 * button: the person acts on something else and the task stays open.
 */
export function taskActionLink(task) {
  const vars = task?.variables || {};
  const rawMenu = vars.menuName;
  if (!rawMenu) return null;

  const menuKey = MENU_ALIASES[rawMenu] || rawMenu;
  const link = menuIndex()[menuKey];
  if (!link) return null;

  const params = new URLSearchParams();
  for (const key of SCREEN_PARAMS[menuKey] || []) {
    const value = vars[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value));
    }
  }

  const qs = params.toString();
  return qs ? `${link}?${qs}` : link;
}

/** The screen's own name, for the button's tooltip. */
export function taskActionLabel(task) {
  const raw = task?.variables?.menuName;
  if (!raw) return null;
  return MENU_ALIASES[raw] || raw;
}
