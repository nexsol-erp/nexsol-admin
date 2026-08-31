# Phase 1.2 — AI Branch Manager (Evidenced Insights → Human Tasks)

> Prompt file **1.2 of 6**. Paste this entire file into Claude Code as one message.
> Source: `e:\marketing\tradelink247-ai-branch-manager-workflow-claude-master-prompt.md` (1,222 lines),
> **validated against the live code in §3 — six of its assumptions are wrong.**
> Runs after Phase 1.1 (it reuses the `businessKey` convention and the sweep). Independent of 2–6.

---

## 1. Role and operating rules

You are adding an AI layer to a live multi-tenant ERP where the AI must never be the source of a
business number. Everything financial is already computed deterministically; the model's only job
is to explain it and propose an action a human then approves.

1. Preserve uncommitted work. Branch `feat/ai-branch-manager` in
   `c:\Users\Dell\nexsol-server-postgress`.
2. No unrelated refactoring.
3. **Never let the model produce a number.** Every figure in every insight must come from a
   deterministic service and be traceable to an evidence row. If you cannot cite it, do not print it.
4. **Ship the deterministic path first, with the AI disabled.** `AI_ENABLED=false` must produce
   useful insights via the fallback writer. If the feature is only useful with the model on, the
   design is wrong.
5. No completion claims without tests run against the **mock provider** — no test may need a real
   API key.

---

## 2. Where this fits — do not rebuild what other phases own

The source document is a self-contained 7-phase programme, but most of its scope is already owned.
Building it as written would duplicate three subsystems.

| Source doc section | Who actually owns it | What you do here |
|---|---|---|
| §9 Task Inbox, §10 Task Detail | **Already exists** — `MyTasksPage.jsx`, `/my-tasks`, `getMyTasks`, `completeWorkflowTask`, gated by `RequireWorkflowMenuAccess` | **Extend** it with the AI insight/evidence/feedback panel. Do not build a second inbox. |
| §11 Deep linking, route registry | **Product 360 Phase 3 + 4** (`NavigationTargetRegistry`, `navigationRegistry.js`) | **Reuse.** One allow-list for the whole product. If Phase 3 has not run, build it here to that contract and Phase 3 consumes it. |
| §7.1 Deduplication key | **Phase 1.1, D34** (`businessKey`) | **Reuse verbatim.** Do not invent a second key format. |
| §8 BPMN workflows | **Phase 1.1** (W1–W11 skeleton, sweep, assignment) | Add the AI-sourced ones to that skeleton. |
| §12 SLA / escalation | **Phase 1.1, D35** — the engine has no timers | Escalation is the scheduled sweep, not BPMN. |
| §6.2 Cost rule | **Already implemented** — view `v_sales_line_cost` (V043) | Reuse. Do not reimplement. |
| §17 Nightly scheduling | **Already exists** — `SalesCostScheduler`, `OutboxPublisherScheduler` | Follow that pattern. |

**What is genuinely new, and therefore what this phase is:**

1. **Persisted, evidenced insights** — the missing artefact. This is what makes Product 360's
   `insights` section shippable and lets D29 be revised.
2. **A provider-neutral AI client** with schema validation, budget, privacy and a deterministic fallback.
3. **The insight → task policy layer** (modes, materiality, cool-down, volume caps, kill switch).
4. **The AI panel on the existing Task Detail page** — explanation, evidence, feedback capture.

---

## 3. Validation of the source document

Read this before following the source document. Where the two disagree, **this section wins**.

### 3.1 Wrong assumptions — corrected

| # | Source says | Reality | Consequence |
|---|---|---|---|
| A1 | "MariaDB/MySQL" (§1) | **PostgreSQL 17**, database-per-tenant via Hibernate `DATABASE` multi-tenancy | Migrations, JSONB, and the `v_sales_line_cost` view are all Postgres |
| A2 | Engine supports "SLA, timers or escalation" (§1, §12) | **`SimpleBpmnParser` supports six constructs only**: `startEvent`, `endEvent`, `userTask`, `serviceTask`, `exclusiveGateway`, `parallelGateway`. **No timer, boundary or intermediate events.** `WfTask.dueDateTime` and `camunda.priority` are *recorded*, never *acted on* | SLA and escalation are a scheduled sweep. §8.7's "use timers" is not implementable |
| A3 | Assignment resolves by "Branch + Task group" (§12) | `tl:UserTaskConfig` group assignment resolves against `ROLES`/`USERS_ROLES` and **has no branch dimension** — assigning to `manager` notifies every manager in the tenant | Per-branch tasks must resolve a username and use `assignmentType=USER` (Phase 1.1 D36) |
| A4 | Roles include "Accounts team, Purchase/inventory team, Technical support group" (§4) | Actual roles: `admin`, `manager`, `user`, `WB`, `cgn`, `franchiseeuser`, `system-admin`, `MACHINE_ADMIN`. **None of the three exist** | Either create them deliberately as part of this phase, or map every workflow onto existing roles. Decide and record — do not silently assign to a role that has no members |
| A5 | "Tenant timezone" for scheduling (§17) | **No per-tenant or per-branch timezone exists.** `branch_mst` has only `day_end_required` (boolean); the only `timezone` column is on `users` | Schedule on server time; state the basis in the insight, as with Product 360 D11 |
| A6 | AI "must never generate SQL that is executed" (§3.1) | **The shipped AI Report Assistant already does exactly that** — `AiQueryExecutorService.executeDynamic(String sql)` runs native queries, guarded by `AiSqlValidatorService` (SELECT/`WITH` only, plus a table allow-list) | The principle is right *for this feature* but is stated as if describing the system. Restate it as scope-limited, and **do not** "fix" the Report Assistant here |

