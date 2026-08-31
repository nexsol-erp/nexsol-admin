# Phase 1 — The Graph Contract

> Prompt file **1 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phase 0 complete (`BASELINE.md`, `FINDINGS.md`, `DECISIONS.md` exist).

---

## 1. Role and operating rules

You are defining the interface that three services and two frontends will depend on for years.
Getting a field wrong here is cheap today and expensive in Phase 4.

1. Preserve uncommitted work; branch only; no unrelated refactoring.
2. No completion claims without a command you ran.
3. Where `FINDINGS.md` says a data source does not exist, model it as an **`UNAVAILABLE`
   section** — do not invent fields for data you cannot supply.

---

## 2. Why this contract looks the way it does

Four properties are non-negotiable, and each exists because of something real in this system:

- **Units and currency on every value.** The ERP has multiple UOMs and batch-level stock. Summing
  "quantity" across branches without a unit produces a confident wrong number. Money is formatted
  server-side because JavaScript cannot be trusted with currency arithmetic.
- **`dataThrough` per section, not per response.** The ERP has an **offline POS**. A map that
  claims live data while one branch has not synced for three days is worse than no map. The
  header shows the *minimum* across sections and names the lagging branches.
- **Section status.** Production BOM or AI insights may not be queryable at all (see
  `FINDINGS.md` Q3, Q6). A missing section must degrade that section only.
- **A baseline on every movable metric.** "Margin is 14%" is not a decision input. "Margin fell
  from 22% to 14%" is.

---

## 3. Tasks

### 3.1 Schema — the single source of truth

Create `e:\nexsol-admin\docs\product-360\schema\product-360.v1.schema.json` (JSON Schema
draft 2020-12). It is the source of truth; the three language models are generated from or
validated against it, never the reverse.

Top level:

```jsonc
{
  "schemaVersion": "1.0",              // major bump invalidates saved layouts
  "viewType": "PRODUCT_360",
  "product":  { "id", "code", "name", "category", "baseUom", "active" },
  "period":   { "from", "to", "timezone", "basis", "baseline": { "from","to","label" } },
  "scope":    { "branchCodes": [], "resolvedBy": "AUTHORISED_SET" },
  "summary":  { "metrics": [ /* Metric */ ] },
  "sections": { "<sectionKey>": { "status", "reason", "dataThrough" } },
  "nodes":    [ /* Node */ ],
  "edges":    [ /* Edge */ ],
  "dataThrough": "…",
  "warnings": [ /* Warning */ ]
}
```

`basis` is `BRANCH_DAY_END` or `UTC_CALENDAR` — whichever Phase 0 Q4 established. The response
states which was used; it is never implicit.

Section keys: `stock` `sales` `profit` `cost` `supply` `production` `insights` `tasks`.
Status: `OK` · `DEGRADED` · `UNAVAILABLE`. `reason` is a code, not prose
(`NO_BOM_CONFIGURED`, `UPSTREAM_TIMEOUT`, `NOT_LICENSED`, `NO_DATA_IN_PERIOD`).

**Metric** — the shape that makes D9 and D19 real:

```jsonc
{ "key": "qty_on_hand",
  "label": "Quantity on hand",         // translated client-side via t(); this is the key
  "value": 1240.5, "unit": "KG",
  "currency": null, "scale": 3,
  "formatted": "1,240.500 KG",          // server-formatted; the UI displays THIS
  "baseline": { "value": 1610.0, "formatted": "1,610.000 KG",
                "deltaPct": -22.9, "direction": "DOWN", "label": "Previous 30 days" },
  "severity": "WARNING" }
```

`formatted` is mandatory. `value` exists for sorting and charting only. Money metrics carry
`currency` (ISO 4217) and never appear without it.

**Node:**

```
id · type · label · subtitle · severity · metrics[] · evidence[] ·
navigationTargets[] · expandable · expansionKey · metadata
```

`severity`: `OK` `INFO` `WARNING` `CRITICAL` `UNKNOWN`.
`type`: `PRODUCT` `CATEGORY` `BRANCH_STOCK` `BRANCH_GROUP` `SALES` `PROFIT` `COST` `VENDOR`
`PURCHASE` `STOCK_TRANSFER` `PRODUCTION` `INGREDIENT` `AI_INSIGHT` `WORKFLOW_TASK` `DATA_WARNING`.
`metadata` accepts **allow-listed keys only** — enumerate them in the schema. No free-form object,
no PII, no anything that could carry a URL or markup.

**`id` is deterministic (D8):** `{TYPE}:{scope}:{entityId}` —
`BRANCH_STOCK:BR001:ITM-1042`, `COST:ITM-1042`, `VENDOR:V-77:ITM-1042`,
`BRANCH_GROUP:REMAINDER:ITM-1042`. Never contains a value, a date, or a name. Saved layouts key
off these, so two calls with the same inputs must produce byte-identical ids.

**Edge:** `source · target · type · label · severity · metadata`.
Types: `STOCKED_AT` `SOLD_AT` `HAS_PROFIT` `USES_COST` `SUPPLIED_BY` `PURCHASED_FROM`
`TRANSFERRED_TO` `PRODUCED_FROM` `HAS_INSIGHT` `HAS_TASK` `GROUPED_INTO`.

