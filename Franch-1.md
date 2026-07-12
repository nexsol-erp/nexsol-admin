I think this project is large enough that Claude should **not** build it in one go. It should be built in **independent phases**, with each phase ending in a fully working, tested system before moving to the next. Your requirements document already contains the functional scope. 

Below is the phased roadmap I would give Claude.

---

# Franchise ERP Development Roadmap

## Global Instructions

You are a Senior ERP Architect, Enterprise Solution Architect and Principal Software Engineer.

Before every phase:

1. Analyze the existing ERP architecture.
2. Produce a detailed design document.
3. Identify risks.
4. Design database changes.
5. Design APIs.
6. Design Kafka events.
7. Design UI.
8. Design migration.
9. Wait for approval.
10. Only then start implementation.

Each phase must be:

* Independently deployable
* Fully tested
* Backward compatible
* Production ready

Never break existing ERP functionality.

---

# Phase 0 — Architecture & Design

## Deliverables

Produce only documentation.

No coding.

Include

* Existing architecture analysis
* Current branch architecture
* Future franchise architecture
* Multi-tenant strategy
* Kafka strategy
* Database strategy
* Security model
* Authentication model
* Authorization model
* Provisioning workflow
* Disaster Recovery
* Backup strategy
* Upgrade strategy
* Migration strategy
* High-level diagrams
* Sequence diagrams
* ER diagrams
* API contracts

Deliverables

```
01-Architecture.md
02-Database.md
03-Kafka.md
04-API.md
05-Migration.md
06-Risks.md
```

---

# Phase 1 — Franchise Foundation

Goal

Introduce Franchise as a First-Class Entity.

Implement

* Franchise Master
* Franchise Relation
* Franchise Status
* Franchise Configuration
* Franchise Management UI
* Franchise APIs

Do NOT provision tenant yet.

Deliverables

Working Franchise Management.

---

# Phase 2 — Automatic Tenant Provisioning

Goal

Central ERP creates Franchise and provisions tenant automatically.

Implement

* Tenant creation
* Database provisioning
* Flyway migration
* Admin creation
* Default Roles
* Default Menus
* Financial Year
* Basic Masters
* Default Account Heads

Add Provisioning Dashboard

Show

* Pending
* Running
* Completed
* Failed

Support Retry.

---

# Phase 3 — Kafka Infrastructure

Goal

Tenant-to-Tenant Communication.

Design

Kafka Topics

Dead Letter Queue

Retry Queue

Idempotency

Event Store

Outbox Pattern

Monitoring

Health Check

Build

Kafka Producer

Kafka Consumer

Sync Dashboard

---

# Phase 4 — Master Data Synchronization

Implement synchronization for

* Item Master
* Category
* Tax
* UOM
* HSN
* Barcode
* Pricing
* Item Images
* Recipes (future ready)

Support

Incremental Sync

Full Sync

Manual Sync

Retry Sync

Conflict Resolution

---

# Phase 5 — Franchise Stock Transfer

Implement

Central

↓

Dispatch

↓

Transport

↓

Receive

↓

Stock Update

Features

Transfer Status

Approval

Short Receipt

Excess Receipt

Rejection

Cancellation

Transit Stock

Transfer Cost

Audit

---

# Phase 6 — Independent Franchise Operations

Enable Franchise to maintain

Own

* Purchase
* Suppliers
* Expenses
* Stock
* Payments
* Customers

Keep accounting isolated.

Central only sees summaries.

---

# Phase 7 — Consolidated Reporting

Reports

Central

↓

Franchise

↓

Consolidated

Include

Sales

Profit

Expenses

Inventory

Outstanding

Purchase

Transfer

Stock Ageing

Top Selling

Loss Analysis

---

# Phase 8 — Franchise Portal

Separate Portal

Dashboard

KPIs

Outstanding

Invoices

Stock

Replenishment

Orders

Announcements

Support Tickets

Training

Downloads

Messaging

Profile

Password

---

# Phase 9 — AI Integration

Now introduce AI.

AI Branch Manager

Should answer

"Why is sales down?"

"What should I reorder?"

"Which item is overstocked?"

"Which franchise performs best?"

"Compare profit."

"Predict next month's demand."

"Suggest transfer."

"Which supplier is cheapest?"

Build AI on top of the event architecture.

---

# Phase 10 — Administration

Central Dashboard

Manage

Tenants

Kafka

Health

Provisioning

Sync

Users

Licensing

Subscription

Database

Logs

Monitoring

Alerts

Audit

---

# Phase 11 — Enterprise Hardening

Security

Performance

Caching

Load Testing

Failover

Backup

Restore

Monitoring

Logging

Metrics

Documentation

Deployment

CI/CD

Acceptance Testing

---

# Development Rules

For every phase Claude must produce:

### 1. Design Document

No coding yet.

---

### 2. Database Changes

DDL

Migration

Indexes

Constraints

---

### 3. API Specification

REST endpoints

Request

Response

Validation

Errors

---

### 4. Kafka Specification

Topics

