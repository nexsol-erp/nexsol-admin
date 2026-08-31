# Detection programme — workflows and the AI branch manager

One plan, because they are one system. A **detector** finds a condition in the data. A
**workflow** turns it into a task somebody owns. The **AI branch manager** explains a set of
conditions in words an owner can act on. Building them separately produced what exists today:
solid plumbing, two detectors, one rule, and no scheduled sweep.

---

## 1. Where things actually stand

| | Planned | Built |
|---|---|---|
| Workflows | 11 (W1–W11) | **2** — W1 unresolved cost, W2 transfer not received |
| Insight rules | 7 types | **1** — `CostCoverageRule` |
| AI provider | `AnthropicAiProvider` + mock | **mock only** — nothing has ever called an API |
| Insight API | endpoints + UI | **none** — insights are written, never served |
| Insight sweep schedule | nightly | **none** — `InsightSweep` runs only when called |

The infrastructure is real and tested: the launch ledger with its partial unique index, the
`businessKey` convention, evidence-or-no-insight, materiality computed rather than
model-supplied, token budgeting, `FallbackInsightWriter`. **The hard decisions are encoded.
The volume is not.** That is what this programme adds.

---

## 2. The new one: stock that arrives and never leaves

Raised by the owner: *items are purchased into a central godown and stay there as dead stock,
never distributed.* Checked against tenant `9446968394a`. The raw numbers look alarming; the
branch classification then reframes them, so read to the end of this section before acting on
any figure in it.

### What the data shows

Purchases do not land where you would expect:

| branch | purchase headers | share |
|---|---|---|
| `ACCOUNTS` | 8,164 | **88%** |
| `CGN` | 1,072 | 12% |
| everything else | 8 | 0% |

And almost nothing leaves `ACCOUNTS`:

```
ACCOUNTS   qty_in = 2,879,317      qty_out = 17
```

Seventeen units out, against 2.9 million in. Per item:

| branch | items received and never moved out | oldest untouched |
|---|---|---|
| `ACCOUNTS` | **518 of 525 (98.7%)** | 2025-07-30 |
| `BAKERY` | 141 of 162 | 2026-07-09 |
| `FGS` | 87 of 837 | 2025-05-29 |
| `ADMIN` | 76 of 97 | 2025-12-18 |

Priced at the derived purchase rate (`amount / qty`, the tax-inclusive figure established in
the supply section), restricted to items untouched for over 90 days:

| branch | dead items | value | priced |
|---|---|---|---|
| `ACCOUNTS` | 299 | **₹16,994,589** | 299 of 299 |
| `FGS` | 51 | ₹298,480 | 41 of 51 |
| `PZHA` | 32 | ₹263,068 | 26 of 32 |

₹17 million in one branch, untouched for over three months, every item priceable. Taken at
face value that is the largest number this programme has found — which is precisely why it
needs the next section before anyone acts on it.

### `branch_type` already exists, and it answers the question

The owner proposed adding a branch type to mark non-physical branches. **It is already in
`branch_mst`, already populated, and it settles this:**

| `branch_type` | branches | meaning |
|---|---|---|
| `BAKERY_BO` | `ACCOUNTS` | **back office** — not a stocking location |
| `BAKERY_CGN` | `CGN` | **central godown** |
| `BAKERY_OUTLET` | 24 | retail outlets |
| *(null)* | `ALL-BRANCH`, `WEB-9446968394a` | virtual |

`is_control_branch = 'Y'` marks `ADMIN`, and nothing else.

So no migration is needed. The detectors read a column the tenant already maintains.

### What that means — and a correction

Grouping the dead stock by that existing type changes the conclusion:

| `branch_type` | branch | dead items | value |
|---|---|---|---|
| `BAKERY_BO` | `ACCOUNTS` | 299 | ₹16,994,589 |
| `BAKERY_OUTLET` | `FGS` | 51 | ₹298,480 |
| `BAKERY_OUTLET` | `PZHA` | 32 | ₹263,068 |
| `BAKERY_OUTLET` | `PTPURAM` | 23 | ₹20,083 |
| *(five more outlets)* | | ~75 | ~₹38,000 |

