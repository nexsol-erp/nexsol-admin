# Product 360 — Implementation Plan

**Companion to** [`PRODUCT-360-PROMPT.md`](./PRODUCT-360-PROMPT.md) · drafted 2026-08-30
**Status:** planning only — no code written.

---

## 1. What changed after inspecting the repositories

The original brief was written before the repositories were read. Five of its assumptions are
wrong, and two of them change the shape of the work rather than its details.

| # | Assumption | Reality | Impact |
|---|---|---|---|
| 1 | Mind-map repo is in the workspace | `e:\mind-map` is not in the working-dir list | Trivial — add it |
| 2 | Tenant DBs are MariaDB/MySQL | PostgreSQL, database-per-tenant via Hibernate | Wording only |
| 3 | Framework unknown; "don't assume FastAPI / React Flow" | It is exactly FastAPI + React Flow v12 | Removes a whole discovery phase |
| 4 | **Python backend has auth and tenancy to extend** | **No auth, no tenant column, `*` CORS** | **Phase 5 is greenfield security work, not an extension** |
| 5 | "Extract a shared React renderer" is straightforward | **CRA/JS vs Vite/TS, MUI v5 vs v6, three graph libraries** | **Phase 2 needs a packaging design or it fails at build time** |

Items 4 and 5 are the two places this project can go badly wrong. Everything else is ordinary
feature work.

---

## 2. The frontend integration problem, in detail

This is worth being precise about, because the failure mode of #5 is silent.

**MUI v6 next to MUI v5.** Two copies of `@mui/material` means two `ThemeContext` objects. A v6
`Box` inside a v5 `ThemeProvider` does not throw — it falls back to the *default* MUI theme. The
map would render with default blue-on-white in an app themed dark, and no error would appear
anywhere. Debugging this after the fact is expensive.

Three ways out:

| Option | Cost | Verdict |
|---|---|---|
| Upgrade admin to MUI v6 | Touches ~400 components; MUI v5→v6 has breaking changes in `Grid`, pickers, and CSS layers | **Rejected** — unrelated risk, and the admin has almost no test coverage to catch regressions |
| MUI as `peerDependency`, host provides it | Works, but couples the package to MUI forever and to whichever major the host has | Viable fallback |
| **Renderer is MUI-free; takes design tokens as a prop** | ~1 day of work: `Box`→`div`, `useTheme`→prop, `alpha`→a 6-line util | **Chosen (D2)** — also makes the package reusable and lighter |

The extraction itself is genuinely easy: `MindMapCanvas.tsx` is already a pure component. Its
imports are `@mui/material` (3 symbols), `@/theme/palette` (2 constants), `@/types`, `@/utils`
(1 function), and its own child components. That is the whole coupling surface.

**CRA cannot consume TypeScript from `node_modules`.** So the package must ship built output
(D1). This also means the admin never needs TypeScript — it imports plain JS with types
alongside, which editors will use and CRA will ignore.

**Bundle.** The admin's main chunk is already 1.68 MB gzipped with CRA warning about it. React
Flow v12 + dagre is roughly 150–200 KB. Un-split, this makes an already-slow first load worse for
every user, including the ones who never open Product 360. Hence the lazy route and the explicit
budget in D5.

---

## 3. Gap analysis by repository

### 3.1 `c:\Users\Dell\nexsol-server-postgress` (Spring Boot)

| Need | Exists? | Work |
|---|---|---|
| Item master / search | `ItemMstService` | Reuse; add a bounded autocomplete endpoint if none fits |
| Stock per branch | `StockReportService`, `StockData` | Reuse — **do not** recompute |
| Sales aggregates | `SalesReportService`, `SalesSummaryService` | Reuse |
| Cost priority rule + `costSource` | `BranchProfitReportService` (emits `NOT_FOUND`) | Reuse; read the SQL first (§2.7.1) |
| Profit / margin | `BranchProfitReportService`, `ProfitLossService` | Reuse |
| Vendor / purchase history | `PurchaseService` | Reuse |
| Transfers | `StockTransOutService`, `InterBranchTransferService` | Reuse |
| Production / BOM | `ProductionExecutionMst` | **Unconfirmed** — may ship as `UNAVAILABLE` in v1 |
| AI insights per item | `AiReportChatService` et al. | **Unconfirmed** — feature-flag it |
| Workflow tasks per product | `WorkflowService` + `e:\workflow` | **Unconfirmed** — may need an HTTP call to miniflow |
| Graph assembly | No | **New** — `Product360Service` |
| Navigation registry | No | **New** |
| Tenant assertion from JWT | **No — header is trusted** | **New** (D14) |
| JSON Schema validation | `everit-json-schema` on classpath | Reuse |
| Test baseline | 4 test files | Tests must be self-contained |

