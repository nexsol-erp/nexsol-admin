# Vendor 360 — plan

A supplier-rooted view of the graph: *what is this supplier costing us, across everything
they sell us?* The inverse of Product 360, which answers *who supplies this product?*

Written after checking what tenant `9446968394a` can actually support. Several assumptions
that looked reasonable turned out to be wrong, and they are called out below rather than
discovered in Phase 3.

---

## 1. What the data supports, and what it does not

Measured, not assumed. Counts are from the pilot tenant.

| Question a user would ask | Supportable? | Evidence |
|---|---|---|
| What do we buy from them, and how much? | **Yes** | 9,244 purchase headers, 30,399 lines, 149 active suppliers |
| Are they getting more expensive? | **Yes** | derived rate per item over time; the mechanism already works in the supply section |
| Which branches buy from them? | **Yes** | `purchase_hdr.branch_code` populated |
| How often, and when last? | **Yes** | `voucher_date` populated |
| Which items depend on them alone? | **Yes** | **1,242 of 1,552 items have exactly one supplier** |
| **What do we owe them?** | **No** | `payment_allocation` = **0 rows**; all 30 ledger accounts have `supplier_id` NULL; one lump "Accounts Payable" control account |
| **Do they deliver on time / in full?** | **No** | `grn_hdr` = 52 rows against 9,244 purchases — **0.6% coverage**, and no expected-date field anywhere |
| **Are there quality problems?** | **No** | `purchase_correction_request` = **1 row** |
| What are their payment terms / lead time? | **No** | `supplier_mst` has six columns: name, address, GST, state, phone. Nothing else exists |

### What this means for scope

**Vendor 360 here is a purchasing view, not supplier-relationship management.** The money-owed
and reliability dimensions have no data behind them in this tenant. That is not a reason to
skip the feature — the purchasing half is substantial and nobody currently sees it in one
place — but it *is* a reason not to design around dimensions that will render empty.

Those sections should be **declared `UNAVAILABLE` with a reason**, exactly as `production` is
in Product 360, so they explain themselves and light up automatically if the data starts
being captured. They must not be silently omitted.

> **Worth telling the pilot user explicitly:** the existing *Supplier Aging* screen reads
> `payment_allocation`, which is empty, so that screen shows nothing today. If they expect
> Vendor 360 to tell them what they owe, they will be disappointed by a data gap that
> predates this feature. Better said upfront than discovered in the pilot.

---

## 2. The finding worth building around

Spend is **not** concentrated. The largest supplier is 9.0% of spend; the top six together are
33%. So "you depend too much on one supplier" is not this business's problem, and a headline
metric built on it would be a solution looking for one.

The real exposure is one level down: **80% of items (1,242 of 1,552) are bought from exactly
one supplier.** A supplier who is only 3% of spend can still be the sole source of forty
lines. That is invisible in every existing screen, it is genuinely actionable, and it falls
straight out of data already present.

**Recommendation: make single-sourced items the headline of the vendor node**, not spend rank.
Spend answers "who is big". Single-sourcing answers "who would hurt".

---

## 3. The pivotal design decision

**Is Vendor 360 a second endpoint, or is Product 360 generalised into an entity-rooted graph?**

This has to be settled before Phase 1, because it decides the shape of everything after.

**Option A — a parallel `/api/{tenant}/vendor-360/{vendorId}`.**
Its own assembler, its own sections, its own schema file. Ships faster, no risk to a working
feature. Costs: two graph assemblers to keep in step, and the schema, node-id grammar and
navigation registry get copied rather than shared — so they drift.

**Option B — generalise to a root entity (`PRODUCT` | `VENDOR`).**
One assembler, one schema with a `rootType`, sections that declare which roots they serve.
Costs more up front and touches code that currently works. Pays back the moment a third view
is wanted — Branch 360 and Customer 360 are the obvious candidates.

**Recommendation: A, with B's seams.** Build the vendor endpoint separately, but reuse
`NodeIdFactory`, `MetricFactory`, `SectionStatus`, `BranchScopeResolver` and
`NavigationTargetRegistry` unchanged rather than forking them, and keep the JSON Schema a
sibling that shares definitions. That gets the feature out without a risky refactor, and
leaves generalisation as a later move rather than a rewrite. Revisit at a third view, not
before.

---

## 4. What comes for free

Already built and directly reusable:

- **Renderer** — `@tradelink247/mindmap-renderer` draws any graph; it does not know what a
  product is.
