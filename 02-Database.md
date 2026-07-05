# 02 — Database Design Document
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  

---

## 1. Current Database Architecture

### 1.1 Multi-Tenant Database Strategy

The system uses Hibernate's `DATABASE` multi-tenancy strategy. Each tenant maps to a separate PostgreSQL database on the same server. The central ERP tenant database is named after the company code (e.g., `nexsol`). The `DataSourceBasedMultiTenantConnectionProviderImpl` creates a `HikariDataSource` per tenant lazily, using the connection URL pattern:

```
jdbc:postgresql://localhost:5432/{tenantId}
```

### 1.2 Existing Migration Baseline (V001–V020)

| Migration | Description |
|---|---|
| V001 | POS app versioning — release type and delta patch |
| V002 | POS app version unique key widening |
| V003 | Accounting Phase 1 — GL, account groups, account heads |
| V004 | Receipt and payment tables |
| V005 | UPI payment config per branch |
| V006 | Inter-branch stock transfer link (inbound/outbound) |
| V007 | Sales return tables |
| V008 | Stock transfer reason codes |
| V009 | Bank reconciliation and inventory valuation tables |
| V010 | Phase 6 — multi-unit purchase, period closing, budget |
| V011 | Multi-unit purchase support columns |
| V012 | Report category exclusion |
| V013 | Setup wizard progress tables |
| V014 | Stock transfer discount columns |
| V015 | Purchase draft status |
| V016 | Purchase correction mechanism |
| V017 | Receipt mode GL account mapping |
| V018 | Branch monthly expense tracking |
| V019 | Expense type to GL account mapping |
| V020 | Client connection status and version tracking |

All franchise-module migrations will start at **V021** to avoid conflicts.

---

## 2. Database Design Principles

1. All new tables follow existing naming convention: `snake_case`
2. All primary keys are `BIGSERIAL` (auto-increment BIGINT)
3. All tables include `created_at TIMESTAMP`, `updated_at TIMESTAMP`, `created_by VARCHAR(100)`
4. All foreign key constraints use `ON DELETE RESTRICT` unless explicitly noted
5. Soft deletes via `is_active BOOLEAN DEFAULT TRUE`
6. All tenant-specific tables added to both central and franchise schemas via split migration versions
7. Central-only tables: `V1xx__` series
8. Franchise-tenant tables: `V2xx__` series

---

## 3. New Tables — Central Tenant Database

### 3.1 `franchise_mst` — Franchise Master

```sql
CREATE TABLE franchise_mst (
    id                  BIGSERIAL PRIMARY KEY,
    franchise_code      VARCHAR(20)  NOT NULL UNIQUE,
    franchise_name      VARCHAR(200) NOT NULL,
    franchise_type      VARCHAR(50)  NOT NULL DEFAULT 'STANDARD',
                        -- STANDARD | PREMIUM | MASTER
    status              VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
                        -- DRAFT | PROVISIONING | ACTIVE | SUSPENDED | TERMINATED
    address_line1       VARCHAR(255),
    address_line2       VARCHAR(255),
    city                VARCHAR(100),
    state               VARCHAR(100),
    pincode             VARCHAR(10),
    country             VARCHAR(50)  DEFAULT 'INDIA',
    gst_number          VARCHAR(20),
    pan_number          VARCHAR(10),
    contact_person      VARCHAR(150),
    contact_phone       VARCHAR(20),
    contact_email       VARCHAR(150),
    website             VARCHAR(255),
    logo_url            VARCHAR(500),
    agreement_date      DATE,
    agreement_expiry    DATE,
    royalty_percentage  NUMERIC(5,2) DEFAULT 0,
    territory           VARCHAR(500),
    parent_franchise_id BIGINT REFERENCES franchise_mst(id),
    is_active           BOOLEAN      DEFAULT TRUE,
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW(),
    created_by          VARCHAR(100)
);

CREATE INDEX idx_franchise_mst_code   ON franchise_mst(franchise_code);
CREATE INDEX idx_franchise_mst_status ON franchise_mst(status);
```

