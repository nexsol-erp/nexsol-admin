# Backlog

Everything open across Product 360, Vendor 360 and the detection programme, in one place.
Previously scattered across `DECISIONS.md`, five plan documents and a lot of conversation.

Each item says **who decides**, because most of what is stuck here is stuck on a decision
rather than on effort.

---

## 1. Data correctness — the pilot tenant is telling us things

| # | Item | Who decides | Notes |
|---|---|---|---|
| D1 | **Validate quantity at the point of entry** | Engineering | V047 puts a CHECK constraint in the database, which stops bad data but reports a raw violation. A check in the entry screen could say *"that looks like a barcode"* and put the cursor back in the right field. The constraint is the floor, not the whole answer. |
| D2 | **Seven rows need a physical count** | Ops | Two EAN-13 scans at `CGN`, `SHAWARMA` at 100,000,000 (KDRR), `KADI SNACKS` at 10,000,000 (KDRH), three in `physical_stock_mst`. True quantities are not recoverable — for the barcode rows we know only that 1,031 and 2,536 have since gone out. Once counted, `VALIDATE CONSTRAINT` to close V047 properly. |
| D3 | **Finish the goods-receipt rollout** | Owner | 52 GRNs against 395 purchases since 2026-06-25 — **14% adoption**. `ACCOUNTS` has raised none at all, which is why 332 purchases still land there. This is a bigger lever than any detector: it stops the balance accruing at source. |
| D4 | **The ₹17m at `ACCOUNTS`** | Owner + Finance | Accumulated under the old purchase mode, where stock notionally lands at the accounting branch. Not a warehouse, so not dead stock — but every stock figure derived from `ACCOUNTS` is wrong until it is restated. A one-off decision, deliberately not a nightly task. |
| D5 | **Supplier Aging shows nothing** | Owner | `AgingAnalysisService` reads `payment_allocation`, which has **0 rows**, and no ledger account carries a `supplier_id`. Either payments are recorded somewhere else, or the payables module is unused. This also decides whether Vendor 360 can ever answer "what do we owe them". |
| D6 | **V043 grosses up nothing for tax** | Finance | Now confirmed with arithmetic, not suspicion: where `purchase_rate` exists, `amount = qty × purchase_rate × (1 + tax_rate/100)` on **every** row. So `purchase_rate` is pre-tax while sales are tax-inclusive, and comparing them understates cost. |
| D7 | **The franchise stock round-trip does not close** | Owner + Engineering | `FranchiseStockReceiptConsumer` listens for a franchise confirming receipt and updates `franchise_stock_transfer.status`. That table has **0 rows** on the pilot tenant: transfers to `PTHR`, `PTPURAM` and `MLSR` are written to `stock_trans_out_hdr` like any other branch, and nothing populates the franchise table. So the consumer updates rows that do not exist. Consequence: a franchise acceptance never sets `is_processed` on the outbound header, so the parent still shows the transfer as outstanding and its W2 task never closes — the acceptance is invisible to the side that sent the stock. Decide whether that Kafka path is meant to be live; until then W2 resolution works for company branches only. |

---

## 2. Infrastructure — mostly small, one genuinely risky

| # | Item | Who decides | Notes |
|---|---|---|---|
| I1 | **`aws-infra` is not a git repository** | Platform | **Shelved by the owner on 2026-08-31 — do not raise again until they ask.** For the record: it defines the VPC, RDS, CloudFront and security groups, has no history and no backup, and the Product 360 edits are the only copy on disk. |
| I2 | **Terraform and CI describe different production** | Platform | `aws-infra/*.tf` says S3 + CloudFront; `deploy.yml` scps the build to `/var/www/html` and reloads nginx, and never touches S3. One of them is not what runs. `DEPLOYMENT.md` now documents nginx as the real topology (D111) with the discrepancy recorded (D112). |
| I3 | **Both `main` branches are dead** | Repo owner | 506 commits behind. Both deploy workflows trigger on push to `main`, so **as written they would never fire**. Raised three times, still unanswered. |
| I4 | **`deploy_server.yml` builds with `-DskipTests`** | Engineering | 273 passing tests do not gate a deploy. The new `deploy_mindmap.yml` deliberately does run them. **No longer hypothetical:** on 2026-09-01 a change to `SalesDeclineRule` left 9 tests failing with an NPE on `main`, and the deploy went green and shipped it. Found only by running the suite by hand. |
| I5 | **`p360_verify` does not self-heal** | Engineering | An interrupted test run leaves `ai_insight` and `task_workflow_launch` rows behind, and two unrelated tests then fail confusingly. Cost real time once already. |

