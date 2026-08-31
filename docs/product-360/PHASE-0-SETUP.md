# Phase 0 — Setup, Baseline and Targeted Discovery

> Prompt file **0 of 6**. Paste this entire file into Claude Code as one message.
> Master document: [`PRODUCT-360-PROMPT.md`](./PRODUCT-360-PROMPT.md) · Plan: [`PRODUCT-360-PLAN.md`](./PRODUCT-360-PLAN.md)

---

## 1. Role and operating rules

You are a senior engineer preparing a multi-repository feature branch in a live multi-tenant ERP.
This phase writes almost no product code. Its job is to make every later phase measurable.

1. **Preserve uncommitted work.** All three repos have user changes. Never discard, stash, revert
   or commit anything you did not create.
2. **Feature branch only**, never `main`. Naming: `feat/product-360-<phase>`.
3. **No unrelated refactoring.**
4. **No completion claims without evidence.** Every number you report must come from a command
   you actually ran.
5. **Record, don't fix.** If discovery uncovers a defect, write it down. Do not repair it here.

---

## 2. Repositories

| Repo | Path | Stack |
|---|---|---|
| TradeLink247 admin | `e:\nexsol-admin` | CRA 5 (`react-scripts`), **JavaScript**, React 18.3, MUI **v5.16**, react-i18next |
| TradeLink247 server | `c:\Users\Dell\nexsol-server-postgress` | Spring Boot **3.1.1**, Java 17, Maven, PostgreSQL (DB-per-tenant) |
| Mind-map | `e:\mind-map` | FastAPI 0.115 + SQLAlchemy 2 + Alembic + Postgres 16 · Vite 6 + **TypeScript** + React 18.3 + MUI **v6.2** + `@xyflow/react` **12.3** |
| Workflow (miniflow) | `e:\workflow` | Spring Boot, `com.miniflow` |

`e:\mind-map` is **not** in the Claude Code working-directory list. Add it first — otherwise every
write to it prompts for permission.

---

## 3. Tasks

### 3.1 Workspace

1. Add `e:\mind-map` as a working directory (`/add-dir e:\mind-map`). Confirm it is listed.

### 3.2 Protect existing work

2. Run `git status` in **all four** repos. Write the output verbatim into
   `e:\nexsol-admin\docs\product-360\BASELINE.md` under "Pre-existing uncommitted changes".
   These files are off-limits for the rest of the project unless a phase explicitly names them.
   Known at time of writing in `e:\nexsol-admin`: modified `pos-electron/pos-config.json`,
   `pos-electron/vite.config.js`, `src/components/AIReportChatbot.jsx`, plus untracked dumps and
   markdown notes. Verify — this list is from 2026-08-30 and will have moved.

3. Create the branch in each repo you will touch:
   - `e:\nexsol-admin` → `feat/product-360-ui`
   - `c:\Users\Dell\nexsol-server-postgress` → `feat/product-360-api`
   - `e:\mind-map` → `feat/product-360-renderer`

### 3.3 Baseline measurements (these become the pass/fail bar for later phases)

4. **Admin bundle size — required for the Phase 4 budget.** Run `npm run build` in
   `e:\nexsol-admin` and record every chunk's gzipped size. On 2026-08-30 the main chunk was
   **1.68 MB gzipped**; re-measure, because Phase 4 fails if the main chunk grows by more than
   **30 KB gzipped** against *your* baseline.

5. **Test baselines.** Run and record the result of each, including failures — a pre-existing
   failure that you do not record will look like your regression later:
   - `mvn test` in the server repo (expect ~4 test classes; there is effectively no coverage)
   - `pytest` in `e:\mind-map\backend`
   - `npm test` / `npx vitest run` in `e:\mind-map\frontend`
   - `npm run build` in `e:\mind-map\frontend`
   - `npx eslint src` in `e:\nexsol-admin` (expect a handful of pre-existing `no-unused-vars`
     warnings; record them so new ones are visible)

6. Write all of it into `BASELINE.md` with the date and the exact commands.

### 3.4 Targeted discovery — answer these seven questions

Phase 1's contract cannot be finalised without these. Investigate each, then write
`docs/product-360/FINDINGS.md` with a short answer, the evidence (file + line), and a
recommendation of `INCLUDE IN V1` / `DEFER — section reports UNAVAILABLE`.

| # | Question | Where to look |
|---|---|---|
| Q1 | How exactly does the cost-priority rule resolve, and what are the possible `costSource` values? | `…/service/BranchProfitReportService.java` — it already emits `costSource` with a `"NOT_FOUND"` sentinel. Read the SQL. |
| Q2 | Can workflow tasks be queried **per product**? | `…/service/WorkflowService.java` in the server; `e:\workflow\src\main\java\com\miniflow\rest`; the admin's `MyTasksPage.jsx` shows what the task API already returns |
| Q3 | Are AI insights persisted per item, or generated on demand? | `AiReportChatService`, `AiStandardReportRegistry`, `AiReportDiscoveryService`, and `e:\nexsol-ai-service` |
| Q4 | What are the branch day-end / timezone semantics? | `BranchDayEndSettingsPage.jsx` in the admin, and the service behind it. Needed to resolve periods in branch-local time. |
| Q5 | Is offline-POS sync state queryable per branch (last successful sync)? | POS session / machine tables; the admin's `Connected POS Terminals` page (`/pos-sessions`) |
| Q6 | Does a production BOM / recipe model exist linking a product to ingredients? | `ProductionExecutionMst`, the production-definition tables behind `/production-def` |
| Q7 | Which Nginx config is actually in production? | `Nginix-Config.txt` (server repo), `e:\aws-infra` (Terraform), `e:\mind-map\frontend\nginx.conf` |

Q4 and Q5 are the two that change the contract. If day-end config is unreadable, periods fall back
to UTC calendar days **and that fallback must be stated in the API response**. If sync state is not
queryable, `dataThrough` falls back to the max posted-transaction timestamp and the response must
say so — never silently claim `now()`.

### 3.5 Seed the decision log

7. Create `docs/product-360/DECISIONS.md` containing D1–D26 from the master prompt as a table with
   columns `ID · Decision · Status (LOCKED/REVISED) · Rationale · Changed on`. Every later phase
   appends to this file rather than arguing in a commit message.

---

## 4. Do not

- Do not install a dependency, create a package, or write a schema — that is Phase 1 and 2.
- Do not "tidy" the pre-existing lint warnings or failing tests you find.
- Do not modify `TenantFilter.java` or any other shared security class.
- Do not commit the `.dump` files or any credential you encounter.

---

## 5. Exit criteria

- [ ] `e:\mind-map` is in the working-directory list
- [ ] Four `git status` outputs captured in `BASELINE.md`; no pre-existing change altered
- [ ] Three feature branches created and checked out
- [ ] Admin build succeeds; **every chunk's gzipped size recorded**
- [ ] Server / mind-map backend / mind-map frontend test results recorded, failures included
- [ ] `FINDINGS.md` answers Q1–Q7 with evidence and an INCLUDE/DEFER recommendation each
- [ ] `DECISIONS.md` seeded with D1–D26

## 6. Report

1. Files created (only the three docs should exist).
2. Every command run, with its summary line.
3. The baseline table: bundle sizes, test counts, pre-existing failures.
4. Q1–Q7 answers in one line each, with the INCLUDE/DEFER call.
5. Anything that blocks Phase 1.
