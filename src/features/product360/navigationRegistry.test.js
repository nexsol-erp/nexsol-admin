const {
  ROUTE_REGISTRY,
  resolveTarget,
  reasonLabel,
  parseReturnContext,
} = require("./navigationRegistry");
const { MENU_TREE } = require("../../menuCatalog");

/**
 * The navigation allow-list.
 *
 * Two things are being protected here. The map must never become a way to open a report the
 * user could not otherwise reach, and it must never point the browser somewhere arbitrary
 * because the server said so.
 */

const menuLeaves = () => {
  const out = [];
  MENU_TREE.forEach((item) => {
    if (item.hasSubmenu) item.submenu.forEach((sub) => out.push(sub));
    else out.push(item);
  });
  return out;
};

const allow = () => true;
const deny = () => false;

describe("navigationRegistry", () => {
  it("maps every route key to a real route and a real menu entry", () => {
    // A key naming a report this build does not have would fail in front of a user.
    const leaves = menuLeaves();
    Object.entries(ROUTE_REGISTRY).forEach(([routeKey, entry]) => {
      const leaf = leaves.find((item) => item.link === entry.link);
      expect(leaf).toBeDefined();
      expect(leaf.menuKey).toBe(entry.menuKey);
    });
  });

  it("resolves a permitted target to a link and a query string", () => {
    const resolved = resolveTarget(
      {
        routeKey: "BRANCH_STOCK_VIEW",
        parameters: { productId: "ITM-1042", branchCode: "BR007", fromDate: "2026-08-01" },
        returnContext: "p360:ITM-1042:BR007:20260801-20260830",
      },
      allow
    );

    expect(resolved.ok).toBe(true);
    expect(resolved.link).toBe("/branch-stock-view");
    expect(resolved.search).toContain("productId=ITM-1042");
    expect(resolved.search).toContain("branchCode=BR007");
    expect(resolved.search).toContain("returnTo=");
  });

  it("refuses a target the user has no menu access to", () => {
    // The whole point of re-checking at click time.
    const resolved = resolveTarget(
      { routeKey: "BRANCH_PROFIT_REPORT", parameters: { productId: "ITM-1042" } },
      deny
    );

    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe("NOT_PERMITTED");
    expect(reasonLabel(resolved.reason)).toMatch(/do not have access/i);
  });

  it("refuses a route key this build does not know", () => {
    // The server and the frontend deploy independently, so this is an ordinary
    // transitional state rather than something to crash on.
    const resolved = resolveTarget({ routeKey: "SOME_FUTURE_REPORT", parameters: {} }, allow);
    expect(resolved.ok).toBe(false);
    expect(resolved.reason).toBe("UNKNOWN_ROUTE");
  });

  it("refuses a malformed target rather than throwing", () => {
    expect(resolveTarget(null, allow).ok).toBe(false);
    expect(resolveTarget({}, allow).ok).toBe(false);
  });

  it("drops empty parameters instead of sending blanks", () => {
    const resolved = resolveTarget(
      {
        routeKey: "COST_PRICE_HISTORY",
        parameters: { productId: "ITM-1", branchCode: null, fromDate: "" },
      },
      allow
    );
    expect(resolved.search).toBe("?productId=ITM-1");
  });

  it("never produces an absolute URL", () => {
    // A URL from the server is exactly what this design refuses to accept.
    Object.keys(ROUTE_REGISTRY).forEach((routeKey) => {
      const resolved = resolveTarget({ routeKey, parameters: { productId: "X" } }, allow);
      expect(resolved.link.startsWith("/")).toBe(true);
      expect(resolved.link).not.toMatch(/^https?:/);
    });
  });

  describe("return context", () => {
    it("round-trips product and dates", () => {
      const parsed = parseReturnContext("p360:ITM-1042:BR007:20260801-20260830");
      expect(parsed).toEqual({
        productId: "ITM-1042",
        branchCode: "BR007",
        fromDate: "2026-08-01",
        toDate: "2026-08-30",
      });
    });

    it("treats ALL as no branch filter", () => {
      expect(parseReturnContext("p360:ITM-1:ALL:20260801-20260830").branchCode).toBeNull();
    });

    it("ignores anything that is not a return context", () => {
      expect(parseReturnContext(null)).toBeNull();
      expect(parseReturnContext("")).toBeNull();
      // eslint-disable-next-line no-script-url -- a hostile string is the point of this test
      expect(parseReturnContext("javascript:alert(1)")).toBeNull();
      expect(parseReturnContext("https://evil.example.com")).toBeNull();
    });
  });
});
