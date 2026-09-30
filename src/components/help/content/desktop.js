// Help content: Windows desktop POS app (TradeLink247 POS). Keys are the desktop app's menu labels.
const content = {
  "Installing & first login": {
    summary: "How to install the TradeLink247 POS desktop app on a cashier PC, log in, pick the branch, get the machine approved and set up the receipt printer.",
    steps: [
      "In the web admin, open Tools & Design > Download and download the POS Launcher zip on the cashier PC (Windows, 64-bit). Extract it to a permanent folder such as C:\\TradeLink247\\ and run launchPOSClinet.exe; on the first run it downloads the POS and opens it. Always start the POS from the launcher (make a desktop shortcut to it) so updates install.",
      "Start the app. After a short splash screen the login screen appears. Pick your \"Language\" if needed, type your \"Username\" and \"Password\" and click \"Login\" (or press Enter).",
      "The branches you are allowed to use come from your user account. If you have more than one, choose the branch from the \"Branch:\" drop-down in the top-right of the screen. Changing branch reloads the item list for that branch.",
      "The first time a PC logs in to a branch, it registers itself with the server. If an administrator has not yet approved it you will see \"Machine Pending Approval\" with a Registration ID. Ask an admin to approve it in the web admin under POS Machine Approval. The screen checks again every 30 seconds and opens by itself once approved.",
      "If this PC is replacing an existing till, you can instead pick one of the listed machines under \"Or select an existing machine for this branch:\" and click \"Use Machine ...\". The app then takes over that machine's code and bill numbering.",
      "Once approved, the window title shows the app version and the machine code (for example \"TradeLink POS v3.1.7 — M01\"). The item list downloads automatically the first time; wait for \"Item cache loaded\".",
      "Set up the printer: on the POS screen, in the \"Printer\" box at the bottom of the left panel, choose your receipt printer (click the refresh arrow if it is missing). Then click \"Print Test Invoice\". The app tries to read the paper size from the printer and saves it if it finds one.",
      "Optional: click \"Print Settings\" in the top bar to choose the font and font size used for every print from this PC. Click \"Save & Test Print\" to check it.",
    ],
    fields: [
      { name: "Server", desc: "The app connects to the server its Launcher was downloaded from (the Launcher zip carries a server.json for it). A PC with no server shows \"Connect this POS to your company's server\": type the address, click \"Check server\", then \"Connect\". To move a PC, click \"Change server\" under the Login button. It is refused while bills or stock transfers are waiting to sync, and it signs you out and clears the PC's saved items and branch. If a server moves to a new address, the Launcher and the app follow it on their own." },
      { name: "pos-config.json", desc: "A settings file next to the .exe. \"printer\" holds paperWidthMm and paperHeightMm (default 72 x 3276 mm, a 72 mm roll). Only change it if your support team tells you to. An \"apiServer\" left in it by an older version is used once and then kept in the app's own settings." },
      { name: "Branch lock", desc: "The first normal (non-admin) user who logs in locks this installation to their user and branch. Anyone else is refused with \"This installation is locked to branch ...\". An admin can log in and click \"Unlock Branch\" in the top bar to clear it." },
      { name: "Top bar buttons", desc: "\"Sync Updates\" fetches price and item changes you missed. \"Refresh\" reloads the whole item list (it shows a dot when updates are waiting). \"Clear Cache\" wipes stored stock figures; press Refresh after it. \"Logout\" signs out." },
    ],
    tips: [
      "Printer choice, print font, held bills, KOT tables and reprint history are stored on each PC, not on the server. Set up every till separately.",
      "The app keeps a log file named pos.log in its data folder (usually %APPDATA%\\TradeLink247 POS\\logs). Support may ask you for it.",
      "If an admin rejects the machine you will see \"Machine Registration Rejected\". Contact your manager; logging in again will not help.",
      "Do not open the app twice on the same PC. The second window takes over the live connection and the first shows a red warning.",
    ],
    related: ["POS", "Updates", "Working offline"],
  },

  "POS": {
    summary: "The main billing screen. Scan or search items, collect payment in one or more modes, and save to print the receipt. It keeps working when the internet drops.",
    steps: [
      "Click \"POS\" in the top menu. The cursor starts in \"Item Search / Barcode\".",
      "Scan a barcode or type part of a name and press Enter (or F2). The \"Item Lookup\" window opens with matching items, their stock, MRP, tax and unit. Use the Up/Down arrows and press Enter, or double-click, to add the item. Out-of-stock items are hidden.",
      "The item is added with quantity 1 and the cursor jumps to its \"qty\" box. Type the quantity (decimals allowed for weighed items) and press Enter to go back to the search box. Scanning the same item again adds 1 to its line. Click the red ✕ to remove a line.",
      "For fast-moving items, use the shortcut buttons above the item table (Alt+1 to Alt+9, Alt+0). Click \"⚙ Shortcuts\" to choose up to 10 items.",
      "Optionally enter the \"Customer Mobile\" and the \"SalesMan Code\". Salesman codes you use are remembered on this PC and offered next time.",
      "Check the payment in \"Receipt Details\". The CASH row fills itself with the amount due. To take the whole bill by another mode, click that mode's row. To split a payment, type amounts in several rows; the \"Total Received\" must equal the amount due exactly.",
      "For cash, type the money handed over in \"Amount Tendered\". \"Balance to Pay\" shows the change to give back.",
      "Click \"Save\" (or press Alt+S, or Enter in \"Amount Tendered\"). The bill is sent to the server, stock is reduced, the receipt prints on the chosen printer, and the screen clears for the next customer.",
      "To pause a bill, click \"Hold\". Click \"Recall\" (the badge shows how many are held) to bring one back, or delete it with the bin icon.",
      "To print a copy of a recent bill, click \"⎙ Reprint\" in the blue title bar and click \"Print\" next to the bill. The last 10 bills on this PC are kept.",
    ],
    fields: [
      { name: "Items / QTY / Total", desc: "Number of lines, total quantity and gross bill value, shown at the top right." },
      { name: "stock", desc: "Stock this PC knows about for the item. You cannot bill more than this, except for items in the DYNAMIC category (made-to-order)." },
      { name: "Round Off", desc: "The bill is rounded to the nearest rupee. The difference is shown and saved with the bill." },
      { name: "Offers Applicable", desc: "Yellow panel listing schemes the current cart qualifies for. See \"Schemes at the till\"." },
      { name: "Green / grey dot", desc: "Next to \"POS Window\" in the title bar. Green means connected to the server and receiving live price changes; grey means not connected (billing still works)." },
      { name: "\"N pending\" tag", desc: "Bills saved while offline and not yet sent to the server. Click it to send them now." },
    ],
    tips: [
      "There is no manual discount box on the till. Discounts only come from schemes set up in the web admin.",
      "\"Save\" stays grey until the bill has items and the payment rows add up to the amount due. If \"Amount Tendered\" is filled in, it must not be less than the amount due.",
      "Payment modes come from the Receipt Modes list in the web admin and are remembered for offline use.",
      "Clicking the UPI row starts a QR payment for the full amount. See \"UPI payments\".",
      "If the internet or server is down when you save, the bill is saved on this PC and still prints. It is sent later. See \"Working offline\".",
      "If you see \"Session expired — please log in again.\" the bill was NOT saved. Log in again and save it.",
      "Recalling a held bill re-checks stock. Lines are cut back or removed if stock has since run out, with a warning.",
      "The \"Close\" button at the bottom logs you out.",
      "Every change to the cart (add, quantity change, remove, clear, hold, recall, save) is written to the log file with the tag [CART]. If a customer disputes a bill, support can see how it was built. On the till PC, run: findstr /L /C:\"[CART]\" pos.log in the logs folder.",
      "Once Day End is done for a branch that requires it, the POS shows \"Day End completed for today — Billing is not allowed\".",
    ],
    accounting: "Each saved bill is a POS sale on the server. Stock of each item is reduced for the branch. Payment lines are stored per mode; scheme discounts are stored as a DISCOUNT line and round-off as a ROUND_OFF line.",
    related: ["Keyboard shortcuts", "Schemes at the till", "UPI payments", "Working offline", "Day End", "Sales Return"],
  },

  "KOT": {
    summary: "Restaurant table service. Take orders per table, send Kitchen Order Tickets (KOT) to the kitchen, print a proforma bill and collect payment.",
    steps: [
      "Click \"KOT\". The table board shows each table and its state: VACANT (green), OPEN (orange), PRINTED (red, sent to kitchen) or BILLED (blue). Occupied tables show their running total.",
      "Click a table. Type the \"Captain / Sales Man\" name and press Enter.",
      "In \"Scan Barcode / Item\", scan a barcode and press Enter to add it, or press Enter on an empty box (or click \"Search\") to open Item Lookup. Change quantities in the \"Qty\" column.",
      "Click \"KOT\" to print the kitchen ticket. Lines are then marked as sent. New lines added later show a \"NEW\" tag; the next KOT asks whether to \"Print New Items Only\" or \"Print Entire KOT\".",
      "When the guest asks for the bill, click \"Print Bill\" to print a proforma bill. The table turns BILLED.",
      "Click \"Collect Payment\", choose the \"Payment Mode\", and for cash enter the \"Tendered Amount\" (the change is shown). Click \"Finalise & Print Receipt\". The sale is saved, stock is reduced, the receipt prints and the table becomes vacant.",
      "Use \"Split\" to move selected lines to another table, or \"Merge\" to pull another occupied table's order into this one.",
      "Click \"Close\" to leave the table. If nothing has been sent to the kitchen you are asked to \"Hold\" or \"Discard\" the order. Orders already sent to the kitchen are always kept.",
      "Use \"Add Table\" to create more tables (for example T13, VIP-1). Remove an empty table with the small × on its tile.",
      "For parcels, click \"Takeaway\", fill \"Order #\", name and mobile, click \"Add Item\" and then \"KOT\" to send it to the kitchen.",
    ],
    tips: [
      "Lines already sent to the kitchen cannot be deleted or have their quantity changed.",
      "Takeaway only prints a kitchen ticket. It does not create a sale; bill the order through POS.",
      "Collect Payment takes one payment mode per bill. Schemes and stock limits are not applied on KOT bills.",
      "Tables and open orders are stored on this PC only. Other tills do not see them.",
      "If the connection is down, the final bill is saved on this PC and sent later, like a POS bill.",
    ],
    accounting: "Only \"Finalise & Print Receipt\" creates a sale. It is saved exactly like a POS bill and reduces stock. KOTs and proforma bills have no effect on stock or accounts.",
    related: ["POS", "Working offline"],
  },

  "Stock Transfer": {
    summary: "Send stock from your branch to another branch with a delivery challan (DC). Needs an internet connection.",
    steps: [
      "Click \"Stock Transfer\". \"From Branch\" is your current branch.",
      "Choose the destination in \"To Branch Code\". Only branches you are allowed to transfer to are listed. Branch name, GST, state and delivery address fill in automatically; you can correct them.",
      "Pick the \"Reason Code\": NORMAL DC, EXPIRY AND DEFECT RETURN or DC MISTAKE. Pick \"Print Mode\": A4 or Thermal.",
      "If AI suggestions are turned on for your company, suggested items load automatically with an urgency tag. \"Max AI Items\" limits how many. Remove any you do not want.",
      "Scan or search items in \"Item Search / Barcode\" (Enter or F2 opens the lookup). Type the \"Qty\" and press Enter to return to the search box.",
      "Any transfer discount set up for the item fills \"Disc %\", \"Disc Amt\" and \"Rate\". You may lower \"Rate\" but not above MRP.",
      "Click \"Save DC\". The transfer is saved, stock is taken out of your branch and the DC prints.",
      "To park a half-made DC, click \"Hold\"; bring it back with \"Recall\". Recall re-checks stock and trims lines that are no longer available.",
    ],
    fields: [
      { name: "In Stock", desc: "Stock available at your branch. You cannot transfer more than this." },
    ],
    tips: [
      "Stock Transfer does not work offline. Without internet you get \"No network connection. Stock Transfer requires an active internet connection.\"",
      "Source and destination must be different branches.",
      "Transfers to a central branch of another company (franchise to central) are sent through a separate route but work the same way on screen.",
      "The receiving branch must accept the stock in \"Accept Stock\" before it shows in their stock.",
      "If the title bar shows \"N pending\" or \"N failed\", these are older transfers saved offline by an earlier version. Click them to send again.",
    ],
    accounting: "Stock of each item is reduced at the sending branch when the DC is saved. It is added to the receiving branch only when they accept it.",
    related: ["ST History", "Accept Stock", "Stock Transfer In"],
  },

  "ST History": {
    summary: "List the stock transfers (DCs) sent from your branch and reprint any of them.",
    steps: [
      "Click \"ST History\".",
      "Set the From and To dates and click \"Fetch\".",
      "The left panel lists each voucher: \"Voucher No\", date, from and to branch, \"Reason\", total qty and amount.",
      "Click a voucher to see its item lines on the right, with Total Qty and Total Amount.",
      "Choose \"A4\" or \"Thermal\" and click \"Reprint\" to print the selected DC again.",
    ],
    tips: [
      "Only transfers to branches you are allowed to send to are shown.",
      "Needs an internet connection.",
    ],
    related: ["Stock Transfer", "Stock Transfer In"],
  },

  "Daily Expense": {
    summary: "Record small shop expenses paid from the branch (tea, cleaning, transport and so on) and print a voucher.",
    steps: [
      "Click \"Daily Expense\".",
      "Check the \"Expense Date\" (today by default).",
      "Choose the \"Expense Head\". The list is set up by your admin for this branch.",
      "Enter the \"Amount\" and choose the \"Payment Mode\" (Cash, Card, UPI, Bank Transfer or Other).",
      "Optionally fill \"Paid To / Payee\", \"Bill / Reference No\" and \"Remarks\".",
      "Click \"Save and Print\" to save and print the expense voucher, or \"Save\" to save only (Enter in Amount also saves without printing).",
    ],
    tips: [
      "If the server cannot be reached, the expense is kept on this PC and the title shows \"(N pending sync)\". It is sent when the connection comes back while the Daily Expense screen is open, so open this screen once you are back online.",
      "To correct or remove an expense, use \"Expense Report\" (same day only, before Day End).",
    ],
    accounting: "Normally DR the expense head's ledger account, CR Cash in Hand for that branch (cash) or the Bank Account (other modes). Some heads set up for customer advances post differently. The posting uses the account mapped to the expense head in the web admin.",
    related: ["Expense Report", "Day End"],
  },

  "Expense Report": {
    summary: "Search, reprint, edit or delete the branch's shop expenses.",
    steps: [
      "Click \"Expense Report\". This month's expenses load automatically.",
      "Narrow the list with the date range, \"Expense Head\", \"Payment Mode\", \"Entered By\", \"Status\" (ACTIVE or VOIDED) or \"Voucher No\", then click \"Search\".",
      "The total of the listed amounts is shown at the bottom.",
      "Click \"Print\" on a row to reprint its voucher.",
      "For today's active expenses, click \"Edit\" to change the head, amount, mode, payee, reference or remarks and save, or \"Delete\" and confirm to remove it.",
    ],
    tips: [
      "\"Edit\" and \"Delete\" only appear for today's entries that are not voided.",
      "If Day End is already done for that date you will see \"Day end has already been done for this date — edit this expense from Web Admin instead.\"",
      "Needs an internet connection.",
    ],
    related: ["Daily Expense", "Day End"],
  },

  "Day End": {
    summary: "Close the day for the branch: count the cash drawer by note and coin, save it, and print the day end report with sales and returns by payment mode.",
    steps: [
      "Make sure all bills are finished and the PC is online.",
      "Click \"Day End\". Check the date (it is fixed to the pending date if you were blocked from billing).",
      "Under \"Cash Denomination\", type the \"Quantity\" of each note and coin (500 down to 1). \"Amount\" and \"Grand Total\" work themselves out.",
      "Click \"Save Day End\". The app first sends any offline bills. If any are still waiting you will see \"N pending — Day End blocked\"; click the tag to try again.",
      "Check the date, branch and total in \"Confirm Day End\" and click \"Yes, Save Day End\".",
      "The day end report prints automatically and the screen shows \"✓ Day End Completed\". Use \"Print\" to print it again later.",
    ],
    fields: [
      { name: "Grand Total", desc: "Your physical cash count. It must be more than 0 to save." },
      { name: "Printed report", desc: "Cash denomination table and Cash Total, plus the day's sales by payment mode, total bills and total sales, returns by mode with return bills and total returns, and the net amount." },
    ],
    tips: [
      "₹1 and ₹2 coins are capped at 200 each to catch typing mistakes.",
      "Day End can only be saved once per date per branch.",
      "If your branch is set to require Day End (web admin, Branch Day End Settings): after saving, POS and KOT are closed for the rest of the day; and next morning the app will not let you bill until yesterday's Day End is done. An admin can undo a Day End with Clear Day End in the web admin.",
      "The Salesman report is only available after Day End, because by then billing is closed and every offline bill has reached the server, so the per-salesman totals are final.",
    ],
    related: ["Salesman", "POS", "Working offline"],
  },

  "Accept Stock": {
    summary: "Receive stock that another branch has sent to you. Accepting adds it to your branch's stock.",
    steps: [
      "Click \"Accept Stock\", then \"Fetch\". Pending transfers for your branch load, 20 per page; use the page arrows to move through them.",
      "Click a transfer to see its lines: item, qty, MRP, tax, amount, barcode, batch, unit and expiry, with Total Qty and Total Amount.",
      "Use \"Filter transfers — branch, voucher, date\" and \"Filter lines — item, barcode, batch\" to find a docket or item quickly. You can type several words, for example the branch and the last digits of the voucher.",
      "Check the goods against the lines. Click \"Accept\" and confirm with \"Yes, Accept\".",
      "\"Accept All (N)\" accepts every transfer currently listed (only the filtered ones if a filter is typed), after a confirmation.",
    ],
    tips: [
      "Accepting cannot be undone. Check the physical goods first.",
      "Needs an internet connection.",
    ],
    accounting: "Adds the transferred quantities to your branch's stock.",
    related: ["Stock Transfer", "Stock Transfer In"],
  },

  "Sales Return": {
    summary: "Take back items from an earlier bill and refund the customer.",
    steps: [
      "Click \"Sales Return\".",
      "Scan or type the original bill number in \"Original Voucher No:\" and press Enter or click \"Fetch\".",
      "The bill's date, branch and payments are shown. Every item that can still be returned is listed with \"Orig Qty\", \"Returned\" (already returned before) and \"Can Return\".",
      "Adjust \"Return Qty\" for each line, or remove lines that are not being returned.",
      "Choose the \"Refund Mode\": CASH, CARD, UPI, BANK or CUSTOMER CREDIT. Check \"Total Refund\".",
      "Click \"Save Return\". The return voucher number is shown. Click \"New Search\" for the next one.",
    ],
    tips: [
      "You cannot return more than was sold, less anything already returned. If everything has been returned you will see \"All items in this invoice have already been returned\".",
      "Needs an internet connection.",
    ],
    accounting: "Creates a sales return voucher and adds the returned quantities back to stock. The refund is recorded against the chosen refund mode and appears as a return on the Day End report.",
    related: ["POS", "Day End"],
  },

  "Weigh Bridge": {
    summary: "Weigh vehicles using a weighbridge connected to a COM port, charge by wheel type and print a weighment receipt. Only shown to users with the WB role.",
    steps: [
      "Click \"Weigh Bridge\". Choose the \"COM Port\" and baud rate (usually 9600) and click \"Connect\". The live weight appears in the large display.",
      "Type the \"Vehicle Number\". The vehicle's earlier weighments load below and its last wheel type is filled in.",
      "Choose the \"Wheel Type\". The \"Amount (₹)\" fills from the rate for that type; you can change it.",
      "Optionally fill \"Material\" and the driver's \"Mobile Number\".",
      "For a second weighment, turn on \"Use Previous Weight\" or \"Use Tare Weight\" and click \"Use\" on the earlier record. The first weight is filled and the display shows the Net weight. For a round-trip entry, only the balance amount is charged.",
      "Click \"Save\". The receipt prints with gross, first and net weight and the amount.",
    ],
    tips: [
      "Save stays grey until there is a vehicle number, a wheel type and a weight above zero.",
      "If the internet is down, the record is kept on this PC. \"Sync Pending\" shows how many are waiting and sends them; they are also sent automatically when the connection returns.",
      "\"Simulate\" puts a random test weight on the display. Do not save simulated weights.",
      "Use \"Clear\" to empty the form and \"Refresh History\" to reload the vehicle's earlier weighments.",
    ],
    related: ["Working offline"],
  },

  "Physical Stock": {
    summary: "Enter counted stock so the system matches what is on the shelf. Only shown to users with the PHYSICAL_STOCK or PHYSICAL_STOCK_REDUCE role.",
    steps: [
      "Click \"Physical Stock\" and stay on the \"Entry\" tab.",
      "Scan or type an item and press Enter (or click \"Browse\") to pick it. Out-of-stock items are also listed here.",
      "Type the counted quantity in \"Physical Qty\". \"Curr Stock\" shows what the system holds now.",
      "Repeat for each item counted. \"Clear All\" empties the list.",
      "Click \"Save Physical Stock\". A voucher number is shown.",
      "To see past entries, open the \"History\" tab, choose dates and click \"Load\".",
    ],
    tips: [
      "The quantity you enter is the new stock on hand, not an amount to add. The system works out the difference and adjusts by that.",
      "Without the PHYSICAL_STOCK_REDUCE role you can only raise stock. Lines that would lower it are highlighted and the save is refused.",
      "Needs an internet connection.",
    ],
    accounting: "Adjusts the branch's stock of each item up or down to the counted quantity.",
    related: ["Current Stock", "Item Movement"],
  },

  "Salesman": {
    summary: "Bills and sales value per salesman for one day at this branch. Found under Reports; only available after Day End.",
    steps: [
      "Complete Day End for today first. Until then the menu item is greyed out with the hint \"Complete Day End first\".",
      "Open Reports > Salesman.",
      "Pick the date and click \"Load\".",
      "Each row shows the salesman, \"Total Bills\" and \"Total Amount\", with totals underneath.",
      "Click \"Print\" for a receipt-printer copy.",
    ],
    tips: [
      "It needs Day End because Day End closes billing and makes sure every offline bill has reached the server. Before that, the figures could still change.",
      "Salesman names come from the \"SalesMan Code\" typed on each POS bill or the Captain on KOT bills.",
    ],
    related: ["Day End", "Item Sales"],
  },

  "Item Sales": {
    summary: "Quantity of each item sold on a day at this branch, by salesman. Found under Reports.",
    steps: [
      "Open Reports > Item Sales.",
      "Pick the date and click \"Load\".",
      "To see one item only, pick it in the \"All items\" box (type to search).",
      "The table shows \"Salesman\", \"Item\" and \"Qty\", with Total Qty at the bottom.",
      "Click \"Print\" for a receipt-printer copy grouped by salesman.",
    ],
    related: ["Salesman", "Item Movement"],
  },

  "Item Movement": {
    summary: "Every stock movement in and out of one item at this branch over a period, with running balance. Found under Reports.",
    steps: [
      "Open Reports > Item Movement.",
      "Search and pick the item, choose the date range and click \"Load\".",
      "The \"Opening Balance\" is shown first. Each row shows date, \"Voucher #\", \"Particulars\", \"Batch\", \"Qty In\", \"Qty Out\" and running \"Balance\".",
      "The footer shows total in and out and the \"Closing Balance\".",
      "Click \"Print\" for a receipt-printer copy.",
    ],
    tips: [
      "Use this to explain why stock differs from what you expected: sales, returns, transfers in and out and physical stock entries all appear.",
    ],
    related: ["Current Stock", "Physical Stock"],
  },

  "Stock Transfer In": {
    summary: "Stock received by this branch from other branches over a period. Found under Reports.",
    steps: [
      "Open Reports > Stock Transfer In.",
      "Choose the date range and click \"Load\".",
      "Each row shows date, \"Voucher #\", \"From Branch\", item, qty, rate and amount, with totals at the bottom.",
      "Click \"Print\" for a receipt-printer copy.",
    ],
    related: ["Accept Stock", "ST History"],
  },

  "Current Stock": {
    summary: "Live list of every item this branch has in stock, with a PDF download. Found under Reports.",
    steps: [
      "Open Reports > Current Stock.",
      "Click \"Refresh Stock\". Any offline bills or transfers are sent first, then the latest stock is downloaded. \"Stock as of ...\" shows when.",
      "Type in \"Filter by item / barcode / category\" to narrow the list.",
      "Click \"Download PDF\" and choose where to save the file.",
    ],
    tips: [
      "Only items with stock above zero are listed.",
      "If bills or transfers are still waiting to be sent, the refresh is refused so the report is never wrong. Get back online and try again.",
      "Refresh Stock reloads the whole item list on this PC, the same as the top-bar \"Refresh\" button.",
    ],
    related: ["Item Movement", "Physical Stock", "Working offline"],
  },

  "Working offline": {
    summary: "What the desktop POS can do without internet, what it saves for later, and what needs a connection.",
    steps: [
      "Billing keeps working offline. Items, prices, stock figures, payment modes and the receipt header are all kept on the PC.",
      "If you save a POS or KOT bill with no connection (or the server has an error), you see \"No network — sale saved offline, will sync automatically when connected\". The receipt still prints and the stock on this PC is reduced.",
      "The POS title bar then shows an orange \"N pending\" tag. Click it at any time to send the bills now.",
      "Otherwise the app checks every 10 seconds and sends waiting bills once it is online and the POS screen has been idle (no typing or clicks) for about 2 minutes, so it never slows down a busy counter.",
      "Before Day End, all waiting bills must be sent. Day End shows \"N pending — Day End blocked\" until they are.",
      "When the connection comes back, the app checks for price and item changes you missed. If a full reload is needed you see \"Item updates are pending — click Refresh to apply them\" and the \"Refresh\" button shows a dot. You can also click \"Sync Updates\" at any time.",
    ],
    fields: [
      { name: "Saved for later", desc: "POS bills and KOT final bills, Daily Expense entries (sent when the connection returns while that screen is open), and Weigh Bridge records (\"Sync Pending\")." },
      { name: "Works offline", desc: "POS billing, Hold/Recall, Reprint, KOT table orders and KOT printing." },
      { name: "Needs internet", desc: "Login, Stock Transfer, ST History, Accept Stock, Sales Return, Day End, Expense Report, Physical Stock, all Reports, UPI payments and Current Stock refresh." },
    ],
    tips: [
      "Log in while online at the start of the day. Schemes are only downloaded when you are online, so a PC that starts offline will not apply promotions until it connects.",
      "If you see \"Session expired — please log in again.\" log in again; waiting bills are sent with the new login.",
      "If the server refuses a waiting bill, it is taken out of the pending count and kept on the PC. Report it to support with the pos.log file.",
      "Do not use \"Clear Cache\" while bills are pending. It wipes stored stock figures; press Refresh afterwards to reload them.",
      "Stock shown on each PC is that PC's own copy, reduced after each of its own sales. Other tills' sales arrive when you Refresh.",
    ],
    related: ["POS", "Day End", "Installing & first login"],
  },

  "Keyboard shortcuts": {
    summary: "All the keyboard shortcuts in the desktop POS.",
    steps: [
      "POS, anywhere: Alt+1 to Alt+9 add shortcut items 1 to 9; Alt+0 adds item 10. Alt+S saves the bill (only when Save is enabled).",
      "POS, Item Search / Barcode box: Enter opens Item Lookup with what you typed (or the scanned barcode); F2 opens Item Lookup; Tab jumps straight to the Save button.",
      "POS, qty box on a line: Up and Down arrows move to the line above or below; Enter returns to the item search box.",
      "POS, Receipt Details amount box: Enter puts the whole amount due on that payment mode; Up and Down arrows move between payment modes.",
      "POS, Amount Tendered box: Enter saves the bill.",
      "Item Lookup window (POS, Stock Transfer, KOT, Physical Stock): type to search; Up and Down arrows move; Enter adds the highlighted item; Esc closes. Double-click also adds.",
      "Stock Transfer: Enter or F2 in the search box opens Item Lookup; Enter in a Qty box returns to the search box.",
      "Physical Stock: Enter or F2 in the search box opens the item list.",
      "KOT: Enter in \"Captain / Sales Man\" moves to the barcode box; Enter in the barcode box adds the scanned item, or opens search if the box is empty or nothing matches.",
      "Sales Return: Enter in \"Original Voucher No:\" fetches the bill. Daily Expense: Enter in Amount saves without printing. Login: Enter logs in.",
    ],
    tips: [
      "Set up the Alt shortcut items with \"⚙ Shortcuts\" on the POS screen (\"Manage Shortcut Keys\"). Use the up and down arrows there to reorder; numbers only change when you move items. They are saved on this PC.",
      "The window's \"Navigate\" menu jumps to POS, Day End, Stock Transfer, Daily Expense, Expense Report, Accept Stock or Weigh Bridge. Admin users also get Tools > Developer Tools (F11) for support.",
    ],
    related: ["POS"],
  },

  "Schemes at the till": {
    summary: "How promotions set up in the web admin apply automatically on the POS.",
    steps: [
      "Schemes are created and published to branches in the web admin (Scheme > Scheme Creation and Manage Scheme). The till downloads the schemes for its branch when you log in or change branch.",
      "As you add items, the till checks every scheme. Those the cart qualifies for appear in the yellow \"Offers Applicable\" panel with the scheme name.",
      "A scheme can qualify on: total amount of a category, total quantity of a category, quantity of one item, amount of one item, or the whole bill amount.",
      "Free Qty offers: when you click Save, the free item is added to the bill at zero price and you see \"Scheme applied — ... (FREE)\". It prints on the receipt.",
      "Itemwise Discount schemes: a percentage off named items, within the scheme's start and end dates. The discount shows straight away as Gross Amount, Itemwise Discount and Net Payable, and the payment due is reduced.",
      "Cash Back offers: shown as a message when you save. The till does not pay it out; handle it as your shop instructs.",
    ],
    tips: [
      "Offers of type Item Discount Percent are listed in \"Offers Applicable\" but the till does not change the price for them.",
      "If a scheme name contains \"-MULTI\", the offer repeats for each multiple reached (for example buy 6 get 2 when the scheme is buy 3 get 1).",
      "Items and categories are matched by name, so they must match the item master exactly.",
      "The free item must be in this PC's item list or it is skipped. Press Refresh if it was added recently.",
      "Schemes are not applied on KOT bills.",
    ],
    accounting: "Free items are billed at zero value but still reduce stock. Itemwise discounts are saved with the bill as a DISCOUNT payment line (a negative amount).",
    related: ["POS"],
  },

  "UPI payments": {
    summary: "Take payment by UPI QR code straight from the till, with the QR shown on a customer-facing screen.",
    steps: [
      "Add the items to the bill as usual.",
      "In \"Receipt Details\", click the UPI row (it is highlighted blue). The full amount due is requested.",
      "The \"UPI Payment\" window opens with the amount, a QR code and a countdown (\"Expires in 05:00\"). The same QR opens full-screen on the second monitor if one is connected.",
      "The customer scans with any UPI app. The till checks every few seconds.",
      "On success you see \"Payment Received!\" and the bill saves and prints by itself.",
      "If the payment fails, or the QR expires after 5 minutes, click \"Close\" and try again. Click \"Cancel Payment\" to stop; payment amounts are cleared so you can choose another mode.",
    ],
    tips: [
      "UPI must be set up by an admin in the web admin (UPI Payment Setup) and UPI must be one of the branch's receipt modes.",
      "Needs an internet connection.",
      "The bill number is only given when the sale is saved, so a cancelled UPI attempt does not use up a bill number.",
      "UPI takes the whole bill. For part UPI, part cash, type the amounts in the payment rows by hand instead of clicking the UPI row.",
    ],
    related: ["POS"],
  },

  "Updates": {
    summary: "How the desktop POS is kept up to date.",
    steps: [
      "The app itself does not download updates. Updates are installed by the TradeLink247 POS Launcher when it starts the app.",
      "After you log in, the app asks the server whether a newer version exists. If so, a yellow banner says \"Version ... is available. Close and reopen the TradeLink247 POS Launcher to install the update.\"",
      "At a quiet time, close the POS completely and start it again from the Launcher. Click \"Dismiss\" to hide the banner for now.",
      "The current version is shown in the window title, for example \"TradeLink POS v3.1.7\".",
    ],
    tips: [
      "If an admin disconnects this till from the web admin (Connected POS Terminals), the app shows a message and closes after a few seconds, so the next start picks up any update. Log in again when it reopens.",
      "Make sure there are no \"pending\" offline bills before closing for an update. They are kept on the PC, but sending them first is safest.",
    ],
    related: ["Installing & first login"],
  },
};
export default content;
