# Claude Prompt: Build Guided Customer Signup and Initial Setup Workflow

You are a senior full-stack developer. Build a guided signup and onboarding workflow for our ERP SaaS system.

## Current System Context

We already have:

* A signup page
* Multi-tenant ERP system
* When a customer signs up, a new database is provisioned for that customer
* After signup, the customer can log in
* Customer can create:

  * Menus
  * Roles
  * Branches
  * Users
  * User branch assignments
  * User role assignments
  * Role menu permissions

## Problem

Currently, after signup, the user enters the system directly and must manually understand what to do next.

This is confusing for new customers.

We need a guided workflow wizard that helps the new customer provision the system step by step in the correct logical order.

## Goal

Create a new customer onboarding workflow after signup.

The workflow should guide the admin user through these steps:

1. Company setup
2. Menu setup
3. Role setup
4. Assign menus to roles
5. Branch setup
6. User setup
7. Assign branches to users
8. Assign roles to users
9. Category setup
10. Item setup
11. Finish setup and go to dashboard

## Required User Flow

### Step 1: Signup

User enters:

* Company name
* Owner name
* Mobile number
* Email
* Password
* Business type:

  * Bakery
  * Supermarket
  * Distribution
  * Retail
  * Other
* Country
* State
* City

After signup:

* Create tenant record
* Provision new tenant database
* Create default admin user
* Login user automatically or redirect to login
* Mark tenant setup status as `PENDING`

---

### Step 2: Setup Wizard Starts

After first login, check tenant setup status.

If setup status is not `COMPLETED`, redirect user to:

`/setup-wizard`

Do not allow normal dashboard access until mandatory setup steps are completed.

---

## Setup Wizard Steps

### Step 1: Company Profile

Fields:

* Company legal name
* Display name
* GST/VAT number
* Address
* Phone
* Email
* Logo upload
* Financial year start month
* Default currency

Save to company profile table.

---

### Step 2: Menu Setup

Show option:

* Use default menu template
* Customize menus manually

For new users, recommend default menu template.

Default menus:

* Dashboard
* POS Billing
* Sales
* Purchase
* Inventory
* Stock Transfer
* Reports
* User Management
* Settings

User can enable/disable menus.

---

### Step 3: Role Setup

Create default roles based on business type.

Default roles:

* Admin
* Owner
* Manager
* Cashier
* Inventory Staff
* Accountant

User can add/edit/delete roles except Admin.

---

### Step 4: Assign Menus to Roles

Show matrix UI:

Rows = roles
Columns = menus

Permissions:

* View
* Create
* Edit
* Delete
* Print
* Export

Provide default permission templates.

Example:

Cashier:

* POS Billing: View, Create, Print
* Reports: No access
* Settings: No access

Manager:

* POS Billing: View, Create, Edit, Print
* Inventory: View, Create, Edit
* Reports: View, Export

Admin:

* Full access

---

### Step 5: Branch Setup

User creates at least one branch.

Fields:

* Branch name
* Branch code
* Address
* Phone
* GST/VAT number
* Invoice prefix
* Default warehouse/location

Validation:

* At least one branch is mandatory.
* Branch code must be unique.
* Invoice prefix must be unique.

---

### Step 6: User Setup

Create users.

Fields:

* Full name
* Mobile number
* Email
* Username
* Password or invite link
* Active/Inactive

The signup admin user should already exist.

---

### Step 7: Assign Branches to Users

Show users and branches mapping screen.

Rules:

* Admin should have access to all branches by default.
* Cashier should normally be assigned to one branch.
* Manager can be assigned to multiple branches.

---

### Step 8: Assign Roles to Users

Assign one or more roles to each user.

Rules:

* Every active user must have at least one role.
* Every active user must have at least one branch.
* Admin user must always retain Admin role.

---

### Step 9: Category Setup

Allow user to create item categories.

Fields:

* Category name
* Category code
* Parent category
* Tax rate
* Active/Inactive

Provide option:

* Add manually
* Import from Excel
* Use sample categories based on business type

For bakery default categories:

* Cakes
* Pastries
* Bread
* Snacks
* Raw Materials
* Beverages

For supermarket default categories:

* Grocery
* Dairy
* Frozen Foods
* Personal Care
* Household
* Fruits & Vegetables

---

### Step 10: Item Setup

Allow user to create items.

