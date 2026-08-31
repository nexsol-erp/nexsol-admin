# Phase 3 — Product 360 API (Spring Boot)

> Prompt file **3 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phase 1 (contract + `FINDINGS.md`). Independent of Phase 2 — they can run in parallel.

---

## 1. Role and operating rules

You are adding a read-only aggregation API to a live multi-tenant ERP with **801 Java files and
4 test classes**. There is no safety net; anything you touch outside your own package is
unreviewed by tests.

1. Preserve uncommitted work; branch `feat/product-360-api`.
2. **Reuse, never reimplement.** Every stock, sales, cost and profit number must come from the
   service that already produces it. The day the map disagrees with the report, the feature is
   dead — regardless of how good it looks.
3. No unrelated refactoring. One exception, narrowly scoped: task 4.2.
4. No completion claims without `mvn test` output.

---

## 2. Context

**Repo:** `c:\Users\Dell\nexsol-server-postgress` · Spring Boot 3.1.1 · Java 17 · Maven ·
PostgreSQL, **database per tenant** via Hibernate `DATABASE` multi-tenancy
(`tenency/DataSourceBasedMultiTenantConnectionProviderImpl`, `CurrentTenantIdentifierResolverImpl`,
`TenantContext` ThreadLocal).

**URL convention, verified:** controllers use `@RequestMapping("/api/{tenant}/…")` — e.g.
`StockReportController` is `@RequestMapping("/api/{tenant}/reports")`. Follow this. Product 360 is
not a report, so use `/api/{tenant}/product-360`.

**Security:** `spring-boot-starter-security`, JJWT 0.11.5, **HS256 with a shared secret**.
`security/JwtService` reads claims `activeTenant`, `accessibleTenants` (list),
`pendingTenantSelection`. `SecurityConfig` is stateless with a permit-list for
login/signup/updates/POS-download.

**On the classpath already:** `everit-json-schema` 1.14.4 (contract validation), Kafka, Lucene,
POI. Add no new dependency without justifying it in `DECISIONS.md`.

**Reuse these — read each before calling it:**

| Section | Service |
|---|---|
| `cost`, `profit` | `BranchProfitReportService` — **already implements the cost-priority rule and emits `costSource` with a `"NOT_FOUND"` sentinel**; also `SalesCostStampingService`, `ItemCostPriceHistoryService` |
| `stock` | `StockReportService`, `StockData`, `StockMovementCalculatorService`, `PhysicalStock` |
| `sales` | `SalesReportService`, `SalesSummaryService`, `SalesDtlService` |
| `supply` | `PurchaseService` (vendor + recent rates), `StockTransOutService`, `InterBranchTransferService` |
| `production` | `ProductionExecutionMst` — include only if `FINDINGS.md` Q6 says the BOM link exists |
| `insights` | `AiReportChatService` et al. — only if Q3 says insights are persisted per item |
| `tasks` | `WorkflowService` / miniflow (`e:\workflow`) — only if Q2 says tasks are queryable per product |
| product search | `ItemMstService`, `ItemCategoryMstService` |

---

## 3. The security requirement that is in scope

**`tenency/TenantFilter` sets the tenant from the `X-Tenant-ID` request header and never checks it
against the caller's JWT** — even though the token carries `activeTenant` and `accessibleTenants`.
Any authenticated user can currently read another tenant's data by changing a header.

**Your instructions, precisely:**

- **Do** create `security/TenantAssertion` and call it at the top of every Product 360 endpoint:
  the `{tenant}` path variable must equal the token's `activeTenant` or appear in
  `accessibleTenants`; otherwise `403` with no detail about what exists.
- **Do not** change `TenantFilter` or any other shared class. An 800-class blast radius with four
  test classes is a separate project with its own test plan.
- **Do** write the finding up in `docs/product-360/FINDINGS.md` under "Platform security gap",
  with the file, the mechanism, the impact and a recommended remediation sequence.

---

## 4. Tasks

### 4.1 Package layout

```
…/backendserver/controller/Product360Controller.java
…/backendserver/service/product360/
    Product360Service.java            orchestration, caching, section status
    Product360GraphAssembler.java     nodes + edges from section results
    NodeIdFactory.java                deterministic ids (D8)
    MetricFactory.java                unit/currency/scale/formatted + baseline (D9, D19)
    PeriodResolver.java               branch-local periods + baseline window (D11)
    DataFreshnessResolver.java        min dataThrough across branches (D10)
    BranchScopeResolver.java          server-side authorised branch set (D15)
    sections/{Stock,Sales,ProfitCost,Supply,Production,Insight,Task}SectionBuilder.java
    NavigationTargetRegistry.java     routeKey allow-list + parameter validation
…/backendserver/security/TenantAssertion.java
…/backendserver/config/Product360FeatureFlag.java
```

### 4.2 Endpoints

```
GET  /api/{tenant}/product-360/{productId}?fromDate=&toDate=&branchCodes=
GET  /api/{tenant}/product-360/{productId}/expand/{expansionKey}?…
GET  /api/{tenant}/product-360/search?q=&limit=      (reuse ItemMstService if a fit exists)
```

Every endpoint: assert tenant (4.3) → check the feature flag → resolve the authorised branch set
server-side → validate the product exists in this tenant → assemble → validate against the schema
in a test, not at runtime.

`branchCodes` is a *filter within* the authorised set, never a widening of it. An unauthorised
branch code is dropped silently and reported in `warnings` as `BRANCH_SCOPE_TRUNCATED` — do not
403 the whole request over one stale code in a bookmark.

### 4.3 Rules the implementation must satisfy

