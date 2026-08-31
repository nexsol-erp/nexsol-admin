# Phase 6 — Deployment, Hardening and Pilot

> Prompt file **6 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phases 2–5. This is the last gate before a real tenant sees the feature.

---

## 1. Role and operating rules

You are wiring four services into one deployment and arming a feature that must be **off for every
tenant** when you finish. The measure of this phase is not that Product 360 works — it is that
turning it off, and rolling it back, works.

1. Preserve uncommitted work; no unrelated refactoring.
2. Never commit a secret, a key, or a `.dump` file.
3. No completion claims without a cold start you actually performed.
4. If you cannot rehearse rollback, say so plainly rather than asserting it works.

---

## 2. Context

**Services:**

| Service | Source | Notes |
|---|---|---|
| `tradelink-backend` | `c:\Users\Dell\nexsol-server-postgress` | Spring Boot 3.1.1, PostgreSQL per tenant |
| `tradelink-frontend` | `e:\nexsol-admin` | CRA static build |
| `mindmap-api` | `e:\mind-map\backend` | FastAPI, `AUTH_MODE=delegated` here |
| `mindmap-postgres` | — | Postgres 16, **layouts and notes only** |
| `mindmap-standalone-web` | `e:\mind-map\frontend` | Must keep working independently |

**Existing deployment artefacts to reconcile — Phase 0 Q7 established which is authoritative:**
`Nginix-Config.txt` (server repo), `e:\aws-infra` (Terraform: `ec2.tf`, `rds.tf`, `cloudfront.tf`,
`security_groups.tf`), `e:\mind-map\docker-compose.yml`, `e:\mind-map\frontend\nginx.conf`.

**Reuse the mind-map's own Nginx pattern — it is already correct.** `frontend/nginx.conf` proxies
`/api/` to `backend:8000` same-origin (so the browser needs no CORS), re-resolves DNS per request
through a variable `proxy_pass` with a `resolver.inc` written at container start, sets
`Cache-Control: no-store` on `index.html` and `immutable` on hashed assets, and fails over quickly
instead of hanging on the 60 s default connect timeout. Do not invent a worse one.

---

## 3. Tasks

### 3.1 Single origin

Route everything through one public origin so cross-origin — and therefore CORS — does not exist:

```
/                 → tradelink-frontend   (SPA fallback to index.html)
/api/             → tradelink-backend
/mindmap-api/     → mindmap-api          (strip the prefix upstream)
/mindmap/         → mindmap-standalone-web
```

Verify against how the admin is actually served (CRA `homepage` / `basename`) before assuming a
sub-path works — a CRA app served from `/mindmap/` needs its `homepage` set, and getting this
wrong produces a blank page with 200s in the network tab.

If a second origin is genuinely unavoidable, set `cors_origins` to the exact origin. `*` must not
appear in any deployed configuration (D18) — check `docker-compose.yml`'s
`CORS_ORIGINS: ${CORS_ORIGINS:-*}` default too, not just the setting.

### 3.2 Compose and health

- Extend `e:\mind-map\docker-compose.yml` for the ERP-integrated stack **without breaking the
  standalone one**. Prefer an override file (`docker-compose.integrated.yml`) so
  `docker compose up` in `e:\mind-map` still brings up the standalone product unchanged.
- Health checks for every service; `depends_on: condition: service_healthy` — the Postgres
  healthcheck pattern is already there, follow it.
- `mindmap-postgres` is **not** published to a host port in the integrated stack. Today it maps
  `${POSTGRES_PORT:-5433}:5432` for local development; that must not reach production.
- The public key for delegation-token verification arrives by environment/secret mount — never
  baked into an image, never committed.

### 3.3 Delegation token, end to end

`DELEGATION-TOKEN.md` from Phase 5 specified the contract; this phase makes it real:

- Spring Boot mints the RS256/EdDSA token (≤ 5 min, `aud: "mindmap-layout-api"`) and hands it to
  the admin **per request or per short session** — never stored in `localStorage`, never in a URL.
