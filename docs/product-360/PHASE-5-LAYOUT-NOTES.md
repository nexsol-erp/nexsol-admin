# Phase 5 — Personal Layout and Notes (FastAPI + PostgreSQL)

> Prompt file **5 of 6**. Paste this entire file into Claude Code as one message.
> Requires Phase 1 (contract). Independent of Phase 3 — can run alongside Phase 4.

---

## 1. Role and operating rules

This phase is **not** an extension of an existing auth model. The mind-map backend has no
authentication and no tenancy at all. You are adding both, to a product that must keep working
exactly as it does today when deployed standalone.

1. Preserve uncommitted work; branch `feat/product-360-renderer` (or a sibling) in `e:\mind-map`.
2. No unrelated refactoring — follow the existing layering, do not improve it.
3. No completion claims without `pytest` output.
4. **Standalone behaviour is the regression suite.** The existing 9 test files must pass unchanged.

---

## 2. Context — what actually exists

**Repo:** `e:\mind-map\backend` · FastAPI 0.115 · SQLAlchemy 2.0 (typed `Mapped[]`) ·
Alembic 1.14 (one revision: `0001_initial_schema.py`, applied on container start) ·
Pydantic v2 + `pydantic-settings` · `psycopg` 3 · Postgres 16.

Layering to follow exactly: `api/routes/*.py` → `services/*.py` → `repositories/*.py` →
`models/*.py`, with `schemas/*.py` for Pydantic. Routes are thin, use
`APIRouter(prefix=…, tags=[…])` and the `DbSession` / `CurrentUser` / `OwnedProject` annotated
dependencies from `app/api/deps.py`.

ORM base (`app/database/base.py`) provides `Base`, `UUIDPrimaryKeyMixin` (UUID PK, `uuid4`
default) and `TimestampMixin` (`created_at`/`updated_at`, server defaults). Use them.

**The security reality you are changing:**

```python
# app/api/deps.py  (current)
def get_current_user(db, settings) -> User:
    """Authentication is not part of this release; the application runs
    single-tenant against a default user that is created on first use."""
    return UserRepository(db).get_or_create(name=..., email=settings.default_user_email)
```

`users` has `name` + `email` only — **no tenant column**. `settings.cors_origins` defaults to
`"*"`, and `docker-compose.yml` passes `CORS_ORIGINS: ${CORS_ORIGINS:-*}`.

**On the ERP side:** the session JWT is **HS256 with a shared secret** (`security/JwtService`).
Handing that token or that secret to a second service would let the second service mint ERP
sessions. That is why D16 exists.

---

## 3. Tasks

### 3.1 Two auth modes (D17)

Add `auth_mode: Literal["none", "delegated"] = "none"` to `app/config/settings.py`.

- `none` — **exactly today's behaviour**, the standalone default. `get_current_user` keeps
  get-or-creating the demo user; tenant is a constant sentinel.
- `delegated` — ERP mode. `get_current_user` verifies a bearer token and derives identity from it.

`get_current_user` is the single function that branches. Nothing else in the codebase should know
which mode is active.

### 3.2 Delegation token verification (D16)

The ERP mints a **separate, short-lived, asymmetric** token — not the session JWT:

- **RS256 or EdDSA.** FastAPI holds only the **public key** (`jwt_public_key` / a path setting).
- `aud: "mindmap-layout-api"` — reject any other audience.
- TTL ≤ 5 minutes; reject expired, `nbf`-future, and wrong-issuer tokens.
- Claims used: `sub` (stable ERP user id), `tenant`, `iat`, `exp`, `jti`. Nothing else is trusted.
- **Identity comes from the token only.** A `tenant_id` or `user_id` in a path, query or body is
  ignored for authorisation; if it disagrees with the token, return 403.
- Add the JWT library to `requirements.txt` (`pyjwt[crypto]` or `python-jose[cryptography]`) and
  record the choice in `DECISIONS.md`.
- Failures return 401 with **no detail** about which check failed.

Also produce the ERP-side minting spec (claims, key id, rotation) in
`docs/product-360/DELEGATION-TOKEN.md` so Phase 6 can wire it. Implementing the minter in Spring
Boot belongs to whichever phase runs last — say which, do not leave it unowned.

### 3.3 Migration

New Alembic revision after `0001_initial_schema`, with a working `downgrade()`:

1. `users.tenant_id` — nullable first, backfilled with the standalone sentinel, then made
   `NOT NULL`; replace the existing unique index on `email` with a unique index on
   `(tenant_id, email)`. A one-shot `ALTER … NOT NULL` on a live table with no default will fail;
   do it in the three steps.
