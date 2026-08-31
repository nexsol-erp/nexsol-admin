# Rolling Product 360 back

Five steps, in order of how quickly they act and how much they cost. **Step 1 is almost always the
right answer** — it takes seconds, needs no deploy, and is reversible. The others exist for the
rarer case where the code itself is the problem.

Each step below says whether it was **rehearsed** or only reasoned about. That distinction is the
point of this document: a rollback plan nobody has executed is a hypothesis.

---

## Step 1 — Instant off (rehearsed: partially)

Clear the tenant from the server flag. The endpoints then return 404 for that tenant and the
feature is gone; the menu entry may still render, and clicking it lands on a screen that reports
the feature is unavailable rather than a stack trace.

```
product360.tenants=          # remove the tenant, or
product360.enabled=false     # kill it for everyone at once
```

No restart is needed if the flag is served from configuration that refreshes; with a static
property file it needs a restart, so **know which you have before you need to know**.

`product360.enabled=false` overrides the tenant list entirely — a listed tenant does not slip
through it. That is tested (`Product360FeatureFlagTest.offButListed`), because otherwise "turn it
off everywhere" would mean editing a list under time pressure.

**What was rehearsed:** the flag logic, exhaustively, as unit tests over all four
(global × tenant) states. **What was not:** flipping it on a deployed instance and observing a
live 404, because the feature has never been deployed.

---

## Step 2 — Frontend rollback (rehearsed: no)

Redeploy the previous admin build. Nothing else in the app is affected: Product 360 is additive —
a lazily-loaded route, a menu entry that is data-driven from `menuCatalog.js`, and a renderer
package. An older build simply lacks all three.

The menu row in `menu_mst` may outlive the build that used it. That is harmless: `MenuAccessContext`
renders entries by key, and a key with no matching route is not rendered. Leaving the row also means
step 2 does not have to be undone to roll forward again.

**Not rehearsed** — there is no deployed admin build of this feature to roll back from. The
reasoning above is structural, not observed.

---

## Step 3 — Backend rollback (rehearsed: no)

Deploy the previous Spring Boot artefact. The Product 360 endpoints 404 because the controller is
absent. Nothing else changes: the new code is confined to `service/product360`, `service/taskworkflow`,
`service/aiinsight`, a controller, and one security helper, and it adds no schema that other
services read.

Migrations V044–V046 stay applied and are safe to leave: V044 and V045 create tables nothing else
touches, and V046 adds a menu row.

**Not rehearsed** for the same reason as step 2.

---

## Step 4 — Mind-map schema rollback (rehearsed: twice, and it has an ordering rule)

This is the step most likely to hurt, so it was rehearsed against a database holding real
standalone content — a user, a project and two nodes — rather than an empty one. An empty database
proves the DDL reverses; it proves nothing about the data.

```bash
cd /e/mind-map/backend
DATABASE_URL="postgresql+psycopg://..." python -m alembic downgrade -1
```

**Observed, twice:**

| | users | projects | nodes | product360_layouts |
|---|---|---|---|---|
| before | 1 | 1 | 2 | 1 |
| after `downgrade -1` | 1 | 1 | 2 | *(tables dropped)* |
| after `upgrade head` again | 1 | 1 | 2 | 0 |

Standalone data survived every transition. `product360_layouts` and `product360_notes` are dropped
and `users.tenant_id` is removed — that data is genuinely lost, which is correct: those are the
tables the feature owns. Saved layouts are a convenience, not a record; a user loses the positions
they dragged nodes to, and nothing else.

### The ordering rule, which the rehearsal exposed

**Stop the new release before downgrading, and start the old one after.** Downgrading underneath a
running new release does not corrupt anything, but every request fails:

```
$ curl .../api/projects        # new release, downgraded schema
{"detail":"The database is temporarily unavailable. Please retry."}   [503]
```

The new `User` model maps a `tenant_id` column that the downgrade has removed. The failure is at
least clean — a generic 503, no stack trace reaching the client — but it is a full outage of the
standalone product for as long as it lasts.

Done in the right order it is undramatic. The **previous** release, run against the downgraded
schema, was verified serving the rehearsal project with both its nodes:

```
$ curl .../api/projects        # previous release, downgraded schema
[{"name":"Rollback rehearsal","node_count":2, ...}]                   [200]
```

So: `stop new → downgrade → start old`. Not `downgrade → hope`.

---

## Step 5 — Renderer rollback (rehearsed: no)

Repin the previous `@tradelink247/mindmap-renderer` version in both frontends and rebuild.

The admin consumes a packed tarball; the standalone frontend consumes the workspace package.
Rolling the admin back means installing the previous tarball, and **npm caches by name and
version** — so a repin to a version that was previously packed differently reinstalls from cache.
Bump-or-`--force`, exactly as in `LOCAL-DEV.md` §1.

**Not rehearsed.** Only version 0.1.0 has ever existed, so there is no previous version to roll
back to. This step becomes real at the first version bump, and should be rehearsed then rather
than trusted.

---

## What to do first, by symptom

| symptom | step |
|---|---|
| Product 360 is wrong, slow, or showing something it should not | **1** |
| the admin is broken beyond Product 360 | **2** |
| the ERP API is unhealthy | **3** |
| the standalone mind-map is broken | **4**, minding the ordering rule |
| the graph renders wrongly in both frontends | **5** |

Reach for step 1 first in nearly every case. It is the only one with no deploy, no downtime and no
data loss, and it buys the time to work out whether any of the others are actually needed.

---

## Honest summary

**Rehearsed:** step 4, twice, with real data, including the ordering rule and the previous release
running against the rolled-back schema. Step 1's logic, as tests.

**Not rehearsed:** steps 2, 3, and 5, and step 1 against a deployed instance — all for the same
reason: **the feature has never been deployed anywhere**. Their reasoning is structural and I
believe it is sound, but nobody has watched them happen. The first pilot deployment should
rehearse 1, 2 and 3 on the pilot tenant before real users arrive, while rolling back is still
cheap.
