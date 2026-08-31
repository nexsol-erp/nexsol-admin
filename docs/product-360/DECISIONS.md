# Product 360 — Decision Log

Seeded from `PRODUCT-360-PROMPT.md` §5 at Phase 0 (2026-08-30). Every later phase **appends** here
rather than arguing in a commit message. A decision is `LOCKED` until it is explicitly `REVISED`
with a reason and a date.

| ID | Decision | Status | Rationale | Changed |
|---|---|---|---|---|
| **Packaging and frontend** |
| D1 | Renderer ships **pre-built** (ESM + CJS + `.d.ts`), never as TS source | LOCKED | CRA 5 does not compile TypeScript from `node_modules` | — |
| D2 | Renderer core is **MUI-free**; takes design tokens as a prop | LOCKED | Mind-map is MUI v6, admin is MUI v5.16. Two instances = two `ThemeContext`s; a v6 component in a v5 provider silently falls back to the default theme with no error | — |
| D3 | `react`, `react-dom`, `@xyflow/react` are **peer** dependencies | LOCKED | Admin already carries `reactflow@11` and `react-flow-renderer@10`; a bundled copy would be a fourth | — |
| D4 | `file:` dependency for dev, private npm or committed tarball for prod. **No git submodules** | LOCKED | No private registry found in either repo | — |
| D5 | Product 360 route is `React.lazy` split. Budget: main chunk **+30 KB gz max**, P360 chunk **≤250 KB gz** | LOCKED | Admin main chunk is already ~1.68 MB gz with CRA warning. Reference: the mind-map's own editor chunk (React Flow included) is **84.95 KB gz**, so 250 KB is generous | — |
| D6 | Standalone mind-map **consumes the package**, not a copy | LOCKED | One rendering implementation; its Vitest suite is the regression gate | — |
| **Contracts and data** |
| D7 | JSON Schema is the source of truth, validated in Java / TS / Python | LOCKED | `everit-json-schema` 1.14.4 is already on the server classpath | — |
| D8 | Node ids are deterministic `{TYPE}:{scope}:{entityId}`; layouts keyed off them | LOCKED | Saved layouts must survive a refresh | — |
| D9 | Every quantity carries a unit; every amount a currency + scale + server-side `formatted`. No JS money arithmetic | LOCKED | Multiple UOMs and batches. Confirmed compatible: `sales_dtl_cost` already stores NULL (not 0) cost/profit when cost is unresolved | — |
| D10 | `dataThrough` = **oldest** synced branch in scope, never `now()` | LOCKED | Offline POS. Source is `pos_machine_mst.last_seen_at` (liveness proxy) + max posted voucher — see FINDINGS Q5 | — |
| D11 | Periods resolve in **branch-local** time via day-end config | **REVISED → `UTC_CALENDAR`** | **No per-branch timezone or cutoff exists** — `branch_mst` has only `day_end_required` (boolean); the only `timezone` column is on `users`. Periods resolve on calendar dates and the response declares `basis: "UTC_CALENDAR"` | 2026-08-30 |
| D12 | Per-section `OK` / `DEGRADED` / `UNAVAILABLE`; partial degradation, never total failure | LOCKED | Reinforced by Phase 0: three sections ship `UNAVAILABLE` in v1 | — |
| D13 | Max 12 branch nodes + one `BRANCH_GROUP`; full list in the table | LOCKED | Readability and the accessible equivalent | — |
| **Security** |
| D14 | Product 360 endpoints assert tenant from the JWT. `TenantFilter` **not** modified in this stream | LOCKED | Gap confirmed and written up in FINDINGS. 801 classes / 36 tests is the wrong ratio for a silent behaviour change | — |
| D15 | Authorised branch set resolved server-side; `allowedBranches` from `localStorage` is never authority | LOCKED | — | — |
| D16 | Delegation token to FastAPI is **separate, asymmetric (RS256/EdDSA), ≤5 min, `aud: mindmap-layout-api`** | LOCKED | The ERP session JWT is **HS256 with a shared secret** — sharing it would let the second service mint ERP sessions | — |
| D17 | FastAPI gains `AUTH_MODE = none \| delegated`; `none` preserves standalone behaviour exactly | LOCKED | Mind-map has **no auth today** (`get_current_user` get-or-creates a demo user) | — |
| D18 | `cors_origins` must not default to `*` in any deployed config | LOCKED | Current default is `*` in both `settings.py` and `docker-compose.yml` | — |
| **Functionality added over the original brief** |
| D19 | Prior-period baseline on every movable metric | LOCKED | "Margin fell from 22% to 14%" is a decision input; "14%" is not | — |
| D20 | Export: PNG of the map, Excel/CSV of the tables, using already-bundled libs | LOCKED | `html2canvas`, `jspdf`, `xlsx` present | — |
| D21 | Full i18n (`t()`) and dark mode | LOCKED | `react-i18next` everywhere; working mode toggle | — |
| D22 | Accessibility: table as the non-visual equivalent, keyboard traversal, severity never colour-only, reduced-motion | LOCKED | — | — |
| D23 | Structured audit event + latency/node-count/cache-hit metrics | LOCKED | Kafka and an EventMonitor page already exist | — |
| D24 | Cache key `tenant + branchSet + productId + period + schemaVersion`, TTL ≤5 min | LOCKED | Never share across tenants or across differing branch rights | — |
| D25 | Rate limits and input bounds (search, notes ≤4 000 chars / ≤200, period ≤400 days) | LOCKED | — | — |
| D26 | Two-key feature flag: server tenant flag (authoritative) + `menuCatalog.js` entry. Off by default | LOCKED | Reuses the existing role-menu system | — |

