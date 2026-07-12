# 04 — API Specification Document
## Nexsol ERP — Franchise Module (Phase 0)

**Version**: 1.0  
**Date**: 2026-07-05  
**Status**: Draft — Awaiting Approval  

---

## 1. API Design Principles

1. **REST** — all endpoints follow REST conventions
2. **Base path**: `/api/{tenantId}/franchise/...` for franchise management (central tenant)
3. **Base path**: `/api/{tenantId}/sync/...` for sync status and control
4. **Authentication**: All endpoints require `Authorization: Bearer {JWT}` header
5. **Tenant isolation**: The `{tenantId}` in the URL is validated against the JWT `tenant` claim
6. **Feature flag check**: All franchise endpoints return `403` if `feature_franchise_enabled = false`
7. **Response format**: Standard JSON envelope (see Section 2)
8. **Pagination**: All list endpoints support `page`, `size`, `sort` query parameters
9. **Validation errors**: `400` with field-level error details
10. **Audit**: All mutating endpoints are audit-logged

---

## 2. Standard Response Envelope

### 2.1 Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Franchise created successfully",
  "timestamp": "2026-07-05T10:30:00Z"
}
```

### 2.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "FRANCHISE_CODE_DUPLICATE",
    "message": "Franchise code FRC-001 already exists",
    "details": [
      { "field": "franchiseCode", "message": "Must be unique" }
    ]
  },
  "timestamp": "2026-07-05T10:30:00Z"
}
```

### 2.3 Paginated List Response

```json
{
  "success": true,
  "data": {
    "content": [ ... ],
    "page": 0,
    "size": 20,
    "totalElements": 150,
    "totalPages": 8,
    "first": true,
    "last": false
  },
  "timestamp": "2026-07-05T10:30:00Z"
}
```

---

## 3. Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `FRANCHISE_NOT_FOUND` | 404 | Franchise ID does not exist |
| `FRANCHISE_CODE_DUPLICATE` | 400 | Franchise code already in use |
| `FRANCHISE_INVALID_STATUS` | 400 | Status transition not allowed |
| `FRANCHISE_FEATURE_DISABLED` | 403 | Franchise module not enabled for this tenant |
| `PROVISIONING_IN_PROGRESS` | 409 | Provisioning already running |
| `PROVISIONING_FAILED` | 500 | Internal provisioning error |
| `TENANT_CREATION_FAILED` | 500 | Could not create PostgreSQL database |
| `SYNC_NOT_FOUND` | 404 | Sync event not found |
| `EVENT_REPLAY_LIMIT` | 429 | Too many replay requests |
| `UNAUTHORIZED` | 401 | JWT missing or invalid |
| `FORBIDDEN` | 403 | Insufficient role for this operation |
| `VALIDATION_ERROR` | 400 | Request body validation failed |

---

## 4. Franchise Management APIs

### 4.1 Create Franchise

```
POST /api/{tenantId}/franchise
Role Required: CENTRAL_ADMIN
```

**Request Body**:
```json
{
  "franchiseCode":      "FRC-001",
  "franchiseName":      "Downtown Outlet",
  "franchiseType":      "STANDARD",
  "addressLine1":       "42 MG Road",
  "addressLine2":       "Ground Floor",
  "city":               "Bangalore",
  "state":              "Karnataka",
  "pincode":            "560001",
  "country":            "INDIA",
  "gstNumber":          "29AAAAA0000A1Z5",
  "panNumber":          "AAAAA0000A",
  "contactPerson":      "John Doe",
  "contactPhone":       "+91-9876543210",
  "contactEmail":       "john@frc001.com",
  "agreementDate":      "2026-01-01",
  "agreementExpiry":    "2031-01-01",
  "royaltyPercentage":  5.0,
  "territory":          "South Bangalore — MG Road Area"
}
```

