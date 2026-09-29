// Help content: concept guides (getting started, accounting, inventory costing,
// GST and e-invoicing, daily routines, troubleshooting, glossary).
//
// Each guide is a list of blocks rendered by HelpPage:
//   { h: "Heading" }                  sub-heading
//   { p: "Paragraph" }                paragraph
//   { ul: [..] } / { ol: [..] }       bullet / numbered list
//   { table: { head: [..], rows: [[..], ..] } }
//   { note: "Text", tone: "info" | "warn" | "tip" }
//   { code: "Preformatted text" }
//   { img: "file.png", caption: "..." } image in public/help/
//   { menus: ["menuKey", ..] }        links to the menu reference entries

const guides = [
  // ---------------------------------------------------------------------------
  {
    id: "overview",
    title: "Welcome to TradeLink 247",
    group: "Start here",
    blocks: [
      { p: "TradeLink 247 is a cloud ERP for retail, restaurants, bakeries and distribution businesses. It covers billing (web POS, KOT table billing, GST tax invoices and the desktop POS), purchases, stock across branches, production, schemes, accounting with GST, regulatory e-invoicing, and reports. You use it in a web browser; each shop counter can also run the TradeLink 247 POS desktop app, which keeps billing even when the internet drops." },
      { p: "Every company that signs up gets its own separate database. Your data is never mixed with another company's data." },
      { h: "Key ideas" },
      { table: { head: ["Term", "Meaning"], rows: [
        ["Company", "Your account, created at sign-up. Everything below belongs to it."],
        ["Branch", "A shop, outlet, kitchen or warehouse. Stock, sales and expenses are kept per branch. Each branch has a short, permanent Branch Code (e.g. BLR01)."],
        ["User", "A person who logs in. A user can work in one or more branches."],
        ["Role", "Decides which menus a user sees (admin, manager, user, WB, franchiseeuser, or roles you create)."],
        ["Item", "A product or raw material in the Item Master, with price, GST rate, unit, HSN code and barcode."],
        ["Batch", "Stock is held per item, branch and batch. \"NB\" means no batch tracking."],
        ["Voucher", "Any saved transaction (sale, purchase, receipt, payment, transfer) with its own number. Numbers restart each financial year."],
        ["Ledger account", "A line in the chart of accounts (Cash, Sales, Purchase Account, GST...). Accounting reports are built from these."],
      ] } },
      { h: "How to use this guide" },
      { ul: [
        "Use the search box at the top to find any menu, button or topic. Results show every section that mentions your words.",
        "\"Start here\" and \"Concepts\" explain how the system thinks: setup order, accounting, stock costing and GST.",
        "\"Menu reference\" has one entry for every menu in the web app, grouped as in the sidebar, with step-by-step instructions. Click \"Open\" on an entry to go straight to that screen (you only see menus your role allows).",
        "\"Desktop POS app\" covers the Windows till application.",
      ] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "first-login",
    title: "First login and finding your way",
    group: "Start here",
    blocks: [
      { p: "After signing up you are logged in as the company administrator and can see every menu. The left sidebar is the main navigation; the top bar holds search and your account." },
      { img: "app-shell.webp", caption: "The main screen: sidebar menus on the left, search and branch at the top." },
      { h: "Parts of the screen" },
      { ul: [
        "Sidebar: menus grouped by module (Sales, Purchase, Stock & Inventory, Masters, Accounting...). Click a group to open it.",
        "Menu search (top bar): type part of a menu name, e.g. \"trial\", and press Enter to jump to it.",
        "Branch selector: choose the branch you are working in. Entry screens and many reports use it.",
        "Refresh Cache: reloads items, categories and prices kept in your browser. Use it after uploading or editing items.",
        "Dark mode toggle and Logout.",
      ] },
      { h: "Which menus you see" },
      { p: "Menus come from your role. An administrator grants menus to roles in Setup & Administration > 3. Assign Menus to Roles. When a new feature is released, its menu must be granted to the roles that should use it before those users can see it." },
      { note: "If a user says a menu is missing, check the user's role in \"6. Assign Branches & Roles\" and that role's menus in \"3. Assign Menus to Roles\". Ask the user to log out and in again afterwards.", tone: "tip" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "setup-sequence",
    title: "Setting up a new company, step by step",
    group: "Start here",
    blocks: [
      { p: "Do these steps in order. Later steps depend on earlier ones: for example, stock cannot be uploaded for a branch that does not exist yet, and vouchers cannot be numbered without a financial year." },
      { ol: [
        "Sign up. This creates your company and the administrator login.",
        "Accounting > Financial Year Setup: create the current financial year (e.g. 1 Apr 2026 to 31 Mar 2027) and make it active.",
        "Setup & Administration > 4. Create Branches: add each shop or warehouse. Pick short codes; they cannot be changed later.",
        "Masters > Branch Details: fill in each branch's legal name, address, GSTIN, state and phone. These print on bills, and the state decides CGST+SGST or IGST.",
        "Masters > Receipt Modes: add the payment modes you accept (CASH, CARD, UPI...). Only these appear at billing.",
        "Masters > Category Type and Category Name: create your product groups (Type is the parent, e.g. Bakery; Name is the child, e.g. Cakes).",
        "Masters > Supplier Creation (or Tools & Design > Upload): add suppliers with their GSTIN and state.",
        "Tools & Design > Upload: upload the Item Master, then opening stock per branch. Column formats are in the Upload entry of the menu reference.",
        "Masters > Category Link: link items to categories (used by schemes and category reports).",
        "Setup & Administration > 2. Create Roles and 3. Assign Menus to Roles: decide what each role can see.",
        "Setup & Administration > 5. Create Users, then 6. Assign Branches & Roles: give each person a login, a role and their branches.",
        "Accounting > Accounting Setup: create the chart of accounts (one click) before you start billing, so every bill posts to the books.",
        "Tools & Design > Download: install the POS desktop app on each counter PC, log in, pick the branch and print a test bill. Approve the new machine in System Administration > POS Machine Approval if asked.",
        "Optional: Scheme Creation for offers, UPI Payment Setup for QR payments, Languages for bilingual bills, E-Invoicing for IRP / ZATCA / MyInvois, Tally Integration if your accountant uses Tally.",
      ] },
      { note: "Opening balances: enter them before the first bill. Stock goes in via Upload > Stock; customer, supplier, bank and capital balances go in via Ledger Accounts (opening balance Dr/Cr).", tone: "info" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "accounting-basics",
    title: "Accounting concepts made simple",
    group: "Concepts",
    blocks: [
      { p: "You do not need to be an accountant to use TradeLink 247: bills, purchases, receipts and payments post to the books automatically. Knowing the basics below helps you read the reports and spot mistakes." },
      { h: "Double entry" },
      { p: "Every transaction touches at least two accounts. One side is the debit (Dr), the other the credit (Cr), and the two always add up to the same amount. That is why the Trial Balance's Debit and Credit columns must be equal." },
      { table: { head: ["Account type", "Increases with", "Decreases with", "Examples"], rows: [
        ["Asset (what you own)", "Debit", "Credit", "Cash, Bank, Customers (receivable), Stock, Input GST"],
        ["Liability (what you owe)", "Credit", "Debit", "Suppliers (payable), Output GST payable, advances from customers"],
        ["Equity (owner's stake)", "Credit", "Debit", "Capital, Retained Earnings"],
        ["Income", "Credit", "Debit", "Sales, Other Income"],
        ["Expense", "Debit", "Credit", "Purchases (cost of goods sold), rent, salaries, wastage"],
      ] } },
      { p: "The accounting equation always holds: Assets = Liabilities + Equity + (Income - Expenses). Profit for the year becomes part of equity when the year is closed." },
      { h: "The chart of accounts TradeLink 247 creates" },
      { p: "Accounting > Accounting Setup creates these accounts. You can add your own (expense heads, bank accounts, loans) in Ledger Accounts; system accounts cannot be renamed or deleted." },
      { table: { head: ["Code", "Account", "Type", "Used for"], rows: [
        ["1001", "Cash in Hand", "Asset", "Cash bills and cash receipts"],
        ["1002", "Bank Account", "Asset", "Online / bank receipts and payments"],
        ["1010", "Card POS Receipts", "Asset", "Card payments until the card company settles to the bank"],
        ["1015", "UPI Receipts", "Asset", "UPI payments until settled to the bank"],
        ["1100", "Accounts Receivable", "Asset", "Money customers owe you"],
        ["1200", "Inventory", "Asset", "Not posted day to day (see periodic stock below)"],
        ["5100 / 5101 / 5102", "Input CGST / SGST / IGST", "Asset", "GST paid on purchases, recoverable from the government"],
        ["2100", "Accounts Payable", "Liability", "Money you owe suppliers"],
        ["2200 / 2201 / 2202", "Output CGST / SGST / IGST Payable", "Liability", "GST collected on sales, payable to the government"],
        ["2300", "Accrued Branch Expenses", "Liability", "Branch expenses booked but not yet paid"],
        ["2400", "Customer Advances Received", "Liability", "Advance payments for future orders"],
        ["3000 / 3100", "Capital / Retained Earnings", "Equity", "Owner's money and past profits"],
        ["4000", "Sales Revenue", "Income", "Taxable value of sales (without GST)"],
        ["4900", "Other Income", "Income", "Discounts received, interest, scrap sales"],
        ["5000", "Cost of Goods Sold", "Expense", "Wastage and cost adjustments"],
        ["5200", "Purchase Account", "Expense (COGS)", "Taxable value of purchases"],
        ["5300", "Operating Expenses", "Expense", "Parent for rent, salaries, power and other expense heads"],
      ] } },
      { h: "What each transaction posts" },
      { table: { head: ["Transaction", "Debit", "Credit"], rows: [
        ["Sale (any bill)", "1100 Accounts Receivable (bill total)", "4000 Sales Revenue (taxable value), 2200 + 2201 Output CGST + SGST, or 2202 Output IGST for another state"],
        ["Payment received on the bill", "1001 Cash / 1010 Card / 1015 UPI / 1002 Bank", "1100 Accounts Receivable"],
        ["Credit sale", "1100 stays open until a Receipt Entry clears it", ""],
        ["Purchase", "5200 Purchase Account (taxable value), 5100-5102 Input GST", "2100 Accounts Payable (bill total)"],
        ["Payment to supplier", "2100 Accounts Payable", "1001 Cash or 1002 Bank"],
        ["Wastage", "5000 Cost of Goods Sold", "5200 Purchase Account (moves the cost out of purchases)"],
        ["Expense paid", "The expense head (e.g. Rent)", "Cash or Bank"],
      ] } },
      { p: "Because a POS bill is paid at once, the receivable is opened and cleared in the same moment, so the net effect of a cash bill is: Cash Dr, Sales Cr, Output GST Cr." },
      { h: "GST in the books" },
      { ul: [
        "GST you collect on sales is not your income: it sits in Output GST Payable (a liability) until you pay it to the government.",
        "GST you pay on purchases is not your expense when you can claim input tax credit: it sits in Input GST (an asset).",
        "Each month, Output GST minus Input GST is what you pay in cash with your GSTR-3B. That is why Sales Revenue and Purchase Account always show amounts before GST.",
      ] },
      { h: "Periodic stock: how cost of goods sold is worked out" },
      { p: "TradeLink 247 keeps the books on the periodic method, which is how most Indian retailers and Tally users work. Purchases go to 5200 Purchase Account when bought; a sale does not post a separate cost entry. At report time, the cost of what you sold is calculated from stock:" },
      { code: "Cost of goods sold = Opening stock + Purchases - Closing stock\nGross profit       = Sales - Cost of goods sold" },
      { p: "Profit & Loss does this for you: it values stock on the day before your From date (opening) and on your To date (closing) using the costing rules in the next guide, and shows them on the P&L. The Balance Sheet shows the same closing stock as a current asset." },
      { note: "\"Difference in Opening Stock\" on the Balance Sheet: stock that was never entered in the books with an opening balance (for example opening stock uploaded as quantities only) would make the Balance Sheet not tally. The system adds this equity line so both sides agree. If it is large, post your opening stock value as an opening balance.", tone: "info" },
      { h: "Reading the financial statements" },
      { ul: [
        "Trial Balance: every account's balance. Debits must equal credits. Click an account to see its ledger, and a voucher to see its lines.",
        "Profit & Loss: income minus expenses for a period. Gross profit (sales minus cost of goods sold) then net profit after operating expenses.",
        "Balance Sheet: what you own and owe on a date. Assets = Liabilities + Equity, with this year's profit shown under equity.",
        "Cash Flow: opening cash and bank balance, money in, money out and closing balance for the period.",
        "Customer and Supplier Aging: how long unpaid bills have been outstanding (0-30, 31-60, 61-90, 90+ days). Chase the old ones first.",
      ] },
      { h: "Good practice" },
      { ul: [
        "Reconcile the bank every month (Bank Statements > Bank Reconciliation). Set the bank account's opening balance first.",
        "Deposit card and UPI settlements against 1010 / 1015 so those accounts return to zero; a growing balance means settlements are missing.",
        "Record each month end in Period Closing once reviewed. At year end, Period Closing's Year End posts the closing journal (profit moves to Retained Earnings); it cannot be undone, so do it only after the auditor is happy.",
        "Check Trial Balance, Customer Aging and Supplier Aging monthly, and Output vs Input GST before filing returns.",
        "Keep business and personal spending apart: owner withdrawals go to a Drawings or Capital account, not to expenses.",
      ] },
      { menus: ["Accounting Setup", "Ledger Accounts", "Trial Balance", "Profit & Loss", "Balance Sheet", "Receipt Entry", "Payment Entry", "Period Closing"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "inventory-costing",
    title: "Inventory costing and stock valuation",
    group: "Concepts",
    blocks: [
      { p: "Stock value drives your gross profit: overstate closing stock and profit looks higher than it is. This guide explains the common costing methods and exactly how TradeLink 247 values stock and costs each sale." },
      { h: "Common costing methods" },
      { table: { head: ["Method", "How it works", "Good for"], rows: [
        ["FIFO (first in, first out)", "Oldest stock is assumed sold first; closing stock is valued at the latest purchase prices.", "Perishables, rising prices"],
        ["Weighted average", "Every unit carries the average cost of all units bought.", "Stable, high-volume goods"],
        ["Latest purchase price", "Stock is valued at the most recent buying rate.", "Fast-moving retail where prices change often"],
        ["Standard / manual cost", "You fix a cost per item (e.g. from a recipe) and review it periodically.", "Manufactured and bakery items"],
      ] } },
      { p: "Whichever method you use, keep it the same from year to year so profits are comparable. Stock is always valued at cost without recoverable GST, because that GST comes back to you as input credit." },
      { h: "How TradeLink 247 finds the cost of an item" },
      { p: "For every item and branch, the unit cost on a given date is the first of these that exists:" },
      { ol: [
        "A manual cost rate added with \"Add Entry\" in Masters > Cost Price History. A branch-specific rate beats a company-wide one; the most recent one wins.",
        "Otherwise, the latest rate at that branch on or before the date, from a purchase, a stock transfer in, or a production run, whichever is newest.",
        "Otherwise, the average purchase cost before GST (purchase amount / (1 + GST%) / quantity).",
        "Otherwise, the purchase rate on the item master.",
      ] },
      { p: "This is effectively the latest-purchase-price method with manual overrides. The same rules are used by the Stock Valuation screen, the opening and closing stock in Profit & Loss and Balance Sheet, and branch profit costing, so all three agree." },
      { h: "Worked example" },
      { table: { head: ["", "Qty", "Rate", "Value"], rows: [
        ["Opening stock 1 Apr (cost 40)", "100", "40.00", "4,000"],
        ["Purchase 10 Apr (before GST)", "200", "42.00", "8,400"],
        ["Sold in April", "220", "", ""],
        ["Closing stock 30 Apr at latest rate", "80", "42.00", "3,360"],
      ] } },
      { code: "Cost of goods sold = 4,000 + 8,400 - 3,360 = 9,040\nIf sales (before GST) were 220 x 55 = 12,100\nGross profit = 12,100 - 9,040 = 3,060  (25.3% margin)" },
      { h: "Branch profit: cost stamped on every bill line" },
      { p: "The Branch Profit reports need a cost for each line sold, not just a month-end figure. A nightly job (01:30, re-covering the last 7 days) stamps each sale line with its unit cost using the first two rules above (manual rate, then the latest branch rate on or before the bill date). A line with neither is left out of cost and profit, so watch for them (Masters > Cost & Profit Stamping shows and re-runs it). Cost Price History shows every rate the system has seen for an item." },
      { ul: [
        "If a new item shows zero cost, it has no purchase, transfer-in or production rate at that branch yet: add a manual rate in Cost Price History.",
        "If you correct a purchase rate, re-run cost stamping for the affected dates so profit reports pick up the change.",
      ] },
      { h: "Stock transfers between branches" },
      { p: "A transfer out reduces stock at the sending branch; the receiving branch adds it when it accepts the transfer. The transfer rate becomes the receiving branch's latest cost. Masters > Stock Transfer Discount can set the rate a franchise or branch is charged. Inter-Branch Transfer in Accounting records the money side between branches." },
      { h: "Production (recipes)" },
      { p: "Production Def lists the raw materials for one batch of a finished item. Production Execution takes the raw materials out of stock and adds the finished goods; the finished item's rate on that run becomes its latest cost. Production moves stock only; it posts nothing to the books, because under periodic stock the raw materials were already expensed when purchased. Items in a DYNAMIC category consume their recipe automatically when sold, so do not also run Production Execution for them. Keep recipes accurate, or the finished goods will be costed wrongly and raw material stock will drift." },
      { h: "Wastage, damage and stock counts" },
      { ul: [
        "Wastage Entry: removes spoiled or damaged stock and moves its cost from Purchase Account to Cost of Goods Sold, so you can see wastage separately.",
        "Physical Stock Correction: after a stock count, set the real quantity. The difference is written as an adjustment.",
        "Excess / Shortage Report and Stock Anomaly Report help find where stock goes missing.",
      ] },
      { h: "Keeping stock values right" },
      { ul: [
        "Enter every purchase with its correct rate before GST, and the correct unit (a box of 12 vs one piece). A purchase adds stock only when its Goods Receipt is saved.",
        "Accept incoming transfers promptly; stock in transit is not in either branch's count.",
        "Negative stock (selling more than the system thinks you have) is ignored in valuation. Fix it with Physical Stock Correction or by entering the missing purchase.",
        "Count stock at least monthly for high-value items, and yearly for everything.",
        "Use Report Exclusions to leave non-stock items (service charges, packing) out of stock reports.",
      ] },
      { menus: ["Stock Valuation", "Cost Price History", "Cost Stamping", "Branch Profit Report", "Inventory Ledger", "Physical Stock Correction", "Wastage Entry"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "gst-compliance",
    title: "GST, e-invoicing and tax returns",
    group: "Concepts",
    blocks: [
      { h: "CGST + SGST or IGST?" },
      { p: "In India, a sale within the same state is charged CGST and SGST (half each). A sale to another state is charged IGST (the full rate). TradeLink 247 decides this from the branch's state and the customer's (or supplier's) state, so keep the state and GSTIN filled in on Branch Details, customers and suppliers." },
      { code: "18% item, taxable value 1,000\nSame state:    CGST 9% = 90, SGST 9% = 90, bill total 1,180\nOther state:   IGST 18% = 180, bill total 1,180" },
      { h: "HSN codes" },
      { p: "Each item should carry its HSN (goods) or SAC (services) code. HSN wise Sales, HSN Sales Summary and HSN wise Purchase group your figures by these codes for the HSN summary in GSTR-1." },
      { h: "Monthly GST routine" },
      { ol: [
        "Check Sales Tax Summary and HSN Sales Summary for the month.",
        "Check HSN wise Purchase and your suppliers' filings for input tax credit.",
        "If E-Invoicing is set up, open System Administration > E-Invoicing > Tax Returns to prepare GSTR-1 and GSTR-3B from your data.",
        "Pay Output GST minus Input GST, and record the payment with Payment Entry against the GST payable accounts.",
      ] },
      { h: "E-invoicing and E-Way Bills (India)" },
      { ul: [
        "E-invoice (IRP): businesses above the government's turnover limit must register B2B invoices with the Invoice Registration Portal. The IRP returns an IRN and a signed QR code that must print on the invoice. Set up the IRP provider in E-Invoicing, then submit invoices from the Submissions panel.",
        "E-Way Bill: needed to move goods above the value limit (currently Rs 50,000 per consignment). Generate it from the E-Way Bills panel with vehicle and distance details.",
        "Cancelling: an IRN can only be cancelled within the time the portal allows (24 hours). After that, issue a credit note.",
      ] },
      { h: "Other countries" },
      { table: { head: ["Country", "Scheme", "Where"], rows: [
        ["Saudi Arabia", "ZATCA FATOORAH e-invoicing (clearance for B2B, reporting for B2C) and VAT return", "E-Invoicing"],
        ["Malaysia", "LHDN MyInvois e-invoicing", "E-Invoicing"],
        ["United Kingdom", "HMRC Making Tax Digital VAT returns", "E-Invoicing (connect to HMRC first)"],
      ] } },
      { note: "Always test with the provider's sandbox before switching to production. A document accepted in production is a legal record and cannot simply be deleted.", tone: "warn" },
      { menus: ["E-Invoicing", "Sales Tax Summary", "HSN wise Sales", "HSN Sales Summary", "HSN wise Purchase", "Sales Entry"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "background-reports",
    title: "Big reports: Run in background and My Reports",
    group: "Concepts",
    blocks: [
      { p: "Reports over long periods (for example a year of sales detail) can take minutes. Instead of waiting on screen, some reports offer \"Run in background\" and limit on-screen \"Fetch\" to short ranges (7 days or less)." },
      { ol: [
        "Open the report (e.g. Sales Report, Sales Tax Summary, HSN wise Sales) and choose the dates and filters.",
        "Click \"Run in background\". You can leave the page and keep working.",
        "Open My Reports. The request shows Queued, Running, then Ready (or Failed with the reason).",
        "Click Download when it is Ready.",
      ] },
      { ul: [
        "Files are kept for 7 days, then deleted. Download what you need to keep.",
        "Up to 3 requests per user can wait in the queue at once.",
        "A report that runs longer than 15 minutes is stopped. Split it into smaller date ranges.",
      ] },
      { menus: ["My Reports", "Sales Report", "Sales Tax Summary", "HSN wise Sales"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "tally",
    title: "Working with Tally",
    group: "Concepts",
    blocks: [
      { p: "If your accountant uses TallyPrime, TradeLink 247 can send your vouchers into Tally automatically, so nobody retypes bills. Tally only listens on your office network, so a small app, the Tally Connector, runs on a PC that can see Tally and passes the data along. All settings and the history stay in the web app." },
      { ol: [
        "In TallyPrime, press F1 Help > Settings > Connectivity, set \"TallyPrime acts as\" to Both on port 9000, and open the company.",
        "In the web app, open Accounting > Tally Integration, go to Connectors and add one. Note the server address and pairing key (valid 30 minutes).",
        "Install the Tally Connector on the Tally PC (from Download), open it, paste both values and press Pair.",
        "Back in Tally Integration, choose what to send (GL vouchers, or item invoices before accounting is switched on), how to group POS sales (per bill, daily or monthly per branch), the start date and the schedule.",
        "Map your ledgers to Tally ledger names (the connector can read Tally's list for you), or allow missing ledgers to be created automatically.",
        "Watch Accounting > Tally Sync Status: synced, pending and failed vouchers, with the reason for each failure and a Retry button.",
      ] },
      { note: "The connector sits in the Windows tray and starts with Windows. Its log is in %APPDATA%\\com.tradelink247.tallyconnector\\connector.log.", tone: "info" },
      { menus: ["Tally Integration", "Tally Sync Status", "Download"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "routines",
    title: "Daily, monthly and year-end checklists",
    group: "Concepts",
    blocks: [
      { h: "Every day (branch)" },
      { ol: [
        "Start the POS; check the pending-sync badge is zero from yesterday.",
        "Accept any incoming stock transfers.",
        "Bill through the day; record shop expenses in Daily Expense.",
        "Count cash, then run Day End on the POS. It totals sales by payment mode and prints the summary.",
      ] },
      { h: "Every day (office)" },
      { ol: [
        "Check Day End Report and Daily Cash Summary for every branch.",
        "Enter today's purchase bills (Final Save posts them to the books) and their Goods Receipts (which add the stock).",
        "Enter customer receipts and supplier payments.",
        "Look at Dashboard and Stock Anomaly Report for surprises.",
      ] },
      { h: "Every month" },
      { ol: [
        "Import the bank statement and reconcile (Bank Statements, Bank Statement Review, Bank Reconciliation).",
        "Enter branch monthly expenses (rent, salaries, power).",
        "Review Customer Aging and Supplier Aging.",
        "Prepare GST returns (Sales Tax Summary, HSN reports, E-Invoicing > Tax Returns).",
        "Check Trial Balance, Profit & Loss and Branch Profit Report.",
        "Count high-value stock; post corrections and wastage.",
        "Record the month end in Period Closing.",
      ] },
      { h: "Year end" },
      { ol: [
        "Complete a full stock count and post corrections.",
        "Review Stock Valuation and the manual rates in Cost Price History.",
        "Create the new year in Financial Year Setup and make it active. Voucher numbers restart.",
        "When the old year is final, run Year End in Period Closing and lock the old year in Financial Year Setup so nothing can be back-dated into it.",
        "Export Trial Balance, Profit & Loss and Balance Sheet for your auditor.",
      ] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "roles",
    title: "User roles and access",
    group: "Concepts",
    blocks: [
      { table: { head: ["Role", "Typical user", "Sees by default"], rows: [
        ["admin", "Owner, head office", "Everything, including setup, masters, accounting and system administration"],
        ["manager", "Area or store manager", "Dashboard, AI screens, purchases, stock, reports and accounting reports"],
        ["user", "Cashier, branch operator", "POS, KOT, purchase entry, item search and most reports"],
        ["WB", "Weighbridge operator", "Weighbridge menus only"],
        ["franchiseeuser", "Franchise owner", "Their own sales and stock reports and selected masters"],
        ["MACHINE_ADMIN", "IT person", "POS Machine Approval"],
      ] } },
      { p: "These are starting points. Create your own roles in 2. Create Roles and choose exactly which menus they get in 3. Assign Menus to Roles. A user can have several roles and sees the menus of all of them." },
      { note: "New features add new menus. Grant them in \"3. Assign Menus to Roles\" before telling staff to use them.", tone: "tip" },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "cash-summary",
    title: "Daily Cash Summary: configuration guide",
    group: "Concepts",
    blocks: [
      { p: "The Daily Cash Summary replaces a manual spreadsheet that works out how much cash each shop should send to the bank. It is built entirely from configuration, so each company sets it up once without any code change." },
      { h: "How it works" },
      { p: "A line item is one row of the formula. It has:" },
      { ul: [
        "Sign: ADD or SUBTRACT.",
        "Level: SHOP (rolls into that branch's Expected Cash to Bank) or FINAL (rolls into the company-wide total, added after every shop's own total).",
        "Source: EXPENSE_TYPES (sum of mapped expense categories for that branch and date), SALES (the branch's sales for the date), MANUAL (a figure typed in Cash Summary Manual Entries) or CONSTANT (a fixed amount).",
      ] },
      { p: "A shop's Expected Cash to Bank is the signed sum of its SHOP lines. The Final Expected Cash to Bank is the sum of every shop's total plus the signed FINAL lines." },
      { note: "One expense category can be mapped to only one active line item. This stops the same expense being counted twice. To move a category, remove it from its current line item first.", tone: "info" },
      { h: "Worked example" },
      { p: "SHOP level: Total Sales (ADD, SALES); Advance Received (ADD, EXPENSE_TYPES: Advance Received); Swiggy / Zomato (SUBTRACT, EXPENSE_TYPES: aggregator settlements); Total Expense (SUBTRACT, EXPENSE_TYPES: Shop Expense and Order Advance Adjusted)." },
      { p: "FINAL level: Farm Expense, Salary Advance and Common expenses (SUBTRACT, EXPENSE_TYPES); Proprietor Withdrawal (SUBTRACT, CONSTANT 15,000); Head-office cash receipts (ADD, MANUAL, entered once per date with no branch)." },
      { p: "Expense categories that are not mapped to any line simply play no part in the report." },
      { menus: ["Cash Summary Line Items", "Cash Summary Manual Entries", "Daily Cash Summary", "Expense Head Management"] },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "troubleshooting",
    title: "Troubleshooting and common mistakes",
    group: "Help",
    blocks: [
      { table: { head: ["Problem", "What to check"], rows: [
        ["A menu is missing", "The user's role and its menus (3. Assign Menus to Roles). Log out and in again."],
        ["New items do not show at billing", "Click Refresh Cache in the web app; on the desktop POS, log out and in, or use its refresh."],
        ["Stock upload skipped rows", "Item names must match the Item Master exactly and the Branch Code must exist. Dates must be dd/MM/yyyy."],
        ["Bills are not reaching the server", "The POS pending badge. Check the internet; the queue syncs itself. Use Reprocess Voucher for a bill stuck with an error."],
        ["New POS PC cannot log in", "Approve it in POS Machine Approval."],
        ["Blank or cut receipts", "Printer paper width in POS settings must match the Windows paper size. Use Print Test Invoice."],
        ["Trial Balance does not show today's bills", "Accounting must be set up (Accounting Setup) and bills posted. Postings can take a moment."],
        ["Bank Reconciliation shows a big difference", "Set the bank account's opening balance in Ledger Accounts to the real balance on the day tracking started."],
        ["Profit looks too high or low", "Check Stock Valuation for items with zero or odd rates, missing purchases, and negative stock."],
        ["Branch profit shows zero cost", "No purchase, transfer-in or production rate at that branch; add a manual rate in Cost Price History and re-run Cost Stamping."],
        ["GST split is wrong (IGST vs CGST/SGST)", "State on Branch Details and on the customer or supplier."],
        ["Salesman report locked on POS", "Run Day End first."],
        ["Report says to use Run in background", "The date range is too long to fetch on screen. Use Run in background and download from My Reports."],
      ] } },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "glossary",
    title: "Glossary",
    group: "Help",
    blocks: [
      { table: { head: ["Term", "Meaning"], rows: [
        ["AR / Accounts Receivable", "Money customers owe you."],
        ["AP / Accounts Payable", "Money you owe suppliers."],
        ["Batch", "A lot of stock (with its own expiry, if tracked). NB = no batch."],
        ["COGS", "Cost of goods sold: what the goods you sold cost you."],
        ["Credit note", "A document that reduces a sale (return, discount after billing)."],
        ["Day End", "The end-of-day close on the POS, totalling sales by payment mode."],
        ["E-Way Bill", "Indian permit to move goods above the value limit."],
        ["GSTIN", "15-character GST registration number."],
        ["HSN / SAC", "Tax classification codes for goods / services."],
        ["Input tax credit (ITC)", "GST paid on purchases that you can set off against GST collected."],
        ["IRN", "Invoice Reference Number returned by the IRP for an e-invoice."],
        ["KOT", "Kitchen Order Ticket: an order sent to the kitchen before billing."],
        ["Ledger", "The list of all entries in one account."],
        ["Periodic stock", "Cost of goods sold worked out from opening stock + purchases - closing stock, rather than posted with each sale."],
        ["Scheme", "A promotion (free item, discount, cash back) applied automatically at billing."],
        ["Taxable value", "Price before GST."],
        ["Trial Balance", "List of all account balances; debits must equal credits."],
        ["Voucher", "Any numbered transaction."],
      ] } },
    ],
  },

  // ---------------------------------------------------------------------------
  {
    id: "support",
    title: "Contact support",
    group: "Help",
    blocks: [
      { p: "If something is not covered here, email erp.nexsol@gmail.com with your company name, the menu you were using, what you expected and what happened. A screenshot helps a lot." },
    ],
  },
];

export default guides;
