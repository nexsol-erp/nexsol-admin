# Product 360 — Phase 0 Discovery Findings

**Date:** 2026-08-30 · **Author:** Phase 0 run · **Method:** direct source inspection

Answers to Q1–Q7 from [`PHASE-0-SETUP.md`](./PHASE-0-SETUP.md), plus one platform security finding.
Each answer carries its evidence so Phase 1 and Phase 3 do not have to re-derive it.

---

## Summary

| # | Question | Answer | Call |
|---|---|---|---|
| Q1 | Cost-priority rule and `costSource` values | Fully implemented in a DB view | **INCLUDE IN V1** |
| Q2 | Workflow tasks queryable per product? | **No** — proxy to miniflow, no product filter | **DEFER** — `tasks` = `UNAVAILABLE` |
| Q3 | AI insights persisted per item? | **No** — generated on demand, no store | **DEFER** — `insights` = `UNAVAILABLE` |
| Q4 | Branch day-end / timezone semantics | Only a `day_end_required` boolean; **no cutoff time, no per-branch timezone** | **DEFER** — `basis: UTC_CALENDAR` |
| Q5 | Per-branch offline-POS sync state | Partial — `pos_machine_mst.last_seen_at` | **INCLUDE, approximated** |
| Q6 | Production BOM / recipe link | **Yes** — `production_raw_material_def` | **INCLUDE IN V1** |
| Q7 | Production Nginx topology | Two: EC2+Nginx and CloudFront with 3 origins | **INCLUDE** — add a 4th origin |

Three of the eight graph sections (`insights`, `tasks`, and the branch-local basis of every period)
cannot be delivered from existing data. This is exactly the case D12 was designed for — the
sections stay in the contract and report `UNAVAILABLE`.

---

## Q1 — Cost priority rule · **INCLUDE IN V1**

**Evidence:** `src/main/resources/migrations/V043__v_sales_line_cost_v2.sql`,
`service/SalesCostStampingService.java`, `service/BranchProfitReportService.java:177`.

The rule is implemented as a **PostgreSQL view `v_sales_line_cost`**, whose header comment states
it verbatim:

1. **`MANUAL`** rate from `item_cost_price_history` — wins outright, **with no date gate**, because
   a manual rate is a correction that applies to the item's whole history. A branch-specific
   manual rate beats a global one (`branch_code IS NULL`).
2. Otherwise the **most recent voucher on or before the sale date**, whichever of purchase,
   stock-transfer-in or production execution is latest. V043 removed V041's `branch_type` gate, so
   a branch that both purchases and receives transfers gets whichever actually happened last.
3. Nothing found → `cost_rate NULL`, `cost_source = 'NOT_FOUND'`.

**`cost_source` values:** `MANUAL` · `PURCHASE` · `STOCK_TRANSFER` · `PRODUCTION_COST` ·
`NOT_FOUND`.

`SalesCostStampingService` materialises this into `sales_dtl_cost` via an idempotent
`INSERT … ON CONFLICT … DO UPDATE` with a per-tenant advisory lock, and — importantly for us —
already sets `cost_amount` and `profit_amount` to **NULL when `cost_rate` is NULL**, never zero.
The platform therefore already behaves the way D9 requires.

**For Phase 3:** read `sales_dtl_cost` / `BranchProfitReportRepository`. Map `NOT_FOUND` → section
status with a `COST_UNAVAILABLE` warning. Surface `cost_source` on the `COST` node — a manager
seeing "cost came from a transfer, not a purchase" is a large part of the value.

**Caveat recorded in the view's own comment:** purchase and transfer rates are used exactly as
stored and are *not* grossed up for tax, while `sales_amount` is tax-inclusive. If those rates are
ex-tax, margin is overstated. Do not fix this in Product 360 — it is one expression in V043 plus a
re-stamp. Flag it to the finance owner.

---

## Q2 — Workflow tasks per product · **DEFER**

