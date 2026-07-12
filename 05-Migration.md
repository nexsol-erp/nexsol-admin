# 05 — Migration Strategy Document
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  

---

## 1. Migration Philosophy

### 1.1 Core Rules

1. **No existing table is modified** by franchise migrations — only new tables are added
2. **Additive only** — new columns added to existing tables must be nullable or have a default
3. **Flyway manages all schema changes** — no manual DDL in production ever
4. **Backward compatible for one version** — old backend can run against new schema
5. **Rollback plan exists** for every migration before it is deployed
6. **Test migrations on a copy of production data** before applying to production
7. **Zero-downtime preferred** — all changes are non-blocking DDL where possible

### 1.2 Migration Scope

This document covers:
- Central tenant database migrations (new franchise tables)
- Franchise tenant database migrations (applied during provisioning)
- Data migration from branch-based to franchise tenant model (when applicable)
- Kafka topic creation (infrastructure migration)
- Rollback procedures

---

## 2. Flyway Migration Versions

### 2.1 Version Series Assignment

| Series | Scope | Description |
|---|---|---|
| `V001–V020` | All tenants | Existing migrations (do not modify) |
| `V021–V099` | Central tenant only | Franchise management schema |
| `V101–V199` | All tenants (shared) | Common infrastructure changes |
| `V201–V299` | Franchise tenants only | Applied during provisioning |

### 2.2 Central Tenant Migrations (Phase 1 — Franchise Foundation)

#### V021__franchise_foundation.sql

```sql
-- Franchise master table
CREATE TABLE franchise_mst (
    id                  BIGSERIAL PRIMARY KEY,
    franchise_code      VARCHAR(20)  NOT NULL,
    franchise_name      VARCHAR(200) NOT NULL,
    franchise_type      VARCHAR(50)  NOT NULL DEFAULT 'STANDARD',
    status              VARCHAR(30)  NOT NULL DEFAULT 'DRAFT',
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
    created_by          VARCHAR(100),
    CONSTRAINT uq_franchise_code UNIQUE (franchise_code)
);

-- Franchise to tenant mapping
CREATE TABLE franchise_tenant_mapping (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    tenant_code     VARCHAR(100) NOT NULL,
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
    created_by      VARCHAR(100),
    CONSTRAINT uq_tenant_code UNIQUE (tenant_code)
);

-- Franchise configuration
CREATE TABLE franchise_config (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    config_key      VARCHAR(100) NOT NULL,
    config_value    TEXT,
    config_type     VARCHAR(20)  DEFAULT 'STRING',
    description     VARCHAR(500),
    is_active       BOOLEAN      DEFAULT TRUE,
    created_at      TIMESTAMP    DEFAULT NOW(),
    updated_at      TIMESTAMP    DEFAULT NOW(),
    created_by      VARCHAR(100),
    CONSTRAINT uq_franchise_config UNIQUE (franchise_id, config_key)
);

-- Indexes
CREATE INDEX idx_franchise_mst_code   ON franchise_mst(franchise_code);
CREATE INDEX idx_franchise_mst_status ON franchise_mst(status);
CREATE INDEX idx_ftm_franchise_id     ON franchise_tenant_mapping(franchise_id);
CREATE INDEX idx_franchise_config_fid ON franchise_config(franchise_id);
```

**Rollback**:
```sql
DROP TABLE IF EXISTS franchise_config CASCADE;
DROP TABLE IF EXISTS franchise_tenant_mapping CASCADE;
DROP TABLE IF EXISTS franchise_mst CASCADE;
```

---

#### V022__franchise_provisioning_log.sql

```sql
CREATE TABLE franchise_provisioning_log (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT       NOT NULL REFERENCES franchise_mst(id),
    step_name       VARCHAR(100) NOT NULL,
    step_status     VARCHAR(20)  NOT NULL,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    error_message   TEXT,
    retry_count     INTEGER      DEFAULT 0,
    created_at      TIMESTAMP    DEFAULT NOW()
);

CREATE INDEX idx_prov_log_fid    ON franchise_provisioning_log(franchise_id);
CREATE INDEX idx_prov_log_status ON franchise_provisioning_log(step_status);
```

