# Phase 1.1 — Task-Generating Workflows (Owner & Branch Manager)

> Prompt file **1.1 of 6**. Paste this entire file into Claude Code as one message.
> Runs after Phase 1, in parallel with Phases 2 and 3. **Independently useful** — it ships value
> even if Product 360 slips — and it is what unblocks Product 360's `tasks` section.

---

## 1. Role and operating rules

You are adding scheduled, exception-driven workflows to a live multi-tenant ERP whose workflow
engine is deliberately small. The engine will not save you from a bad design: it has no timers, so
anything time-based is code you write.

1. Preserve uncommitted work. Branch `feat/task-workflows` in
   `c:\Users\Dell\nexsol-server-postgress`; `e:\workflow` is touched only if the engine genuinely
   lacks something.
2. No unrelated refactoring.
3. **Ship one workflow end to end before starting the second.** A half-built set of nine is worth
   nothing; one that a branch manager completes daily is worth a lot.
4. No completion claims without running the sweep against a real tenant database and showing the
   tasks it produced — and, just as importantly, the tasks it correctly did **not** produce on the
   second run.

---

## 2. Why this is Phase 1.1

[`FINDINGS.md`](./FINDINGS.md) Q2 had to defer Product 360's `tasks` section: tasks live in
miniflow, are filtered only by user/group/state, and **no code sets a `businessKey` from an item
id**, so "which tasks concern this product?" is unanswerable.

This phase fixes that as a side effect. Every workflow here starts its instance with a structured
`businessKey` (§5), which is exactly the key Product 360 will query. Build these and D29 can be
revised from `UNAVAILABLE` to shipping.

---

## 3. Engine capabilities — verified, and narrower than you expect

**Source:** `e:\workflow\src\main\java\com\miniflow\parser\SimpleBpmnParser.java`,
`core\DbBackedEngine.java`, `persist\entity\Wf*.java`, `rest\*Controller.java`.

### What the parser supports — the complete list

`startEvent` · `endEvent` · `userTask` · `serviceTask` · `exclusiveGateway` · `parallelGateway`

**There are no timer events, no boundary events, no intermediate catch events, and no
subprocesses.** Consequences, and they are the whole architecture:

- A process **cannot start itself on a schedule.** An external sweep starts it.
- A process **cannot escalate after N days.** The sweep notices and escalates.
- A process **cannot wait.** Every instance runs to a user task immediately and stops there.

Do not design around a timer. Do not add one to the engine in this phase.

### What a user task can carry

`WfTask`: `assignee` · `dueDateTime` · `priority` · `formKey` · `state` · `createdAt` /
`completedAt`. `WfTaskCandidate`: candidate **users** (`type='U'`) and **groups** (`type='G'`).
`WfInstance`: `businessKey`. `WfVariable`: `value_text` and **`value_jsonb`**.

So SLA and priority can be *recorded and sorted on* — they simply are not *enforced* by the engine.

### How assignment actually resolves

`DbBackedEngine` reads the designer's own extension first (`tl:UserTaskConfig`, written by
`UserTaskConfigProvider.js` in the admin's Workflow Designer):

| Property | Meaning |
|---|---|
| `tl.UserTaskConfig.menuName` | becomes **`formKey`** — an **ERP menu name** |
| `tl.UserTaskConfig.assignmentType` | `USER` → `assignedUser`; `GROUP` / `ROLE` / `DEPARTMENT` → `assignedGroup` as a **candidate group** |
| `tl.UserTaskConfig.assignedUser` / `assignedGroup` | the target |
| `camunda.priority` / `camunda.dueDate` | optional priority and due date |

Legacy `zeebe:assignmentDefinition` is still read as a fallback.

**Two things follow, and they matter more than anything else in this document:**