---

## Phase 0 additions

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D27** | **Feature branches are cut from each repo's active development branch, not `main`** | LOCKED | `main` is stale in both repos: server `main` is **506 commits behind** (last commit 2025-05-13) and lacks `BranchProfitReportService` entirely; admin `main` is **752 commits behind** (last commit 2026-05-13). Branching from `main` produced a base without the services Product 360 must reuse | 2026-08-30 |
| **D28** | **Server builds require `JAVA_HOME=C:\Program Files\Java\jdk-17` and `mvn clean`** | LOCKED | Default JDK is 21; Lombok fails with `NoSuchFieldError: JCTree$JCImport.qualid`. A stale `target/` masks it — `mvn test` reported BUILD SUCCESS while compiling nothing and running zero tests | 2026-08-30 |
| **D29** | `tasks` and `insights` sections ship **`UNAVAILABLE`** in v1 | LOCKED — `tasks` revisable after Phase 1.1 | No product-scoped task query exists (miniflow proxy filters by user/group/state only; no `businessKey` is set from an item id) and no per-item AI insight store exists. FINDINGS Q2, Q3 | 2026-08-30 |
| **D30** | `production` section is **per-product**, not per-tenant | LOCKED | `production_raw_material_def` (parent_id → item_id, qty, unit) exists, so manufactured items get a real BOM and non-manufactured ones report `NO_BOM_CONFIGURED` | 2026-08-30 |
| **D31** | Single origin via the existing **CloudFront** distribution; `/mindmap-api/` added as a fourth origin, mirroring `/ai/` | LOCKED | `DEPLOYMENT-NOTES.md` shows CloudFront with 3 origins and the AI service already routed at `/ai/`. Same-origin removes the CORS question entirely | 2026-08-30 |
| **D32** | Mind-map frontend tests need `--testTimeout=30000` on this machine | LOCKED | `ProjectDashboard > creates a project and opens the editor straight away` times out at the 5 s default and passes at 30 s. Environment speed, not a defect — do not "fix" it in Phase 2 | 2026-08-30 |
| **D33** | Mind-map backend tests run against an **isolated Docker Postgres on :5433**, never the local ERP instance on :5432 | LOCKED | `tests/conftest.py` executes `DROP SCHEMA public CASCADE` on its target database | 2026-08-30 |

---

