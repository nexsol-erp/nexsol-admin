# TradeLink247 Product 360 — Master Implementation Prompt

**Version:** 2.0 (2026-08-30) · supersedes `tradelink247-product-360-mindmap-integration-claude-master-prompt`
**Companion document:** [`PRODUCT-360-PLAN.md`](./PRODUCT-360-PLAN.md) — file-level plan, gap analysis, risks.

---

## 0. How to use this prompt

**Executing a phase: paste that phase's file, not this document.** Each phase file is
self-contained — it repeats the role, the operating rules, the facts and the decisions that phase
needs, so there is nothing else to load.

| Phase | File | Depends on |
|---|---|---|
| 0 | [`PHASE-0-SETUP.md`](./PHASE-0-SETUP.md) — workspace, baselines, discovery Q1–Q7 | — |
| 1 | [`PHASE-1-CONTRACT.md`](./PHASE-1-CONTRACT.md) — JSON Schema, fixtures, 3 language models | 0 |
| 1.1 | [`PHASE-1.1-TASK-WORKFLOWS.md`](./PHASE-1.1-TASK-WORKFLOWS.md) — owner/branch-manager task workflows; establishes the `businessKey` convention | 1 |
| 1.2 | [`PHASE-1.2-AI-BRANCH-MANAGER.md`](./PHASE-1.2-AI-BRANCH-MANAGER.md) — evidenced AI insights → tasks; makes the `insights` section shippable | 1, 1.1 |
| 2 | [`PHASE-2-RENDERER.md`](./PHASE-2-RENDERER.md) — extract `@tradelink247/mindmap-renderer` | 1 |
| 3 | [`PHASE-3-ERP-BACKEND.md`](./PHASE-3-ERP-BACKEND.md) — Spring Boot Product 360 API | 1 |
| 4 | [`PHASE-4-ADMIN-UI.md`](./PHASE-4-ADMIN-UI.md) — the admin page | 2, 3 |
| 5 | [`PHASE-5-LAYOUT-NOTES.md`](./PHASE-5-LAYOUT-NOTES.md) — FastAPI auth, tenancy, layouts, notes | 1 |
| 6 | [`PHASE-6-DEPLOY-PILOT.md`](./PHASE-6-DEPLOY-PILOT.md) — deployment, flags, rollback | 2–5 |

Phases 2 and 3 are independent of each other; 5 can run alongside 4. Phase 1.1 is independently
useful — it ships value on its own and is what makes the `tasks` section deliverable.

This document remains the reference for the **verified facts (§2)**, the **locked decisions (§5)**
and the **contracts (§6)**. Read it once before starting; consult it when a phase file cites a
decision by number.

This prompt differs from a discovery prompt: the repositories have already been inspected and
the findings are recorded in §2 as **verified facts**. Do not re-derive them. Re-verify only the
items explicitly listed in §2.7 (unverified), and anything you are about to depend on that has
changed since 2026-08-30.

---

## 1. Role and operating rules

You are a senior engineer working across five surfaces: Spring Boot (Java 17), FastAPI (Python
3.11+), React (two different toolchains), PostgreSQL, and Docker/Nginx. You are implementing a
production feature in a live multi-tenant ERP, not a demo.

**Operating rules — these override default behaviour:**

1. **Preserve uncommitted work.** Both repositories have user changes. Run `git status` first;
   never discard, stash or revert anything you did not create.
2. **Feature branch only.** Never commit to `main`. Branch naming: `feat/product-360-<phase>`.
3. **No unrelated refactoring.** If you find a bug outside the feature, report it — do not fix it
   in this work stream. Exception: §5 D14 (tenant assertion), which is in scope because
   Product 360 must not inherit the defect.
4. **Stop at each phase gate.** Do not begin phase N+1 until phase N's exit criteria are met,
   verified by a real command, and reported.
5. **No completion claims without evidence.** "Builds" means you ran the build. "Tests pass"
   means you ran them and can paste the summary line. If you skipped something, say so.
6. **Conservative documented assumptions over blocking questions.** Ask only when proceeding
   either way would be unsafe or would waste the work if wrong. Otherwise choose, write the
   assumption into `docs/product-360/DECISIONS.md`, and continue.
7. **Read before writing.** Every file you edit, read fully first. Every endpoint you call,
   confirm exists.

---

## 2. Verified system facts

