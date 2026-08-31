# Running Product 360 locally

Four services across three repositories, plus a package that is built rather than imported. This
is the order that works and the reasons each step exists.

| | repo | port | needed for |
|---|---|---|---|
| Admin (CRA) | `e:\nexsol-admin` | 3000 | everything |
| ERP backend (Spring Boot) | `c:\Users\Dell\nexsol-server-postgress` | 8084 | the graph |
| Mind-map API (FastAPI) | `e:\mind-map\backend` | 8000 | saved layouts and notes |
| miniflow (BPMN) | `e:\workflow` | 8085 | task generation only |

Only the first two are needed to see a graph. The mind-map API adds layout persistence; without
it the admin keeps layouts in component state, so an arrangement survives interaction but not a
reload. That is a visible limitation rather than a silent one, and it is a perfectly workable way
to develop the UI.

---

## 1. The renderer package

`@tradelink247/mindmap-renderer` lives in `e:\mind-map\packages\mindmap-renderer` and is consumed
by both frontends. **The admin consumes it as a packed tarball, not a `file:` link**, and that is
deliberate.

A `file:` dependency resolves to a directory that has its own `node_modules`, so React gets
loaded twice — once by the app and once by the package. Two React copies share no hook dispatcher,
so every hook in the rendered subtree throws `Invalid hook call`. Vite can be told to
`resolve.dedupe` its way out of this; **CRA 5 cannot**, because the admin does not eject and there
is no supported config override. Packing the tarball with `files: ["dist"]` sidesteps it: the
tarball contains no `node_modules`, so there is only ever one React.

After changing renderer source:

```bash
cd /e/mind-map/packages/mindmap-renderer
npm run build          # runs verify-dist.mjs, which fails the build if dist is stale or partial
npm pack --pack-destination /e/nexsol-admin/vendor

cd /e/nexsol-admin
npm install ./vendor/tradelink247-mindmap-renderer-0.1.0.tgz
```

The last step is not optional and not cached-away: npm keys the tarball by name and version, so
**re-packing without bumping the version reinstalls the old contents from cache**. Either bump the
version in the package's `package.json`, or `npm install` with `--force`. Forgetting this produces
the worst failure mode in this whole setup — a build that succeeds while running last week's
renderer.

---

## 2. Databases

Two, and they are unrelated:

- **ERP Postgres** on 5432 — one database per tenant. The pilot tenant is `9446968394a`.
- **Mind-map Postgres** on 5433 — a single database holding layouts and notes only.

```bash
docker compose -f /e/mind-map/docker-compose.yml up -d db      # 5433
```

Migrations must run before the API starts, in both:

```bash
# mind-map
cd /e/mind-map/backend
DATABASE_URL="postgresql+psycopg://mindmap:mindmap@localhost:5433/mindmap" \
  python -m alembic upgrade head

# ERP - each runner is idempotent and skips tenants that already have the change
cd /c/Users/Dell/nexsol-server-postgress/src/main/resources/migrations
PGPASSWORD=root123 ./run_migration_v044.sh   # task workflow launch ledger
PGPASSWORD=root123 ./run_migration_v045.sh   # AI insight tables
PGPASSWORD=root123 ./run_migration_v046.sh   # the Product 360 menu entry
```

### Cost and profit will be UNAVAILABLE locally

Local tenants were never migrated past V031, so `sales_dtl_cost` and `item_cost_price_history` do
not exist. The cost and profit sections therefore report `UNAVAILABLE` with a reason rather than
zero. **This is the designed degradation path working, not a bug** — and it is worth seeing at
least once, because it is what a tenant mid-migration will see in production.

To exercise the populated path you need a tenant with V032–V043 applied.

---

## 3. Starting the services

### ERP backend

`application.properties` is empty in this repo — configuration comes in as runtime arguments. The
Product 360 flag is deliberately **not** committed, so it must be passed explicitly:

```bash
cd /c/Users/Dell/nexsol-server-postgress
JAVA_HOME="/c/Program Files/Java/jdk-17" mvn spring-boot:run \
  -Dspring-boot.run.arguments="\
--server.port=8084 \
--product360.enabled=true \
--product360.tenants=9446968394a \
--product360.currencies.9446968394a=INR"
```

**JDK 17, not 21.** Lombok's annotation processor fails on 21 with
`NoSuchFieldError: JCTree$JCImport.qualid`. Worse, a stale `target/` masks it: Maven reports
`BUILD SUCCESS` while running zero tests. If a build looks suspiciously clean, `mvn clean` first
and read the test count, not the banner.

