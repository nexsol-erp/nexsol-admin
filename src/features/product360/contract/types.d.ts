/**
 * Product 360 wire contract — v1.
 *
 * Source of truth: docs/product-360/schema/product-360.v1.schema.json.
 * This file is a DECLARATION FILE only: the admin app is plain JavaScript, so nothing
 * imports it at runtime and CRA never type-checks it. It exists so editors can autocomplete
 * and so a reviewer can see the shape in one place.
 *
 * Two rules the types encode, because they are the ones most easily broken:
 *
 *   1. `Metric.formatted` is the ONLY field the UI may render. `value` is for sorting and
 *      charting. Never compute money in JavaScript — the server owns currency and scale.
 *   2. `value` is `number | null`. Null means genuinely unavailable. It is never 0 as a
 *      stand-in; a missing cost shown as 0.00 reads as "free".
 */

export type Severity = 'OK' | 'INFO' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
export type SectionState = 'OK' | 'DEGRADED' | 'UNAVAILABLE';
export type Direction = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN';

/** UTC_CALENDAR is what v1 emits — no per-branch timezone or day-end cutoff exists. */
export type PeriodBasis = 'UTC_CALENDAR' | 'BRANCH_DAY_END';

export type ReasonCode =
  | 'NO_DATA_IN_PERIOD'
  | 'NO_BOM_CONFIGURED'
  | 'NO_PERSISTED_INSIGHTS'
  | 'NO_PRODUCT_LINK'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'NOT_LICENSED'
  | 'COST_UNRESOLVED'
  | 'PARTIAL_BRANCH_COVERAGE';

export type NodeType =
  | 'PRODUCT' | 'CATEGORY' | 'BRANCH_STOCK' | 'BRANCH_GROUP' | 'SALES' | 'PROFIT'
  | 'COST' | 'VENDOR' | 'PURCHASE' | 'STOCK_TRANSFER' | 'PRODUCTION' | 'INGREDIENT'
  | 'AI_INSIGHT' | 'WORKFLOW_TASK' | 'DATA_WARNING';

export type EdgeType =
  | 'STOCKED_AT' | 'SOLD_AT' | 'HAS_PROFIT' | 'USES_COST' | 'SUPPLIED_BY'
  | 'PURCHASED_FROM' | 'TRANSFERRED_TO' | 'PRODUCED_FROM' | 'HAS_INSIGHT'
  | 'HAS_TASK' | 'GROUPED_INTO';

/**
 * Allow-listed navigation targets. A URL never crosses the wire: the client maps the key to
 * a route in App.js and re-checks the user's menu permission before navigating, so the map
 * can never hand out access the user does not already have.
 */
export type RouteKey =
  | 'BRANCH_PROFIT_REPORT'
  | 'SALES_REPORT'
  | 'ITEM_SALES_REPORT'
  | 'ITEM_STOCK_REPORT'
  | 'BRANCH_STOCK_VIEW'
  | 'BRANCH_INVENTORY_LEDGER'
  | 'PURCHASE_REPORT'
  | 'ITEM_MOVEMENT_REPORT'
  | 'STOCK_TRANSFER_IN_REPORT'
  | 'STOCK_TRANSFER_OUT_REPORT'
  | 'COST_PRICE_HISTORY'
  | 'PRODUCTION_EXECUTION_REPORT'
  | 'WORKFLOW_TASK_DETAIL';

export type ExpansionKey =
  | 'VENDOR_HISTORY' | 'PURCHASE_HISTORY' | 'TRANSFER_HISTORY'
  | 'BOM_INGREDIENTS' | 'BRANCH_MEMBERS';

/** The five values v_sales_line_cost resolves. NOT_FOUND means unavailable, never zero. */
export type CostSource = 'MANUAL' | 'PURCHASE' | 'STOCK_TRANSFER' | 'PRODUCTION_COST' | 'NOT_FOUND';