## Phase 1.1 additions (task-generating workflows)

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D34** | **`businessKey` convention:** `item:{id}` · `branch:{code}` · `branch:{code}\|item:{id}` · `voucher:{TYPE}:{no}` · optional `\|period:{p}`. Lowercase prefixes, `\|` separator, never a value/name/timestamp | LOCKED | Serves double duty: the dedupe key for the nightly sweep **and** the join Product 360 needs to answer "which tasks concern this product" (FINDINGS Q2). Adopting it is what makes D29's `tasks` section revisable | 2026-08-30 |
| **D35** | **The engine gets no timers.** Scheduling and escalation live in an ERP `@Scheduled` sweep | LOCKED | `SimpleBpmnParser` supports only `startEvent`, `endEvent`, `userTask`, `serviceTask`, `exclusiveGateway`, `parallelGateway` — no timer, boundary or intermediate events. Extending the parser is a separate project | 2026-08-30 |
| **D36** | **Per-branch tasks assign by resolved username (`assignmentType=USER`), never by role** | LOCKED | `tl:UserTaskConfig` group assignment resolves against the ERP's `ROLES`/`USERS_ROLES` and has **no branch dimension** — assigning to `manager` notifies every manager in the tenant. All assignment props interpolate instance variables, so the sweep resolves the specific user | 2026-08-30 |
| **D37** | Every task carries a `formKey` = an **ERP menu name**, deep-linking to the screen where the fix is made | LOCKED | `DbBackedEngine` maps `tl.UserTaskConfig.menuName` to `formKey`, and the role-menu system already governs those menus — so the link is permission-checked for free | 2026-08-30 |
| **D38** | Dedupe on `(processId, businessKey, open)` before every start; thresholds + top-N caps per branch per night; per-tenant enable, default off | LOCKED | Detectors re-cover a rolling window (POS syncs late — the reason `SalesCostScheduler` does the same), so without dedupe every night duplicates the previous night's tasks. Task fatigue is the primary failure mode of this kind of system | 2026-08-30 |

---

## Phase 1.2 additions (AI Branch Manager) — corrections to the source master prompt

Validated against live code on 2026-08-30. Source:
`e:\marketing	radelink247-ai-branch-manager-workflow-claude-master-prompt.md`.

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D39** | The AI Branch Manager's **only new artefact is the persisted, evidenced insight**. Task Inbox, navigation registry, dedup key, BPMN skeleton and SLA all belong to existing phases | LOCKED | The source doc is a self-contained 7-phase programme that would duplicate three subsystems: `MyTasksPage.jsx` already exists, Product 360 Phase 3/4 owns the route registry, Phase 1.1 owns `businessKey` and the sweep | 2026-08-30 |
| **D40** | **An insight is persisted whether or not it becomes a task** | LOCKED | It is the artefact Product 360's `insights` section needs and the audit record the policy decision refers to | 2026-08-30 |
| **D41** | **No number without an evidence row.** The model never calculates, adjusts or rounds a financial figure | LOCKED | Source §3.1, and the only basis on which an AI insight can be trusted in an ERP | 2026-08-30 |
| **D42** | **The deterministic path ships first.** `AI_ENABLED=false` must still produce useful insights via a fallback writer | LOCKED | If the feature only works with the model on, an outage or budget exhaustion takes the feature down | 2026-08-30 |
| **D43** | Source doc corrections **A1–A6** apply where the two disagree: A1 Postgres not MariaDB · A2 no engine timers · A3 group assignment has no branch dimension · A4 the accounts/purchase/support roles do not exist · A5 no tenant timezone · A6 the shipped Report Assistant *does* execute validated generated SQL, so §3.1's ban is scope-limited to this feature | LOCKED | Each verified against source; see PHASE-1.2 §3 | 2026-08-30 |
| **D44** | The cost rule has **five** sources, not three: `MANUAL` → latest of `PURCHASE` / `STOCK_TRANSFER` / **`PRODUCTION_COST`** → `NOT_FOUND` | LOCKED | Source §6.2 omits production execution, which is a real cost source for bakery tenants (V043) | 2026-08-30 |
| **D45** | Ship **four** AI tables, not the eleven proposed | LOCKED | `workflow_navigation_target` duplicates the Product 360 navigation contract, and `ai_task_context` risks the competing task state the source's own §3.4 forbids | 2026-08-30 |

**D29 is revisable once Phase 1.2 lands** — a persisted, evidenced insight is exactly what the
`insights` section was missing.

---

## Phase 1 additions (contract) — 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D46** | Java validates the schema with **everit in draft-07 mode**, after stripping `$schema`; **Python is the authoritative 2020-12 check** | LOCKED | `everit-json-schema` 1.14.4 (already on the classpath) tops out at draft-07. Every keyword the schema uses — `$defs`, `const`, `enum` with null, type arrays, `if/then/else` — exists in draft-07, and `#/$defs/...` resolves as an ordinary JSON pointer. Adding a 2020-12 Java validator was not worth a new dependency | 2026-08-30 |
| **D47** | Server-side JSON omits nulls (`NON_NULL`), except **`Metric`, which is `ALWAYS`** | LOCKED | The schema types `nodeMetadata` keys as plain strings, so emitted nulls fail validation. `Metric.value: null` is the opposite case — it is the signal that a figure is genuinely unavailable and must be transmitted | 2026-08-30 |
| **D48** | The schema and fixtures are **copied** into the server's `src/test/resources/product360/`, with a sync test that compares against the admin repo when present and skips when absent | LOCKED | The contract lives in the admin repo but the Java test must run standalone. A silent copy would drift; a hard cross-repo path would break CI | 2026-08-30 |
| **D49** | 13 route keys, each verified against **both** a `Route` in `App.js` and a `menuKey` in `menuCatalog.js`; the admin test asserts the mapping still holds | LOCKED | A contract naming a report the app does not have fails at click time, in front of a user. The test catches a renamed route at build time instead | 2026-08-30 |