1. **Every one of these properties is resolved through `resolveString(..., vars)` — they interpolate
   instance variables.** That is how you target *the manager of branch BR007* rather than every
   user holding the `manager` role: the sweep resolves the username and passes it as a variable,
   and the task uses `assignmentType=USER` with `assignedUser` bound to it. Group assignment
   (`GROUP`/`ROLE`/`DEPARTMENT`, all backed by the ERP's `ROLES`/`USERS_ROLES`) has **no branch
   dimension** — assigning to the `manager` role notifies every manager in the tenant. Use it only
   for genuinely tenant-wide roles such as the owner.
2. **`formKey` is a menu name**, which means a task can deep-link to a real ERP page that the
   role-menu system already governs. Use it. A task that lands the manager on the exact screen
   where the fix is made is the difference between a workflow people use and one they mute.

### Service tasks

`DbBackedEngine` resolves a `ServiceTaskHandler` by `taskType`, else falls back to a built-in HTTP
call or Java class from the node's props. So a service task can call back into the ERP — which is
how a workflow auto-verifies and auto-closes itself (§6, workflow W1).

### API surface

- ERP (verified): `POST /api/{tenantId}/workflow-instances/{processId}/start` with
  `StartRequest(String businessKey, Map<String,Object> variables)`; `GET …/my-tasks`;
  `GET …/{instanceId}/tasks`; `POST …/tasks/{taskId}/complete`. All proxy to miniflow.
- miniflow: `/api/tasks/my`, `/api/tasks/claimable`, `/api/tasks/{id}/claim`,
  `/api/tasks/{id}/assign`, `/api/instances`, `/api/workflow-definitions/**`.

The sweep should call the **ERP** endpoints, not miniflow directly, so tenant resolution and auth
stay in one place.

---

## 4. The architecture every workflow follows

```
@Scheduled sweep (ERP)                      miniflow
──────────────────────                      ────────
detect condition (SQL)
  └─ dedupe: open instance with
     this businessKey already?  ──yes──▶ skip
  └─ no ─▶ POST …/{processId}/start ──▶ startEvent
             businessKey + variables         └─▶ userTask  (assignee from vars, formKey = menu)
                                                  └─▶ exclusiveGateway on the outcome variable
                                                        ├─▶ endEvent (resolved)
                                                        └─▶ userTask (escalation / second approval)
escalation sweep
  └─ open task past dueDateTime? ──▶ start the owner's instance, linked by businessKey
```

**Follow the existing scheduler pattern** in `scheduler/SalesCostScheduler.java` and
`OutboxPublisherScheduler.java`: tenants are discovered by reading `pg_database` and excluding the
infrastructure databases, so new tenants are picked up with no config. Note `SalesCostScheduler`'s
reasoning about a **rolling window rather than yesterday-only**, because POS data syncs late
(`sales_trans_hdr.is_synched`) and bills are edited after the fact — the same is true of every
detector here, which is precisely why dedupe by `businessKey` is mandatory rather than nice.

---

## 5. Conventions — decide these once, here

### 5.1 `businessKey` (this is the deliverable that unblocks Product 360)

| Scope | Format | Example |
|---|---|---|
| Item, tenant-wide | `item:{itemId}` | `item:ITM-1042` |
| Item at a branch | `branch:{code}\|item:{itemId}` | `branch:BR007\|item:ITM-1042` |
| Branch, tenant-wide | `branch:{code}` | `branch:BR007` |
| Voucher | `voucher:{TYPE}:{number}` | `voucher:TRANSFER:TR-8891` |
| Period-scoped | append `\|period:{yyyy-MM}` | `branch:BR007\|period:2026-08` |

Rules: lowercase prefixes, `|` as the separator, **never** embed a value, a name or a timestamp —
the key must be stable so dedupe works and so Product 360 can match on it. Every workflow declares
its key shape in its BPMN documentation field.

### 5.2 Anti-fatigue rules — non-negotiable

1. **Dedupe before start.** Query for an open instance with the same `businessKey` and process id.
   Without this, night two duplicates every task from night one, forever.
2. **Cap volume.** A threshold *and* a top-N per branch per night, ranked by value at risk. Twelve
   actionable tasks beat four hundred true ones. Make the cap configurable per tenant.
3. **Every task has a definite closing action.** Never "acknowledge". A task closes because
   something changed in the ERP, and where possible the sweep verifies that and auto-completes it.
4. **Carry the evidence.** Put the `formKey` menu plus filter variables on the instance, so the
   task opens the screen showing the numbers that caused it.
5. **No task nobody can act on.** If the recipient cannot fix it from the linked screen, it is a
   report, not a task.

---

## 6. The workflow catalogue

Build **W1 and W2 first, in that order, one at a time.** The rest follow the same skeleton.

### W1 — Unresolved cost blocking profit → **owner**

The strongest starting point: unambiguous data, naturally shrinking volume, machine-verifiable
completion, and it improves every profit number in the system.

| | |
|---|---|
| **Detector** | `v_sales_line_cost` / `sales_dtl_cost` where `cost_source = 'NOT_FOUND'`, grouped by `item_id`, over the rolling window |
| **Assignee** | Owner — `assignmentType=ROLE`, `assignedGroup=admin` (genuinely tenant-wide) |
| **Task** | "Set a manual cost for {itemName} — {n} sales lines across {b} branches have no resolvable cost." |
| **`formKey`** | the Item Cost Override / Cost Price History menu |
| **Variables** | `itemId`, `itemName`, `lineCount`, `branchCount`, `salesAmount`, `firstSeenDate` |
| **Closes when** | a `MANUAL` row exists in `item_cost_price_history` for the item — a **service task** re-checks and auto-completes, so the owner never closes it by hand |
| **`businessKey`** | `item:{itemId}` |
| **Priority** | by `salesAmount` at risk |

Per the V043 view comment, a `MANUAL` rate has no date gate and re-stamping repairs history — so
resolving one task retroactively fixes every affected sale. Say so in the task text; it changes
how willingly people do it.

### W2 — Stock in transit not received → **branch manager**

| | |
|---|---|
| **Detector** | `StockTransOut` with no matching `AcceptStockTransfer` after 48 h |
| **Assignee** | `assignmentType=USER`, `assignedUser` = the **destination** branch's manager, resolved by the sweep |
| **Task** | "Confirm receipt of transfer {voucher} sent {date} from {fromBranch} — {n} items, {value}." |
| **`formKey`** | the Stock Transfer In / Branch Request menu |
| **Closes when** | the transfer is accepted (service-task verified), or a discrepancy note is recorded → gateway → owner task |
| **`businessKey`** | `voucher:TRANSFER:{number}` |
| **Due** | 24 h after creation; escalates to owner at 72 h |

In-transit stock is invisible to everyone until someone accepts it, so the cost of *not* doing this
is already being paid and is easy to demonstrate.

### The rest — same skeleton, build after W1 and W2 land

| # | Workflow | Detector source | Assignee | Closes when | `businessKey` |
|---|---|---|---|---|---|
| W3 | Stock-out risk | `StockReportService` cover-days + `ItemVelocity` | Branch manager (USER) | Transfer/indent raised, or reason recorded | `branch:{c}\|item:{i}` |
| W4 | Excess / slow-moving | `StockTurnover`, ageing | Branch manager (USER) | Transfer-out proposed or markdown applied | `branch:{c}\|item:{i}` |
| W5 | Near-expiry batches | `item_batch_dtl.expiry_date` within N days | Branch manager (USER) | Markdown, transfer or write-off recorded | `branch:{c}\|item:{i}` |
| W6 | Cycle count due | rotating ABC subset | Branch manager → owner on variance | Count submitted; variance over threshold escalates | `branch:{c}\|period:{m}` |
| W7 | Day-end missing / cash variance | `day_end_required` + `DayEndDtl` | Branch manager → owner | Day-end completed or variance explained | `branch:{c}\|period:{d}` |
| W8 | Purchase rate jump | new `purchase_rate` vs previous, > X % | Owner (ROLE) | Approved, rejected or renegotiated | `item:{i}\|vendor:{v}` |
| W9 | Margin drop | `BranchProfitReportService` period over period | Owner (ROLE) | Reviewed with recorded cause | `branch:{c}\|item:{i}\|period:{m}` |
| W10 | Expense over budget | Budget vs Actual | Owner (ROLE) | Approved or corrective action | `branch:{c}\|period:{m}` |
| W11 | Stock anomaly | `StockAnomalyReportService` | Branch manager → owner | Explained or correction posted | `branch:{c}\|item:{i}` |

### Validated against tenant `9446968394a` — 2026-08-31

Every predicate above was run against real data before writing a detector. Three of the nine
do not survive it.

| # | Verdict | Evidence |
|---|---|---|
| W3 | plausible | stock and sales both present; velocity needs its own validation |
| W4 | plausible | same |
| **W5** | **impossible** | `item_batch_mst.expiry` populated on **0 of 1,705,361 rows (0.0%)**; `item_batch_dtl` is empty |
| W6 | viable | `physical_stock_mst` = 22,574 rows |
| **W7** | **viable, with a window** | see below |
| W8 | viable, rewritten | `purchase_rate` at 5.4% — use the derived `amount / qty` instead |
| W9 | blocked locally | `sales_dtl_cost` absent until V032–V043 are applied |
| **W10** | **impossible** | `budget_header` = 0 rows, `budget_line` = 0 rows |
| W11 | plausible | no table; `StockAnomalyReportService` computes it |

**W5 was this document's own top recommendation, and it cannot be built.** Not "mostly null" —
entirely null, across 1.7 million rows. A near-expiry workflow here would produce perfect
silence, which reads as a broken feature. The warning above was right; the answer was simply
worse than expected.

**W10 has no budgets to compare against.** Both budget tables are empty.

Neither should be built until someone starts capturing that data. Both stay documented so the
gap is visible rather than mysteriously absent.

### W7 needs a recent window, or it buries the one real task

The naive predicate — *a branch-day with sales and no day-end* — raises **4,795 tasks**.

Day-end capture did not exist for most of the history. Coverage by month:

| month | branch-days sold | with a day-end |
|---|---|---|
| 2026-07 | 181 | **98%** |
| 2026-06 | 457 | 50% |
| 2026-05 and earlier | ~450/month | **0%** |

Anchoring on each branch's first-ever day-end barely helps (4,795 → 4,244), because day-end was
used briefly in mid-2025, abandoned, then re-adopted in June 2026.

The fix is not a better anchor but a **recent window**, because *a missed day-end from last year
cannot be actioned by anyone*. Task volume must be bounded by what somebody can actually do:

| window | tasks | branches |
|---|---|---|
| 7 days | **1** | 1 |
| 14 days | **1** | 1 |
| 30 days | **1** | 1 |
| 60 days | 20 | 9 |
| 90 days | 436 | 16 |

**Build W7 with a 30-day window.** One genuine, closeable task today. The naive version would
have buried it under 4,794 that nobody can close — the same failure as W2's 51,272 false
positives, caught this time before any code was written.

The window is measured from the **data's own latest date**, not `CURRENT_DATE`, for the reason
in `PHASE-2.0-DETECTION-PROGRAMME.md` §2: on a restored or lagging database a clock-based window
silently raises nothing, and silence is indistinguishable from health.

---

## 7. Files to create

```
c:\Users\Dell\nexsol-server-postgress\src\main\java\…\backendserver\
  scheduler/TaskWorkflowScheduler.java          tenant loop, follows SalesCostScheduler
  service/taskworkflow/
    TaskWorkflowLauncher.java                   dedupe + start + variables
    BusinessKeys.java                           §5.1, the single place keys are built
    AssigneeResolver.java                       branch code → branch manager username
    detectors/UnresolvedCostDetector.java       W1
    detectors/TransferNotReceivedDetector.java  W2
    TaskEscalationSweep.java                    open + past due → owner instance
  config/TaskWorkflowProperties.java            thresholds, top-N caps, per-tenant enable
src/test/java/…/taskworkflow/*Test.java

docs/workflows/
  W1-unresolved-cost.bpmn
  W2-transfer-not-received.bpmn
  README.md                                     key conventions, how to publish a version
```

BPMN files are authored in the admin's Workflow Designer and published through
`/api/workflow-definitions/{processId}/versions/{version}/publish`; commit the exported XML so the
definitions are reviewable in git.

---

## 8. Do not

- Do not add timer/boundary events to `SimpleBpmnParser` in this phase. Escalation is the sweep's job.
- Do not assign a per-branch task to a role — every manager in the tenant would receive it.
- Do not start an instance without checking for an open one with the same `businessKey`.
- Do not create a task whose only action is "acknowledge".
- Do not put a value, a name or a timestamp inside a `businessKey`.
- Do not enable a workflow for all tenants at once; per-tenant config, default off.
- Do not let a detector query run unbounded — every one needs a threshold and a cap.

---

## 9. Exit criteria

- [ ] `mvn clean test` passes under **JDK 17** (see [`BASELINE.md`](./BASELINE.md) §3.3) — 36 existing
      tests still green
- [ ] W1 runs against a real tenant DB and produces tasks — **paste the count and two task titles**
- [ ] **A second run produces zero duplicates** — the dedupe evidence, not an assertion
- [ ] W1's service task auto-completes a task after a manual cost is entered — demonstrated
- [ ] W2 assigns to the correct destination-branch manager, **not** to the whole `manager` role
- [ ] Volume caps enforced; show the count before and after the cap on the noisiest tenant
- [ ] Every task links to a real menu via `formKey`, and the menu is one the recipient's role has
- [ ] `businessKey` conventions documented in `docs/workflows/README.md` and used by both workflows
- [ ] Per-tenant enable flags default to off
- [ ] `DECISIONS.md` updated: record the `businessKey` convention and revise **D29**

## 10. Report

Files created · `mvn clean test` summary · first-run task counts with two sample titles ·
second-run duplicate count · the auto-close demonstration · the assignee resolution for W2 ·
which detectors you capped and at what · confirmation that D29 can now be revised, and what
Product 360 Phase 3 must query to render the `tasks` section.