---

#### V023__enterprise_event_outbox.sql (Phase 3.5 — also applied to all tenant DBs)

```sql
CREATE TABLE enterprise_event_outbox (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL DEFAULT gen_random_uuid(),
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
    retry_count     INTEGER      DEFAULT 0,
    max_retries     INTEGER      DEFAULT 5,
    error_message   TEXT,
    scheduled_at    TIMESTAMP    DEFAULT NOW(),
    published_at    TIMESTAMP,
    created_at      TIMESTAMP    DEFAULT NOW(),
    created_by      VARCHAR(100),
    CONSTRAINT uq_event_id UNIQUE (event_id)
);

CREATE INDEX idx_outbox_status    ON enterprise_event_outbox(status);
CREATE INDEX idx_outbox_event_type ON enterprise_event_outbox(event_type);
CREATE INDEX idx_outbox_tenant    ON enterprise_event_outbox(source_tenant);
CREATE INDEX idx_outbox_scheduled ON enterprise_event_outbox(scheduled_at)
    WHERE status IN ('PENDING', 'RETRY_PENDING');

CREATE TABLE processed_event (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL,
    consumer_name   VARCHAR(100) NOT NULL,
    tenant_id       VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'PROCESSED',
    processed_at    TIMESTAMP    DEFAULT NOW(),
    error_message   TEXT,
    CONSTRAINT uq_processed_event UNIQUE (event_id, consumer_name, tenant_id)
);

CREATE INDEX idx_proc_event ON processed_event(event_id);
```

---

#### V024__franchise_sync_summary.sql

```sql
CREATE TABLE franchise_sync_summary (
    id              BIGSERIAL PRIMARY KEY,
    franchise_id    BIGINT        NOT NULL REFERENCES franchise_mst(id),
    tenant_code     VARCHAR(100)  NOT NULL,
    summary_type    VARCHAR(30)   NOT NULL,
    summary_date    DATE          NOT NULL,
    period_type     VARCHAR(20)   DEFAULT 'DAILY',
    total_amount    NUMERIC(18,2) DEFAULT 0,
    total_quantity  NUMERIC(18,4) DEFAULT 0,
    record_count    INTEGER       DEFAULT 0,
    payload_json    JSONB,
    received_at     TIMESTAMP     DEFAULT NOW(),
    CONSTRAINT uq_sync_summary UNIQUE (franchise_id, summary_type, summary_date, period_type)
);

CREATE INDEX idx_fss_franchise ON franchise_sync_summary(franchise_id);
CREATE INDEX idx_fss_date      ON franchise_sync_summary(summary_date);
CREATE INDEX idx_fss_type      ON franchise_sync_summary(summary_type);
```

---

#### V025__franchise_stock_transfer.sql

```sql
CREATE TABLE franchise_stock_transfer_hdr (
    id                  BIGSERIAL PRIMARY KEY,
    transfer_no         VARCHAR(30)   NOT NULL,
    franchise_id        BIGINT        NOT NULL REFERENCES franchise_mst(id),
    transfer_date       DATE          NOT NULL,
    dispatch_date       DATE,
    received_date       DATE,
    status              VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
    source_branch_code  VARCHAR(20)   NOT NULL,
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
    is_active           BOOLEAN       DEFAULT TRUE,
    created_at          TIMESTAMP     DEFAULT NOW(),
    updated_at          TIMESTAMP     DEFAULT NOW(),
    created_by          VARCHAR(100),
    CONSTRAINT uq_transfer_no UNIQUE (transfer_no)
);

CREATE TABLE franchise_stock_transfer_line (
    id              BIGSERIAL PRIMARY KEY,
    transfer_hdr_id BIGINT        NOT NULL REFERENCES franchise_stock_transfer_hdr(id),
    line_no         INTEGER       NOT NULL,
    item_code       VARCHAR(50)   NOT NULL,
    item_name       VARCHAR(300)  NOT NULL,
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

CREATE INDEX idx_fst_franchise ON franchise_stock_transfer_hdr(franchise_id);
CREATE INDEX idx_fst_status    ON franchise_stock_transfer_hdr(status);
CREATE INDEX idx_fstl_hdr      ON franchise_stock_transfer_line(transfer_hdr_id);
CREATE INDEX idx_fstl_item     ON franchise_stock_transfer_line(item_code);
```

