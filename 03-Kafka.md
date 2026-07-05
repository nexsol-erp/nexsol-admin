# 03 — Kafka Design Document
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  

---

## 1. Current Kafka Infrastructure

### 1.1 Existing Configuration

```properties
spring.kafka.producer.bootstrap-servers=localhost:9092
spring.kafka.consumer.bootstrap-servers=localhost:9092
spring.kafka.template.default-topic=common-events
spring.kafka.consumer.group-id=BACKEND
spring.kafka.producer.properties.acks=all
spring.kafka.producer.retries=10
spring.kafka.producer.max-request-size=5242880   # 5 MB
spring.kafka.producer.buffer-memory=10485760     # 10 MB
spring.kafka.consumer.auto-commit-interval=100
```

### 1.2 Existing Topics and Classes

| Class | Type | Purpose |
|---|---|---|
| `AccountingEventPublisher` | Publisher | GL posting events after sales/purchase |
| `AccountingEventConsumer` | Consumer | Processes GL posting events |
| `PriceChangePublisher` | Publisher | Item price change events to POS |
| `ConnectionStatusConsumer` | Consumer | POS client heartbeat tracking |
| `AsyncGlDispatcher` | Dispatcher | Async dispatch of GL journal entries |

**Default topic**: `common-events` (all existing events share this topic — must be refactored to versioned topics in Phase 3.5)

---

## 2. Kafka Strategy for Franchise Module

### 2.1 Design Principles

1. **Business modules do not publish Kafka messages directly** — all events go through the Enterprise Event Service
2. **Outbox pattern** — events are first written to `enterprise_event_outbox` table in the same transaction, then a background publisher reads and sends them to Kafka. This prevents event loss on application crash.
3. **Idempotency** — every consumer checks `processed_event` before applying an event. Same event applied twice produces the same result.
4. **Versioned topics** — topic names follow `erp.v{N}.{domain}.{entity}` pattern to support zero-downtime schema evolution.
5. **Dead Letter Queue (DLQ)** — events that fail after max retries are moved to `.dlq` topics for manual inspection and replay.

### 2.2 Outbox Pattern Flow

```
Business Transaction (DB Transaction)
  ├── Save business record (e.g., ItemMst)
  └── Insert row into enterprise_event_outbox (same transaction)

Background Publisher (every 5 seconds)
  ├── SELECT * FROM enterprise_event_outbox WHERE status = 'PENDING'
  ├── Publish to Kafka topic
  ├── UPDATE status = 'PUBLISHED', published_at = NOW()
  └── On failure: UPDATE retry_count, status = 'RETRY_PENDING'

Kafka Consumer
  ├── Receive event
  ├── Check processed_event (idempotency)
  ├── If not processed: apply event → mark PROCESSED
  └── If already processed: skip → mark SKIPPED
```

---

## 3. Topic Strategy

### 3.1 Topic Naming Convention

```
erp.v{version}.{domain}.{entity-or-action}
erp.v{version}.{domain}.{entity-or-action}.dlq
```

### 3.2 Franchise Topics

| Topic | Purpose | Producer | Consumer(s) |
|---|---|---|---|
| `erp.v1.franchise.provisioning` | Tenant provisioning lifecycle events | Central | Provisioning service |
| `erp.v1.master.item` | Item master create/update/delete | Central | All franchise tenants |
| `erp.v1.master.category` | Category master sync | Central | All franchise tenants |
| `erp.v1.master.tax` | Tax master sync | Central | All franchise tenants |
| `erp.v1.master.uom` | Unit of measure sync | Central | All franchise tenants |
| `erp.v1.master.hsn` | HSN code sync | Central | All franchise tenants |
| `erp.v1.master.price` | Item pricing sync | Central | All franchise tenants |
| `erp.v1.franchise.stock-transfer` | Stock transfer from central to franchise | Central | Target franchise tenant |
| `erp.v1.franchise.sales-summary` | Daily/weekly sales summary from franchise | Franchise | Central |
| `erp.v1.franchise.purchase-summary` | Purchase summary from franchise | Franchise | Central |
| `erp.v1.franchise.stock-summary` | Stock position from franchise | Franchise | Central |
| `erp.v1.franchise.expense-summary` | Expense summary from franchise | Franchise | Central |
| `erp.v1.audit` | Audit trail for all operations | All | Audit service |
| `erp.v1.notification` | Notifications to users/systems | All | Notification service |
| `erp.v1.ai-events` | Business events for AI analysis | All | AI Branch Manager |

### 3.3 DLQ Topics (auto-created from above)

```
erp.v1.franchise.provisioning.dlq
erp.v1.master.item.dlq
erp.v1.master.category.dlq
erp.v1.master.tax.dlq
erp.v1.franchise.stock-transfer.dlq
erp.v1.franchise.sales-summary.dlq
```