**Evidence:** `controller/WorkflowInstanceController.java` (`@RequestMapping("/api/{tenantId}/workflow-instances")`).

The ERP does not store tasks. It **proxies to the miniflow service** (`e:\workflow`):

| ERP endpoint | Forwards to |
|---|---|
| `GET /my-tasks` | `miniflowUrl/api/tasks/my?tenantId&username&groups&state&page&size` |
| `GET /` | `miniflowUrl/api/instances?tenantId&status&page&size` |
| `GET /{instanceId}/tasks` | instance-scoped task list |
| `POST /tasks/{taskId}/complete` | completion |

Task filtering is by **user, group and state only**. Instances are started with a `businessKey`
(`StartRequest(String businessKey, Map variables)`), but **no code sets a `businessKey` from an
item or product id** — a grep for `businessKey` intersected with item/product returns nothing.

**Conclusion:** there is no way today to ask "which tasks concern item X". Two paths forward:

- **(a)** Agree a `businessKey` convention with the workflow owners (e.g. `item:{itemId}`) and add
  a miniflow query by `businessKey` prefix. Cheap, but only helps workflows started *after* the
  convention exists.
- **(b)** Add a product reference to the miniflow task/instance model. Correct, larger, owned by
  the workflow team.

**Recommendation:** ship v1 with `tasks: UNAVAILABLE / NO_PRODUCT_LINK`. Keep `WORKFLOW_TASK` and
`HAS_TASK` in the contract so enabling it later is additive.

---

## Q3 — AI insights per item · **DEFER**

**Evidence:** no insight entity exists in `entity/` (grep for `insight`/`anomaly` returns only
unrelated classes); `e:\nexsol-ai-service` has no insight table — `models/` holds per-tenant model
artefacts and `corrections_store.py` writes per-supplier JSON correction files.

Insights are **generated on demand** by `AiReportChatService` / `AiQueryExecutorService` /
`StockAnomalyReportService`. Under the contract's "never fabricate" rule (§6.6), an on-demand
generator is not an acceptable node source: a node asserting a business fact must trace to a
stored, evidenced result, and generating one per graph request would also be slow and
non-deterministic — which breaks the stable-layout guarantee in D8.

**Recommendation:** `insights: UNAVAILABLE / NO_PERSISTED_INSIGHTS` in v1. The nearest viable
future source is `StockAnomalyReportService` **if** its output is persisted per item and branch;
worth a follow-up, not a v1 dependency.

---

## Q4 — Day-end and timezone · **DEFER to `UTC_CALENDAR`**

**Evidence:** `BranchDayEndSettingsPage.jsx` reads and writes `/api/{tenancyId}/branches/{branchCode}`
— day-end configuration is **fields on `branch_mst`**, not a settings table. In `BranchMst` the
only related column is:

```java
@Column(name="day_end_required", columnDefinition="boolean default false")
Boolean dayEndRequired;
```

There is **no day-end cutoff time and no per-branch timezone**. The only `timezone` column in the
schema is on `users` (`UserInfo.timezone`).

**Consequence for D11:** branch-local period resolution has no data source. Periods must resolve on
calendar dates, and the response must declare `period.basis = "UTC_CALENDAR"` and
`period.timezone` = the server zone. **The fallback must be stated in the payload, not assumed** —
a tenant whose branches close at 02:00 will see a day's sales split across two dates, and the map
must not pretend otherwise.

Adding a per-branch timezone + cutoff is a small, high-value platform change. Recommend it
separately; do not do it inside Product 360.

---

## Q5 — Offline-POS sync state · **INCLUDE, approximated**

**Evidence:** `entity/PosMachineMst.java` has `@Column(name = "last_seen_at") LocalDateTime lastSeenAt`;
`controller/PosSessionController.java` (`/api/{tenantId}/pos-sessions`) proxies session/liveness to
nexsol-connect.

`last_seen_at` is a **liveness** signal (the terminal contacted the server), not a confirmation
that its sales are posted. It is the best available proxy.