---

## 3. Access control — raised, unanswered

| # | Item | Who decides | Notes |
|---|---|---|---|
| A1 | **`TenantFilter` trusts `X-Tenant-ID`** | Security | It selects the datasource from a header without checking it against the caller's JWT. Product 360 asserts locally (`TenantAssertion`) so its own routes are safe; every other endpoint is not. Fixing it platform-wide touches every controller, which is why it needs a deliberate decision rather than a drive-by change. |
| A2 | **System admins see menus they cannot open** | Frontend owner | `MenuAccessContext` short-circuits on `isSystemAdmin`; `RequireWorkflowMenuAccess` does not. The sidebar renders the entry and the route guard bounces them. Affects `/my-tasks` and `/bpmn-editorr` too, so it predates this work. |
| A3 | **`accounts` / `purchase` / `support` roles do not exist** | Ops | The AI branch manager document assigns tasks to them. Either create them or map onto `admin`/`manager`/`user`. |
| A4 | **`FGS` is a half-provisioned tenant database** | Platform | 68 tables against a normal tenant's 124–142, no branches, no items, 10 MB. Every migration runner excludes it by name. Either drop it or find out why provisioning left it half-built. Note `FGS` is *also* a live branch code — the branch is real and busy, the database is not. |

---

## 4. Feature work — ready to build

| # | Item | State |
|---|---|---|
| F1 | ~~Detection Phase C~~ | **Done.** `InsightSweepScheduler` runs at 02:45, `InsightController` serves list/detail/dismiss, `InsightsPage` displays them. |
| F2 | Detection Phase B — insight rules | **Partly done.** `SalesDeclineRule` and `PurchaseRateJumpRule` built. `MarginDeclineRule` is **blocked**: it needs `sales_dtl_cost`, which no local tenant has because V032–V043 were never applied here. Writing it blind against a table nobody can query is how the 51,272 and 4,795 false-positive predicates got written. |
| F3 | ~~Detection Phase D~~ | **Done.** `AnthropicAiProvider` exists, off unless three switches are on, with injection and failure tests. No API call has ever been made. |
| F4 | **Wire Product 360 layouts to the UI** | Phase 5 and 6 built the layout service and delegation token; the admin still holds layout in `useState`, so a dragged layout does not survive a reload. |
| F5 | **Vendor 360** | Plan written (`docs/vendor-360/`). Four phases. Blocked on D5 for scope. |
| F6 | **W3, W4, W6, W9, W11** | Validated as plausible; each needs its own predicate check before building. |

**Not building, and why:**

- **W5 near-expiry** — `item_batch_mst.expiry` is populated on **0 of 1,705,361 rows**. The plan called it the highest-value workflow; it is impossible until expiry dates are captured.
- **W10 expense over budget** — `budget_header` and `budget_line` both have **0 rows**.

---

## 5. What I would do next

**Read the 77 open tasks before building anything else.**

Insights and task workflows are both live on the pilot tenant now. The sweep produces 68
insights (14 CRITICAL), and all five detectors launch: W1 12, W2 44, W12 14, W13 7, capped
per branch and deduplicated through the ledger. Getting there exposed a run of defects that
every test had passed - the assignee resolver never resolved anybody, the engine never
interpolated task names so 110 tasks read literally `${title}`, and a `BPMNEdge`-less diagram
made someone redraw connectors that already existed and broke W2 outright. Each was found by
running it and looking.

So the question is no longer whether the machinery works. It is whether the work it creates
is worth someone's morning. 44 of the 77 are W2 "confirm receipt of transfer", and three of
those belong to franchise branches that cannot act on them here (D7). If the answer is
"these are not our priority", the fix is thresholds and exclusions, not more detectors.

**Two things are unfinished rather than undecided:** `task-workflow.cron` is still on a
5-minute test schedule and should return to `0 15 2 * * *`, and detectors do not yet exclude
franchise branches the way the insight rules now do.

**I1 is shelved** at the owner's request and is not on the critical path.
