// Help content: Sales and Purchase. Keys must match menuKey in src/menuCatalog.js.
const content = {
  "POS": {
    summary:
      "Fast counter billing for a walk-in customer. Tap or scan items, take cash, save the bill and print an 80mm receipt.",
    steps: [
      "Open Sales > POS. Check the branch shown under the \"POS Billing\" heading - the bill is saved against that branch.",
      "The first time you use POS on a device, items are copied to it automatically. Tap \"Sync items\" whenever prices or new items change; the button tooltip shows how many items this device holds.",
      "Add items: tap a tile (recently sold items come first), type part of the name in the search box, or scan a barcode. On a computer the search box also accepts a USB or Bluetooth scanner; press F2 (or Ctrl+K) any time to jump back to it. Tap the camera button to scan with a phone camera.",
      "Change a quantity with the - and + buttons, or type it. To change a price for this bill only, tap the rate under the item name, type the new rate and click \"OK\". Tap the bin icon to remove a line; \"Clear\" empties the whole bill after a confirmation.",
      "Optional: click the walk-in customer line to open \"Edit\" and fill in Customer, Mobile, Voucher no and Date. Leave Voucher no blank and the system numbers the bill itself.",
      "Type what the customer handed over in \"Cash received\", or tap one of the quick buttons (\"Exact\", then the next round ₹100 / ₹500 / ₹2000 note). The green box shows \"Change to return\"; a red box means the money is short.",
      "Click \"Save & Print\". The bill is saved, the receipt preview opens with the bill number, and \"Print invoice\" sends it to the receipt printer. The screen then clears itself for the next customer.",
    ],
    fields: [
      { name: "Cash received", desc: "Leave it blank if the customer paid the exact amount. It only works out the change; the bill is always saved as fully paid." },
      { name: "Voucher no", desc: "Leave blank for automatic numbering. Only type one if you are copying a manual bill book." },
      { name: "Rate (under the item name)", desc: "A one-off price for this bill - loose items, or a shelf price that differs from the master. It does not change the item master." },
    ],
    tips: [
      "POS is a cash counter screen: there is no credit option and no GST customer. For a GST tax invoice or a credit sale, use Sales Entry.",
      "If no items appear, the device has no item list yet - tap \"Sync items\".",
      "If you see \"Pick a branch in the menu first\", set the branch in the side menu before billing.",
      "Prices on the tiles come from the last sync, so sync after a price change or you will bill at the old rate.",
      "Once saved, a bill cannot be edited here. Reprint it from Sales Re Print.",
    ],
    accounting:
      "Saving reduces stock of each item sold at that branch and posts the sale to the books: DR Accounts Receivable 1100 with the bill total, CR Sales Revenue 4000 with the taxable value, CR Output CGST 2200 and Output SGST 2201 (or Output IGST 2202 on an inter-state bill). Because the money is collected at the counter, a receipt leg follows straight away: DR Cash in Hand 1001, CR Accounts Receivable 1100, so nothing is left outstanding.",
    related: ["Sales Entry", "Sales Report", "Sales Re Print"],
  },

  "KOT": {
    summary:
      "Table billing for a restaurant or cafe. Each table holds a running order; items are sent to the kitchen as a KOT slip, and the table is settled into a sales invoice at the end.",
    steps: [
      "Open Sales > KOT. The board shows every table with its state: \"Free\", \"Ordering\", \"In kitchen\" or \"Bill printed\". Use the filter buttons (All / Free / Occupied / Billed) or \"Find table\" to get to a table quickly.",
      "Tap a table to open its order. Add items exactly as in POS: tap a tile, search, or scan a barcode (the camera button scans with a phone). Type the waiter's name in \"Captain / waiter\" if you track that.",
      "Click \"Send KOT\" to send only the new items to the kitchen and print the slip. Items already sent are marked \"Sent\" and can no longer be changed or deleted.",
      "Use the three-dot button for \"Reprint full KOT\", \"Move items to another table\", \"Merge another table here\" or \"Discard order\" (only possible while nothing has gone to the kitchen).",
      "When the guest asks for the bill, click \"Print bill\". The table turns to \"Bill printed\"; you can still add items and send another KOT after that.",
      "Click \"Settle\" to take payment. Pick the customer (leave it blank for a walk-in), choose Cash, UPI, Card or \"Split\", enter the cash received to see the change, then click \"Save invoice & print receipt\". The invoice number is shown and the table becomes free again.",
      "To leave a table without settling, click \"Tables\" (the back button). The order stays on the table; an empty table is released.",
    ],
    fields: [
      { name: "Table", desc: "Tables are set up per branch on this device from the \"Tables\" button (e.g. T13, VIP-1, Terrace 2). A table with an open order always shows, even if another device started it." },
      { name: "GST included", desc: "The order total is tax-inclusive; this line shows how much tax is inside it." },
      { name: "Split", desc: "Use it when the guest pays part cash and part UPI or card. \"Rest\" fills the remaining amount into a mode. The total must match exactly before Settle is allowed." },
    ],
    tips: [
      "Statuses in short: OPEN = items typed but not sent, PRINTED = sent to the kitchen, BILLED = bill printed, CONVERTED = settled into an invoice, CANCELLED = discarded.",
      "The walk-in customer on a settled table is \"POS\".",
      "If you settle with items still unsent, a warning appears - the kitchen never saw those items.",
      "Removing a table from \"Tables\" is only possible when it has no open order.",
      "\"Move items to another table\" and \"Merge another table here\" save you re-keying when guests change seats or two tables pay together.",
    ],
    accounting:
      "Nothing hits stock or the books while the order is open; the KOT is only a kitchen instruction. On \"Settle\" a sales invoice is created: stock of the items sold goes down, DR Accounts Receivable 1100 with the invoice total, CR Sales Revenue 4000 with the taxable value and CR Output CGST 2200 / SGST 2201 (or IGST 2202) with the tax. The payment then clears it: DR Cash in Hand 1001, Card POS Receipts 1010 or UPI Receipts 1015 depending on the mode, CR Accounts Receivable 1100.",
    related: ["POS", "Sales Report", "Salesman Report"],
  },

  "Sales Entry": {
    summary:
      "The full GST tax-invoice screen: a named customer with a GSTIN, a delivery address, several payment modes, and the option to sell on credit. Use it for B2B and account customers; use POS for counter cash sales.",
    steps: [
      "Open Sales > Sales Entry. Pick the branch at the top and set the invoice date if it is not today.",
      "In section 1 \"Customer\", search by name, GSTIN or mobile. The customer's GSTIN, billing address and state appear; a customer with no GSTIN shows as \"Unregistered\". For a new customer click \"New customer\", fill in Name, GSTIN (leave empty if unregistered), Mobile, State, Billing address and, if it differs, a Delivery address, then \"Add customer\" - the new customer is selected straight away.",
      "Check the \"Delivery address\" box; it is pre-filled from the customer but you can type where the goods actually go.",
      "In section 2 \"Items\", pick the item (name, barcode or code), then type Qty and Rate incl. GST and click \"Add\". The rate you type includes tax - the taxable value and the tax are worked back out of it.",
      "Check the item table: Taxable, the tax column (\"GST\" within the state, \"IGST\" for another state) and Amount. Use the bin icon to remove a wrong line.",
      "In section 3 \"Payment\", choose \"Paid in full\" and split the money across Cash, UPI and Card (\"Rest\" fills the balance), or choose \"Credit\" and enter only the down payment the customer is paying now.",
      "Check the Summary panel: Taxable value, CGST and SGST (or IGST), Invoice total, Paid now and Balance / On credit. Click \"Save invoice\". If the button is greyed out, the line under it says what is missing.",
      "After saving, the invoice number is shown - click \"Print tax invoice\", then \"New invoice\" to start the next one.",
    ],
    fields: [
      { name: "Rate incl. GST", desc: "Type the price the customer pays including tax. The screen splits it into taxable value and tax using the item's tax rate." },
      { name: "Credit", desc: "Leaves the unpaid part on the customer's account. Collect it later from Accounting > Receipt Entry; it also shows in the customer's outstanding balance." },
      { name: "State (new customer)", desc: "Decides IGST. If the customer's state (or the first two digits of their GSTIN) differs from the branch's, the invoice is charged IGST instead of CGST + SGST." },
    ],
    tips: [
      "\"Payment must equal the total, or choose Credit\" means you tried to part-pay a cash invoice - switch to \"Credit\" to leave a balance.",
      "You cannot enter more money than the invoice total.",
      "The customer named \"POS\" (the walk-in used by the counter) is deliberately hidden from the customer list here.",
      "GSTIN and state are what make the invoice correct for GST returns, so get them right before saving - the invoice cannot be edited afterwards.",
    ],
    accounting:
      "Stock of each item goes down at the selected branch. The books get DR Accounts Receivable 1100 with the invoice total, CR Sales Revenue 4000 with the taxable value, CR Output CGST 2200 and Output SGST 2201, or CR Output IGST 2202 when the customer is in another state. Each payment you entered posts DR Cash in Hand 1001 / Card POS Receipts 1010 / UPI Receipts 1015 against CR Accounts Receivable 1100. Anything left on credit stays in the customer's receivable until you enter it in Accounting > Receipt Entry.",
    related: ["POS", "Sales Report", "Sales Tax Summary", "Sales Re Print"],
  },

  "Sales Report": {
    summary: "Item-by-item list of everything sold in a branch over a date range, with an Excel export.",
    steps: [
      "Open Sales > Sales Report and choose the Branch.",
      "Set \"From Date\" and \"To Date\", then click the fetch button to load the lines on screen.",
      "Read the columns: Voucher Number, Voucher Date, Item Name, Quantity, Rate, TaxRate and Amount - one row per item line, not per bill.",
      "Click \"Export to Excel\", type a file name and click \"Export\" to download what is on screen.",
      "For more than 7 days, the on-screen list is not offered; click \"Run in background\" instead. The file appears under My Reports and is kept for 7 days.",
    ],
    tips: [
      "Amounts here are tax-inclusive sale values; for the tax split use Sales Tax Summary or HSN Sales Summary.",
      "A missing bill usually means it was saved against a different branch - check the branch filter.",
    ],
    related: ["Sales Tax Summary", "HSN wise Sales", "Sales Re Print"],
  },

  "Sales Re Print": {
    summary: "Finds a saved bill by its voucher number so you can print a duplicate invoice for the customer.",
    steps: [
      "Open Sales > Sales Re Print.",
      "Type the bill number in \"Voucher Number\" and click \"Fetch Data\".",
      "The matching bills are listed with Customer Name, Voucher Number, Voucher Date and Total Amount.",
      "Click \"Generate Invoice\" on the row you want; the invoice is fetched and opened for printing.",
      "Where a POS printer is connected, the row's print option sends the bill straight back to that printer.",
    ],
    tips: [
      "This only reprints; it never changes a bill. A wrong bill has to be corrected by your accountant, not here.",
      "Keep the bill number from the receipt - searching without it is not supported on this screen.",
    ],
    related: ["Sales Report", "POS"],
  },

  "Sales Tax Summary": {
    summary: "Sales grouped by tax rate, with the items inside each rate and a subtotal per rate - the quick check before filing GST.",
    steps: [
      "Open Sales > Sales Tax Summary and choose the Branch.",
      "Set \"From Date\" and \"To Date\" and load the report.",
      "Each block is one tax rate: the item rows show Tax %, Item Name, Lines, Total Qty and Total Amount, followed by a \"% Subtotal\" row, and a \"Grand Total\" at the end.",
      "Click \"Export to Excel\", give a file name and click \"Export\" - the subtotals and grand total go into the file too.",
      "For a period longer than 7 days use \"Run in background\"; the file lands in My Reports and stays there for 7 days.",
    ],
    tips: [
      "Lines = the number of bill lines at that tax rate, not the number of bills.",
      "Compare this with HSN Sales Summary: same sales, one grouped by tax rate, the other by HSN code with the CGST/SGST split.",
    ],
    related: ["HSN Sales Summary", "Sales Report"],
  },

  "HSN wise Sales": {
    summary: "Every sold line with its HSN code, for the HSN annexure of the GST return and for checking that items carry the right HSN.",
    steps: [
      "Open Sales > HSN wise Sales and choose the Branch.",
      "Set \"From Date\" and \"To Date\" and load the report.",
      "Columns are Branch Code, Item Name, HSN Code, Unit Name, Quantity, tax rate, Rate and Amount, with a Total row at the bottom.",
      "Click \"Export to Excel\", name the file and click \"Export\".",
      "Over 7 days, use \"Run in background\" and collect the file from My Reports (kept 7 days).",
    ],
    tips: [
      "A blank HSN Code means the item master has no HSN - fix it in the item master, or the GST return will be short.",
      "This is the detailed version; HSN Sales Summary is the same data totalled per HSN code.",
    ],
    related: ["HSN Sales Summary", "HSN wise Purchase"],
  },

  "HSN Sales Summary": {
    summary: "One row per HSN code with taxable value and the CGST / SGST split - the shape the GSTR-1 HSN table wants.",
    steps: [
      "Open Sales > HSN Sales Summary. Choose a branch, or \"ALL BRANCHES\" to combine them.",
      "Set \"From Date\" and \"To Date\" and load the report.",
      "Read across: HSN Code, Total Qty, Taxable Value, CGST, SGST, Total Tax and Total Amount.",
      "Click \"Export to Excel\", enter a file name and click \"Export\" to hand the file to your accountant.",
    ],
    tips: [
      "Taxable Value plus Total Tax should equal Total Amount; if it does not, an item's tax rate is wrong in the master.",
      "Inter-state sales carry IGST rather than CGST and SGST, so check the detailed HSN wise Sales report if the split looks odd.",
    ],
    related: ["HSN wise Sales", "Sales Tax Summary"],
  },

  "All Branch Sales Report": {
    summary: "One row per item showing how much each branch sold in the period - the item-level comparison across the whole company.",
    steps: [
      "Open Sales > All Branch Sales Report.",
      "Set \"Start Date\" and \"End Date\" and load the report.",
      "Each row is an item: Item Name, Category, Standard Price, then one column per branch, then Total Sales.",
      "Click \"Export to Excel\", enter a file name and click \"Export\".",
    ],
    tips: [
      "Branch columns appear only for branches that actually sold something in the period.",
      "Use it to spot an item selling well in one shop and sitting idle in another, then move stock with a transfer.",
    ],
    related: ["Branch Sales Summary Report", "All Branch Categorywise Sales Report"],
  },

  "Branch Sales Summary Report": {
    summary: "Total sales per branch for a period - the shortest answer to \"which shop did how much\".",
    steps: [
      "Open Sales > Branch Sales Summary Report.",
      "Set \"Start Date\" and \"End Date\" and load the report.",
      "The table lists each branch code with its total sales, and a grand total at the bottom.",
      "Click \"Export to Excel\", name the file and click \"Export\".",
    ],
    tips: [
      "Figures are tax-inclusive sale values, so they will not match the taxable value in your GST return.",
      "A branch missing from the list simply billed nothing in that period.",
    ],
    related: ["All Branch Sales Report", "Sales Report"],
  },

  "All Branch Categorywise Sales Report": {
    summary: "Sales by item category with a column per branch - shows which departments earn where.",
    steps: [
      "Open Sales > All Branch Categorywise Sales Report.",
      "Set \"Start Date\" and \"End Date\" and load the report.",
      "Each row is a category, with one column per branch and a Total Sales column at the end.",
      "Click \"Export to Excel\", enter a file name and click \"Export\".",
    ],
    tips: [
      "Items with no category are grouped separately, so tidy up the item master if a large amount lands there.",
    ],
    related: ["All Branch Sales Report", "Branch Sales Summary Report"],
  },

  "Season Sales Report": {
    summary: "A forecast screen: pick a season you have defined and it predicts quantities to sell and the minimum quantities to keep in stock.",
    steps: [
      "Open Sales > Season Sales Report.",
      "Choose a \"Season\" from the list (seasons are set up in the season master).",
      "Click \"Generate Report\" and wait for the figures.",
      "Read \"Predicted Sales\" for the expected quantity per item and \"Minimum Quantities\" for the stock level to hold.",
    ],
    tips: [
      "Items are listed by their internal item id rather than name, so this screen is for a quick look rather than a printable report.",
      "There is no export and no date filter - the season itself sets the period.",
      "Forecasts need past sales in the same season to be meaningful; a new shop will get thin numbers.",
    ],
    related: ["All Branch Sales Report"],
  },

  "Salesman Report": {
    summary: "How many bills each salesman made on one day at one branch, and the value of those bills.",
    steps: [
      "Open Sales > Salesman Report.",
      "Choose the Branch (only branches you are allowed to see are listed).",
      "Pick the Date - this report covers a single day.",
      "Load the report and read Salesman, Bills and Total Amount, with a Total row at the bottom.",
    ],
    tips: [
      "Bills with no salesman on them are not attributed to anyone, so type the captain or salesman name at billing time if you use this report.",
      "If the branch list is empty, your login has no branches assigned - ask your administrator.",
    ],
    related: ["KOT", "Sales Report"],
  },

  "Bill Series Report": {
    summary: "Checks bill numbering: for each branch, month and voucher type it shows the first and last bill number used and how many bills that range covers.",
    steps: [
      "Open Sales > Bill Series Report.",
      "Set \"From Date\" - the report runs from that date onwards.",
      "Click \"Fetch Bill Series Data\".",
      "Read Branch Code, Month, Voucher Type, Min Voucher, Max Voucher and Total Bills; the last column is simply last number minus first number plus one.",
      "Click \"Export to Excel\", name the file and click \"Export\".",
    ],
    tips: [
      "If Total Bills is more than the number of bills you actually issued, a number in the series is missing - usually a cancelled or unsynced bill worth investigating.",
      "Auditors ask for this report to prove bill numbers run without gaps.",
    ],
    related: ["Sales Report", "Sales Re Print"],
  },

  "Purchase Entry": {
    summary:
      "Records a supplier's bill: the supplier, their invoice number and date, and every item with its purchase rate. This creates the purchase voucher and the amount you owe the supplier; the goods only enter stock when you do the Goods Receipt.",
    steps: [
      "Open Purchase > Purchase Entry. On the \"Invoice details\" tab pick the Branch, the Supplier (type to search, or type a new name), the \"Supplier Invoice No\" and the \"Invoice Date\". Optionally set a \"Next Purchase Date\" - you get a task the day before.",
      "Switch to the \"Items\" tab. The grey strip at the top keeps Branch, Supplier, Supplier Invoice and Next purchase in view; click \"Edit\" on that strip to go back and change them.",
      "Add each item with the keyboard: scan the barcode into \"Barcode / Scan\" (or pick it in \"Search by name\"), then Qty [Enter], \"Rate incl. Tax\" [Enter], \"Total\" [Enter] and the row is added. The last purchase rate for that item is filled in automatically as a starting point.",
      "If you buy in a bigger pack, set \"Purch. Unit\" (e.g. Box) and \"Conv. Factor\" (e.g. 12). Inv. Qty = Purch. Qty x Conv. Factor is what actually enters stock.",
      "Typing in \"Total\" back-calculates the rate - handy when the supplier bill shows only line totals. Rows can be edited or deleted in the table below.",
      "Compare \"Items Total\" with the supplier's bill. Type the supplier's figure into \"Bill Total\" and \"Round Off\" shows the difference; a large difference means a wrong rate or a missing line, not a rounding.",
      "Tick \"Print after save\" if you want a printed copy. Click \"Final Save\" to post the purchase, or \"Partial Save\" to park a half-finished bill as a draft.",
      "Two helpers sit at the top: \"Scan Invoice\" reads a supplier invoice and fills the header and items for you to check, and \"Load for Edit\" finds a saved purchase by branch and date range so you can correct it.",
    ],
    fields: [
      { name: "Supplier Invoice No", desc: "The number printed on the supplier's bill. Mandatory - it is how the purchase is matched to the supplier's account and to your GST input credit." },
      { name: "Rate incl. Tax", desc: "The rate including GST. The tax and the rate before tax are worked out from the item's tax rate." },
      { name: "Conv. Factor", desc: "How many stock units are in one purchase unit. Get this wrong and stock will be out by that multiple." },
      { name: "Next Purchase Date", desc: "Optional reminder: a task is raised the day before, and it closes by itself when you buy from that supplier again." },
    ],
    tips: [
      "\"Partial Save\" keeps the bill as a draft and also stores it under \"Recall Draft\" on this device, so you can carry on later. Drafts show as DRAFT in Purchase Report when you tick \"Include drafts\".",
      "A purchase that already has a Goods Receipt cannot be edited - you get \"GRN already done - cannot edit\". Use Purchase Correction instead.",
      "Saving without a branch, a supplier or a supplier invoice number jumps you back to the \"Invoice details\" tab and marks the missing field.",
      "Only \"Final Save\" posts to the books; a partial save does not.",
    ],
    accounting:
      "A final save posts the supplier bill: DR Purchase Account 5200 with the taxable value, DR Input CGST 5100 and Input SGST 5101 (or DR Input IGST 5102 for an out-of-state supplier), CR Accounts Payable 2100 with the full bill total - that is what you owe the supplier, cleared later from Accounting > Payment Entry. Stock is not touched here: items enter stock only when Goods Receipt is saved, with the inventory quantity (Purch. Qty x Conv. Factor).",
    related: ["Goods Receipt", "Purchase Report", "Purchase Correction"],
  },

  "Goods Receipt": {
    summary:
      "Confirms what actually arrived against a saved purchase and puts it into stock. Until this is done, the purchase is recorded but the goods are not in stock.",
    steps: [
      "Open Purchase > Goods Receipt. The branch you are working in is shown at the top.",
      "Set \"From Date\" and \"To Date\" and load the purchases. The list shows Voucher No, Date, Supplier, Supplier Inv No, Items and Status - rows already received are marked \"GRN Done\".",
      "Click a pending purchase to open its items.",
      "Check each line and type what really arrived in \"Recv. Inv. Qty\". This is in the inventory unit, not the purchase unit - the \"Purch. Qty\", \"Purch. Unit\" and \"Conv.\" columns show where the figure came from.",
      "Choose the \"Receiving Branch\" if the goods are going to a different branch from the one on the purchase.",
      "Click \"Save GRN\". The quantities you entered go into stock at that branch, against the GRN voucher number.",
    ],
    tips: [
      "One purchase can only be received once - a second attempt is refused with \"GRN already exists for this purchase order\".",
      "Receiving short (or extra) is fine: type the real quantity. The purchase keeps the ordered figure, and the difference is visible when you compare purchase and stock.",
      "Do the receipt the day the goods arrive, otherwise the shop sells items the system thinks it does not have.",
    ],
    accounting:
      "This is the step that moves stock: each line adds its received quantity to the branch's stock with voucher type GRN, at the purchase rate. The supplier's bill and the input GST were already posted by Purchase Entry's \"Final Save\", so the Goods Receipt itself adds no new entry to the books.",
    related: ["Purchase Entry", "Item Stock Report", "Purchase Report"],
  },

  "Purchase Correction": {
    summary:
      "Corrects a purchase that can no longer be edited - a wrong rate, quantity, tax rate, batch or supplier invoice number - with a mandatory reason and a full audit trail.",
    steps: [
      "Open Purchase > Purchase Correction. Search by voucher number, supplier invoice number or supplier name, or narrow it with the \"From\" and \"To\" dates.",
      "Find the purchase in the list (the GRN column shows \"Done\" or \"Pending\") and click \"Correct\".",
      "Change what is wrong: the header fields (Supplier Name, Supplier ID, Supplier Invoice No, Supplier Invoice Date) and, in the item lines, Batch, Qty (Purchase), Qty (Stock), Rate (Excl. Tax) and Tax %.",
      "Type why in \"Correction Reason\" - it is mandatory and cannot be left blank.",
      "Preview first: the preview lists every field that will change, old value against new value, and the effect on stock and on the money.",
      "Click \"Apply Correction\" to make the change now, or \"Submit for Approval\" if your role needs a manager to approve it. The result says whether the status is APPLIED or PENDING_APPROVAL.",
      "Use the history icon on the correction screen to see everything already done to that purchase.",
    ],
    tips: [
      "\"Qty (Stock)\" is the quantity in stock units - change it and branch stock moves by the difference, so check it before applying.",
      "Write a reason an auditor will understand later (\"supplier revised rate on credit note 112\"), not just \"wrong\".",
      "Managers and admins can apply directly; other users only submit for approval.",
    ],
    accounting:
      "An applied correction adjusts the original purchase: the purchase value, the input GST and the amount payable to the supplier are restated, and any quantity change moves stock at the branch by the difference. Everything is recorded as an old-value / new-value trail, so nothing is silently overwritten.",
    related: ["Purchase Correction Approval", "Purchase Correction History", "Purchase Entry"],
  },

  "Purchase Correction Approval": {
    summary: "The manager's queue: review corrections waiting for approval, see exactly what would change, then approve or reject them.",
    steps: [
      "Open Purchase > Purchase Correction Approval. The cards at the top count what is Pending, Applied and Rejected; the tabs switch between them.",
      "Open a request to see its detail: every changed field with Entity, Line, Field, Old Value and New Value.",
      "Check the stock effect table - Item, Batch, Original Qty, Corrected Qty and the Difference - and the \"Financial Impact\" panel.",
      "Click the approve button to apply it. The correction takes effect immediately and the status becomes APPLIED.",
      "To turn it down, click reject and type a rejection reason; the request is stored as REJECTED with your reason and nothing changes.",
      "The list refreshes after each decision, so work the Pending tab until it is empty.",
    ],
    tips: [
      "Read the reason the requester typed and the money impact together - a small rate change can move a large amount over many lines.",
      "Approving is what actually changes stock and the books; until then the purchase is untouched.",
      "A rejection is permanent: the requester has to raise a fresh correction.",
    ],
    related: ["Purchase Correction", "Purchase Correction History"],
  },

  "Purchase Correction History": {
    summary: "The audit trail of every correction made to purchases - what changed, who asked, who approved or rejected, and when.",
    steps: [
      "Open Purchase > Purchase Correction History.",
      "Search by voucher number, supplier invoice number or supplier name, then click \"Load\" on the purchase you want.",
      "Each correction shows its status (APPLIED, PENDING_APPROVAL or REJECTED) with who approved, rejected or applied it and at what time, plus the rejection reason where there is one.",
      "Expand a correction to see the changes line by line: Entity, Line, Field, Old Value, New Value and the type of change.",
      "Export the list to Excel when an auditor or your accountant asks for it.",
    ],
    tips: [
      "This screen is read-only - nothing here can be undone. To change something again, raise a new correction.",
      "The correction screen links straight here for the purchase you are working on.",
    ],
    related: ["Purchase Correction", "Purchase Correction Approval"],
  },

  "Purchase Report": {
    summary: "Every purchase line for a branch over a date range, with the supplier's invoice details - the report to reconcile against supplier statements.",
    steps: [
      "Open Purchase > Purchase Report and choose the Branch.",
      "Choose the \"Date Basis\": \"Voucher Date\" (when you entered it) or \"Supplier Invoice Date\" (the date on the supplier's bill). The line under the heading repeats which one is in use.",
      "Set \"From Date\" and \"To Date\". Tick \"Include drafts\" to see partially saved purchases as well; leave it off for finalised purchases only.",
      "Load the report. Columns are Voucher No, Voucher Date, Supplier Name, Supplier Invoice No, Supplier Invoice Date, Item Name, Quantity, Rate and Amount - and Status when drafts are included.",
      "Click \"Export to Excel\", enter a file name and click \"Export\".",
    ],
    tips: [
      "Use \"Supplier Invoice Date\" when matching a supplier's monthly statement, and \"Voucher Date\" when tying back to your own books.",
      "Drafts are not posted to the books, so never count them as purchases - they are there to show what is unfinished.",
      "Rows are item lines, so one bill appears several times.",
    ],
    related: ["HSN wise Purchase", "Purchase Entry", "Goods Receipt"],
  },

  "HSN wise Purchase": {
    summary: "Purchases listed with each item's HSN code and tax rate - used to check input GST and to answer HSN queries on purchases.",
    steps: [
      "Open Purchase > HSN wise Purchase.",
      "Set \"From Date\" and \"To Date\", and choose the \"Date Basis\": \"Voucher Date\" or \"Supplier Invoice Date\".",
      "Tick \"Include drafts\" only if you want unfinished purchases counted too.",
      "Load the report and read Branch Code, Item Name, HSN Code, Unit Name, Quantity, Tax Rate (%), Purchase Rate and Amount, with a Total at the bottom.",
      "Click \"Export to Excel\" to download the list.",
    ],
    tips: [
      "A blank HSN Code means the item master is incomplete - fix it once and every later report is right.",
      "Input GST claimed here should agree with the input tax in your accounts; a mismatch usually comes from a wrong tax rate on an item.",
    ],
    related: ["Purchase Report", "HSN wise Sales"],
  },
};

export default content;