### 3.2 `franchise_tenant_mapping` — Franchise to Tenant Link

```sql
CREATE TABLE franchise_tenant_mapping (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    tenant_code     VARCHAR(100) NOT NULL UNIQUE,
                    -- e.g., nexsol_frc_001
    db_host         VARCHAR(255) NOT NULL DEFAULT 'localhost',
    db_port         INTEGER      NOT NULL DEFAULT 5432,
    db_name         VARCHAR(100) NOT NULL,
    db_schema       VARCHAR(100) DEFAULT 'public',
    admin_username  VARCHAR(100),
    admin_email     VARCHAR(150),
    provisioned_at  TIMESTAMP,
    activated_at    TIMESTAMP,
    suspended_at    TIMESTAMP,
    terminated_at   TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW(),
    created_by      VARCHAR(100)
);

CREATE INDEX idx_ftm_franchise ON franchise_tenant_mapping(franchise_id);
CREATE INDEX idx_ftm_tenant    ON franchise_tenant_mapping(tenant_code);
```

### 3.3 `franchise_provisioning_log` — Provisioning Audit Trail

```sql
CREATE TABLE franchise_provisioning_log (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    step_name       VARCHAR(100) NOT NULL,
                    -- CREATE_DB | RUN_MIGRATIONS | CREATE_ADMIN | CREATE_ROLES |
                    -- CREATE_MENUS | CREATE_FY | CREATE_ACCOUNTS | SYNC_ITEMS |
                    -- ACTIVATE
    step_status     VARCHAR(20)  NOT NULL,
                    -- PENDING | RUNNING | COMPLETED | FAILED
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    error_message   TEXT,
    retry_count     INTEGER      DEFAULT 0,
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_prov_log_franchise ON franchise_provisioning_log(franchise_id);
CREATE INDEX idx_prov_log_status    ON franchise_provisioning_log(step_status);
```

### 3.4 `franchise_config` — Per-Franchise Configuration

```sql
CREATE TABLE franchise_config (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    config_key      VARCHAR(100) NOT NULL,
    config_value    TEXT,
    config_type     VARCHAR(20)  DEFAULT 'STRING',
                    -- STRING | BOOLEAN | NUMBER | JSON
    description     VARCHAR(500),
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW(),
    created_by      VARCHAR(100),
    UNIQUE(franchise_id, config_key)
);
```

### 3.5 `franchise_sync_summary` — Sales and Stock Summary from Franchises

```sql
CREATE TABLE franchise_sync_summary (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    tenant_code     VARCHAR(100) NOT NULL,
    summary_type    VARCHAR(30)  NOT NULL,
                    -- SALES | STOCK | PURCHASE | EXPENSE | PROFIT
    summary_date    DATE         NOT NULL,
    period_type     VARCHAR(20)  DEFAULT 'DAILY',
                    -- DAILY | WEEKLY | MONTHLY
    total_amount    NUMERIC(18,2) DEFAULT 0,
    total_quantity  NUMERIC(18,4) DEFAULT 0,
    record_count    INTEGER      DEFAULT 0,
    payload_json    JSONB,
    received_at     TIMESTAMP    DEFAULT NOW(),
    UNIQUE(franchise_id, summary_type, summary_date, period_type)
);

CREATE INDEX idx_fss_franchise ON franchise_sync_summary(franchise_id);
CREATE INDEX idx_fss_date      ON franchise_sync_summary(summary_date);
CREATE INDEX idx_fss_type      ON franchise_sync_summary(summary_type);
```

### 3.6 `enterprise_event_outbox` — Transactional Outbox for Kafka