Established by direct inspection on 2026-08-30. Paths are absolute because the two repositories
live in different roots.

### 2.1 Repository locations

| Repo | Path | In Claude Code workspace? |
|---|---|---|
| TradeLink247 admin (React) | `e:\nexsol-admin` | Yes — primary working dir |
| TradeLink247 server (Spring Boot) | `c:\Users\Dell\nexsol-server-postgress` | Yes — additional working dir |
| Mind-map product | `e:\mind-map` | **No — must be added before Phase 2** |
| Workflow engine (miniflow) | `e:\workflow` | Yes |
| AI service (FastAPI) | `e:\nexsol-ai-service` | Yes |

> The earlier draft asserted both repositories were already in the workspace. `e:\mind-map` is
> **not** in the working-directory list. Add it (`/add-dir e:\mind-map`) before Phase 2 or every
> write to it will prompt.

### 2.2 TradeLink247 server — `c:\Users\Dell\nexsol-server-postgress`

- Spring Boot **3.1.1**, Java **17**, Maven. 801 Java files under
  `com.nexsol.backend.backendserver`.
- **PostgreSQL** (`org.postgresql.Driver`, `PostgreSQLDialect`). A `mariadb-java-client`
  dependency is present but the configured datasource is Postgres.
- **Multi-tenancy: `DATABASE` per tenant**, via
  `tenency/DataSourceBasedMultiTenantConnectionProviderImpl` +
  `CurrentTenantIdentifierResolverImpl` reading a `ThreadLocal` `TenantContext`.
- **`tenency/TenantFilter` sets the tenant from the `X-Tenant-ID` request header with no check
  against the caller's JWT.** See §5 D14 — this is a security gap Product 360 must not inherit.
- Security: `spring-boot-starter-security`, **JJWT 0.11.5, HS256, shared secret**.
  `security/JwtService` issues tokens carrying `activeTenant`, `accessibleTenants` (list),
  `pendingTenantSelection`. `SecurityConfig` is stateless, CSRF disabled, with a permit-list for
  login/signup/updates/POS-download routes.
- Kafka (`spring-kafka`), Neo4j driver, Lucene, POI, `everit-json-schema` (**a JSON-Schema
  validator is already on the classpath — reuse it for the graph contract**).
- **Existing tests: 4 files.** There is effectively no test baseline. New tests must stand alone;
  do not assume fixtures or a test slice configuration exists.

Relevant existing services (`…/backendserver/service/`):

| Concern | Service |
|---|---|
| Item master | `ItemMstService`, `ItemCategoryMstService`, `ItemIdGenerator` |
| Cost & profit | `BranchProfitReportService`, `SalesCostStampingService`, `ItemCostPriceHistoryService`, `ProfitLossService` |
| Stock | `StockReportService`, `StockData`, `StockMovementCalculatorService`, `PhysicalStock`, `OpeningStockService`, `StockAnomalyReportService` |
| Sales | `SalesService`, `SalesReportService`, `SalesDtlService`, `SalesSummaryService`, `PosSales` |
| Purchase / vendor | `PurchaseService`, `PurchasePostingAdapter`, `PurchaseCorrectionService` |
| Transfers | `StockTransOutService`, `AcceptStockTransfer`, `InterBranchTransferService`, `FranchiseStockTransferService` |
| Production | `ProductionExecutionMst` |
| Batches | `ItemBatchDtlService`, `ItemBatchPostingService` |
| AI | `AiReportChatService`, `AiQueryExecutorService`, `AiStandardReportRegistry`, `AIServiceWB`, `LocalAiService` |
| Workflow | `WorkflowService` (engine itself is the separate `e:\workflow` miniflow service) |

**`BranchProfitReportService` already implements the cost-priority rule** and emits a
`costSource` field with a `"NOT_FOUND"` sentinel. Product 360 must call into this, not
reimplement it.

### 2.3 TradeLink247 admin — `e:\nexsol-admin`

- **Create React App (`react-scripts` 5.0.1), plain JavaScript, not TypeScript.**
- React **18.3.1**, **MUI v5.16.7** (`@mui/material`), `@emotion` 11, `react-router-dom` 6.23,
  `react-i18next` 15 (every label goes through `t()`).
- **Already carries two graph libraries:** `reactflow@11.11.4` and the deprecated
  `react-flow-renderer@10.3.17`.
- Current production bundle: **1.68 MB gzipped main chunk**; CRA already prints the
  "significantly larger than recommended" warning.
