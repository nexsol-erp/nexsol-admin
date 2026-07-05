Before starting the AI Branch Manager, build a Business Event Framework in your ERP.

Instead of AI querying tables directly, every important business action should publish a standardized event, such as:

Sales completed
Purchase posted
Stock transferred
Expense entered
Day-end closed
Credit limit exceeded
Branch profit calculated

This event layer will feed both Kafka synchronization and future AI agents. It will also make adding new AI capabilities much faster.