export type WarningCode =
  | 'BRANCH_SYNC_LAG'
  | 'COST_UNAVAILABLE'
  | 'PARTIAL_PERIOD'
  | 'BRANCH_SCOPE_TRUNCATED'
  | 'SECTION_DEGRADED'
  | 'PERIOD_BASIS_FALLBACK';

export interface MetricBaseline {
  value: number | null;
  formatted: string;
  deltaPct?: number | null;
  direction: Direction;
  label?: string | null;
}

export interface Metric {
  key: string;
  /** Translation key — pass through t() before displaying. */
  label: string;
  /** Sorting and charting only. Never render this; never do arithmetic on it. */
  value: number | null;
  unit?: string | null;
  /** ISO 4217. Present on every monetary metric. */
  currency?: string | null;
  scale: number;
  /** The only representation to display. */
  formatted: string;
  severity?: Severity;
  /** Prior-period comparison — a change is a decision input, a level is not. */
  baseline?: MetricBaseline | null;
}

export interface Evidence {
  label: string;
  routeKey: RouteKey;
  sourceService?: string | null;
}

export interface NavigationParameters {
  productId?: string;
  branchCode?: string;
  branchCodes?: string[];
  vendorCode?: string;
  categoryId?: string;
  fromDate?: string;
  toDate?: string;
  taskId?: string;
}

export interface NavigationTarget {
  routeKey: RouteKey;
  parameters: NavigationParameters;
  /** Restores product, filters and layout on the way back. */
  returnContext?: string | null;
}

/** Allow-listed keys only — never a free-form bag reaching the browser. */
export interface NodeMetadata {
  branchCode?: string;
  branchName?: string;
  vendorCode?: string;
  categoryId?: string;
  itemId?: string;
  uom?: string;
  costSource?: CostSource;
  memberCount?: number;
  workflowInstanceId?: string;
  workflowTaskId?: string;
  insightId?: string;
}

export interface Product360Node {
  /** Deterministic: `{TYPE}:{scope}[:{entityId}]`. Saved layouts are keyed on this. */
  id: string;
  type: NodeType;
  label: string;
  subtitle?: string | null;
  severity: Severity;
  metrics: Metric[];
  evidence: Evidence[];
  navigationTargets: NavigationTarget[];
  expandable: boolean;
  expansionKey?: ExpansionKey | null;
  metadata?: NodeMetadata;
}

export interface Product360Edge {
  source: string;
  target: string;
  type: EdgeType;
  label?: string | null;
  severity?: Severity;
}

export interface SectionStatus {
  status: SectionState;
  /** Required whenever status is not OK. */
  reason?: ReasonCode | null;
  dataThrough?: string | null;
}

export interface Product360Warning {
  code: WarningCode;
  severity: Severity;
  message: string;
  branchCodes?: string[];
  metric?: string | null;
}

export interface Product360Sections {
  stock: SectionStatus;
  sales: SectionStatus;
  profit: SectionStatus;
  cost: SectionStatus;
  supply: SectionStatus;
  production: SectionStatus;
  insights: SectionStatus;
  tasks: SectionStatus;
}

export interface Product360Response {
  schemaVersion: string;
  viewType: 'PRODUCT_360';
  product: {
    id: string;
    code: string;
    name: string;
    category?: string | null;
    baseUom: string;
    active: boolean;
  };
  period: {
    from: string;
    to: string;
    timezone: string;
    /** Stated explicitly, never implied. */
    basis: PeriodBasis;
    baseline?: { from: string; to: string; label: string } | null;
  };
  scope: {
    branchCodes: string[];
    resolvedBy: 'AUTHORISED_SET' | 'EXPLICIT_FILTER';
  };
  summary: { metrics: Metric[] };
  sections: Product360Sections;
  nodes: Product360Node[];
  edges: Product360Edge[];
  /** The OLDEST synced branch in scope — never `now()`. */
  dataThrough: string;
  warnings: Product360Warning[];
}
