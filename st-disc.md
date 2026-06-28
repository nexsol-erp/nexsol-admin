# Claude Development Prompt

## Feature: Stock Transfer Discount Management (POS Electron + Backend)

You are working on our existing ERP system consisting of:

* Electron POS Application
* Spring Boot Backend
* PostgreSQL Database
* Existing Stock Transfer module
* Existing Stock Transfer Print Format

Analyze the existing implementation first and then implement this feature without breaking any existing functionality.

---

# Objective

Enhance the Stock Transfer module to support item-wise transfer discounts.

The discount can be configured in the backend and should automatically be applied whenever an item is selected in the Stock Transfer screen.

The system should support configuring either:

* Discount Percentage
  OR
* Transfer Rate (discounted rate)

The UI should always display:

* MRP
* Discount %
* Discount Amount
* Rate
* Amount

The user should never have to calculate discounts manually.

---

# Business Rules

Existing item selling rate should now be treated as **MRP**.

The actual transfer price should be called **Rate**.

Amount should always be calculated using **Rate**, never MRP.

Formula:

Amount = Quantity × Rate

---

# Database

Create a new master table.

## stock_transfer_discount_mst

Suggested fields

```
id

tenant_id

branch_id nullable

item_id

discount_percent nullable

rate nullable

effective_from

effective_to nullable

active

remarks nullable

created_by

created_at

updated_by

updated_at
```

Rules

* One active record per Item + Branch + Effective Period.
* Branch may be NULL for company-wide discount.
* At least one of Discount Percent or Rate must be entered.
* Both fields cannot be NULL.
* If both are entered, reject validation and ask user to choose only one.
* Rate must not exceed current MRP.
* Discount Percent must be between 0 and 100.

---

# Backend APIs

Create APIs

```
Create Discount

Update Discount

Deactivate Discount

List Discounts

Get Discount by Item
```

Example

```
GET

/api/{tenantId}/stock-transfer-discounts/item/{itemId}?branchId=xxx
```

Response

Case 1

```
{
    "discountPercent":10,
    "rate":null
}
```

Case 2

```
{
    "discountPercent":null,
    "rate":85
}
```

Case 3

```
No record found
```

---

# Backend Calculation Logic

MRP comes from Item Master.

When an item is selected:

Fetch discount configuration.

Case 1

Backend returns Discount %

```
MRP = 100

Discount % = 10

Discount Amount = 10

Rate = 90

Amount = Qty × 90
```

Case 2

Backend returns Rate

```
MRP = 100

Rate = 85

Discount Amount = 15

Discount % = 15

Amount = Qty × 85
```

Case 3

No Discount

```
MRP = 100

Discount % = 0

Discount Amount = 0

Rate = 100

Amount = Qty × 100
```

All calculations should follow the project's existing rounding rules.

---

# Electron POS UI Changes

Modify Stock Transfer Item Grid.

Current columns remain.

Add / Rename columns

```
MRP

Discount %

Discount Amount

Rate

Amount
```

Existing "Rate" column should now display **MRP**.

Add a new **Rate** column which represents the final transfer rate after discount.

Workflow

When user selects item

↓

Fetch discount configuration

↓

Calculate

Discount %

Discount Amount

Rate

↓

Populate grid

↓

Amount recalculates automatically whenever Quantity changes.

User should not manually edit calculated discount values unless the project already supports manual rate overrides.

---

# Discount Master Screen

Create a new management screen.

Functions

* List Discounts
* Add
* Edit
* Deactivate
* Search Item
* Search Item Code
* Branch Filter
* Active Filter

Fields

```
Item

Branch

Discount %

OR

Rate

Effective From

Effective To

Remarks

Active
```

Validation

Only one of

Discount %

OR

Rate

can be entered.

---

# Stock Transfer Save

Extend Stock Transfer Detail table.

If columns do not exist, create migration.

Suggested columns

```
mrp

discount_percent

discount_amount

rate

amount
```

Persist calculated values.

Do NOT recalculate later using current item master.

Historical transfers must retain original values.

---

# Printing

Update Stock Transfer print format.

Columns

```
Item

Qty

MRP

Discount %

Discount Amount

Rate

Amount
```

Example

```
---------------------------------------------------------------
Item             Qty    MRP    Disc%   Disc Amt   Rate   Amount
---------------------------------------------------------------
Milk              5     100      10       10        90      450

Rice             10      80       5        4        76      760
---------------------------------------------------------------
```

Rate should always represent transfer price.

MRP should always represent original price.

Amount = Qty × Rate.

---

# Validation Rules

Discount %

```
0–100
```

Rate

```
Cannot exceed MRP

Cannot be negative
```

Discount Amount

```
Cannot be negative
```

Quantity

```
Must be greater than zero
```

Effective To

```
Cannot be before Effective From
```

---

# Acceptance Criteria

✔ Discount master screen created.

✔ Database migration completed.

✔ Backend APIs implemented.

✔ Item selection automatically loads transfer discount.

✔ MRP displayed.

✔ Discount % calculated correctly.

✔ Discount Amount calculated correctly.

✔ Rate calculated correctly.

✔ Amount always calculated using Rate.

✔ Stock Transfer detail stores MRP, Discount %, Discount Amount, Rate and Amount.

✔ Print format updated.

✔ Existing Stock Transfer functionality continues to work without regression.

✔ Multi-tenant and branch-aware logic preserved.

---

# Implementation Phases

## Phase 1

* Database migration
* Entity
* Repository
* Service
* REST APIs

## Phase 2

* Discount Master UI
* CRUD
* Validation

## Phase 3

* Electron Stock Transfer Grid
* Auto-fetch discount
* Calculation logic

## Phase 4

* Save Stock Transfer
* Database persistence

## Phase 5

* Update print template



---

# Development Guidelines

* Analyze the existing codebase before making changes.
* Follow existing project architecture and coding standards.
* Reuse existing repository, service, controller, DTO, and React/Electron patterns.
* Preserve backward compatibility.
* Do not modify unrelated modules.
* Ensure all changes are tenant-aware and branch-aware.
* Follow the existing API response format, exception handling, logging, and validation conventions already used in the project.
