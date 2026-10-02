// Help content: Production, Stock & Inventory, Weighbridge. Keys must match menuKey in src/menuCatalog.js.
const content = {
  // ─── PRODUCTION ────────────────────────────────────────────────────────────
  "Production Def": {
    summary:
      "Holds the recipe (bill of materials) for each item you make in-house: how much of the finished item one batch produces, and which raw materials that batch eats. Everything else in Production reads this recipe, so if it is wrong nothing downstream can be right.",
    steps: [
      "Open Production > Production Def.",
      "Pick the item you make in \"Production Item Name\". The list only shows items whose category is PRODUCTION or DYNAMIC, so if your item is missing, fix its category in the item master first.",
      "If a recipe already exists for that item, its batch size and its raw material rows load automatically, ready to edit.",
      "Type the batch size in \"Production Qty\" (for example 10 if the recipe below makes 10 loaves) and, if you track it, the cost of one batch in \"Production Cost\".",
      "In the \"Raw Materials\" table pick each ingredient from the \"Item Name\" list and type the \"Qty\" used for one batch. Barcode, tax rate, standard price and unit fill in from the item master.",
      "Use \"Add Row\" for more ingredients and the red bin icon to drop a row. \"Amount\" is worked out for you as Qty x Std Price, and \"Total Amount\" at the bottom adds them up.",
      "Click \"Save\". The form clears when the recipe is stored.",
    ],
    fields: [
      { name: "Production Qty", desc: "How many finished units one run of this recipe makes. Raw materials are scaled from this, so a batch size of 0 or blank means no raw materials can ever be worked out." },
      { name: "Production Cost", desc: "Cost of producing one batch. Recorded with the recipe; it does not post to the books by itself." },
      { name: "Batch / Expiry", desc: "Optional notes on a raw material row. They are not used to pick which stock batch gets consumed." },
    ],
    tips: [
      "Always choose ingredients from the drop-down list rather than typing a name. A typed name has no item behind it, and later the Production Execution screen cannot reduce stock for it.",
      "Recipes are quantity-proportional: ask for 25 units of an item whose batch size is 10 and the system takes 2.5 times each ingredient line.",
      "Items in the DYNAMIC category are special: selling one in the POS already consumes this recipe's raw materials automatically. Do not also run Production Execution for those items or the ingredients come off stock twice.",
      "Saving replaces the whole recipe for that item, so edit the loaded rows rather than starting from a blank sheet.",
    ],
    related: ["Production Planning", "Production Execution", "Raw Material Usage Report"],
  },

  "Production Planning": {
    summary:
      "Works out what you intend to make on a given day and what raw materials that will need, and saves it as a planning voucher. Planning moves no stock at all - it is a shopping and prep list.",
    steps: [
      "Open Production > Production Planning.",
      "Set the \"Planning Date\".",
      "In \"Production Items\" pick each item to be made from the list and type the \"Qty\". Use \"Add Row\" for more lines; \"Total Qty\" and \"Total Amount\" show at the bottom.",
      "Click \"Generate Raw Material List\". The system reads each item's recipe and shows a \"Raw Material Details\" table (one line per recipe ingredient) and a \"Summary\" that adds the same ingredient together across all the items.",
      "Use \"Summarise\" to rebuild the summary, \"Export Summary\" for a simple CSV of item and quantity, or \"Export Excel\" for a workbook with the production items, the summary and the details on separate sheets.",
      "Click \"Save\". The planning is stored and you are shown its Planning ID (a number beginning PLAN-).",
      "To work on a planning that already exists - for example one created by the Excel import - set \"From Date\" and \"To Date\" under \"Load Existing Planning\", click \"Fetch Plannings\" and click \"Load\" on the voucher you want.",
      "When a planning is loaded the screen says so, the date is locked, and the save button becomes \"Save Raw Materials\": click \"Generate Raw Material List\" first, then \"Save Raw Materials\" to attach the ingredient list to that planning. Click \"New Planning\" to go back to entering a fresh one.",
    ],
    tips: [
      "Editing the item rows of a loaded planning only changes the raw material calculation on screen. It does not change the planning's saved items.",
      "An item with no recipe contributes nothing to the raw material list, and you get no warning - if the summary looks short, check Production Def.",
      "Planning changes nothing in stock and nothing in the books. Only Production Execution moves stock.",
    ],
    accounting: "No effect on stock and no entry in the books.",
    related: ["Production Def", "Production Planning Import", "Production Execution", "Production Planning Report"],
  },

  "Production Planning Import": {
    summary:
      "Creates production plannings in bulk from an Excel sheet instead of typing them one at a time. Useful when head office plans several branches for the same day.",
    steps: [
      "Open Production > Production Planning Import (Excel).",
      "Click \"Download Template\" first. The template already lists every item that has a recipe, and its Branch Code column offers only the production branches.",
      "Fill in the sheet. Row 1 is the header and the columns are \"Item Name\", \"Qty\" and \"Branch Code\".",
      "Click \"Choose Excel File\" and pick the saved file (.xlsx or .xls).",
      "Click \"Import\".",
      "Read the \"Import Summary\": how many rows were in the file, how many were imported and how many failed. Rows are grouped by branch code, so each branch gets its own planning with its own voucher number, listed under \"Plannings Created\".",
      "If any rows failed, the \"Error Rows\" table names the row number, the item, the quantity, the branch code and the reason. Fix those rows in the sheet and import just them again.",
    ],
    tips: [
      "Item names must match the item master exactly - the template exists so you do not have to type them.",
      "Importing the same file twice creates a second set of plannings; there is no duplicate check.",
      "The import only creates plannings. Nothing is produced and no stock moves until someone runs Production Execution.",
    ],
    related: ["Production Planning", "Production Planning Report"],
  },

  "Production Execution": {
    summary:
      "Records what was actually made. This is the screen that moves stock: finished goods are added to the branch and the recipe's raw materials are taken off it.",
    steps: [
      "Open Production > Production Execution. The branch you are logged in to is shown top right - everything posts to that branch.",
      "If you are producing against a plan, choose it in \"Planning Voucher No.\" and its items load into the table. Otherwise type the items yourself.",
      "Set the \"Execution Date\".",
      "Check the \"Production Items (Finished Goods)\" table: adjust \"Qty\" to what was really produced, and fill in \"Batch\" and \"Expiry\" if you track them. \"Amount\" is Qty x Std Price.",
      "Click \"Generate Raw Material List\" to see \"Raw Material Details\" and \"Summary (will be consumed from stock)\" before committing. Check the quantities look sensible.",
      "Click \"Save & Update Stock\". The raw material list is recalculated at that moment, so it is always in step with the quantities on screen.",
      "Read the message. Success gives you the execution voucher number (beginning EXEC-). A warning names any item whose stock was not updated.",
    ],
    fields: [
      { name: "Planning Voucher No.", desc: "Links this production to a plan. Saving marks that plan's lines as \"Executed\" in the Production Planning Report." },
      { name: "Batch", desc: "Batch code for the finished goods being added. Raw materials always come off the no-batch (\"NB\") pool, whatever you type here." },
    ],
    tips: [
      "If you type an item name instead of choosing it from the list, the entry is still saved but no stock moves for it, and the message tells you which items were skipped. Re-select them from the list and run it again.",
      "If no recipe can be found, a box asks you to confirm: finished goods will still be added but nothing will be consumed. Say no unless you really mean it, or your raw material stock will drift upwards.",
      "Quantities are scaled from the recipe: 25 units of an item whose recipe batch is 10 consumes 2.5 times each ingredient.",
      "Raw materials can go negative - the system does not stop you producing more than your ingredients allow. Check the Branch Stock Report afterwards.",
      "\"Export Excel\" saves the finished goods, the raw material summary and the details for your own records.",
    ],
    accounting:
      "Stock only: each finished item is added to the branch with the production voucher number, and each raw material on the summary is taken off the same branch. No entry is made in the general ledger, so cost of production is not expensed by this screen.",
    related: ["Production Def", "Production Planning", "Production Execution Report", "Branch Inventory Ledger"],
  },

  "Production Planning Report": {
    summary:
      "Lists everything that was planned for production over a period, and shows which plans have since been produced.",
    steps: [
      "Open Production > Production Planning Report.",
      "Choose a \"Branch\", or leave it on \"ALL\".",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Fetch Production Planning\".",
      "Read the rows: voucher number, date, branch, item, batch, quantity, unit, standard price and amount. Totals for quantity and amount are on the last line.",
      "The \"Status\" column shows \"Executed\" once a Production Execution has been saved against that planning voucher, and \"Pending\" until then.",
      "Click \"Export to Excel\", type a file name and click \"Export\" to save it.",
    ],
    tips: [
      "A line only turns \"Executed\" if the person running Production Execution selected the planning voucher. If they entered the items by hand, the plan stays \"Pending\" for ever.",
      "The quantities here are what was planned, not what was made - compare with the Production Execution Report for the difference.",
    ],
    related: ["Production Planning", "Production Execution Report"],
  },

  "Production Execution Report": {
    summary:
      "Lists what was actually produced over a period, with the plan it came from, so you can compare plan against output.",
    steps: [
      "Open Production > Production Execution Report.",
      "Choose a \"Branch\" or leave it on \"ALL\".",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Fetch Production Execution\".",
      "Read the rows: execution voucher number, the planning voucher it came from, date, branch, item, batch, quantity, unit, standard price and amount, with totals on the last line.",
      "Click \"Export to Excel\", type a file name and click \"Export\".",
    ],
    tips: [
      "A blank \"Planning Voucher No\" means the production was entered directly, without a plan.",
      "This report shows finished goods only. To see what the production consumed, use the Branch Inventory Ledger or Item Movement Report for the raw material.",
    ],
    related: ["Production Execution", "Production Planning Report", "Raw Material Usage Report"],
  },

  "Raw Material Usage Report": {
    summary:
      "Answers \"what do we use this ingredient in?\". Pick a raw material and it lists every finished product whose recipe contains it, and optionally how much would be needed to produce a given quantity of each.",
    steps: [
      "Open Production > Raw Material Usage Report.",
      "Pick an ingredient in \"Raw Material\". The list holds only items that appear in at least one recipe.",
      "Optionally type a number in \"Finished Qty (optional)\" - the quantity of each finished product you are thinking of making.",
      "Click \"Show\".",
      "Read the table: the finished product, its branch, \"Batch Qty\" (how many units one recipe run makes), \"Raw Material Qty per Batch\" and the unit. If you entered a finished quantity, an extra column shows how much of the ingredient that many units would need.",
      "Click \"Export to Excel\" to save the list.",
    ],
    tips: [
      "Use this before changing a supplier or a pack size: it shows every recipe that would be affected.",
      "The figures come from the saved recipes, not from actual production - it is a planning tool, not a consumption report.",
    ],
    related: ["Production Def", "Production Planning"],
  },

  // ─── STOCK & INVENTORY ─────────────────────────────────────────────────────
  "Physical Stock Correction": {
    summary:
      "Brings the system's stock into line with a physical count. You enter what you actually counted, and the difference is posted as a stock adjustment for that branch and batch.",
    steps: [
      "Open Stock & Inventory > Physical Stock Correction.",
      "Choose the \"Branch\" you counted.",
      "On the first row pick the item under \"Item Name\", then click \"Load\". That fetches the batches held for that item at that branch, with their quantities.",
      "Choose the batch in the \"Batch\" column. \"System Qty\" fills in. If the item has no stock at all, a \"No stock in system (qty 0)\" line is offered so you can still record a count.",
      "Type what you counted in \"Actual Qty\". \"Difference\" is worked out for you - a positive number means you found more than the system thought.",
      "Use \"Add Row\" for more items and the bin icon to remove one. If the item list looks out of date, click \"Refresh Items\".",
      "Click \"Save All Corrections\".",
    ],
    fields: [
      { name: "System Qty", desc: "What the system currently holds for that item and batch at that branch. Read-only." },
      { name: "Difference", desc: "Actual minus System. This, not the actual quantity, is what gets posted." },
    ],
    tips: [
      "Count first, enter afterwards. A row is only saved once branch, item, batch and actual quantity are all filled in.",
      "Do not scan a barcode into \"Actual Qty\" - the screen warns you as you type, because a scanned number would post a huge false adjustment.",
      "A difference of zero posts nothing, so re-entering a correct count is harmless.",
      "Corrections are additional movements, not an overwrite. The old figures stay in the ledger and the correction shows up as its own voucher (numbers begin SC-).",
      "Sales and other work at the branch during the count will make your figures disagree. Count when the branch is quiet.",
    ],
    accounting:
      "Stock only: a stock movement is added for the difference (in if positive, out if negative), marked as a physical stock voucher. Nothing is posted to the general ledger, so a big write-down here will not appear in the profit and loss by itself.",
    related: ["Physical Stock Report", "Branch Stock Report", "Wastage Entry"],
  },

  "Wastage Entry": {
    summary:
      "Records what was thrown away, why, and what it cost. Unlike a plain stock correction, wastage carries a coded reason, reduces stock and expenses the loss in the books.",
    steps: [
      "Open Stock & Inventory > Wastage Entry.",
      "Choose the \"Branch\" (already filled in if you only have one) and the \"Date\". You cannot record wastage for a future date.",
      "Choose the \"Reason\" for the whole voucher: EXPIRY, DAMAGE, SPOILAGE, PRODUCTION LOSS, CUSTOMER RETURN, SAMPLE, STAFF CONSUMPTION or OTHER.",
      "If the reason is OTHER, \"Remarks\" become compulsory - say what happened.",
      "On each line, type in the \"Item\" box to search the catalogue and pick the item, then enter the \"Quantity\". \"Cost\" and \"Value\" fill in from the item's purchase rate.",
      "Optionally enter a \"Batch\", and use \"Reason (optional)\" on a line where the reason differs from the voucher's - one accident can spoil some items and merely damage others.",
      "Use \"Add line\" for more items. \"Total quantity\" and \"Total value\" are shown below the table.",
      "Click \"Save draft\" if you are mid-shift and want to come back to it, or \"Submit\" when the voucher is complete. The voucher number appears beside the buttons.",
    ],
    fields: [
      { name: "Cost / Value", desc: "Read-only. The system values the write-off at the item's purchase rate; anything typed here would be ignored." },
      { name: "Reason", desc: "Coded on purpose so wastage can be totalled and trended - \"the fridge failed\" reads differently from \"we over-produce on Fridays\"." },
    ],
    tips: [
      "A draft holds no voucher number and moves no stock. Only \"Submit\" does that.",
      "If a submit seems to hang, press \"Submit\" again rather than retyping the voucher - the system recognises the retry and will not record the loss twice.",
      "Do not scan a barcode into \"Quantity\"; the line turns red if the number is implausible.",
      "Record wastage as it happens. It is the only way to tell real waste apart from theft and miscounts later.",
    ],
    accounting:
      "On submit (or on approval, where your company requires approval) stock is reduced at the branch, and the value is posted to the general ledger as DR Cost of Goods Sold 5000 / CR Purchase Account 5200. A voucher with no value reduces stock but posts nothing to the books.",
    related: ["Wastage Report", "Physical Stock Correction"],
  },

  "Wastage Report": {
    summary:
      "Lists wastage vouchers across all branches with their reasons, quantities and values at cost, and lets you open any voucher to see its individual lines.",
    steps: [
      "Open Stock & Inventory > Wastage Report.",
      "Set the filters you need: \"Branch\" (blank for all), \"Reason\", \"Status\" and the \"From\" and \"To\" dates.",
      "Click \"Refresh\".",
      "Read the list: voucher, date, branch, reason, quantity, value, status and who recorded it. A voucher still in draft shows \"draft\" in place of a number.",
      "Click the arrow at the left of any row to open its lines - item, quantity, unit, cost, value, batch and that line's own reason.",
      "The chips under the table give the number of vouchers, the quantity and the value for the page you are looking at. Use the page controls at the bottom right for the rest.",
    ],
    tips: [
      "The totals shown are for the current page only, not for the whole filtered period.",
      "Filter by reason to see patterns: heavy EXPIRY usually means over-ordering, heavy SPOILAGE usually means a storage or fridge problem.",
      "Only APPROVED vouchers have moved stock and hit the books; drafts and rejected ones have not.",
    ],
    related: ["Wastage Entry"],
  },

  "Item Stock Report": {
    summary: "Shows how much of one item is held at each branch, and the company total.",
    steps: [
      "Open Stock & Inventory > Item Stock Report.",
      "Type or choose the item in \"Item Name\".",
      "Click \"Fetch Report\".",
      "Read the branch code, item name and total stock per branch; the last line gives \"Total Stock\" across all branches.",
      "Click \"Export to Excel\" to save it.",
    ],
    tips: [
      "One item at a time - the button stays disabled until a name is entered.",
      "Figures are the live position, not a position as at a past date. For a date, use Branch Inventory Ledger.",
    ],
    related: ["All Branch Stock Report", "Branch Stock Report", "Item Movement Report"],
  },

  "All Branch Stock Report": {
    summary:
      "A grid of every item against every branch: one row per item, one column per branch, with a total column. The quickest way to see where stock is sitting.",
    steps: [
      "Open Stock & Inventory > All Branch Stock Report. The grid loads on its own.",
      "Click \"Fetch Stock Report\" at any time to refresh it.",
      "Read across a row to see the same item's stock at each branch; \"Total Stock\" adds the row up.",
      "Click \"Export to Excel\", type a file name and click \"Export\".",
    ],
    tips: [
      "There are no filters and no dates - it is the live position for the whole company, so it can be a long list. The Excel export is usually easier to work with.",
      "Use it before a transfer to find which branch has spare stock.",
    ],
    related: ["Branch Stock Report", "Item Stock Report"],
  },

  "Branch Stock Report": {
    summary:
      "The current stock of one branch, item by item, valued at standard price, with a total stock value at the foot.",
    steps: [
      "Open Stock & Inventory > Branch Stock Report.",
      "Choose the branch in \"Select Branch\" (already filled in if you have only one).",
      "Click \"Generate Report\".",
      "Read the item code, item name, quantity, unit, HSN, standard price and stock value. \"Total Stock Value\" is on the last line.",
      "Click \"Export to Excel\" to save it, including the total line.",
    ],
    fields: [
      { name: "Stock Value", desc: "Quantity x standard price. Items with no standard price show a blank value and add nothing to the total." },
    ],
    tips: [
      "The value is at standard price, not at what you actually paid, so treat it as an indication rather than a closing stock valuation.",
      "A negative quantity means more has gone out than came in - usually a missing purchase or a transfer that was never accepted.",
    ],
    related: ["All Branch Stock Report", "Branch Inventory Ledger", "Branch Stock Management"],
  },

  "Branch Stock Management": {
    summary:
      "An administrator screen that shows a branch's stock and lets stock rows be deleted. Deleting removes that item's stock records for the branch outright - there is no undo.",
    steps: [
      "Open Stock & Inventory > Branch Stock Management.",
      "Choose the branch in \"Select Branch\".",
      "Click \"Fetch Stock\" to list the item code, item name and quantity.",
      "Click \"Export to Excel\" first if you want a record of the position before changing anything.",
      "To remove an item's stock at that branch, click \"Delete\" on its row and confirm the warning.",
    ],
    tips: [
      "This is a clean-up tool for bad data, not a way to correct a count. To correct a count use Physical Stock Correction, which leaves an audit trail; to write stock off use Wastage Entry, which values the loss and posts it to the books.",
      "Take the Excel export before deleting anything. The deleted movements cannot be recovered from this screen.",
      "Admin only, and rightly so.",
    ],
    accounting: "Removes stock records. Nothing is posted to the general ledger, so the books will no longer agree with stock.",
    related: ["Branch Stock Report", "Physical Stock Correction"],
  },

  "Branch Inventory Report": {
    summary:
      "Every stock movement at one branch on one day, listed in order: what came in, what went out, and which voucher caused it.",
    steps: [
      "Open Stock & Inventory > Branch Inventory Report.",
      "Choose the \"Branch\" and the \"Date\".",
      "Click \"Generate\".",
      "Read the lines: voucher date and time, voucher number, type, item, barcode, batch, description, \"Qty In\", \"Qty Out\" and \"Net\". Totals are on the last line.",
      "Click \"Export Excel\" to save the day, total line included.",
    ],
    fields: [
      { name: "Type", desc: "What caused the movement - a sale, a purchase, a transfer, PRODUCTION, WASTAGE or PHYSICAL_STOCK for a correction." },
      { name: "Net", desc: "In minus out for that line. Shown in red when negative." },
    ],
    tips: [
      "One day at a time. For an item across a period use Item Movement Report.",
      "This is the place to look when a branch's stock jumps unexpectedly - the voucher number tells you which document to open.",
    ],
    related: ["Branch Inventory Ledger", "Item Movement Report", "Stock Movement Report"],
  },

  "Branch Inventory Ledger": {
    summary:
      "The same day as the Branch Inventory Report, but summarised by item: opening, in, out and closing for each item, with the individual movements hidden behind each row.",
    steps: [
      "Open Stock & Inventory > Branch Inventory Ledger.",
      "Choose the \"Branch\" and the \"Date\".",
      "Click \"Generate\".",
      "Read one line per item: \"Opening\" (the position before that day), \"Qty In\", \"Qty Out\", \"Closing\" and the number of transactions.",
      "Click any row to open its movements - date and time, voucher number, type, batch, description, quantity in and quantity out - with a sub-total.",
      "Click \"Export Excel\" for the item summary including opening and closing.",
    ],
    fields: [
      { name: "Closing", desc: "Opening plus in minus out. Shown in red when negative, which normally means a receipt was never entered." },
    ],
    tips: [
      "This is the clearest daily check for a branch manager: anything with a strange closing figure can be opened on the spot.",
      "Opening stock is everything before the chosen date, so the very first day you ran the system will show zero openings.",
    ],
    related: ["Branch Inventory Report", "Item Movement Report", "Branch Stock Report"],
  },

  "Stock Movement Report": {
    summary:
      "Opening and closing stock for every item of your own branch over a date range, with the movements in between shown under each item and a running closing quantity.",
    steps: [
      "Open Stock & Inventory > Stock Movement Report.",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Fetch Stock Data\".",
      "Read one line per item: \"Opening Stock\" and \"Closing Stock\". Under \"Transactions\" each movement shows the voucher date, the time it was updated, a description, inward quantity, outward quantity and the running closing quantity.",
      "Click \"Export to Excel\", type a file name and click \"Export\".",
    ],
    tips: [
      "This screen always uses the branch you are logged in to - there is no branch picker. Log in to the branch you want to see.",
      "The running closing quantity makes it easy to spot the exact movement that pushed an item negative.",
    ],
    related: ["Branch Inventory Ledger", "Item Movement Report"],
  },

  "Physical Stock Report": {
    summary: "Lists the stock corrections that were posted from Physical Stock Correction over a period, so counts can be reviewed and audited.",
    steps: [
      "Open Stock & Inventory > Physical Stock Report.",
      "Choose a \"Branch\" or leave it on \"ALL\".",
      "Set \"From Date\" and \"To Date\" (it opens on the last few weeks).",
      "Click \"Fetch Report\".",
      "Read the lines: voucher date, voucher number, item name, barcode, quantity in, quantity out, rate and amount. Quantity in is stock found; quantity out is stock missing.",
      "Click \"Export Excel\", type a file name and export it.",
    ],
    tips: [
      "Only corrections appear here - sales, purchases and transfers do not.",
      "Repeated large corrections on the same item point to a process problem (wrong unit, unrecorded wastage, or a recipe that does not match reality), not to a counting problem.",
    ],
    related: ["Physical Stock Correction", "Stock Anomaly Report"],
  },

  "Stock Turnover Report": {
    summary:
      "A simple comparison of how much of each item has been purchased against how much has been sold, with a turnover rate. It is a rough, whole-history indicator.",
    steps: [
      "Open Stock & Inventory > Stock Turnover Report. It loads by itself; there is nothing to fill in.",
      "Read the columns: item name, total purchased quantity, total sold quantity and stock turnover rate.",
      "A rate near 100 means you sell about as much as you buy; a low rate means stock is building up; a high rate means you are selling faster than you buy in.",
    ],
    tips: [
      "The rate is worked out as total sold quantity divided by total purchased quantity, times 100.",
      "There is no date filter, no branch filter and no export - it covers the whole history for the whole company.",
      "Treat the numbers as a rough guide only. For decisions about ordering, use the Item Velocity Report or the Stock Anomaly Report, which work over a period you choose.",
    ],
    related: ["Item Velocity Report", "Stock Anomaly Report"],
  },

  "Stock Anomaly Report": {
    summary:
      "Finds stock that is not behaving: items with far more stock than their sales justify, and dead items that have not moved for months. Shows the money tied up in them.",
    steps: [
      "Open Stock & Inventory > Stock Anomaly Report.",
      "Choose a branch in \"Branch (leave blank for all)\".",
      "Set \"High-Stock Threshold (months)\" - an item is flagged when it holds more than that many months of supply. Three to six months suits most shops.",
      "Click \"Generate Report\".",
      "Read the summary cards at the top: high stock items, dead stock items, tied-up capital and total anomalies.",
      "Use the \"High Stock Items\" and \"Dead Stock Items\" tabs. High stock shows branch, item, code, unit, current quantity, average sold per month, months of supply and stock value; dead stock shows the current quantity and the last transaction date.",
      "Click a column heading to sort. Click \"Export Excel\" to save the tab you are on.",
    ],
    fields: [
      { name: "Months Supply", desc: "Current quantity divided by the average monthly outflow. Green up to six months, amber up to twelve, red beyond that. \"No Sales\" means the item has no outflow at all, so cover cannot be worked out." },
      { name: "Dead stock", desc: "Items sitting at zero with no transaction in the past six months - usually lines that should be removed from the catalogue." },
    ],
    tips: [
      "Use the filter icon at the top right (\"Excluded Categories\") to hide categories that always look odd - services, packaging and the like. Pick a category, click \"Exclude\", and it disappears from all stock analysis reports; click the small x on a chip to bring it back.",
      "Tied-up capital is the best number to take to an owner: it says what the overstock is costing in cash.",
      "Raising the threshold shortens the high-stock list; it does not change the underlying stock.",
    ],
    related: ["Item Velocity Report", "Branch Stock Report", "Stock Turnover Report"],
  },

  "Item Sales Report": {
    summary: "How much of the items you choose was sold at each branch over a date range, in quantity and in money.",
    steps: [
      "Open Stock & Inventory > Item Sales Report.",
      "Type in \"Search & Select Items\" and pick one or more items - they appear as chips, and you can add as many as you need.",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Load Report\".",
      "Read one line per branch and item: branch code, item name, \"Qty Sold\" and \"Total Sales\". The last line totals both columns, and chips above the table repeat the totals.",
      "Click \"Export Excel\", type a file name and export it.",
    ],
    tips: [
      "At least one item must be selected - the button stays disabled otherwise.",
      "Because it is branch-wise, it is the quickest way to see which shop sells a line and which does not.",
    ],
    related: ["Item Velocity Report", "Category Sales Summary Report"],
  },

  "Item Movement Report": {
    summary:
      "A statement for one item at one branch: opening balance, every movement in date order with a running balance, and the closing balance.",
    steps: [
      "Open Stock & Inventory > Item Movement Report.",
      "Choose the \"Branch\", then type in the \"Item\" box and pick the item.",
      "Set \"From\" and \"To\".",
      "Click \"Load\".",
      "\"Opening Balance\" is shown above the table. Each line gives the date, voucher number, particulars, batch, quantity in, quantity out and the running balance; totals for in and out are at the foot.",
      "Click \"Export Excel\", type a file name and export it.",
    ],
    tips: [
      "This is the report to open when someone asks \"where did that stock go?\" - the voucher number on each line names the document to check.",
      "If the balance goes negative part way through, look for a purchase or an incoming transfer that was entered late or never accepted.",
    ],
    related: ["Branch Inventory Ledger", "Stock Movement Report", "Item Transfer Report"],
  },

  "Item Velocity Report": {
    summary:
      "Ranks items by how fast they sell over a period, side by side: the fastest movers and the slowest movers, each with days of cover at the current rate.",
    steps: [
      "Open Stock & Inventory > Item Velocity Report.",
      "Choose a \"Branch\" and, if you want, a \"Category (optional)\".",
      "Set \"From\" and \"To\" (it opens on the current month).",
      "Choose how many lines each side should show in \"Items to show\" - 5, 10, 20 or 50.",
      "Click \"Generate\".",
      "Read the two tables. \"Fast Moving\" is the top items by quantity sold; \"Slow Moving\" is the bottom. Each shows quantity sold, average per day, current stock and days of cover.",
      "Click \"Export Excel\" to save both lists in one sheet, marked fast or slow.",
    ],
    fields: [
      { name: "Avg / Day", desc: "Quantity sold divided by the number of days in the range you chose, so a longer range gives a smoother figure." },
      { name: "Days of Cover", desc: "Current stock divided by the average sold per day - how long today's stock will last. An item with no sales in the period shows the infinity sign, meaning it will never run out at the current rate." },
    ],
    tips: [
      "Fast movers with few days of cover are your re-order list; slow movers with high cover are your discount or delist list.",
      "Pick a period that reflects normal trading. A week containing a festival will mislead you in both directions.",
    ],
    related: ["Stock Anomaly Report", "Item Sales Report"],
  },

  "Item Transfer Report": {
    summary: "Every branch-to-branch transfer of one item over a period: which branch sent it, which branch received it, how much and at what value.",
    steps: [
      "Open Stock & Inventory > Item Transfer Report.",
      "Type at least two characters in \"Type First two Chars of Item Name\" and pick the item from the list.",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Generate Report\".",
      "Read the lines: voucher number, date, from branch, to branch, item, quantity, rate and amount, with totals at the foot.",
      "Click \"Export to Excel\" to save it.",
    ],
    tips: [
      "The rows are taken from the transfers sent out, so a transfer appears here as soon as the sending branch raises it - whether or not the receiving branch has accepted it yet.",
      "To check what has actually been received, compare with the Stock Transfer In Report.",
    ],
    related: ["Stock Transfer Out Report", "Stock Transfer In Report"],
  },

  "Category Item Report": {
    summary: "Lists the items belonging to the categories you choose - a catalogue listing, not a stock report.",
    steps: [
      "Open Stock & Inventory > Category Item Report.",
      "Pick one or more categories in \"Select Categories\"; each appears as a chip.",
      "Click \"Get Items\".",
      "Read the list of items with their category, item id, name, HSN code, unit, tax rate and standard price. The header shows the categories chosen and the total number of items.",
      "Click \"Print\" for a printable page, or \"Excel\" to save the same list as a spreadsheet.",
    ],
    tips: [
      "There are no quantities here - it tells you what is in a category, not what is in stock.",
      "Handy for checking tax rates and HSN codes before a return, and for finding items filed under the wrong category.",
    ],
    related: ["Category Sales Summary Report"],
  },

  "Category Sales Summary Report": {
    summary:
      "Asks the server for a category's sales over a period. The report is produced in the background and arrives as a file rather than appearing on screen.",
    steps: [
      "Open Stock & Inventory > Category Sales Summary Report.",
      "Choose the \"Category\", then the \"Branch\" (or leave it on \"All branches\").",
      "Set \"From\" and \"To\".",
      "Click \"Request Report\". A message confirms the request was accepted.",
      "Watch the \"My Requests\" list below; click \"Refresh\" to update it. When the report is ready you are notified and can download the file from there.",
      "Click \"All my reports\" to see everything you have requested, including older reports.",
    ],
    tips: [
      "Because it runs in the background you can leave the screen - the file is waiting under My Reports when it finishes. Files are kept for 7 days, so download anything you need to keep.",
      "Long periods are fine here; that is the point of running it in the background.",
    ],
    related: ["Category Item Report", "Item Sales Report"],
  },

  "Stock Transfer In Report": {
    summary:
      "Transfers that have been received and accepted at a branch. A transfer only appears once the receiving branch has accepted it on the till, so this is the proof that stock actually landed.",
    steps: [
      "Open Stock & Inventory > Stock Transfer In Report.",
      "Choose \"From Branch\" and/or \"To Branch\" - at least one must be a real branch, they cannot both be left as all.",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Fetch Stock Transfer Out\" to list the transfers.",
      "Read the lines: voucher number, \"Accept Voucher Date (IST)\" (when it was accepted at the receiving branch), \"Source Voucher Date (IST)\" (when the sending branch raised it), from branch, to branch, item, quantity, rate and amount, with totals at the foot.",
      "Click a row to open the original transfer-out invoice for that voucher.",
      "Click \"Export to Excel\", type a file name and export it.",
    ],
    tips: [
      "A gap between the source date and the accept date is stock in transit - it has left the sending branch but not yet been added to the receiving branch.",
      "If a transfer you expect is missing, the receiving branch has probably not run \"Accept Stock\" on the till yet.",
    ],
    accounting: "Stock is added to the receiving branch when the transfer is accepted there, not when it is sent.",
    related: ["Stock Transfer Out Report", "Item Transfer Report"],
  },

  "Stock Transfer Out Report": {
    summary: "Transfers sent out from a branch over a period, with the reason code, quantity and value.",
    steps: [
      "Open Stock & Inventory > Stock Transfer Out Report.",
      "Choose \"From Branch\" and/or \"To Branch\" - they cannot both be left as all.",
      "Optionally narrow by \"Reason Code\".",
      "Set \"From Date\" and \"To Date\".",
      "Click \"Fetch Stock Transfer Out\".",
      "Read the lines: voucher number, voucher date, from branch, to branch, reason code (blank shows as \"NORMAL DC\"), item, quantity, rate and amount, with totals at the foot.",
      "Click a row to open that transfer's invoice, or \"Export to Excel\" to save the list.",
    ],
    tips: [
      "Stock leaves the sending branch when the transfer is raised here, and only reaches the receiving branch when someone there accepts it on the till.",
      "Compare this report with the Stock Transfer In Report regularly. Anything sent but never accepted is stock nobody is counting.",
    ],
    accounting: "Stock is taken off the sending branch. Nothing is posted to the general ledger - it is a movement between your own branches, not a sale.",
    related: ["Stock Transfer In Report", "Item Transfer Report"],
  },

  // ─── WEIGHBRIDGE ───────────────────────────────────────────────────────────
  Weighbridge: {
    summary: "Lists weighbridge weighings and their charges for a period, for one branch or for all, and can be narrowed to a single vehicle.",
    steps: [
      "Open Weighbridge > Weighbridge Entry.",
      "Choose a \"Branch\", or leave it on \"All Branches\".",
      "Set \"From Date\" and \"To Date\" - these include a time, so you can look at a single shift.",
      "Optionally type a \"Vehicle Number\" (for example KL07AB1234) to follow one vehicle; leave it blank for all vehicles. Pressing Enter in this box runs the search.",
      "Click \"Fetch WeighBridge Sales\".",
      "Read the lines: branch, voucher number, voucher date, vehicle number, wheel type, machine weight, first weight, amount and round trip. The last line gives the number of records and the total amount.",
      "Click \"Export to Excel\", type a file name and click \"Export\".",
    ],
    fields: [
      { name: "First Weight", desc: "The weight taken on the first visit of a round trip; the machine weight is the reading from the bridge." },
      { name: "RoundTrip", desc: "Marks a weighing that is the return leg of a two-visit job rather than a fresh one." },
    ],
    tips: [
      "Leaving the branch on \"All Branches\" and typing a vehicle number follows that vehicle across every weighbridge.",
      "If records are missing for a day, the terminal may not have sent them - use Resync Records.",
    ],
    related: ["Weight-Count", "Weighbridge Resync"],
  },

  "Weight-Count": {
    summary: "Compares the vehicles that stood on the weighbridge with the vouchers saved, day by day, to catch weighings done without a voucher. The weighbridge PC reports every vehicle on the bridge (its first stable weight above 200 kg) even when no voucher is saved.",
    steps: [
      "Open Weighbridge > Weight-Count.",
      "Choose the \"Branch\".",
      "Set \"From\" and \"To\", or click \"Today\" or \"Yesterday\".",
      "Click \"Show\".",
      "Read the day table: vehicles on the bridge, weighing and tare vouchers saved, the \"Gap\" (vehicles minus vouchers) and how many vehicles have no voucher near their time.",
      "Below it, each vehicle on the bridge is listed with the voucher it was paired with. Turn on \"Only vehicles with no voucher\" to see just the suspicious ones (shown in red).",
      "Click \"Export to Excel\" for both tables.",
    ],
    tips: [
      "A vehicle is paired with a weighing or tare voucher saved up to 5 minutes before or 30 minutes after it stood on the bridge.",
      "A vehicle that stays on the bridge counts once; the next one counts after the bridge is empty again.",
      "PCs that were offline send their vehicles when they reconnect, so a recent gap can shrink once they sync.",
      "A branch must be chosen - there is no all-branches option.",
    ],
    related: ["Weighbridge", "WeighBridge Usage"],
  },

  "WeighBridge Usage": {
    summary: "A forecast of how busy the weighbridge will be, day by day, produced by a model trained on past usage.",
    steps: [
      "Open Weighbridge > WeighBridge Usage.",
      "Set \"Start Date\" and \"End Date\" - both are required.",
      "Click \"Load Report\".",
      "Read the table: one line per date with the predicted usage count.",
      "Click \"Train Model\" to have the model relearn from recent history; a message confirms when it has finished.",
    ],
    tips: [
      "These are predictions, not records. For what actually happened use Weighbridge Entry or Weight-Count.",
      "Retrain occasionally - after a change in trade patterns the old figures stop being a good guide.",
      "There is no export on this screen.",
    ],
    related: ["Weight-Count", "Weighbridge"],
  },

  "Weighbridge Resync": {
    summary:
      "Asks a weighbridge terminal to send its records for a day again, when weighings are missing from the reports. The terminal acts on the request the next time it logs in.",
    steps: [
      "Open Weighbridge > Resync Records.",
      "Choose the \"Branch\" whose terminal is missing records.",
      "Choose the \"Date\" you want re-sent.",
      "Click \"Fetch\". A message confirms that the branch will re-push that day at its next login.",
      "Watch the table below: branch, date, status, who requested it, when it was requested and when it completed.",
      "\"Waiting for terminal\" means the terminal has not picked the request up yet; \"Done\" means it has, and the number in brackets is how many vouchers it queued to send.",
    ],
    tips: [
      "Nothing happens until that terminal next connects, so if the till is switched off the request simply waits.",
      "\"Done (0 queued)\" means the terminal had nothing for that day - the records were never recorded there, so re-syncing will not bring them back.",
      "Re-sending does not create duplicates; records already held are recognised.",
    ],
    related: ["Weighbridge", "Weight-Count"],
  },
};
export default content;
