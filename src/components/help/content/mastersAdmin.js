// Help content: Masters + System Administration. Keys must match menuKey in src/menuCatalog.js.
const content = {
  // ─────────────────────────────── MASTERS ───────────────────────────────
  "Branch Details": {
    summary:
      "Edit the name, address, GST number, invoice prefix and branch type of an existing branch. Branches are created in Setup & Administration; this screen only corrects their details.",
    steps: [
      "Open Masters > Branch Details.",
      "In the \"Select Branch\" list on the left, click the branch you want to change. Its details open on the right.",
      "Change any of the fields you need.",
      "Click \"Save Changes\". A green message confirms the branch was updated.",
      "Pick another branch from the list to continue, or leave the screen.",
    ],
    fields: [
      { name: "Branch Name", desc: "The shop name printed on invoices and shown in reports." },
      { name: "GST Number", desc: "The branch's tax registration number. It is printed on the invoice and used in tax reports, so type it exactly." },
      { name: "Invoice Prefix", desc: "Up to 4 characters put in front of bill numbers for this branch, so each shop's bills stay unique. Do not change it once billing has started." },
      { name: "Branch Type", desc: "What kind of branch this is (for example BAKERY_OUTLET, PRODUCTION, FRANCHISE_OUTLET). Costing and some reports behave differently per type, so change it only if it was set wrongly." },
    ],
    tips: [
      "The branch code cannot be changed here — it is the branch's permanent identity.",
      "Changing the name or address does not change bills that were already printed.",
      "The address fields here are used by invoices, stock transfer notes and other printouts. The POS receipt uses POS Address Configuration instead.",
    ],
    related: ["Branch Creation", "POS Address Configuration", "Branch Day End Settings"],
  },

  "POS Address Configuration": {
    summary:
      "Controls exactly which address lines are printed under the shop name on the POS cash receipt, and in what order.",
    steps: [
      "Open Masters > POS Address Configuration.",
      "Click a branch in the \"Select Branch\" list. The first time, the lines are filled in from the branch's existing address fields.",
      "Edit any line, or click \"Add Line\" to add a new one (up to 200 characters each).",
      "Use the up and down arrows beside a line to move it, and the red bin icon to delete it.",
      "Check the \"Receipt Preview\" box — it shows the receipt exactly as it will print.",
      "Click \"Save Changes\".",
    ],
    tips: [
      "Blank lines are dropped when you save, so you do not need to tidy them up.",
      "This affects only the POS receipt. Invoices, stock transfer notes and KOT prints still use the branch address from Branch Details.",
      "This screen exists so a line is not printed twice when two branch address fields hold the same text — a common complaint on old receipts.",
    ],
    related: ["Branch Details", "Invoice Designer"],
  },

  "Item Cost Override": {
    summary:
      "A list of manually entered cost rates for items, kept as a fallback when the system cannot work out an item's cost by itself.",
    steps: [
      "Open Masters > Item Cost Override.",
      "Use \"Search by item name / code / branch\" to find an item.",
      "Click \"Add Override\" for a new rate, or the pencil icon on a row to change an existing one.",
      "Fill in \"Item ID\" (required) and, if you like, \"Item Name\" and \"Item Code\".",
      "Leave \"Apply to all branches\" off and type a \"Branch Code\" to set the rate for one shop only; switch it on to use the same rate everywhere.",
      "Type the \"Cost Rate\" (must be more than 0) and any \"Notes\", then click \"Save\".",
      "To remove a rate, click the red bin icon and confirm in the \"Delete Override?\" box.",
    ],
    fields: [
      { name: "Scope", desc: "\"Branch-specific\" means the rate applies to that one branch; \"Global\" means all branches." },
      { name: "Cost Rate", desc: "What one unit of the item costs you. It is used only for profit reporting — it never changes selling price or stock value entries." },
    ],
    tips: [
      "Important: the nightly costing job reads manual rates from Cost Price History, not from this list. If you want the Branch Profit Report to pick up a manual cost, enter it in Cost Price History and then re-run Cost Stamping for those sale dates.",
      "Use this screen mainly to keep a record of agreed standard costs; use Cost Price History to actually correct the reports.",
      "The \"← Profit Report\" button takes you straight to the Branch Profit Report.",
    ],
    related: ["Cost Price History", "Cost Stamping", "Branch Profit Report"],
  },

  "Cost Price History": {
    summary:
      "The dated list of what each item cost at each branch. This is what the Branch Profit Report uses to work out profit, and where you correct a wrong cost — including for past dates.",
    steps: [
      "Open Masters > Cost Price History.",
      "Search for the item by name, code or branch to see the rates already recorded for it.",
      "Click \"Add Entry\" for a new rate, or the pencil icon to correct an existing one.",
      "Enter \"Item ID\" (required), and the branch — or switch on \"Apply to all branches\" for a company-wide rate.",
      "Type the \"Cost Rate\" and the \"Effective Date\". You may set a past date to correct history.",
      "Add a note explaining the correction, then click \"Save\".",
      "Go to Cost Stamping and re-run the sale dates affected, so the profit reports pick up the new rate.",
    ],
    fields: [
      { name: "Effective Date", desc: "The date the rate starts applying from. Sales on or after it use this rate until a later entry takes over." },
      { name: "Source", desc: "Where the rate came from: PURCHASE, STOCK_TRANSFER or PRODUCTION_COST are written automatically by the system; MANUAL means somebody typed it here." },
    ],
    tips: [
      "A MANUAL rate beats every automatic rate for that item, whatever date it carries. A rate entered for one branch beats one entered for all branches.",
      "Deleting an entry makes those sales fall back to the next older entry, or to the automatic purchase / transfer / production rate, or to no cost at all.",
      "Entering a cost here never touches stock quantities or the books — it only changes how profit is reported.",
    ],
    related: ["Cost Stamping", "Item Cost Override", "Branch Profit Report", "Monthly Branch Profit Report"],
  },

  "Cost Stamping": {
    summary:
      "Runs and monitors the nightly job that writes a cost and a profit figure onto every sales line, so the Branch Profit Report just adds up stored numbers instead of recalculating each time. The screen is titled \"Cost & Profit Stamping\".",
    steps: [
      "Open Masters > Cost & Profit Stamping.",
      "Click \"Show Help\" to read the built-in explanation, or \"Hide Help\" to collapse it.",
      "Look at \"Current coverage\": from and to dates already costed, how many sales lines are stored, and how many are still \"Without a cost\".",
      "If any lines have no cost, click \"Set missing cost prices\" — it takes you to Cost Price History.",
      "To re-cost a period, pick \"From Date\" and \"To Date\" (these are sale dates, not today's date), or click a shortcut chip: \"Last 7 days\", \"This month\" or \"Last month\".",
      "Click \"Run Now\" and wait. The message at the bottom tells you how many lines were covered, updated and left without a cost.",
      "Check \"Recent runs\" to see each run's status, trigger (Automatic or Manual) and results. Click \"Refresh\" to update the page.",
    ],
    fields: [
      { name: "Lines Covered", desc: "Every sales line in the date range the job looked at." },
      { name: "Lines Updated", desc: "Only the lines whose cost or amount actually changed. A small number on a repeat run is normal and means nothing needed correcting." },
      { name: "Without Cost", desc: "Lines where no cost could be found. Their sales value still counts as sales, but they are left out of cost and profit so a missing rate never looks like free stock." },
    ],
    tips: [
      "It runs by itself at 01:30 every night and re-covers the last 7 days, so normally you do not need to touch it.",
      "How the cost is chosen: a manual rate in Cost Price History always wins (branch-specific beats all-branches); otherwise the latest purchase, stock-transfer-in or production rate at that branch on or before the sale date; if none exists, the line is left without a cost.",
      "Profit = Sales Amount minus (Cost Rate x Quantity).",
      "Safe to run as often as you like — it creates no duplicates and only rewrites what differs. A second run for the same company is skipped, not queued.",
      "Backfill old months one month at a time, oldest first: roughly a minute per busy month per branch.",
      "If you see a message that migrations V042 and V043 are missing, the company database has not been upgraded and stamping cannot run — ask your system administrator.",
    ],
    related: ["Cost Price History", "Item Cost Override", "Branch Profit Report", "DB Migrations"],
  },

  "Receipt Modes": {
    summary:
      "Sets up the payment methods cashiers can choose at the POS (Cash, Card, UPI and so on) and links each one to the ledger account the money lands in.",
    steps: [
      "Open Masters > Receipt Modes.",
      "Type the name in \"Receipt Mode Name\" exactly as it should appear at the POS.",
      "In \"GL Account (search by code or name)\", start typing the account (for example \"Cash in Hand\" or \"1001\") and pick it from the list. Only asset accounts are offered.",
      "Click \"Add Receipt Mode\". The new mode appears in \"Existing Receipt Modes\" below.",
      "To remove one, click the red bin icon in its row and confirm.",
    ],
    tips: [
      "A mode without a GL account cannot be added — the screen asks for one.",
      "Get the account right the first time: every sale paid by that mode is posted to it, and the Day End Report and Daily Cash Summary are grouped by receipt mode.",
      "Do not delete a mode that has been used for billing; old bills keep the mode name they were saved with, and removing it makes the list confusing.",
    ],
    accounting: "Each sale paid by a mode debits that mode's ledger account (an asset, e.g. Cash in Hand or Bank) and credits Sales and tax.",
    related: ["Ledger Accounts", "Day End Report", "Daily Cash Summary", "UPI Payment Setup"],
  },

  "Item Search": {
    summary: "A read-only list of every item with its codes, prices and tax rates, with search and an Excel export.",
    steps: [
      "Open Masters > Item Search.",
      "Type in \"Search Items\" to filter by name or code. The list updates as you type.",
      "Click the \"Item Name\" heading to sort the list, and click again to reverse it.",
      "Use the paging controls at the bottom to move through the list and change how many rows are shown.",
      "Click \"Export to Excel\" to download the whole filtered list as Item_List.xlsx.",
    ],
    fields: [
      { name: "Standard Price", desc: "The default selling price, before any branch-specific price." },
      { name: "Purchase Rate", desc: "The last purchase rate stored on the item record." },
      { name: "Cess Rate", desc: "Extra tax on top of the normal tax rate, used for some goods." },
    ],
    tips: [
      "Nothing on this screen can be edited — use Item Creation to change an item.",
      "The export always contains everything matching your search, not only the page on screen.",
    ],
    related: ["Item Creation", "Branch Price", "Tax Update Manager"],
  },

  "Item Creation": {
    summary: "Create new items and edit existing ones: name, unit, price, barcode, item code, tax rate and HSN code.",
    steps: [
      "Open Masters > Item Creation.",
      "To change an existing item, type in \"Search Items\" and click the pencil icon in the list at the bottom — its details load into the form.",
      "Fill in the item name, unit, standard price, barcode, item code, tax rate and HSN code.",
      "Click the button at the bottom of the form to save (it reads Submit for a new item, Update Item when you are editing).",
      "The list of items below refreshes with your change.",
      "Use the bin icon in the list to delete an item.",
    ],
    fields: [
      { name: "Standard Price", desc: "The default selling price used at every branch unless a Branch Price override exists." },
      { name: "Barcode", desc: "What the scanner reads at the POS. It must be unique, or the wrong item will be billed." },
      { name: "Tax Rate", desc: "The tax percentage charged on this item. Used on every bill, so check it before you save." },
      { name: "HSN Code", desc: "The tax classification code printed on invoices and used in HSN-wise sales reports." },
    ],
    tips: [
      "Item name, unit, barcode and HSN code are required; the price must be more than zero.",
      "Changing a price here changes it for every branch that has no branch-specific price.",
      "Do not delete an item that has been sold or purchased — past documents keep their own copy, but stock and reports become hard to follow.",
    ],
    related: ["Item Search", "Branch Price", "Category Link", "Tax Update Manager"],
  },

  "Branch Price": {
    summary: "Gives one branch its own selling price and tax rate for chosen items. Branches without an override use the item's default price.",
    steps: [
      "Open Masters > Branch Price.",
      "Pick the shop in the \"Branch\" box.",
      "Find items with the \"Search by name or barcode…\" box; the first page shows a small set, so search for anything beyond it.",
      "Type the new price in the \"Branch Price\" column, and a different \"Tax %\" if needed. Edited rows turn yellow and are marked \"Unsaved\".",
      "Click \"Save Changes\" (the number of pending edits is shown on the button), or \"Discard\" to throw the edits away.",
      "To put an item back on the standard price, click the red bin icon in its row — this removes the override.",
    ],
    fields: [
      { name: "Default Price", desc: "The item's standard price, for comparison. It is not changed by this screen." },
      { name: "Status", desc: "\"Default\" = uses the standard price, \"Override\" = this branch has its own price (shown in blue), \"Unsaved\" = edited but not yet saved." },
    ],
    tips: [
      "Leaving the Branch Price box empty is not the same as removing the override — use the bin icon to go back to the default.",
      "New prices apply to bills made after the POS picks up the change; they do not alter bills already made.",
    ],
    related: ["Item Creation", "Price Edit Category Wise", "Item Search"],
  },

  "Stock Transfer Discount": {
    summary:
      "Sets the rate at which items are transferred out to another branch or franchise — either a discount percentage off the normal rate, or a fixed transfer rate — with a date range.",
    steps: [
      "Open Masters > Stock Transfer Discount.",
      "Click \"+ Add Discount\".",
      "In \"Item Search\", type the item name or code and click the item in the suggestion list. A tick confirms the selection.",
      "Choose the \"Branch\" it applies to, or leave it as \"Company-wide\" for all branches.",
      "Pick \"Discount %\" or \"Fixed Rate\" under Discount Type, then enter the value. Only one of the two can be set.",
      "Set \"Effective From\" and, if it should end, \"Effective To\" (leave blank for no end date). Add \"Remarks\" explaining why.",
      "Click \"Save\". Use the pencil icon to edit a record later, or the block icon to deactivate it.",
    ],
    tips: [
      "Use the \"Search item…\" box and the branch and status filters at the top to find existing records.",
      "Records are deactivated, not deleted, so the history of what rate applied when is kept.",
      "The rate here decides the value of the stock transfer document, which in turn is what the receiving branch records as its cost — so it feeds straight into branch profit.",
    ],
    accounting: "Affects the value of stock transferred between branches, and therefore the receiving branch's cost of goods and profit. It does not change selling prices.",
    related: ["Transfer Config", "Franchise Stock Transfer", "Cost Price History"],
  },

  "Price Edit Category Wise": {
    summary:
      "Changes branch prices for a whole category at once — apply one discount percentage across the category, then fine-tune individual items. The screen is titled \"Category-wise Branch Price Editor\".",
    steps: [
      "Open Masters > Price Edit Category Wise.",
      "Choose the \"Branch\" and the \"Category\". The items load below.",
      "Type a \"Discount %\" and click \"Apply\" to set that discount for the whole category at this branch.",
      "For a single item, type the price you want in the \"Set Discounted Price\" box and click \"Save\" on that row.",
      "Use \"Search items\" to narrow the list, and \"Prev\" / \"Next\" and the \"Rows\" box to move through it.",
    ],
    fields: [
      { name: "Global Std", desc: "The item's standard price, the same for every branch." },
      { name: "Current (Branch)", desc: "The price this branch is charging today." },
      { name: "Suggested (by %)", desc: "What the price would be if the discount percentage you typed were applied to the standard price. It is only a suggestion until you save." },
    ],
    tips: [
      "\"Apply\" changes many items at once and cannot be undone with one click — check the discount before pressing it.",
      "Items must be linked to the category (see Category Link) or they will not appear here.",
    ],
    related: ["Branch Price", "Category Link", "Category Name"],
  },

  "Category Type": {
    summary: "Creates the top-level grouping for categories — for example Department, Section or Brand. Category names are then created under a type.",
    steps: [
      "Open Masters > Category Type.",
      "Type the name in \"Category Type\".",
      "Click \"Create Category\".",
      "The new type appears in the \"Existing Categories\" list below.",
    ],
    tips: [
      "Create the type first; Category Name will not let you create anything without one.",
      "Keep the number of types small — they are a grouping for categories, not a list of products.",
    ],
    related: ["Category Name", "Category Link"],
  },

  "Category Name": {
    summary: "Creates the actual categories (for example Bread, Cakes, Beverages) under an existing category type.",
    steps: [
      "Open Masters > Category Name.",
      "Choose the \"Category Type\" from the dropdown.",
      "Type the \"Category Name\".",
      "Click \"Create Category\".",
      "The category appears in the \"Existing Categories\" table below; use the bin icon to remove one.",
    ],
    tips: [
      "Categories drive the category-wise sales and price screens, so use names that your managers will recognise on a report.",
      "Do not delete a category that items are still linked to — those items drop out of category-based reports.",
    ],
    related: ["Category Type", "Category Link", "Price Edit Category Wise", "Report Exclusions"],
  },

  "Category Link": {
    summary: "Links items to categories. An item must be linked before it shows up in any category-based price screen or report. The screen is titled \"Item Category Linking\".",
    steps: [
      "Open Masters > Category Link.",
      "Find the item with \"Search Item by Name\", or type its ID in \"Item ID\".",
      "Pick the category in \"Select Category\".",
      "Click \"Link Category\".",
      "The link appears under \"Existing Mappings\". Click \"Refresh\" to reload the list.",
      "To undo a link, click the bin icon beside it.",
    ],
    tips: [
      "An item can be linked to more than one category.",
      "If an item is missing from Price Edit Category Wise or from a category-wise sales report, check its link here first.",
    ],
    related: ["Category Name", "Price Edit Category Wise", "Item Creation"],
  },

  "Report Exclusions": {
    summary:
      "Hides chosen categories from the stock analysis reports (such as Stock Anomaly and Item Velocity), so things like packing material or free items do not clutter them.",
    steps: [
      "Open Masters > Report Exclusions.",
      "The \"Currently Excluded\" panel shows the categories already hidden.",
      "In \"Select category\", choose a category from the list of those not yet excluded.",
      "Click \"Exclude\".",
      "To bring a category back into reports, click the small x on its chip in \"Currently Excluded\".",
    ],
    tips: [
      "This hides categories from reports only. Stock, sales and the books are not changed in any way.",
      "It affects the stock analysis reports, not the ordinary sales or purchase reports.",
    ],
    related: ["Category Name", "Category Link"],
  },

  "Tax Update Manager": {
    summary:
      "Records new tax and cess rates for items from a chosen date — one item at a time, for everything matching your filters, or for a whole category.",
    steps: [
      "Open Masters > Tax Update Manager.",
      "Narrow the list with \"Search (Name/Code/Barcode)\", the \"Category\" box, and the \"Filter by Current Tax =\" switch with its value box.",
      "Set \"Applicable Date\" — the date the new rate starts from.",
      "For one item, type the value in its \"New Tax %\" (and \"New Cess %\") box and click \"Save\" on that row.",
      "To change many at once, type \"New Tax Rate (%)\" and optionally \"New Cess Rate (%) (optional)\" at the top, then click \"Apply to Filtered\" for everything currently listed, or \"Apply to Category\" for the whole selected category.",
      "Check the result in Tax Update Preview before it goes live.",
    ],
    tips: [
      "Saving here records the planned change separately; it does not immediately overwrite the item master.",
      "\"Apply to Category\" ignores the search and tax filters and uses the selected category only — a common mistake is to expect it to respect the search box.",
      "Set the applicable date carefully: getting it wrong means bills are charged at the wrong rate.",
    ],
    accounting: "Changes the tax charged on future bills for those items, and therefore the tax shown on invoices and in the tax summary reports.",
    related: ["Tax Update Preview", "Item Creation", "Sales Tax Summary"],
  },

  "Tax Update Preview": {
    summary: "Shows current versus proposed tax and cess rates for a date before anything is applied, and is where you finally apply the change.",
    steps: [
      "Open Masters > Tax Update Preview.",
      "Set the filters: \"Search (Name/Code/Barcode)\", \"Category\", \"Filter Current Tax =\", \"Effective Date\" and \"Limit\" (how many rows to fetch).",
      "Click \"Load Preview\". The table fills with each item's current and proposed rates.",
      "Check the numbers. \"Total matches\" at the bottom tells you how many items are affected.",
      "Click \"Export to Excel\" if you want the list for checking or for your records.",
      "Click \"Apply Changes\", then \"Yes, Apply\" in the confirmation box. Only rows with proposed values are sent.",
    ],
    tips: [
      "Always load the preview and read \"Total matches\" before applying — this is the last check before rates change.",
      "If \"(showing first batch)\" appears, raise the Limit to see everything that will be affected.",
      "Applying uses the \"Effective Date\" shown in the confirmation box, not today's date.",
    ],
    related: ["Tax Update Manager", "Sales Tax Summary", "HSN wise Sales"],
  },

  "Supplier Creation": {
    summary: "Creates and edits the suppliers you buy from. A supplier must exist here before you can enter a purchase against it.",
    steps: [
      "Open Masters > Supplier Creation.",
      "Fill in \"Supplier Name\" (required) and, as available, address, GST, state and phone.",
      "Click \"Create Supplier\".",
      "The supplier appears in the \"Suppliers\" list below. Use the search box to find one by name, GST or phone.",
      "Click \"Edit\" on a row to correct the details, then \"Save\" in the dialog.",
    ],
    fields: [
      { name: "Supplier GST", desc: "Their tax registration number. Needed for input tax credit and purchase tax reports, so copy it exactly from their invoice." },
      { name: "Supplier State", desc: "Decides whether purchases are treated as within-state or between-state for tax." },
    ],
    tips: [
      "Past purchases keep the supplier name they were saved with, so editing a name does not rewrite old documents.",
      "Do not create the same supplier twice — the supplier statement and ageing reports will then split their balance in two.",
    ],
    accounting: "A supplier is a party in Accounts Payable. Purchases credit their account; payments debit it.",
    related: ["Purchase Entry", "Supplier Statement", "Supplier Aging"],
  },

  // ───────────────────── SYSTEM ADMINISTRATION ─────────────────────
  "Branch Day End Settings": {
    summary: "Decides, branch by branch, whether the POS must complete Day End before billing can continue the next day.",
    steps: [
      "Open System Administration > Branch Day End Settings.",
      "Find the branch in the list.",
      "Switch \"Day End Required\" on or off. The change is saved straight away and confirmed by a message.",
    ],
    tips: [
      "When it is on, the POS blocks billing on the next day until Day End is done for the previous day — this is what forces cashiers to close their till properly.",
      "Switching it off removes that control, so cash differences may go unnoticed. Turn it off only for a branch that genuinely does not need it.",
      "There is no Save button — each switch takes effect immediately.",
    ],
    related: ["Day End Report", "Clear Day End", "Daily Cash Summary"],
  },

  "Clear Day End": {
    summary: "Reverses a Day End that was submitted by mistake, so the POS can start billing again for that date.",
    steps: [
      "Open System Administration > Clear Day End.",
      "Choose the \"Branch\" and the \"Day End Date\".",
      "Click \"Check Status\". The screen says whether a Day End record exists for that branch and date.",
      "If one exists, click \"Clear Day End\".",
      "Read the warning and click \"Clear\" to confirm.",
      "Tell the cashier to log out of the POS and log in again — billing only resumes after that.",
    ],
    tips: [
      "This permanently deletes the Day End record for that date; the cash denomination entry has to be done again.",
      "Use it only for a genuine mistake, such as a Day End closed before the last bills were made.",
      "Always run \"Check Status\" first so you clear the right branch and date.",
    ],
    related: ["Day End Report", "Branch Day End Settings", "Excess Shortage Report"],
  },

  "Day End Report": {
    summary: "Shows what a branch closed with on a given day: the cash counted note by note, the bill count and sales total, and the split by receipt mode.",
    steps: [
      "Open System Administration > Day End Report.",
      "Choose the \"Branch\" and the \"Date\".",
      "Click \"View Report\".",
      "On the left, read the \"Cash Denomination\" table — the quantity of each note or coin counted and its value, with \"Cash Total\" at the bottom. Only denominations with a quantity are shown.",
      "On the right, read \"Sales Summary\": \"Total Bills\", \"Total Sales\", the \"Receipt Mode Breakdown\" and \"Total Receipts\".",
      "Print the page from your browser if you need a paper copy.",
    ],
    tips: [
      "Compare \"Cash Total\" with the Cash line in the receipt mode breakdown — a gap is a shortage or excess to investigate.",
      "\"Total Sales\" and \"Total Receipts\" should agree; if they do not, a bill may be part-paid or a receipt mode missing.",
      "If the report is empty, Day End has not been done for that branch and date.",
    ],
    related: ["Clear Day End", "Branch Day End Settings", "Excess Shortage Report", "Daily Cash Summary"],
  },

  "E-Invoicing": {
    summary:
      "The one place where the company connects to a tax authority, sends invoices to it, follows what happened to them, files periodic returns and makes Indian e-way bills. It has four tabs: \"Provider setup\", \"Submissions\", \"Tax returns\" and \"E-way bills\".",
    steps: [
      "Open System Administration > E-Invoicing.",
      "On \"Provider setup\", pick your provider from the list and click \"Set up\": India IRP e-invoice (IRP_NIC), India E-Way Bill (EWB_NIC), India GST returns (GSTN_RETURNS), Saudi ZATCA e-invoice (ZATCA_FATOORA), Saudi VAT return (ZATCA_VAT_RETURN), Malaysia MyInvois (MYINVOIS), UK HMRC MTD VAT (HMRC_MTD_VAT), or MOCK for testing.",
      "Choose \"Environment\" — \"Sandbox (testing)\" while you are trying it out, \"Production (live)\" only when you are ready. Set \"Processing\" to \"Immediately\" or \"In the background\", switch \"Enabled\" on, and fill in \"Tax registration number\" and \"Legal name\". Click \"Save setup\".",
      "Under \"Credentials\", click \"Set\" (or \"Replace\") beside each credential the provider needs and paste the value. Required ones are marked.",
      "If the provider has an onboarding step, enter the \"OTP\" from the tax authority portal and click \"Onboard\" — the server creates the key and certificate and runs the compliance checks. For HMRC, click \"Connect to HMRC\" instead and sign in with the business's own user ID; that access lasts 18 months.",
      "Click \"Test connection\" and read \"Ready to go live?\" and the checks below it before switching to Production.",
      "Go to the \"Submissions\" tab to follow invoices: filter by \"Status\", \"Invoice number\", \"From\" and \"To\" and click \"Search\". Click a row to open it.",
      "In a submission, use \"Check status\" to ask the authority again, \"Retry\" to send it once more after a failure, or \"Cancel submission\" and type the reason. The dialog also lists every status change and the documents returned, including the QR.",
      "On \"Tax returns\", pick the provider, choose \"Open\" or \"Filed, last 12 months\", then click \"Prepare return\" on a period. Check each box of the return, generate any supporting file, type the reference, tick the declaration and submit. \"Filing history\" and \"Liabilities and payments\" are below.",
      "On \"E-way bills\", set the invoice number or a date range and click \"Find sales\", click \"Select\" on the sale, fill in the transport details (mode, distance, vehicle number and type, transporter, document number and date) and generate the bill. Existing bills can be opened for \"Details\", \"Update vehicle\" or \"Cancel\".",
    ],
    fields: [
      { name: "Environment", desc: "Sandbox is the tax authority's test system — nothing you send there is a real filing. Production is live." },
      { name: "Processing", desc: "\"Immediately\" waits for the authority's answer before the invoice is issued (needed where clearance is required); \"In the background\" sends it afterwards." },
      { name: "Status (Submissions)", desc: "Where the invoice stands with the authority. \"Problem\" shows the reason if it failed." },
      { name: "Attempts", desc: "How many times the system has tried to send that invoice." },
    ],
    tips: [
      "Do all your testing in Sandbox. Once you switch to Production, everything you send is a real filing with the tax authority.",
      "A warning appears if the server has no address configured for the environment you chose — submissions will fail until your administrator adds it.",
      "Credentials are stored encrypted and are never shown back to you; you can only replace or remove them.",
      "Cancelling a submission always asks for a reason, because the authority records it.",
      "Some sales can only have an e-way bill if the customer's GSTIN and the transport details are complete — fill them in on the sale first.",
    ],
    related: ["Sales Report", "Sales Tax Summary", "HSN wise Sales", "Languages"],
  },

  Languages: {
    summary:
      "Optional second language for printed invoices and receipts — for example Arabic beside English. While it is switched off everything prints in English exactly as before.",
    steps: [
      "Open System Administration > Languages.",
      "On the \"Settings\" tab, choose the \"Level\" the setting applies to: \"Whole tenant\", \"Company\" or a single \"Branch\".",
      "Set \"Multi-language\" to On, type the \"Second language\" code (for example ar, hi, ml), and choose \"Printed invoices\": \"English only\", \"Second language and English\", or \"Second language only\".",
      "Optionally set \"Country rules\" (for example SA, which requires Arabic), \"Translations required\" and a \"Default screen language\".",
      "Click \"Save\". \"Remove this level\" deletes a setting so that level follows the one above it.",
      "On \"Item names\", set the \"Language\", search for items, tick \"Only missing\" to see untranslated ones, type each name in the second language and click the Save button.",
      "On \"Branch names\", pick the branch and language and type the name, building, street, district and city as they should print.",
    ],
    tips: [
      "Invoices print only the names you save here — the system never machine-translates. Items with no translation print in English.",
      "The chip on the \"Item names\" tab tells you how many items still have no name in that language.",
      "If a warning says multi-language is not installed for this tenant, the V074 database migration has to be run first (see DB Migrations).",
    ],
    related: ["E-Invoicing", "Invoice Designer", "DB Migrations"],
  },

  "Admin Page": {
    summary:
      "Handles messages between head office and the branch machines: approve or reject data requests raised by a branch, ask a branch to send its data, and see messages still waiting to reach a branch.",
    steps: [
      "Open System Administration > Admin Page.",
      "Under \"Fetch Data Request to branch\", choose the branch and click \"Send Fetch Command\" to ask that branch to send its pending data.",
      "Under \"Branch Requests Pending for approval\", read each request's branch code, message type and message.",
      "Click \"Approve\" to let it through, or \"Reject\" to refuse it.",
      "Click \"Refresh\" to reload the pending list.",
      "Under \"Pending Messages to Branch\", pick a branch and click \"Load Messages\" to see what is still queued for it.",
    ],
    tips: [
      "Approving a request lets branch data flow into head office, so check what the branch is asking for before you approve.",
      "A long list of pending messages for a branch usually means that branch has been offline — check its connection rather than approving repeatedly.",
    ],
    related: ["Event Monitor", "Documents List", "Reprocess Voucher"],
  },

  "Reprocess Voucher": {
    summary:
      "A support tool: paste the raw text of a voucher that failed to load and send it to the server again. Normally used with guidance from support.",
    steps: [
      "Open System Administration > Reprocess Voucher.",
      "Paste the voucher text into \"Raw JSON\".",
      "Click \"Send to Server\".",
      "The server's reply appears below in green if it worked, or red with the reason if it did not.",
    ],
    tips: [
      "Reprocessing a voucher can create stock and accounting entries, so do not send the same voucher twice unless support tells you to.",
      "In most cases Documents List is easier — it finds the file for a voucher number and reprocesses it for you.",
    ],
    related: ["Documents List", "Event Monitor"],
  },

  "POS Machine Approval": {
    summary:
      "New POS terminals have to be approved here before they can bill or sync. Approving one gives it a machine code; rejecting blocks it.",
    steps: [
      "Open System Administration > POS Machine Approval.",
      "Leave \"Show\" on \"Pending only\" to see machines waiting, or switch it to Approved, Rejected or All.",
      "Check the branch, machine name, device key and when it registered, so you know it is a machine you recognise.",
      "Click \"Approve\" to let it work — a machine code is assigned and shown in the confirmation message.",
      "Click \"Reject\" to block it. An already approved machine can be stopped later with \"Revoke\", and a rejected one can be approved afterwards.",
      "Click \"Refresh\" to reload, and click the \"Branch\" heading to sort.",
    ],
    tips: [
      "Only users with the admin or MACHINE_ADMIN role can approve or reject.",
      "Never approve a machine you cannot account for — approval lets that device bill and sync in that branch.",
      "\"Last Seen\" tells you whether an approved terminal is still in use.",
    ],
    related: ["Connected POS Terminals", "Download"],
  },

  "Connected POS Terminals": {
    summary: "Shows which POS terminals are connected right now, with their app version, and lets you force one to log out.",
    steps: [
      "Open System Administration > Connected POS Terminals.",
      "Read the list: branch, machine, app version and connected since.",
      "Click \"Refresh\" to reload.",
      "To force a terminal off, click \"Disconnect\" on its row and confirm in the \"Disconnect this terminal?\" box.",
    ],
    tips: [
      "The terminal is logged out and must sign in again — useful to make a stale session pick up a new app version on next launch.",
      "Do not disconnect a terminal in the middle of a sale; wait for a quiet moment.",
      "The \"Version\" column is the quickest way to spot shops still running an old release.",
    ],
    related: ["Download", "POS Machine Approval"],
  },

  "UPI Payment Setup": {
    summary: "Stores the PhonePe Business credentials used for UPI payments, separately for each branch.",
    steps: [
      "Open System Administration > UPI Payment Setup.",
      "Choose the \"Branch\".",
      "Fill in \"Merchant ID\", \"Salt Key\" and \"Salt Index\" from your PhonePe merchant account (the eye icon shows or hides the salt key).",
      "Set \"Environment\" to \"Sandbox (Testing)\" while testing and \"Production (Live)\" when you go live.",
      "Add the \"Callback URL\" if your server is reachable from the internet — it is the address PhonePe uses to confirm payments instantly.",
      "Click the save button (it reads \"Save for\" followed by the branch code).",
      "To set up a branch the same way as another, click \"Copy from branch\", pick the source branch and click \"Copy\".",
    ],
    tips: [
      "Each branch can have its own merchant account, so money reaches the right bank account.",
      "The salt key is a secret — do not share it or paste it into messages.",
      "Copying from another branch overwrites whatever is set for the branch you are on.",
      "Get the credentials by registering at developer.phonepe.com.",
    ],
    related: ["Receipt Modes", "Day End Report"],
  },

  "Documents List": {
    summary:
      "Finds the stored file behind a voucher number and lets you send it to the server again if it did not post properly. The screen is titled \"Search and Reprocess Documents\".",
    steps: [
      "Open System Administration > Documents List.",
      "Type the voucher number in \"Voucher\" and click \"Fetch Documents\" (or press Enter).",
      "The matching files are listed with voucher number, type and file name.",
      "Click the arrow at the left of a row to open it and read the file's contents.",
      "Click \"Reprocess\" to send that file to the server again. A tick and the file name confirm it worked; an error message explains if it did not.",
    ],
    tips: [
      "Use this when a bill exists at the shop but is missing from head-office reports.",
      "Reprocessing the same file more than once can duplicate stock and accounting entries — check the reports before you try again.",
    ],
    related: ["Reprocess Voucher", "Event Monitor", "Admin Page"],
  },

  "Event Monitor": {
    summary:
      "Shows the messages the system sends between head office and branches or franchises, whether each one got through, and lets you retry the ones that failed.",
    steps: [
      "Open System Administration > Event Monitor.",
      "Read the tiles at the top for the count in each status, the Kafka health chip, and \"Pending (live)\".",
      "Filter with \"Status\", \"Event Type\", \"Entity Type\" and the \"From\" and \"To\" date-and-time boxes; \"Clear\" resets them.",
      "Click the eye icon on a row to open \"Event Detail\" — the full message, the error if there was one, and the payload.",
      "Click the retry icon (or \"Retry\" in the detail box) to send a failed message again.",
      "Use the bin icon to move a stuck message to the dead-letter list.",
      "\"Replay\" re-queues events that were already published for a chosen type and time range — use it only when you have been asked to.",
    ],
    fields: [
      { name: "Status", desc: "PENDING and PUBLISHING are on their way; PUBLISHED got through; FAILED and RETRY_PENDING need attention." },
      { name: "Retries", desc: "How many attempts have been made out of the maximum allowed." },
    ],
    tips: [
      "A growing number of PENDING events usually means a branch or the messaging service is offline, not that data is lost.",
      "Replaying published events re-sends them; duplicates are normally skipped, but do not replay wide date ranges casually.",
    ],
    related: ["Master Sync", "Admin Page", "Documents List"],
  },

  "Master Sync": {
    summary: "Shows how much of head office's master data (items, prices, branches and so on) has reached each franchise, and lets you push a full sync.",
    steps: [
      "Open System Administration > Master Sync.",
      "Each franchise has a card showing Synced, Pending and Failed counts and a progress percentage.",
      "Click the arrow on a card to expand it and see the figures per entity type, with the last synced time.",
      "Click the sync button on a card to push a full sync to that franchise only.",
      "Click \"Full Sync All Franchises\" to push to every franchise at once.",
      "Use the refresh icon to reload the status — a queued sync takes a few seconds to show progress.",
    ],
    tips: [
      "A sync is queued, not instant; refresh after a few seconds rather than clicking again.",
      "Failed counts that do not clear after a re-sync usually point at a problem in Event Monitor.",
      "Franchises listed with \"No sync history\" have never been synced — run a full sync for them once.",
    ],
    related: ["Event Monitor", "Transfer Config", "Franchise Master"],
  },

  "Franchise Stock Transfer": {
    summary:
      "Sends stock from a central branch to a franchise branch and tracks it from draft through dispatch to receipt. The screen is titled \"Franchise Stock Transfers\".",
    steps: [
      "Open System Administration > Stock Transfer (Franchise Stock Transfer).",
      "Click \"New Transfer\", choose the \"Franchise\" and the \"Franchise Branch\", then add the items with their dispatch quantities and rates.",
      "Save it. The transfer starts as a draft.",
      "Open the transfer with the eye icon. From a draft you can \"Submit for Approval\", \"Dispatch\" straight away, or \"Cancel\".",
      "If approval is required, an approver clicks \"Approve\" or \"Reject\"; approved transfers are then dispatched with \"Dispatch\".",
      "When the goods arrive, open the dispatched transfer, click \"Confirm Receipt\", type the quantity actually received against each item and save.",
      "Use the \"Status\" and \"Franchise\" filters at the top to find transfers, and the refresh icon to reload.",
    ],
    fields: [
      { name: "Qty", desc: "Total quantity dispatched on the transfer." },
      { name: "Received", desc: "Total quantity the franchise confirmed. A gap between the two is a shortage to investigate." },
    ],
    tips: [
      "Dispatching moves stock out of the source branch; confirming receipt moves it into the franchise branch. Enter the true received quantity, not the dispatched one.",
      "Whether approval is needed, and what rate is used, comes from Transfer Config for that franchise.",
      "Cancel a transfer rather than deleting rows from it, so the history stays clear.",
    ],
    accounting: "Reduces stock at the dispatching branch and increases it at the receiving franchise branch at the transfer rate, which becomes that branch's cost for those items.",
    related: ["Transfer Config", "Stock Transfer Discount", "Master Sync", "Cost Price History"],
  },

  "Transfer Config": {
    summary: "Sets the rules for stock transfers to one franchise: whether they are allowed at all, whether approval is needed, the pricing rule and the limits.",
    steps: [
      "Open System Administration > Transfer Config.",
      "Choose the franchise in \"Select Franchise\".",
      "Switch on or off \"Allow Stock Transfer\", \"Requires Approval\", \"Credit Limit Check\" and \"Outstanding Check\".",
      "Under Pricing, choose the \"Transfer Price Rule\" — \"Cost Price\", \"MRP\" or \"Custom %\" (which then asks for a \"Custom Price %\") — and set \"Max Transfer Value (₹)\".",
      "Set the \"Approver User Code\" and, if you restrict them, the allowed source branches, target branches and item categories.",
      "Set \"Effective From\" and \"Effective To\" and add \"Notes\".",
      "Click \"Save Config\". \"Reload\" throws away unsaved edits.",
      "If branches are missing from the franchise's transfer screen, click \"Resync Master Branches to Franchise POS\".",
    ],
    tips: [
      "Turning off \"Allow Stock Transfer\" stops all new transfers to that franchise immediately.",
      "\"Requires Approval\" adds the Submit for Approval / Approve step to every transfer for that franchise.",
      "The credit limit and outstanding checks block transfers to a franchise that owes too much — useful, but tell the franchise before you switch them on.",
    ],
    related: ["Franchise Stock Transfer", "Franchise Master", "Stock Transfer Discount"],
  },

  "Franchise Migration": {
    summary:
      "One-time setup scripts run once after the franchise system is deployed: branch identities, login access, users, stock transfers, inventory and sales. Normally run by your system administrator.",
    steps: [
      "Open System Administration > Migration Utility.",
      "Read the warning at the top — these are one-time scripts, but they are safe to run more than once.",
      "Work through the steps in order, starting with Step 1 (Mint Global Branch IDs).",
      "Click the button on a step's card and wait; a tick or a cross shows the result, with counts and any errors listed underneath.",
      "Only move to the next step once the previous one shows a tick.",
      "The table at the bottom lists which script touches which tables.",
    ],
    tips: [
      "Order matters: Step 1 must run before the user, inventory and stock transfer steps; Step 5 must run before the stock transfer migration.",
      "Every script is written to be safe to repeat — rerunning skips what is already done.",
      "If a step reports errors, read them before rerunning; they usually name the branch or user that could not be processed.",
    ],
    related: ["DB Migrations", "Master Sync", "Franchise Master"],
  },

  "DB Migrations": {
    summary:
      "Applies pending database upgrades to a company's database, one company at a time or all at once. An administrator's tool.",
    steps: [
      "Open System Administration > DB Migrations.",
      "Under \"Single Tenant\", pick the company in \"Tenant\".",
      "Click \"Check Status\". The screen says how many migrations are pending and lists each version, description and state.",
      "Click \"Run Pending Migrations\" and confirm. The result says how many were applied.",
      "Only after a single company has worked, use \"Run All Tenants\" at the bottom and confirm — a table then shows the result per company.",
      "Use \"Reload tenant list\" if a newly created company is missing from the dropdown.",
    ],
    tips: [
      "This runs real changes against live company data. Always check status first and try one company before running all.",
      "Some features refuse to work until their migration is applied — for example cost stamping needs V042 and V043, and multi-language printing needs V074.",
      "Run migrations at a quiet time, not while shops are billing.",
    ],
    related: ["Cost Stamping", "Languages", "Franchise Migration"],
  },
};
export default content;