**Validation Rules**:
- `franchiseCode`: required, 3–20 chars, alphanumeric + hyphen, unique
- `franchiseName`: required, 3–200 chars
- `franchiseType`: required, one of `STANDARD | PREMIUM | MASTER`
- `gstNumber`: optional, must match GST regex if provided
- `contactEmail`: optional, must be valid email

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "franchiseCode": "FRC-001",
    "franchiseName": "Downtown Outlet",
    "status": "DRAFT"
  },
  "message": "Franchise created successfully"
}
```

---

### 4.2 Get Franchise

```
GET /api/{tenantId}/franchise/{id}
Role Required: FRANCHISE_VIEWER and above
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "franchiseCode": "FRC-001",
    "franchiseName": "Downtown Outlet",
    "franchiseType": "STANDARD",
    "status": "ACTIVE",
    "tenantCode": "nexsol_frc_001",
    "addressLine1": "42 MG Road",
    "city": "Bangalore",
    "state": "Karnataka",
    "gstNumber": "29AAAAA0000A1Z5",
    "contactPerson": "John Doe",
    "contactPhone": "+91-9876543210",
    "contactEmail": "john@frc001.com",
    "agreementDate": "2026-01-01",
    "agreementExpiry": "2031-01-01",
    "royaltyPercentage": 5.0,
    "provisionedAt": "2026-07-05T10:30:00Z",
    "activatedAt": "2026-07-05T10:35:00Z",
    "createdAt": "2026-07-05T09:00:00Z",
    "createdBy": "admin"
  }
}
```

---

### 4.3 List Franchises

```
GET /api/{tenantId}/franchise?status=ACTIVE&page=0&size=20&sort=franchiseName,asc
Role Required: FRANCHISE_VIEWER and above
```

**Query Parameters**:
| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | String | — | Filter by status |
| `franchiseType` | String | — | Filter by type |
| `city` | String | — | Filter by city |
| `search` | String | — | Search in code, name, contact |
| `page` | Integer | 0 | Page number |
| `size` | Integer | 20 | Page size (max 100) |
| `sort` | String | `franchiseName,asc` | Sort field and direction |

**Response** `200 OK`: (paginated list — see Section 2.3)

---

### 4.4 Update Franchise

```
PUT /api/{tenantId}/franchise/{id}
Role Required: FRANCHISE_ADMIN
```

**Request Body**: Same as Create, all fields optional.  
Cannot update `franchiseCode` or `status` via this endpoint.

**Response** `200 OK`:
```json
{ "success": true, "data": { ... updated franchise ... } }
```

---

### 4.5 Get Franchise Status

```
GET /api/{tenantId}/franchise/{id}/status
Role Required: FRANCHISE_VIEWER and above
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "franchiseId": 42,
    "franchiseCode": "FRC-001",
    "currentStatus": "ACTIVE",
    "tenantCode": "nexsol_frc_001",
    "provisioningSteps": [
      { "step": "CREATE_DB",        "status": "COMPLETED", "completedAt": "2026-07-05T10:31:00Z" },
      { "step": "RUN_MIGRATIONS",   "status": "COMPLETED", "completedAt": "2026-07-05T10:32:00Z" },
      { "step": "CREATE_ADMIN",     "status": "COMPLETED", "completedAt": "2026-07-05T10:32:30Z" },
      { "step": "CREATE_ROLES",     "status": "COMPLETED", "completedAt": "2026-07-05T10:33:00Z" },
      { "step": "CREATE_MENUS",     "status": "COMPLETED", "completedAt": "2026-07-05T10:33:10Z" },
      { "step": "CREATE_FY",        "status": "COMPLETED", "completedAt": "2026-07-05T10:33:20Z" },
      { "step": "CREATE_ACCOUNTS",  "status": "COMPLETED", "completedAt": "2026-07-05T10:33:30Z" },
      { "step": "SYNC_ITEMS",       "status": "COMPLETED", "completedAt": "2026-07-05T10:34:00Z" },
      { "step": "ACTIVATE",         "status": "COMPLETED", "completedAt": "2026-07-05T10:35:00Z" }
    ]
  }
}
```

---

## 5. Provisioning APIs

### 5.1 Trigger Provisioning

```
POST /api/{tenantId}/franchise/{id}/provision
Role Required: CENTRAL_ADMIN
```

**Request Body** (optional):
```json
{
  "adminEmail":     "admin@frc001.com",
  "adminPassword":  "Temp@1234",
  "dbHost":         "localhost",
  "dbPort":         5432
}
```

**Response** `202 Accepted`:
```json
{
  "success": true,
  "data": {
    "franchiseId": 42,
    "status": "PROVISIONING",
    "message": "Provisioning started. Track progress at /franchise/42/status"
  }
}
```

**Error** `409 Conflict` (already provisioning):
```json
{
  "success": false,
  "error": {
    "code": "PROVISIONING_IN_PROGRESS",
    "message": "Provisioning is already running for this franchise"
  }
}
```

---

### 5.2 Retry Failed Provisioning

```
POST /api/{tenantId}/franchise/{id}/provision/retry
Role Required: CENTRAL_ADMIN
```

Retries provisioning from the first failed step.

**Response** `202 Accepted`: same as 5.1

---

### 5.3 Rollback / Cancel Provisioning

```
POST /api/{tenantId}/franchise/{id}/provision/rollback
Role Required: CENTRAL_ADMIN
```

Drops the franchise database and clears the tenant registry entry. Only allowed when status is `PROVISIONING_FAILED`.

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "franchiseId": 42,
    "status": "DRAFT",
    "message": "Provisioning rolled back. Franchise reset to DRAFT."
  }
}
```