---

## Phase 1.1 implementation findings — 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D50** | **W2 detects unreceived transfers by `stock_trans_out_hdr.is_processed = 0`, NOT by joining `stock_trans_in_hdr.ref_out_hdr_id`** | LOCKED | `ref_out_hdr_id` is populated on only **4,780 of 45,259** in-headers (10.6%) in a live tenant, so the join reports ~91% of all transfers as unreceived — **51,272 false conditions**. `is_processed` is what the application itself uses (`AcceptStockTransfer.findByToBranchCodeAndIsProcessed(branch, 0)`). Same tenant, same window: **8** conditions | 2026-08-30 |
| **D51** | Dedupe uses a **local `task_workflow_launch` ledger**, not a query to the engine | LOCKED | miniflow has no query by business key — `WfInstanceRepo` exposes `findByTenant` and `findByProcessId` only. Paging every instance nightly does not scale, and adding an endpoint means changing a service this work stream does not own. The ledger stores a reference plus an open/closed flag, never a competing task state machine; if the two disagree the engine wins | 2026-08-30 |
| **D52** | `AssigneeResolver` looks for **`admin` then `user`** mapped to the branch — **not `manager`** | LOCKED | There is **no `manager` role in the `ROLES` table** (admin, cgn, franchiseeuser, GRN_GROUP, hcho, MACHINE_ADMIN, PHYSICAL_STOCK, PHYSICAL_STOCK_REDUCE, production, purchaseuser, system-admin, user), despite the frontend's hardcoded role arrays referencing one throughout. Assigning to `manager` would route tasks to nobody | 2026-08-30 |
| **D53** | An unassignable condition is **skipped and logged**, never given to an arbitrary user | LOCKED | A task sent to the wrong person is worse than one never raised, and it teaches people to ignore the inbox | 2026-08-30 |
| **D54** | Detectors cap themselves at 100 conditions per run, **before** the launcher's per-branch cap | LOCKED | Defence in depth: a freshly migrated tenant could otherwise present tens of thousands of conditions in one sweep | 2026-08-30 |

| **D55** | **All schema changes ship as migrations.** `task_workflow_launch` is created by `V044__task_workflow_launch.sql` + `run_migration_v044.sh`; the sweep never DDLs a tenant database | LOCKED | Follows the existing V041–V043 convention. A nightly job silently altering a tenant schema is not something anyone wants to discover during an incident, so an unmigrated tenant is skipped with a warning — the same way `SalesCostScheduler` skips one without V042/V043 | 2026-08-30 |
| **D56** | Verification is an **integration test against a scratch database**, applying the real V044 file from the classpath | LOCKED | Proves what mocks cannot: that the partial unique index refuses a duplicate inserted past the launcher, that a resolved condition can recur, and that the migration is valid SQL. Uses `p360_verify`, never a tenant DB, and skips when absent so the suite stays portable | 2026-08-30 |
| **D57** | `isResolved` requires `cost_rate > 0` | LOCKED | Entering 0 to clear a task would reintroduce the exact "missing cost reads as free" failure the feature exists to prevent | 2026-08-30 |

**Environment gaps found (not defects — they block live verification):**

- `sales_dtl_cost` **does not exist in any local tenant DB** — V042/V043 are applied by shell script (`run_migration_v042_v043.sh`), not automatically. W1 cannot run live here; `isReady()` correctly skips such a tenant.
- `user_branch_map` is **empty (0 rows)** in the control DB, so W2 has nobody to assign to locally.
- ~~miniflow is not running~~ — **started** on port 8085 (`mvn spring-boot:run -Dspring-boot.run.profiles=local`), so `MiniflowClient` now has a live engine to talk to.
- Tenant schemas drift: `FGS` has no `ref_out_hdr_id` column at all.

---

