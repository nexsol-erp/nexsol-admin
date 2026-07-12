# 06 — Risk Register
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  

---

## Risk Rating Scale

| Probability | Score | Meaning |
|---|---|---|
| Low | 1 | Unlikely to occur |
| Medium | 2 | May occur |
| High | 3 | Likely to occur |

| Impact | Score | Meaning |
|---|---|---|
| Low | 1 | Minor inconvenience, recoverable |
| Medium | 2 | Significant delay or data issue |
| High | 3 | Data loss, outage, security breach |

**Risk Score = Probability × Impact**
- 1–2: Low — monitor
- 3–4: Medium — mitigate
- 6–9: High — must resolve before go-live

---

## 1. Technical Risks

### RISK-T01: PostgreSQL Dynamic Database Creation Fails in Production

| Attribute | Value |
|---|---|
| **Category** | Technical |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | 6 — High |

**Description**: The provisioning service creates a new PostgreSQL database programmatically. If the service account lacks `CREATEDB` privilege, or if the PostgreSQL server has insufficient disk space or connections, provisioning fails.

**Impact**: New franchises cannot be onboarded. Existing franchises are unaffected.

**Mitigation**:
- Grant `CREATEDB` to service account during infrastructure setup and verify in pre-production
- Add disk space monitoring (alert at 80%)
- Pre-check disk and connection availability before starting provisioning
- Provisioning is idempotent — failed attempt can be retried cleanly

**Owner**: DevOps + Backend team  
**Due**: Before Phase 2 go-live

---

### RISK-T02: Flyway Migration Version Conflicts Between Central and Franchise Tenants

| Attribute | Value |
|---|---|
| **Category** | Technical |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | 6 — High |

**Description**: Flyway applies migrations to all databases configured in its datasource. If the same migration version number (e.g., V021) is intended for the central DB only but accidentally runs on a franchise DB, it may fail or corrupt data.

**Mitigation**:
- Use separate Flyway configuration per tenant type:
  - Central DB: scans `classpath:migrations/central/`
  - Franchise DB: scans `classpath:migrations/franchise/`
- Enforce version series: V021–V099 = central only, V201–V299 = franchise only
- Integration test that V021 does not run on a fresh franchise DB
- Code review gate: migration files must declare their scope in a comment header

**Owner**: Backend team  
**Due**: Phase 1

---

### RISK-T03: HikariCP Connection Pool Exhaustion with Many Franchise Tenants

| Attribute | Value |
|---|---|
| **Category** | Technical — Performance |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | 6 — High |

**Description**: The current `DataSourceBasedMultiTenantConnectionProviderImpl` creates a separate `HikariDataSource` per tenant with up to 10 connections each. With 50 franchise tenants, this is 500+ connections to PostgreSQL. PostgreSQL's default `max_connections = 100` will be exhausted.

**Mitigation**:
- Increase PostgreSQL `max_connections` (set to 500 minimum for franchise deployment)
- Reduce HikariCP pool size per tenant from 10 to 3–5 for franchise tenants
- Consider a separate PgBouncer connection pooler between the application and PostgreSQL
- Add a tenant activity check — do not pre-warm franchise datasources; lazy-load only on first request
- Monitor active connections per tenant via `pg_stat_activity`

**Owner**: Backend team + DevOps  
**Due**: Phase 2

---

### RISK-T04: Kafka Event Loss During Application Restart

| Attribute | Value |
|---|---|
| **Category** | Technical |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: If the application crashes after committing a business transaction but before publishing the Kafka event, the event is lost.

**Mitigation**: The **Outbox Pattern** (designed in Phase 3.5) fully addresses this. Events are written to `enterprise_event_outbox` in the same DB transaction as the business record. A separate background poller reads and publishes. If the app crashes after DB commit, the poller picks up on restart. This is a non-issue once the outbox is implemented.

**Residual risk if outbox is not implemented**: Medium. Mitigation: implement outbox before any franchise sync goes live.

**Owner**: Backend team  
**Due**: Phase 3.5

---

### RISK-T05: Idempotency Table Grows Without Bound

| Attribute | Value |
|---|---|
| **Category** | Technical — Operations |
| **Probability** | High (3) |
| **Impact** | Low (1) |
| **Score** | 3 — Medium |

**Description**: The `processed_event` table records every event consumed. Without cleanup, it grows indefinitely.

**Mitigation**:
- Add a scheduled job to delete `processed_event` records older than 90 days
- Add a `UNIQUE` constraint on `(event_id, consumer_name, tenant_id)` — duplicate check remains O(1) via index regardless of table size
- Partition by month if volume exceeds 10M rows per year