Fields:

* Item code
* Barcode
* Item name
* Category
* UOM
* Purchase rate
* Selling rate
* Tax rate
* Opening stock
* Branch/warehouse
* Reorder level
* Active/Inactive

Options:

* Add manually
* Import from Excel
* Skip for now

Important:

Item setup can be skipped, but system should show warning:

"You can start using the system, but POS billing will need items."

---

### Step 11: Finish Setup

Show setup summary:

* Company profile completed
* Menus created
* Roles created
* Permissions assigned
* Branches created
* Users created
* Categories created
* Items created/imported/skipped

When user clicks Finish:

* Validate mandatory setup
* Mark tenant setup status as `COMPLETED`
* Redirect to dashboard

---

## Setup Progress Tracking

Create backend support for tracking setup progress.

Suggested table:

`tenant_setup_progress`

Fields:

* id
* tenant_id
* company_profile_completed
* menus_completed
* roles_completed
* role_menu_permissions_completed
* branches_completed
* users_completed
* user_branch_mapping_completed
* user_role_mapping_completed
* categories_completed
* items_completed
* setup_status: PENDING / IN_PROGRESS / COMPLETED
* current_step
* created_at
* updated_at
* completed_at

---

## Backend Requirements

Create APIs for:

* Get setup progress
* Save company profile
* Create default menus
* Save selected menus
* Create default roles
* Save roles
* Save role-menu permissions
* Save branches
* Save users
* Save user-branch assignments
* Save user-role assignments
* Save categories
* Save/import items
* Complete setup wizard

API pattern:

`/api/{tenantId}/setup-wizard/progress`

`/api/{tenantId}/setup-wizard/company-profile`

`/api/{tenantId}/setup-wizard/menus`

`/api/{tenantId}/setup-wizard/roles`

`/api/{tenantId}/setup-wizard/role-menu-permissions`

`/api/{tenantId}/setup-wizard/branches`

`/api/{tenantId}/setup-wizard/users`

`/api/{tenantId}/setup-wizard/user-branches`

`/api/{tenantId}/setup-wizard/user-roles`

`/api/{tenantId}/setup-wizard/categories`

`/api/{tenantId}/setup-wizard/items`

`/api/{tenantId}/setup-wizard/complete`

---

## Frontend Requirements

Create React setup wizard page.

Route:

`/setup-wizard`

UI requirements:

* Stepper layout
* Save and Continue button
* Back button
* Skip button only for optional steps
* Progress percentage
* Validation messages
* Auto-save after each step
* Resume from last completed step
* Mobile responsive design

Suggested components:

* `SetupWizardPage`
* `CompanyProfileStep`
* `MenuSetupStep`
* `RoleSetupStep`
* `RoleMenuPermissionStep`
* `BranchSetupStep`
* `UserSetupStep`
* `UserBranchAssignmentStep`
* `UserRoleAssignmentStep`
* `CategorySetupStep`
* `ItemSetupStep`
* `SetupSummaryStep`

---

## Business Rules

Mandatory before completing setup:

* Company profile must be completed
* At least one menu must exist
* Admin role must exist
* Admin role must have full permission
* At least one branch must exist
* Admin user must exist
* Admin user must have Admin role
* Admin user must be assigned to at least one branch

Optional:

* Additional users
* Categories
* Items

---

## Login Routing Rule

After login:

1. Identify tenant
2. Load tenant setup progress
3. If setup status is not `COMPLETED`, redirect to `/setup-wizard`
4. If setup status is `COMPLETED`, redirect to `/dashboard`

---

## Error Handling

Handle:

* Tenant database provisioning failure
* Duplicate email/mobile
* Duplicate branch code
* Duplicate invoice prefix
* Missing mandatory setup
* Failed logo upload
* Failed Excel import
* User trying to access dashboard before setup completion

---

## Expected Output

Please implement:

1. Backend entities/tables
2. Backend APIs
3. Frontend setup wizard
4. Route guard after login
5. Default menu and role templates
6. Validation logic
7. Setup completion logic

Use clean code, DTOs, service layer, proper validation, and reusable React components.

Do not hardcode tenant IDs. Use the existing tenant context pattern.

Before coding, inspect the existing project structure and reuse existing menu, role, user, branch, and item APIs wherever possible. Only create new APIs where required for workflow orchestration.