## Phase 1.2 implementation — 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D58** | Schema is **`V045__ai_branch_manager.sql`** — four tables, applied by `run_migration_v045.sh`. The sweep never DDLs a tenant | LOCKED | Same rule as V044 (D55). `InsightRepository.isReady` gates the sweep | 2026-08-30 |
| **D59** | **`enabled` and `aiEnabled` are separate switches**; `workflowCreationEnabled` is a third and defaults off | LOCKED | The sweep is useful with the model off, so a tenant can run this without an AI budget and an outage degrades the prose rather than removing the feature | 2026-08-30 |
| **D60** | The policy may **downgrade** the model's suggested mode, never upgrade it | LOCKED | Otherwise the quality of the prose would decide how much work people are given — and prose is the one part of the pipeline that is not verifiable | 2026-08-30 |
| **D61** | Severity and materiality are computed from money, never taken from the model | LOCKED | Materiality decides what survives the volume cap; a model that could inflate it could buy itself attention | 2026-08-30 |
| **D62** | `AiInsight`'s constructor **refuses an insight with no evidence** | LOCKED | An unattributable claim about a manager's stock is worse than silence. Enforced in the type, not just in review | 2026-08-30 |
| **D63** | Fact packets **neutralise** injection attempts rather than dropping the text | LOCKED | Item names reach this system through invoice OCR and bulk upload, so a hostile name is realistic. An item genuinely called "System: Cleaner" must still be identifiable to the human reading the insight | 2026-08-30 |
| **D64** | A fallback narrative is capped at `SUGGEST_TASK` and never creates work by itself | LOCKED | Without a model there is no interpretation of context, so surfacing to a human is the safe default | 2026-08-30 |
| **D65** | Insights use the **same `BusinessKeys` format** as the workflows (D34) | LOCKED | Makes an insight and the task it produced joinable, and lets Product 360 find both by item — the join its `insights` section was missing | 2026-08-30 |

**D29 can now be revised for `insights`:** a persisted, evidenced, per-item insight exists and is
queryable via `InsightRepository.insightsForItem`. `tasks` still depends on Phase 1.1 running live.

---

## Phase 2 implementation (shared renderer) — 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D66** | **The package owns the canvas; the node component is a PROP.** `MindMapNode.tsx` was not extracted and not rewritten | **REVISES the Phase 2 file**, which said to extract both and strip MUI from each | The node is deeply MUI (Chip, Tooltip, Typography, icons) and the two hosts draw genuinely different things — the mind map shows title/tags/links, Product 360 shows metrics/severity/evidence. Rewriting it MUI-free would have changed the shipping product's visuals for no benefit, and one component serving both would serve neither. D2 is *better* honoured: `dist` contains no MUI at all rather than a rewritten copy | 2026-08-30 |
| **D67** | Hosts must **dedupe `react`, `react-dom`, `@xyflow/react`** | LOCKED | A `file:` dependency resolves the package's own devDependencies, so the app loaded **two React instances** and every hook threw the moment the canvas rendered. Fixed with `resolve.dedupe` in the app's Vite config. **The admin (webpack/CRA) needs the equivalent in Phase 4** — this will not announce itself politely | 2026-08-30 |
| **D68** | **The host imports `@xyflow/react/dist/style.css`**, not the package | LOCKED | The admin already ships `reactflow` v11, whose class names collide with v12's, so it must control where that stylesheet lands (inside the lazy Product 360 chunk). Bundling it in the package would remove that choice | 2026-08-30 |
| **D69** | A build guard (`verify-dist.mjs`) asserts `dist` imports only its declared peers | LOCKED | A naive `grep @mui dist/` flags the sourcemaps and the doc comments that explain *why* there is no MUI — a check that cries wolf is a check people learn to ignore. The guard parses imports instead | 2026-08-30 |
| **D70** | Adapters preserve existing contracts: `MindMapCanvasProps` and the node's `{ node, isSearchHit }` data shape are unchanged | LOCKED | `MindMapEditor.tsx`, `MindMapNode.tsx` and **both existing tests** needed no edits. The Phase 2 rule "do not edit an existing test to make it pass" held literally — 97/97 pass untouched | 2026-08-30 |

---