**Owner**: Backend team  
**Due**: Phase 3.5

---

### RISK-T06: Kafka Consumer Lag — Franchise Tenant Misses Item Update

| Attribute | Value |
|---|---|
| **Category** | Technical |
| **Probability** | Low (1) |
| **Impact** | Medium (2) |
| **Score** | 2 — Low |

**Description**: If a franchise tenant's Kafka consumer is behind, it may sell an item at an outdated price or sell an item that has been deactivated.

**Mitigation**:
- Consumer lag alerting: alert when lag > 1000 messages
- Franchise POS can operate independently (offline-first), so lag does not block sales
- Price changes include `effectiveDate` — consumer applies only when date is reached
- Item deactivation includes a grace period (e.g., 24 hours) before POS enforces it
- Full sync available as a manual override

**Owner**: Backend team  
**Due**: Phase 4

---

### RISK-T07: Provisioning Step Fails Midway — Partially Created Tenant

| Attribute | Value |
|---|---|
| **Category** | Technical |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | 4 — Medium |

**Description**: If provisioning fails after DB creation but before completing all steps, a partially configured franchise tenant exists. This could leave a dangling database or an admin user without proper roles.

**Mitigation**:
- Provisioning is checkpoint-based — each step is recorded in `franchise_provisioning_log`
- Retry resumes from the first failed step (not from scratch)
- Rollback fully drops the database and clears all records
- Each provisioning step is idempotent — can be re-run safely

**Owner**: Backend team  
**Due**: Phase 2

---

## 2. Operational Risks

### RISK-O01: Franchise Admin Forgets Password — No Recovery Process

| Attribute | Value |
|---|---|
| **Category** | Operational |
| **Probability** | High (3) |
| **Impact** | Medium (2) |
| **Score** | 6 — High |

**Description**: Franchise admin credentials are created during provisioning. If the admin loses their password, they are locked out of their tenant entirely.

**Mitigation**:
- Implement password reset flow per tenant (email-based OTP)
- Central admin can reset a franchise user password via a dedicated API (does not require logging into franchise tenant)
- Provisioning sends credentials to a verified email address

**Owner**: Backend + Frontend team  
**Due**: Phase 2 (provisioning), Phase 8 (self-service portal)

---

### RISK-O02: Kafka Cluster Goes Down — All Sync Halted

| Attribute | Value |
|---|---|
| **Category** | Operational |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: If Kafka is unavailable, franchise sync is halted. Central cannot push item updates. Franchises cannot push sales summaries. However, franchise operations (sales, purchase, stock) continue independently because they run in their own tenant DB.

**Mitigation**:
- Outbox pattern ensures no events are lost — they queue up in the DB
- Kafka restart resumes publishing from the outbox
- Alert immediately on Kafka health check failure
- Design provisioning to proceed without Kafka for DB/account creation steps, then publish sync events when Kafka recovers

**Owner**: DevOps  
**Due**: Phase 3

---

### RISK-O03: Accidental Central Admin Deletes Wrong Franchise

| Attribute | Value |
|---|---|
| **Category** | Operational |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: Central admin terminates or rolls back provisioning for the wrong franchise, causing data loss.

**Mitigation**:
- Termination requires a confirmation step with franchise code typed manually (like GitHub repository deletion)
- `retainData: true` is the default on termination — database is not dropped immediately
- 30-day grace period before database drop
- Termination is audit-logged with the acting user
- Rollback of provisioning only available when status is `PROVISIONING_FAILED` (not ACTIVE)
- Separate `SUSPEND` action for temporary deactivation (no data risk)

**Owner**: Backend + UX team  
**Due**: Phase 2

---

### RISK-O04: Franchise Tenant DB Backup Not Configured

| Attribute | Value |
|---|---|
| **Category** | Operational |
| **Probability** | Medium (2) |
| **Impact** | High (3) |
| **Score** | 6 — High |

**Description**: When a new franchise tenant database is created, the backup system may not automatically pick it up. If the backup system is configured for named databases, a new database may be silently unprotected.

**Mitigation**:
- Provisioning step 9 (ACTIVATE) must include a call to backup registration API or a webhook
- Use a backup script that discovers all `nexsol_frc_*` databases dynamically: `SELECT datname FROM pg_database WHERE datname LIKE 'nexsol_frc_%'`
- Send an alert to DevOps when a new franchise tenant is activated

**Owner**: DevOps  
**Due**: Phase 2

---

### RISK-O05: Master Data Conflict — Franchise Overrides Centrally Synced Item

| Attribute | Value |
|---|---|
| **Category** | Operational — Data Integrity |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | 4 — Medium |