- **Layout store** — `product360_layouts.view_type` exists precisely so a second view can
  share the table. `VENDOR_360` is a new value, not a new table, and the composite key
  already includes it.
- **Delegation token** — unchanged. It carries tenant and subject, nothing view-specific.
- **Degradation vocabulary** — `SectionStatus`, `ReasonCode`, the freshness rules, and the
  "never claim `now()`" discipline.
- **Branch scoping** — `BranchScopeResolver` works from `branch_code`, which `purchase_hdr`
  has.
- **The rate derivation** — the hard-won `amount / qty`, tax-inclusive logic from the supply
  section is exactly what the vendor view needs, pivoted.

What is genuinely new: vendor-rooted node ids, a vendor search endpoint, the item-mix and
single-sourcing sections, and a menu entry plus migration.

---

## 5. Phases

Deliberately fewer than Product 360's seven. Most of the infrastructure that justified those
phases now exists.

| # | Phase | Deliverable | Gate |
|---|---|---|---|
| **0** | Contract | `vendor-360.v1.schema.json`, node-id grammar, fixtures (full / degraded / empty) | Schema validates all three fixtures |
| **1** | Backend | `Vendor360Service`, sections: profile, spend, item mix, single-sourcing, price trend, branches | Integration tests on real schema; degraded sections prove themselves |
| **2** | Admin UI | Vendor search, graph page, node drawer, navigation to existing purchase screens | Contract test; renders in both themes |
| **3** | Menu + rollout | `menuCatalog.js` entry, `V047__vendor360_menu.sql` (no role grants), flag, docs | Feature off everywhere; migration idempotent |

Phase 1 is the bulk. Phases 2 and 3 are largely shaped by Product 360's equivalents.

### Sections, and their honest status on today's data

| Section | Status | Source |
|---|---|---|
| `profile` | OK | `supplier_mst` — thin, but real |
| `spend` | OK | `purchase_hdr` + `purchase_dtl`, tax-inclusive |
| `items` | OK | item mix, ranked by spend, capped and grouped |
| `sourcing` | OK | single-sourced item count — **the headline** |
| `priceTrend` | OK | derived rate per item over period vs baseline |
| `branches` | OK | `branch_code` fan-out |
| `payables` | **UNAVAILABLE** | `NO_DATA_IN_PERIOD` — no per-supplier ledger |
| `reliability` | **UNAVAILABLE** | `NOT_CONFIGURED` — GRN at 0.6% coverage |

---

## 6. Risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| 1 | The default 30-day period shows an empty graph — purchases are infrequent | **High.** It already happened in Product 360's supply section | Default the vendor view to **12 months**, not 30 days. Do not inherit the sales-shaped default |
| 2 | A vendor supplying 400 items explodes the graph | High | Cap and group, as `MAX_BRANCH_NODES` does; rank by spend |
| 3 | Users expect payables and find none | High | Say so in `PILOT.md` before the pilot, not during |
| 4 | `supplier_name` drift splits or mislabels a vendor | Certain — 338 rows already | Group by `supplier_id`, display from master. Already solved in the supply section |
| 5 | Tax treatment diverges from Product 360 | Medium | Reuse the same derivation; it is tax-inclusive on both sides |
| 6 | 228 suppliers in the master were never used | Certain | Vendor search must rank by activity, or most results are dead records |

Risk 1 is the one that has already bitten once. It should be a Phase 0 decision, not a Phase 2
discovery.

---

## 7. Open questions for the owner

1. **Option A or B** in §3. Recommendation is A; the decision is architectural and yours.
2. **Is `payment_allocation` empty because payments are recorded elsewhere, or because the
   payables module is unused?** This decides whether `payables` is a permanent
   `UNAVAILABLE` or a section worth wiring later.
3. **Should GRN capture be fixed?** At 0.6% coverage it is effectively unused. If receipts
   were recorded, delivery reliability becomes answerable — which is the single biggest gap
   in this plan.
4. **Same menu group as Product 360, or under Purchase?** Product 360 sits at top level; the
   vendor view arguably belongs beside the other supplier screens.

---

## 8. Estimate

Phase 0 and 3 are small. Phase 1 is the work; Phase 2 is mostly adaptation.

The largest uncertainty is not the code — it is question 2 above. If payables turn out to be
recoverable from somewhere, Vendor 360 becomes materially more valuable and the plan needs a
section it does not currently have.