---

### 5.4 Suspend Franchise

```
POST /api/{tenantId}/franchise/{id}/suspend
Role Required: CENTRAL_ADMIN
```

**Request Body**:
```json
{ "reason": "Agreement violation — pending review" }
```

**Response** `200 OK`:
```json
{ "success": true, "data": { "status": "SUSPENDED" } }
```

---

### 5.5 Reactivate Franchise

```
POST /api/{tenantId}/franchise/{id}/reactivate
Role Required: CENTRAL_ADMIN
```

**Response** `200 OK`:
```json
{ "success": true, "data": { "status": "ACTIVE" } }
```

---

### 5.6 Terminate Franchise

```
POST /api/{tenantId}/franchise/{id}/terminate
Role Required: CENTRAL_ADMIN
```

**Request Body**:
```json
{ "reason": "Agreement expired", "retainData": true }
```

- `retainData: true` — database is kept, tenant_registry marked TERMINATED
- `retainData: false` — database is dropped after 30-day grace period

**Response** `200 OK`:
```json
{ "success": true, "data": { "status": "TERMINATED" } }
```

---

## 6. Provisioning Dashboard API

### 6.1 Dashboard Summary

```
GET /api/{tenantId}/franchise/provisioning/dashboard
Role Required: FRANCHISE_ADMIN
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "total":              10,
    "draft":              2,
    "provisioning":       1,
    "active":             6,
    "provisioningFailed": 1,
    "suspended":          0,
    "terminated":         0,
    "recentActivity": [
      {
        "franchiseId":   42,
        "franchiseCode": "FRC-001",
        "action":        "ACTIVATED",
        "at":            "2026-07-05T10:35:00Z"
      }
    ]
  }
}
```

---

## 7. Master Data Sync APIs

### 7.1 Trigger Full Item Sync to All Franchises

```
POST /api/{tenantId}/sync/items/full
Role Required: CENTRAL_ADMIN
```

Publishes current item master snapshot to `erp.v1.master.item` for all active franchise tenants.

**Response** `202 Accepted`:
```json
{
  "success": true,
  "data": {
    "jobId": "SYNC-2026-07-05-001",
    "itemCount": 1250,
    "franchiseCount": 6,
    "status": "QUEUED"
  }
}
```

---

### 7.2 Trigger Sync to Specific Franchise

```
POST /api/{tenantId}/sync/items/franchise/{franchiseId}
Role Required: FRANCHISE_ADMIN
```

**Response** `202 Accepted`: same as 7.1

---

### 7.3 Sync Status

```
GET /api/{tenantId}/sync/status/{jobId}
Role Required: FRANCHISE_VIEWER and above
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "jobId":          "SYNC-2026-07-05-001",
    "status":         "COMPLETED",
    "totalEvents":    7500,
    "publishedEvents":7500,
    "failedEvents":   0,
    "startedAt":      "2026-07-05T10:30:00Z",
    "completedAt":    "2026-07-05T10:31:45Z"
  }
}
```

---

## 8. Event Monitor APIs

### 8.1 List Outbox Events

```
GET /api/{tenantId}/events/outbox?status=FAILED&page=0&size=20
Role Required: CENTRAL_ADMIN
```

**Query Parameters**: `status`, `eventType`, `sourceTenant`, `targetTenant`, `from`, `to`, `page`, `size`