## Phase 3 (ERP API) — in progress, 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D71** | `TenantAssertion` **fails closed on every unexpected input** — no token, non-bearer header, partial token, unreadable token, blank tenant, null accessible list | LOCKED | Failing open would make a malformed token more powerful than a valid one. Denials are uninformative so a caller probing tenant names learns nothing | 2026-08-30 |
| **D72** | Tenant matching is **exact, never a prefix** | LOCKED | The live databases are named `9446968394a` and `9446968394a_satv` — different companies. A prefix match would merge them | 2026-08-30 |
| **D73** | Branch fan-out ranks by **severity first, value second** | LOCKED | Ranking by value alone would let twelve large healthy branches crowd out the one about to run out — the single node the map exists to surface | 2026-08-30 |
| **D74** | `NodeIdFactory` **normalises** a dirty identifier rather than dropping the node | LOCKED | A branch code containing a space is a data-entry artefact; refusing to render that branch is a worse answer than rendering it under a normalised, still-deterministic id | 2026-08-30 |
| **D75** | An unknown currency renders its **ISO code**, not a guessed symbol | LOCKED | "$" against the wrong dollar is a misread waiting to happen | 2026-08-30 |
| **D76** | The baseline window is always **equal in length** to the reporting window | LOCKED | Comparing 30 days against 31 shows a change that is only calendar arithmetic | 2026-08-30 |
| **D77** | An absurd date range is **clamped to 400 days**, not rejected | LOCKED | A four-year range is far more likely to be a stale bookmark than an intent worth failing the page over | 2026-08-30 |
| **D78** | `NavigationTargetRegistry` **throws** for a route key with no parameter allow-list | LOCKED | A new key must not silently accept anything; failing at assembly time is far cheaper than a link that filters to nothing in front of a user | 2026-08-30 |

| **D79** | **`dataThrough` is derived from the newest source record, never `now()`** — stock from `MAX(item_batch_mst.voucher_date)`, sales from the last sale, and `null` when there is nothing to date it from | LOCKED | Two places initially reported the clock. A branch that had posted nothing for a week would still have looked current, and somebody would have decided on silently stale figures. `toOffset` now returns null rather than rounding an absent timestamp up to "now" | 2026-08-30 |
| **D80** | `profit` and `cost` share one status because they come from one query | LOCKED | Splitting them would imply the two can disagree about the same rows, and they cannot | 2026-08-30 |
| **D81** | A disabled tenant gets **404, not 403** | LOCKED | A 403 confirms the feature exists and is merely switched off for you; 404 tells an enumerating caller nothing. Same reasoning as returning an identical response for an unknown product and another tenant's product | 2026-08-30 |
| **D82** | Sections not yet built (`supply`, `production`) are declared **UNAVAILABLE with a reason**, never omitted | LOCKED | An absent key leaves the client with a silent gap; a declared reason lets it say why the section is empty | 2026-08-30 |
| **D83** | `Product360Sections` is one class, not seven builders as the phase file specified | **REVISES the Phase 3 file** | Each section is a query plus a few nodes. The isolation that matters is the per-section try/catch in `Product360Service`, not a class boundary — and that is what the degradation test exercises | 2026-08-30 |

---

## Phase 4 (admin UI) — 2026-08-30

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D84** | The admin consumes the renderer as a **packed tarball** (`vendor/*.tgz`), not a `file:` directory link | LOCKED | CRA 5 offers no way to add `resolve.dedupe` without ejecting, and a symlinked directory brings the package's own `node_modules` — two React copies, every hook broken (D67). `npm pack` honours `files: ["dist"]`, so the tarball has no `node_modules` at all. Verified: 0 nested modules after install | 2026-08-30 |
| **D85** | React Flow v12's CSS is imported **inside the lazy Product 360 chunk**, never in `index.css` | LOCKED | The app still ships `reactflow` v11 for the BPMN designer and their class names overlap. A global import would restyle the designer | 2026-08-30 |
| **D86** | The page reuses `RequireWorkflowMenuAccess` rather than adding a second gate | LOCKED | It is already generic via its `menuKey` prop; a parallel guard would be a second place for the permission rule to drift | 2026-08-30 |
| **D87** | `BranchTable` sorts on `metric.value` but displays `metric.formatted` | LOCKED | Sorting the formatted string puts "1,240" before "9" and hides the largest branch at the bottom. The value is for sorting, the string is for reading — the browser still does no arithmetic | 2026-08-30 |
| **D88** | Severity is stated in **words as well as colour** on every node and table row | LOCKED | The map has to stay readable without colour vision and in a screenshot printed in mono | 2026-08-30 |
| **D89** | A node shows **at most two metrics**; the rest live in the drawer | LOCKED | A node dense enough to need reading is a node nobody reads | 2026-08-30 |
| **D90** | A late response from an abandoned product is **discarded, not painted** | LOCKED | Without the request-id guard, fast typing leaves one product's name above another product's numbers — wrong in a way that gets acted on before anyone notices | 2026-08-30 |

