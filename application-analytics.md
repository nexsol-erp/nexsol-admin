# Claude Prompt: Implement Comprehensive Application Usage Analytics

## Objective

Design and implement a comprehensive **Application Usage Analytics Framework** for our ERP application. The purpose is to understand how customers use the system, identify popular features, detect unused modules, improve UI/UX, measure user productivity, and provide business intelligence for future product development.

The solution must have **minimal performance impact**, be scalable, configurable, and work in our multi-tenant architecture.

---

# Goals

The analytics system should answer questions such as:

* Which modules are used most?
* Which features are never used?
* Which reports are most popular?
* Which users are most active?
* Which branches use the ERP heavily?
* How much time is spent inside each module?
* Which buttons are clicked most?
* Which workflow is abandoned?
* Which screens are slow?
* Which APIs are slow?
* Which features generate errors?
* Which customers should receive training?
* Which customers are candidates for premium AI features?

---

# Architecture

Design the solution using an asynchronous architecture.

```
React UI
     │
Usage Tracking SDK
     │
Batch Events
     │
REST API
     │
Kafka Queue
     │
Analytics Service
     │
PostgreSQL Analytics Database
     │
Dashboard
```

The UI must never wait for analytics logging.

---

# Events to Capture

## Login

Capture

* Tenant
* Branch
* User
* Login Time
* Logout Time
* Session Duration
* Device Type
* Browser
* OS
* IP Address
* Country
* Time Zone

---

## Screen Navigation

Whenever user opens a screen

Capture

* Module
* Screen Name
* Previous Screen
* Next Screen
* Open Time
* Close Time
* Duration

Example

```
Dashboard
↓

Sales Billing
↓

Item Search
↓

Payment
↓

Print
```

---

## Menu Usage

Capture

* Menu ID
* Menu Name
* Parent Menu
* Number of Opens
* Time Spent

---

## Button Click Analytics

Capture every important button.

Examples

Save

Delete

Edit

Print

Export Excel

Export PDF

Approve

Reject

Day End

Stock Transfer

Purchase Save

GRN Save

Invoice Print

---

## Report Analytics

Capture

* Report Name
* Filters Used
* Time Taken
* Export Format
* Number of Records
* Download Count

Example

```
HSN Report

Date Range

Branch

Category

Excel Download
```

---

## Search Analytics

Capture

* Search Text
* Search Type
* Number of Results
* Search Duration
* Selected Item

Useful for improving search ranking.

---

## Barcode Analytics

Capture

* Barcode
* Scan Success
* Scan Failure
* Manual Entry
* Camera Scanner
* USB Scanner

---

## Transaction Analytics

Capture

Sales

Purchase

GRN

Stock Transfer

Production

Returns

Day End

For each

* Create
* Edit
* Delete
* Cancel
* Print
* Reprint

---

## API Analytics

For every API

Capture

* API Name
* Controller
* Method
* User
* Duration
* Success
* Failure
* HTTP Status
* Exception

---

## Performance Metrics

Capture

* Screen Load Time
* API Response Time
* Database Time
* Cache Hit Ratio
* Kafka Publish Time
* Memory Usage
* CPU Usage

---

## Error Analytics

Capture

* Exception
* Stack Trace
* User
* Screen
* Module
* Browser
* Tenant

Group similar errors automatically.

---

## Workflow Analytics

Track complete workflows.

Examples

Sales Billing

```
Open Billing

↓

Add Item

↓

Payment

↓

Print

↓

Completed
```

Purchase

```
Purchase

↓

GRN

↓

Stock Updated

↓

Completed
```

Find abandonment points.

---

## AI Usage

Capture

* Prompt
* Module
* AI Feature
* Response Time
* Success
* User Rating
* Regenerated
* Accepted

---

## Feature Adoption

For every module calculate

Daily Active Users

Weekly Active Users

Monthly Active Users

Feature Adoption %

Repeat Usage %

---

## Customer Health Score

Automatically calculate

Login Frequency

Transactions

Reports

Errors

Inactive Days

Training Needed

Overall Health Score

---

## Audit Information

Every analytics event should contain

* Event ID
* Tenant ID
* Branch ID
* User ID
* Session ID
* Timestamp
* Module
* Screen
* Version
* Application Type

Desktop

Web

Mobile

---

# Database Design

Design normalized analytics tables including

* analytics_event
* analytics_session
* analytics_screen_usage
* analytics_api_usage
* analytics_report_usage
* analytics_button_usage
* analytics_error_log
* analytics_ai_usage
* analytics_performance
* analytics_workflow
* analytics_customer_health

Include indexes and partitioning strategy for high-volume data.

---

# Dashboard

Create an Analytics Dashboard.

Sections

Executive Dashboard

Product Usage

Customer Usage

Branch Usage

User Usage

Report Usage

Performance

Errors

AI Usage

Revenue Opportunities

Feature Adoption

Heat Maps

Trend Charts

Drill-down Reports

---

# Reports

Provide reports such as

Top Used Modules

Least Used Modules

Most Used Reports

Most Active Users

Inactive Customers

Feature Adoption

Average Session Duration

Average Daily Logins

Slowest APIs

Slowest Screens

Most Common Errors

AI Usage Statistics

Export all reports to Excel and PDF.

---

# Privacy

Support configuration options

Enable Analytics

Disable Analytics

Mask Sensitive Data

GDPR Ready

Retention Period

Auto Cleanup

Role-Based Access

---

# Performance Requirements

* Logging must be asynchronous.
* Use Kafka to queue events.
* Batch UI events whenever possible.
* No noticeable UI delay.
* Analytics failure must never affect ERP functionality.
* Support millions of events per day.
* Use background workers for aggregation.

---

# Configuration

Analytics should be configurable per tenant.

Examples

Enable

Disable

Capture Screen Usage

Capture API Usage

Capture AI Usage

Capture Errors

Sampling Percentage

Retention Days

---

# Deliverables

Generate the following:

1. Complete architecture document.
2. Database schema.
3. Entity relationship diagram.
4. Spring Boot backend implementation.
5. React analytics SDK.
6. Kafka producer and consumer.
7. REST APIs.
8. Dashboard UI.
9. Scheduled aggregation jobs.
10. Security model.
11. Retention and cleanup strategy.
12. Unit and integration tests.
13. Deployment guide.
14. Monitoring and alerting configuration.
15. Production-ready implementation following clean architecture and best practices.

The implementation should be modular, scalable, fault-tolerant, and suitable for enterprise SaaS deployments with thousands of tenants and millions of analytics events.