---

## 4. Event Envelope — Standard Format

Every event published to any Kafka topic **must** follow this envelope structure. This is enforced by the Enterprise Event Service — no module publishes raw payloads.

### 4.1 Envelope Schema (JSON)

```json
{
  "eventId":       "550e8400-e29b-41d4-a716-446655440000",
  "eventType":     "ITEM_MASTER_UPDATED",
  "eventVersion":  "v1",
  "sourceService": "nexsol-backend",
  "sourceTenant":  "nexsol",
  "targetTenant":  "nexsol_frc_001",
  "entityType":    "ItemMst",
  "entityId":      "ITEM-0042",
  "correlationId": "7f3c92b0-1234-5678-abcd-ef0123456789",
  "causationId":   null,
  "eventTime":     "2026-07-05T10:30:00Z",
  "createdBy":     "admin-user",
  "retryCount":    0,
  "payload":       { ... event-specific data ... },
  "metadata":      { "appVersion": "2.5.0", "region": "IN" }
}
```

### 4.2 Field Definitions

| Field | Type | Description |
|---|---|---|
| `eventId` | UUID | Globally unique, used for idempotency |
| `eventType` | String | Event name in SCREAMING_SNAKE_CASE |
| `eventVersion` | String | Payload schema version (v1, v2, ...) |
| `sourceService` | String | Originating application |
| `sourceTenant` | String | Originating tenant database ID |
| `targetTenant` | String | Target tenant; null means broadcast to all |
| `entityType` | String | Entity being changed |
| `entityId` | String | Entity primary key or business key |
| `correlationId` | UUID | Request chain ID for distributed tracing |
| `causationId` | UUID | The event that caused this event (chain) |
| `eventTime` | ISO 8601 | When the business event occurred |
| `createdBy` | String | User or service that triggered the event |
| `retryCount` | Integer | How many times delivery was retried |
| `payload` | Object | Event-specific payload (see schemas below) |
| `metadata` | Object | Non-business context (app version, region) |

---

## 5. Event Payload Schemas

### 5.1 ITEM_MASTER_CREATED / ITEM_MASTER_UPDATED

```json
{
  "eventType": "ITEM_MASTER_UPDATED",
  "payload": {
    "itemCode":       "ITM001",
    "itemName":       "Chicken Biryani",
    "categoryCode":   "CAT-FOOD",
    "hsnCode":        "2106",
    "taxGroupCode":   "GST5",
    "uom":            "KG",
    "basePrice":      250.00,
    "mrp":            280.00,
    "isActive":       true,
    "barcodes":       ["8901234567890"],
    "imageUrl":       "https://cdn.nexsol.app/items/ITM001.jpg",
    "description":    "Full plate chicken biryani",
    "effectiveDate":  "2026-07-05"
  }
}
```

### 5.2 ITEM_MASTER_DELETED

```json
{
  "eventType": "ITEM_MASTER_DELETED",
  "payload": {
    "itemCode":       "ITM001",
    "deletedAt":      "2026-07-05T10:30:00Z",
    "reason":         "Discontinued"
  }
}
```

### 5.3 ITEM_PRICE_UPDATED

```json
{
  "eventType": "ITEM_PRICE_UPDATED",
  "payload": {
    "itemCode":       "ITM001",
    "pricingType":    "SELLING_PRICE",
    "newPrice":       260.00,
    "effectiveDate":  "2026-07-06",
    "franchiseCode":  "ALL"
  }
}
```

### 5.4 CATEGORY_MASTER_SYNCED

```json
{
  "eventType": "CATEGORY_MASTER_SYNCED",
  "payload": {
    "categoryCode":   "CAT-FOOD",
    "categoryName":   "Food Items",
    "parentCode":     null,
    "isActive":       true
  }
}
```

### 5.5 TAX_MASTER_SYNCED

```json
{
  "eventType": "TAX_MASTER_SYNCED",
  "payload": {
    "taxGroupCode":   "GST5",
    "taxGroupName":   "GST 5%",
    "taxLines": [
      { "type": "CGST", "rate": 2.5 },
      { "type": "SGST", "rate": 2.5 }
    ]
  }
}
```

### 5.6 FRANCHISE_TENANT_PROVISIONED

```json
{
  "eventType": "FRANCHISE_TENANT_PROVISIONED",
  "payload": {
    "franchiseId":    42,
    "franchiseCode":  "FRC-001",
    "franchiseName":  "Downtown Outlet",
    "tenantCode":     "nexsol_frc_001",
    "adminEmail":     "admin@frc001.nexsol.app",
    "provisionedAt":  "2026-07-05T10:30:00Z"
  }
}
```

### 5.7 STOCK_TRANSFER_DISPATCHED (Central → Franchise)