**Bundle budget (D5) met:** main chunk **1,687,410 B gz** against a 1.68 MB baseline — roughly **+7 kB**, inside the +30 kB limit. The Product 360 async chunk is **67.6 kB gz** (plus a 7.5 kB chunk and 2.8 kB of CSS), well under the 250 kB ceiling.

| **D91** | **`V046__product360_menu.sql` creates the menu row but assigns no roles** | LOCKED | Inserting into `role_menu_mst` would change who can see a feature, in production, without anyone deciding it — and which roles should have Product 360 differs per tenant. The product already has a screen for that decision (`/role-menu`); the migration's job is to make the option exist. An optional, commented block is included for a pilot tenant whose administrator has already decided | 2026-08-31 |
| **D92** | The V046 runner keys its readiness check on **`menu_mst`, not `branch_mst`** | LOCKED | Tenants can be partial: `FGS` has `branch_mst` but no `menu_mst`, and failed the run. Checking for the table the migration actually writes to means such a tenant is skipped with a note instead of failing the run for everyone else | 2026-08-31 |

**Permission-path inconsistency found while demoing (not fixed):** `MenuAccessContext` short-circuits with `if (isSystemAdmin) return true`, but `RequireWorkflowMenuAccess` has no such bypass — it only checks `allowed.has(menuKey)`. A system-admin therefore **sees every menu item but is denied by the route guard** for anything not explicitly assigned. This affects `/my-tasks` and `/bpmn-editorr` today, not only Product 360. Left alone deliberately: it is shared auth behaviour across three routes and making the guard more permissive is a decision, not a fix to slip in. Recommended resolution is to give the guard the same system-admin bypass, since the sidebar's behaviour is the one users read as correct.

---

## Phase 5 (layouts, notes, delegated auth) — 2026-08-31

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D93** | `users.tenant_id` is added **nullable → backfilled → NOT NULL**, and email uniqueness becomes per tenant | LOCKED | A NOT NULL column cannot be added to a populated table without a default, and the existing rows are real data belonging to whoever has been using the standalone app | 2026-08-31 |
| **D94** | The `User` **model and repository were updated alongside the migration** | LOCKED | Adding the column in Alembic alone broke 25 existing tests: every insert failed because the model never set it. A migration that the ORM does not know about is a migration that breaks the app on deploy | 2026-08-31 |
| **D95** | Ownership is scoped **inside `Product360Repository`**, not in the routes | LOCKED | Ownership that depends on each caller remembering a filter will eventually be forgotten in one place — and one forgotten filter is one person reading another's notes | 2026-08-31 |
| **D96** | The verifier uses an **explicit algorithm allow-list** | LOCKED | Defeats both classic JWT forgeries: `alg: none`, and HMAC-signing with the public key as the secret. Both have tests, and the second is **hand-assembled** because PyJWT refuses to encode it — that refusal protects minters, not verifiers, and the attacker is not using PyJWT | 2026-08-31 |
| **D97** | A token whose `exp - iat` exceeds the maximum is **rejected** | LOCKED | A long-lived token is a session token in disguise. Enforcing it here catches a misconfiguration on the minting side rather than trusting it to stay careful | 2026-08-31 |
| **D98** | Every rejection returns **one indistinguishable message** | LOCKED | An expired token and a wrongly-signed one must look identical, or the difference itself becomes the probing tool | 2026-08-31 |
| **D99** | An absent layout returns **an empty layout, not 404**; a schema-version mismatch returns `layout_reset: true` | LOCKED | "Where do these nodes go?" — "nowhere in particular" is a valid answer, and a 404 would make every caller special-case it. A reset that is reported can be explained; one that is silent looks like lost work | 2026-08-31 |
| **D100** | Note bodies are stored and returned **verbatim** | LOCKED | Escaping belongs to the renderer. Sanitising at rest corrupts legitimate text and implies a safety the storage layer cannot provide | 2026-08-31 |

**Regression gate held:** 113 tests pass, including all 62 pre-existing ones. `alembic upgrade head`
→ `downgrade -1` → `upgrade head` verified on a scratch database.

**Resolved in Phase 6:** the Spring Boot minting side is built, and the two sides are proved to
interoperate (D103).

---

## Phase 6 (deploy and pilot) — 2026-08-31