### 3.2 Incomplete

- **§6.2 cost rule omits a source.** It lists manual → transfer/purchase → unavailable. `V043` resolves
  **five** values: `MANUAL` (no date gate; branch-specific beats global) → most recent of
  `PURCHASE` / `STOCK_TRANSFER` / **`PRODUCTION_COST`** on or before the sale → `NOT_FOUND`.
  Production execution is a real cost source for the bakery tenants and must not be dropped.
- **§14 proposes eleven new tables.** Several duplicate what exists: `workflow_navigation_target`
  duplicates the Product 360 navigation contract, and `ai_task_context` risks becoming the competing
  task state the document's own §3.4 forbids. Ship the four in §5.1 and justify any more.
- **§9.1 "make the Task Inbox the default first workspace"** ignores `resolveLoginLanding(roles)` +
  `ROUTE_ORDER` in `App.js`, which already picks the first permitted route after login. Integrate
  with it; do not add a competing redirect.

### 3.3 Confirmed correct — build on these

- **§3.1's core principle** (deterministic metrics → fact packet → AI explains → schema validation →
  deterministic policy) is exactly right and is the reason this feature can be trusted.
- **§6.2's "never treat missing cost as zero"** already holds in the platform: `sales_dtl_cost`
  stores `NULL` cost and profit when `cost_rate` is null.
- **§3.3's no-AI-writes rule** is correct and non-negotiable.
- **§16's Kafka/outbox approach** matches reality: the ERP has `OutboxPublisherScheduler` and
  `kafka/framework`; miniflow has `KafkaAvroProducerConfig` + `AvroSchemas` and publishes instance
  and task events.
- **§13's provider abstraction** is worth doing — and note `e:\nexsol-ai-service` already reads
  `ANTHROPIC_API_KEY` from the environment (not committed) and already supports an **`ollama`**
  alternative, so a local-model path exists for cost control.
- **§22's acceptance scenarios** are good tests. Keep all five, especially D (provider failure) and
  C (duplicate suppression).

---

## 4. Architecture

```
SalesCostScheduler completes (nightly, existing)
        ↓
InsightSweep  (new — follows the SalesCostScheduler tenant-discovery pattern)
  1. freshness gate ....... stale? emit a DATA_QUALITY insight, stop
  2. deterministic metrics  BranchProfitReportService, StockReportService, SalesReportService …
  3. rule layer ........... candidate insights + severity + materiality (money at risk)
  4. fact packet .......... compact, redacted, evidence-referenced
  5. AiProviderClient ..... explanation + recommendation   ── AI_ENABLED=false → FallbackWriter
  6. schema validation .... invalid → fall back, never drop the insight
  7. persist .............. ai_insight + ai_insight_evidence
  8. TaskPolicy ........... INFORMATION_ONLY | SUGGEST_TASK | AUTO_CREATE_INVESTIGATION | APPROVAL_WORKFLOW
  9. start workflow ....... via Phase 1.1's launcher, with the D34 businessKey
```

Step 7 before step 8 is deliberate: **the insight is persisted whether or not it becomes a task.**
That record is the artefact Product 360 needs and the audit trail the policy decision refers to.

---

## 5. Tasks

### 5.1 Persistence — four tables, not eleven

Use the existing migration framework and Postgres types (`JSONB`, `timestamptz`).

| Table | Holds |
|---|---|
| `ai_insight` | tenant, branch, `insight_type`, severity, `materiality_amount`, period, `data_through`, `dedup_key` (**D34 format**), status, provider/model/prompt version, summary, explanation, recommendation, `fallback_used` |
| `ai_insight_evidence` | one row per cited fact: metric key, value, unit, currency, baseline, delta, source service, `route_key` + params |
| `ai_insight_task_link` | insight ↔ workflow `instance_id` / `task_id` + the policy decision and its reason. **Reference only — no task state.** |
| `ai_usage_log` | tenant, request, tokens in/out, latency, cost estimate, outcome (`OK` / `SCHEMA_INVALID` / `TIMEOUT` / `BUDGET_EXCEEDED`) |

Unique index on `(tenant, dedup_key)` where status is open. Config lives in existing config tables
or properties — do not add `ai_branch_manager_config` until something needs it.

### 5.2 Deterministic analytics and the rule layer

Reuse, never recompute: `BranchProfitReportService` and `sales_dtl_cost` (margin, cost source),
`StockReportService` / `StockAnomalyReportService` (stock risk), `SalesReportService` /
`SalesSummaryService` (sales), the expense services (expense anomalies).