---

### 2.3 Franchise Tenant Migrations (Applied During Provisioning)

These run on newly created franchise tenant databases during the `RUN_MIGRATIONS` provisioning step.

#### V201__franchise_identity.sql

```sql
CREATE TABLE franchise_identity (
    id                   BIGSERIAL PRIMARY KEY,
    central_franchise_id BIGINT       NOT NULL,
    franchise_code       VARCHAR(20)  NOT NULL,
    franchise_name       VARCHAR(200) NOT NULL,
    central_tenant_code  VARCHAR(100) NOT NULL,
    is_active            BOOLEAN      DEFAULT TRUE,
    registered_at        TIMESTAMP    DEFAULT NOW()
);
```

#### V202__item_sync_log.sql

```sql
CREATE TABLE item_sync_log (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID         NOT NULL,
    item_code       VARCHAR(50)  NOT NULL,
    sync_type       VARCHAR(20)  NOT NULL,
    sync_status     VARCHAR(20)  NOT NULL DEFAULT 'APPLIED',
    event_time      TIMESTAMP    NOT NULL,
    applied_at      TIMESTAMP    DEFAULT NOW(),
    error_message   TEXT
);

CREATE INDEX idx_isl_item  ON item_sync_log(item_code);
CREATE INDEX idx_isl_event ON item_sync_log(event_id);
```

#### V203__franchise_event_outbox.sql

Same DDL as V023 — creates `enterprise_event_outbox` and `processed_event` on the franchise tenant database so franchises can also publish events back to central.

---

## 3. Kafka Topic Migration (Infrastructure)

New topics must be created before the application is deployed. This is a one-time setup:

```bash
# Run on Kafka server (or via Kafka admin client)

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.provisioning \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.item \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.category \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.tax \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.uom \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.hsn \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.price \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.stock-transfer \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.sales-summary \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.purchase-summary \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.stock-summary \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.audit \
  --partitions 12 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.notification \
  --partitions 3 --replication-factor 1 \
  --config retention.ms=604800000

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.ai-events \
  --partitions 6 --replication-factor 1 \
  --config retention.ms=604800000

# DLQ topics
kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.franchise.provisioning.dlq \
  --partitions 1 --replication-factor 1 \
  --config retention.ms=-1

kafka-topics.sh --create --bootstrap-server localhost:9092 \
  --topic erp.v1.master.item.dlq \
  --partitions 1 --replication-factor 1 \
  --config retention.ms=-1
```

*(DLQ topics have unlimited retention so no event is ever lost)*

---

## 4. Existing Branch Data Migration

### 4.1 When to Migrate

Existing branches that represent franchise locations are **not automatically migrated**. Migration is a manual, per-customer decision. The criteria:

- Customer explicitly requests franchise module activation
- Specific branches are designated as franchisee locations
- Business data review confirms which branches qualify

### 4.2 Migration Steps

For each branch to be migrated to franchise model:

```
Step 1: Review Branch Data
  → Identify branch_code from BranchMst
  → Confirm transaction history to retain (if any)
  → Confirm current stock position
  → Confirm outstanding payables/receivables

Step 2: Create Franchise Record
  → POST /api/{tenantId}/franchise with branch data
  → Map branch fields → franchise fields

Step 3: Provision Franchise Tenant
  → POST /api/{tenantId}/franchise/{id}/provision
  → Wait for ACTIVE status

Step 4: Stock Opening Entry
  → Publish current stock of the branch as opening stock event
  → Franchise tenant applies as opening stock entry

Step 5: Outstanding Balance Migration (if applicable)
  → Create opening balance vouchers in franchise tenant accounting
  → Match against central accounting

Step 6: Mark Branch as Migrated (optional)
  → Add note in branch record: "Migrated to franchise: FRC-XXX"
  → Branch remains in BranchMst for historical reporting

Step 7: POS Reconfiguration
  → POS at franchise location gets new tenant code
  → POS re-login with franchise tenant credentials
```

