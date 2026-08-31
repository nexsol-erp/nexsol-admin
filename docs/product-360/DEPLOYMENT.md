# Deploying Product 360

The production topology is **nginx on the deploy host** — the SPA served from
`/var/www/html`, the Spring Boot JAR run under systemd, both put there over SSH by the
workflows in `.github/workflows/`. Product 360 adds a third service the same way.

> **A discrepancy worth knowing about.** `aws-infra/*.tf` describes a different setup —
> CloudFront with an S3 origin for the SPA and EC2 origins for the APIs — and
> `aws-infra/DEPLOYMENT-NOTES.md` documents it as *the* architecture. But no workflow
> touches S3 or CloudFront: `deploy.yml` scps the React build to `/var/www/html` and
> reloads nginx. **The Terraform is not what ships.** The `/mindmap-api/*` CloudFront
> behaviour added under `enable_product360` is therefore for an environment that may not
> exist; it is left in place, gated off, but the nginx route below is the real one.
> Someone should reconcile the two — that is a decision about your infrastructure, not
> about this feature.

The single origin is the deploy host's nginx. Everything arrives on one hostname:

```
/                → /var/www/html          (React SPA)
/api/            → 127.0.0.1:8080         (Spring Boot)
/mindmap-api/    → 127.0.0.1:8000         (layout and note API)  ← added
```

Same-origin is what makes the layout call simple: no preflight, no CORS policy to get
wrong, and the `Authorization` header travels without special handling. A second hostname
would mean configuring CORS correctly forever; this removes the class of mistake instead.

The service binds `127.0.0.1`, so it is reachable only through nginx. Binding `0.0.0.0` on
a public-subnet host would put the layout API straight onto the internet with the
delegation token as the only thing in front of it.

Host setup, installed once and not by CI — a deploy that could rewrite its own unit file
could change how the service runs without anyone reviewing it:

- `mind-map/deploy/mindmap-api.service` → `/etc/systemd/system/`
- `mind-map/deploy/nginx-mindmap-api.conf` → included in the existing server block
- `/etc/mindmap/mindmap.env`, root-owned, mode 600, holding the settings in §3

## 1. Build order

Bottom-up, because each step's output is the next step's input:

1. **Renderer package** — `cd /e/mind-map/packages/mindmap-renderer && npm run build && npm pack`.
   The build runs `verify-dist.mjs`, which fails rather than shipping a stale or partial `dist`.
2. **Bump the version** in the package's `package.json`. Not optional — see §5.
3. **Admin** — install the new tarball, then `npm run build`. The CRA build has no `homepage`
   set, so it emits absolute `/static/...` URLs, which is correct for serving from the root.
4. **ERP backend** — `JAVA_HOME=<jdk-17> mvn clean package`. **`clean` is not optional**: a stale
   `target/` produces `BUILD SUCCESS` while running zero tests, and JDK 21 fails Lombok outright
   with `NoSuchFieldError: JCTree$JCImport.qualid`. Read the test count, not the banner.
5. **Mind-map API** — pushed by `.github/workflows/deploy_mindmap.yml`, which installs into a
   venv on the host, runs `alembic upgrade head`, restarts `mindmap-api.service` and then polls
   `/api/health` until it answers. `systemctl restart` succeeds when the unit starts, not when the
   app is serving, so without that poll a service that boots and immediately crashes deploys green.

---

## 2. Migrations, before anything starts

Both databases, and **before** the services that read them:

```bash
# mind-map - additive, and reversible (rehearsed; see ROLLBACK.md §4)
DATABASE_URL="postgresql+psycopg://..." python -m alembic upgrade head

# ERP - per tenant, idempotent, skips tenants already carrying the change
PGPASSWORD=... ./run_migration_v044.sh    # task workflow launch ledger
PGPASSWORD=... ./run_migration_v045.sh    # AI insight tables
PGPASSWORD=... ./run_migration_v046.sh    # the Product 360 menu row
```

V046 creates the menu entry and **deliberately assigns it to no role**. The feature is therefore
invisible to everyone after migrating, which is the intended state: granting access is a separate,
deliberate act (`PILOT.md` §2), not a side effect of deploying.

The runners iterate tenant databases. Exclude `FGS` — it is a half-provisioned shell with 68 tables
against a normal tenant's 124–142, no branches and no items, and it will produce confusing failures.

---

## 3. Configuration

### ERP backend

```properties
product360.enabled=true
product360.tenants=9446968394a               # the pilot tenant, and only it
product360.currencies.9446968394a=INR
product360.delegation.enabled=true
product360.delegation.private-key-path=/run/secrets/product360_private.pem
product360.delegation.ttl-seconds=300
```

Both keys default to off. A build deployed without these properties has the feature switched off,
which is the correct default for a rollout.

### Mind-map API

