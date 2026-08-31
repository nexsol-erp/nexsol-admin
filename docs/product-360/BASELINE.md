# Product 360 — Phase 0 Baseline

**Captured:** 2026-08-30 · **Machine:** Windows 11, JDK 21 default (JDK 17 present), Node/CRA 5,
Python 3.12.6, Docker available.

This file is the "before" picture. Later phases are judged against these numbers — particularly
the bundle budget in D5 and the "no new warnings / no new failures" criteria. **A pre-existing
failure recorded here is not a regression later.**

---

## 1. Pre-existing uncommitted changes — do not touch

Captured before any branch was created. Everything listed here belongs to the user or to earlier
work in this session and is **off-limits** to Product 360 phases.

### `e:\nexsol-admin` (was on `feat/pos-cart-audit-log`)

```
 M pos-electron/pos-config.json
 M pos-electron/vite.config.js
 M src/App.js
 M src/components/AIReportChatbot.jsx
 M src/components/MenuMapPage.jsx
 M src/components/Sidebar.jsx
?? 9446968394a.dump
?? manual-step-migration.md
?? marketing.md
?? nexsoldb.dump
?? partner-commission.md
?? partner.md
?? pg-dump.md
?? src/components/GlobalMenuSearch.jsx
?? src/components/MenuAccessContext.jsx
?? src/menuCatalog.js
?? test-agent/report-1783468357833.json
```

Two distinct groups here, worth separating before any commit:

- **User WIP:** `pos-config.json`, `vite.config.js`, `AIReportChatbot.jsx`, the `.dump` files and
  the loose markdown notes.
- **The uncommitted top-bar menu-search feature** built earlier in this session: `App.js`,
  `MenuMapPage.jsx`, `Sidebar.jsx`, `GlobalMenuSearch.jsx`, `MenuAccessContext.jsx`,
  `menuCatalog.js`. **The bundle baseline below includes this work**, since it is in the working
  tree.

`docs/` (this directory) is the only thing Phase 0 added.

### `c:\Users\Dell\nexsol-server-postgress` (was on `fix/pos-sync-parent-resolution`)

Clean working tree.

### `e:\mind-map` (was on `main`)

Clean working tree.

### `e:\workflow` (on `main`, not branched — not modified by this project)

```
 M readme.md
 M src/main/resources/application-server.yml
?? .github/workflows/deploy_workflow.yml   ?? .idea/   ?? claude-prompt.md
?? deploy/   ?? pending-tasks.md   ?? workflow-db-init.sql
```

---

## 2. Branches created

| Repo | Branch | Based on | Base commit |
|---|---|---|---|
| `e:\nexsol-admin` | `feat/product-360-ui` | `feat/pos-cart-audit-log` (HEAD) | `b017c17` 2026-08-25 |
| `c:\Users\Dell\nexsol-server-postgress` | `feat/product-360-api` | `fix/pos-sync-parent-resolution` | `c7a3307` 2026-08-25 |
| `e:\mind-map` | `feat/product-360-renderer` | `main` | — |

**Neither `main` is a viable base — see D27.** Server `main` is **506 commits behind** (last commit
2025-05-13) and does not contain `BranchProfitReportService` at all; admin `main` is **752 commits
behind** (last commit 2026-05-13). Both are 0 commits *ahead*. The first attempt branched the
server from `main`, which produced a tree missing the cost/profit services Product 360 is built
on; it was deleted and recut from the active line.

**This needs the repo owner's confirmation** — either `main` should be fast-forwarded, or the real
integration branch should be named.

---

## 3. Build and test baselines

### 3.1 `e:\nexsol-admin` — CRA production build

```
CI=false npx react-scripts build
```

**Result: success.** File sizes after gzip:

| Chunk | Gzipped |
|---|---|
| `static/js/main.84fe734b.js` | **1.68 MB** |
| `static/js/239.2383f2a4.chunk.js` | 46.38 kB |
| `static/js/667.a59861da.chunk.js` | 42.18 kB |
| `static/css/main.27abfdd4.css` | 10.39 kB |
| `static/js/213.e1b1ae72.chunk.js` | 8.72 kB |

CRA prints *"The bundle size is significantly larger than recommended."*

**D5 budget, measured against the 1.68 MB figure:** main chunk may grow to at most **1.71 MB gz**;
the Product 360 async chunk must stay **≤ 250 kB gz**. For scale, the mind-map's own editor chunk —
which already contains React Flow v12 — is **84.95 kB gz**, so the budget is generous.

> **Side effect noted and reverted:** `build/` contains exactly one tracked file
> (`build/static/media/money-bag.3e2e7a07084a637f1818.png`, apparently committed by accident);
> the build deleted it. It was restored with `git checkout --`, and `git status build/` is clean.
> Anyone running a build in this repo will hit the same thing.

### 3.2 `e:\nexsol-admin` — ESLint

**The obvious command under-reports.** `npx eslint src` lints **only 30 files** and reports
6 warnings — because ESLint defaults to `.js` only, so **every `.jsx` file is skipped**, which is
most of the app and all of where Product 360 will live. Compare: linting
`src/components/Sidebar.jsx` explicitly reports 2 warnings that `eslint src` never sees.

**Use `npx eslint src --ext .js,.jsx` as the baseline command.** Result recorded in §3.2.1.

#### 3.2.1 `npx eslint src --ext .js,.jsx`  ← **the baseline**

