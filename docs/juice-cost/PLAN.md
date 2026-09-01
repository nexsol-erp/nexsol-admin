# Daily Juice Sales and Cost Insight Report — plan

A per-branch, per-day view of what juice was sold, what it should have cost in raw
materials, what it actually consumed, and where the difference went.

Everything below was checked against the pilot tenant (`9446968394a`) rather than assumed.
The schema supports most of this today. Two things do not exist at all, and one is thinner
than the report needs — those are stated first, because they decide whether this is a
build or a data exercise.

---

## What blocks it

These are not implementation details. Each one changes what the report can honestly say.

### B1 — Only 2 of 12 juice items have a recipe

`production_def` holds 169 recipes with 2,017 raw-material lines, all branch-scoped. But of
the juice and shake items actually selling:

| item | branches | qty sold | revenue | has BOM |
|---|---|---|---|---|
| FRESH LIME JUICE | 14 | 117,299 | ₹2,345,980 | **yes** |
| SHARJA SHAKE | 12 | 108,519 | ₹7,185,820 | **yes** |
| PARCEL JUICE UP 300 ML | 12 | 31,721 | ₹158,605 | no |
| PINEAPPLE JUICE | 12 | 29,140 | ₹2,185,500 | no |
| WATERMELON JUICE | 12 | 26,400 | ₹1,188,000 | no |
| ORANGE JUICE | 12 | 9,635 | ₹722,615 | no |
| MOOSAMBI JUICE | 12 | 7,854 | ₹510,510 | no |
| TENDER COCONUT SHAKE | 12 | 5,741 | ₹545,395 | no |

Expected consumption is `BOM × quantity sold`. With no BOM there is no expected
consumption, so no material cost, no cost per juice, no margin and no yield variance —
the report has nothing to say about ten of these twelve items.

**This is a data-entry task for Ops, not engineering**, and it is the single thing that
decides whether the report is useful. Building the engine first would produce a screen that
is blank for 85% of the items on it.

### B2 — Wastage is not captured anywhere

No table and no column in the tenant schema matches `wast`, `scrap`, `spoil` or `damage`.

The brief asks for daily consumption to account for wastage. It cannot: there is no source.
What the report *can* compute is the residual:

```
unexplained = (opening + transfers in + local purchases − closing) − expected consumption
```

That residual contains wastage, over-pouring, theft, miscounts and recipe error, mixed
together. Reporting it as "wastage" would name one cause out of five. It should be labelled
**unexplained material difference** until wastage is actually recorded.

Deciding whether to add wastage entry is a product decision worth taking before this is
built, because it changes the report from "something is wrong here" to "this much was
thrown away".

### B3 — Juice production is never recorded

`production_execution_hdr` holds 1,769 runs across 5 branches (2026-05-13 to 2026-08-20)
and **not one is a juice or a shake**. Juices are made to order at the counter; the bakery
production module is used for something else.

So actual raw-material consumption for juice is never captured. The report is inherently a
reconciliation of *expected* consumption against *stock movement*, not actual against
expected. That is the right design given the data — but it means every variance figure
carries the stock count's accuracy, and `physical_stock_mst` is already known to hold
implausible quantities (see BACKLOG D2).

### B4 — Standard cost is empty

`production_def.rate` is 0 on 168 of 169 recipes. There is no standard cost to fall back on,
so material cost must be derived from movement — which is what the brief asks for anyway.
Weighted-average costing across the two sources is therefore mandatory, not an enhancement.

---

## What the data supports today

| need | source | notes |
|---|---|---|
| Quantity sold, revenue | `sales_dtl` + `sales_trans_hdr` | `item_name`, `qty`, `amount` on the line; branch and date on the header |
| Recipe / BOM | `production_def` → `production_raw_material_def` | `parent_id` links them; recipes are per branch |
| Stock transferred in, with rate | `stock_trans_out_hdr/dtl` → `stock_trans_in_hdr` | `ref_out_hdr_id` links receipt to dispatch; rate is on the outbound line |
| Local purchases, with rate | purchase header/detail | note BACKLOG D6: `purchase_rate` is pre-tax while sales are tax-inclusive |
| Opening / closing stock | `item_batch_mst/dtl`, `opening_stock_mst`, `physical_stock_mst` | see B3 on accuracy |

---

## Costing

Weighted average across the two sources, per raw material per branch per day:

```
material cost =  (transferred qty × transfer rate) + (purchased qty × purchase rate)
                 ─────────────────────────────────────────────────────────────────
                              transferred qty + purchased qty
```

Two decisions this needs before it is written:

- **Tax basis.** Purchase rates are pre-tax and sales are tax-inclusive (BACKLOG D6).
  Mixing them understates cost and overstates margin. Gross up the purchase side, or state
  both figures pre-tax.
- **When neither source has a rate.** Falling back to zero silently reports 100% margin.
  The row should be marked as un-costed instead — the same reasoning as W1's task rather
  than a quiet default.

---

## Phasing

**Phase 1 — make it possible (Ops).** Enter the missing juice recipes. Ten items, and the
report is worthless without them. Nothing engineering does changes this.

**Phase 2 — the daily reconciliation.** One query per branch/date/juice producing quantity
sold, revenue, expected consumption, material cost, cost per juice, gross profit and margin.
No variance yet — get the cost right first and check it against a branch that knows its own
numbers.

**Phase 3 — yield and variance.** Add opening/transfers/purchases/closing, expected output
from available materials, actual sales output, and the unexplained difference. This is the
part that depends on stock accuracy, so it lands after the costing is trusted.

**Phase 4 — the screen.** Branch-wise and consolidated summaries, filters by date, branch
and item.

**Phase 5 — insights.** Abnormal cost, low margin, excess consumption and poor yield fit
the existing AI Branch Manager rules rather than a new mechanism: a rule computes the
condition and attaches evidence, and the policy decides whether it becomes work. Reuse it —
`InsightRule` is the interface, and thresholds belong in configuration, not in the query.

---

## What I would not do

**Do not build Phase 2 before Phase 1.** A cost report covering FRESH LIME JUICE and SHARJA
SHAKE while showing blanks for PINEAPPLE, WATERMELON, ORANGE and MOOSAMBI will be read once
and distrusted afterwards. The recipes are the feature.

**Do not label the residual "wastage".** It is the sum of at least five causes. Naming it
after one invites a conversation about staff carelessness when the real answer may be a
recipe that was never right.