Messages

Retry

Ordering

Idempotency

Dead Letter Queue

---

### 5. UI Specification

Wireframes

Screens

Navigation

Permissions

Validation

---

### 6. Test Plan

Unit Tests

Integration Tests

Performance Tests

Migration Tests

Rollback Tests

---

### 7. Implementation

Only after approval.

---

# Important Architecture Rules

* Existing ERP must continue to function without modification.
* Existing branch-based customers must not be affected.
* Franchise functionality must be feature-flagged until enabled.
* All schema changes must use Flyway migrations.
* All cross-tenant communication must go through Kafka.
* All operations must be idempotent.
* Every change must be fully audited.
* Every phase must be production-ready before moving to the next.
* Do not skip the design phase for any module.

**Phase 3.5 – Common Event Framework**
## One additional recommendation

 
Instead of publishing events directly from business modules, create a generic **Enterprise Event Bus** with standardized event envelopes, versioning, correlation IDs, retries, and an outbox pattern. Every future module—including AI Branch Manager, mobile apps, analytics, notifications, and third-party integrations—can consume the same event stream. This will save significant refactoring later and aligns well with your long-term goal of building an AI-driven ERP platform.
 ## Common Event Framework Architecture

Before implementing Kafka sync directly inside franchise modules, design and implement a Common Event Framework.

This framework will become the standard event backbone for:

* Franchise sync
* Tenant provisioning
* Stock transfer
* Master data sync
* Sales summary sync
* Purchase summary sync
* Notifications
* Audit
* AI Branch Manager
* Future analytics

Current franchise requirements already depend heavily on Kafka-based tenant communication and sync events. Therefore, all Kafka communication must go through this common framework instead of direct producer/consumer logic inside each module.

### Core Principle

Business modules should not directly publish Kafka messages.

Instead:

Business Module
→ Enterprise Event Service
→ Outbox Table
→ Kafka Publisher
→ Kafka Topic
→ Consumer
→ Idempotency Check
→ Target Tenant Handler
→ Audit / Retry / DLQ

### Required Components

1. Enterprise Event Envelope

Every event must follow a standard format:

* event_id
* event_type
* event_version
* source_service
* source_tenant_id
* target_tenant_id
* entity_type
* entity_id
* correlation_id
* causation_id
* event_time
* payload
* metadata
* created_by
* retry_count

2. Event Store / Outbox Table

Create an outbox table:

* id
* event_id
* event_type
* event_version
* source_tenant_id
* target_tenant_id
* topic_name
* payload_json
* status
* retry_count
* error_message
* created_at
* published_at

Statuses:

* PENDING
* PUBLISHED
* FAILED
* RETRY_PENDING
* DEAD_LETTERED

3. Idempotency Table

Create a processed_event table:

* event_id
* consumer_name
* tenant_id
* processed_at
* status
* error_message

Same event must never be applied twice.

4. Event Publisher Service

Create a reusable service:

* publishEvent()
* publishTenantEvent()
* publishFranchiseEvent()
* retryFailedEvent()
* moveToDLQ()

5. Event Consumer Framework

All consumers should use a common base handler:

* Validate envelope
* Check idempotency
* Resolve tenant
* Execute business handler
* Mark event processed
* Audit result
* Retry or DLQ on failure

6. Topic Strategy

Use versioned topics:

* erp.v1.master.item
* erp.v1.master.category
* erp.v1.master.tax
* erp.v1.franchise.provisioning
* erp.v1.franchise.stock-transfer
* erp.v1.franchise.sales-summary
* erp.v1.franchise.purchase-summary
* erp.v1.audit
* erp.v1.notification
* erp.v1.ai-events

7. Error Handling

Support:

* automatic retry
* manual retry
* dead letter queue
* failure dashboard
* replay by event_id
* replay by tenant
* replay by date range

8. UI Requirement

Create Event Monitor screen:

* View all events
* Filter by tenant
* Filter by franchise
* Filter by event type
* Filter by status
* View payload
* View error message
* Retry failed event
* Replay event
* Move to dead letter
* View consumer status

9. AI Future Readiness

AI Branch Manager should not query only raw tables.

It should also consume business events like:

* SALES_COMPLETED
* PURCHASE_POSTED
* STOCK_TRANSFERRED
* EXPENSE_ENTERED
* DAY_END_CLOSED
* STOCK_LOW
* CREDIT_LIMIT_EXCEEDED
* FRANCHISE_SYNC_FAILED
* PROFIT_CALCULATED

This event history will help AI explain what happened, why it happened, and what action to take.

### Updated Phase Plan

Insert this as a mandatory phase:

## Phase 3.5 — Common Event Framework

Do this after Kafka Infrastructure and before Master Data Synchronization.

Deliverables:

* Event envelope design
* Outbox table
* Processed event table
* Event publisher service
* Common consumer base handler
* Retry mechanism
* DLQ handling
* Event Monitor UI
* Audit integration
* Sample event flow
* Unit and integration tests

No franchise sync module should be implemented before this framework is complete.