**Description**: If franchise operators can manually edit items in their tenant, a subsequent sync from central may overwrite their local changes, or the local changes may block sync application.

**Mitigation**:
- Define which item fields are "central-owned" (code, name, tax, HSN, UOM) vs "franchise-owned" (local notes, local price variations if allowed)
- Sync consumer overwrites only central-owned fields
- Franchise-owned fields are preserved during sync
- UI must clearly indicate which fields are managed centrally (show a lock icon)

**Owner**: Backend + UX team  
**Due**: Phase 4

---

## 3. Security Risks

### RISK-S01: Cross-Tenant Data Leakage via JWT Manipulation

| Attribute | Value |
|---|---|
| **Category** | Security — Critical |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: If a franchise user manipulates the `tenant` claim in their JWT, they could gain access to another tenant's database.

**Mitigation**:
- JWT is signed with a server-side secret key (HS256 or RS256) — claims cannot be tampered with
- Backend validates JWT signature on every request — a tampered token is rejected with 401
- `TenantFilter` reads tenant from validated JWT, not from request headers
- Use RS256 (asymmetric) in production so private key never leaves the server

**Owner**: Backend team  
**Due**: Phase 1 (security baseline)

---

### RISK-S02: Provisioning API Exposed Without Proper Authorization

| Attribute | Value |
|---|---|
| **Category** | Security — Critical |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: The `/provision` and `/rollback` endpoints create and destroy databases. If improperly secured, an attacker could provision unlimited tenants or destroy franchise databases.

**Mitigation**:
- Provisioning endpoints require `CENTRAL_ADMIN` role — enforced via `@PreAuthorize("hasRole('CENTRAL_ADMIN')")`
- Rate limit provisioning API: max 5 provisions per hour per tenant
- Require multi-factor confirmation for destructive operations (rollback, terminate)
- Audit log every provisioning action with IP, user, and timestamp

**Owner**: Backend team  
**Due**: Phase 2

---

### RISK-S03: Franchise Tenant Admin Gets Access to Central Data

| Attribute | Value |
|---|---|
| **Category** | Security |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: A franchise admin user should only access their own tenant. If the JWT tenant claim is not enforced server-side, a franchise admin could call central tenant APIs.

**Mitigation**:
- Every API validates: `TenantContext.getCurrentTenant()` matches JWT `tenant` claim
- Franchise tenant JWT `type` claim = `FRANCHISE` — central APIs reject `FRANCHISE` type tokens
- Cross-tenant APIs (consolidated reports) are only accessible from the central tenant context

**Owner**: Backend team  
**Due**: Phase 1

---

### RISK-S04: Kafka Inter-Tenant Events Not Validated

| Attribute | Value |
|---|---|
| **Category** | Security |
| **Probability** | Low (1) |
| **Impact** | Medium (2) |
| **Score** | 2 — Low |

**Description**: A rogue franchise tenant could publish fake events to Kafka (e.g., fake sales summary with inflated numbers) if there is no message authentication.

**Mitigation**:
- Franchise tenants do not have direct Kafka access — events are published via the franchise tenant's API service only
- The franchise tenant service is authenticated by its own JWT
- Event envelope includes `sourceTenant` — consumers validate that the source tenant matches the expected franchise
- In Phase 3.5, add Kafka message signing for production security

**Owner**: Backend team  
**Due**: Phase 3.5

---

### RISK-S05: CORS Policy Too Permissive in Production

| Attribute | Value |
|---|---|
| **Category** | Security |
| **Probability** | High (3) |
| **Impact** | Medium (2) |
| **Score** | 6 — High |

**Description**: The current `SecurityConfig` has CORS set to `*` (allow all origins). In production, this allows any domain to make requests to the API with a user's credentials.

**Mitigation**:
- Restrict CORS to known frontend domains before production go-live
- Use environment-variable-based CORS origins: `ALLOWED_ORIGINS=https://admin.nexsol.app,https://franchise.nexsol.app`
- This is existing, not franchise-specific — but the franchise portal adds a new origin that must be configured

**Owner**: Backend team + DevOps  
**Due**: Before any production deployment

---

## 4. Data Risks

### RISK-D01: Franchise Database Never Cleaned Up After Failed Provisioning

| Attribute | Value |
|---|---|
| **Category** | Data |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | 4 — Medium |

**Description**: If provisioning fails and rollback is not triggered, an empty or partially initialized `nexsol_frc_XXX` database sits on the server consuming resources.

**Mitigation**:
- Automatic cleanup job: scan for `nexsol_frc_*` databases not in `tenant_registry`, alert DevOps
- Provisioning failure triggers an automatic rollback attempt after 1 hour of no retry
- DBA review monthly: `SELECT datname FROM pg_database WHERE datname LIKE 'nexsol_frc_%'`

