// Help content: Accounting. Keys must match menuKey in src/menuCatalog.js.
const content = {
  "Accounting Setup": {
    summary:
      "One-time setup that creates the standard chart of accounts and voucher types for your company. Nothing in Accounting works until this has been run once.",
    steps: [
      "Open Accounting > Accounting Setup.",
      "Look at the chip near the top: it says \"Not initialised\" or \"N accounts configured\".",
      "Click \"Initialise Chart of Accounts\".",
      "Wait for the green message, then check the \"Current Chart of Accounts\" table below.",
      "Go to Ledger Accounts if you need to add your own accounts (a second bank, extra expense heads) on top of the standard ones.",
    ],
    fields: [
      { name: "Code", desc: "The account number. Reports and postings refer to accounts by this code." },
      { name: "Type", desc: "ASSET, LIABILITY, EQUITY, INCOME or EXPENSE. Decides which side of the Balance Sheet or P&L the account lands on." },
      { name: "Cash / Bank", desc: "A tick marks the account as real money. Only ticked accounts can be chosen in Receipt Entry, Payment Entry and Bank Reconciliation." },
    ],
    tips: [
      "Safe to run more than once. Accounts that already exist are left alone, so nothing is overwritten and no balance is lost.",
      "The accounts it creates are: 1001 Cash in Hand, 1002 Bank Account, 1010 Card POS Receipts, 1015 UPI Receipts, 1100 Accounts Receivable, 1200 Inventory, 5100 Input CGST, 5101 Input SGST, 5102 Input IGST (all three are current assets, because input GST is recoverable), 2100 Accounts Payable, 2200 / 2201 / 2202 Output CGST / SGST / IGST Payable, 2300 Accrued Branch Expenses, 2400 Customer Advances Received, 3000 Capital, 3100 Retained Earnings, 4000 Sales Revenue, 4900 Other Income, 5000 Cost of Goods Sold, 5200 Purchase Account and 5300 Operating Expenses.",
      "It also creates the voucher types: Sales, Purchase, Receipt, Payment, Journal, Contra, Debit Note, Credit Note, Stock Journal, Branch Transfer and Opening Balance.",
      "Accounts marked \"System\" cannot be edited or deactivated later, because postings depend on them.",
      "Set up a financial year first (Financial Year Setup). No voucher can be posted on a date that falls outside an active, unlocked financial year.",
    ],
    related: ["Ledger Accounts", "Financial Year Setup", "Expense Head Management"],
  },

  "Ledger Accounts": {
    summary:
      "Your chart of accounts: add, edit and deactivate the accounts everything else posts to, and set their opening balances.",
    steps: [
      "Open Accounting > Ledger Accounts.",
      "Use the search box to find an account by code or name, or the \"Type\" box to show only assets, liabilities, equity, income or expenses.",
      "Click \"New Account\" to add one, or the pencil icon on a row to change one.",
      "Pick the \"Account Group\" first. The account type is taken from the group and shown beside it.",
      "Fill in \"Account Code\" and \"Account Name\", then turn on any flags that apply (Cash Account, Bank Account, GST Input, GST Output, COGS, Inventory).",
      "For a bank account, fill in \"Bank Name\", \"Account Number\" and \"IFSC\" in the Bank Details box that appears.",
      "Enter \"Opening Dr\" or \"Opening Cr\" if the account starts with a balance, then click \"Save\".",
      "To stop using an account, click the red block icon and confirm \"Deactivate this account?\".",
    ],
    fields: [
      { name: "Account Code", desc: "A short number you choose. It cannot be changed once the account is saved." },
      { name: "Cash Account / Bank Account", desc: "Only accounts with one of these ticked appear in the Cash / Bank lists on Receipt Entry and Payment Entry, and only bank accounts appear in Bank Reconciliation and Bank Statements." },
      { name: "Opening Dr / Opening Cr", desc: "The balance the account carried into the financial year. Fill in one, leave the other blank." },
    ],
    tips: [
      "Accounts marked \"System\" (the ones Accounting Setup created) cannot be edited or deactivated. Their pencil icon is greyed out.",
      "A bank account with no opening balance makes Bank Reconciliation useless, because the GL balance it compares against will be wrong. Set it before you reconcile.",
      "Deactivating is not deleting. Past entries stay in the books and still show on reports.",
    ],
    related: ["Accounting Setup", "Trial Balance", "Bank Reconciliation"],
  },

  "Expense Head Management": {
    summary:
      "The master list of expense heads used by shop and branch expense entry, and the link from each head to the ledger account its money posts to.",
    steps: [
      "Open Accounting > Expense Head Management.",
      "Click \"Init Accounting\" once, to auto-create ledger accounts for the standard expense heads and link them.",
      "Click \"Add Expense Head\" for anything of your own, fill in \"Name\", \"Code\" and \"Sort Order\", then \"Save\".",
      "For each head, click the link icon to open \"Link GL Account\". Choose the \"Posting Behavior\", then the ledger account, then \"Link\".",
      "Click the shop icon to open \"Assign Branches\" and tick the branches that may use this head for daily expense entry on the POS, then \"Save\".",
      "If some expenses were saved before their head was linked, click \"Post Unposted\" to push them into the books now.",
    ],
    fields: [
      { name: "Posting Behavior — Expense (cash/bank goes out)", desc: "The normal case. Pick an EXPENSE ledger account; it is debited and cash or bank is credited." },
      { name: "Posting Behavior — Advance Received (cash/bank comes in)", desc: "Money taken in, such as an order advance. Pick a LIABILITY account; cash or bank is debited and that account credited." },
      { name: "Posting Behavior — Advance Adjusted", desc: "A previously received advance now applied against a sale. No cash moves: the liability account is debited and 1100 Accounts Receivable credited." },
      { name: "POS Branches", desc: "A head with no branch assigned shows \"None — POS can't use this yet\" and will not appear on the POS." },
    ],
    tips: [
      "A head with no GL account shows \"Not linked\". Expenses under it are still saved but nothing reaches the books until you link it and click \"Post Unposted\".",
      "\"Default\" heads come with the system; \"Custom\" ones are yours. Deleting a head that has been used is not a good idea — its history goes with it.",
      "Cash Summary Line Items maps these same heads into the daily cash summary formula, so renaming one changes what that report shows.",
    ],
    related: ["Shop Expense Report", "Branch Monthly Expense", "Cash Summary Line Items", "Ledger Accounts"],
  },

  "Financial Year Setup": {
    summary:
      "Defines your accounting years and says which one is active. Vouchers can only be posted on dates inside the active, unlocked year.",
    steps: [
      "Open Accounting > Financial Year Setup.",
      "The card on the left shows the active year: its FY Code, start and end dates.",
      "Click \"Create Financial Year\". The form suggests 1 April to 31 March; change the dates if your year runs differently.",
      "Type the \"FY Code\" (for example 2025-2026), tick \"Make Active\" if it should take over now, and save.",
      "To switch later, click \"Activate\" on a row in the \"Financial Years\" table and confirm.",
    ],
    tips: [
      "Activating a year resets voucher numbering for the new year. The confirmation box warns you about this.",
      "Any bill, receipt or payment dated outside an active financial year is rejected when it tries to post to the books. If postings suddenly start failing, check here first.",
      "A locked year accepts no new postings at all.",
      "Most accounting screens open with their From and To dates already set to the active year.",
    ],
    related: ["Accounting Setup", "Period Closing"],
  },

  "Receipt Entry": {
    summary:
      "Record money received from a customer and settle it against their unpaid sales invoices.",
    steps: [
      "Open Accounting > Receipt Entry.",
      "Search for the customer in the \"Customer\" box. Their unpaid invoices load underneath.",
      "In the \"Allocate\" column, type how much of this receipt goes against each invoice. You cannot allocate more than the outstanding amount shown.",
      "Set \"Receipt Date\", pick the \"Payment Mode\" (CASH, CHEQUE, NEFT, UPI or CARD) and the \"Cash / Bank Account\" the money went into.",
      "Type a \"Narration\" if it helps you recognise the entry later.",
      "Check the Total at the bottom, then click \"Post Receipt\".",
    ],
    fields: [
      { name: "Outstanding", desc: "Invoice amount less what has already been received against it." },
      { name: "Cash / Bank Account", desc: "Only accounts flagged as cash or bank in Ledger Accounts appear here." },
    ],
    tips: [
      "\"Post Receipt\" stays greyed out until you have allocated at least some amount.",
      "Payment Mode is a label on the entry; the account that actually moves is the one you pick in \"Cash / Bank Account\". Choosing the wrong one is the most common mistake.",
      "A posted receipt shows immediately on the Customer Statement and reduces Customer Aging.",
    ],
    accounting:
      "DR the chosen Cash / Bank account with the total received, CR 1100 Accounts Receivable with the same amount. No effect on stock.",
    related: ["Customer Statement", "Customer Aging", "Payment Entry"],
  },

  "Payment Entry": {
    summary:
      "Record money paid to a supplier and settle it against their unpaid purchase bills.",
    steps: [
      "Open Accounting > Payment Entry.",
      "Search for the supplier in the \"Supplier\" box. Their unpaid bills load underneath.",
      "In the \"Allocate\" column, type how much of this payment goes against each bill.",
      "Set \"Payment Date\", pick the \"Payment Mode\" and the \"Cash / Bank Account\" the money left from.",
      "Add a \"Narration\" if useful.",
      "Check the Total, then click \"Post Payment\".",
    ],
    tips: [
      "\"Post Payment\" is greyed out until something is allocated.",
      "Pay from the account the money really left, not the first one in the list, or Bank Reconciliation will not match later.",
      "The payment appears at once on the Supplier Statement and reduces Supplier Aging.",
    ],
    accounting:
      "DR 2100 Accounts Payable with the total paid, CR the chosen Cash / Bank account. No effect on stock.",
    related: ["Supplier Statement", "Supplier Aging", "Receipt Entry"],
  },

  "Branch Monthly Expense": {
    summary:
      "Enter a branch's fixed monthly expenses — rent, salaries, electricity and so on — one figure per expense type per month.",
    steps: [
      "Open Accounting > Branch Monthly Expense.",
      "Pick the \"Branch\", \"Month\" and \"Year\". Anything already entered appears in the table with a running total.",
      "Click \"Add Expense\".",
      "Choose the \"Expense Type\", type the \"Amount (₹)\" and any \"Remarks\", then click \"Save\".",
      "Use the pencil icon to change a figure, or the red bin icon to remove one.",
      "Click the refresh arrow at any time to reload the month.",
    ],
    tips: [
      "Each expense type can be used only once per branch per month. Types already added show \"(already added)\" and cannot be picked again — edit the existing row instead.",
      "These figures are what the Monthly Branch Profit Report subtracts from gross profit, so a month left blank makes that branch look more profitable than it is.",
      "Expense types come from Expense Head Management. A type with no ledger account linked is saved but does not reach the books.",
    ],
    accounting:
      "DR the expense head's linked ledger account, CR 2300 Accrued Branch Expenses. Posting is best effort: if it fails, the expense is still saved and can be pushed later with \"Post Unposted\" on Expense Head Management.",
    related: ["Expense Head Management", "Monthly Branch Profit Report", "Shop Expense Report"],
  },

  "Shop Expense Report": {
    summary:
      "Every day-to-day shop expense across branches, with totals by branch, expense head and payment mode, and the ability to correct or void an entry.",
    steps: [
      "Open Accounting > Shop Expense Report.",
      "Set \"From Date\" and \"To Date\", then choose one or more branches in \"Branches\" (at least one is required).",
      "Narrow further if you want: \"All Expense Heads\", \"All Payment Modes\", \"Entered By\", \"All Status\" or a \"Voucher No\".",
      "Click \"Run Report\". Chips at the top show the overall total and a total per branch.",
      "Use \"Previous\" and \"Next\" under the table to move through pages.",
      "Click \"Export Excel\" for the whole result — not just the page on screen — with separate sheets for the branch, head and payment-mode summaries.",
      "On a row, click \"Correct\" to change the amount, \"Void\" to cancel it, or \"History\" to see what was changed and why.",
    ],
    fields: [
      { name: "Status", desc: "ACTIVE or VOIDED. A voided expense stays visible but no longer counts, and cannot be corrected or voided again." },
      { name: "Reason", desc: "Required on both Correct and Void. It is kept in the history so anyone can see why the figure changed." },
    ],
    tips: [
      "The table is grouped by branch, then date, then voucher number.",
      "Correcting or voiding writes an adjusting entry to the books; it does not quietly rewrite the original.",
    ],
    accounting:
      "Each expense posts DR the expense head's linked ledger account and CR the branch's Cash in Hand account when the mode is CASH, or CR 1002 Bank Account for CARD, UPI, BANK_TRANSFER and OTHER. Heads set up as \"Advance Received\" post the other way round (DR cash/bank, CR the liability account); \"Advance Adjusted\" heads post DR the liability account, CR 1100 Accounts Receivable with no cash movement.",
    related: ["Expense Head Management", "Branch Monthly Expense", "Daily Cash Summary"],
  },

  "Inter-Branch Transfer": {
    summary:
      "Record goods or value moved from one branch to another and raise the matching receivable and payable between them.",
    steps: [
      "Open Accounting > Inter-Branch Transfer.",
      "Type the \"From Branch\" and \"To Branch\" codes and set the \"Transfer Date\".",
      "Choose the \"Inter-Branch Receivable A/c\" (the sending branch's side) and the \"Inter-Branch Payable A/c\" (the receiving branch's side).",
      "Fill in the line items: \"Item ID\", \"Description\", \"Qty\" and \"Unit Cost\". Click \"Add Line\" for more rows, or the bin icon to drop one.",
      "Check the Total, then click \"Post Transfer\".",
      "To review past transfers, set the \"From\" and \"To\" dates under \"Transfer History\" and click \"Load\".",
    ],
    tips: [
      "Both branch codes and both accounts are required; the screen refuses to post without them.",
      "Branch codes are typed here, not picked from a list, so a typo posts to a branch that does not exist. Copy them from the branch master if unsure.",
      "You must create the two inter-branch accounts yourself in Ledger Accounts — they are not part of the standard chart of accounts.",
    ],
    accounting:
      "DR the Inter-Branch Receivable account of the sending branch, CR the Inter-Branch Payable account of the receiving branch, for the total value of the lines.",
    related: ["Ledger Accounts", "Inventory Ledger", "Trial Balance"],
  },

  "Trial Balance": {
    summary:
      "Every ledger account with its debits, credits and net balance for a date range, and a check that the two sides agree. The usual starting point when a figure looks wrong.",
    steps: [
      "Open Accounting > Trial Balance. The dates are already set to the active financial year.",
      "Adjust \"From\" and \"To\", and pick a \"Branch\" or leave it on \"All Branches\".",
      "Click \"Generate\".",
      "Read the footer: a green \"✓ Balanced\" chip means total debits equal total credits. A red \"✗ Off by …\" chip means something is wrong and should be investigated before you trust the P&L or Balance Sheet.",
      "Click any account row to open its ledger for the same dates and branch.",
      "Inside that ledger, click a voucher to see the bill behind it; from the voucher you can jump to any other account on it.",
      "Click \"Export Excel\" to save the list.",
    ],
    fields: [
      { name: "Debit / Credit", desc: "The total movement on each side for the period." },
      { name: "Net Balance", desc: "Debits less credits for the account." },
    ],
    tips: [
      "The drill-down uses the dates and branch the report was generated with, not whatever you have typed in since. Click \"Generate\" again after changing the filters.",
      "Only branches you are allowed to see appear in the Branch list.",
      "Out of balance usually means a voucher was posted directly to the database or a posting failed halfway. Check the Ledger Statement of the accounts with the largest movements.",
    ],
    related: ["Ledger Statement", "Profit & Loss", "Balance Sheet"],
  },

  "Ledger Statement": {
    summary:
      "The full entry-by-entry history of one ledger account, with opening balance, running balance and closing balance.",
    steps: [
      "Open Accounting > Ledger Statement.",
      "Pick the \"Account\", set \"From\" and \"To\", and choose a \"Branch\" or leave it on \"All Branches\".",
      "Click \"Load\".",
      "The chips above the table show the opening and closing balance for the range.",
      "Click a voucher number to open the voucher; from there you can click another account on it to jump this statement straight to that account, keeping the same dates and branch.",
      "Click \"Export Excel\" to save it.",
    ],
    fields: [
      { name: "Type", desc: "The voucher type code — INV for a sales bill, PUR for a purchase, RCP for a receipt, PAY for a payment, JV for a journal, and so on." },
      { name: "Balance", desc: "The running balance after each entry, starting from the opening balance." },
    ],
    tips: [
      "This is the screen to send a customer or supplier when they query a figure, and the fastest way to find a wrong posting.",
      "If an entry you expect is missing, check that its date falls in the range and that the branch filter is not excluding it.",
    ],
    related: ["Trial Balance", "Customer Statement", "Supplier Statement"],
  },

  "Profit & Loss": {
    summary:
      "Revenue, cost of goods sold, gross profit, operating expenses and net profit for a date range, with stock properly taken into account.",
    steps: [
      "Open Accounting > Profit & Loss. The dates default to the active financial year.",
      "Set \"From\" and \"To\", and type a branch code in \"Branch\" or leave it blank for all branches.",
      "Click \"Generate\".",
      "Read down the statement: Revenue, then Cost of Goods Sold, then Gross Profit, then Operating Expenses, then Net Profit (or Net Loss, shown in red).",
      "Click any account line to see its entries for the period, then a voucher to see the bill behind it.",
      "Click \"Export Excel\" to save the statement.",
    ],
    fields: [
      { name: "Opening Stock / Less: Closing Stock", desc: "The two stock lines inside Cost of Goods Sold. They have no account code and no drill-down because they are valued live from the stock ledger, not from a posted entry." },
      { name: "Gross Profit", desc: "Revenue less cost of goods sold." },
      { name: "Net Profit", desc: "Gross profit less operating expenses." },
    ],
    tips: [
      "The books are kept on a periodic basis. Buying goods debits 5200 Purchase Account straight away, and selling them posts no cost entry at all. So cost of goods sold here is opening stock + purchases − closing stock.",
      "Opening stock is valued on the day before the From date and closing stock on the To date, live from the stock ledger. That is why the P&L is correct for any date range without needing a month-end stock entry, and why the same range can give slightly different figures if someone corrects stock afterwards.",
      "Stock is valued per item and branch at the first rate that exists: a manual cost rate you set, else the latest rate that item was received at in that branch, else the average pre-tax purchase cost across all purchases, else the item master's purchase rate.",
      "Closing stock should agree with the Stock Valuation report for the same date. If it does not, a stock rate is missing — set it in Cost Price History.",
      "The operating-expense section only shows what has actually posted. Expense heads with no ledger account linked are invisible here.",
    ],
    accounting:
      "Nothing is posted by this screen; it only reads the books and the stock ledger.",
    related: ["Balance Sheet", "Trial Balance", "Stock Valuation", "Branch Profit Report"],
  },

  "Balance Sheet": {
    summary:
      "Assets on one side, liabilities and equity on the other, as of a chosen date, with each account's opening balance, movement and closing balance.",
    steps: [
      "Open Accounting > Balance Sheet.",
      "Set the \"As of Date\" and pick a \"Branch\" or leave it on \"All Branches\".",
      "Click \"Generate\".",
      "Check the chip beside the buttons: \"✓ Balanced\" or \"✗ Out of Balance\".",
      "Read Assets on the left; Liabilities, Equity, Current Year Profit and the Total Liabilities + Equity line on the right.",
      "Click any account row to see its entries, then a voucher to see the bill behind it.",
      "Click \"Export Excel\" to save it.",
    ],
    fields: [
      { name: "Opening", desc: "The balance carried into the financial year." },
      { name: "Movement", desc: "Everything posted from the start of the financial year up to the As of Date." },
      { name: "Closing Stock", desc: "An asset line with no account code. Because the books are periodic, nothing is posted to the inventory account, so the sheet shows the same live stock value the P&L uses." },
      { name: "Difference in Opening Stock", desc: "An equity line for stock that was on hand before the books started and is not carried in the inventory account's opening balance. It keeps the sheet balanced. It only appears when there is such a difference." },
      { name: "Current Year Profit", desc: "Net profit from the P&L for the current financial year, shown inside equity." },
    ],
    tips: [
      "The report always runs from the start of the financial year to the As of Date, so the drill-down covers that whole span, not just one month.",
      "If it says \"Out of Balance\", run the Trial Balance for the same period first — the cause is almost always visible there.",
    ],
    related: ["Profit & Loss", "Trial Balance", "Stock Valuation"],
  },

  "Cash Flow": {
    summary:
      "Every movement through your cash and bank accounts for a date range, in order, with a running balance.",
    steps: [
      "Open Accounting > Cash Flow.",
      "Set \"From\" and \"To\", and type a branch code in \"Branch\" or leave it blank for all.",
      "Click \"Generate\".",
      "Read the chips: Opening, Inflow, Outflow and Closing balance.",
      "Go down the table for each movement; \"Module\" says where it came from (sales, purchase, receipt, payment, shop expense and so on).",
      "Click \"Export Excel\" to save it.",
    ],
    tips: [
      "Only accounts flagged as cash or bank in Ledger Accounts appear here.",
      "This answers \"where did the money go\" much faster than the Trial Balance, because it is already in date order with a running balance.",
    ],
    related: ["Bank Reconciliation", "Daily Cash Summary", "Ledger Statement"],
  },

  "Customer Statement": {
    summary:
      "One customer's invoices, receipts and running balance for a date range — the statement you send when they query their account.",
    steps: [
      "Open Accounting > Customer Statement.",
      "Search for the customer in the \"Customer\" box.",
      "Set \"From\" and \"To\" (they default to the active financial year).",
      "Click \"Load\".",
      "The chip above the table shows the closing balance. A positive figure means they still owe you.",
      "Click \"Export Excel\" to send it to them.",
    ],
    fields: [
      { name: "Type", desc: "INVOICE, RECEIPT or PAYMENT." },
      { name: "Debit (AR)", desc: "Increases what the customer owes — normally an invoice." },
      { name: "Credit", desc: "Reduces what they owe — normally a receipt." },
    ],
    tips: [
      "If a payment they insist they made is missing, it was probably never entered in Receipt Entry, or was allocated to a different customer.",
    ],
    related: ["Receipt Entry", "Customer Aging", "Ledger Statement"],
  },

  "Supplier Statement": {
    summary:
      "One supplier's bills, payments and running balance for a date range.",
    steps: [
      "Open Accounting > Supplier Statement.",
      "Search for the supplier in the \"Supplier\" box.",
      "Set \"From\" and \"To\".",
      "Click \"Load\".",
      "The chip above the table shows the closing balance. A positive figure means you still owe them.",
      "Click \"Export Excel\" to save or send it.",
    ],
    fields: [
      { name: "Credit (AP)", desc: "Increases what you owe — normally a purchase bill." },
      { name: "Debit", desc: "Reduces what you owe — normally a payment." },
    ],
    tips: [
      "Reconcile this against the supplier's own statement before paying, then settle the difference in Payment Entry.",
    ],
    related: ["Payment Entry", "Supplier Aging", "Ledger Statement"],
  },

  "Customer Aging": {
    summary:
      "How overdue your receivables are, split into 0-30, 31-60, 61-90 and 90+ day buckets, for every customer.",
    steps: [
      "Open Accounting > Customer Aging.",
      "Set the \"As of Date\".",
      "Click \"Generate\".",
      "The chips show the company totals per bucket; the table breaks it down by customer.",
      "Click \"Export Excel\" for the full list.",
    ],
    tips: [
      "Work the 90+ column first — that is the money most at risk.",
      "The total here should agree with the 1100 Accounts Receivable balance on the Balance Sheet for the same date. A gap means a receipt was posted without being allocated to an invoice.",
    ],
    related: ["Customer Statement", "Receipt Entry"],
  },

  "Supplier Aging": {
    summary:
      "How overdue your payables are, split into 0-30, 31-60, 61-90 and 90+ day buckets, for every supplier.",
    steps: [
      "Open Accounting > Supplier Aging.",
      "Set the \"As of Date\".",
      "Click \"Generate\".",
      "Read the chips for the company totals per bucket and the table for each supplier.",
      "Click \"Export Excel\" for the full list.",
    ],
    tips: [
      "Use this to plan payments: clear the 90+ column before it becomes a supply problem.",
      "The total should agree with 2100 Accounts Payable on the Balance Sheet for the same date.",
    ],
    related: ["Supplier Statement", "Payment Entry"],
  },

  "Bank Reconciliation": {
    summary:
      "Match your bank statement lines against what the books say, so the two balances agree at the end of the month.",
    steps: [
      "Open Accounting > Bank Reconciliation.",
      "Pick the \"Bank Account\", set \"From\" and \"To\", and click \"Load\".",
      "Read the chips: GL Balance, Statement Balance, Difference, and how many entries on each side are still unmatched.",
      "On the \"Match\" tab, click one line on the left (bank statement) and one on the right (books), then click \"Match ↔\".",
      "For a statement line with no entry in the books — bank charges, interest, an unrecognised transfer — select it, pick an \"Offset Account\", add a \"Narration (optional)\" and click \"Post as Journal Entry\". That creates the missing entry and reconciles the line in one go.",
      "Use the \"Add Statement Line\" tab to key in a line by hand: Date, Description, \"Debit (OUT)\" or \"Credit (IN)\", and a Reference, then \"Add\".",
      "Use the \"All Statements\" tab to see what is reconciled, and click \"Unmatch\" to undo a match.",
    ],
    tips: [
      "The bank account's opening balance must be set in Ledger Accounts first. Without it the GL Balance is wrong and the Difference will never come to zero, however carefully you match.",
      "Only accounts with the Bank flag appear in the account list.",
      "Load the statement lines with Bank Statements (PDF import) rather than typing them, unless it is just one or two.",
      "Reconcile in date order; matching the easy large items first leaves the genuine differences visible.",
    ],
    accounting:
      "Matching posts nothing — it only links a statement line to an existing entry. \"Post as Journal Entry\" posts a real journal: DR or CR the bank account for the statement amount, with the opposite side on the offset account you chose.",
    related: ["Bank Statements", "Bank Statement Review", "Cash Flow", "Ledger Accounts"],
  },

  "Bank Statements": {
    summary:
      "Upload an ICICI or Axis bank statement PDF so its lines are available for reconciliation, and download a combined daily transaction report.",
    steps: [
      "Open Accounting > Bank Statements.",
      "Pick the \"Bank Account\". The bank configured on that account decides how the PDF is read.",
      "Click \"Choose PDF\", select the file, then click \"Upload\".",
      "Read the message: it either says how many rows were imported and the period covered, or why the file was rejected.",
      "Under \"Daily Transaction Report\", set \"From\" and \"To\" (or leave both blank for everything imported) and click \"Download Excel\" — one tab per date, both banks combined, with Type, Bank, Amount and Party / Comment.",
      "The \"Recent imports for this account\" table lists each file, its period, row count, opening and closing balance and status. Use the red bin icon to delete a bad import.",
    ],
    tips: [
      "Only ICICI and Axis statements are recognised. An account showing \"— no bank configured\" cannot be parsed: set Bank Name on the account in Ledger Accounts first.",
      "Uploading the same file twice is detected and flagged \"Already imported\" rather than duplicating the rows.",
      "Deleting an import cannot be undone, and it removes all the rows that came in with it.",
      "After importing, resolve any unnamed lines in Bank Statement Review, then match them in Bank Reconciliation.",
    ],
    related: ["Bank Statement Review", "Bank Narration Rules", "Bank Reconciliation"],
  },

  "Bank Narration Rules": {
    summary:
      "Rules that read a bank statement narration and work out who the other party is and what kind of transaction it was, so imported lines name themselves.",
    steps: [
      "Open Accounting > Bank Narration Rules.",
      "Click \"New Rule\".",
      "Leave \"Bank\" blank to apply to every bank, or type a bank name to limit it.",
      "Pick the \"Match Type\": CONTAINS (a case-insensitive substring), PREFIX (the narration must start with it) or REGEX.",
      "Type the \"Pattern\" the narration must match.",
      "Set a \"Counterparty\", a \"Category\", or both — a rule needs at least one of them.",
      "Set the \"Priority\" (lower runs first), leave \"Active\" on, and click \"Save\".",
      "Use the pencil icon to change a rule or the red bin icon to delete it.",
    ],
    tips: [
      "Rules are applied in priority order when a statement is imported, so put your most specific patterns on a low number.",
      "Nothing is guessed. A line no rule claims is simply left unresolved and waits for you in Bank Statement Review.",
      "Changing a rule affects future imports, not lines already imported. Use \"Re-run Resolution\" on Bank Statement Review to reapply them.",
    ],
    related: ["Bank Statement Review", "Bank Statements"],
  },

  "Bank Statement Review": {
    summary:
      "The imported bank lines that no narration rule could place. Name them one at a time, and optionally turn each correction into a rule.",
    steps: [
      "Open Accounting > Bank Statement Review.",
      "Pick the \"Bank Account\". Unresolved lines for that account appear.",
      "Click \"Re-run Resolution\" first — new or edited rules may clear several rows at once.",
      "For a row that remains, type or pick the \"Counterparty\", choose a \"Category\", or both.",
      "To stop the same narration coming back, tick \"Save as rule\" and check the pattern it suggests, editing it if it is too broad or too narrow.",
      "Click \"Save\". The row disappears from the list.",
    ],
    tips: [
      "A counterparty or a category is required — saving with neither is refused.",
      "The suggested pattern is taken from the narration and is often longer than it needs to be. A shorter, distinctive piece of text catches more future lines.",
      "Do this before Bank Reconciliation; named lines are far easier to match.",
    ],
    related: ["Bank Narration Rules", "Bank Statements", "Bank Reconciliation"],
  },

  "Cash Summary Line Items": {
    summary:
      "Builds the formula behind the Daily Cash Summary: which figures are added, which are subtracted, and where each one comes from.",
    steps: [
      "Open Accounting > Cash Summary Line Items.",
      "Click \"New Line Item\".",
      "Type the \"Label\" that should appear on the report.",
      "Choose the \"Sign\" (ADD or SUBTRACT) and the \"Level\" (SHOP for a line inside each shop's block, FINAL for the company-wide reconciliation at the bottom).",
      "Choose the \"Source\": EXPENSE_TYPES (then tick the expense categories it covers), SALES (taken from sales, the one built-in source), MANUAL (keyed in under Cash Summary Manual Entries) or CONSTANT (then type the \"Amount\").",
      "Set the \"Sort Order\" — this is the order the lines print in — leave \"Active\" on, and click \"Save\".",
      "Use the pencil icon to edit a line or the red bin icon to delete it.",
    ],
    tips: [
      "A shop's Expected Cash to Bank is the signed sum of its SHOP-level lines. The Final Expected Cash to Bank is the total of every shop, plus the signed sum of the FINAL-level lines.",
      "An expense category can belong to at most one line item, so nothing is counted twice.",
      "Get the signs right. An expense paid out of the till reduces the cash to bank, so it is SUBTRACT.",
      "Changing this changes both the Daily Cash Summary and the Expected Cash to Bank used by the Excess / Shortage Report.",
    ],
    related: ["Daily Cash Summary", "Cash Summary Manual Entries", "Excess Shortage Report", "Expense Head Management"],
  },

  "Cash Summary Manual Entries": {
    summary:
      "Key in the daily figures for cash-summary lines that have no source anywhere else in the system.",
    steps: [
      "Open Accounting > Cash Summary Manual Entries.",
      "Pick the \"Line Item\". Only lines set up with source type MANUAL appear.",
      "Set the \"Date\", choose a \"Branch (optional)\" or leave it on \"(company-wide)\".",
      "Type the \"Amount\" and any \"Remarks\", then click \"Add\".",
      "The table below lists the entries already made for that line item, with who entered each one. Use the red bin icon to delete one.",
    ],
    tips: [
      "If the screen says no line item is configured with source type MANUAL, set one up first under Cash Summary Line Items.",
      "Leave the branch blank only for a genuinely company-wide figure; a shop-level line needs its branch or it will not show in that shop's block.",
      "Enter these before running the Daily Cash Summary for the day, or the figure will simply be missing.",
    ],
    related: ["Cash Summary Line Items", "Daily Cash Summary"],
  },

  "Daily Cash Summary": {
    summary:
      "For one day: each shop's expected cash to bank, then the company-wide reconciliation, built from the line items you configured.",
    steps: [
      "Open Accounting > Daily Cash Summary.",
      "Set the \"Date\".",
      "Click \"Run Report\".",
      "Each shop gets its own block: the configured lines with + or − against each, then its \"Expected Cash to Bank\".",
      "Under \"Final Reconciliation\", the \"Sum of Shop Totals\" is followed by the company-wide lines and the \"Final Expected Cash to Bank\".",
      "Click \"Download Excel\" to save the same thing as a spreadsheet.",
    ],
    tips: [
      "Nothing here is hard-coded. Every line comes from Cash Summary Line Items, so if a figure is missing or in the wrong place, that is where to fix it.",
      "Lines with several entries are listed individually with their remarks and then totalled.",
      "\"Expected Cash to Bank\" is what the Excess / Shortage Report compares the branch's counted cash against, so run this first when a shortage is queried.",
    ],
    related: ["Cash Summary Line Items", "Cash Summary Manual Entries", "Excess Shortage Report"],
  },

  "Excess Shortage Report": {
    summary:
      "Compares the cash each branch counted and entered at Day End with the Expected Cash to Bank, showing who is over and who is short — for a single day, or as a monthly pattern.",
    steps: [
      "Open Accounting > Excess / Shortage Report.",
      "On the \"Daily\" tab, set the \"Date\" and click \"Run Report\".",
      "Read the \"Difference\" column: a positive figure is an excess, a negative one is a shortage. The \"Status\" chip says Excess, Shortage, Tally (they agree) or Not entered (no Day End for that branch).",
      "Click \"Export to Excel\" to save the day.",
      "Switch to the \"Monthly Analysis\" tab, set \"From month\" and \"To month\" and run it to see net difference by branch and month, days entered, shortage days, excess days, missing Day Ends and the average per day.",
    ],
    fields: [
      { name: "Day End Collected", desc: "The cash the branch counted and entered at Day End." },
      { name: "Expected Cash to Bank", desc: "The figure from the Daily Cash Summary for that branch and date." },
      { name: "Total Sales / Cash Sales / Other Modes", desc: "Shown for reference only; they do not enter the difference. Cash Sales is cash receipts net of cash returns, Other Modes covers card, UPI and delivery apps. Total Sales also carries the small bill round-off." },
    ],
    tips: [
      "Difference = Day End Collected − Expected Cash to Bank.",
      "\"Not entered\" is not a zero shortage — the branch simply never did its Day End. Chase it before reading anything into the totals.",
      "A branch that is short a small amount every single day is usually a configuration problem in Cash Summary Line Items, not theft. The Monthly Analysis tab makes that pattern obvious.",
    ],
    related: ["Daily Cash Summary", "Cash Summary Line Items"],
  },

  "Inventory Ledger": {
    summary:
      "Every stock movement for one item: what came in, what went out, and the quantity left after each movement.",
    steps: [
      "Open Accounting > Inventory Ledger.",
      "Type the \"Item ID\".",
      "Type a \"Branch Code\" or leave it blank for all branches.",
      "Set \"From\" and \"To\", then click \"Load\".",
      "Read the table: \"Qty In\", \"Qty Out\" and \"Closing Qty\" after each movement, with the voucher and its type.",
      "Click \"Export Excel\" to save it.",
    ],
    tips: [
      "The item is entered by ID, not picked from a list — copy it from the item master or from a report rather than typing from memory.",
      "Quantities show four decimal places, so weighed items reconcile exactly.",
      "This is the screen that answers \"where did this stock go\". If the closing quantity looks wrong, the culprit is usually a movement with an unexpected voucher type.",
    ],
    related: ["Stock Valuation", "Profit & Loss"],
  },

  "Stock Valuation": {
    summary:
      "What your stock is worth on a given date, item by item and branch by branch.",
    steps: [
      "Open Accounting > Stock Valuation.",
      "Set the \"As of Date\".",
      "Type a \"Branch Code\" or leave it blank for all branches.",
      "Click \"Generate\". The chip and the footer show the total stock value.",
      "Click \"Export Excel\" to save it.",
    ],
    fields: [
      { name: "Purchase Rate", desc: "The unit cost used to value the item at that branch." },
      { name: "Stock Value", desc: "Closing quantity times that rate." },
    ],
    tips: [
      "The rate is the first one that exists: a manual cost rate you set, else the latest rate that item was received at in that branch, else the average pre-tax purchase cost across all purchases, else the item master's purchase rate. An item with none of these values at zero.",
      "The total here is the same closing stock figure the Profit & Loss and Balance Sheet use, so an item valued at zero quietly inflates your profit. Set its rate in Cost Price History.",
    ],
    related: ["Inventory Ledger", "Profit & Loss", "Balance Sheet"],
  },

  "Branch Profit Report": {
    summary:
      "Sales, cost and profit line by line for each bill, with the source of every cost rate shown, so you can see exactly where margin is being lost.",
    steps: [
      "Open Accounting > Branch Profit Report.",
      "Set \"From Date\" and \"To Date\" — the helper text under To Date shows the maximum range allowed and how many days you have selected.",
      "Pick a \"Branch\" and a \"Branch Type\", and optionally narrow by \"Item ID (optional)\" or \"Category (optional)\".",
      "Click \"Search\".",
      "Read the summary cards: Total Sales, Total Cost, Total Profit and Profit %.",
      "Check the \"COST SOURCE\" panel: it shows how many lines took their cost from each source, and flags NOT_FOUND lines that have no cost at all.",
      "Click an orange row (missing cost) or a blue row (manual override) to set or edit that item's cost rate, with an optional note.",
      "Expand \"Branch-wise Summary\" and \"Item-wise Summary\" for the totals, and click \"Export Excel\" to save.",
    ],
    tips: [
      "Results are cached for about ten minutes. Click \"Force Refresh\" after changing a cost rate, or you will keep seeing the old figures.",
      "A NOT_FOUND cost counts the whole sale as profit, so the report flatters you until those rates are set. Fix them from here or under \"Manage Cost Overrides\".",
      "Lines the nightly costing job has not stamped yet are priced live and a blue note says so. They are included in every figure.",
      "The detail table may be truncated for a wide range; the summary cards and the branch and item totals always cover the whole range.",
    ],
    related: ["Monthly Branch Profit Report", "Stock Valuation", "Profit & Loss"],
  },

  "Monthly Branch Profit Report": {
    summary:
      "One month at a glance per branch: sales, cost, gross profit, expenses and net profit, with the expense breakdown behind each figure.",
    steps: [
      "Open Accounting > Monthly Branch Profit Report.",
      "Pick the \"Branch\" (or All Branches), the \"Month\" and the \"Year\".",
      "Click \"Generate\".",
      "Read the summary cards: Total Sales, Total Cost, Gross Profit, Total Expenses, Net Profit and Profit %.",
      "Expand a branch row to see its expenses broken down by expense type.",
      "Click \"Export Excel\" to save it.",
    ],
    tips: [
      "Expenses come from Branch Monthly Expense. A month nobody entered shows zero expenses and a flattering net profit.",
      "Cost uses the same costing as the Branch Profit Report, so items with no cost rate overstate profit here too.",
      "This is a management view built from sales and expense data. For the statutory picture use Profit & Loss, which also adjusts for opening and closing stock.",
    ],
    related: ["Branch Profit Report", "Branch Monthly Expense", "Profit & Loss"],
  },

  "Period Closing": {
    summary:
      "Marks a day, a month or a financial year as closed. Year End also posts the closing journal that moves the year's profit into Retained Earnings.",
    steps: [
      "Open Accounting > Period Closing.",
      "On the \"Day End\" tab, set the \"Date\" and click \"Run Day End\" to mark that day closed.",
      "On the \"Month End\" tab, set the \"Period End Date\" and click \"Run Month End\".",
      "On the \"Year End\" tab, set the \"FY End Date\", choose the \"Retained Earnings Account\" and click \"Run Year End Closing\".",
      "Open the \"History\" tab to see every close: type, period date, entries posted, who ran it and when.",
    ],
    tips: [
      "Year End cannot be reversed. It zeroes every income and expense account and transfers the net profit to the account you choose, so check the Profit & Loss and Trial Balance for the year before running it.",
      "Day End here is the accounting close, not the branch cash Day End done at the shop.",
      "Running Day End twice on the same date is blocked, so you cannot close a day by accident twice.",
      "The hard block on back-dated postings comes from Financial Year Setup: a voucher dated in a year that is not active, or that is locked, is refused whatever you do here.",
    ],
    accounting:
      "Day End and Month End post no entries — they only record the close. Year End posts a closing journal that clears all INCOME and EXPENSE accounts and puts the net profit to the Retained Earnings account you selected.",
    related: ["Financial Year Setup", "Profit & Loss", "Trial Balance"],
  },

  "Tally Integration": {
    summary:
      "Sends your vouchers and masters into TallyPrime through the Tally Connector, a small app installed on a PC that can see Tally. Everything is configured here; the connector only moves the data.",
    steps: [
      "Open Accounting > Tally Integration.",
      "On the \"Connectors\" tab, type a name such as \"Accounts PC\" and click \"Add and get pairing key\". Copy the server address and the pairing key shown — the key is valid for 30 minutes.",
      "Click \"Download the connector\", install it on the PC that can reach Tally, open it, paste both values and press Pair.",
      "In TallyPrime, set F1 Help > Settings > Connectivity > TallyPrime acts as to Both, port 9000, and open the company.",
      "Back on the \"Settings\" tab, turn the \"Sync\" switch on, fill in the \"Tally host or IP\", \"Port\" and \"Tally company\", and set the \"Frequency\".",
      "Under \"What to send\", choose the \"Source\", the \"Start date\" (nothing earlier is sent) and which branches to include.",
      "On the \"Ledger mapping\" tab, click \"Read ledgers from Tally\", then set the Tally ledger name and group for each of your accounts and click \"Save mapping\".",
      "Click \"Save settings\", then watch Tally Sync Status.",
    ],
    fields: [
      { name: "Source — GL vouchers", desc: "Ledger vouchers from the books. Needs accounting switched on and the chart of accounts set up." },
      { name: "Source — Item invoices", desc: "Sales and purchase bills with items, quantity and GST." },
      { name: "Create missing ledgers, items, units and cost centres in Tally", desc: "Lets the connector create what a voucher needs in Tally instead of failing on it." },
      { name: "Re-check days", desc: "How far back to look again for late or edited bills." },
    ],
    tips: [
      "If a warning appears saying what is needed \"Before syncing can start\", fix those items first — nothing will be sent until you do.",
      "The connector must stay running on that PC, Tally must be open, and the right company must be loaded. It shows as Online / Offline and Reachable / Not reachable on the Connectors tab.",
      "\"New key\" stops the current connector until it is paired again; \"Remove\" stops that connector syncing at once.",
      "Ledger names must match Tally exactly. The mapping list warns \"Not in Tally yet\" for names it has not seen.",
    ],
    related: ["Tally Sync Status", "Ledger Accounts", "Accounting Setup"],
  },

  "Tally Sync Status": {
    summary:
      "What has reached Tally, what is waiting and what failed — and the buttons to retry, resend or skip.",
    steps: [
      "Open Accounting > Tally Sync Status.",
      "Read the tiles: Waiting, Sending, In Tally, Reached Tally today, Failed and Skipped. Click a tile to filter the list to that status.",
      "Narrow further with \"Status\", \"Type\", \"Branch\", \"From\", \"To\" and \"Voucher no. or error\".",
      "Click a row to open it: \"Summary\", \"Sent to Tally\", \"Tally's reply\" and \"Preview now\", plus Retry, Don't send or Send again.",
      "Tick rows and use \"Retry selected\", \"Send selected again\" or \"Don't send selected\"; or click \"Retry all failed\".",
      "Click \"Sync now\" to ask the connector to run immediately instead of waiting for the schedule.",
      "Click \"Re-check dates\", set a From and To, and run it to pick up anything missed in that range.",
    ],
    tips: [
      "When something fails, open the row and read \"Tally's reply\" — Tally usually names the exact ledger or stock item it could not find.",
      "\"Changed here\" means the voucher was edited after it reached Tally. Send it again to update Tally.",
      "\"Waits for period end\" means it is a daily or monthly summary that will go once the day or month is over.",
      "\"Sync now\" does nothing if sync is switched off in Tally Integration > Settings.",
    ],
    related: ["Tally Integration"],
  },

  "Budget Manager": {
    summary:
      "Set budget amounts per ledger account for a period and branch, and approve them.",
    steps: [
      "Open Accounting > Budget Manager.",
      "On the \"Create / Edit Budget\" tab, fill in \"Budget Name\", \"Financial Year ID\", \"Branch Code\" (blank for all), \"From\" and \"To\".",
      "Under \"Budget Lines\", pick an \"Account\" and type the \"Budgeted Amount\".",
      "Click \"Add Line\" for each further account, or the bin icon to remove one.",
      "Click \"Save Budget\".",
      "Open the \"All Budgets\" tab and click the green tick on a DRAFT row to approve it.",
    ],
    tips: [
      "Budget name, financial year and both dates are required; the screen refuses to save without them.",
      "The financial year is typed as an ID here rather than picked from a list — copy it from Financial Year Setup.",
      "Only a saved budget appears in Budget vs Actual.",
    ],
    related: ["Budget vs Actual", "Financial Year Setup"],
  },

  "Budget vs Actual": {
    summary:
      "Compares each budgeted account against what was really spent or earned, with the variance and a utilisation bar.",
    steps: [
      "Open Accounting > Budget vs Actual.",
      "Choose the budget in \"Select Budget\" — the list shows each budget's name and date range.",
      "Click \"Generate\".",
      "Read the chips for the totals: Total Budgeted, Total Actual and Variance.",
      "Go down the table: green means within budget, red means over.",
      "Click \"Export Excel\" to save it.",
    ],
    fields: [
      { name: "Variance", desc: "Budgeted less actual. A negative figure means you have overspent." },
      { name: "Utilisation", desc: "The bar showing how much of the budget has been used; it turns red once actual passes budgeted." },
    ],
    tips: [
      "Actuals come from posted entries only. An expense head with no ledger account linked never shows up here, however much was spent.",
      "If the figures look too low, check that the budget's date range matches the period you are thinking of.",
    ],
    related: ["Budget Manager", "Profit & Loss"],
  },
};
export default content;
