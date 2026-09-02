# ADR-001 — Photo-based stock counting

**Status:** proposed, awaiting owner sign-off
**Date:** 2026-09-01
**Backlog:** epic #57, this record #58

Decisions only. The evidence behind them is in `DISCOVERY.md`; this file exists so nobody
re-derives them or quietly reverses one.

---

## 1. Barcode first. Computer vision is Phase 2 at the earliest.

**Decision.** Phase 1 ships stock counting with no recognition of any kind: session,
snapshot, guided capture, barcode scan, manual quantity, comparison, report, review.

**Why.** All 4,646 items in the item master carry a barcode — 100% coverage — and the Flutter
app already depends on `mobile_scanner ^5.2.3`, with a working barcode path in the shipped
`expiry_scanner` feature. The highest-confidence identification method is therefore available
now, with no model, no training data, no inference cost and no latency.

**What would justify revisiting.** A measured benchmark (#67) showing a recognition method
beats manual barcode entry on time-to-count for a realistic shelf, at an accuracy a reviewer
would accept without checking every line. Set that threshold before running the benchmark,
not after.

**Consequence.** Every later phase must beat a baseline that already works, rather than being
assumed better than nothing.

---

## 2. `item_batch_mst` is the source of system stock.

**Decision.** Current stock for a branch and item is `sum(qty_in) − sum(qty_out)` over
`item_batch_mst`.

**Why.** It holds 2,244,035 rows across 28 branches with movements to the current date. It is
the ledger.

**Explicitly not `item_batch_dtl`.** That table is **empty** despite its name, and reaching
for it because the name looks right would produce a comparison against nothing.

---

## 3. Reuse `inventory_snapshot` and `inventory_diff`.

**Decision.** The frozen stock position is written to `inventory_snapshot`; discrepancies are
written to `inventory_diff`. Neither is re-invented under a new name.

**Why.** Both already exist with the right shape. `inventory_snapshot` is unique on
(company, branch, item, date) and `inventory_diff` already carries `snapshot_qty`,
`server_qty` and `diff_qty` — which is exactly the proposed `SystemStockSnapshotLine` and
`StockDiscrepancyLine`.

**Consequence.** Two fewer tables, and the reconciliation those tables were designed for
becomes reachable rather than hypothetical.

---

## 4. PostgreSQL, not MariaDB/MySQL.

**Decision.** All DDL targets PostgreSQL 12.

**Why.** The brief states MariaDB/MySQL. Production is **PostgreSQL 12.22**. This is not
pedantry: MySQL DDL will not apply, and PG 12 has no `gen_random_uuid()` without `pgcrypto`,
which is installed **per database** and has already broken a migration in production this
month. Build ids from `md5()`/`random()` as V050–V054 do.

---

## 5. The mobile app is Flutter, and the camera is new work.

**Decision.** Build in the existing Flutter app, following its `go_router` and
`flutter_riverpod` conventions.

**Why.** `E:\tradeLinkMobileApp\tradelink_app`, Dart ^3.5.3, Android and iOS, eight features
already shipped. `dio`, `connectivity_plus`, `flutter_secure_storage` and `mobile_scanner` are
all present.

**What is missing.** No camera package and no image compression. Photo capture is new; barcode
scanning is not.

**Related.** `physical_stock` already exists as a feature in that app. The count work should
**extend that screen**, not add a second counting flow — resolve before either progresses.

---

## 6. Recognition runs asynchronously, behind a provider-neutral interface.

**Decision.** A mobile request never waits on inference. It receives a job id; results are
fetched or pushed later. The recognition provider sits behind an interface so a different
model or vendor can replace it without touching the ERP.

**Why.** Inference latency is unbounded on a branch network, and coupling the ERP to one
vendor is how a pricing change becomes a rewrite.

**Consequence.** Counting must continue when recognition is unavailable. That is a
requirement, not a degradation.

---

## 7. A count never changes stock.

**Decision.** Submitting or approving a count writes discrepancy rows and nothing else. Any
stock adjustment is a separate, permissioned, idempotent, audited action.

**Why.** The count is an estimate with a human in the loop and a photo that cannot see behind
the front row. Automatically adjusting stock from it would make the ledger worse, and the
ledger is already the thing everything else is measured against.

---

## 8. Storage locations are out of scope.

**Decision.** A count is per branch. No zone, shelf or rack selection in the MVP.

**Why.** Nothing in the schema matches location, zone, rack, shelf, godown or warehouse.
`item_batch_mst.store` holds exactly two values — `MAIN` and `1296124238` — the second of
which looks like an identifier rather than a place. There is nothing to attach a zone to, and
inventing one means also deciding how existing stock is apportioned into it, which no current
data supports.

**Consequence.** Sessions cover a whole branch, so they are long and interruptible. Session
resume and partial submission matter more than they otherwise would.

---

## 9. Feedback is captured from day one; nothing is trained from it yet.

**Decision.** Every confirmation and correction is recorded — original candidates, selection,
model version, actor — from the first release that has recognition. No model weights change as
a result, and no cross-tenant pooling occurs.

**Why.** The data is irreplaceable and cannot be recovered retrospectively. Capturing it costs
little; not capturing it costs a year. Training on it is a separate, gated decision.

**Constraint.** A mobile user is told feedback was captured. They are never told a correction
retrained anything, because it did not.

---

## 10. Cross-tenant learning is prohibited by default.

**Decision.** Tenant-derived examples, embeddings and indexes stay within the tenant that
produced them unless an explicit, documented policy says otherwise.

**Why.** Tenants are separated by database precisely because this data is commercially
sensitive. Pooling moves information between competitors in a way nothing currently governs,
and consent cannot be retrofitted onto a trained model.

**Open.** This is the same question as backlog #45. It should be answered once, for both.

---

## Open questions blocking nothing yet

- Snapshot at session start or at submission (#59 assumes start).
- Retention for original photos and for crops that become training examples.
- Which costing rule values a discrepancy.
- Which roles may count, review and approve.
- Whether a Mac and an Apple Developer account exist, for the iOS half of any mobile work.