---

### 8.2 Get Event Detail

```
GET /api/{tenantId}/events/outbox/{eventId}
Role Required: CENTRAL_ADMIN
```

**Response** includes full payload JSON and error trace.

---

### 8.3 Retry Event

```
POST /api/{tenantId}/events/outbox/{eventId}/retry
Role Required: CENTRAL_ADMIN
```

Resets `retry_count` and `status = PENDING` for the event.

---

### 8.4 Move to DLQ

```
POST /api/{tenantId}/events/outbox/{eventId}/dlq
Role Required: CENTRAL_ADMIN
```

---

### 8.5 Replay Events by Date Range

```
POST /api/{tenantId}/events/replay
Role Required: CENTRAL_ADMIN
```

**Request Body**:
```json
{
  "eventType":    "ITEM_MASTER_UPDATED",
  "targetTenant": "nexsol_frc_001",
  "from":         "2026-07-01T00:00:00Z",
  "to":           "2026-07-05T23:59:59Z"
}
```

---

## 9. Franchise Consolidated Reporting APIs

### 9.1 Consolidated Sales Report

```
GET /api/{tenantId}/reports/franchise/sales?from=2026-07-01&to=2026-07-05&franchiseId=42
Role Required: FRANCHISE_VIEWER
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "from": "2026-07-01",
    "to": "2026-07-05",
    "franchiseSummaries": [
      {
        "franchiseId":    42,
        "franchiseCode":  "FRC-001",
        "franchiseName":  "Downtown Outlet",
        "totalSales":     225000.00,
        "totalTax":       10000.00,
        "totalDiscount":  2500.00,
        "netSales":       212500.00,
        "invoiceCount":   600
      }
    ],
    "grandTotal": {
      "totalSales":   680000.00,
      "netSales":     640000.00,
      "invoiceCount": 1800
    }
  }
}
```

---

### 9.2 Consolidated Stock Report

```
GET /api/{tenantId}/reports/franchise/stock?asOfDate=2026-07-05&franchiseId=42
Role Required: FRANCHISE_VIEWER
```

---

### 9.3 Franchise KPI Dashboard

```
GET /api/{tenantId}/reports/franchise/kpi?period=MONTHLY&year=2026&month=7
Role Required: FRANCHISE_VIEWER
```

Returns top-performing franchises, revenue comparison, stock efficiency, outstanding balances.

---

## 10. Stock Transfer APIs

### 10.1 Create Transfer Order

```
POST /api/{tenantId}/franchise/stock-transfer
Role Required: FRANCHISE_ADMIN
```

