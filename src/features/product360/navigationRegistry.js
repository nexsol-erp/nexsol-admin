import { MENU_TREE } from "../../menuCatalog";

/**
 * The client half of the navigation allow-list.
 *
 * The server sends a routeKey and validated parameters; this file turns that into a real
 * route. A URL never crosses the wire, which means a compromised or buggy backend cannot
 * point somebody's browser at an arbitrary address.
 *
 * Just as important: every entry names the `menuKey` that guards the destination, so the
 * page can re-check permission at click time against the same role-menu data the sidebar
 * uses. Product 360 must never become a way to reach a report you could not otherwise open.
 */

/** routeKey -> the admin route and the menu that guards it. */
export const ROUTE_REGISTRY = {
  BRANCH_PROFIT_REPORT: { link: "/branch-profit-report", menuKey: "Branch Profit Report" },
  SALES_REPORT: { link: "/sales", menuKey: "Sales Report" },
  ITEM_SALES_REPORT: { link: "/item-sales", menuKey: "Item Sales Report" },
  ITEM_STOCK_REPORT: { link: "/item-stock-report", menuKey: "Item Stock Report" },
  BRANCH_STOCK_VIEW: { link: "/branch-stock-view", menuKey: "Branch Stock Report" },
  BRANCH_INVENTORY_LEDGER: { link: "/branch-inventory-ledger", menuKey: "Branch Inventory Ledger" },
  PURCHASE_REPORT: { link: "/purchasereport", menuKey: "Purchase Report" },
  ITEM_MOVEMENT_REPORT: { link: "/item-movement-report", menuKey: "Item Movement Report" },
  STOCK_TRANSFER_IN_REPORT: { link: "/stocktransfer-in-report", menuKey: "Stock Transfer In Report" },
  STOCK_TRANSFER_OUT_REPORT: { link: "/stocktransfer-out-report", menuKey: "Stock Transfer Out Report" },
  COST_PRICE_HISTORY: { link: "/cost-price-history", menuKey: "Cost Price History" },
  PRODUCTION_EXECUTION_REPORT: { link: "/production-execution-report", menuKey: "Production Execution Report" },
  WORKFLOW_TASK_DETAIL: { link: "/my-tasks", menuKey: "My Tasks" },
};

/** Every leaf of the menu tree, flattened once. */
const menuLeaves = () => {
  const out = [];
  MENU_TREE.forEach((item) => {
    if (item.hasSubmenu) {
      item.submenu.forEach((sub) => out.push(sub));
    } else {
      out.push(item);
    }
  });
  return out;
};

/**
 * Resolves a navigation target into something the page can act on.
 *
 * Returns a reason rather than throwing, because every failure here has to be shown to the
 * user as a disabled button with an explanation — a link that silently does nothing is
 * worse than one that says why it cannot be used.
 *
 * @param isEntryAllowed from useMenuAccess()
 */
export const resolveTarget = (target, isEntryAllowed) => {
  if (!target || !target.routeKey) {
    return { ok: false, reason: "UNKNOWN_ROUTE" };
  }

  const entry = ROUTE_REGISTRY[target.routeKey];
  if (!entry) {
    // The server knows a route this build does not. Deploys are independent, so this is a
    // normal transitional state, not a bug to crash on.
    return { ok: false, reason: "UNKNOWN_ROUTE" };
  }

  const leaf = menuLeaves().find((item) => item.link === entry.link);
  if (!leaf) {
    return { ok: false, reason: "ROUTE_NOT_IN_MENU" };
  }

  if (isEntryAllowed && !isEntryAllowed(leaf.menuKey, leaf.roles, leaf.parentRoles)) {
    // The user cannot open this report by any other route, so Product 360 must not be the
    // exception that lets them.
    return { ok: false, reason: "NOT_PERMITTED" };
  }

  return { ok: true, link: entry.link, menuKey: entry.menuKey, search: toSearch(target) };
};

/** Turns the validated parameters into a query string, dropping anything empty. */
const toSearch = (target) => {
  const params = new URLSearchParams();
  const source = target.parameters || {};
  Object.keys(source).forEach((key) => {
    const value = source[key];
    if (value === null || value === undefined || value === "") return;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  });
  if (target.returnContext) {
    params.set("returnTo", target.returnContext);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

/** Human-readable reason, for a disabled button's tooltip. */
export const reasonLabel = (reason) => {
  switch (reason) {
    case "NOT_PERMITTED":
      return "You do not have access to this report";
    case "UNKNOWN_ROUTE":
      return "This report is not available in this version";
    case "ROUTE_NOT_IN_MENU":
      return "This report is not configured";
    default:
      return "Unavailable";
  }
};

/** Parses a returnTo token back into the product and filters it came from. */
export const parseReturnContext = (value) => {
  if (!value || !value.startsWith("p360:")) return null;
  const [, productId, branch, range] = value.split(":");
  if (!productId || !range) return null;
  const [from, to] = range.split("-");
  const iso = (compact) =>
    compact && compact.length === 8
      ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
      : null;
  return {
    productId,
    branchCode: branch === "ALL" ? null : branch,
    fromDate: iso(from),
    toDate: iso(to),
  };
};