**Owner**: DevOps + Backend team  
**Due**: Phase 2

---

### RISK-D02: Duplicate Franchise Sync Summary from Timing Issues

| Attribute | Value |
|---|---|
| **Category** | Data Integrity |
| **Probability** | Medium (2) |
| **Impact** | Medium (2) |
| **Score** | 4 — Medium |

**Description**: A franchise publishes a daily sales summary event. Due to network retry, the same event arrives twice at the central consumer. The consolidated report shows double the sales.

**Mitigation**:
- `franchise_sync_summary` has a `UNIQUE (franchise_id, summary_type, summary_date, period_type)` constraint — duplicate insert is rejected
- Idempotency table prevents the same event from being processed twice by the same consumer
- Double-check: report service reads from the summary table (not raw Kafka) — so DB uniqueness is the final guard

**Owner**: Backend team  
**Due**: Phase 3.5 (idempotency framework)

---

### RISK-D03: Item Code Mismatch Between Central and Franchise

| Attribute | Value |
|---|---|
| **Category** | Data Integrity |
| **Probability** | Low (1) |
| **Impact** | High (3) |
| **Score** | 3 — Medium |

**Description**: If a franchise allows local item creation with codes that later clash with centrally synced items, stock and accounting records become inconsistent.

**Mitigation**:
- Reserve item code namespace: central items use codes without prefix (e.g., `ITM-001`); franchise-local items must use prefix `LCL-{franchiseCode}-XXX`
- Central sync consumer checks item code prefix before applying — rejects if code belongs to franchise namespace
- Franchise UI: when creating local items, auto-prefix with franchise code

**Owner**: Backend + UX team  
**Due**: Phase 6

---

## 5. Risk Summary Dashboard

| ID | Risk | Score | Level | Owner | Due |
|---|---|---|---|---|---|
| RISK-T01 | DB creation fails in production | 6 | High | DevOps | Phase 2 |
| RISK-T02 | Flyway version conflicts | 6 | High | Backend | Phase 1 |
| RISK-T03 | Connection pool exhaustion | 6 | High | Backend/DevOps | Phase 2 |
| RISK-T04 | Kafka event loss on crash | 3 | Medium | Backend | Phase 3.5 |
| RISK-T05 | Idempotency table unbounded | 3 | Medium | Backend | Phase 3.5 |
| RISK-T06 | Consumer lag — stale item data | 2 | Low | Backend | Phase 4 |
| RISK-T07 | Partial provisioning | 4 | Medium | Backend | Phase 2 |
| RISK-O01 | Franchise admin locked out | 6 | High | Backend | Phase 2 |
| RISK-O02 | Kafka cluster down | 3 | Medium | DevOps | Phase 3 |
| RISK-O03 | Wrong franchise deleted | 3 | Medium | Backend/UX | Phase 2 |
| RISK-O04 | Backup not configured for new tenant | 6 | High | DevOps | Phase 2 |
| RISK-O05 | Item sync overwrites franchise data | 4 | Medium | Backend/UX | Phase 4 |
| RISK-S01 | JWT tenant claim manipulation | 3 | Medium | Backend | Phase 1 |
| RISK-S02 | Provisioning API unauthorized | 3 | Medium | Backend | Phase 2 |
| RISK-S03 | Franchise admin accesses central | 3 | Medium | Backend | Phase 1 |
| RISK-S04 | Kafka event spoofing | 2 | Low | Backend | Phase 3.5 |
| RISK-S05 | CORS too permissive in prod | 6 | High | Backend/DevOps | Before prod |
| RISK-D01 | Orphan franchise databases | 4 | Medium | DevOps | Phase 2 |
| RISK-D02 | Duplicate sync summaries | 4 | Medium | Backend | Phase 3.5 |
| RISK-D03 | Item code namespace clash | 3 | Medium | Backend/UX | Phase 6 |

---

## 6. Pre-Phase-1 Mandatory Risk Resolutions

The following risks **must be mitigated before Phase 1 implementation begins**:

| Risk | Action Required |
|---|---|
| RISK-T02 | Define and document Flyway migration path separation (central vs. franchise) |
| RISK-S01 | Confirm JWT signing uses server-side secret; plan RS256 migration for production |
| RISK-S03 | Design and document tenant-type claim validation in all franchise APIs |
| RISK-S05 | Create CORS environment-variable configuration plan |

---

*This risk register is a living document. Risks must be reviewed at the start of each phase and updated as new risks are identified or existing risks are resolved.*