Each rule emits: `insight_type`, severity, **materiality in money** (computed, never model-supplied),
evidence rows, and the D34 `businessKey`. **A rule with no evidence rows must not emit an insight.**

Initial types: `MARGIN_DECLINE` · `SALES_DECLINE` · `INVENTORY_RISK` · `TRANSFER_OPPORTUNITY` ·
`DISCOUNT_ANOMALY` · `EXPENSE_ANOMALY` · `DATA_QUALITY`.

### 5.3 AI provider

`AiProviderClient` (interface) · `AnthropicAiProvider` · `MockAiProvider` · `FallbackInsightWriter`.
Config by environment: `AI_ENABLED`, `AI_PROVIDER`, `AI_MODEL`, `AI_MAX_TOKENS`,
`AI_TIMEOUT_SECONDS`, `AI_DAILY_TOKEN_BUDGET_PER_TENANT`, `AI_MAX_REQUESTS_PER_MINUTE`,
`AI_TEMPERATURE`, `AI_WORKFLOW_CREATION_ENABLED`. **No key in source control** — follow
`nexsol-ai-service/config.py`, which reads `ANTHROPIC_API_KEY` from the environment.

Rules:
- Low temperature, JSON-schema-validated response. **Invalid JSON → fallback, never a dropped insight.**
- Timeout, bounded retry, circuit breaker, per-tenant token budget, prompt versioning.
- **Privacy:** the fact packet carries no customer phone/email/address, no payment data, no employee
  data, no free-text notes. Product names and all database text are **untrusted data, never
  instructions** — add prompt-injection tests with hostile item names.
- **A provider outage must never touch POS, sales, inventory or workflow.** Prove it with a test.

### 5.4 Task policy

Deterministic, configurable, and it may only ever *downgrade* the model's suggestion — never upgrade
it. Inputs: type, severity, materiality, evidence completeness, freshness, response validity, tenant
config, open duplicates, cool-down, daily cap, workflow availability, assignee availability.

`AI_WORKFLOW_CREATION_ENABLED` is the kill switch and defaults **off**. Volume caps and cool-downs
follow Phase 1.1 §5.2 — the failure mode of this feature is task fatigue, not missing capability.

### 5.5 APIs and UI

Backend, following `@RequestMapping("/api/{tenant}/…")`: list/get insights, get evidence, authorised
manual regeneration, submit feedback, usage/cost summary. `TenantAssertion` (Product 360 D14) on
every one.

Frontend — **extend `MyTasksPage.jsx` and the task detail view**, adding: the AI explanation with an
"AI-generated — verify before acting" notice, the evidence table (every number traceable), the
data-through timestamp and missing-data warnings, the deep-link buttons via the shared registry, and
resolution capture (`CONFIRMED_ACTION_TAKEN`, `CONFIRMED_FOLLOW_UP_REQUIRED`, `FALSE_POSITIVE`,
`DATA_ISSUE`, `NOT_ACTIONABLE`, `DUPLICATE`, `OTHER`) plus "was this useful / was it accurate".

Feedback is **stored for review only** — it must not feed back into model behaviour automatically.

---

## 6. Do not

- Do not let the model calculate, adjust or round any financial figure.
- Do not print a number that has no `ai_insight_evidence` row.
- Do not build a second Task Inbox, a second navigation registry, or a second dedup key.
- Do not add timer events to the engine — escalation is the sweep (D35).
- Do not assign a per-branch task to a role (D36).
- Do not let an insight auto-create an operational action; humans approve (§3.3).
- Do not "fix" the existing AI Report Assistant's SQL path — out of scope (A6).
- Do not require a real API key for any test.
- Do not enable AI workflow creation for any tenant.

---

## 7. Exit criteria

- [ ] `mvn clean test` passes under **JDK 17** — the 36 baseline tests still green
- [ ] **With `AI_ENABLED=false`**, the sweep produces useful insights via the fallback — show two
- [ ] With `MockAiProvider`, insights carry explanation + recommendation; **every number in the text
      matches an evidence row** (assert this in a test, not by eye)
- [ ] Invalid model JSON → fallback used, insight still persisted, `fallback_used = true`
- [ ] Provider timeout → ERP and workflow unaffected (scenario D)
- [ ] Prompt-injection test with a hostile item name changes nothing in the output
- [ ] Redaction test: no PII in the fact packet
- [ ] Duplicate condition on a second run creates **no second task** (scenario C) — show the counts
- [ ] Cross-tenant and cross-branch access denied (scenario E)
- [ ] Missing cost surfaces as *unavailable* with `cost_source`, never `0`
- [ ] Token budget exhaustion degrades to fallback rather than failing the run
- [ ] `AI_WORKFLOW_CREATION_ENABLED=false` by default, proven
- [ ] `DECISIONS.md` updated — record the A1–A6 corrections, and **revise D29** so Product 360's
      `insights` section can ship

## 8. Report

Files created · `mvn clean test` summary · two sample insights with `AI_ENABLED=false` and two with
the mock provider · the evidence-traceability test · duplicate-suppression counts · which roles you
created or mapped for A4 · confirmation that no test needs an API key · what Product 360 Phase 3
must query to render the `insights` section.
