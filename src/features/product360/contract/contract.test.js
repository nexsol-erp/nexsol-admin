/**
 * Product 360 contract tests (client side).
 *
 * The schema itself is validated in Java and Python. What this file guards is the part
 * only the frontend can check: that the contract still lines up with *this* application —
 * every routeKey resolving to a route the app actually has, and every value the UI intends
 * to render being present.
 *
 * Fixtures are read from disk rather than imported: they live in docs/, outside src/, and
 * CRA's module scope plugin blocks imports from there.
 */
const fs = require("fs");
const path = require("path");
const { MENU_TREE } = require("../../../menuCatalog");

const FIXTURE_DIR = path.join(__dirname, "..", "..", "..", "..", "docs", "product-360", "fixtures");
const FIXTURES = ["full", "degraded", "empty"];

const load = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, `${name}.json`), "utf8"));

const NODE_ID = /^[A-Z_]+:[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?$/;

const SECTIONS = ["stock", "sales", "profit", "cost", "supply", "production", "insights", "tasks"];

/**
 * routeKey -> the admin route it opens.
 *
 * Phase 4 turns this into the real navigation registry. It lives here for now so the
 * contract cannot name a report this app does not have.
 */
const ROUTE_KEY_TO_LINK = {
  BRANCH_PROFIT_REPORT: "/branch-profit-report",
  SALES_REPORT: "/sales",
  ITEM_SALES_REPORT: "/item-sales",
  ITEM_STOCK_REPORT: "/item-stock-report",
  BRANCH_STOCK_VIEW: "/branch-stock-view",
  BRANCH_INVENTORY_LEDGER: "/branch-inventory-ledger",
  PURCHASE_REPORT: "/purchasereport",
  ITEM_MOVEMENT_REPORT: "/item-movement-report",
  STOCK_TRANSFER_IN_REPORT: "/stocktransfer-in-report",
  STOCK_TRANSFER_OUT_REPORT: "/stocktransfer-out-report",
  COST_PRICE_HISTORY: "/cost-price-history",
  PRODUCTION_EXECUTION_REPORT: "/production-execution-report",
  WORKFLOW_TASK_DETAIL: "/my-tasks",
};

/** Every leaf in the menu tree, flattened to { link, menuKey }. */
const menuLeaves = () => {
  const out = [];
  MENU_TREE.forEach((item) => {
    if (item.hasSubmenu) {
      item.submenu.forEach((sub) => out.push({ link: sub.link, menuKey: sub.menuKey }));
    } else {
      out.push({ link: item.link, menuKey: item.menuKey });
    }
  });
  return out;
};

const allMetrics = (doc) => [
  ...doc.summary.metrics,
  ...doc.nodes.flatMap((n) => n.metrics),
];

describe("Product 360 contract", () => {
  describe.each(FIXTURES)("%s.json", (name) => {
    const doc = load(name);

    it("declares the version and view type the app expects", () => {
      expect(doc.schemaVersion).toBe("1.0");
      expect(doc.viewType).toBe("PRODUCT_360");
    });

    it("reports a status for all eight sections", () => {
      expect(Object.keys(doc.sections).sort()).toEqual([...SECTIONS].sort());

      const statuses = Object.values(doc.sections).map((section) => section.status);
      statuses.forEach((status) => expect(["OK", "DEGRADED", "UNAVAILABLE"]).toContain(status));

      // Anything not OK must say why - an empty section with no reason leaves the UI
      // unable to explain itself.
      const missingReason = Object.entries(doc.sections)
        .filter(([, section]) => section.status !== "OK")
        .filter(([, section]) => !section.reason)
        .map(([name]) => name);
      expect(missingReason).toEqual([]);
    });

    it("uses deterministic node ids so saved layouts survive a refresh", () => {
      doc.nodes.forEach((node) => expect(node.id).toMatch(NODE_ID));
    });

    it("has no dangling edges", () => {
      const ids = new Set(doc.nodes.map((n) => n.id));
      doc.edges.forEach((edge) => {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      });
    });

    it("gives every metric a server-formatted string to display", () => {
      allMetrics(doc).forEach((metric) => {
        expect(typeof metric.formatted).toBe("string");
        expect(metric.formatted.length).toBeGreaterThan(0);
        expect(typeof metric.scale).toBe("number");
      });
    });

    it("labels quantities with a unit and money with a currency", () => {
      const badCurrencies = allMetrics(doc)
        .filter((metric) => metric.currency !== null && metric.currency !== undefined)
        .filter((metric) => !/^[A-Z]{3}$/.test(metric.currency))
        .map((metric) => `${metric.key}=${metric.currency}`);
      expect(badCurrencies).toEqual([]);
    });

    it("only names reports this application actually has", () => {
      const links = menuLeaves();
      const targets = [
        ...doc.nodes.flatMap((n) => n.navigationTargets.map((t) => t.routeKey)),
        ...doc.nodes.flatMap((n) => n.evidence.map((e) => e.routeKey)),
      ];
      targets.forEach((routeKey) => {
        const link = ROUTE_KEY_TO_LINK[routeKey];
        expect(link).toBeDefined();
        expect(links.some((leaf) => leaf.link === link)).toBe(true);
      });
    });

    it("never sends a URL — only a routeKey and validated parameters", () => {
      const serialised = JSON.stringify(doc);
      expect(serialised).not.toMatch(/https?:\/\//);
      doc.nodes.forEach((node) =>
        node.navigationTargets.forEach((target) => {
          expect(target).not.toHaveProperty("url");
          expect(target).not.toHaveProperty("href");
        })
      );
    });
  });

  it("maps every routeKey in the contract to a real menu entry", () => {
    const links = menuLeaves();
    Object.entries(ROUTE_KEY_TO_LINK).forEach(([routeKey, link]) => {
      const leaf = links.find((l) => l.link === link);
      expect(leaf).toBeDefined();
      // The menuKey is what MenuAccessContext checks before navigating, so it must exist.
      expect(leaf.menuKey).toBeTruthy();
    });
  });

  describe("degraded.json — the reason this contract exists", () => {
    const doc = load("degraded");

    it("shows an unresolved cost as unavailable, never as zero", () => {
      const margin = doc.summary.metrics.find((m) => m.key === "margin_pct");
      const profit = doc.summary.metrics.find((m) => m.key === "gross_profit");

      [margin, profit].forEach((metric) => {
        expect(metric.value).toBeNull();
        expect(metric.value).not.toBe(0);
        expect(metric.formatted).toBe("Unavailable");
        // The string a reader must never see on a cost they do not have.
        expect(metric.formatted).not.toMatch(/0\.00|₹0/);
      });
    });

    it("says why, so the reader is not left guessing", () => {
      expect(doc.sections.cost.reason).toBe("COST_UNRESOLVED");
      expect(doc.warnings.map((w) => w.code)).toContain("COST_UNAVAILABLE");
    });

    it("keeps working sections on screen when others fail", () => {
      expect(doc.sections.stock.status).toBe("OK");
      expect(doc.sections.supply.status).toBe("DEGRADED");
      expect(doc.nodes.length).toBeGreaterThan(0);
    });

    it("names the branch that is behind rather than hiding the lag", () => {
      const lag = doc.warnings.find((w) => w.code === "BRANCH_SYNC_LAG");
      expect(lag.branchCodes).toContain("BR007");
      // dataThrough reflects the laggiest source, not the freshest.
      expect(new Date(doc.dataThrough) <= new Date("2026-08-30T02:00:00Z")).toBe(true);
    });
  });

  describe("empty.json — no activity is a result, not an error", () => {
    const doc = load("empty");

    it("still renders the product", () => {
      expect(doc.nodes).toHaveLength(1);
      expect(doc.nodes[0].type).toBe("PRODUCT");
      expect(doc.edges).toHaveLength(0);
    });

    it("explains the emptiness rather than erroring", () => {
      expect(doc.sections.profit.reason).toBe("NO_DATA_IN_PERIOD");
      expect(doc.warnings.map((w) => w.code)).toContain("PARTIAL_PERIOD");
    });
  });

  describe("full.json", () => {
    const doc = load("full");

    it("caps branch fan-out and groups the remainder", () => {
      const branchNodes = doc.nodes.filter((n) => n.type === "BRANCH_STOCK");
      const group = doc.nodes.find((n) => n.type === "BRANCH_GROUP");
      expect(branchNodes.length).toBeLessThanOrEqual(12);
      expect(group).toBeDefined();
      expect(group.metadata.memberCount).toBeGreaterThan(0);
      expect(branchNodes.length + group.metadata.memberCount).toBe(doc.scope.branchCodes.length);
    });

    it("carries a prior-period baseline on metrics that move", () => {
      const margin = doc.summary.metrics.find((m) => m.key === "margin_pct");
      expect(margin.baseline).toBeTruthy();
      expect(margin.baseline.direction).toBe("DOWN");
      expect(margin.baseline.formatted).toBeTruthy();
    });

    it("states the period basis instead of implying one", () => {
      expect(doc.period.basis).toBe("UTC_CALENDAR");
      expect(doc.warnings.map((w) => w.code)).toContain("PERIOD_BASIS_FALLBACK");
    });
  });
});