### 4.3 Parallel Running Period

During migration, the branch continues operating in the central tenant. A cutover date is agreed. On cutover:
1. Day-end is run on the branch in central tenant
2. Closing stock is noted
3. Opening entries are created in franchise tenant
4. POS is reconfigured
5. All new transactions go to franchise tenant

### 4.4 Historical Data

Historical sales, purchase, and accounting data remains in the central tenant under the original branch. The franchise tenant starts fresh from the cutover date.

---

## 5. Deployment Order

The following order must be maintained across all phases:

```
1. Create Kafka topics (run kafka-topics.sh scripts)
2. Deploy backend with V021 migration (franchise_mst, etc.)
3. Verify: franchise tables exist in central DB
4. Deploy frontend franchise management UI
5. Verify: Franchise module accessible in admin UI
6. Enable franchise feature flag for qualifying tenants:
   INSERT INTO central_tenant_config (key, value) 
   VALUES ('feature_franchise_enabled', 'true');
7. Create first franchise via UI
8. Trigger provisioning
9. Verify: franchise DB created, migrations applied
10. Verify: item sync published and applied in franchise DB
11. Enable franchise login and test end-to-end
```

---

## 6. Rollback Plan

### 6.1 Application Rollback

The previous JAR can be redeployed at any time. New tables added in V021–V025 are additive — the previous application version ignores them.

### 6.2 Database Rollback

Flyway does not support automatic rollback in the free version. Manual rollback scripts are maintained for each migration:

| Migration | Rollback Script |
|---|---|
| V021 | `DROP TABLE franchise_config, franchise_tenant_mapping, franchise_mst CASCADE` |
| V022 | `DROP TABLE franchise_provisioning_log CASCADE` |
| V023 | `DROP TABLE processed_event, enterprise_event_outbox CASCADE` |
| V024 | `DROP TABLE franchise_sync_summary CASCADE` |
| V025 | `DROP TABLE franchise_stock_transfer_line, franchise_stock_transfer_hdr CASCADE` |

**Rollback execution**:
1. Stop the application
2. Run rollback SQL script
3. Delete Flyway schema_version entries for the rolled-back migrations
4. Deploy previous application version
5. Restart application

### 6.3 Franchise Tenant Rollback

If a provisioned franchise tenant needs to be completely removed:

```sql
-- Step 1: Drop franchise database (on PostgreSQL server)
DROP DATABASE nexsol_frc_001;

-- Step 2: Clear central records
DELETE FROM franchise_provisioning_log WHERE franchise_id = 42;
DELETE FROM franchise_tenant_mapping   WHERE franchise_id = 42;
UPDATE franchise_mst SET status = 'DRAFT' WHERE id = 42;
```

---

## 7. Testing Requirements Before Production

| Test | Coverage | Responsible |
|---|---|---|
| V021 migration applies cleanly to a copy of prod DB | 100% | Backend team |
| V021 rollback script works | 100% | Backend team |
| Provisioning creates DB and applies V201–V203 | 100% | Backend team |
| Item sync publishes and applies correctly | 50+ items | Backend team |
| Stock transfer dispatches and received correctly | 5 transfers | Full team |
| Existing ERP functionality unaffected after V021 | All existing tests | QA team |
| Frontend franchise UI functional | All CRUD flows | Frontend team |
| Kafka topics created and accessible | All 15+ topics | DevOps |
| Outbox poller publishes events reliably | 1000 events | Backend team |
| Idempotency — event applied twice = same result | All event types | Backend team |

---

*All migrations must be reviewed and approved by a second developer before being committed to the main branch. Migration scripts are immutable once merged — changes require a new migration version.*