### Mind-map API

Standalone mode — no tokens, no tenancy, exactly as the standalone product ships:

```bash
cd /e/mind-map/backend
DATABASE_URL="postgresql+psycopg://mindmap:mindmap@localhost:5433/mindmap" \
  python -m uvicorn app.main:app --port 8000
```

Delegated mode — identity from an ERP-minted token, which is how it runs inside TradeLink247:

```bash
AUTH_MODE=delegated \
JWT_PUBLIC_KEY_PATH=/path/to/product360_public.pem \
JWT_AUDIENCE=mindmap-layout-api JWT_ISSUER=tradelink247 JWT_MAX_AGE_SECONDS=300 \
CORS_ORIGINS="http://localhost:3000" \
DATABASE_URL="postgresql+psycopg://mindmap:mindmap@localhost:5433/mindmap" \
  python -m uvicorn app.main:app --port 8000
```

Delegated mode needs the ERP configured to mint, with the matching **private** key:

```
--product360.delegation.enabled=true
--product360.delegation.private-key-path=/path/to/product360_private.pem
```

Generate a throwaway pair for local work — never reuse a deployed one:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out product360_private.pem
openssl rsa -pubout -in product360_private.pem -out product360_public.pem
```

### Admin

```bash
cd /e/nexsol-admin && npm start
```

---

## 4. Making the menu entry visible

Two independent keys gate the feature and **both default to off**. The server flag above is one;
the menu entry is the other, and V046 creates it while deliberately assigning it to no role. So
after migrating, the item exists and nobody can see it.

Grant it locally:

```sql
-- role_menu_mst.role_id holds the role NAME, not a foreign key. This surprises everyone once.
INSERT INTO role_menu_mst (id, role_id, menu_id)
SELECT gen_random_uuid(), r.role_id, m.id
FROM (VALUES ('admin'), ('user'), ('system-admin')) AS r(role_id)
CROSS JOIN menu_mst m
WHERE m.menu_name = 'Product 360'
  AND NOT EXISTS (SELECT 1 FROM role_menu_mst x WHERE x.role_id = r.role_id AND x.menu_id = m.id);
```

If the menu item appears but clicking it bounces you to the home page, the route guard is
refusing what the sidebar allowed. See §6.

---

## 5. Checking it works

```bash
# the graph
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:8084/api/9446968394a/product-360/ITEM001" | head -c 400

# a layout round-trip, delegated mode
TOKEN=$(curl -s -X POST -H "Authorization: Bearer $ERP_TOKEN" \
  http://localhost:8084/api/9446968394a/product-360/delegation-token | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/product-360/layouts/ITEM001
```

Before any change to either side of the token, run the interop check — two JWT libraries agreeing
is the only thing that proves the contract holds across the wire:

```bash
docs/product-360/scripts/verify-delegation-interop.sh
```

---

## 6. Things that will waste an afternoon

**A system admin sees every menu but is denied by the route guard.** `MenuAccessContext` has an
`if (isSystemAdmin) return true` short-circuit; `RequireWorkflowMenuAccess` does not. So a
system-admin account renders the sidebar entry and then bounces off the route. This is a
pre-existing inconsistency that also affects `/my-tasks` and `/bpmn-editorr`, and it is
**not fixed** — fixing it changes access control for existing screens, which is a decision to
take deliberately rather than as a side effect of this work.

**Role-menu data lives in the tenant database, not `nexsoldb`.** `role_menu_mst` in `nexsoldb` has
zero rows, which reads convincingly as "no restrictions configured". It is not: the tenant
database has 161 assignments across 77 menus. Querying the wrong database here leads to exactly
the wrong conclusion.

**`FGS` is not a real tenant.** 68 tables against a normal tenant's 124–142, no branches, no items.
It is a half-provisioned franchise shell — `FGS` is also a branch code, "HOT CAKES BAKERY &
SUPERMARKET" — and any script that iterates tenant databases should exclude it or it will report
confusing failures.

**`npx eslint src` lints 30 files out of 224.** ESLint defaults to `.js` only. The real baseline is
`npx eslint src --ext .js,.jsx`, which is 142 warnings.

**Two React copies.** See §1. The symptom is `Invalid hook call` from inside the renderer; the
cause is almost always a `file:` link or a stale tarball.