```json
{
  "eventType": "STOCK_TRANSFER_DISPATCHED",
  "payload": {
    "transferNo":     "TRF-2026-0001",
    "franchiseCode":  "FRC-001",
    "dispatchDate":   "2026-07-05",
    "vehicleNumber":  "KA01AB1234",
    "items": [
      {
        "itemCode":       "ITM001",
        "itemName":       "Chicken Biryani",
        "uom":            "KG",
        "dispatchedQty":  50.00,
        "unitPrice":      200.00,
        "batchNo":        "BATCH-2026-07"
      }
    ],
    "totalValue":     10000.00,
    "transportCharges": 500.00
  }
}
```

### 5.8 SALES_SUMMARY_PUBLISHED (Franchise → Central)

```json
{
  "eventType": "SALES_SUMMARY_PUBLISHED",
  "payload": {
    "franchiseCode":  "FRC-001",
    "summaryDate":    "2026-07-05",
    "periodType":     "DAILY",
    "totalSales":     45000.00,
    "totalTax":       2000.00,
    "totalDiscount":  500.00,
    "netSales":       42500.00,
    "invoiceCount":   120,
    "topItems": [
      { "itemCode": "ITM001", "quantity": 45, "amount": 11250.00 }
    ]
  }
}
```

### 5.9 STOCK_SUMMARY_PUBLISHED (Franchise → Central)

```json
{
  "eventType": "STOCK_SUMMARY_PUBLISHED",
  "payload": {
    "franchiseCode":  "FRC-001",
    "asOfDate":       "2026-07-05",
    "items": [
      {
        "itemCode":       "ITM001",
        "closingStock":   25.5,
        "uom":            "KG",
        "stockValue":     6375.00
      }
    ]
  }
}
```

---

## 6. Consumer Group Strategy

| Consumer Group | Subscribes To | Purpose |
|---|---|---|
| `central-provisioning` | `erp.v1.franchise.provisioning` | Central provisioning lifecycle |
| `central-summary-receiver` | `erp.v1.franchise.sales-summary`, `erp.v1.franchise.purchase-summary`, `erp.v1.franchise.stock-summary`, `erp.v1.franchise.expense-summary` | Aggregate franchise summaries |
| `franchise-master-sync` | `erp.v1.master.*` | Apply master data to franchise DB |
| `franchise-transfer-receiver` | `erp.v1.franchise.stock-transfer` | Apply stock transfers in franchise DB |
| `audit-consumer` | `erp.v1.audit` | Write audit records |
| `notification-consumer` | `erp.v1.notification` | Send notifications |
| `ai-event-consumer` | `erp.v1.ai-events` | Feed AI Branch Manager event stream |

---

## 7. Idempotency Strategy

### 7.1 Consumer-Side Idempotency Check

Every consumer must perform this check before applying any event:

```java
// Pseudocode — Common Consumer Base Handler
public void handleEvent(EnterpriseEventEnvelope event) {
    String eventId = event.getEventId();
    String consumerName = this.getClass().getSimpleName();
    String tenantId = TenantContext.getCurrentTenant();

    if (processedEventRepo.exists(eventId, consumerName, tenantId)) {
        log.info("Skipping already processed event: {}", eventId);
        return;
    }

    try {
        doHandle(event);  // actual business logic
        processedEventRepo.markProcessed(eventId, consumerName, tenantId, "PROCESSED");
    } catch (Exception e) {
        processedEventRepo.markProcessed(eventId, consumerName, tenantId, "FAILED");
        throw e;
    }
}
```

### 7.2 Producer-Side Idempotency

- Kafka producer configured with `enable.idempotence=true`
- Kafka producer `acks=all` for guaranteed delivery
- Outbox ensures each business event is published exactly once

---

## 8. Retry and Dead Letter Queue

### 8.1 Retry Strategy

| Attempt | Delay | Action |
|---|---|---|
| 1st retry | 30 seconds | Immediate retry |
| 2nd retry | 2 minutes | Short delay |
| 3rd retry | 10 minutes | Medium delay |
| 4th retry | 30 minutes | Long delay |
| 5th retry | 60 minutes | Final attempt |
| After 5 failures | — | Move to DLQ |

### 8.2 Retry Implementation

Retries are managed by the outbox poller:
```sql
-- Outbox poller query (runs every 30 seconds)
SELECT * FROM enterprise_event_outbox
WHERE status IN ('PENDING', 'RETRY_PENDING')
  AND retry_count < max_retries
  AND scheduled_at <= NOW()
ORDER BY created_at ASC
LIMIT 100;
```

On failure:
```sql
UPDATE enterprise_event_outbox
SET status = 'RETRY_PENDING',
    retry_count = retry_count + 1,
    scheduled_at = NOW() + INTERVAL '30 minutes',  -- exponential
    error_message = :errorMessage
WHERE event_id = :eventId;
```

### 8.3 DLQ Processing