**224 files linted · 142 problems · 0 errors · 142 warnings.**

| Rule | Count |
|---|---|
| `no-unused-vars` | 88 |
| `react-hooks/exhaustive-deps` | 50 |
| `no-dupe-keys` | 2 |
| `import/no-anonymous-default-export` | 1 |
| `eqeqeq` | 1 |

224 files versus 30 — the `.jsx` extension flag is the difference. Phase 4's "no new warnings"
criterion means **142**, using this exact command.

`no-dupe-keys` ×2 is worth someone's attention independently of this project: a duplicate key in an
object literal silently discards the earlier value. Not in scope here, not fixed.

For reference, `npx eslint src` (the under-reporting form) gives 6 warnings, 0 errors:
`App.js` ×3 (`Navigate`, `StockTransferInvoicePrint`, `language` unused), `BarChart.js` and
`PieChart.js` (`ChartJS` unused), `WorkflowDesigner/bpmn/customModules.js`
(`import/no-anonymous-default-export`).

### 3.3 `c:\Users\Dell\nexsol-server-postgress` — Maven

```
JAVA_HOME="/c/Program Files/Java/jdk-17" mvn -B clean test
```

**Result: `BUILD SUCCESS`, 36 tests, 0 failures, 0 errors, 0 skipped, 02:59 total.**

| Test class | Tests |
|---|---|
| `DayEndDtlCashExpenseTest` | 3 |
| `ExpenseHeadServiceTest` | 9 |
| `ShopExpenseServiceTest` | 20 |
| `StockTransOutServiceTest` | 4 |

**Two traps, both recorded as D28:**

1. **The default JDK is 21 and the build fails under it** with
   `NoSuchFieldError: Class com.sun.tools.javac.tree.JCTree$JCImport does not have member field 'qualid'`
   — the classic Lombok/JDK incompatibility. `JAVA_HOME` must point at
   `C:\Program Files\Java\jdk-17`.
2. **A stale `target/` hides it.** Without `clean`, Maven reported
   `Nothing to compile - all classes are up to date`, `No sources to compile` for tests, and
   `BUILD SUCCESS` — while running **zero tests**. Always `mvn clean test`.

Note the ratio: **801 main source files, 4 test classes.** There is no safety net for changes
outside your own package.

### 3.4 `e:\mind-map\backend` — pytest

```
TEST_DATABASE_URL=postgresql://mindmap:mindmap@localhost:5433/mindmap_test python -m pytest
```

**Result: 62 passed in 21.53s.**

Setup required (D33): `node_modules`/venv were absent, so a venv was created **outside the repo**
(in the session scratchpad) and `requirements-dev.txt` installed. `tests/conftest.py` runs
`DROP SCHEMA public CASCADE` against its target database, so tests were pointed at an **isolated
Docker Postgres on :5433** (`docker compose -f e:\mind-map\docker-compose.yml up -d db`, then
`CREATE DATABASE mindmap_test`) — **never** the ERP Postgres on :5432.

> The `mindmap-db` container and the `mindmap_postgres_data` volume were left running for Phase 5.
> `docker compose -f e:\mind-map\docker-compose.yml down -v` removes both.

### 3.5 `e:\mind-map\frontend` — Vitest and build

`npm install` was required first (no `node_modules`).

```
npx vitest run
```

**Result: 96 passed, 1 failed (97 tests, 11 files).**

The single failure is **pre-existing and environmental, not a defect** (D32):

```
tests/components/ProjectDashboard.test.tsx > creates a project and opens the editor straight away
Error: Test timed out in 5000ms.
```

Re-running that file with `--testTimeout=30000` gives **8 passed**. The full run took 203s with
531s of reported environment time — the machine is slow, not the code. **Phase 2 must not
"fix" this test.**

```
npm run build
```

**Result: success, built in 24.18s**, 1517 modules transformed:

| Chunk | Raw | Gzipped |
|---|---|---|
| `assets/ConfirmDialog-*.js` | 301.27 kB | 98.50 kB |
| `assets/index-*.js` | 264.25 kB | 88.84 kB |
| `assets/EditorPage-*.js` | 262.69 kB | **84.95 kB** |
| `assets/EmptyState-*.js` | 30.28 kB | 9.72 kB |
| `assets/DashboardPage-*.js` | 26.69 kB | 9.33 kB |
| `assets/EditorPage-*.css` | 15.87 kB | 2.67 kB |

`EditorPage` is the React Flow-bearing chunk and the best available proxy for what the extracted
renderer will cost the admin.

---

## 4. Reproducing this baseline

```bash
# admin
cd e:/nexsol-admin && CI=false npx react-scripts build
npx eslint src --ext .js,.jsx          # NOT `eslint src` — it skips every .jsx

# server  (JDK 17 + clean are both mandatory)
cd c:/Users/Dell/nexsol-server-postgress
JAVA_HOME="/c/Program Files/Java/jdk-17" mvn -B clean test

# mind-map backend  (isolated DB — conftest drops the schema)
docker compose -f e:/mind-map/docker-compose.yml up -d db
docker exec mindmap-db psql -U mindmap -d mindmap -c "CREATE DATABASE mindmap_test;"
cd e:/mind-map/backend
TEST_DATABASE_URL=postgresql://mindmap:mindmap@localhost:5433/mindmap_test python -m pytest

# mind-map frontend
cd e:/mind-map/frontend && npm install && npx vitest run --testTimeout=30000 && npm run build
```
