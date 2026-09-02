# Photo-based stock counting — discovery and plan

Planning only. No feature code, migrations, CI or deployed environments were touched.

Everything in **Confirmed** was read from the repositories or the pilot tenant database
(`9446968394a`) on 2026-09-01. Everything in **Assumptions** needs product-owner sign-off.

---

## 1. Executive summary

The feature is feasible, and more of it already exists than the brief assumes. Three
findings change the plan:

**Barcode coverage is 100%.** All 4,646 items in the item master carry a barcode, and the
Flutter app already depends on `mobile_scanner`. The brief's highest-confidence
identification path is available now, with no model, no training data and no inference cost.
That should be the whole of Phase 1.

**The snapshot and discrepancy tables already exist.** `inventory_snapshot` and
`inventory_diff` are in the schema with exactly the right shape and unique constraints. Two
of the brief's proposed entities need mapping, not inventing.

**There is no catalogue image and no storage-location model.** `item_mst` has no image
column, so image-similarity matching cannot start until item images are onboarded — a data
programme, not a sprint. And stock is held per branch, not per zone, so "Sales Shelf /
Freezer / Rack A" has nothing to attach to.

The recommendation is therefore a Phase 1 that ships useful counting **without any computer
vision**, and treats recognition as a measured experiment behind it.

---

## 2. Confirmed repository findings

### Mobile — Flutter, not assumed

`E:\tradeLinkMobileApp\tradelink_app`, `pubspec.yaml`: **Flutter, Dart SDK ^3.5.3**, with
both `android/` and `ios/`.

Already present and directly reusable:

| package | relevance |
|---|---|
| `mobile_scanner: ^5.2.3` | **barcode/QR scanning already in the app** |
| `dio: ^5.7.0` | HTTP client; interceptors suit resumable/retrying upload |
| `connectivity_plus: ^6.0.3` | offline detection already handled |
| `flutter_secure_storage`, `shared_preferences` | token and local state |
| `flutter_riverpod`, `go_router` | state management and routing conventions |

**Not present:** any camera or image package, and no image compression. Photo capture is new
work; barcode scanning is not.

### Backend and database

- Java 17, Spring Boot, multi-tenant with a database per tenant. Confirmed.
- **The database is PostgreSQL, not MariaDB/MySQL.** The brief states MariaDB/MySQL; the
  pilot runs **PostgreSQL 12.22**. This matters beyond pedantry: PG 12 has no
  `gen_random_uuid()` without `pgcrypto`, which has already broken one migration in
  production, and any DDL written for MySQL will not apply.
- React + MUI web frontend. Confirmed.

### Stock: what "system stock" actually means

| table | rows | role |
|---|---|---|
| `item_batch_mst` | **2,244,035** | the real stock ledger — `qty_in`, `qty_out`, `branch_code`, `voucher_date`, `voucher_type`, `batch_code`, `expiry`, `rate` |
| `item_batch_dtl` | **0** | empty; **not** the ledger, despite the name |
| `inventory_snapshot` | 13,301 | `item_id`, `stock_qty`, `inventory_date`, `branch_code`, `company_code`, unique on (company, branch, item, date) |
| `inventory_diff` | — | `snapshot_qty`, `server_qty`, `diff_qty`, unique on (branch, item, date) |
| `physical_stock_mst` | 23,383 | existing manual physical count, carries the V047 `qty < 10000000` guard |
| `opening_stock_mst` | 8,472 | opening balances |

Current stock for a branch/item is derived from `item_batch_mst` as `sum(qty_in) −
sum(qty_out)`. 28 branches, movements from 2000-01-01 to 2026-09-01.

`inventory_snapshot` and `inventory_diff` map directly onto the brief's proposed
`SystemStockSnapshotLine` and `StockDiscrepancyLine`. **Reuse them.**

### Item master

- **4,646 items, all 4,646 with a barcode** — 100% coverage.
- Columns: `id`, `item_name`, `item_code`, `item_id`, `barcode`, `unit_name`, `unit_id`,
  `tax_rate`, `cess_rate`, `hsn_code`, `standard_price`, `purchase_rate`, `version_id`,
  `updated_at`.