- Menu/permission model (recently reworked): `src/menuCatalog.js` is the single source of truth
  for the menu tree; `src/components/MenuAccessContext.jsx` resolves permissions from
  `POST /api/{tenancyId}/role-menus/accessible-menus`; the Sidebar, the top-bar
  `GlobalMenuSearch` and `MenuMapPage` all consume it. **A new feature is exposed by adding one
  entry to `menuCatalog.js` with a `menuKey` that matches a backend menu name.**
- `App.js` already wraps some routes in `RequireWorkflowMenuAccess` — the pattern for a
  permission-gated route already exists; reuse it.
- Client state to distrust: `localStorage` holds `tenancyId`, `roles`, `branchCode`,
  `allowedBranches`, `jwtToken`.

### 2.4 Mind-map product — `e:\mind-map`

- **Backend: FastAPI 0.115** + SQLAlchemy 2.0 (typed `Mapped[]`) + Alembic 1.14 + Pydantic v2 +
  `psycopg` 3 + Postgres 16. Clean layering: `api/routes` → `services` → `repositories` →
  `models`. Tests exist and are meaningful (`backend/tests/`, 9 files, pytest).
- **There is no authentication and no tenancy.** `app/api/deps.py::get_current_user`
  *get-or-creates* a single demo user from `settings.default_user_email`. The `users` table has
  `name` + `email` only — no tenant column. `cors_origins` defaults to `*`.
- **Frontend: Vite 6 + TypeScript 5.7 + React 18.3 + MUI v6.2 + `@xyflow/react` 12.3 (React Flow
  v12) + `dagre`.** Tests via Vitest + Testing Library.
- **The extraction boundary already exists.** `frontend/src/components/mindmap/MindMapCanvas.tsx`
  (390 LOC) is pure props-in/events-out — no API client, no router, no service imports. Its only
  couplings are `@mui/material` (`Box`, `alpha`, `useTheme`), `@/theme/palette`
  (`MAP_THEMES`, `NODE_TYPE_STYLES`), `@/types`, and `@/utils` (`nodeSize`), plus its child
  `MindMapNode.tsx` (238 LOC) and `flowTypes.ts`.
- Independently Dockerised: `docker-compose.yml` with `db` / `backend` / `frontend`, a Postgres
  healthcheck, and Alembic migrations applied on container start.

### 2.5 The three toolchain conflicts (the core integration risk)

These are the reason a naive "extract a shared package" plan fails. They are addressed by
decisions D1–D4.

| # | Conflict | Consequence if ignored |
|---|---|---|
| 1 | Mind-map is **TypeScript + Vite**; admin is **JavaScript + CRA 5** | CRA does not compile TS from `node_modules`. Importing source directly fails at build. |
| 2 | Mind-map uses **MUI v6**; admin uses **MUI v5.16** | Two MUI + emotion instances in one bundle. A v6 component **cannot read the v5 `ThemeProvider` context** — theming, dark mode and `sx` silently break. Not a warning; a wrong-looking UI. |
| 3 | Mind-map uses **`@xyflow/react` v12**; admin already has **`reactflow` v11 and `react-flow-renderer` v10** | Three graph engines, ~150 KB+ added to an already-oversized bundle, and v11/v12 CSS class-name collisions. |

### 2.6 Corrections to the earlier draft

| Earlier claim | Reality |
|---|---|
| "Both repositories are available in the same workspace" | `e:\mind-map` is not in the working-directory list |
| "tenant MariaDB/MySQL databases" (§4, §14, §17) | Tenant databases are **PostgreSQL**; §2.1 of that draft said "Postgress" and contradicted itself |
| "Do not assume FastAPI… or React Flow" | It **is** FastAPI, and it **is** React Flow (`@xyflow/react` v12) |
| "Python… enforcing tenant/user ownership for stored layout data" | There is no auth and no tenant column at all — this is greenfield, not an extension |
| "Extend the existing Python backend using its current conventions" (auth) | The convention is *no auth*; the convention to follow is its **layering**, not its identity model |
| "Inspect the actual React graph/canvas library" | Done — see §2.4 |

### 2.7 Still unverified — confirm before depending on

1. Exact SQL/semantics inside `BranchProfitReportService` cost resolution (read it in Phase 3
   before wiring the `COST` node).