**Request Body**:
```json
{
  "franchiseId":      42,
  "transferDate":     "2026-07-05",
  "sourceBranchCode": "MAIN",
  "notes":            "Weekly replenishment",
  "items": [
    {
      "itemCode":      "ITM001",
      "uom":           "KG",
      "dispatchedQty": 50.0,
      "unitPrice":     200.0,
      "batchNo":       "BATCH-2026-07"
    }
  ]
}
```

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "transferNo": "TRF-2026-0001",
    "status": "DRAFT"
  }
}
```

---

### 10.2 Approve Transfer

```
POST /api/{tenantId}/franchise/stock-transfer/{transferNo}/approve
Role Required: FRANCHISE_ADMIN
```

---

### 10.3 Dispatch Transfer

```
POST /api/{tenantId}/franchise/stock-transfer/{transferNo}/dispatch
Role Required: FRANCHISE_ADMIN
```

**Request Body**:
```json
{
  "vehicleNumber": "KA01AB1234",
  "driverName":    "Raju",
  "dispatchDate":  "2026-07-05"
}
```

Publishes `STOCK_TRANSFER_DISPATCHED` event to Kafka → franchise tenant receives and books stock.

---

### 10.4 Receive Transfer (Franchise Side)

```
POST /api/{franchiseTenantId}/franchise/stock-transfer/{transferNo}/receive
Role Required: FRANCHISE_OPERATOR (franchise tenant)
```

**Request Body**:
```json
{
  "receivedDate": "2026-07-06",
  "items": [
    {
      "itemCode":     "ITM001",
      "receivedQty":  48.5,
      "rejectedQty":  1.5,
      "remarks":      "1.5 KG damaged in transit"
    }
  ]
}
```

Publishes `STOCK_TRANSFER_RECEIVED` event back to central.

---

### 10.5 List Transfers

```
GET /api/{tenantId}/franchise/stock-transfer?franchiseId=42&status=DISPATCHED
Role Required: FRANCHISE_VIEWER and above
```

---

## 11. Configuration API

### 11.1 Get Franchise Config

```
GET /api/{tenantId}/franchise/{id}/config
Role Required: FRANCHISE_ADMIN
```

---

### 11.2 Set Franchise Config

```
PUT /api/{tenantId}/franchise/{id}/config
Role Required: CENTRAL_ADMIN
```

**Request Body**:
```json
{
  "configs": [
    { "key": "max_credit_days", "value": "30", "type": "NUMBER" },
    { "key": "allow_own_suppliers", "value": "true", "type": "BOOLEAN" },
    { "key": "royalty_calculation", "value": "NET_SALES", "type": "STRING" }
  ]
}
```

---

## 12. API Summary Table

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/franchise` | CENTRAL_ADMIN | Create franchise |
| GET | `/franchise/{id}` | FRANCHISE_VIEWER | Get franchise details |
| GET | `/franchise` | FRANCHISE_VIEWER | List franchises |
| PUT | `/franchise/{id}` | FRANCHISE_ADMIN | Update franchise |
| GET | `/franchise/{id}/status` | FRANCHISE_VIEWER | Get provisioning status |
| POST | `/franchise/{id}/provision` | CENTRAL_ADMIN | Trigger provisioning |
| POST | `/franchise/{id}/provision/retry` | CENTRAL_ADMIN | Retry provisioning |
| POST | `/franchise/{id}/provision/rollback` | CENTRAL_ADMIN | Rollback provisioning |
| POST | `/franchise/{id}/suspend` | CENTRAL_ADMIN | Suspend franchise |
| POST | `/franchise/{id}/reactivate` | CENTRAL_ADMIN | Reactivate franchise |
| POST | `/franchise/{id}/terminate` | CENTRAL_ADMIN | Terminate franchise |
| GET | `/franchise/provisioning/dashboard` | FRANCHISE_ADMIN | Dashboard summary |
| POST | `/sync/items/full` | CENTRAL_ADMIN | Full item sync |
| POST | `/sync/items/franchise/{id}` | FRANCHISE_ADMIN | Sync to one franchise |
| GET | `/sync/status/{jobId}` | FRANCHISE_VIEWER | Sync job status |
| GET | `/events/outbox` | CENTRAL_ADMIN | List outbox events |
| GET | `/events/outbox/{id}` | CENTRAL_ADMIN | Event detail |
| POST | `/events/outbox/{id}/retry` | CENTRAL_ADMIN | Retry event |
| POST | `/events/outbox/{id}/dlq` | CENTRAL_ADMIN | Move to DLQ |
| POST | `/events/replay` | CENTRAL_ADMIN | Replay events |
| GET | `/reports/franchise/sales` | FRANCHISE_VIEWER | Consolidated sales |
| GET | `/reports/franchise/stock` | FRANCHISE_VIEWER | Consolidated stock |
| GET | `/reports/franchise/kpi` | FRANCHISE_VIEWER | KPI dashboard |
| POST | `/franchise/stock-transfer` | FRANCHISE_ADMIN | Create transfer |
| POST | `/franchise/stock-transfer/{no}/approve` | FRANCHISE_ADMIN | Approve transfer |
| POST | `/franchise/stock-transfer/{no}/dispatch` | FRANCHISE_ADMIN | Dispatch transfer |
| POST | `/franchise/stock-transfer/{no}/receive` | FRANCHISE_OPERATOR | Receive at franchise |
| GET | `/franchise/stock-transfer` | FRANCHISE_VIEWER | List transfers |
| GET | `/franchise/{id}/config` | FRANCHISE_ADMIN | Get config |
| PUT | `/franchise/{id}/config` | CENTRAL_ADMIN | Set config |

*All paths are relative to `/api/{tenantId}/`*

---

*This API specification is the contract between the frontend team and the backend team. All implementations must match these request/response schemas exactly. Version the APIs (`/v2/...`) rather than breaking existing contracts.*