**The ₹17m is at a back office.** `ACCOUNTS` is typed `BAKERY_BO` by the tenant itself, so it
is not a warehouse and that stock is almost certainly a **posting artefact**, not goods on a
shelf. An earlier draft of this plan called that figure "the strongest case this programme
has". That was wrong, and the tenant's own configuration says so.

**And the central godown is healthy.** `CGN` — the one branch actually typed as a godown —
does not appear in the dead-stock list at all: 2,996 of its 3,548 item-rows have moved out,
and it raised 2,604 transfer-outs. The originally reported concern, *items purchased into a
central godown that are never distributed*, **is not happening at `CGN` in this tenant.**

Real dead stock at genuine outlets totals roughly **₹600,000** across eight branches. Still
worth a task. Not ₹17m.

This is exactly why the detector must not diagnose: the same query, read without
`branch_type`, would have sent someone hunting a warehouse that does not exist.

### What the detectors do with it

- **`BAKERY_BO`, control and null-typed branches** → never raise dead stock. Stock accumulating
  where nothing is stocked is a **posting** finding (W13), routed to whoever owns purchase
  configuration, and it says so.
- **`BAKERY_CGN`** → dead stock means *bought and never distributed*. Owner-level. This is the
  condition originally described; it is simply not firing today.
- **`BAKERY_OUTLET`** → dead stock means *bought or transferred in and never sold*. Branch
  manager, escalating on age and value.

One more gap worth recording: `branch_type` is not perfectly maintained. `CANTEEN`,
`SAVOURIES`, `SWEETS` and `PHANDB` are typed `BAKERY_OUTLET` but have zero purchases, zero
sales and zero transfers. They are dormant, and a detector that treats them as trading outlets
will raise tasks nobody owns. Either they need a `DORMANT` type, or detectors must require
recent activity before raising anything. **The second is cheaper and needs no data cleanup** —
prefer it.

### A separate defect, still standing

`CGN` has `SUM(qty_in) = 17,802,554,921,434` — 17.8 **trillion** units — with a median row of
`0.00` and a single row at 8.9 trillion. That is an identifier written into a quantity column.
It did not affect the dead-stock finding above, which counts item-rows rather than magnitudes,
but any **valuation** touching `CGN` is meaningless until it is fixed. `DataQualityRule` should
raise it before anyone trusts a money figure for that branch.

## 3. Principles carried forward

Non-negotiable, and all of them were paid for once already:

- **A detector with no evidence rows emits nothing.** An assertion about someone's branch that
  cannot show its working is worse than silence.
- **Materiality in money, computed by us.** Never model-supplied. A task without a number
  attached cannot be prioritised.
- **Validate the predicate against real data before writing the detector.** W2's first version
  joined on `ref_out_hdr_id`, populated on 4,780 of 45,259 rows, and produced 51,272 false
  positives. The correct predicate found 8.
- **Dedupe on `businessKey` with the partial unique index.** A condition that recurs after
  being closed raises a new task; one still open does not nag.
- **Branch code alone in every label.** Names are identical across branches.
- **Off by default**, per tenant and per process.

---

## 4. Phases

Ordered by value per unit of risk, not by workflow number.

### Phase A — Dead stock, and the questions it raises

The headline finding, and the reason this plan exists.

| | |
|---|---|
| **W12** | Stock received and never distributed → branch manager, escalating to owner |
| **W13** | Purchases booked to a non-stocking branch (`BAKERY_BO`, control, null type) → owner |
| **Rule** | `DeadStockRule` → `INVENTORY_RISK`, materiality = qty × derived rate |
| **Gate** | Ranked list matches the SQL in §2 within rounding; every row priced or excluded, never assumed zero |

Also ship `DataQualityRule` for the `CGN` magnitude problem — cheap, and it protects every
number above it.

**No longer blocked.** `branch_type` answers it: `ACCOUNTS` is `BAKERY_BO`, so W13 leads for
that branch and W12 applies to `BAKERY_CGN` and `BAKERY_OUTLET` only.

### Phase B — The rules that already have data

Six insight types are declared and unimplemented. Three have data behind them today:

| Rule | Type | Source | Notes |
|---|---|---|---|
| `MarginDeclineRule` | `MARGIN_DECLINE` | `BranchProfitReportService` | needs V032–V043 applied; degrades honestly where not |
| `SalesDeclineRule` | `SALES_DECLINE` | `SalesSummaryService` | period over period |
| `PurchaseRateJumpRule` | *(new)* `COST_INCREASE` | derived `amount / qty` | **see below** |

