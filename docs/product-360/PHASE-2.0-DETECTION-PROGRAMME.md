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
never distributed.* Checked against tenant `9446968394a`, and it is worse than described.

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

**₹17 million sitting in one branch, on items that have not moved in over three months, with
every one of them priceable.** That is the single largest actionable number this programme has
found.

### The caveat that decides the design

`ACCOUNTS` and `ADMIN` are almost certainly **not physical locations**. A branch named
"ACCOUNTS" receiving 88% of purchases looks like purchases being booked against an accounting
branch rather than a stocking one. If so, the stock never physically sat there, and the
"dead stock" is a **booking misconfiguration**, not a warehouse full of goods.

**Both readings are problems, and they need different tasks:**

- *Real stock* → distribute it, mark it down, or write it off.
- *Misbooked* → fix where purchases are posted, then every stock figure derived from
  `ACCOUNTS` is wrong and needs restating.

The detector cannot tell these apart from data alone, and **must not guess.** It reports the
condition and names both readings; a human decides which. Getting this wrong in either
direction is expensive — chasing a warehouse that does not exist, or ignoring ₹17m that does.

> **First task for the owner, before any code:** is `ACCOUNTS` a physical location? One
> answer removes half this design.

### A second finding, separate and also real

`CGN` has `SUM(qty_in) = 17,802,554,921,434` — 17.8 **trillion** units — with a median row of
`0.00` and a single row at 8.9 trillion. That is not stock; it is a barcode or identifier
written into a quantity column. Any valuation touching `CGN` is currently meaningless. This is
a `DATA_QUALITY` insight in its own right, and it should be raised **before** anyone trusts a
dead-stock number for that branch.

---

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
| **W13** | Purchases booked to a non-stocking branch → owner *(only if `ACCOUNTS` is not physical)* |
| **Rule** | `DeadStockRule` → `INVENTORY_RISK`, materiality = qty × derived rate |
| **Gate** | Ranked list matches the SQL in §2 within rounding; every row priced or excluded, never assumed zero |

Also ship `DataQualityRule` for the `CGN` magnitude problem — cheap, and it protects every
number above it.

**Depends on the owner answering the `ACCOUNTS` question.** If physical: W12 alone. If not:
W13 leads and W12 applies only to real branches.

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
| 1 | `ACCOUNTS` dead stock is a booking artefact, and W12 sends people to look for goods that do not exist | Answer the question in §2 **before** Phase A. Report the condition, never the diagnosis |
| 2 | `CGN`'s corrupt quantities poison any valuation | `DataQualityRule` first; exclude implausible magnitudes from money figures rather than publishing them |
| 3 | Too many tasks at once — nine new detectors could raise thousands | Phase A alone is 299 items at `ACCOUNTS`. **Cap tasks per sweep per branch**, rank by materiality, and let the rest wait |
| 4 | A detector fires on a predicate nobody validated | Every detector ships with the real-data count it produces, in its commit message. W2's 51,272 false positives are the standing reminder |
| 5 | AI spend grows unnoticed | Budget enforced in Phase D; `ai_usage_log` reviewed before widening |
| 6 | Cost-dependent rules degrade on tenants below V043 | Report `UNAVAILABLE` with a reason, exactly as Product 360's cost section does |

---

## 6. What to do first

1. **Ask whether `ACCOUNTS` is a physical branch.** It decides Phase A's shape and costs nothing.
2. **Ship `DataQualityRule` for `CGN`.** Small, and it protects every figure that follows.
3. **Then Phase A.** ₹17m of untouched stock, every item priced, is the strongest case this
   programme has for existing at all.

Phases B–E follow the pilot's evidence rather than this document's ordering. The point of
Phase A is to find out whether anyone acts on a task when they get one — and if they do not,
building nine more detectors is the wrong response.