2. Whether `WorkflowService` in the ERP exposes product-scoped task queries, or whether tasks
   must be fetched from `e:\workflow` (miniflow) over HTTP.
3. Whether AI insights are persisted and queryable per item, or generated on demand.
4. Branch day-end/timezone configuration semantics (`BranchDayEndSettingsPage` exists in the
   admin) — required for D9.
5. Whether offline POS sync state is queryable per branch — required for D10.
6. Production/BOM data model — `ProductionExecutionMst` exists; the recipe/ingredient link is
   unconfirmed.
7. The Nginx configuration actually used in production (`Nginix-Config.txt` in the server repo,
   `e:\aws-infra` Terraform, and `e:\mind-map\frontend\nginx.conf` all exist).

---

## 3. Objective and scope

Build **Product 360 — Product Intelligence Map**: a read-only, interactive graph that answers, for
one product, in one view:

- Where is it stocked, and in what quantity, per branch?
- Which branches will run out; which are holding excess?
- Where is it selling well or badly?
- Is margin falling, and what cost or vendor change explains it?
- Are there open AI insights or workflow tasks about it?
- …with one click through to the authorised ERP report that proves each number.

**In scope (release 1):** exploration, expansion, personal layout, personal notes, navigation to
existing reports and task pages, export.

**Out of scope (release 1):** editing any ERP data from the map; completing workflow tasks;
shared/team notes; multi-product comparison; writing anything to a tenant database.

**Success is behavioural, not visual:** a branch manager who opens Product 360 must reach a
decision (transfer stock / review vendor / correct cost) faster than they would by opening three
reports. A pretty graph that does not shorten that path has failed.

---

## 4. Architecture and responsibility split

```
┌──────────────────── e:\nexsol-admin (CRA, JS, MUI v5) ─────────────────────┐
│  /product-360/:productId   (lazy-loaded route, menu-gated)                 │
│    ProductSelector · KpiSummary · <MindMapRenderer/> · NodeDetailDrawer    │
│    NavigationRegistry (routeKey → existing admin route + params)           │
└───────┬──────────────────────────────────────────┬─────────────────────────┘
        │ graph + KPIs (authoritative)             │ layout + notes (personal)
        ▼                                          ▼
┌─────────────────────────────┐        ┌──────────────────────────────────┐
│ Spring Boot 3.1.1           │  RS256 │ FastAPI (mind-map backend)       │
│ tenant PostgreSQL (per DB)  │ ─────► │ mindmap PostgreSQL               │
│ • auth, tenancy, branch ACL │ deleg. │ • layouts, notes, projects       │
│ • ALL stock/sales/cost/     │ token  │ • NO ERP data, NO ERP DB access  │
│   profit calculation        │        │ • verifies token: sig/aud/exp    │
│ • graph assembly + nav      │        └──────────────────────────────────┘
│   target allow-list         │
└─────────────────────────────┘
        ▲
        │ consumed by both frontends
┌───────┴──────────────────────────────────────────────────────────────────┐
│ @tradelink247/mindmap-renderer  (pre-built ESM+CJS+.d.ts, MUI-free)      │
│ extracted from MindMapCanvas.tsx · used by mind-map standalone AND admin │
└──────────────────────────────────────────────────────────────────────────┘
```

**The renderer must never:** compute a business value, decide a permission, build a URL, or call
an ERP API.
**The Python service must never:** hold tenant-DB credentials, store an ERP fact, or trust a
tenant/user id from a request body.

---

## 5. Locked decisions

Decisions D1–D13 resolve the toolchain conflicts and gaps found during inspection. D14–D25 are
the functionality the earlier draft omitted. Treat all as requirements; record any deviation in
`docs/product-360/DECISIONS.md` with the reason.

### Packaging and frontend

- **D1 — The renderer ships pre-built, not as source.** `@tradelink247/mindmap-renderer` is built
  with Vite library mode (or tsup) to `dist/` containing ESM + CJS + `.d.ts`. CRA consumes the
  built artefact. Never point CRA at `.ts` sources.
- **D2 — The renderer core is MUI-free.** Strip `@mui/material` from the extracted canvas; replace
  `Box`/`useTheme`/`alpha` with a `theme` prop of plain design tokens (colours, radii, font
  stack) plus CSS custom properties. This removes conflict #2 entirely and keeps the package
  usable by any host. Both hosts pass their own tokens (the admin passes its MUI v5 palette; the
  standalone app passes its MUI v6 palette). **Do not** solve this by upgrading the admin to
  MUI v6 — that is a large, unrelated, high-risk change to a 400-component app.