- **Cost.** Delegate to the existing rule. Manual rate wins outright; else the latest valid of
  transfer rate / purchase rate; else **`UNAVAILABLE`**. Missing cost is never `0`, and profit
  derived from a missing cost is `UNAVAILABLE` too, with a `COST_UNAVAILABLE` warning.
- **Aggregation, not fan-out.** One or a few set-based queries per section. If you find yourself
  writing a loop over branches that queries inside it, stop and rewrite it.
- **Branch cap (D13).** At most 12 `BRANCH_STOCK` nodes, ranked by severity then absolute value;
  the rest collapse into one `BRANCH_GROUP` node carrying the aggregate and the full list for the
  detail table.
- **Node ids (D8).** `{TYPE}:{scope}:{entityId}`. Two identical requests must produce
  byte-identical ids — this is what makes saved layouts survive. Assert it with a snapshot test.
- **Section degradation (D12).** Each builder returns `OK` / `DEGRADED` / `UNAVAILABLE` + a reason
  code. A builder that throws or times out degrades **its own section only**; the response still
  returns 200 with the sections that worked. Give each builder a timeout.
- **Freshness (D10).** `dataThrough` per section; the top-level value is the minimum; lagging
  branches produce a `BRANCH_SYNC_LAG` warning naming them. If Q5 found no sync-state source, use
  the max posted-transaction timestamp and say so in `period.basis`/`warnings` — never `now()`.
- **Periods (D11).** Resolve in branch-local time via the day-end configuration (Q4), and return
  the resolved window and `basis`. Also resolve the baseline window for D19.
- **Money and units (D9).** Format server-side with the tenant's currency and scale. `BigDecimal`
  throughout; never `double` for money.
- **Navigation (§6.4 of the contract).** `NavigationTargetRegistry` maps a section+entity to an
  allow-listed `routeKey` plus validated parameters. A URL never appears in the response.
- **Caching (D24).** Key = `tenant + sorted(branchSet) + productId + period + schemaVersion`,
  TTL ≤ 5 minutes, per-tenant isolation. Two users with different branch rights must never share
  an entry. Report `cacheHit` in the audit event.
- **Audit + metrics (D23).** One structured event per request: tenant, user, productId,
  branchScope size, period, nodeCount, durationMs, sectionStatuses, cacheHit. Kafka and an
  EventMonitor page already exist — prefer them to a new channel.
- **AI insights and workflow tasks (contract §6.6).** Both are read-only. A `WORKFLOW_TASK`
  node carries title, priority, status, assignee *only if the viewer may see it*, due/SLA state,
  workflow name and `instanceId`/`taskId`; it navigates to the existing task page and the API
  exposes **no completion path**. An `AI_INSIGHT` node carries title, severity, explanation,
  source period, evidence and its own `dataThrough`; **an insight without an evidence reference is
  not emitted**. Never generate node content from an LLM at request time. Verified constraints:
  tasks live in miniflow behind `WorkflowInstanceController`'s proxy
  (`miniflowUrl + /api/tasks/my`, filtered by username/groups/state only — **no product filter**,
  and no `businessKey` is set from an item id), and no persisted per-item AI insight store exists.
  Decide in this phase whether to introduce a `businessKey` convention (e.g. `item:{itemId}`) with
  the workflow owners or ship both sections `UNAVAILABLE`; record the choice in `DECISIONS.md`.
  Flag `insights` and `tasks` independently — a tenant may have one without the other.
- **Limits (D25).** Search `limit` capped server-side; period length capped (~400 days);
  per-user rate limit on graph and search.
- **Feature flag (D26).** Server-side tenant flag is authoritative and defaults **off**. A user
  whose role has the menu but whose tenant lacks the flag gets a clean 404/403, not a stack trace.

### 4.4 Tests (`src/test/java/…/product360/`)

Assume no shared fixtures exist; make each test self-contained.

- cost priority: manual wins over newer transfer/purchase rates
- **missing cost → `UNAVAILABLE` + `COST_UNAVAILABLE`, never `0`** (the highest-value test here)
- stock by branch matches `StockReportService` for the same inputs
- node ids stable across two assemblies of the same request (snapshot)
- >12 branches → 12 nodes + one `BRANCH_GROUP`, totals still correct
- a section builder throwing → that section `UNAVAILABLE`, response still 200 with other sections
- `dataThrough` = minimum, and lagging branches produce the warning
- `TenantAssertion`: mismatched tenant → 403; a tenant in `accessibleTenants` → allowed
- unauthorised `branchCodes` are dropped, not honoured, and are reported
- navigation targets validate; an unknown `routeKey` cannot be produced
- feature flag off → endpoint unavailable
- the response validates against `product-360.v1.schema.json` (`everit-json-schema`)

---

## 5. Do not

- Do not recompute stock, sales, cost or profit with new SQL when a service already does it.
- Do not modify `TenantFilter`, `SecurityConfig`, `JwtService` or any tenancy class.
- Do not return a URL, a raw table name, or an unfiltered exception message.
- Do not add a dependency without recording why.
- Do not let one section's failure fail the request.

---

## 6. Exit criteria

- [ ] `mvn test` passes; **the 4 pre-existing test classes still pass** — paste the summary
- [ ] Missing-cost test asserts `UNAVAILABLE` and would fail if someone made it `0`
- [ ] Node-id snapshot stable across two runs
- [ ] Tenant-isolation and branch-scope tests fail closed
- [ ] Schema validation test passes against all three Phase 1 fixtures
- [ ] p95 latency for a 12-branch product recorded from a real call
- [ ] `FINDINGS.md` contains the `TenantFilter` write-up
- [ ] `DECISIONS.md` updated

## 7. Report

Files created · `mvn test` summary · which existing services you reused per section and which
sections are `UNAVAILABLE` and why · the measured latency and node count · the `TenantFilter`
finding in three sentences · what Phase 4 can now call.
