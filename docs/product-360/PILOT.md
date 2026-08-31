# Piloting Product 360

One tenant, one week, and a switch that takes seconds to flip back.

---

## 1. Who decides

| | |
|---|---|
| **Turning it on** | the product owner, with the pilot tenant's agreement |
| **Turning it off** | *anyone*, without asking |

That asymmetry is deliberate. If turning the feature off needs a meeting, it will stay on through
the weekend when it should not have. The off switch is one property (§5), and nobody should ever
feel they need permission to use it.

---

## 2. Turning it on

Three independent gates, all defaulting to off. All three must be opened, and each can be closed
on its own.

**1. Infrastructure** — `enable_product360 = true` in Terraform, which publishes the
`/mindmap-api/*` behaviour and opens port 8000 to CloudFront only. Apply and confirm the route
answers before going further.

**2. The server flag** — authoritative, and the one that gates the *data*:

```properties
product360.enabled=true
product360.tenants=9446968394a
product360.currencies.9446968394a=INR
```

**3. The menu entry** — gates *visibility* only. V046 created the row and assigned it to nobody:

```sql
INSERT INTO role_menu_mst (id, role_id, menu_id)
SELECT gen_random_uuid(), r.role_id, m.id
FROM (VALUES ('admin')) AS r(role_id)          -- start with one role, not three
CROSS JOIN menu_mst m
WHERE m.menu_name = 'Product 360'
  AND NOT EXISTS (SELECT 1 FROM role_menu_mst x WHERE x.role_id = r.role_id AND x.menu_id = m.id);
```

`role_menu_mst.role_id` holds the role **name**, not a foreign key. This surprises everyone once.

Start with `admin` alone. Widening to more roles later is an `INSERT`; narrowing after people have
started relying on it is a conversation.

### Why two gates and not one

A menu entry alone would let anyone who guesses the URL fetch the data. A server flag alone would
show a menu item to people whose tenant cannot use it. They answer different questions, and the
server one holds on its own — which is what makes it safe for the menu to be the thing you adjust
freely.

---

## 3. What to check on day one

- The graph renders for a product with sales, and for one without.
- A product with no cost history shows cost and profit as **unavailable with a reason** — not zero,
  and not a stack trace. Confirm the wording reads as an explanation rather than an error.
- Drag a node, reload, and confirm the layout comes back. If it does not, the delegation token is
  the first thing to check.
- Click through to a linked report and confirm it lands on the right branch and period.
- Confirm the four branch-scope cases: one branch, several, all, and a user restricted to one.

---

## 4. What to watch for the first week

| signal | where | why it matters |
|---|---|---|
| **p95 graph latency** | `[Product360]` audit lines, `ms=` | the graph fans out across sales, stock and cost; one slow tenant is a warning about all of them |
| **`UNAVAILABLE` section rate** | `sections=` in the same line | a step change means a data problem upstream, not a UI one |
| **4xx on `/mindmap-api/`** | CloudFront metrics | a rise means tokens are failing — expiry, clock skew, or a key mismatch |
| **401 vs 403 split** | mind-map logs | 401 is a token problem; 403 is a tenant mismatch, which is more serious |
| **node count per graph** | `nodes=` | a graph that grows unboundedly for a large catalogue will be slow before it is wrong |

Each ERP graph request emits one structured line — tenant, user, product, branch count, node count,
section statuses, duration. That is enough to answer "why was this slow" or "why was profit
missing" without reproducing it.

**Logs contain no token, no note body, and no customer or supplier name.** If any appears, treat it
as a defect worth fixing before the pilot widens — a note body is a user's private text, and log
aggregation puts it somewhere it was never meant to go.

### Ask the pilot user two questions

Not "does it work" — they will say yes.

1. *What did you look up, and did you find it faster than before?*
2. *Was anything on the screen wrong, or did you have to check it elsewhere?*

The second question is the one that matters. A number a user feels obliged to verify elsewhere is
worse than no number, because it costs them time and yields nothing.

---

## 5. Turning it off in under a minute

```properties
product360.enabled=false
```

One property, and it overrides the tenant list entirely — a listed tenant does not slip through.
That is tested, precisely so that "off everywhere" never means editing a list under pressure.

The menu entry may still render; clicking it lands on a screen reporting the feature is
unavailable, not a stack trace. To remove it too:

```sql
DELETE FROM role_menu_mst
WHERE menu_id = (SELECT id FROM menu_mst WHERE menu_name = 'Product 360');
```

Nothing else needs undoing. No data is lost by turning it off — saved layouts stay in the mind-map
database and come back if it is turned on again. Deeper rollback steps are in `ROLLBACK.md`, but
they are almost never the right first move.

---

## 6. Current state

**The feature is off everywhere.**

- No committed configuration sets `product360.enabled` — it defaults to `false`.
- V046 assigns the menu entry to no role.
- `enable_product360` defaults to `false` in Terraform, so the origin, behaviour and firewall rule
  are absent rather than merely unused.
- It has never been deployed to any environment.

The one exception is **local development**, where the menu is granted to `admin`, `user` and
`system-admin` in the `9446968394a` tenant database and the server flag is passed as a runtime
argument. Neither is committed, so neither travels.

---

## 7. Verifying the token gate on a deployed instance

Worth running once after enabling, because it is cheap and it is the part with real consequences
if it is wrong. Against a service holding a layout saved by a known user:

```bash
BASE="https://<origin>/mindmap-api/product-360/layouts/ITEM001"

curl -s -o /dev/null -w '%{http_code}\n' "$BASE"                                  # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $ERP_SESSION" "$BASE"  # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $EXPIRED" "$BASE"      # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $OTHER_TENANT" "$BASE" # expect 200, EMPTY
```

The fourth is a **200 and that is correct** — a token for another tenant is a legitimate caller
from another company, not a forgery. What matters is that the body is empty: ownership is
`(tenant, user)` taken from the token, so that caller gets its own absent layout and none of
anyone else's. Confirm the body, not just the status.

The second is refused because the algorithm allow-list is `RS256,EdDSA` — **not** because the
service checked the ERP's shared secret. It does not hold that secret and never should. Which means
the allow-list is load-bearing: `jwt_algorithms` must never grow an HMAC entry.

Full results from the local run are in `DELEGATION-TOKEN.md` §6.

---

## 8. Widening beyond the pilot

Not before:

- a week with no `UNAVAILABLE` spike and no 4xx rise on `/mindmap-api/`
- p95 latency understood, and acceptable on the pilot tenant's *largest* product
- the pilot user answering question 2 above with "no"
- rollback steps 1–3 rehearsed on a real deployment (`ROLLBACK.md` records that they have not been)

Then widen by **role first, tenant second**. More roles in one tenant is a smaller step than a
second tenant, and it is the step that finds the access-control surprises — including the
system-admin route-guard inconsistency noted in `LOCAL-DEV.md` §6, which will bite whoever grants
this to a system-admin account first.