### 3.2 `e:\nexsol-admin` (React)

| Need | Exists? | Work |
|---|---|---|
| Menu entry + permission gate | `menuCatalog.js`, `MenuAccessContext`, `RequireWorkflowMenuAccess` | Add one catalog entry; wrap the route |
| Route + lazy loading | Router present; nothing lazy today | New, `React.lazy` |
| Graph rendering | `reactflow@11`, `react-flow-renderer@10` (legacy) | Add `@xyflow/react@12` + the new package |
| Export | `html2canvas`, `jspdf`, `xlsx` | Reuse |
| i18n / dark mode | `react-i18next`, mode toggle in Sidebar | Wire through to the renderer |
| Product 360 page | No | New (~6 components) |
| Navigation registry (client half) | No | New |

### 3.3 `e:\mind-map` (FastAPI + Vite)

| Need | Exists? | Work |
|---|---|---|
| Clean layering to follow | `routes → services → repositories → models` | Follow it |
| Migrations | Alembic, applied on container start | Add revisions |
| Tests | pytest (9 files) + Vitest | Extend |
| **Authentication** | **None** — demo user get-or-created | **New** (D16, D17) |
| **Tenant isolation** | **None** — no tenant column | **New** — migration + constraints |
| Layout / notes storage | No (projects/nodes/edges only) | New tables |
| CORS hardening | Defaults to `*` | Fix (D18) |
| Renderer extraction | `MindMapCanvas.tsx` is already isolated | Package it (D1, D2, D6) |

---

## 4. File-level plan

Paths are relative to each repository root.

### Phase 1 — Contract
```
docs/product-360/schema/product-360.v1.schema.json          (admin repo, shared)
docs/product-360/fixtures/{full,degraded,empty}.json
server:  …/backendserver/model/product360/{Product360Response,Node,Edge,Metric,
         NavigationTarget,SectionStatus,Warning}.java
admin:   src/features/product360/contract/types.d.ts
mindmap: backend/app/schemas/product360.py
```

### Phase 2 — Renderer
```
mind-map/packages/mindmap-renderer/
  src/{MindMapRenderer,MindMapCanvas,MindMapNode,flowTypes,tokens,types}.ts(x)
  package.json · vite.config.ts (lib mode) · README.md
mind-map/frontend/src/components/mindmap/MindMapCanvas.tsx   → re-export from package
mind-map/frontend/package.json                                → add file: dependency
```
The standalone app keeps its MUI chrome (toolbar, dialogs, detail panel); only the canvas moves.

### Phase 3 — ERP backend
```
…/controller/Product360Controller.java
…/service/product360/{Product360Service,Product360GraphAssembler,
   StockSectionBuilder,SalesSectionBuilder,ProfitCostSectionBuilder,
   SupplySectionBuilder,ProductionSectionBuilder,InsightSectionBuilder,
   TaskSectionBuilder,NavigationTargetRegistry,NodeIdFactory}.java
…/security/TenantAssertion.java                     (D14)
…/config/Product360FeatureFlag.java                 (D26)
src/test/java/…/product360/*Test.java
```

### Phase 4 — Admin UI
```
src/features/product360/
  Product360Page.jsx · ProductSelector.jsx · KpiSummary.jsx
  Product360Canvas.jsx (wraps the package) · NodeDetailDrawer.jsx
  BranchTable.jsx (D13 accessible equivalent) · navigationRegistry.js
  useProduct360.js · useProduct360Layout.js · exportMap.js
src/App.js            → lazy route + permission wrapper
src/menuCatalog.js    → "Product 360" entry under Dashboard & Intelligence
```

### Phase 5 — Layout and notes
```
backend/alembic/versions/xxxx_add_tenant_and_product360_layouts.py
backend/app/models/{product360_layout,product360_note}.py
backend/app/schemas/product360.py · repositories/ · services/
backend/app/api/routes/product360.py
backend/app/api/deps.py            → AUTH_MODE + delegation-token verification
backend/app/config/settings.py     → auth_mode, jwt_public_key, jwt_audience, cors
backend/tests/test_product360_*.py
```

