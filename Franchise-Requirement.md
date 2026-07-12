You are an expert ERP architect and senior full-stack developer.

We need to design and implement Franchise Management in our ERP.


Important instruction:
Before writing any code, first do a detailed ERP architecture design. Do not directly start coding.

Current situation:

* Franchise is currently managed as another branch.
* In future, each franchise may buy products from outside suppliers.
* Each franchise may have its own accounts, account heads, expenses, suppliers, purchases, sales, stock, and profit/loss.
* Therefore franchise should be managed as a separate tenant, not just a branch.

Goal:
Create a scalable architecture where each franchise is a separate tenant, but still linked to the central company for common operations.

First produce a detailed design covering:

* Business process flow
* Tenant architecture
* Franchise onboarding flow
* Database/table design
* Entity relationships
* Kafka event design
* API design
* UI/UX changes
* Permission model
* Accounting impact
* Stock transfer flow
* Purchase flow
* Reporting design
* Audit design
* Error handling and retry design
* Migration from current branch-based franchise model
* Phased implementation plan
* Risks and recommendations

After the design is approved, only then start coding.

Functional requirements:

1. Tenant Model

* Central company remains the master tenant.
* Each franchise must be created as a separate tenant.
* Franchise tenant must have its own database/schema/accounting data.
* Maintain mapping between central tenant and franchise tenant.

2. Centralized Item Creation

* Items are created centrally.
* Applicable items are synced to franchise tenants using Kafka.
* Sync item master, category, tax, HSN, barcode, MRP, UOM, and related data.
* Franchise may have local selling price if allowed.
* Avoid duplicate item creation across tenants.

3. Kafka-Based Sync
   Use Kafka for cross-tenant sync.

Suggested topics:

* item-master-created
* item-master-updated
* category-master-updated
* tax-master-updated
* stock-transfer-to-franchise
* stock-transfer-received-by-franchise
* franchise-purchase-created
* franchise-sales-summary
* franchise-stock-summary

Each event should include:

* event_id
* event_type
* source_tenant_id
* target_tenant_id
* entity_type
* entity_id
* payload
* created_at
* retry_count

4. Stock Transfer

* Central can transfer stock to franchise tenant.
* Central stock transfer OUT becomes stock transfer IN in franchise tenant.
* Franchise stock increases only after receipt confirmation.
* Support pending, dispatched, received, rejected, and cancelled status.

5. Franchise Own Purchase

* Franchise can purchase directly from outside suppliers.
* Franchise purchase affects only franchise tenant accounts and stock.
* Central may view summaries if permitted.

6. Accounts Separation
   Each franchise tenant has separate:

* suppliers
* customers
* account heads
* expenses
* purchases
* sales
* payments
* profit/loss

Central accounts and franchise accounts must not be mixed.

7. Reports
   Create:

* Franchise-wise sales
* Franchise-wise stock
* Franchise-wise stock transfer
* Franchise-wise outside purchase
* Franchise-wise profit/loss
* Central-to-franchise outstanding
* Franchise payment due to central
* Consolidated franchise performance report

8. Permissions

* Central admin manages franchises and sync rules.
* Franchise admin manages local users, suppliers, purchases, expenses, and sales.
* Franchise users cannot access central tenant data unless explicitly allowed.

9. Audit and Failure Handling

* Audit every cross-tenant sync and stock transfer.
* Kafka sync must be idempotent.
* Same event must not be applied twice.
* Failed events must be stored and retried.
* Provide UI to view failed sync events and retry manually.

10. Migration
    Existing branches must continue working.
    Only franchise branches should gradually move to separate tenant model.
    Provide a safe migration plan from branch-based franchise to tenant-based franchise.

Deliverables:
First provide the full architecture/design document.
Then wait for confirmation before coding.

Additional requirement:

Central company must have an option to create a franchise from the ERP UI.

When central admin creates a franchise, the system should automatically:

1. Create Franchise Master Record

* franchise_code
* franchise_name
* owner/contact details
* address
* GST/tax details
* status
* linked central_tenant_id

2. Provision Separate Tenant

* Automatically create a new tenant entry.
* Automatically provision tenant database/schema for the franchise.
* Run required DB migrations.
* Create default admin user for the franchise.
* Create default roles, menus, settings, financial year, and basic account heads.

3. Maintain Franchise-Tenant Relation
   Create a relation table to link central company and franchise tenant.

Example:

* id
* central_tenant_id
* franchise_tenant_id
* franchise_code
* relation_type
* sync_enabled
* kafka_enabled
* status
* created_at
* created_by

4. Configure Kafka Connection
   During franchise creation, configure Kafka connection details/endpoints needed for sync.

Store:

* kafka_cluster_id / bootstrap_servers
* topic_prefix
* consumer_group_id
* source_tenant_id
* target_tenant_id
* allowed_event_types
* sync_status
* last_sync_at

5. Initial Data Sync
   After tenant provisioning, central system should publish initial sync events for:

* item master
* category master
* tax master
* HSN
* UOM
* barcode
* allowed price rules
* branch/franchise configuration

6. Provisioning Status
   Franchise creation should show clear status:

* Draft
* Tenant Provisioning Started
* DB Created
* Migration Completed
* Default Setup Completed
* Kafka Configured
* Initial Sync Completed
* Active
* Failed

7. Failure Handling
   If any step fails:

* Store error details.
* Allow retry from failed step.
* Do not create duplicate tenant/database/events.
* Keep provisioning idempotent.

8. UI Requirement
   Create a Franchise Management screen in central ERP with:

* Create Franchise
* View Franchise
* Provisioning Status
* Kafka Sync Status
* Retry Failed Provisioning
* Enable/Disable Sync
* Activate/Suspend Franchise
* View Linked Tenant

Additional Requirement :
Franchise Portal

Each franchise owner logs into a dedicated portal where they can:

View KPIs
Place replenishment orders
Download invoices
See outstanding balances
Track deliveries
Submit support tickets
Access training materials
Receive announcements
View AI recommendations
Chat with the central office