- **No image column.** Catalogue-image matching has no source images today.
- 11 distinct unit names.

### Storage location

No table or column anywhere matches `location`, `zone`, `rack`, `shelf`, `godown` or
`warehouse`. `item_batch_mst.store` exists and is populated with exactly two values —
`MAIN` (1,799,897) and `1296124238` (444,138) — the second of which looks like an
identifier rather than a place.

**Stock is held by branch, not by zone.** The brief's location selection has nothing to
attach to and needs either a new model or removal from the MVP.

---

## 3. Assumptions and product-owner questions

Marked so none of these is mistaken for a confirmed fact.

1. **Storage locations.** Assumed out of MVP; count is per branch. Introducing zones means a
   new model *and* a way to apportion existing stock into them, which no current data
   supports.
2. **Snapshot rule.** Recommended: snapshot at session start, recorded as an
   `inventory_snapshot` row for the count date, with movements during the session listed on
   the report rather than silently absorbed. Needs confirmation.
3. **Batches and expiry.** `item_batch_mst` carries `batch_code` and `expiry`. Assumed out of
   MVP — a photo cannot reliably read a batch — but the count line should keep the column so
   it can be added without migration.
4. **Weight-based and loose goods.** Assumed always manual entry, never estimated from a
   photo.
5. **Pack/carton conversion.** Assumed applied only when a unit is explicitly confirmed by
   the user, never inferred.
6. **Adjustment out of scope.** Assumed the count never changes stock. Any adjustment is a
   separate, permissioned, audited action.
7. **Item images.** Assumed absent, so image similarity is Phase 3+, gated on an onboarding
   programme.
8. **Platform.** Assumed Android first — the branches are on ordinary Android devices — with
   iOS following, since the Flutter project already has both.
9. **Photo retention.** Assumed 90 days for originals, longer for crops that become training
   examples, both configurable. Needs a policy decision.
10. **Cross-tenant learning.** Assumed **prohibited by default**. A shared model may only use
    explicitly approved, de-identified examples. This is the same question raised in the COFT
    research issue and should be answered once for both.
11. **Roles.** Assumed a branch user counts, a supervisor reviews, and adjustment needs a
    separate permission. The tenant has both `admin` and `Admin` as distinct roles and the
    match is case-sensitive, so role names must be confirmed rather than assumed.

---

## 4. Recommended MVP and phased roadmap

**Phase 1 — counting that works, with no computer vision.**
Session, branch snapshot, guided capture, **barcode scan** (100% coverage, already in the
app), manual quantity entry, comparison against `item_batch_mst`, discrepancy report,
supervisor review. This is shippable and useful on its own, and it establishes the session,
snapshot, audit and reporting spine that everything else hangs from.

**Phase 2 — OCR and candidate matching.** Read labels and match against item name/code.
Suggest candidates; the user still confirms. Measured against a labelled test set before
anyone relies on it.

**Phase 3 — image similarity**, gated on item-image onboarding actually happening.

**Phase 4 — object detection and visible-count estimation** for selected high-volume
categories only, once Phases 2–3 have produced a baseline worth beating.

**Continuous track** — feedback capture from day one (it costs little and the data is
irreplaceable), tenant catalogue-index updates when policy permits, and gated fine-tuning
with shadow/canary/rollback much later.

The ordering is deliberate: Phase 1 delivers value without a model, and every later phase has
to beat a measured baseline rather than being assumed better.

---

## 5. Risks

**The count is only as good as the ledger.** `physical_stock_mst` already contains
implausible quantities — barcodes scanned into quantity fields — which is why V047 exists.
A discrepancy report comparing against a ledger nobody fully trusts will produce arguments
rather than actions. Worth a data-quality pass on the branches in the pilot first.

**No storage locations means large sessions.** Counting a whole branch in one session is a
long, interruptible activity on a phone. Session resume and partial submission matter more
than they would with zones.

**Vision will disappoint if oversold.** It cannot count what it cannot see. Every estimate
must be presented as a suggestion requiring confirmation, and the reports should show the
correction rate prominently so the feature's real accuracy is visible rather than assumed.