| ID | Decision | Status | Rationale | Date |
|---|---|---|---|---|
| **D101** | Production single origin is a **fourth CloudFront behaviour**, not an nginx gateway | LOCKED | CloudFront already fronts three origins. A fourth behaviour makes the layout call same-origin — no preflight, no CORS policy to get wrong. The nginx gateway exists for local and staging only | 2026-08-31 |
| **D102** | The delegation endpoint derives `tenant` and `sub` from the **caller's own session**, never from parameters | LOCKED | Accepting them as parameters makes it an endpoint that mints a token for anybody you can name, which is the whole attack it exists to avoid | 2026-08-31 |
| **D103** | Cross-language interop is **proved by a script**, not inferred from unit tests | LOCKED | Each side's tests prove that side self-consistent. RS256 padding, audience-as-array and the `exp`/`iat` window are all places two JWT libraries differ while each is internally correct. `scripts/verify-delegation-interop.sh` mints in JJWT and verifies in PyJWT | 2026-08-31 |
| **D104** | A valid token for **another tenant** returns 200 with an empty layout, not 403 | LOCKED | It is a legitimate caller from another company, not a forgery. Rejecting it would be wrong; what matters is it sees nothing of anyone else's, which is enforced by `(tenant, user)` ownership and was verified at the row level | 2026-08-31 |
| **D105** | Terraform changes are wrapped in **`dynamic` blocks gated on `enable_product360 = false`** | LOCKED | With the flag off the origin, behaviour and firewall rule are *absent*, not merely unused — a port that is not open cannot be probed — and applying unchanged leaves the live distribution untouched | 2026-08-31 |
| **D106** | `/mindmap-api/*` forwards `Authorization` but **not cookies**, unlike `/api/*` | LOCKED | That service authenticates from the delegation token alone. Forwarding the ERP session cookie would hand it an ambient credential it must not have | 2026-08-31 |
| **D107** | The integrated stack is a **compose override**, and it makes `CORS_ORIGINS` required | LOCKED | Plain `docker compose up` must still bring up the standalone product unchanged. The override also unpublishes the DB, backend and frontend host ports, and fails to start rather than starting permissively | 2026-08-31 |
| **D108** | `currencyFor(null)` **falls back** instead of throwing | LOCKED | Found by a test: `Map.of()` throws on a null key rather than missing it, and `TenantContext` is empty on unauthenticated paths. Falling back is the right answer for a caller with no tenant | 2026-08-31 |
| **D109** | The navigation audit endpoint **validates the route key against the allow-list** and stores nothing | LOCKED | A log line is read later by someone deciding whether something is wrong; a log an attacker can write is a log that can mislead them. Nothing is stored because this is an audit record, not analytics | 2026-08-31 |
| **D110** | Rollback step 4 carries an **ordering rule**: stop new → downgrade → start old | LOCKED | Exposed by rehearsal. Downgrading under a running new release corrupts nothing but 503s every request, because the new `User` model maps a column the downgrade removed. The previous release on the downgraded schema was verified serving real data | 2026-08-31 |

**Regression gate held:** 131 Java tests and 115 Python tests pass; admin lint unchanged at 142
warnings. Rollback step 4 rehearsed twice against a database holding real standalone content.

**Not done, and why:** the ERP services have no Dockerfile in either repo — they deploy to S3 and
EC2 — so the integrated compose stack cannot bring up all four services, and the "full stack from
cold" exit criterion is unmet as written. Containerising the ERP is a far larger change than this
feature and was not attempted. Terraform is not installed on this machine, so the `aws-infra`
changes are unvalidated and unapplied.

---

## Open — needs a human decision

| # | Question | Default taken | Who decides |
|---|---|---|---|
| 1 | Package distribution: private npm vs committed tarball | `file:` (dev) + tarball (prod) | Platform owner |
| 2 | Retire `reactflow@11` from the admin? | No — leave it, record importers | Frontend owner |
| 3 | Is the stale `main` in both repos intentional, and what is the real integration branch? | Branched from active dev line (D27) | **Repo owner — raised, unanswered** |
| 4 | `businessKey` convention to make tasks product-scoped | **Resolved by D34** (Phase 1.1) | — |
| 5 | Fix `TenantFilter` platform-wide? | No — assert locally, report the gap | **Security/platform owner — raised, unanswered** |
| 6 | V043 cost view does not gross up purchase/transfer rates for tax while sales are tax-inclusive | Not touched — flagged only | Finance owner |
| 7 | The `accounts` / `purchase` / `support` task groups in the AI doc do not exist as roles — create them, or map onto `admin`/`manager`/`user`? | Raised in Phase 1.2 §3 A4, unresolved | Ops owner |