- **D3 — `react` , `react-dom` and `@xyflow/react` are `peerDependencies`.** The admin adds
  `@xyflow/react@^12` as a direct dependency. Leave the existing `reactflow@11` and
  `react-flow-renderer@10` alone (the BPMN designer may use them) but **record which components
  use which**, and import React Flow v12 CSS scoped to the Product 360 route to avoid class
  collisions.
- **D4 — Distribution: local `file:` dependency during development, private npm (or a committed
  tarball) for production.** Both repos pin an exact version. Document the publish + bump
  procedure. Git submodules are not permitted.
- **D5 — The Product 360 route is `React.lazy` + `Suspense` code-split**, with a hard budget: the
  admin's main chunk must not grow by more than **30 KB gzipped**; the Product 360 async chunk
  must stay under **250 KB gzipped**. Measure with `npm run build` before and after; fail the
  phase if exceeded.
- **D6 — The standalone mind-map app must consume the extracted package**, not a copy. One
  rendering implementation, verified by its existing Vitest suite still passing.

### Contracts and data

- **D7 — Contract source of truth is a JSON Schema** at
  `docs/product-360/schema/product-360.v1.schema.json`, validated in all three languages. Java
  uses the `everit-json-schema` already on the classpath; TypeScript types are generated or
  hand-written and asserted against fixtures; Python uses Pydantic v2 models.
- **D8 — Node IDs are deterministic and content-free:**
  `{nodeType}:{scope}:{entityId}` — e.g. `BRANCH_STOCK:BR001:ITM-1042`, `COST:ITM-1042`,
  `VENDOR:V-77:ITM-1042`. They must be reproducible across refreshes so saved layouts survive.
  IDs never contain a value, a date, or PII. Layouts store `schemaVersion`; a major bump
  invalidates layouts with a user-visible "layout reset" notice rather than a silent loss.
- **D9 — Every quantity carries its unit; every amount carries its currency and scale.** The
  earlier draft never mentions UOM — summing stock across branches without it is wrong.
  `metrics` entries are `{ key, value, unit, currency?, scale, formatted }`, formatted
  server-side. **JavaScript must never do money arithmetic**; the renderer displays
  `formatted` and nothing else.
- **D10 — `dataThrough` is the *oldest* successfully-synced branch timestamp in the selected
  scope, not `now()`.** The ERP has offline POS; a map that claims live data while one branch is
  three days behind is actively misleading. Each section carries its own `dataThrough` and the
  header shows the minimum, with a warning listing lagging branches.
- **D11 — Periods are resolved in branch-local time using the existing day-end configuration**,
  not UTC calendar days. State the resolved window explicitly in the response
  (`period.from`, `period.to`, `period.timezone`, `period.basis`).
- **D12 — Partial degradation, never total failure.** Each graph section (`stock`, `sales`,
  `profit`, `cost`, `supply`, `production`, `insights`, `tasks`) reports
  `status: OK | DEGRADED | UNAVAILABLE` with a reason. A BOM query timing out must still return
  the stock and sales sections. The UI renders what it has and shows what it lost.
- **D13 — Branch fan-out is bounded by rule, not by hope.** Render at most **12 branch nodes**,
  selected by severity then by absolute value; the remainder collapse into one
  `BRANCH_GROUP` node ("+37 branches, all within thresholds") that opens the full sortable table
  in the detail panel. The table is the accessible equivalent of the map.

### Security (D14 is in scope by exception)

- **D14 — Product 360 endpoints must assert tenant identity from the JWT, not the header.**
  `TenantFilter` currently trusts `X-Tenant-ID` outright. Add a
  `TenantAssertion` component that verifies the path/header tenant is the token's `activeTenant`
  or a member of `accessibleTenants`, and apply it to every Product 360 endpoint. **Do not**
  silently change `TenantFilter`'s behaviour for the other ~800 classes in this work stream —
  report it as a separate finding with a recommended remediation plan.
- **D15 — The authorised branch set is resolved server-side per request.** Never trust
  `allowedBranches` from `localStorage`. "All authorised branches" means the server's list.