2. `product360_layouts` — `UUIDPrimaryKeyMixin` + `TimestampMixin` +
   `tenant_id`, `user_id` (FK), `view_type`, `product_id`, `schema_version`,
   `node_positions` (JSONB), `collapsed` (JSONB), `viewport` (JSONB), `selected_node_id`.
   **Unique on `(tenant_id, user_id, view_type, product_id)`.**
3. `product360_notes` — same ownership columns plus `node_id`, `body` (text), with a length
   constraint. Unique on `(tenant_id, user_id, view_type, product_id, node_id)`.

Index on `(tenant_id, user_id, product_id)` for both.

### 3.4 API

```
GET    /api/product-360/layouts/{product_id}
PUT    /api/product-360/layouts/{product_id}
DELETE /api/product-360/layouts/{product_id}      # reset to automatic layout
GET    /api/product-360/notes/{product_id}
PUT    /api/product-360/notes/{product_id}/{node_id}
DELETE /api/product-360/notes/{product_id}/{node_id}
```

Files: `app/api/routes/product360.py`, `app/schemas/product360.py`,
`app/repositories/product360_repository.py`, `app/services/product360_service.py`,
`app/models/product360_layout.py`, `app/models/product360_note.py`, registered in
`app/api/router.py`.

**Every query is scoped by `(tenant_id, user_id)` in the repository layer**, not in the route and
not in the service. Ownership must be structurally impossible to forget.

### 3.5 Rules

- **Store no ERP fact.** Node **ids** and positions only. No label, no quantity, no amount, no
  product name. If a reviewer can learn a business number from this database, you have gone wrong.
- **Stale layouts degrade, never fail (D8).** Node ids absent from the current graph are dropped
  silently on read; surviving positions are kept; a `schemaVersion` major mismatch returns an
  empty layout plus a flag so the UI can say "layout reset", rather than losing it silently.
- **Notes (D25):** plain text, ≤ 4 000 chars, ≤ 200 per user, stored raw and returned raw. The
  admin renders them escaped — **never** `dangerouslySetInnerHTML`. Reject control characters.
  `node_id` must match the Phase 1 id format.
- **CORS (D18):** `cors_origins` must not default to `*`. Prefer the single-origin Nginx setup the
  mind-map frontend already uses (`frontend/nginx.conf` proxies `/api/` to `backend:8000`
  same-origin, deliberately, with a comment saying so).
- **No ERP database access, ever.** No MySQL/Postgres tenant credential, no ERP hostname, no
  outbound call to the ERP from this service.

### 3.6 Tests (`backend/tests/`)

Follow the existing `conftest.py` fixture style.

- layout save → load → update → delete round trip
- **cross-user:** user B cannot read, update or delete user A's layout (404/403, never a leak)
- **cross-tenant:** same `user_id` value under a different tenant is a different record
- unknown node ids in a stored layout are dropped on read without error
- `schema_version` major mismatch → empty layout + reset flag
- note length, note count, control-character rejection, invalid `node_id` format
- token: valid accepted; expired, wrong audience, wrong issuer, bad signature, `alg: none` and a
  token signed with the **ERP's HS256 secret** all rejected
- body/path `tenant_id` disagreeing with the token → 403
- **`AUTH_MODE=none` keeps the existing behaviour** — the 9 existing test files pass unchanged
- migration: upgrade then downgrade cleanly on a scratch database

---

## 4. Do not

- Do not reuse the ERP's HS256 session token or its secret.
- Do not trust any identifier from a request body or path for authorisation.
- Do not store an ERP business value.
- Do not connect to a tenant database.
- Do not change the behaviour of the standalone product in `AUTH_MODE=none`.
- Do not edit an existing test to make it pass.

---

## 5. Exit criteria

- [ ] `pytest` passes — **including the 9 pre-existing files, unchanged** — paste the summary
- [ ] `alembic upgrade head` then `alembic downgrade -1` both succeed on a scratch DB
- [ ] Cross-tenant and cross-user tests fail closed
- [ ] Every rejected-token case tested, including the ERP-secret-signed one
- [ ] `AUTH_MODE=none` proven to preserve standalone behaviour (say how)
- [ ] `cors_origins` no longer defaults to `*` anywhere, including `docker-compose.yml`
- [ ] `DELEGATION-TOKEN.md` written, with the Spring Boot minting side explicitly owned
- [ ] `DECISIONS.md` updated with the JWT library choice

## 6. Report

Files created · pytest and alembic output · the ownership-scoping mechanism in two sentences ·
every rejected-token case with its status code · confirmation that no ERP value is stored ·
what remains for Phase 6 (key distribution, rotation, minting).