```sql
CREATE TABLE enterprise_event_outbox (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    event_type      VARCHAR(100) NOT NULL,
    event_version   VARCHAR(10)  NOT NULL DEFAULT 'v1',
    source_service  VARCHAR(100) NOT NULL,
    source_tenant   VARCHAR(100) NOT NULL,
    target_tenant   VARCHAR(100),
    entity_type     VARCHAR(100),
    entity_id       VARCHAR(100),
    correlation_id  UUID,
    causation_id    UUID,
    topic_name      VARCHAR(200) NOT NULL,
    payload_json    JSONB        NOT NULL,
    metadata_json   JSONB,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
                    -- PENDING | PUBLISHED | FAILED | RETRY_PENDING | DEAD_LETTERED
    retry_count     INTEGER      DEFAULT 0,
    max_retries     INTEGER      DEFAULT 5,
    error_message   TEXT,
    scheduled_at    TIMESTAMP    DEFAULT NOW(),
    published_at    TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT NOW(),
    created_by      VARCHAR(100)
);

CREATE INDEX idx_outbox_status      ON enterprise_event_outbox(status);
CREATE INDEX idx_outbox_event_type  ON enterprise_event_outbox(event_type);
CREATE INDEX idx_outbox_tenant      ON enterprise_event_outbox(source_tenant);
CREATE INDEX idx_outbox_scheduled   ON enterprise_event_outbox(scheduled_at) WHERE status = 'PENDING';
```

### 3.7 `processed_event` — Idempotency Table

```sql
CREATE TABLE processed_event (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL,
    consumer_name   VARCHAR(100) NOT NULL,
    tenant_id       VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PROCESSED',
                    -- PROCESSED | FAILED | SKIPPED
    processed_at    TIMESTAMP    DEFAULT NOW(),
    error_message   TEXT,
    UNIQUE(event_id, consumer_name, tenant_id)
);

CREATE INDEX idx_proc_event_id ON processed_event(event_id);
CREATE INDEX idx_proc_tenant   ON processed_event(tenant_id);
```

### 3.8 `franchise_stock_transfer_hdr` — Central-to-Franchise Transfer Header

```sql
CREATE TABLE franchise_stock_transfer_hdr (
    id                  BIGSERIAL PRIMARY KEY,
    transfer_no         VARCHAR(30)  NOT NULL UNIQUE,
    franchise_id        BIGINT       NOT NULL REFERENCES franchise_mst(id),
    transfer_date       DATE         NOT NULL,
    dispatch_date       DATE,
    received_date       DATE,
    status              VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
                        -- DRAFT | APPROVED | DISPATCHED | IN_TRANSIT | RECEIVED |
                        -- PARTIALLY_RECEIVED | CANCELLED
    source_branch_code  VARCHAR(20)  NOT NULL,
    notes               TEXT,
    total_value         NUMERIC(18,2) DEFAULT 0,
    transport_charges   NUMERIC(18,2) DEFAULT 0,
    vehicle_number      VARCHAR(30),
    driver_name         VARCHAR(150),
    approved_by         VARCHAR(100),
    approved_at         TIMESTAMP,
    dispatched_by       VARCHAR(100),
    dispatched_at       TIMESTAMP,
    received_by         VARCHAR(100),
    received_at         TIMESTAMP,
    is_active           BOOLEAN      DEFAULT TRUE,
    created_at          TIMESTAMP    DEFAULT NOW(),
    updated_at          TIMESTAMP    DEFAULT NOW(),
    created_by          VARCHAR(100)
);

CREATE INDEX idx_fst_franchise ON franchise_stock_transfer_hdr(franchise_id);
CREATE INDEX idx_fst_status    ON franchise_stock_transfer_hdr(status);
CREATE INDEX idx_fst_date      ON franchise_stock_transfer_hdr(transfer_date);
```

### 3.9 `franchise_stock_transfer_line` — Transfer Line Items