- **D16 — The delegation token to FastAPI is a separate, short-lived, asymmetric token.**
  Not the ERP session JWT. RS256/EdDSA, TTL ≤ 5 minutes, `aud: "mindmap-layout-api"`,
  claims limited to `sub` (stable user id), `tenant`, `iat`, `exp`, `jti`. FastAPI holds only the
  **public** key. Rationale: the ERP session token is HS256 with a shared secret — handing it to
  a second service would let that service mint ERP sessions.
- **D17 — FastAPI gains an `AUTH_MODE` setting: `none` (standalone default, current behaviour)
  or `delegated` (ERP mode).** This preserves the standalone product exactly while making the
  ERP path secure. `get_current_user` is the single function that changes.
- **D18 — `cors_origins` must not default to `*` in any deployed configuration.** Narrow it, or
  eliminate cross-origin entirely by routing both through one Nginx origin.

### Functionality the earlier draft omitted

- **D19 — Comparison baseline is a first-class part of the contract.** Every metric that can
  move carries `{ current, previous, deltaPct, direction, baselineLabel }` for the equivalent
  prior period. "Margin is 14%" is not a decision input; "margin fell from 22% to 14%" is.
- **D20 — Export.** The map (PNG), the KPI summary and every detail table (Excel/CSV) must be
  exportable. The admin already bundles `html2canvas`, `jspdf` and `xlsx` — reuse them; add
  nothing.
- **D21 — Full i18n and dark mode.** Every label, node type, severity and warning goes through
  `t()` in the admin; the renderer accepts pre-translated strings and theme tokens and hardcodes
  no English and no colour. The admin has a working dark-mode toggle — the map must follow it.
- **D22 — Accessibility is a requirement, not "basics".** The detail table (D13) is the
  non-visual equivalent of the graph; keyboard traversal of nodes; visible focus; severity is
  never encoded by colour alone (icon + text label); `prefers-reduced-motion` disables layout
  animation.
- **D23 — Observability.** Emit one structured audit event per graph request
  (`tenant`, `user`, `productId`, `branchScope`, `period`, `nodeCount`, `durationMs`,
  `sectionStatuses`, `cacheHit`) and per navigation event. Expose latency, node-count and
  cache-hit metrics. An `EventMonitor` page and Kafka already exist — prefer them over a new
  channel.
- **D24 — Caching with an explicit invalidation story.** Cache key:
  `tenant + branchSet + productId + period + schemaVersion`. Short TTL (≤ 5 min), per-tenant
  isolation, and invalidation on the existing cost-stamping / day-end events. Never serve a
  cached graph across tenants or across users with different branch rights.
- **D25 — Rate limiting and input bounds.** Product search: debounced client-side (≥ 300 ms),
  server-side `limit` cap and per-user rate limit. Notes: max 4 000 chars, max 200 per user,
  stored as plain text, rendered escaped — never `dangerouslySetInnerHTML`. Graph requests:
  per-user rate limit; period length capped (e.g. 400 days).

### Rollout

- **D26 — Two-key feature flag.** Server-side tenant flag (authoritative) **and** a
  `"Product 360"` entry in `src/menuCatalog.js` assigned per role via the existing role-menu
  system. The server flag alone gates data; the menu entry alone gates visibility. Default:
  off for every tenant.

---

## 6. Contracts

### 6.1 Graph response (v1)

```jsonc
{
  "schemaVersion": "1.0",
  "viewType": "PRODUCT_360",
  "product":  { "id": "ITM-1042", "code": "…", "name": "…", "category": "…", "baseUom": "KG" },
  "period":   { "from": "…", "to": "…", "timezone": "Asia/Kolkata", "basis": "BRANCH_DAY_END",
                "baseline": { "from": "…", "to": "…", "label": "Previous 30 days" } },
  "scope":    { "branchCodes": ["BR001","BR002"], "resolvedBy": "AUTHORISED_SET" },
  "summary":  { /* KPI metrics, same metric shape as nodes */ },
  "sections": { "stock": { "status": "OK", "dataThrough": "…" },
                "production": { "status": "UNAVAILABLE", "reason": "NO_BOM_CONFIGURED" } },
  "nodes":    [ /* see 6.2 */ ],
  "edges":    [ /* see 6.3 */ ],
  "dataThrough": "2026-08-30T02:00:00Z",   // min across sections (D10)
  "warnings": [ { "code": "BRANCH_SYNC_LAG", "severity": "WARNING",
                  "message": "…", "branchCodes": ["BR007"] } ]
}
```