**For Phase 3 (D10):** compute `dataThrough` per branch as
`min(max(posted voucher timestamp), last_seen_at of that branch's machines)` and emit
`BRANCH_SYNC_LAG` when a branch's value trails the request time by more than a configurable
threshold. Document in the response that this is a liveness approximation. **Never emit `now()`.**

---

## Q6 — Production BOM · **INCLUDE IN V1**

**Evidence:** `entity/ProductionRawMaterialDefEntity.java` → table `production_raw_material_def`
with `parent_id`, `item_id`, `item_code`, `item_name`, `qty`, `unit`, `rate`, `barcode`,
`tax_rate`. Alongside it: `ProductionDefEntity`, `ProductionDtlEntity`, `ProductionHdrEntity`,
`ProductionExecutionHdrEntity`, `ProductionExecutionDtlEntity`.

The parent → raw-material link is exactly what `PRODUCED_FROM` and the `INGREDIENT` node need, and
`unit` is present per line — which matters for D9, since ingredient quantities will not share the
finished product's UOM.

**For Phase 3:** `production` section is `OK` for manufactured items and
`UNAVAILABLE / NO_BOM_CONFIGURED` for items with no definition — that is a per-product answer, not
a per-tenant one.

---

## Q7 — Production Nginx topology · **INCLUDE**

**Evidence:** `Nginix-Config.txt` (server repo) and `e:\aws-infra\DEPLOYMENT-NOTES.md`.

Two topologies exist:

1. **EC2 + Nginx**, single origin: `tradelink247.com`, TLS via certbot, static frontend from
   `/var/www/html`, `location /api/` → `http://localhost:8082/api/`, SPA fallback
   `try_files $uri /index.html`.
2. **CloudFront with 3 origins** (`DEPLOYMENT-NOTES.md`): S3 static + `:8080` backend + `:8001` AI
   service, the AI service already routed under `/ai/`. `CF_DIST_ID` is wired into the
   `nexsol-admin` deploy with a cache invalidation step.

**Conclusion:** the single-origin decision (plan decision 4) is already how this platform works, and
**`/ai/` is the precedent to copy** — add `mindmap-api` as a fourth CloudFront origin under
`/mindmap-api/`, and a matching `location` block in the EC2 Nginx config. No CORS is required in
either topology. Confirm with the deploy owner which topology is live for the pilot tenant.

---

## Platform security gap — `X-Tenant-ID` is trusted

**Not one of Q1–Q7; found while reading tenancy code. Recorded here per Phase 3 §3.**

`tenency/TenantFilter.java`:

```java
String tenantId = request.getHeader("X-Tenant-ID");
if (tenantId != null) { TenantContext.setCurrentTenant(tenantId); }
```

The header is trusted outright. It is never compared against the caller's JWT — even though
`security/JwtService` already exposes `activeTenant` and `accessibleTenants` claims. Because
tenancy is **database-per-tenant**, `TenantContext` selects the datasource, so an authenticated
user who changes this header reads another tenant's database.

**Impact:** cross-tenant read (and, on any write endpoint, cross-tenant write) by an authenticated
user. Requires a valid login, so it is not anonymous — but any tenant's user can reach any other
tenant.

**Recommended remediation, in order:**

1. Add a `TenantAssertion` used by new endpoints (Product 360 does this in Phase 3) so no new
   surface inherits the gap.
2. Add validation inside `TenantFilter` behind a **report-only flag** first: log every request
   whose header disagrees with the token, without blocking. Run for one release to find legitimate
   callers (POS sync, franchise migration and the Kafka consumers are the likely ones).
3. Turn enforcement on once the log is clean; keep an allow-list for verified service-to-service
   callers, authenticated by something other than a spoofable header.

**Do not** perform step 2 or 3 inside the Product 360 work stream — 801 classes and 36 tests is the
wrong ratio for a silent behaviour change.