Events moved to DLQ:
- Appear in Event Monitor UI with `DEAD_LETTERED` status
- Can be manually replayed by central admin
- Can be replayed by event_id, by tenant, or by date range
- Must be investigated — not auto-replayed

---

## 9. Ordering Guarantees

Kafka guarantees ordering within a partition. The following keying strategy ensures related events are ordered:

| Topic | Partition Key | Reason |
|---|---|---|
| `erp.v1.master.item` | `itemCode` | All item events in order |
| `erp.v1.master.category` | `categoryCode` | Category events ordered |
| `erp.v1.franchise.stock-transfer` | `franchiseCode` | Transfers per franchise in order |
| `erp.v1.franchise.sales-summary` | `franchiseCode + date` | Summary events ordered per franchise |
| `erp.v1.franchise.provisioning` | `franchiseId` | Provisioning lifecycle ordered |

---

## 10. Topic Configuration

```properties
# Partitions and replication per topic
erp.v1.master.item                  partitions=6,  replication=1
erp.v1.master.category              partitions=3,  replication=1
erp.v1.master.tax                   partitions=3,  replication=1
erp.v1.master.uom                   partitions=3,  replication=1
erp.v1.master.hsn                   partitions=3,  replication=1
erp.v1.master.price                 partitions=6,  replication=1
erp.v1.franchise.provisioning       partitions=3,  replication=1
erp.v1.franchise.stock-transfer     partitions=6,  replication=1
erp.v1.franchise.sales-summary      partitions=6,  replication=1
erp.v1.franchise.purchase-summary   partitions=6,  replication=1
erp.v1.franchise.stock-summary      partitions=6,  replication=1
erp.v1.franchise.expense-summary    partitions=6,  replication=1
erp.v1.audit                        partitions=12, replication=1
erp.v1.notification                 partitions=3,  replication=1
erp.v1.ai-events                    partitions=6,  replication=1

# Retention
log.retention.hours=168             # 7 days
log.retention.bytes=-1              # unlimited
```

*(Increase replication factor to 3 in production cluster)*

---

## 11. Monitoring and Health Check

### 11.1 Metrics to Monitor

| Metric | Alert Threshold | Tool |
|---|---|---|
| Consumer lag per topic | > 1000 messages | Kafka JMX / Kafdrop |
| Outbox PENDING count | > 500 rows | Application metric |
| Outbox RETRY_PENDING count | > 100 rows | Application metric |
| DLQ message count | > 0 | Application metric → alert |
| Producer error rate | > 1% | Kafka JMX |
| Event processing time | > 5 seconds | Spring Micrometer |

### 11.2 Health Endpoint

```
GET /api/internal/kafka/health

Response:
{
  "status": "UP",
  "outboxPendingCount": 3,
  "outboxRetryCount": 0,
  "dlqCount": 0,
  "consumerLag": {
    "erp.v1.master.item": 0,
    "erp.v1.franchise.sales-summary": 12
  }
}
```

---

## 12. Event Monitor UI (Required — Phase 3.5)

The Event Monitor screen must support:

| Feature | Detail |
|---|---|
| View all events | Paginated list with filters |
| Filter by source tenant | Central or specific franchise |
| Filter by target tenant | Specific franchise |
| Filter by event type | Any event type from the list |
| Filter by status | PENDING / PUBLISHED / FAILED / DEAD_LETTERED |
| Filter by date range | From / To date |
| View payload | Pretty-printed JSON |
| View error message | Full error trace |
| Retry single event | Re-queue to outbox |
| Replay by date range | Re-publish all events from a period |
| Move to DLQ | Manual override |
| Consumer lag view | Per topic, per consumer group |

---

## 13. AI Event Integration

The following business events must be published to `erp.v1.ai-events` to enable the AI Branch Manager (Phase 9):

| Event Type | Trigger |
|---|---|
| `SALES_COMPLETED` | POS sale finalized |
| `PURCHASE_POSTED` | Purchase posted to accounts |
| `STOCK_TRANSFERRED` | Transfer dispatched or received |
| `EXPENSE_ENTERED` | Expense entry saved |
| `DAY_END_CLOSED` | Day-end process completed |
| `STOCK_LOW` | Item falls below reorder level |
| `CREDIT_LIMIT_EXCEEDED` | Customer credit limit breached |
| `FRANCHISE_SYNC_FAILED` | Any sync event fails after retries |
| `PROFIT_CALCULATED` | Period P&L calculation completed |
| `ITEM_MASTER_SYNCED` | Item pushed from central to franchise |

The AI service at `http://localhost:8000` will consume these events and build its understanding of business patterns over time.

---

*This document must be read alongside 01-Architecture.md (outbox pattern decisions) and 02-Database.md (outbox and idempotency table schemas) for a complete understanding of the event infrastructure.*