**NavigationTarget** — no URL ever crosses the wire:

```jsonc
{ "routeKey": "BRANCH_PROFIT_REPORT",
  "parameters": { "productId": "…", "branchCode": "…", "fromDate": "…", "toDate": "…" },
  "returnContext": "p360:ITM-1042:BR001:20260801-20260830" }
```

`routeKey` is a closed enum in the schema. Before adding one, confirm the route exists in
`e:\nexsol-admin\src\App.js` and has a `menuKey` in `src\menuCatalog.js`; drop any that does not.
Candidates to verify: `BRANCH_PROFIT_REPORT` (`/branch-profit-report`), `SALES_DETAIL`
(`/sales`), `ITEM_STOCK_REPORT` (`/item-stock-report`), `BRANCH_STOCK_VIEW`
(`/branch-stock-view`), `PURCHASE_REPORT` (`/purchasereport`), `ITEM_MOVEMENT_REPORT`
(`/item-movement-report`), `STOCK_TRANSFER_IN` (`/stocktransfer-in-report`),
`STOCK_TRANSFER_OUT` (`/stocktransfer-out-report`), `COST_PRICE_HISTORY`
(`/cost-price-history`), `PRODUCTION_EXECUTION_REPORT` (`/production-execution-report`),
`WORKFLOW_TASK_DETAIL` (`/my-tasks`).

**Warning:** `code · severity · message · branchCodes[] · metric?`.
Codes to define at minimum: `BRANCH_SYNC_LAG`, `COST_UNAVAILABLE`, `PARTIAL_PERIOD`,
`BRANCH_SCOPE_TRUNCATED`, `SECTION_DEGRADED`.

### 3.2 Fixtures

Create `docs/product-360/fixtures/`:

- `full.json` — every section `OK`, ~14 branches so the D13 grouping rule is exercised
  (12 rendered + one `BRANCH_GROUP`)
- `degraded.json` — `cost` and `profit` `UNAVAILABLE` with `COST_UNAVAILABLE`;
  `production` `UNAVAILABLE` with `NO_BOM_CONFIGURED`; one branch lagging with `BRANCH_SYNC_LAG`
- `empty.json` — a real product with no stock, no sales and no vendors in the period. **This is
  not an error state** and must render as a valid map with a `NO_DATA_IN_PERIOD` reason.

The degraded fixture is the important one: it is the regression test for "missing cost is not
zero".

### 3.3 Three language models

**Java** — `c:\Users\Dell\nexsol-server-postgress`, package
`com.nexsol.backend.backendserver.model.product360`:
`Product360Response` `Product360Node` `Product360Edge` `Metric` `MetricBaseline`
`NavigationTarget` `SectionStatus` `Warning` `Period` `Scope`.
Records or immutable classes; Jackson-annotated. **`everit-json-schema` 1.14.4 is already on the
classpath** — use it for the validation test, add nothing.

**TypeScript** — `e:\nexsol-admin\src\features\product360\contract\types.d.ts`.
The admin is JavaScript, so this is a declaration file for editor support only; it must not be
imported at runtime and must not require a TS build step.

**Python** — `e:\mind-map\backend\app\schemas\product360.py`, Pydantic v2, matching the existing
style in `app/schemas/` (`from __future__ import annotations`, typed, `model_config` where
needed). The Python service only needs the subset it stores: node ids, view type, product id,
schema version.

### 3.4 Validation tests — one per language

- Java: a test that loads all three fixtures, validates them against the schema with
  `everit-json-schema`, deserialises into the DTOs, re-serialises, and asserts the round trip.
- Admin: a Jest test (`react-scripts test`) that loads the fixtures and asserts the shape the UI
  relies on — every metric has `formatted`; every node id matches
  `/^[A-Z_]+:[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?$/`; every `routeKey` is in the known set.
- Python: a pytest that validates the fixtures against the Pydantic models.

All three must fail if a field is renamed in the schema. That is the point of the phase.

---

## 4. Do not

- Do not add a schema field for data `FINDINGS.md` says does not exist.
- Do not put a URL, a secret, free-form HTML or a raw table/column name anywhere in the contract.
- Do not let the TypeScript file introduce a build step into CRA.
- Do not implement any service, endpoint or component. Contract only.

---

## 5. Exit criteria

- [ ] `product-360.v1.schema.json` exists and is valid draft 2020-12
- [ ] Three fixtures exist, including the degraded and empty cases
- [ ] Java, TypeScript and Python models exist and match the schema
- [ ] **All three validation tests run and pass** — paste the three summary lines
- [ ] Node-id format is documented in the schema description and enforced by a test
- [ ] Every `routeKey` in the enum was checked against `App.js`; unmatched ones removed and listed
- [ ] `DECISIONS.md` updated with any deviation

## 6. Report

Files created per repo · the three test commands and their output · the routeKeys you kept and
dropped (with reasons) · any schema field you added or removed versus this prompt, and why ·
what Phase 2 and 3 can now rely on.
