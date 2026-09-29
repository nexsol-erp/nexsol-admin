// Screenshots shown in the help menu reference, keyed by menuKey (or
// "desktop:<screen>" for the desktop POS app). Files live in public/help/ and
// were captured from the app with sample data for a two-branch bakery.
const screenshots = {
  "POS": { src: "pos.webp", caption: "Web POS: items on the left, the bill and payment on the right." },
  "KOT": { src: "kot-order.webp", caption: "KOT: an open table order, with items already sent to the kitchen locked." },
  "Sales Entry": { src: "sales-entry.webp", caption: "Sales Entry: a GST tax invoice with customer, delivery address and payment." },
  "Purchase Entry": { src: "purchase-entry.webp", caption: "Purchase Entry: scan or search items, then Partial Save or Final Save." },
  "My Reports": { src: "my-reports.webp", caption: "My Reports: background reports with their status and Download button." },
  "Upload": { src: "upload.webp", caption: "Upload: pick the branch and file type, choose the Excel file, then Upload." },
  "Scheme Creation": { src: "scheme-creation.webp", caption: "Scheme Creation: the scheme form and the list of existing schemes." },
  "Production Def": { src: "production-def.webp", caption: "Production Definition: a finished item and its raw materials." },
  "Cost Price History": { src: "cost-price-history.webp", caption: "Cost Price History: manual rates and the rates the system picked up from purchases, transfers and production." },
  "E-Invoicing": { src: "e-invoicing.webp", caption: "E-Invoicing: providers set up for this company, with tabs for submissions, tax returns and e-way bills." },
  "Accounting Setup": { src: "accounting-setup.webp", caption: "Accounting Setup: create the standard chart of accounts in one click." },
  "Receipt Entry": { src: "receipt-entry.webp", caption: "Receipt Entry: pick the customer, the bills being paid and how the money came in." },
  "Trial Balance": { src: "trial-balance-ledger.webp", caption: "Trial Balance drill-down: click an account to see its entries, then a voucher to see its lines." },
  "Ledger Statement": { src: "trial-balance-voucher.webp", caption: "Opening a voucher from a ledger shows every debit and credit line." },
  "Profit & Loss": { src: "profit-loss.webp", caption: "Profit & Loss: cost of goods sold includes opening stock and subtracts closing stock." },
  "Balance Sheet": { src: "balance-sheet.webp", caption: "Balance Sheet: Closing Stock sits with the assets; this year's profit with equity." },
  "Stock Valuation": { src: "stock-valuation.webp", caption: "Stock Valuation: quantity on hand times the costing rate, per item, batch and branch." },
  "Daily Cash Summary": { src: "daily-cash-summary.webp", caption: "Daily Cash Summary: pick a date and Run Report." },
  "Bank Reconciliation": { src: "bank-recon.webp", caption: "Bank Reconciliation: statement lines on the left, book entries on the right." },
  "Tally Integration": { src: "tally-integration.webp", caption: "Tally Integration settings: connection, schedule and what to send." },
  "Tally Sync Status": { src: "tally-status.webp", caption: "Tally Sync Status: counts by status, connector state and the voucher list." },
};

export default screenshots;
