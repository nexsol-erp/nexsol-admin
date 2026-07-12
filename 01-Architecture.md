# 01 — Architecture Design Document
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  
**Author**: Senior ERP Architect

---

## 1. Executive Summary

The Nexsol ERP system is a mature, multi-tenant Spring Boot + React application with solid infrastructure for multi-branch operations under a single tenant. Franchises are currently modelled as branches within the same tenant database, limiting operational independence for each franchise unit.

This document designs the evolution from the current **branch-based franchise model** to a **tenant-per-franchise model**, where each franchise operates as an independent tenant with its own database, isolated accounting, and self-contained operations — while the central ERP retains full visibility and consolidated reporting.

---

## 2. Existing Architecture Analysis

### 2.1 Backend

| Attribute | Value |
|---|---|
| Framework | Spring Boot 3.1.1 |
| Language | Java 17 |
| Database | PostgreSQL (multi-database per tenant) |
| ORM | Hibernate 6 with JPA |
| Multi-tenancy | DATABASE strategy (Hibernate) |
| Messaging | Apache Kafka (localhost:9092) |
| Auth | JWT (JJWT 0.11.5) |
| Connection Pooling | HikariCP 5.0.0 |
| Migration | Flyway (20 migrations, V001–V020) |
| Build | Maven |
| Search | Lucene 9.9.1 |
| Graph DB | Neo4j 5.7.0 |
| AI Service | External Python service (http://localhost:8000) |
| Server Port | 8084 |

**Package structure** (`com.nexsol.backend.backendserver`):
- `controller/` — 92 REST controllers
- `service/` — 140+ business services
- `repo/` — JPA repositories
- `entity/` — 80+ domain entities
- `tenency/` — Multi-tenant infrastructure
- `kafka/` — Kafka producers and consumers
- `security/` — JWT auth filters
- `config/` — Spring configurations
- `accounting/` — GL sub-module

### 2.2 Frontend

| Attribute | Value |
|---|---|
| Framework | React 18.3.1 |
| Routing | React Router 6.23.1 |
| UI | MUI 5.16.7 + Ant Design 5.26.5 |
| HTTP | Axios 1.17.0 |
| Forms | Formik + Yup |
| Charts | Chart.js + React ChartJS 2 |
| i18n | i18next |
| Export | XLSX, jsPDF, html2pdf.js |
| State | React Context API |
| Routes | 265+ routes |

### 2.3 Existing Multi-Tenant Infrastructure (Already Implemented)

The following are already operational and will be leveraged:

| Component | Implementation |
|---|---|
| Hibernate multi-tenancy | `DATABASE` strategy |
| Tenant context | `TenantContext` (ThreadLocal) |
| HTTP tenant extraction | `TenantFilter` (reads `X-Tenant-ID` header) |
| Tenant resolver | `CurrentTenantIdentifierResolverImpl` |
| Connection provider | `DataSourceBasedMultiTenantConnectionProviderImpl` (HikariCP per tenant) |
| JWT with tenant claim | `JwtService` generates token with `tenant` claim |
| Flyway migrations | Applied per tenant database |
| Kafka infrastructure | Producer, consumer, topics configured |
| Branch access control | JWT `branches` claim validated in controllers |

### 2.4 Current Branch-Based Franchise Model

**How franchises work today:**
- Franchises are created as records in `BranchMst`
- All franchises share one central tenant PostgreSQL database
- All share the same item master, chart of accounts, suppliers, customers
- Branch-specific fields: code, name, address, GST registration, invoice prefix, day-end flag

**Limitations:**
- Franchisee cannot maintain private suppliers or customers
- Franchisee accounting is not isolated
- All financial data visible centrally with no segregation
- Cannot have independent purchase orders
- Cannot have franchise-specific expense heads
- Consolidated reporting not granular enough at tenant level

---

## 3. Future Franchise Architecture

### 3.1 Core Principle

Each franchise is an independent tenant with its own PostgreSQL database. The central ERP manages the franchise relationship, provisions the tenant, pushes master data via Kafka, and receives sales/stock summaries.

```
Central Tenant (nexsol_central)
  ├── FranchiseMst (franchise records)
  ├── FranchiseTenantMapping (central → tenant code)
  ├── Kafka Publisher (master sync, transfer orders)
  └── Sync Dashboard (monitoring)

Franchise Tenant (nexsol_frc_001)
  ├── Own Item Master (synced from central)
  ├── Own Purchase, Suppliers, Expenses
  ├── Own Accounting (chart of accounts provisioned)
  ├── Own Customers
  ├── Own Stock
  └── Kafka Publisher (sales summary, stock summary, receipts)
```

### 3.2 Architecture Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                     Central ERP Tenant                          │
│                   (nexsol_central DB)                           │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │ FranchiseMst │   │  ItemMaster  │   │  Provisioning    │    │
│  │ FranchiseTen │   │  CategoryMst │   │  Dashboard       │    │
│  │ Mapping      │   │  TaxMst      │   │                  │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
│           │                 │                                    │
└───────────┼─────────────────┼────────────────────────────────── ┘
            │                 │
            │          Kafka Topics (erp.v1.*)
            │                 │
     ┌──────▼─────────────────▼──────────────────────────────┐
     │                  Kafka Cluster                          │
     │  erp.v1.franchise.provisioning                         │
     │  erp.v1.master.item / category / tax / uom / hsn       │
     │  erp.v1.franchise.stock-transfer                        │
     │  erp.v1.franchise.sales-summary                         │
     │  erp.v1.franchise.purchase-summary                      │
     │  erp.v1.audit  /  erp.v1.notification                  │
     └──────────────────────────────┬────────────────────────┘
                                    │
          ┌─────────────────────────┼──────────────────────┐
          │                         │                        │
┌─────────▼──────────┐  ┌──────────▼──────────┐  ┌────────▼─────────┐
│  Franchise Tenant  │  │  Franchise Tenant   │  │ Franchise Tenant │
│  nexsol_frc_001    │  │  nexsol_frc_002     │  │ nexsol_frc_003   │
│                    │  │                     │  │                  │
│  Own POS + Admin   │  │  Own POS + Admin    │  │  Own POS + Admin │
│  Own Accounting    │  │  Own Accounting     │  │  Own Accounting  │
│  Own Suppliers     │  │  Own Suppliers      │  │  Own Suppliers   │
│  Own Stock         │  │  Own Stock          │  │  Own Stock       │
└────────────────────┘  └─────────────────────┘  └──────────────────┘
```

### 3.3 Tenant Naming Convention

| Type | Pattern | Example |
|---|---|---|
| Central ERP | `{company_code}` | `nexsol` |
| Franchise Tenant | `{company_code}_frc_{branch_code}` | `nexsol_frc_001` |
| Branch (non-franchise) | existing `BranchMst` model | unchanged |

---

## 4. Multi-Tenant Strategy

### 4.1 Tenant Isolation Model

**Strategy**: Hibernate `DATABASE` — one PostgreSQL database per tenant (already implemented and working).

**Connection resolution**: `DataSourceBasedMultiTenantConnectionProviderImpl` creates a `HikariDataSource` per tenant on first access. Franchise tenants follow the same pattern.

**Request routing**:
```
HTTP Request
  → TenantFilter reads X-Tenant-ID header
  → TenantContext.setCurrentTenant(tenantId)
  → Hibernate resolves connection to tenant DB
  → Business logic executes in tenant context
  → TenantContext.clear() in finally block
```

### 4.2 Tenant Registry

A new `tenant_registry` table will be maintained in the central tenant database to track all active franchise tenants:

```
tenant_registry
  ├── tenant_id (PK)
  ├── tenant_code (unique, used as DB name)
  ├── franchise_id (FK → franchise_mst)
  ├── status (PROVISIONING | ACTIVE | SUSPENDED | TERMINATED)
  ├── db_host
  ├── db_port
  ├── db_name
  ├── created_at
  └── provisioned_at
```

### 4.3 Provisioning Workflow

```
Central Admin creates Franchise
  → ProvisioningService triggered
  → Creates PostgreSQL database (nexsol_frc_XXX)
  → Runs Flyway migrations on new database
  → Creates admin user in new tenant
  → Creates default roles and menus
  → Creates financial year
  → Creates basic master data (account heads, tax groups)
  → Publishes item master snapshot via Kafka
  → Updates tenant_registry status → ACTIVE
  → Notifies via provisioning dashboard
```

---

## 5. Security Model

### 5.1 Authentication

- **Mechanism**: JWT (stateless)
- **Token generation**: `JwtService` on `/api/login`
- **Token storage**: Browser `localStorage` (jwtToken)
- **Token validation**: `JwtAuthFilter` on every request

**JWT Payload — Central ERP Admin**:
```json
{
  "sub": "user-id",
  "tenant": "nexsol",
  "type": "CENTRAL",
  "branches": ["ALL"],
  "roles": ["FRANCHISE_ADMIN", "REPORT_VIEWER"]
}
```

**JWT Payload — Franchise Tenant User**:
```json
{
  "sub": "user-id",
  "tenant": "nexsol_frc_001",
  "type": "FRANCHISE",
  "franchiseId": "FRC-001",
  "branches": ["001"],
  "roles": ["FRANCHISE_OPERATOR"]
}
```

### 5.2 Authorization

| Role | Scope | Access |
|---|---|---|
| `CENTRAL_ADMIN` | Central tenant | Full ERP access + franchise management |
| `FRANCHISE_ADMIN` | Central tenant | Create/manage franchises, view reports |
| `FRANCHISE_OPERATOR` | Franchise tenant | Own sales, purchase, stock, accounting |
| `FRANCHISE_VIEWER` | Central tenant | Read-only consolidated reports |

### 5.3 Cross-Tenant Security

- **Central → Franchise**: Only via Kafka events and provisioning APIs (service-to-service with internal service JWT)
- **Franchise → Central**: Only via Kafka events (sales summary, stock summary)
- **No direct database cross-access**: Franchise DB is never directly queried by central service in the same request
- **Service account**: A dedicated `erp-service` JWT is used for internal API calls during provisioning

---

## 6. Authentication Model

### 6.1 Login Flow

```
Franchise User
  → POST /api/login { username, password, tenantHint? }
  → Backend: loads user from tenant DB
  → JWT generated with tenant claim
  → Client stores token in localStorage
  → All requests include Authorization: Bearer {token}
```

### 6.2 Tenant Hint Resolution

When a franchise user logs in, the system must identify which tenant they belong to:
1. URL-based: `https://frc001.nexsol.app/api/login` (preferred for portal)
2. Header-based: `X-Tenant-ID: nexsol_frc_001` (admin tool)
3. Username domain: `user@nexsol_frc_001` suffix resolution

---

## 7. Authorization Model

### 7.1 Feature Flag — Franchise Module

The franchise module will be **feature-flagged** in the central tenant. This ensures existing non-franchise customers are unaffected.

```
central_tenant_config
  ├── feature_franchise_enabled = false (default)
  ├── franchise_max_count = 10
  └── franchise_module_version = 1
```

### 7.2 API-Level Authorization

All franchise management APIs will require the `FRANCHISE_ADMIN` or `CENTRAL_ADMIN` role, checked via Spring Security's `@PreAuthorize`.

### 7.3 Data Access Rules

| Operation | Rule |
|---|---|
| View franchise list | `FRANCHISE_ADMIN` or `CENTRAL_ADMIN` |
| Create franchise | `CENTRAL_ADMIN` only |
| View consolidated reports | `FRANCHISE_VIEWER` and above |
| Provision tenant | System-internal only (no direct user API) |
| Access franchise tenant DB | Franchise users only (JWT tenant must match) |

---

## 8. Provisioning Workflow (Detail)

### 8.1 Steps

```
Step 1: Franchise Record Creation
  → POST /api/franchise { name, code, address, gst, contactPerson, ... }
  → Validates uniqueness of franchise code
  → Saves FranchiseMst with status = DRAFT
  → Returns franchiseId

Step 2: Provisioning Trigger
  → POST /api/franchise/{id}/provision
  → CENTRAL_ADMIN role required
  → Updates status = PROVISIONING
  → Queues ProvisioningTask (async)

Step 3: Database Creation (async)
  → Creates PostgreSQL DB: nexsol_frc_{franchiseCode}
  → Runs Flyway migrations (same V001-V020 + franchise-specific)
  → Creates initial schema

Step 4: Default Data Population
  → Creates admin user: admin@{franchiseCode}
  → Creates default roles: FRANCHISE_ADMIN, CASHIER, STOCK_MANAGER
  → Creates default menus
  → Creates financial year (current)
  → Creates chart of accounts (standard template)
  → Creates tax groups (GST standard rates)
  → Creates UOM list

Step 5: Master Data Sync (Kafka)
  → Publishes item master snapshot to: erp.v1.franchise.provisioning
  → Publishes category, tax, UOM, HSN snapshots
  → Franchise tenant consumers apply the data

Step 6: Activation
  → Updates tenant_registry status = ACTIVE
  → Updates FranchiseMst status = ACTIVE
  → Sends notification to central admin
  → Logs audit event

Step 7: Error Handling
  → If any step fails: status = PROVISIONING_FAILED
  → Error recorded in provisioning_log
  → Admin can retry from failed step
  → Full rollback: drops DB, clears registry
```

### 8.2 Provisioning Dashboard States

| Status | Meaning | Action |
|---|---|---|
| `DRAFT` | Franchise record created, not yet provisioned | Trigger provision |
| `PROVISIONING` | Provisioning in progress | Wait |
| `ACTIVE` | Fully operational | Manage |
| `PROVISIONING_FAILED` | Error during provisioning | Retry or rollback |
| `SUSPENDED` | Temporarily disabled | Reactivate |
| `TERMINATED` | Permanently closed | Archive only |

---

## 9. Disaster Recovery Strategy

### 9.1 Backup Strategy

| Level | Frequency | Retention | Method |
|---|---|---|---|
| Central DB | Daily full + hourly WAL | 30 days | pg_dump + WAL archiving |
| Franchise DB (each) | Daily full + hourly WAL | 30 days | pg_dump + WAL archiving |
| Kafka topics | Retention 7 days | 7 days | Kafka built-in retention |
| Application config | On change | Indefinite | Git |

### 9.2 Recovery Point Objective (RPO)

- **Central DB**: 1 hour (hourly WAL)
- **Franchise DB**: 1 hour (hourly WAL)
- **Kafka events**: 7 days (topic retention)

### 9.3 Recovery Time Objective (RTO)

- **Single franchise DB restore**: < 30 minutes
- **Central DB restore**: < 60 minutes
- **Full system restore**: < 4 hours

### 9.4 Failure Scenarios

| Scenario | Impact | Recovery |
|---|---|---|
| Franchise DB down | That franchise only | Restore from backup, re-apply Kafka events |
| Central DB down | All provisioning/reporting halted; franchises still operational | Restore central DB from backup |
| Kafka broker down | Sync paused; franchises still sell; events queue in outbox | Kafka restart; outbox replays pending events |
| Provisioning failure | New franchise unavailable | Retry from checkpoint |
| Network partition | Central-franchise sync delayed | Outbox + idempotency ensure eventual consistency |

---

## 10. Upgrade Strategy

### 10.1 Application Upgrades

- Backend: Blue-green deployment (port 8084 → 8085 → nginx swap)
- Frontend: Build → upload to CDN → cache invalidation
- No downtime for Kafka consumers (rolling restart)

### 10.2 Database Migrations

- Flyway handles all schema changes
- New migrations must be backward-compatible for one version
- Franchise tenants get Flyway run on startup (auto-apply)
- Central tenant migrations run before franchise migrations

### 10.3 Schema Versioning

- Central-specific migrations: `V1xx__` series
- Franchise-tenant migrations: `V2xx__` series
- Shared migrations: `V0xx__` series (existing V001–V020)

---

## 11. Sequence Diagrams

### 11.1 Franchise Provisioning

```
Admin         Central API       ProvisioningService    PostgreSQL       Kafka
  │                │                    │                  │              │
  │─POST /franchise─►                   │                  │              │
  │◄──201 franchiseId                   │                  │              │
  │                │                    │                  │              │
  │─POST /franchise/{id}/provision──────►                  │              │
  │                │                    │─CREATE DATABASE──►              │
  │                │                    │◄──OK──────────────              │
  │                │                    │─Flyway migrate───►              │
  │                │                    │◄──OK──────────────              │
  │                │                    │─Insert default data►            │
  │                │                    │◄──OK──────────────              │
  │                │                    │─Publish PROVISIONED event───────►
  │                │                    │─Update status=ACTIVE            │
  │◄──202 Accepted─                     │                  │              │
  │                │                    │                  │              │
```

### 11.2 Master Data Sync (Item)

```
Central         Kafka             Franchise Tenant      Consumer
  │               │                     │                  │
  │─Publish item event──────────────────────────────────────►
  │               │                     │                  │
  │               │                     │─Check idempotency►
  │               │                     │◄─Not processed────
  │               │                     │─Upsert item────────►
  │               │                     │◄─OK────────────────
  │               │                     │─Mark processed─────►
  │               │                     │                  │
```

### 11.3 Sales Summary Reporting

```
Franchise POS    Kafka             Central ERP       Report Service
  │               │                     │                  │
  │─Publish SALES_SUMMARY event─────────►                  │
  │               │                     │─Store in         │
  │               │                     │ franchise_sales_ │
  │               │                     │ summary table    │
  │               │                     │                  │
  Admin─────────────────────────────────►─GET /reports/franchise/consolidated
                                                           │─Query all tenants
                                                           │◄─Aggregate
                                                           │─Return report
```

---

## 12. High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                          NEXSOL ERP PLATFORM                          │
│                                                                        │
│  ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Central Admin  │    │  Franchise Portal│    │  POS Application │  │
│  │  React SPA      │    │  React SPA       │    │  Electron App    │  │
│  └────────┬────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                      │                         │            │
│           └──────────────────────┼─────────────────────────┘            │
│                                  │ HTTPS + JWT                          │
│                        ┌─────────▼───────────┐                         │
│                        │  Spring Boot API     │                         │
│                        │  Port 8084           │                         │
│                        │  ┌───────────────┐   │                         │
│                        │  │ TenantFilter  │   │                         │
│                        │  │ JwtAuthFilter │   │                         │
│                        │  │ Controllers   │   │                         │
│                        │  │ Services      │   │                         │
│                        │  │ Repositories  │   │                         │
│                        │  └───────────────┘   │                         │
│                        └──────┬───────────────┘                         │
│                               │                                          │
│          ┌────────────────────┼─────────────────┐                       │
│          │                    │                  │                       │
│  ┌───────▼──────┐  ┌─────────▼──────┐  ┌───────▼────────┐             │
│  │  Central DB  │  │ Franchise DB   │  │ Franchise DB   │             │
│  │  nexsol      │  │ nexsol_frc_001 │  │ nexsol_frc_002 │             │
│  │  PostgreSQL  │  │ PostgreSQL     │  │ PostgreSQL     │             │
│  └──────────────┘  └────────────────┘  └────────────────┘             │
│                                                                          │
│  ┌────────────────────────────────────────────────────────┐            │
│  │                   Apache Kafka                          │            │
│  │  erp.v1.master.*   erp.v1.franchise.*  erp.v1.audit    │            │
│  └────────────────────────────────────────────────────────┘            │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐            │
│  │  AI Service  │  │   Neo4j      │  │   Lucene Index    │            │
│  │  :8000       │  │   :7687      │  │   Full Text       │            │
│  └──────────────┘  └──────────────┘  └───────────────────┘            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 13. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tenant isolation | Database per tenant | Already implemented; strongest isolation |
| Franchise identity | Separate tenant | Full operational independence |
| Cross-tenant communication | Kafka only | No direct DB cross-access; async; resilient |
| Master data distribution | Event-driven push from central | Central is source of truth; pull creates coupling |
| Idempotency | Processed event table | Prevents duplicate application on retry |
| Outbox pattern | Yes | Prevents event loss if Kafka is temporarily down |
| Feature flag | Central tenant config | Existing customers unaffected |
| Franchise portal | Separate module within admin | Reduces infrastructure cost in Phase 1 |
| Rollback | Full DB drop + registry clear | Provisioning is atomic; no partial state |

---

*This document is the primary architectural reference for all subsequent Phase documents. All design decisions in 02-Database.md, 03-Kafka.md, 04-API.md, 05-Migration.md, and 06-Risks.md must align with the decisions recorded here.*