`DISCOUNT_ANOMALY`, `EXPENSE_ANOMALY` and `TRANSFER_OPPORTUNITY` stay declared and
unimplemented until someone confirms the data supports them. Better a named gap than a rule
that fires on noise.

**W8 is now nearly free.** It was planned as "new `purchase_rate` vs previous, > X%", but
`purchase_rate` is populated on **5.4%** of purchase lines — as written it would have fired on
almost nothing. The `amount / qty` derivation built for the supply section is the working
version of that comparison, and it is tax-inclusive, so it is comparable with sales.

### Phase C — Make insights reachable

Everything in Phase B writes to tables nobody reads.

- `GET /api/{tenant}/insights` — filter by branch, type, severity, period; branch-scoped
- `GET /api/{tenant}/insights/{id}` — with evidence rows and linked tasks
- `POST /api/{tenant}/insights/{id}/dismiss` — with a recorded reason
- **Schedule `InsightSweep`.** It exists and never runs. Follow `TaskWorkflowScheduler`'s
  02:15 cron; stagger to avoid contending with it.
- Admin screen, or a section on an existing dashboard

**Gate:** an insight raised by the nightly sweep is visible to a branch manager the next
morning without anyone running anything by hand.

### Phase D — The real AI provider

Only now, because until Phase C nothing displays what it would produce.

- `AnthropicAiProvider` against the current Claude model, key from the environment
- Prompt-injection tests with hostile item names — **product names are untrusted data, never
  instructions**, and this codebase already has items named by suppliers
- Prove a provider outage touches nothing: POS, sales, inventory and workflow unaffected,
  insights fall back to `FallbackInsightWriter`
- Per-tenant daily token budget enforced, with `ai_usage_log` showing spend before anyone
  widens it

**Gate:** unplug the provider mid-sweep. Insights still appear, worded by the fallback. No
other subsystem notices.

### Phase E — The remaining workflows

W3–W7, W9–W11, in whatever order the pilot's evidence justifies. Each is a detector class plus
a BPMN file; the infrastructure does not change. **Do not build these speculatively** — a
detector nobody acts on is noise that trains people to ignore the ones that matter.

Pick from the pilot's answer to: *which of these did you actually want to be told about?*

---

## 5. Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | Dead stock at a back office sends people hunting goods that do not exist | **Resolved by `branch_type`.** `BAKERY_BO` routes to W13, never W12. Report the condition, never the diagnosis |
| 1b | Dormant branches typed as outlets raise tasks nobody owns | Require recent activity before raising, rather than waiting for `branch_type` cleanup |
| 2 | `CGN`'s corrupt quantities poison any valuation | `DataQualityRule` first; exclude implausible magnitudes from money figures rather than publishing them |
| 3 | Too many tasks at once — nine new detectors could raise thousands | Phase A alone is 299 items at `ACCOUNTS`. **Cap tasks per sweep per branch**, rank by materiality, and let the rest wait |
| 4 | A detector fires on a predicate nobody validated | Every detector ships with the real-data count it produces, in its commit message. W2's 51,272 false positives are the standing reminder |
| 5 | AI spend grows unnoticed | Budget enforced in Phase D; `ai_usage_log` reviewed before widening |
| 6 | Cost-dependent rules degrade on tenants below V043 | Report `UNAVAILABLE` with a reason, exactly as Product 360's cost section does |

---

## 6. What to do first

1. **Ship `DataQualityRule` for `CGN`.** Small, and it protects every money figure that
   follows.
2. **Then Phase A**, reading `branch_type` — W13 for the ₹17m posting question at `ACCOUNTS`,
   W12 for roughly ₹600,000 of genuine dead stock across eight outlets.
3. **Decide whether the `ACCOUNTS` posting is intended.** If purchases are meant to be booked
   to a back office and issued to outlets later, the design is fine and W13 should be tuned to
   the backlog rather than the practice. If not, every stock figure derived from `ACCOUNTS` is
   wrong and needs restating — which is a bigger job than this programme.

Phases B–E follow the pilot's evidence rather than this document's ordering. The point of
Phase A is to find out whether anyone acts on a task when they get one — and if they do not,
building nine more detectors is the wrong response.