```properties
AUTH_MODE=delegated
JWT_PUBLIC_KEY_PATH=/run/secrets/product360_public.pem
JWT_AUDIENCE=mindmap-layout-api
JWT_ISSUER=tradelink247
JWT_MAX_AGE_SECONDS=300
CORS_ORIGINS=https://<the exact public origin>
SEED_DEMO_PROJECT=false
```

`CORS_ORIGINS` must never be `*`. The standalone `docker-compose.yml` defaults it to `*` for local
convenience; `docker-compose.integrated.yml` overrides that with a **required** variable, so the
integrated stack refuses to start rather than starting permissively.

`SEED_DEMO_PROJECT=false` because the demo project is a standalone-product nicety that would appear
as a stray project inside a customer's tenant.

---

## 4. Keys

Generate the pair on a trusted machine. The ERP gets the **private** half; the mind-map service
gets the **public** half and can forge nothing.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out product360_private.pem
openssl rsa -pubout -in product360_private.pem -out product360_public.pem
```

- Distribute as **mounted secrets**, by path — never inline in an environment variable, where the
  material surfaces in crash dumps and `docker inspect`.
- Never bake either half into an image; never commit either half.
- Rotation is a five-minute overlap, not a migration, because tokens live 300 seconds. Publish the
  new public key alongside the old, switch the ERP to the new private key, wait one token lifetime
  plus a margin, retire the old. See `DELEGATION-TOKEN.md` §5.

**Before deploying a change to either side of the token, run the interop check.** Unit tests prove
each side self-consistent, which is not the same as proving they interoperate — RS256 padding,
audience-as-array and the `exp`/`iat` window are all places two JWT libraries can differ while each
is internally correct:

```bash
docs/product-360/scripts/verify-delegation-interop.sh
```

---

## 5. The renderer version trap

npm keys a tarball by name **and version**. Re-packing without bumping the version reinstalls the
old contents from cache, producing a build that succeeds while running last week's renderer — the
worst failure mode in this setup, because everything looks fine.

Bump the version, or install with `--force`. Do not rely on remembering.

---

## 6. Terraform

`aws-infra` carries the fourth origin and behaviour, plus the security-group rule opening port 8000
to CloudFront's managed prefix list only. All three are wrapped in `dynamic` blocks gated on:

```hcl
enable_product360 = false   # default
```

With the flag off the rules are **absent**, not merely unused — a port that is not open cannot be
probed — and applying the configuration unchanged leaves the distribution exactly as it is today.

The `/mindmap-api/*` behaviour forwards `Authorization` but **not cookies**, unlike `/api/*`. That
service authenticates from the delegation token alone; forwarding the ERP session cookie would hand
it an ambient credential it must not have.

> **Not applied, and not validated.** Terraform is not installed on the machine these changes were
> written on, so `terraform validate` and `plan` have not been run. Do both before applying, and
> read the plan carefully — it touches a live CloudFront distribution.

---

## 7. Order of operations for the first deployment

1. Migrate both databases.
2. Deploy the mind-map API in `AUTH_MODE=delegated` with the public key.
3. Deploy the ERP backend with `product360.enabled=false` — the code present, the feature off.
4. Deploy the admin build.
5. Add the nginx `location` block and reload; confirm `/mindmap-api/` routes.
6. Run the interop check against the deployed pair.
7. **Only then** enable the tenant flag and grant the menu entry — `PILOT.md`.

Steps 1–6 are reversible and observable with nobody using the feature. Step 7 is the first moment a
real user can reach it, and it is one property and one `INSERT` away from being undone.

---

## 8. Integrated compose (local and staging only)

```bash
cd /e/mind-map
CORS_ORIGINS=http://localhost:8080 \
PRODUCT360_PUBLIC_KEY_FILE=./deploy/product360_public.pem \
docker compose -f docker-compose.yml -f docker-compose.integrated.yml up -d
```

An override rather than an edit, so plain `docker compose up` still brings up the standalone
product unchanged — it is a separate product with its own users, and embedding it in an ERP must
not change how it ships.

The override also **unpublishes** the database, backend and frontend host ports. In the standalone
file Postgres maps 5433 so a developer can `psql` in; that convenience must not reach production.
Everything arrives through the `gateway` service on one port.

> **The ERP services are not in this stack.** Neither `nexsol-admin` nor `nexsol-server-postgress`
> has a Dockerfile — they deploy to S3 and EC2 respectively. The gateway's `tradelink-backend` and
> `tradelink-frontend` upstreams therefore expect containers this compose file does not define, so
> `docker compose up` on the integrated stack brings up the mind-map half and a gateway whose ERP
> routes have nowhere to go. Containerising the ERP is a much larger change than this feature, and
> was deliberately not attempted. The nginx config is nonetheless the accurate statement of the
> routing, and is syntax-checked (`nginx -t`).