```sql
CREATE TABLE franchise_stock_transfer_line (
    id              BIGSERIAL PRIMARY KEY,
    transfer_hdr_id BIGINT       NOT NULL REFERENCES franchise_stock_transfer_hdr(id),
    line_no         INTEGER      NOT NULL,
    item_code       VARCHAR(50)  NOT NULL,
    item_name       VARCHAR(300) NOT NULL,
    barcode         VARCHAR(100),
    uom             VARCHAR(20),
    dispatched_qty  NUMERIC(18,4) DEFAULT 0,
    received_qty    NUMERIC(18,4) DEFAULT 0,
    short_qty       NUMERIC(18,4) DEFAULT 0,
    excess_qty      NUMERIC(18,4) DEFAULT 0,
    rejected_qty    NUMERIC(18,4) DEFAULT 0,
    unit_price      NUMERIC(18,4) DEFAULT 0,
    total_value     NUMERIC(18,2) DEFAULT 0,
    batch_no        VARCHAR(100),
    expiry_date     DATE,
    remarks         VARCHAR(500)
);

CREATE INDEX idx_fstl_hdr  ON franchise_stock_transfer_line(transfer_hdr_id);
CREATE INDEX idx_fstl_item ON franchise_stock_transfer_line(item_code);
```

---

## 4. New Tables — Franchise Tenant Databases

These tables are created during provisioning by Flyway migrations in the `V2xx__` series. They extend the standard ERP schema already present in each tenant.

### 4.1 `franchise_identity` — Identifies This DB as a Franchise Tenant

```sql
CREATE TABLE franchise_identity (
    id                  BIGSERIAL PRIMARY KEY,
    central_franchise_id BIGINT     NOT NULL,
    franchise_code      VARCHAR(20) NOT NULL,
    franchise_name      VARCHAR(200) NOT NULL,
    central_tenant_code VARCHAR(100) NOT NULL,
    is_active           BOOLEAN     DEFAULT TRUE,
    registered_at       TIMESTAMP   DEFAULT NOW()
);
```

### 4.2 `item_sync_log` — Tracks Item Sync Events from Central

```sql
CREATE TABLE item_sync_log (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL,
    item_code       VARCHAR(50)  NOT NULL,
    sync_type       VARCHAR(20)  NOT NULL,
                    -- CREATE | UPDATE | DELETE | PRICE_UPDATE
    sync_status     VARCHAR(20)  NOT NULL DEFAULT 'APPLIED',
                    -- APPLIED | SKIPPED | FAILED
    event_time      TIMESTAMP    NOT NULL,
    applied_at      TIMESTAMP    DEFAULT NOW(),
    error_message   TEXT
);

CREATE INDEX idx_isl_item   ON item_sync_log(item_code);
CREATE INDEX idx_isl_event  ON item_sync_log(event_id);
```

---

## 5. ER Diagram — Central Tenant

```
franchise_mst
  ├── id (PK)
  ├── franchise_code (UNIQUE)
  ├── franchise_name
  ├── status
  ├── parent_franchise_id (FK → self)
  └── ...

  ├──► franchise_tenant_mapping
  │      ├── id (PK)
  │      ├── franchise_id (FK → franchise_mst)
  │      ├── tenant_code (UNIQUE)
  │      └── db_name
  │
  ├──► franchise_provisioning_log
  │      ├── id (PK)
  │      ├── franchise_id (FK → franchise_mst)
  │      ├── step_name
  │      └── step_status
  │
  ├──► franchise_config
  │      ├── id (PK)
  │      ├── franchise_id (FK → franchise_mst)
  │      └── config_key / config_value
  │
  ├──► franchise_sync_summary
  │      ├── id (PK)
  │      ├── franchise_id (FK → franchise_mst)
  │      ├── summary_type (SALES/STOCK/PURCHASE/PROFIT)
  │      └── summary_date / total_amount
  │
  └──► franchise_stock_transfer_hdr
         ├── id (PK)
         ├── franchise_id (FK → franchise_mst)
         ├── transfer_no (UNIQUE)
         └── status

         └──► franchise_stock_transfer_line
                ├── id (PK)
                ├── transfer_hdr_id (FK)
                └── item_code / dispatched_qty / received_qty


enterprise_event_outbox (shared, central and franchise)
  ├── event_id (UNIQUE UUID)
  ├── event_type
  ├── source_tenant / target_tenant
  ├── topic_name
  ├── payload_json
  └── status

processed_event (per tenant)
  ├── event_id + consumer_name + tenant_id (UNIQUE composite)
  └── status / processed_at
```

