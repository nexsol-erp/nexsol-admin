# Claude Prompt: Monthly Branch Profit Report

Build monthly branch profit feature in our ERP.

## Requirement

We need to capture monthly expenses for each branch and calculate monthly profit.

## Expense Entry

Create UI and backend to post branch-wise monthly expenses.

Fields:

* Month
* Year
* Branch
* Expense Type
* Amount
* Remarks

Expense types:

* Rent
* Staff Salary
* Electricity
* Internet
* Maintenance
* Transport
* Other

Allow add/edit/delete expenses based on permission.

Prevent duplicate expense entry for same branch, month, year, and expense type unless explicitly allowed.

## Profit Report

Create report: **Monthly Branch Profit Report**

Filters:

* Month
* Year
* Branch

Branch dropdown must show only branches allowed for logged-in user.

## Calculation

For selected branch and month:

```text
Sales Amount = total sales for branch/month
Cost Amount = cost price of sold items
Gross Profit = Sales Amount - Cost Amount
Expense Amount = total monthly expenses for branch/month
Net Profit = Gross Profit - Expense Amount
```

## Cost Price Logic

Use existing purchase/cost logic from ERP.

For franchise/outlet branches, cost price may come from stock transfer rate.

For CGN/main branch, cost price may come from purchase rate.

Use existing item cost calculation if already available.

## Report Output

Show:

* Branch
* Month
* Sales Amount
* Cost Amount
* Gross Profit
* Expense Amount
* Net Profit
* Profit %

Also show expense breakup:

* Rent
* Salary
* Electricity
* Internet
* Other expenses

Support Excel/PDF export.

## Database

Create tables if not existing:

```text
branch_expense_type
branch_monthly_expense
```

`branch_monthly_expense` should include:

* id
* tenant_id
* branch_id
* expense_type_id
* expense_month
* expense_year
* amount
* remarks
* created_by
* created_at
* updated_by
* updated_at

## API

Create APIs for:

* Expense type master
* Monthly expense CRUD
* Monthly branch profit report

## Security

Apply tenant isolation.

Apply user branch permission.

Apply role/menu permission.

## Deliverables

Implement:

* DB migration
* Spring Boot entities/repositories/services/controllers
* React UI for expense entry
* React UI for profit report
* Excel/PDF export
* Validation
* Tests