### Phase 6 — Deploy
```
mind-map/docker-compose.yml · nginx config (single origin)
server: Nginix-Config.txt / e:\aws-infra
docs/product-360/{DEPLOYMENT,ROLLBACK,LOCAL-DEV,DECISIONS}.md
```

---

## 5. Risks, ranked

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | MUI v5/v6 context split renders the map unthemed with no error | High if unaddressed | High | D2 — MUI-free renderer; visual check in both themes at the Phase 2 gate |
| 2 | Bundle regression slows the whole admin | High | Medium | D5 budget, measured before/after and reported |
| 3 | Python auth built wrong (shared HS256 secret) lets a second service mint ERP sessions | Medium | **Critical** | D16 — separate asymmetric key, FastAPI holds public key only, ≤5 min TTL, audience-checked |
| 4 | Product 360 inherits the `X-Tenant-ID` trust gap → cross-tenant read | Medium | **Critical** | D14 assertion on every endpoint; failing-closed tests |
| 5 | Graph assembly is an N+1 across branches; page takes 10 s+ | High | High | Server-side aggregation, D13 fan-out cap, D24 cache, latency metric in the Phase 3 gate |
| 6 | Production/BOM, AI insights or task-per-product turn out not to exist | Medium | Low | D12 section status `UNAVAILABLE`; ship without them |
| 7 | Renderer extraction breaks the standalone product | Medium | High | D6 + the existing Vitest suite is the gate |
| 8 | Layouts break whenever the graph changes | Medium | Medium | D8 deterministic ids; orphan-tolerant read; visible reset |
| 9 | Managers cannot read a 50-branch map | High | Medium | D13 grouping + table; the table is the primary surface for large tenants |
| 10 | Numbers on the map disagree with the reports | Medium | **Critical to trust** | Every metric reuses an existing service; evidence link on every node; golden-graph snapshot test |

Risk 10 deserves emphasis: the first time a manager sees the map say one thing and
`BranchProfitReport` say another, the feature is dead regardless of how good it looks. That is why
"reuse `BranchProfitReportService`, never reimplement" is a hard rule and not a preference.

---

## 6. Sequencing

Phases 1→2→3 can overlap partially: the contract (1) unblocks both 2 and 3, and 2 and 3 are
independent. Phase 4 needs 2 and 3. Phase 5 is independent of 3 and can run alongside 4. Phase 6
is last.

```
P0 ─ P1 ─┬─ P2 (renderer) ────┬─ P4 (admin UI) ─┬─ P6
         └─ P3 (ERP backend) ─┘                 │
                    P5 (layout/notes) ──────────┘
```

A sensible first vertical slice, if you want something demonstrable early: **product → stock →
sales → one navigation target**, with cost/profit/vendor/production/AI/tasks all reporting
`UNAVAILABLE` via D12. That proves the whole pipeline end to end in a fraction of the work, and
every later section is then additive.

---

## 7. Decisions that need you, not me

I picked a default for each; say the word if you disagree and I will revise the prompt.

| # | Question | My default | Why |
|---|---|---|---|
| 1 | Package distribution: private npm, or a `file:`/tarball dependency? | `file:` for dev, committed tarball for prod, until a private registry exists | No registry was found in either repo |
| 2 | Does the admin adopt `@xyflow/react` v12 and eventually retire `reactflow@11`? | Adopt v12 for Product 360; leave v11 alone for now; record which components use which | Retiring v11 is a separate work stream |
| 3 | Ship v1 without production/BOM, AI insights and tasks if they turn out not to be queryable per product? | Yes — `UNAVAILABLE` sections | Faster to real feedback; D12 makes it honest |
| 4 | Single Nginx origin, or CORS between two origins? | Single origin | Removes the CORS question entirely and avoids `*` |
| 5 | Fix `TenantFilter` globally as part of this work? | **No** — assert locally, report the gap separately | An 800-class blast radius with no test baseline is not something to change inside a feature branch |

Question 5 is the one I would most like you to weigh in on. The header-trust gap is real and
Product 360 must not inherit it, but fixing it platform-wide is its own project with its own
testing plan — doing it quietly inside this feature would be the wrong call.