### 6.2 Node

`id` (D8) · `type` · `label` · `subtitle` · `severity` (`OK|INFO|WARNING|CRITICAL|UNKNOWN`) ·
`metrics[]` (D9 + D19 shape) · `evidence[]` · `navigationTargets[]` · `expandable` ·
`expansionKey` · `metadata` (allow-listed keys only — never free-form, never confidential).

Types: `PRODUCT` `CATEGORY` `BRANCH_STOCK` `BRANCH_GROUP` `SALES` `PROFIT` `COST` `VENDOR`
`PURCHASE` `STOCK_TRANSFER` `PRODUCTION` `INGREDIENT` `AI_INSIGHT` `WORKFLOW_TASK` `DATA_WARNING`.

### 6.3 Edge

`source` · `target` · `type` · `label` · `severity` · `metadata`.
Types: `STOCKED_AT` `SOLD_AT` `HAS_PROFIT` `USES_COST` `SUPPLIED_BY` `PURCHASED_FROM`
`TRANSFERRED_TO` `PRODUCED_FROM` `HAS_INSIGHT` `HAS_TASK` `GROUPED_INTO`.

### 6.4 Navigation target — allow-listed only

```jsonc
{ "routeKey": "BRANCH_PROFIT_REPORT",
  "parameters": { "productId": "ITM-1042", "branchCode": "BR001",
                  "fromDate": "…", "toDate": "…" },
  "returnContext": "p360:ITM-1042:BR001:20260801-20260830" }
```

A URL never crosses the wire. The admin maps `routeKey` → a real route from `menuCatalog.js`,
**rechecks the user's menu permission via `MenuAccessContext` before navigating**, and renders a
controlled error if the route is unmapped or not permitted. Route keys must resolve to routes
that actually exist in `App.js` — verify each one; drop any that does not.

### 6.5 Layout and notes (FastAPI)

Stored: `tenant_id`, `user_id`, `view_type`, `product_id`, `schema_version`, `node_positions`,
`collapsed`, `viewport`, timestamps. Unique on
`(tenant_id, user_id, view_type, product_id)`. Orphaned node ids are dropped silently on read;
surviving positions are kept; reset restores automatic layout. Notes: same ownership keys, plain
text, bounded per D25.

### 6.6 AI insight and workflow task nodes

These two node types are the reason the map is a decision surface rather than a report index, and
they are also the two places where the feature could invent a business fact. They get their own
rules.

**`AI_INSIGHT` node carries:** insight title · severity · short explanation · the reporting period
it was derived from · evidence references · its own `dataThrough` · confidence when the source
provides one. An insight with no evidence reference is **not rendered** — an unattributable
assertion about a manager's stock is worse than silence.

**`WORKFLOW_TASK` node carries:** task title · priority · status · assignee (only when the viewer
is permitted to see it — otherwise omit the field rather than substitute a placeholder) · due time
and SLA state · workflow name · `instanceId` + `taskId` for navigation.

**Rules for both:**

- **Read-only, and structurally so.** Clicking a task emits `WORKFLOW_TASK_DETAIL` and lands on
  the existing task page. The map never completes a task, never advances an instance, and never
  reimplements any part of the workflow state machine. Release 1 has no "complete" button
  anywhere on this page.
- **Never fabricate.** If a tenant has no AI insights or no workflow engine, the section is
  `UNAVAILABLE` with a reason code. Do not synthesise a plausible-looking insight, and do not let
  an LLM generate node content at request time. Every insight must trace to a stored, evidenced
  source.
- **Flag independently.** `insights` and `tasks` are separately feature-flagged; a tenant may run
  workflows without AI, or the reverse.
- **Permission is rechecked at click time**, not assumed from the presence of the node.

**Verified integration surface (2026-08-30) — read before designing either builder:**

- **Tasks are not stored in the ERP.** `WorkflowInstanceController`
  (`/api/{tenantId}/workflow-instances`) is a **proxy to the miniflow service** (`e:\workflow`):
  `/my-tasks` forwards to `miniflowUrl + /api/tasks/my` with `tenantId`, `username`, `groups`,
  `state`, `page`, `size`. **There is no product or item filter**, and no `businessKey` in the
  codebase is set from an item id. Product-scoped tasks therefore require either a `businessKey`
  convention (e.g. `item:{itemId}`) agreed with the workflow owners, or a new miniflow query —
  decide in Phase 3 and record it. Until then, `tasks` is `UNAVAILABLE`.