- FastAPI runs `AUTH_MODE=delegated` with the public key only.
- Key rotation: two keys valid simultaneously via `kid`, documented with the rotation procedure.
- **Verify by trying to break it:** call `/mindmap-api/` with (a) no token, (b) the ERP session
  token, (c) an expired token, (d) a token for another tenant. All four must fail closed. Report
  the four status codes.

### 3.4 Feature flags (D26)

Two independent keys, both required, both defaulting to off:

1. **Server-side tenant flag** — authoritative, gates the data. Default off for every tenant.
2. **Menu entry** — `"Product 360"` in `src/menuCatalog.js`, assigned per role through the
   existing role-menu screens. Gates visibility only.

Prove all four combinations behave: flag off + menu off (invisible), flag off + menu on (visible
but cleanly unavailable, no stack trace), flag on + menu off (invisible), flag on + menu on
(works).

### 3.5 Observability (D23)

- Structured audit event per graph request and per navigation: tenant, user, productId,
  branchScope size, period, nodeCount, durationMs, sectionStatuses, cacheHit.
- Latency, node-count and cache-hit metrics exposed where the existing monitoring can see them —
  Kafka and the admin's `EventMonitor` page already exist; prefer them to a new channel.
- **Log redaction:** no token, no note body, no customer or supplier name in logs.
- Alert-worthy signals named in the docs: p95 latency, `UNAVAILABLE` section rate, 4xx rate on
  `/mindmap-api/`.

### 3.6 Documentation

In `docs/product-360/`:

- `LOCAL-DEV.md` — running all four services across two repositories, including the renderer
  package `file:` link and what to re-run after changing it.
- `DEPLOYMENT.md` — build order, the renderer package version bump, env vars, key distribution,
  migration order (Alembic before the API starts).
- `ROLLBACK.md` — see 3.7.
- `PILOT.md` — enabling one tenant, what to watch for the first week, how to turn it off in under
  a minute, and who decides.
- Update `DECISIONS.md` with anything that changed.

### 3.7 Rollback — rehearse it, do not describe it

Write and then **actually perform** each step on a scratch environment:

1. **Instant off:** clear the tenant flag → the feature disappears; no restart, no deploy.
2. **Frontend rollback:** redeploy the previous admin build; confirm the rest of the app is
   unaffected (the menu entry is data-driven from `menuCatalog.js`, so an old build simply lacks
   it).
3. **Backend rollback:** previous Spring Boot artefact; Product 360 endpoints 404; nothing else
   changes.
4. **Mind-map rollback:** `alembic downgrade -1` — verify the standalone product still starts and
   its existing projects still open. This is the step most likely to hurt; rehearse it twice.
5. **Renderer rollback:** repin the previous package version in both frontends; confirm the
   standalone app builds.

State plainly which steps you rehearsed and which you could only reason about.

---

## 4. Do not

- Do not publish `mindmap-postgres` to a host port in the integrated stack.
- Do not leave `CORS_ORIGINS` defaulting to `*`.
- Do not bake a key or secret into an image or commit one.
- Do not enable the feature for any tenant.
- Do not hard-code service hostnames in frontend source.
- Do not change the standalone `docker-compose.yml` in a way that alters standalone startup.

---

## 5. Exit criteria

- [ ] Full integrated stack starts from cold; every health check green — paste `docker compose ps`
- [ ] **Standalone mind-map still starts independently** and a project opens and saves
- [ ] Single origin verified: `/`, `/api/`, `/mindmap-api/`, `/mindmap/` all serve correctly
- [ ] `*` appears in no deployed CORS configuration
- [ ] `mindmap-postgres` unreachable from outside the compose network — say how you checked
- [ ] Four token-abuse attempts fail closed, with status codes reported
- [ ] All four flag combinations behave; **feature off for every tenant at the end**
- [ ] Audit events observed for a real graph request and a real navigation
- [ ] Logs contain no token, note body or customer name
- [ ] Rollback steps 1–5 rehearsed, with the unrehearsed ones named
- [ ] Five docs written

## 6. Report

Files changed per repo · `docker compose ps` output · the four token-abuse status codes · the flag
matrix result · what you rehearsed for rollback and what you did not · confirmation the feature is
off everywhere · the remaining risks you would want watched during the pilot.
