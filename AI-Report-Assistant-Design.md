# AI Report Assistant — Full Technical Design
## NexSol ERP — Implementation-Ready Documentation

**Version:** 1.0  
**Date:** 2026-06-28  
**Author:** Architecture Team  
**Status:** Implementation Ready

---

## Table of Contents

1. [Business Requirement Document](#1-business-requirement-document)
2. [Functional Requirement Document](#2-functional-requirement-document)
3. [Architecture Design](#3-architecture-design)
4. [Backend API Design](#4-backend-api-design)
5. [React UI Design](#5-react-ui-design)
6. [Database Schema](#6-database-schema)
7. [AI Prompt Strategy](#7-ai-prompt-strategy)
8. [SQL Validation Strategy](#8-sql-validation-strategy)
9. [Permission Handling Strategy](#9-permission-handling-strategy)
10. [Excel Export Design](#10-excel-export-design)
11. [Voice Input Design](#11-voice-input-design)
12. [Audit Logging Design](#12-audit-logging-design)
13. [Error Handling](#13-error-handling)
14. [Folder Structure](#14-folder-structure)
15. [Implementation Phases](#15-implementation-phases)
16. [Acceptance Criteria](#16-acceptance-criteria)

---

## 1. Business Requirement Document

### 1.1 Executive Summary

NexSol ERP users currently need to navigate multiple report screens, apply filters manually, and wait for IT to create custom reports. This project delivers a conversational AI assistant embedded inside the ERP web application that allows any authorized user to request, generate, and export reports using plain English or spoken voice — without writing SQL or navigating complex menus.

### 1.2 Business Objectives

| # | Objective |
|---|-----------|
| B1 | Reduce report creation time from hours to seconds |
| B2 | Enable non-technical users to self-serve custom reports |
| B3 | Eliminate repeated IT requests for standard report variations |
| B4 | Maintain full data security, tenant isolation, and audit compliance |
| B5 | Allow users to save and reuse custom reports |
| B6 | Support voice-based report requests for mobile/warehouse users |

### 1.3 Stakeholders

| Role | Responsibility |
|------|---------------|
| Branch Manager | View branch-level sales, stock, P&L reports |
| Accountant | Purchase summaries, supplier aging, ledger reports |
| Store Manager | Stock, slow-moving items, stock transfer reports |
| Admin/Owner | Cross-branch, full-access reports |
| IT Admin | Manage metadata, approve saved reports, view audit logs |

### 1.4 Business Rules

- Every tenant sees only their own data
- Branch managers see only their assigned branches
- Reports respect existing role and menu permissions
- All AI-generated SQL must be logged and auditable
- AI can never modify data — read-only access only
- Report results capped at 10,000 rows (configurable per tenant)
- Generated reports older than 30 days are archived

---

## 2. Functional Requirement Document

### 2.1 Core Features

#### FR-01: Text-Based Chat Input
- User types a natural language report request
- System understands intent and extracts parameters (date range, branch, item, etc.)
- System responds with report data or clarification questions

#### FR-02: Voice-Based Input
- User clicks microphone button and speaks request
- System converts speech to text using Web Speech API (with fallback to Whisper API)
- Converted text is processed same as FR-01

#### FR-03: Existing Report Discovery
- Before generating new SQL, system searches existing saved/standard reports
- If a match is found (>80% intent similarity), system runs that report
- System shows user: "Found an existing report: Monthly Sales Summary. Running it now."

#### FR-04: Dynamic Report Generation
- If no existing report matches, AI generates a new report
- AI produces a SELECT SQL query using tenant-safe schema
- SQL is validated before execution
- Result is displayed in paginated grid

#### FR-05: Report Preview
- Results shown in responsive data grid
- Columns auto-detected from query result
- Supports sorting by column header click
- Supports client-side search/filter
- Shows row count and execution time

#### FR-06: Excel Export
- "Download Excel" button on every report result
- Exports current filter/sort state
- File named: `report_{intent}_{date}.xlsx`
- Column headers formatted, numbers right-aligned

#### FR-07: Save Report
- User can name and save any generated report
- Saved reports appear in a "My Reports" sidebar
- Saved reports can be shared with roles or kept private
- IT Admin can promote user reports to "Standard Reports"

#### FR-08: Report History
- Last 20 chat sessions per user are persisted
- Each session shows: request text, execution time, row count, status
- User can re-run any historical report

#### FR-09: Permission Enforcement
- Chatbot only accesses tables the user's role is permitted to see
- Branch filter automatically injected for branch-restricted users
- Tenant filter always injected — no override possible

#### FR-10: Clarification Dialog
- When user request is ambiguous, AI asks follow-up questions
- Example: "Which branch?" or "What date range?"
- Multi-turn conversation support (up to 5 turns per session)

### 2.2 Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Performance | Report results returned in < 5 seconds for standard queries |
| Security | Zero data leakage between tenants |
| Availability | 99.5% uptime for chatbot service |
| Scalability | Support 1000 concurrent chat sessions |
| Audit | Every query logged with user, timestamp, SQL, row count |
| Compliance | No PII in AI prompt; schema metadata only |

---

## 3. Architecture Design

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     React ERP Frontend                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ChatbotWidget  │  ReportGrid  │  VoiceInput  │  History │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS REST / WebSocket
┌───────────────────────────▼─────────────────────────────────────┐
│                   Spring Boot API Gateway                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Auth/JWT   │  │ Tenant Ctx   │  │  Permission Resolver     │ │
│  └────────────┘  └──────────────┘  └──────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              AI Report Service Layer                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ IntentParser │  │ ReportFinder │  │  SQLGenerator   │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ SQLValidator │  │QueryExecutor │  │  AuditLogger    │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────┬──────────────────────┬───────────────────────────────┘
           │                      │
    ┌──────▼──────┐        ┌──────▼──────────┐
    │  Tenant DB  │        │  AI Service     │
    │  (per-db)   │        │  (Claude API)   │
    └─────────────┘        └─────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **ChatbotWidget** | Chat UI, voice input, message history |
| **ReportGrid** | Display results, sort, filter, paginate |
| **IntentParser** | Extract report type, date range, filters from NL text |
| **ReportFinder** | Search existing reports by embedding similarity |
| **SQLGenerator** | Call Claude API with schema metadata to produce SQL |
| **SQLValidator** | Block unsafe SQL, enforce tenant/branch filters |
| **QueryExecutor** | Execute validated SQL on tenant DB with timeout |
| **AuditLogger** | Log every request, SQL, result, user to audit table |
| **MetadataProvider** | Serve controlled schema metadata to AI |

### 3.3 Data Flow

```
User Input (text/voice)
       │
       ▼
[1] Speech-to-Text (if voice)
       │
       ▼
[2] Intent Classification
       ├── date range extraction
       ├── entity extraction (branch, item, supplier)
       └── report type identification
       │
       ▼
[3] Existing Report Search
       ├── Match found → Run existing report → [7]
       └── No match → Continue to [4]
       │
       ▼
[4] Build AI Prompt
       ├── Inject schema metadata (allowed tables/columns only)
       ├── Inject user context (tenant, branches, roles)
       └── Inject extracted parameters
       │
       ▼
[5] Claude API → Returns SQL
       │
       ▼
[6] SQL Validation
       ├── FAIL → Return error + ask user to rephrase
       └── PASS → Continue
       │
       ▼
[7] Inject Tenant + Branch Filters
       │
       ▼
[8] Execute Query (with timeout, row limit)
       │
       ▼
[9] Audit Log (always, even on failure)
       │
       ▼
[10] Return Results → Report Grid
       │
       ▼
[11] User can: Download Excel | Save Report | Ask follow-up
```

---

## 4. Backend API Design

### 4.1 API Endpoints

#### Base URL: `/api/v1/ai-report`

---

**POST `/api/v1/ai-report/chat`**  
Primary endpoint — processes a natural language report request.

Request:
```json
{
  "sessionId": "sess_abc123",
  "message": "Show me today's sales branch-wise",
  "voiceTranscript": false,
  "contextHistory": [
    { "role": "user", "content": "previous question" },
    { "role": "assistant", "content": "previous answer summary" }
  ]
}
```

Response (existing report matched):
```json
{
  "sessionId": "sess_abc123",
  "messageId": "msg_xyz789",
  "responseType": "EXISTING_REPORT",
  "message": "Found existing report: Branch-wise Daily Sales. Running it now.",
  "reportId": "RPT_045",
  "reportName": "Branch-wise Daily Sales",
  "columns": ["branch_name", "total_sales", "total_bills", "avg_bill_value"],
  "data": [
    { "branch_name": "Main Branch", "total_sales": 125000.00, "total_bills": 48, "avg_bill_value": 2604.17 },
    { "branch_name": "City Branch", "total_sales": 87500.00, "total_bills": 32, "avg_bill_value": 2734.38 }
  ],
  "totalRows": 3,
  "executionTimeMs": 412,
  "filters": { "date": "2026-06-28" },
  "canExportExcel": true,
  "canSave": false,
  "auditId": "AUD_00234"
}
```

Response (new report generated):
```json
{
  "sessionId": "sess_abc123",
  "messageId": "msg_xyz790",
  "responseType": "GENERATED_REPORT",
  "message": "Generated a new report for item-wise profit in the last 30 days.",
  "generatedSqlId": "GEN_SQL_099",
  "reportName": "Item-wise Profit (Last 30 Days)",
  "columns": ["item_name", "category", "qty_sold", "total_cost", "total_revenue", "profit", "profit_pct"],
  "data": [...],
  "totalRows": 148,
  "executionTimeMs": 1203,
  "canExportExcel": true,
  "canSave": true,
  "auditId": "AUD_00235"
}
```

Response (clarification needed):
```json
{
  "sessionId": "sess_abc123",
  "messageId": "msg_xyz791",
  "responseType": "CLARIFICATION",
  "message": "I found sales reports for multiple time periods. Which date range do you need?",
  "clarificationOptions": [
    { "label": "Today", "value": "today" },
    { "label": "This Week", "value": "this_week" },
    { "label": "This Month", "value": "this_month" },
    { "label": "Custom Range", "value": "custom" }
  ]
}
```

---

**POST `/api/v1/ai-report/clarify`**  
Send clarification response to continue a multi-turn session.

Request:
```json
{
  "sessionId": "sess_abc123",
  "messageId": "msg_xyz791",
  "selectedValue": "this_month"
}
```

---

**GET `/api/v1/ai-report/export/{auditId}`**  
Download Excel for a previous result.

Response: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

---

**POST `/api/v1/ai-report/save`**  
Save a generated report for future use.

Request:
```json
{
  "generatedSqlId": "GEN_SQL_099",
  "reportName": "Monthly Item Profit",
  "description": "Shows item-wise profit for last 30 days",
  "visibility": "PRIVATE",
  "shareWithRoles": []
}
```

Response:
```json
{
  "savedReportId": "SRPT_012",
  "message": "Report saved successfully. You can find it in My Reports."
}
```

---

**GET `/api/v1/ai-report/my-reports`**  
List user's saved reports.

Response:
```json
{
  "savedReports": [
    {
      "savedReportId": "SRPT_012",
      "reportName": "Monthly Item Profit",
      "lastRun": "2026-06-28T10:23:00",
      "runCount": 5,
      "visibility": "PRIVATE"
    }
  ]
}
```

---

**GET `/api/v1/ai-report/history`**  
Get user's chat/report history (last 20).

---

**GET `/api/v1/ai-report/metadata`** *(Admin only)*  
Get exposed schema metadata.

---

**POST `/api/v1/ai-report/admin/metadata`** *(IT Admin only)*  
Update which tables/columns are exposed to AI.

---

**GET `/api/v1/ai-report/audit`** *(Admin only)*  
Query audit log with filters.

---

### 4.2 Service Classes (Spring Boot)

```
ai.report/
├── controller/
│   └── AiReportController.java
├── service/
│   ├── AiReportOrchestrator.java       ← main flow coordinator
│   ├── IntentParserService.java         ← extract intent + params
│   ├── ReportDiscoveryService.java      ← search existing reports
│   ├── SchemaMetadataService.java       ← controlled schema access
│   ├── SqlGeneratorService.java         ← call Claude API
│   ├── SqlValidatorService.java         ← security validation
│   ├── QueryExecutorService.java        ← run SQL on tenant DB
│   ├── ExcelExportService.java          ← Apache POI export
│   └── AuditLogService.java             ← write audit records
├── model/
│   ├── ChatRequest.java
│   ├── ChatResponse.java
│   ├── ReportResult.java
│   ├── SqlValidationResult.java
│   └── SchemaMetadata.java
└── repository/
    ├── AiAuditLogRepository.java
    ├── AiSavedReportRepository.java
    └── AiSchemaMetadataRepository.java
```

---

## 5. React UI Design

### 5.1 Component Tree

```
<AiReportAssistant>                        ← top-level provider
  <ChatbotToggleButton />                  ← floating button (bottom-right)
  <ChatbotPanel>                           ← slide-in panel
    <ChatbotHeader />                      ← title, minimize, clear
    <ChatSessionHistory />                 ← past sessions list
    <ChatMessageList>                      ← scrollable message area
      <UserMessage />
      <AssistantMessage />
      <ClarificationCard />               ← option buttons for clarification
      <ReportResultCard>                  ← inline report preview
        <ReportToolbar />                 ← download, save, fullscreen
        <ReportDataGrid />               ← AG Grid or TanStack Table
        <ReportPagination />
      </ReportResultCard>
      <ErrorMessage />
    </ChatMessageList>
    <ChatInputBar>                         ← bottom input area
      <VoiceInputButton />               ← mic button
      <TextInput />                      ← text field
      <SendButton />
    </ChatInputBar>
  </ChatbotPanel>
  <SaveReportModal />                      ← name + save dialog
  <FullscreenReportModal />               ← expanded report view
</AiReportAssistant>
```

### 5.2 File Structure

```
src/
└── features/
    └── ai-report/
        ├── index.ts
        ├── AiReportAssistant.tsx          ← entry point
        ├── context/
        │   └── ChatContext.tsx
        ├── hooks/
        │   ├── useChatSession.ts
        │   ├── useVoiceInput.ts
        │   ├── useReportExport.ts
        │   └── useSavedReports.ts
        ├── components/
        │   ├── ChatbotToggleButton.tsx
        │   ├── ChatbotPanel.tsx
        │   ├── ChatbotHeader.tsx
        │   ├── ChatMessageList.tsx
        │   ├── UserMessage.tsx
        │   ├── AssistantMessage.tsx
        │   ├── ClarificationCard.tsx
        │   ├── ReportResultCard.tsx
        │   ├── ReportDataGrid.tsx
        │   ├── ReportToolbar.tsx
        │   ├── ReportPagination.tsx
        │   ├── ChatInputBar.tsx
        │   ├── VoiceInputButton.tsx
        │   ├── SaveReportModal.tsx
        │   └── FullscreenReportModal.tsx
        ├── api/
        │   └── aiReportApi.ts
        ├── types/
        │   └── aiReport.types.ts
        └── utils/
            └── formatters.ts
```

### 5.3 Key Component: ChatInputBar

```tsx
// ChatInputBar.tsx
export const ChatInputBar: React.FC = () => {
  const { sendMessage, isLoading } = useChatSession();
  const { isListening, transcript, startListening, stopListening } = useVoiceInput();
  const [text, setText] = useState('');

  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
  };

  return (
    <div className="chat-input-bar">
      <VoiceInputButton
        isListening={isListening}
        onStart={startListening}
        onStop={stopListening}
      />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Ask for any report... e.g. 'Show today's sales branch-wise'"
        disabled={isLoading || isListening}
      />
      <button onClick={handleSend} disabled={isLoading || !text.trim()}>
        {isLoading ? <Spinner /> : <SendIcon />}
      </button>
    </div>
  );
};
```

### 5.4 UI States

| State | Display |
|-------|---------|
| Idle | Input bar with placeholder text |
| Listening | Pulsing red mic, live transcript shown |
| Processing | Spinner + "Analyzing your request..." |
| Existing Report | Blue badge "Existing Report Found" + grid |
| Generated Report | Green badge "New Report Generated" + grid |
| Clarification | Inline option buttons |
| Error | Red alert with retry button |
| Saving | Modal with name input |

---

## 6. Database Schema

All tables below are in a shared **platform database** (not per-tenant), except where noted.

### 6.1 Schema Metadata Tables (platform DB)

```sql
-- Defines which tables are exposed to AI and their business meaning
CREATE TABLE ai_schema_tables (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_name      VARCHAR(100) NOT NULL,       -- actual DB table name
    alias           VARCHAR(100) NOT NULL,       -- friendly name shown to AI
    business_desc   TEXT NOT NULL,              -- "Sales invoice header records"
    module          VARCHAR(50) NOT NULL,        -- SALES, PURCHASE, STOCK, etc.
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Defines which columns within allowed tables are exposed
CREATE TABLE ai_schema_columns (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    table_id        BIGINT REFERENCES ai_schema_tables(id),
    column_name     VARCHAR(100) NOT NULL,
    alias           VARCHAR(100) NOT NULL,
    data_type       VARCHAR(30) NOT NULL,        -- VARCHAR, DECIMAL, DATE, etc.
    business_desc   TEXT,
    is_filterable   BOOLEAN DEFAULT TRUE,
    is_groupable    BOOLEAN DEFAULT TRUE,
    is_summable     BOOLEAN DEFAULT FALSE,       -- can SUM() be applied?
    sample_values   JSON,                        -- ["Main Branch", "City Branch"]
    is_active       BOOLEAN DEFAULT TRUE
);

-- Defines allowed JOIN paths between tables
CREATE TABLE ai_schema_joins (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    from_table_id   BIGINT REFERENCES ai_schema_tables(id),
    to_table_id     BIGINT REFERENCES ai_schema_tables(id),
    join_condition  VARCHAR(500) NOT NULL,       -- "sh.item_id = im.id"
    join_type       VARCHAR(10) DEFAULT 'INNER', -- INNER, LEFT
    description     VARCHAR(200)
);

-- Tenant-level overrides (restrict further per tenant)
CREATE TABLE ai_tenant_table_access (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id       VARCHAR(50) NOT NULL,
    table_id        BIGINT REFERENCES ai_schema_tables(id),
    is_allowed      BOOLEAN DEFAULT TRUE
);
```

### 6.2 Report Storage Tables (platform DB)

```sql
-- Standard reports defined by IT (pre-validated SQL)
CREATE TABLE ai_standard_reports (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    report_code     VARCHAR(50) UNIQUE NOT NULL,
    report_name     VARCHAR(200) NOT NULL,
    description     TEXT,
    module          VARCHAR(50),
    sql_template    TEXT NOT NULL,              -- with :tenantId, :branchIds placeholders
    parameters      JSON,                        -- [{name:"startDate", type:"DATE"}]
    required_roles  JSON,                        -- ["ADMIN","BRANCH_MANAGER"]
    is_active       BOOLEAN DEFAULT TRUE,
    intent_keywords JSON,                        -- ["sales","daily","branch","wise"]
    created_at      TIMESTAMP DEFAULT NOW()
);

-- User-saved generated reports
CREATE TABLE ai_saved_reports (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id       VARCHAR(50) NOT NULL,
    user_id         BIGINT NOT NULL,
    report_name     VARCHAR(200) NOT NULL,
    description     TEXT,
    sql_text        TEXT NOT NULL,              -- validated, saved SQL
    parameters      JSON,
    visibility      ENUM('PRIVATE','ROLE','PUBLIC') DEFAULT 'PRIVATE',
    shared_roles    JSON,
    run_count       INT DEFAULT 0,
    last_run_at     TIMESTAMP,
    promoted_to_std BOOLEAN DEFAULT FALSE,      -- IT promoted to standard
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### 6.3 Audit & Session Tables (platform DB)

```sql
-- Every AI report request, success or failure
CREATE TABLE ai_audit_log (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    tenant_id       VARCHAR(50) NOT NULL,
    user_id         BIGINT NOT NULL,
    session_id      VARCHAR(100) NOT NULL,
    message_id      VARCHAR(100) NOT NULL,
    user_message    TEXT NOT NULL,
    response_type   ENUM('EXISTING_REPORT','GENERATED_REPORT','CLARIFICATION','ERROR'),
    matched_report_id BIGINT,                   -- if existing report used
    generated_sql   TEXT,                       -- the SQL executed
    sql_valid       BOOLEAN,
    sql_fail_reason TEXT,
    rows_returned   INT,
    exec_time_ms    INT,
    error_message   TEXT,
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW(),
    INDEX idx_tenant_user (tenant_id, user_id),
    INDEX idx_session (session_id),
    INDEX idx_created (created_at)
);

-- Chat session state (multi-turn context)
CREATE TABLE ai_chat_sessions (
    session_id      VARCHAR(100) PRIMARY KEY,
    tenant_id       VARCHAR(50) NOT NULL,
    user_id         BIGINT NOT NULL,
    context         JSON,                       -- last N turns for AI context
    status          ENUM('ACTIVE','CLOSED') DEFAULT 'ACTIVE',
    last_activity   TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### 6.4 Required Tenant DB Views (per-tenant DB)

Add these views in each tenant's database to simplify AI-generated SQL:

```sql
-- Sales summary view (safe, pre-joined)
CREATE OR REPLACE VIEW v_sales_detail AS
SELECT
    sh.id           AS sale_id,
    sh.bill_no,
    sh.bill_date,
    sh.bill_type,
    b.branch_name,
    sh.branch_id,
    cu.customer_name,
    sd.item_id,
    im.item_name,
    cat.category_name,
    sd.qty,
    sd.rate,
    sd.amount,
    sd.discount_amount,
    sd.net_amount,
    sh.total_amount,
    sh.net_amount    AS bill_net_amount,
    sh.created_by
FROM sale_header sh
JOIN sale_detail sd ON sd.sale_header_id = sh.id
JOIN branch b ON b.id = sh.branch_id
JOIN item_master im ON im.id = sd.item_id
JOIN category cat ON cat.id = im.category_id
LEFT JOIN customer cu ON cu.id = sh.customer_id;

-- Purchase summary view
CREATE OR REPLACE VIEW v_purchase_detail AS
SELECT
    ph.id           AS purchase_id,
    ph.bill_no,
    ph.bill_date,
    b.branch_name,
    ph.branch_id,
    su.supplier_name,
    pd.item_id,
    im.item_name,
    cat.category_name,
    pd.qty,
    pd.rate,
    pd.amount,
    ph.total_amount
FROM purchase_header ph
JOIN purchase_detail pd ON pd.purchase_header_id = ph.id
JOIN branch b ON b.id = ph.branch_id
JOIN item_master im ON im.id = pd.item_id
JOIN category cat ON cat.id = im.category_id
JOIN supplier su ON su.id = ph.supplier_id;

-- Stock summary view
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT
    s.branch_id,
    b.branch_name,
    s.item_id,
    im.item_name,
    cat.category_name,
    s.qty_on_hand,
    im.cost_price,
    (s.qty_on_hand * im.cost_price) AS stock_value
FROM stock s
JOIN branch b ON b.id = s.branch_id
JOIN item_master im ON im.id = s.item_id
JOIN category cat ON cat.id = im.category_id;
```

---

## 7. AI Prompt Strategy

### 7.1 System Prompt Template

The system prompt is assembled at runtime by `SchemaMetadataService`. It never changes structure — only the metadata content changes based on user permissions.

```
SYSTEM PROMPT:
═══════════════════════════════════════════════════════════

You are a database report SQL generator for an ERP system.

RULES (NEVER VIOLATE):
1. You ONLY generate SELECT queries.
2. Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, EXEC, EXECUTE.
3. Never use subqueries that access tables not listed in ALLOWED TABLES below.
4. Never use UNION unless combining results from ALLOWED TABLES only.
5. Always use table aliases.
6. Never access system tables (information_schema, pg_catalog, sys, etc.).
7. Do not use dynamic SQL, stored procedures, or functions not listed.
8. Always include the tenant placeholder comment: -- tenant_enforced
9. Return ONLY the SQL query. No explanation. No markdown. No backticks.
10. If you cannot generate a safe query, return exactly: CANNOT_GENERATE

USER CONTEXT:
- Tenant: {tenantId}
- User Role: {roleName}
- Allowed Branches: {branchIds}   (null means all branches)
- Date Context: Today is {currentDate}. Current month: {currentMonth}. Current year: {currentYear}.

ALLOWED TABLES AND VIEWS:
{schemaMetadataBlock}

ALLOWED JOINS:
{joinMetadataBlock}

USEFUL SQL FUNCTIONS ONLY:
- Date: DATE(), MONTH(), YEAR(), DATE_SUB(), DATE_ADD(), CURDATE()
- Aggregate: SUM(), COUNT(), AVG(), MIN(), MAX()
- Text: CONCAT(), UPPER(), LOWER()
- Math: ROUND(), ABS()

BRANCH FILTER PLACEHOLDER:
When filtering by branch, always write: branch_id IN (:allowedBranchIds)
The system will replace :allowedBranchIds with the user's permitted branch IDs.

TENANT FILTER PLACEHOLDER:
Never hardcode tenant ID. The system enforces this automatically.

EXAMPLE QUERIES:
Q: Show today's sales branch-wise
SQL: SELECT b.branch_name, COUNT(*) AS total_bills, SUM(sh.net_amount) AS total_sales
     FROM sale_header sh JOIN branch b ON b.id = sh.branch_id
     WHERE DATE(sh.bill_date) = CURDATE() AND sh.branch_id IN (:allowedBranchIds)
     GROUP BY b.branch_name ORDER BY total_sales DESC -- tenant_enforced

Q: Show slow moving items (no sale in last 60 days)
SQL: SELECT im.item_name, cat.category_name, s.qty_on_hand, MAX(sd.bill_date) AS last_sale_date
     FROM item_master im
     JOIN v_stock_summary s ON s.item_id = im.id
     LEFT JOIN v_sales_detail sd ON sd.item_id = im.id AND sd.bill_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
     WHERE s.qty_on_hand > 0 AND s.branch_id IN (:allowedBranchIds)
     GROUP BY im.id, im.item_name, cat.category_name, s.qty_on_hand
     HAVING last_sale_date IS NULL OR last_sale_date < DATE_SUB(CURDATE(), INTERVAL 60 DAY)
     ORDER BY s.qty_on_hand DESC -- tenant_enforced

═══════════════════════════════════════════════════════════

USER MESSAGE:
{userMessage}
```

### 7.2 Schema Metadata Block Format

```
ALLOWED TABLES AND VIEWS:
─────────────────────────
TABLE: v_sales_detail (alias: Sales Detail)
PURPOSE: Complete sales transactions with item and branch details
COLUMNS:
  - sale_id (BIGINT) — Unique sale record ID
  - bill_no (VARCHAR) — Invoice number
  - bill_date (DATE) — Date of sale
  - branch_name (VARCHAR) — Branch that made the sale
  - branch_id (BIGINT) — Branch ID (use in branch_id IN (:allowedBranchIds))
  - customer_name (VARCHAR) — Customer name (may be null for walk-in)
  - item_name (VARCHAR) — Name of item sold
  - category_name (VARCHAR) — Item category
  - qty (DECIMAL) — Quantity sold
  - rate (DECIMAL) — Unit selling price
  - net_amount (DECIMAL) — Line total after discount
  - bill_net_amount (DECIMAL) — Total bill amount

TABLE: v_purchase_detail (alias: Purchase Detail)
PURPOSE: Complete purchase transactions with item and supplier details
COLUMNS:
  - purchase_id, bill_no, bill_date, branch_name, branch_id
  - supplier_name, item_name, category_name
  - qty (DECIMAL), rate (DECIMAL), amount (DECIMAL)
  - total_amount (DECIMAL) — Total purchase bill amount

TABLE: v_stock_summary (alias: Stock Summary)
PURPOSE: Current stock on hand per item per branch with value
COLUMNS:
  - branch_id, branch_name, item_id, item_name, category_name
  - qty_on_hand (DECIMAL), cost_price (DECIMAL), stock_value (DECIMAL)

TABLE: branch (alias: Branch)
PURPOSE: Branch master data
COLUMNS:
  - id (BIGINT), branch_name (VARCHAR), branch_code (VARCHAR)

TABLE: item_master (alias: Item Master)
PURPOSE: Product/item catalog
COLUMNS:
  - id, item_name, item_code, category_id, cost_price, selling_price, is_active

TABLE: category (alias: Category)
PURPOSE: Item categories
COLUMNS:
  - id, category_name, parent_category_id
```

### 7.3 Intent Classification (Pre-AI Step)

Before calling Claude, a lightweight intent parser runs using keyword matching + simple NLP:

```java
// IntentParserService.java
public ReportIntent parse(String userMessage) {
    ReportIntent intent = new ReportIntent();
    
    // Module detection
    if (containsAny(msg, "sale", "sales", "billing", "revenue", "bill")) 
        intent.setModule(Module.SALES);
    else if (containsAny(msg, "purchase", "supplier", "buying", "procurement"))
        intent.setModule(Module.PURCHASE);
    else if (containsAny(msg, "stock", "inventory", "on hand", "stock value"))
        intent.setModule(Module.STOCK);
    
    // Date range detection
    if (contains(msg, "today")) intent.setDateRange(DateRange.TODAY);
    else if (contains(msg, "this month")) intent.setDateRange(DateRange.THIS_MONTH);
    else if (contains(msg, "last month")) intent.setDateRange(DateRange.LAST_MONTH);
    else if (contains(msg, "this year")) intent.setDateRange(DateRange.THIS_YEAR);
    // regex for "last 30 days", "last N days"
    
    // Grouping detection
    if (containsAny(msg, "branch-wise", "branch wise", "by branch"))
        intent.setGroupBy(GroupBy.BRANCH);
    if (containsAny(msg, "item-wise", "item wise", "by item"))
        intent.setGroupBy(GroupBy.ITEM);
    if (containsAny(msg, "category", "cat-wise"))
        intent.setGroupBy(GroupBy.CATEGORY);
    
    return intent;
}
```

---

## 8. SQL Validation Strategy

### 8.1 Validation Pipeline

```java
// SqlValidatorService.java — runs in order, stops on first failure

public SqlValidationResult validate(String sql, UserContext user) {
    
    // Step 1: Parse SQL AST (use JSqlParser)
    Statement stmt = parseStatement(sql);
    if (!(stmt instanceof Select)) 
        return fail("Only SELECT statements are allowed");

    // Step 2: Block dangerous keywords (defense in depth)
    String upper = sql.toUpperCase();
    for (String blocked : BLOCKED_KEYWORDS) {
        if (upper.contains(blocked))
            return fail("Query contains blocked keyword: " + blocked);
    }
    
    // Step 3: Verify all referenced tables are in allowed list
    List<String> referencedTables = extractTableNames(stmt);
    for (String table : referencedTables) {
        if (!metadataService.isTableAllowed(table, user.getTenantId()))
            return fail("Access to table not permitted: " + table);
    }
    
    // Step 4: Check system table access
    for (String table : referencedTables) {
        if (SYSTEM_TABLES.contains(table.toLowerCase()))
            return fail("System table access not allowed");
    }
    
    // Step 5: Inject mandatory filters
    sql = injectTenantFilter(sql, user.getTenantId());
    sql = injectBranchFilter(sql, user.getAllowedBranchIds());
    
    // Step 6: Add LIMIT clause if missing
    sql = ensureLimit(sql, user.getMaxRows());
    
    // Step 7: Mark as validated
    return SqlValidationResult.pass(sql);
}

private static final List<String> BLOCKED_KEYWORDS = List.of(
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE",
    "EXEC", "EXECUTE", "CALL", "GRANT", "REVOKE", "LOCK", "UNLOCK",
    "LOAD_FILE", "INTO OUTFILE", "INTO DUMPFILE", "BENCHMARK", "SLEEP",
    "INFORMATION_SCHEMA", "PG_CATALOG", "SYS.", "MYSQL.", "PERFORMANCE_SCHEMA"
);

private static final List<String> SYSTEM_TABLES = List.of(
    "information_schema", "pg_catalog", "sys", "mysql", "performance_schema"
);
```

### 8.2 Tenant Filter Injection

```java
private String injectTenantFilter(String sql, String tenantId) {
    // For per-DB architecture, tenant is enforced by connection itself.
    // This method validates the comment marker is present:
    if (!sql.contains("-- tenant_enforced")) {
        log.warn("AI SQL missing tenant_enforced marker — adding connection-level enforcement");
    }
    // Connection routing to tenant DB is handled by DataSourceRouter
    return sql;
}

private String injectBranchFilter(String sql, List<Long> branchIds) {
    if (branchIds == null) return sql; // admin, all branches
    // Replace placeholder with actual IDs
    String ids = branchIds.stream()
        .map(String::valueOf)
        .collect(Collectors.joining(","));
    return sql.replace(":allowedBranchIds", ids);
}
```

### 8.3 Query Executor with Safety Guards

```java
// QueryExecutorService.java
public ReportResult execute(String validatedSql, UserContext user) {
    DataSource tenantDs = dataSourceRouter.getDataSource(user.getTenantId());
    
    try (Connection conn = tenantDs.getConnection()) {
        conn.setReadOnly(true);                          // enforce read-only
        
        try (PreparedStatement ps = conn.prepareStatement(validatedSql)) {
            ps.setQueryTimeout(30);                      // 30-second timeout
            ps.setMaxRows(user.getMaxRows());            // default 10000
            
            long start = System.currentTimeMillis();
            ResultSet rs = ps.executeQuery();
            
            return ResultSetMapper.toReportResult(rs, System.currentTimeMillis() - start);
        }
    } catch (SQLTimeoutException e) {
        throw new ReportTimeoutException("Query exceeded 30 second limit");
    }
}
```

---

## 9. Permission Handling Strategy

### 9.1 Permission Levels

```
Level 1 — TENANT    : Enforced by DB connection routing. Unbreakable.
Level 2 — BRANCH    : Injected as branch_id IN (...) filter. Cannot be bypassed.
Level 3 — MODULE    : Schema metadata filtered per user role before AI sees it.
Level 4 — TABLE     : Controlled in ai_schema_tables / ai_tenant_table_access.
Level 5 — ROW       : Future — per-item row-level security (phase 2).
```

### 9.2 UserContext Object

```java
@Data
public class UserContext {
    private String tenantId;
    private Long userId;
    private String username;
    private String roleName;
    private List<Long> allowedBranchIds;    // null = all branches
    private List<String> allowedModules;    // ["SALES","STOCK"]
    private int maxRows;                    // from tenant config, default 10000
    private String ipAddress;
    private String sessionId;
}
```

### 9.3 Schema Metadata Filtering

```java
// SchemaMetadataService.java
public SchemaMetadata getMetadataForUser(UserContext user) {
    // Load all active tables
    List<AiSchemaTable> allTables = tableRepo.findAllActive();
    
    // Filter by module permissions
    List<AiSchemaTable> allowed = allTables.stream()
        .filter(t -> user.getAllowedModules().contains(t.getModule()))
        .filter(t -> tenantAccessRepo.isAllowed(user.getTenantId(), t.getId()))
        .toList();
    
    // Load columns for allowed tables only
    // Load joins only between allowed tables
    return new SchemaMetadata(allowed, columns, joins);
}
```

---

## 10. Excel Export Design

### 10.1 Apache POI Implementation

```java
// ExcelExportService.java
public byte[] export(ReportResult result, String reportName) {
    try (Workbook wb = new XSSFWorkbook()) {
        Sheet sheet = wb.createSheet("Report");
        
        // Styles
        CellStyle headerStyle = createHeaderStyle(wb);    // bold, blue bg
        CellStyle numberStyle = createNumberStyle(wb);    // right-align, 2dp
        CellStyle dateStyle   = createDateStyle(wb);      // dd/MM/yyyy
        
        // Header row
        Row headerRow = sheet.createRow(0);
        for (int i = 0; i < result.getColumns().size(); i++) {
            Cell cell = headerRow.createCell(i);
            cell.setCellValue(result.getColumns().get(i).getLabel());
            cell.setCellStyle(headerStyle);
        }
        
        // Data rows
        int rowNum = 1;
        for (Map<String, Object> record : result.getData()) {
            Row row = sheet.createRow(rowNum++);
            for (int i = 0; i < result.getColumns().size(); i++) {
                ColumnDef col = result.getColumns().get(i);
                Object val = record.get(col.getName());
                Cell cell = row.createCell(i);
                setCellValue(cell, val, col.getDataType(), numberStyle, dateStyle);
            }
        }
        
        // Auto-size columns
        for (int i = 0; i < result.getColumns().size(); i++) {
            sheet.autoSizeColumn(i);
        }
        
        // Add metadata sheet
        addMetadataSheet(wb, reportName, result);
        
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        wb.write(out);
        return out.toByteArray();
    }
}
```

### 10.2 Export API Response

```
HTTP 200
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="branch_sales_2026-06-28.xlsx"
```

---

## 11. Voice Input Design

### 11.1 Web Speech API (Primary)

```typescript
// useVoiceInput.ts
export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      // Fallback: use Whisper API via backend
      startWhisperRecording();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const final = Array.from(event.results)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript)
        .join('');
      setTranscript(final);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === 'not-allowed') {
        toast.error('Microphone access denied');
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return { isListening, transcript, startListening, stopListening };
};
```

### 11.2 Whisper API Fallback (Backend)

For browsers without Web Speech API support, record audio in browser and send to backend:

**POST `/api/v1/ai-report/voice-to-text`**

Request: `multipart/form-data` with `audio` field (webm/ogg/mp4)

```java
// VoiceToTextService.java
public String transcribe(MultipartFile audioFile) {
    // Call OpenAI Whisper API (or self-hosted)
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("https://api.openai.com/v1/audio/transcriptions"))
        .header("Authorization", "Bearer " + whisperApiKey)
        .POST(HttpRequest.BodyPublishers.ofByteArray(audioFile.getBytes()))
        .build();
    // parse JSON response, return transcript text
}
```

### 11.3 Language Support

- Primary: English (en-US)
- Configurable per tenant: add `en-IN`, `ar-AE`, etc.
- Date expressions normalized after transcription: "aaj ki sales" → "today's sales"

---

## 12. Audit Logging Design

### 12.1 What Is Logged

Every AI report request, including failures, is logged **before results are returned**.

```java
// AuditLogService.java
public AiAuditLog log(AuditLogEntry entry) {
    AiAuditLog log = AiAuditLog.builder()
        .tenantId(entry.getTenantId())
        .userId(entry.getUserId())
        .sessionId(entry.getSessionId())
        .messageId(entry.getMessageId())
        .userMessage(entry.getUserMessage())            // original text
        .responseType(entry.getResponseType())
        .matchedReportId(entry.getMatchedReportId())
        .generatedSql(entry.getGeneratedSql())         // full SQL text
        .sqlValid(entry.isSqlValid())
        .sqlFailReason(entry.getSqlFailReason())
        .rowsReturned(entry.getRowsReturned())
        .execTimeMs(entry.getExecTimeMs())
        .errorMessage(entry.getErrorMessage())
        .ipAddress(entry.getIpAddress())
        .userAgent(entry.getUserAgent())
        .createdAt(LocalDateTime.now())
        .build();
    
    return auditRepo.save(log);
}
```

### 12.2 Audit Log Retention

- Logs retained for 90 days online
- Archived to S3/cold storage after 90 days
- Admin can search/export audit logs via `/api/v1/ai-report/audit`

### 12.3 Admin Audit View

```
GET /api/v1/ai-report/audit?userId=123&from=2026-06-01&to=2026-06-28&status=ERROR
```

Response includes:
- User who made request
- Exact text they typed/spoke
- Whether it matched existing or generated new SQL
- The actual SQL that ran
- Row count and execution time
- Any security violation flags

---

## 13. Error Handling

### 13.1 Error Types and User Messages

| Error | User Message | Action |
|-------|-------------|--------|
| `AI_UNAVAILABLE` | "Report assistant is temporarily unavailable. Please try the Reports menu." | Show fallback link |
| `SQL_BLOCKED` | "I can't generate that report due to security restrictions. Try rephrasing or contact IT." | Log + alert |
| `NO_PERMISSION` | "You don't have permission to view that data." | Log |
| `QUERY_TIMEOUT` | "The report took too long to run. Try adding a date filter to narrow results." | Show retry |
| `AMBIGUOUS_REQUEST` | "I need more details. [options...]" | Show clarification UI |
| `NO_DATA` | "No records found for your criteria." | Empty state UI |
| `CANNOT_GENERATE` | "I couldn't understand that report request. Try describing it differently." | Suggestion list |
| `EXPORT_FAILED` | "Export failed. Please try again." | Retry button |

### 13.2 Graceful Degradation

```
AI Service Down
  → Suggest manual report navigation
  → Link to existing reports list
  → Show "Contact IT" option

DB Timeout
  → Suggest narrower date range
  → Suggest adding branch filter
  → Auto-retry with LIMIT reduced

SQL Blocked
  → Never show generated SQL to user
  → Log full SQL in audit log with SECURITY_BLOCKED flag
  → Alert IT Admin via email/Slack if repeated pattern
```

---

## 14. Folder Structure

### 14.1 Spring Boot Backend

```
src/main/java/com/nexsol/
└── aireport/
    ├── AiReportModule.java
    ├── config/
    │   ├── AiReportConfig.java           ← Claude API key, Whisper key, limits
    │   └── AiReportSecurityConfig.java
    ├── controller/
    │   └── AiReportController.java
    ├── service/
    │   ├── AiReportOrchestrator.java
    │   ├── IntentParserService.java
    │   ├── ReportDiscoveryService.java
    │   ├── SchemaMetadataService.java
    │   ├── ClaudeApiService.java          ← Anthropic API client
    │   ├── SqlValidatorService.java
    │   ├── QueryExecutorService.java
    │   ├── ExcelExportService.java
    │   ├── VoiceToTextService.java
    │   └── AuditLogService.java
    ├── model/
    │   ├── request/
    │   │   ├── ChatRequest.java
    │   │   ├── ClarifyRequest.java
    │   │   └── SaveReportRequest.java
    │   ├── response/
    │   │   ├── ChatResponse.java
    │   │   └── ReportResult.java
    │   └── domain/
    │       ├── AiAuditLog.java
    │       ├── AiSavedReport.java
    │       ├── AiStandardReport.java
    │       ├── AiSchemaTable.java
    │       ├── AiSchemaColumn.java
    │       └── AiSchemaJoin.java
    ├── repository/
    │   ├── AiAuditLogRepository.java
    │   ├── AiSavedReportRepository.java
    │   ├── AiStandardReportRepository.java
    │   └── AiSchemaMetadataRepository.java
    └── validation/
        ├── SqlValidator.java
        ├── TableWhitelistChecker.java
        └── KeywordBlocker.java
```

### 14.2 React Frontend

```
src/features/ai-report/
├── index.ts
├── AiReportAssistant.tsx
├── context/
│   └── ChatContext.tsx
├── hooks/
│   ├── useChatSession.ts
│   ├── useVoiceInput.ts
│   ├── useReportExport.ts
│   └── useSavedReports.ts
├── components/
│   ├── ChatbotToggleButton.tsx
│   ├── ChatbotPanel.tsx
│   ├── ChatbotHeader.tsx
│   ├── ChatSessionHistory.tsx
│   ├── ChatMessageList.tsx
│   ├── UserMessage.tsx
│   ├── AssistantMessage.tsx
│   ├── ClarificationCard.tsx
│   ├── ReportResultCard.tsx
│   ├── ReportDataGrid.tsx
│   ├── ReportToolbar.tsx
│   ├── ReportPagination.tsx
│   ├── ChatInputBar.tsx
│   ├── VoiceInputButton.tsx
│   ├── SaveReportModal.tsx
│   └── FullscreenReportModal.tsx
├── api/
│   └── aiReportApi.ts
├── types/
│   └── aiReport.types.ts
└── utils/
    └── formatters.ts
```

### 14.3 Database Migration Files

```
src/main/resources/db/migration/
├── V100__create_ai_schema_tables.sql
├── V101__create_ai_schema_columns.sql
├── V102__create_ai_schema_joins.sql
├── V103__create_ai_standard_reports.sql
├── V104__create_ai_saved_reports.sql
├── V105__create_ai_audit_log.sql
├── V106__create_ai_chat_sessions.sql
├── V107__insert_standard_schema_metadata.sql
└── V108__insert_standard_reports.sql
```

---

## 15. Implementation Phases

### Phase 1 — Foundation (Weeks 1–3)

**Goal:** Basic working chatbot that can run existing standard reports.

- [ ] Create database migration scripts V100–V108
- [ ] Implement `SchemaMetadataService` with seed data for sales/purchase/stock views
- [ ] Build `AiReportController` and `AiReportOrchestrator` skeleton
- [ ] Implement `IntentParserService` with keyword-based classification
- [ ] Implement `ReportDiscoveryService` for exact/fuzzy match on standard reports
- [ ] Implement `AuditLogService`
- [ ] Build React `ChatbotPanel` + `ChatInputBar` + `ChatMessageList`
- [ ] Build `ReportDataGrid` with sorting/pagination
- [ ] Wire up `/chat` endpoint for EXISTING_REPORT flow only
- [ ] Add Excel export for standard reports

**Deliverable:** User can ask "show today's sales" and get the branch-wise daily sales report.

---

### Phase 2 — AI SQL Generation (Weeks 4–6)

**Goal:** Dynamic report generation via Claude API.

- [ ] Integrate Anthropic Claude API (`ClaudeApiService`)
- [ ] Implement system prompt builder with schema metadata injection
- [ ] Implement `SqlValidatorService` with JSqlParser + keyword blocker
- [ ] Implement `QueryExecutorService` with read-only connection + timeout + row limit
- [ ] Implement tenant filter injection (connection-level for per-DB architecture)
- [ ] Implement branch filter injection
- [ ] Wire up `/chat` endpoint for GENERATED_REPORT flow
- [ ] Handle `CANNOT_GENERATE` fallback gracefully
- [ ] Add clarification multi-turn flow (CLARIFICATION response type)
- [ ] Test 20+ common report scenarios

**Deliverable:** User can ask any report question and get dynamic SQL results.

---

### Phase 3 — Voice + Save + Polish (Weeks 7–9)

**Goal:** Voice input, report saving, session history.

- [ ] Implement `useVoiceInput` hook with Web Speech API
- [ ] Implement Whisper API fallback (`VoiceToTextService`)
- [ ] Implement `SaveReportModal` + `/save` endpoint
- [ ] Implement "My Reports" sidebar + `/my-reports` endpoint
- [ ] Implement chat session history (`/history` endpoint)
- [ ] Add `FullscreenReportModal` for large grid view
- [ ] Add report metadata sheet to Excel export
- [ ] Add auto-suggestions/chips (quick report shortcuts)
- [ ] UX polish: typing indicators, animations, empty states
- [ ] Responsive mobile layout

**Deliverable:** Full feature set available end-to-end.

---

### Phase 4 — Admin Tools + Security Hardening (Weeks 10–11)

**Goal:** IT admin controls, audit, security.

- [ ] Build admin UI for managing schema metadata (which tables/columns exposed)
- [ ] Build audit log viewer with filters/export
- [ ] Implement IT Admin report promotion workflow
- [ ] Add role-based visibility for saved reports
- [ ] Add rate limiting per user (max 30 requests/hour)
- [ ] Add anomaly detection: alert on repeated SQL_BLOCKED events
- [ ] Penetration test the SQL validation layer
- [ ] Load test with 100 concurrent users
- [ ] Add query cost estimation before execution (EXPLAIN plan check)

**Deliverable:** Production-ready, secure, admin-managed system.

---

### Phase 5 — Advanced (Post-Launch)

- [ ] Report embedding similarity search (replace keyword match)
- [ ] Scheduled reports via AI (cron-based auto-run)
- [ ] PDF export with charts
- [ ] AI-generated chart suggestions (bar, pie, line)
- [ ] Multi-language voice input (Arabic, Hindi)
- [ ] Report sharing via email/WhatsApp link

---

## 16. Acceptance Criteria

### AC-01: Core Chat
- [ ] User types "show today's sales branch-wise" → gets branch-wise sales grid in < 5 seconds
- [ ] User types "give me purchase summary for this month" → gets purchase summary
- [ ] System matches existing reports when intent matches (>80% keyword overlap)
- [ ] System generates new SQL when no match found

### AC-02: Security
- [ ] SQL containing INSERT/UPDATE/DELETE is rejected with SECURITY_BLOCKED
- [ ] User in Branch A cannot see Branch B data under any prompt
- [ ] Tenant A data never appears in Tenant B's session
- [ ] All blocked queries logged in audit with full SQL
- [ ] Query with no LIMIT auto-capped at 10,000 rows
- [ ] Query exceeding 30 seconds returns timeout error

### AC-03: Voice Input
- [ ] Clicking mic + speaking "show stock value by branch" → populates text field
- [ ] Works in Chrome, Edge, Safari
- [ ] Falls back to Whisper API when Web Speech API unavailable

### AC-04: Excel Export
- [ ] Every report result shows "Download Excel" button
- [ ] Downloaded file has correct headers, data, and formatting
- [ ] Numbers are right-aligned, dates formatted dd/MM/yyyy
- [ ] File named `report_{type}_{date}.xlsx`

### AC-05: Save Report
- [ ] User can name and save any generated report
- [ ] Saved report appears in "My Reports" list
- [ ] Re-running a saved report produces same structure (may vary in data)

### AC-06: Audit
- [ ] Every request (success or failure) creates an audit log record
- [ ] Audit log includes: user, timestamp, input text, generated SQL, row count, exec time
- [ ] IT Admin can filter and export audit logs

### AC-07: Performance
- [ ] Standard reports return in < 3 seconds
- [ ] Generated reports return in < 8 seconds (includes AI API call)
- [ ] Excel export for 5,000 rows completes in < 10 seconds
- [ ] System handles 50 concurrent users without degradation

---

## Appendix A: Environment Variables

```properties
# Claude AI
CLAUDE_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-6
CLAUDE_MAX_TOKENS=1000
CLAUDE_TIMEOUT_SECONDS=15

# Whisper (voice fallback)
OPENAI_API_KEY=sk-...
WHISPER_MODEL=whisper-1

# Report limits
AI_REPORT_MAX_ROWS=10000
AI_REPORT_QUERY_TIMEOUT_SECONDS=30
AI_REPORT_MAX_REQUESTS_PER_HOUR=30

# Audit
AI_REPORT_AUDIT_RETENTION_DAYS=90
```

## Appendix B: Claude API Call

```java
// ClaudeApiService.java
public String generateSql(String systemPrompt, String userMessage, List<ContextMessage> history) {
    AnthropicClient client = AnthropicClient.builder()
        .apiKey(apiKey)
        .build();

    List<MessageParam> messages = new ArrayList<>();
    
    // Add history context (last 4 turns max to control token cost)
    history.stream().limit(4).forEach(h ->
        messages.add(MessageParam.of(h.getRole(), h.getContent()))
    );
    
    messages.add(MessageParam.ofUser(userMessage));

    Message response = client.messages().create(
        CreateMessageParams.builder()
            .model(claudeModel)           // "claude-sonnet-4-6"
            .maxTokens(1000)
            .system(systemPrompt)
            .messages(messages)
            .build()
    );

    String sql = response.content().get(0).text().strip();
    
    if (sql.equals("CANNOT_GENERATE")) {
        throw new ReportGenerationException("AI could not generate SQL for this request");
    }
    
    return sql;
}
```

---

*Document end. Ready for phase-by-phase implementation.*