- **AI insights are not persisted.** There is no insight entity in the ERP and no insight store in
  `e:\nexsol-ai-service` (its `models/` holds per-tenant artefacts; `corrections_store.py` writes
  JSON correction files). Insights are generated on demand by `AiReportChatService` and friends.
  An on-demand generator is **not** an acceptable node source under the "never fabricate" rule
  without a stored, evidenced result — so `insights` is `UNAVAILABLE` in v1 unless Phase 3 finds a
  persisted, per-item source such as `StockAnomalyReportService` output.
- `AI_INSIGHT` remains in the schema from day one so that adding the source later is additive
  rather than a contract change.

---

## 7. Phases and exit criteria

Each phase ends with a report (§8). Do not proceed past a failing gate.

| Phase | Deliverable | Exit criteria (all must be evidenced) |
|---|---|---|
| **0. Setup** | `e:\mind-map` added to workspace; branches created in all three repos; `docs/product-360/DECISIONS.md` seeded from §5 | `git status` clean of unintended changes in all repos; both repos build from a clean checkout |
| **1. Contract** | JSON Schema v1; Java DTOs; TS types; Pydantic models; fixtures | Schema validates 3 golden fixtures (full / degraded / empty) in **all three** languages |
| **2. Renderer** | `@tradelink247/mindmap-renderer` extracted from `MindMapCanvas.tsx`; MUI-free (D2); read-only mode; typed events | Package builds ESM+CJS+d.ts; **standalone mind-map Vitest suite passes unchanged**; standalone app visibly works; renderer unit tests cover read-only enforcement, layout apply, all events |
| **3. ERP backend** | `Product360Service` + controller + navigation registry + `TenantAssertion` (D14) | `mvn -q test` passes; tenant/branch isolation tests pass; missing-cost test asserts `UNAVAILABLE`, never `0`; golden-graph snapshot stable across two runs (D8) |
| **4. Admin UI** | Lazy route, selector, KPI row, canvas, detail drawer, navigation, export, i18n, dark mode | `npm run build` passes; **bundle budget D5 met and reported**; permission-denied and empty-product paths render correctly |
| **5. Layout & notes** | Alembic migration (tenant+user columns), `AUTH_MODE`, delegation-token verification, layout/notes APIs | `pytest` passes; cross-tenant and cross-user access tests fail closed; expired / wrong-audience tokens rejected; `AUTH_MODE=none` keeps standalone behaviour |
| **6. Deploy & pilot** | Nginx/compose updates, health checks, feature flags, docs, rollback | Full stack starts from cold; standalone mind-map still starts independently; flag off by default proven; rollback rehearsed |

---

## 8. Reporting protocol

After every phase, report exactly this — no more:

1. **Files changed** — grouped by repo, with one line on why each changed.
2. **Commands run and their result** — the actual command and its summary line.
3. **Exit criteria** — each one, with pass/fail and the evidence.
4. **Assumptions made** — and where each is recorded.
5. **Risks and blockers** — what could still break, and what you could not do.

Never report a phase complete without §8.2. If you did not run the build, the phase is not done.

---

## 9. Definition of done

- [ ] All three repositories build; existing tests still pass; new tests pass.
- [ ] The standalone mind-map runs independently, unchanged in behaviour.
- [ ] Both frontends render through **one** renderer implementation.
- [ ] An authorised user selects a product and gets a useful map inside the budget in D5.
- [ ] Every stock/sales/cost/profit number originates in Spring Boot.
- [ ] Missing cost renders as *unavailable* with a warning — never as zero.
- [ ] Quantities show units; money shows currency; no JS money arithmetic (D9).
- [ ] `dataThrough` reflects the laggiest branch, and lag is surfaced (D10).
- [ ] A section failing degrades that section only (D12).
- [ ] Layouts and notes are isolated by tenant **and** user, proven by a failing-closed test.
- [ ] Navigation uses allow-listed route keys and rechecks permission at click time.
- [ ] Product 360 endpoints assert tenant from the JWT (D14); the `TenantFilter` gap is reported.
- [ ] FastAPI holds no tenant-DB credentials and stores no ERP fact.
- [ ] No secret or long-lived token in a URL, a frontend bundle, or version control.
- [ ] Feature is off by default; enabling for one pilot tenant is documented and reversible.