---

## 6. Indexes and Constraints Summary

| Table | Index | Type | Reason |
|---|---|---|---|
| franchise_mst | franchise_code | UNIQUE | Code must be unique |
| franchise_mst | status | B-Tree | Filter by status frequently |
| franchise_tenant_mapping | franchise_id | B-Tree | Join to franchise_mst |
| franchise_tenant_mapping | tenant_code | UNIQUE | One tenant per franchise |
| enterprise_event_outbox | status + scheduled_at | Partial | Efficient PENDING polling |
| enterprise_event_outbox | event_id | UNIQUE | Deduplication |
| processed_event | (event_id, consumer_name, tenant_id) | UNIQUE | Idempotency guarantee |
| franchise_sync_summary | (franchise_id, summary_type, summary_date) | UNIQUE | Prevent duplicate summaries |

---

## 7. Flyway Migration Plan

| Migration | Scope | Description |
|---|---|---|
| `V021__franchise_foundation.sql` | Central DB | Creates franchise_mst, franchise_tenant_mapping, franchise_config |
| `V022__franchise_provisioning.sql` | Central DB | Creates franchise_provisioning_log |
| `V023__enterprise_event_outbox.sql` | Central DB | Creates enterprise_event_outbox, processed_event |
| `V024__franchise_sync_summary.sql` | Central DB | Creates franchise_sync_summary |
| `V025__franchise_stock_transfer.sql` | Central DB | Creates transfer header and line tables |
| `V201__franchise_identity.sql` | Franchise DB | franchise_identity table — run on new tenant provisioning |
| `V202__item_sync_log.sql` | Franchise DB | item_sync_log — run on new tenant provisioning |
| `V203__franchise_event_outbox.sql` | Franchise DB | enterprise_event_outbox, processed_event on franchise DB |

---

## 8. Data Migration Plan

### 8.1 Existing Franchise Branches (if any)

If existing branches in `BranchMst` are to be migrated to the new franchise tenant model:

1. Identify branches with `is_franchise = true` (if flag exists) or by manual selection
2. For each identified branch:
   - Create `FranchiseMst` record
   - Trigger provisioning to create new tenant DB
   - Migrate existing transaction history (optional — per business decision)
3. Keep existing branch record in `BranchMst` as a historical reference
4. Mark migrated branches with `migrated_to_franchise = true` (new column, no-op flag)

### 8.2 Zero-Impact Rule

Existing non-franchise branches are **not affected** by any migration. The `franchise_mst` table is additive. No existing table is modified by franchise migrations — only new tables are added.

---

## 9. PostgreSQL Configuration Requirements

### 9.1 For Franchise Tenant Databases

The `pg_hba.conf` and `postgresql.conf` must allow:
- Dynamic database creation from the application (requires `CREATEDB` privilege on the service account)
- Connection to dynamically named databases (no specific change needed)

### 9.2 Service Account Privileges

```sql
-- Run once on PostgreSQL server
GRANT CREATEDB TO nexsol_service_user;
```

### 9.3 Per-Franchise Database Creation

```sql
-- Executed programmatically by ProvisioningService (using template1)
CREATE DATABASE nexsol_frc_001
    OWNER = nexsol_service_user
    ENCODING = 'UTF8'
    LOCALE = 'en_US.UTF-8'
    TEMPLATE = template1;
```

---

*All DDL above represents the design target. Implementation will be done via Flyway migrations during Phase 1 and Phase 2. No DDL is to be executed manually in production.*
