// Help content: General (Dashboard & Intelligence, Setup & Administration, Scheme,
// Tools & Design, Franchise, Support & Legal).
// Keys must match menuKey in src/menuCatalog.js.

const content = {
  "Dashboard": {
    summary:
      "The home screen. It greets you, shows today's date and gives a quick picture of today's business, including sales branch by branch.",
    steps: [
      "Open Dashboard from the top of the menu.",
      "Read the header: the greeting and today's date confirm which trading day the figures belong to.",
      "Look at the branch-wise sales bar chart. Each bar is one branch code, and the height is that branch's sales so far today.",
      "Check the top users card beside the chart for the busiest cashiers or users.",
      "Leave the screen open if you want it to keep itself up to date; it listens for live updates from the branches and refreshes on its own.",
    ],
    tips: [
      "The chart only shows branches that have billed today, so an empty chart usually means no branch has sold anything yet, not that something is broken.",
      "You only see branches that have been assigned to you under Branch Assignment.",
      "The dashboard is a summary only. For figures you can rely on for accounts, use the sales and stock reports.",
    ],
    related: ["Insights", "AI Stock Intelligence", "My Reports"],
  },

  "AI Stock Intelligence": {
    summary:
      "Forecasts how much of each item each branch will sell over the next 7, 14 or 30 days, and suggests stock transfers from branches with surplus to branches likely to run out.",
    steps: [
      "Open AI Stock Intelligence.",
      "Check the \"Model Status\" card. It shows when the forecast was last trained. If it says \"Not yet trained\", click \"Retrain Model\" and come back later.",
      "Choose the period with the \"7d\", \"14d\" or \"30d\" buttons at the top right. Everything on the screen follows that choice.",
      "Read the \"Top 15 Items\" bar chart for the items with the largest expected demand, in units.",
      "Work down the \"Transfer Recommendations\" table. Each row says which item to move, from which branch, to which branch, and how much.",
      "Click the green tick on a row to approve it, check the details in the \"Confirm Stock Transfer\" box and click \"Approve\". Click the cross to dismiss a row you do not want.",
      "Click \"Export Excel\" to save the recommendation list, or \"Refresh all data\" (the circular arrow) to reload.",
    ],
    fields: [
      { name: "Urgency", desc: "How pressing the transfer is: critical, high or medium. Critical rows are marked with a red edge." },
      { name: "Current Stock", desc: "What the receiving branch has on hand now." },
      { name: "Forecast", desc: "Units the receiving branch is expected to sell over the period you chose." },
      { name: "Donor Surplus", desc: "Spare units the sending branch can give up without running short itself." },
      { name: "Confidence", desc: "How much weight to put on the suggestion. Treat a low-confidence row as a hint, not an instruction." },
    ],
    tips: [
      "Approving a recommendation only marks it as handled here. It does not move any stock and does not touch the accounts. You must still raise the actual stock transfer in the Cashier POS app.",
      "Dismissed rows are hidden for you only. Click \"Reset\" to bring them back.",
      "Forecasts are only as good as the sales history behind them. A newly opened branch or a new item will forecast badly for a few weeks.",
    ],
    accounting:
      "Nothing on this screen posts to stock or to the books. The stock and GL effect happens later, when the transfer is actually made in POS.",
    related: ["Insights", "Dashboard"],
  },

  "AI Report Assistant": {
    summary:
      "Ask for a report in plain English and get a table back. Useful when you know what you want to see but not which report screen holds it.",
    steps: [
      "Open AI Report Assistant.",
      "Type your question in the box at the bottom, for example \"Show today's sales branch-wise\", and press the send arrow. Or click one of the suggested questions on the empty screen.",
      "If you want a particular period, fill \"From\" and \"To\" in the \"Optional date range override\" bar before asking. Click \"Clear\" to drop the dates again.",
      "Read the answer. Each result shows the report name, how many rows it found, and the table itself. Click a column heading to sort, and use the paging controls under long tables.",
      "Click the download icon beside a result to save it as an Excel file.",
      "If an answer marked \"AI Generated\" is correct, click the thumbs-up. The assistant remembers it and answers similar questions the same way next time.",
      "Click the refresh icon in the header to clear the chat and start a fresh conversation.",
    ],
    tips: [
      "Ask one thing at a time and name the period, the branch or the item if it matters. Vague questions give vague tables.",
      "Results marked \"AI Generated\" were worked out on the spot rather than taken from a built report. Check the figures against a standard report before you act on money.",
      "You can dictate the question with the microphone button if your browser supports it.",
      "The assistant only reads data. It never changes stock, prices or accounts.",
    ],
    related: ["My Reports", "Insights"],
  },

  "My Tasks": {
    summary:
      "Your to-do list from the system. Tasks are raised by published workflows and by the nightly checks, for example \"a report you asked for is ready\" or \"this item has no cost\".",
    steps: [
      "Open My Tasks.",
      "Use the \"Open\" / \"Completed\" / \"All\" buttons to choose which tasks to show. Administrators also get \"Mine\" and \"Everyone\".",
      "Read the row: \"Process\" is the workflow, \"Step\" is what is being asked of you, \"Business Key\" is the document or item it concerns, and \"Due\" is when it is expected.",
      "Click \"Open\" to jump straight to the screen where the work is done, with the item or branch already selected where the screen supports it.",
      "Do the work on that screen, come back, and click \"Complete\" on the task, then \"Complete\" again in the box that appears.",
      "Administrators can click \"Assign\" to hand a task to a named user.",
      "Click the refresh icon to reload the list.",
    ],
    fields: [
      { name: "Assigned To", desc: "Only visible to administrators in the \"Everyone\" view. \"Unassigned\" means nobody has picked the task up yet." },
      { name: "Variables", desc: "The box on the Complete screen. Leave it as {} unless someone has told you exactly what to type; it is for workflow settings, not for your answer." },
    ],
    tips: [
      "Completing a task only closes the reminder. It does not do the work, so finish the job on the real screen first.",
      "Some tasks have no \"Open\" button. That means the system could not work out which screen to send you to; read the step text and go there yourself.",
      "A task with no assignee is the one most likely to be forgotten. Administrators should assign it to a person.",
    ],
    related: ["Workflow Instances", "Workflow Designer", "My Reports", "Insights"],
  },

  "My Reports": {
    summary:
      "Every report you asked to run in the background, with its progress and a Download button. Long reports are produced here as Excel files instead of on screen.",
    steps: [
      "On any report screen with a \"Run in background\" button, set your filters and click it. A message confirms the request and offers a link to \"Open My Reports\".",
      "Open My Reports from the menu (or follow that link, or the \"report ready\" task in My Tasks).",
      "Watch the \"Status\" column: QUEUED means waiting, RUNNING means being built, READY means finished and FAILED means it could not be produced.",
      "When a row shows READY, click \"Download\" to save the Excel file.",
      "Click \"Refresh\" if you want an immediate update; the list also refreshes itself while anything is still running.",
    ],
    fields: [
      { name: "Requested", desc: "When you asked for the report, shown as day-month-year and time." },
      { name: "Report", desc: "The report's name and the period you asked for." },
      { name: "Rows", desc: "How many lines the finished file holds. A blank or zero here usually means your filters matched nothing." },
    ],
    tips: [
      "Files are kept for 7 days. After that the row shows \"Expired, request again\" and you simply request the report a second time.",
      "You may have at most 3 reports queued or running at once. Wait for one to finish before asking for another.",
      "A report is given 15 minutes to run. If it cannot finish in that time it comes back FAILED, so narrow the date range or the branch and try again.",
      "Periods longer than 7 days cannot be shown on screen at all on most report screens; use \"Run in background\" for those.",
      "A FAILED row shows the reason in red under the status. Quote that wording if you need help.",
    ],
    related: ["My Tasks", "AI Report Assistant"],
  },

  "Product 360": {
    summary:
      "Everything known about one product on a single picture: where it is stocked, how it sells, what it costs and any warnings raised against it.",
    steps: [
      "Open Product 360. Type part of a product code or name in \"Search for a product\" and pick it from the list.",
      "Set \"From\" and \"To\" to the period you want to look at. The map and the figures follow those dates.",
      "Read the summary tiles at the top: each shows a figure for the period with an arrow comparing it against the earlier period.",
      "Look at the map. The product sits in the middle and branches, costs, sales and any alerts sit around it. Colour marks severity.",
      "Click any bubble to open the panel on the right, which shows that item's figures and, where one exists, a link to the full report behind them.",
      "Use the \"All branches\" table underneath to see every branch, not just the notable ones shown on the map.",
      "Click the refresh icon to reload, or \"Reset layout\" to put the map back the way it started after you have dragged bubbles around.",
    ],
    tips: [
      "The screen is read-only. You cannot change anything from here, only look and then jump to the screen that can.",
      "\"Data through\" at the top tells you how fresh the figures are. If it is several days old, treat what you see as out of date.",
      "When cost shows as \"NOT_FOUND\", profit is genuinely unknown and is left blank. Do not read it as zero profit; set the item's cost first.",
      "Warnings shown in orange or red at the top explain why a figure may be incomplete. Read them before quoting any number.",
    ],
    related: ["Insights", "AI Stock Intelligence"],
  },

  "Insights": {
    summary:
      "What the nightly check found across the branches you can see: falling margins, falling sales, stock at risk, odd discounts or expenses, missing costs and bad data.",
    steps: [
      "Open Insights. The line under the title says how many branches are covered.",
      "Filter with \"Status\" (Open, Dismissed, Resolved or Any), \"Type\" and \"Severity\".",
      "Read the table. \"Summary\" says what was found, \"At stake\" says how much money (or how many rows, for data-quality findings) it concerns, and \"Data through\" says how fresh the figures behind it are.",
      "Click \"Rows\" on a finding to see the individual documents behind it. Where the list offers a \"Fix\" or \"Open\" button, it takes you to the screen where you can correct that document.",
      "If a finding is not worth acting on, click \"Dismiss\", type why, and confirm. A reason is required.",
      "Come back and change \"Status\" to \"Dismissed\" if you need to see what was set aside and who set it aside.",
    ],
    fields: [
      { name: "Severity", desc: "Critical, Warning or Info. Critical means money or data is materially wrong." },
      { name: "At stake", desc: "The amount involved. For a data-quality finding it is a count of bad rows, not money." },
      { name: "fallback", desc: "A small tag meaning the wording was written without the AI service. The figures are unaffected, only the phrasing is plainer." },
    ],
    tips: [
      "If a finding is simply wrong, say so in the dismissal reason. That is how the rule gets corrected rather than quietly ignored.",
      "Findings group on purpose: 96 bad purchases are one line here. Use \"Rows\" before deciding how much work is involved.",
      "A finding that has been fixed closes on the next nightly run, so it can still show as Open on the day you fix it.",
      "\"Nothing found\" can also mean the nightly sweep has not run yet.",
    ],
    related: ["Product 360", "My Tasks", "AI Stock Intelligence"],
  },

  "Menu Master": {
    summary:
      "Step 1 of setup. The list of menu names the system knows about, which roles are later given access to. Each menu is either a web menu or a Cashier POS (client) menu.",
    steps: [
      "Open Setup & Administration > 1. Create Menus.",
      "Type the name in \"Menu Name\". Spell it exactly as it should appear.",
      "Choose \"Type\": \"WEB\" for this web application, \"CLIENT\" for the Cashier POS desktop application.",
      "Click \"Add Menu\" (the button under the form). The new menu appears in the table below.",
      "Use the pencil icon on a row to rename it or change its type, then click \"Update\".",
      "Use the red bin icon to delete a menu, and confirm when asked.",
    ],
    tips: [
      "Adding a menu here does not give anyone access. Do that in step 3, Assign Menus to Roles.",
      "Deleting a menu removes it from every role that had it, so people lose that screen immediately.",
      "Keep the names identical to the screen names people actually see, or the access list becomes impossible to read.",
    ],
    related: ["Role Management", "Role Menu Access"],
  },

  "Role Management": {
    summary:
      "Step 2 of setup. Create and delete the job roles used across the system, such as cashier or supervisor.",
    steps: [
      "Open Setup & Administration > 2. Create Roles.",
      "Type the new role in \"Role Name\", for example \"supervisor\", and click the create button.",
      "Check the new role appears in the table below with its Role ID.",
      "To remove a role, click the bin icon on its row and confirm in the \"Delete Role\" box.",
    ],
    tips: [
      "Built-in roles such as admin, user, manager and system-admin are marked \"system\" and must not be removed; the bin is blocked for them.",
      "Deleting a role also removes it from every menu assignment, so anyone still on that role loses access.",
      "Roles are shared across the whole company, not per branch. Which branches a person sees is set in step 6.",
      "Use short, obvious names. The role name is what appears on the user screens.",
    ],
    related: ["Menu Master", "Role Menu Access", "User Creation"],
  },

  "Role Menu Access": {
    summary:
      "Step 3 of setup. Decides which screens each role can open, for both this web application and the Cashier POS.",
    steps: [
      "Open Setup & Administration > 3. Assign Menus to Roles.",
      "Pick the role in \"Select Role\".",
      "The menus appear in two groups, \"WEB MENUS\" and \"CLIENT MENUS\".",
      "Tick a menu to give the role access, untick it to take access away. Each tick saves on its own; there is no separate save button.",
      "Repeat for every role, then log in as a test user to confirm the menu appears.",
    ],
    tips: [
      "If the list is empty, add the menus first in Menu Master.",
      "Changes take effect the next time the person signs in, so ask them to log out and back in.",
      "Be careful with administration menus. Anyone with the role gets them, in every branch they can see.",
    ],
    related: ["Menu Master", "Role Management"],
  },

  "Branch Creation": {
    summary:
      "Step 4 of setup. Adds a shop, godown, back office or production unit. The branch code and invoice prefix set here are used on every voucher that branch raises.",
    steps: [
      "Open Setup & Administration > 4. Create Branches.",
      "Fill in \"Branch Code\" (letters and numbers only, no spaces) and \"Branch Name\".",
      "Enter \"GST Number\" and \"Invoice Prefix\", for example INV, POS or BIL.",
      "Choose \"Branch Type\": Bakery Outlet, Bakery Back Office, Bakery Central Godown, Bakery Production or Weigh Bridge.",
      "Fill in the address: \"Building / Premises\", \"Street\", \"Address Line 1\", optional \"Address Line 2\" and \"State\".",
      "Click \"Create Branch\". A green message confirms it and the form clears, ready for the next branch.",
    ],
    fields: [
      { name: "Branch Code", desc: "The short code used everywhere else in the system and on bill numbers. Letters and numbers only; spaces and symbols are rejected." },
      { name: "Invoice Prefix", desc: "Goes in front of the bill number at this branch. Give each branch its own prefix so bill numbers never clash." },
      { name: "Branch Type", desc: "Decides how the branch behaves, for example a central godown supplies other branches while an outlet sells to customers." },
    ],
    tips: [
      "Choose the branch code carefully. It appears on printed bills and in every report, and changing it later is painful.",
      "The GST number is printed on tax invoices, so check it digit by digit.",
      "Creating the branch is not enough on its own: assign it to users in step 6 before anyone can work in it.",
    ],
    related: ["User Creation", "Branch Assignment", "Transfer Branch Permissions"],
  },

  "User Creation": {
    summary:
      "Step 5 of setup. Creates the people who sign in, sets their password and first role, and lets you reset passwords or change roles later.",
    steps: [
      "Open Setup & Administration > 5. Create Users.",
      "Fill in \"Username\", \"User ID\" and \"Password\".",
      "Choose the branch under \"Branch Name\" and the role under \"Role\".",
      "Click \"Create User\". A message confirms it and the person appears in the \"Users\" table below.",
      "To give someone extra roles later, click the edit icon on their row, tick the roles in \"Edit Roles\" and save.",
      "To reset a forgotten password, click the orange key icon, type the new password twice and save.",
      "To remove a person, click the bin icon on their row and confirm.",
    ],
    tips: [
      "The password must be at least 4 characters and the two entries must match; the screen refuses otherwise.",
      "A user only gets the roles you tick, and only sees the branches assigned in step 6.",
      "Do not share one login between cashiers. Every bill, day end and correction is recorded against the user who did it.",
      "Deleting a user does not delete their past vouchers.",
    ],
    related: ["Role Management", "Branch Creation", "Branch Assignment"],
  },

  "Branch Assignment": {
    summary:
      "Step 6 of setup. Decides which branches a person can see and work in. Without this, a user can sign in but has no branch data.",
    steps: [
      "Open Setup & Administration > 6. Assign Branches & Roles.",
      "Choose the person in \"Select User\". Their current branches load automatically.",
      "Open \"Branches\" and tick every branch they should have. Chosen branches show as small tags in the box.",
      "Click \"Save\". A green \"Branch assignments updated.\" message confirms it.",
      "Click \"Reset\" if you change your mind before saving; it puts the list back as it was.",
    ],
    tips: [
      "\"Save\" only becomes available once you have actually changed something.",
      "Taking a branch away hides that branch's sales, stock and reports from the person straight away.",
      "Give people the fewest branches they need. Every report they run covers every branch they hold.",
    ],
    related: ["User Creation", "Branch Creation", "Transfer Branch Permissions"],
  },

  "Transfer Branch Permissions": {
    summary:
      "Step 7 of setup. Decides which branches a person is allowed to send stock to. It controls the destination list they see when raising a stock transfer.",
    steps: [
      "Open Setup & Administration > 7. Transfer Branch Permissions.",
      "Choose the person in \"Select User\".",
      "Open \"Transfer Destination Branches\" and tick the branches they may transfer stock to. Branches tagged \"HQ\" belong to the head-office company.",
      "Click \"Save\". A green \"Transfer branches updated successfully.\" message confirms it.",
      "Use \"Reset\" to undo unsaved changes.",
    ],
    tips: [
      "This is separate from step 6. Being able to see a branch does not mean being allowed to send stock to it.",
      "If a cashier complains a destination branch is missing when making a transfer, this is the screen to check.",
      "Adding a destination here does not move any stock or post anything to the books; it only opens the option.",
    ],
    related: ["Branch Assignment", "Branch Creation"],
  },

  "Scheme Creation": {
    summary:
      "Builds a customer offer: buy so much of a category or item, or spend so much on a bill, and get free quantity, a discount percentage or cash back. Also used for plain item-wise discounts.",
    steps: [
      "Open Scheme > Scheme Creation.",
      "Enter \"Scheme Name\" and set \"Start Date\" and \"End Date\".",
      "Choose \"Scheme Type\": Category wise total amount, Category wise total qty, Item wise total amount, Item wise total qty, Total Invoice Amount, or Itemwise Discount.",
      "Fill in the condition the type asks for, for example \"Category Name\" plus \"Required Category Qty\", or \"Eligibility Amount\" for a whole bill.",
      "For Itemwise Discount, add each item and its \"Discount %\" in the small table, using \"Add Item\" for more lines.",
      "For every other type, choose \"Offer Type\": \"Free Qty\" (then pick the offer item and \"Offer Qty\"), \"Item Discount Percent\" (then pick the item and the percent), or \"Cash Back\" (then the \"Cash Back Amount\").",
      "Click \"Create Scheme\". It appears in the \"Existing Schemes\" table at the bottom, where the bin icon deletes it.",
    ],
    tips: [
      "Creating a scheme does nothing for customers on its own. It must be published to each branch under Manage Scheme.",
      "An Itemwise Discount scheme needs at least one item with a percentage above zero, or it will not save.",
      "Check the dates. A scheme with a past end date is created happily but never applies.",
      "Give schemes clear names such as \"Diwali 10pc Bakery\"; the name is what you pick from when publishing.",
    ],
    accounting:
      "Nothing is posted here. The effect reaches stock and the books later, when a bill applies the offer: free quantity issues stock without revenue, a discount reduces the sale value and cash back reduces the amount collected.",
    related: ["Manage Scheme"],
  },

  "Manage Scheme": {
    summary:
      "Publishes a scheme to a branch so its tills start applying it, and shows which branches each scheme is already running in.",
    steps: [
      "Open Scheme > Manage Scheme.",
      "Choose the offer in \"Select Scheme\".",
      "Choose the branch in \"Select Branch\".",
      "Click \"Publish Scheme\". A green message names the branch it was published to.",
      "Check the \"Existing Schemes\" table: the \"Published Branches\" column now lists that branch code.",
      "Repeat for each branch that should run the offer.",
      "To withdraw an offer completely, click \"Delete\" on its row and confirm. This removes it from all branches.",
    ],
    tips: [
      "One branch at a time. There is no publish-to-all button, so work down your branch list.",
      "A scheme with no branches in \"Published Branches\" is not running anywhere, however good the dates look.",
      "Deleting removes the offer everywhere at once, including from tills currently using it.",
    ],
    related: ["Scheme Creation"],
  },

  "Invoice Designer": {
    summary:
      "Sets how your printed bill looks: company name and address at the top, your logo, which item columns are printed and the footer line. One template is active at a time.",
    steps: [
      "Open Tools & Design > Invoice Designer.",
      "Fill in \"Company Name\", \"Company Address\", \"Company Contact\" and \"Company GST Number\".",
      "Drag your logo file onto the dashed box, or click it to choose the file.",
      "Set \"Logo Width (in mm)\", \"Logo Height (in mm)\", \"Logo Start X Position (in mm)\" and \"Logo Start Y Position (in mm)\" to place the logo on the page.",
      "Under \"Select Columns to Include\", tick the columns to print: Item Name, Description, Quantity, Unit Price, Tax Rate, Total.",
      "Type the \"Footer Text\", for example your return policy or a thank-you line.",
      "Click \"Save Template\". It appears under \"Available Templates\".",
      "Select the radio button in the \"Active\" column of the template you want used for printing. Use the red bin to delete a template you no longer need.",
    ],
    tips: [
      "Company name, address and contact are required, and at least one column must be ticked, or the template will not save.",
      "Saving a template does not switch to it. Nothing changes on printed bills until you select it as the active one.",
      "Positions are in millimetres from the top-left of the page. Change them in small steps and print a test bill.",
      "Keep the logo modest in size; a tall logo pushes the item lines onto a second page.",
    ],
    related: ["Download"],
  },

  "Workflow Designer": {
    summary:
      "Draws and publishes business workflows (BPMN diagrams). A published workflow is what raises the tasks people see under My Tasks.",
    steps: [
      "Open Tools & Design > Workflow Designer.",
      "Click \"New\" to start a blank diagram, \"Open\" to pick an existing workflow, or \"Import BPMN\" to load a .bpmn file from your computer.",
      "Draw or adjust the steps on the canvas. Use \"Zoom In\", \"Zoom Out\", \"Fit to Screen\", \"Undo\", \"Redo\" and \"Delete Selected\" as you work.",
      "Click \"Save Draft\" to keep your work without putting it into use.",
      "Click \"Validate\" to list any problems. Fix the errors it reports.",
      "Click \"Publish\" and type change notes when asked. It validates again, saves a draft if needed, and puts the new version into use.",
      "Click \"Open\" again and confirm the workflow is listed as PUBLISHED with the expected version. \"Version History\" shows earlier versions and lets you open one.",
      "Use \"Export BPMN\" to keep a copy of the file, and \"Close Designer\" when finished.",
    ],
    fields: [
      { name: "Start Instance", desc: "Runs the workflow once, by hand, for testing. Only available after publishing." },
      { name: "Workflow Settings", desc: "Category, Description, Business object type, Tags, SLA (hours) and effective dates. These are notes for people; the engine does not enforce them." },
    ],
    tips: [
      "A .bpmn file sitting in the system does nothing until it is published here.",
      "Do not click \"Start Instance\" for workflows the system raises by itself, such as the task checks. You would create a duplicate run.",
      "To change a published workflow, open it, edit or import the new file, and publish again. That creates a new version; the old ones stay in \"Version History\".",
      "Only administrators can create, save, publish or import. Everyone else sees a \"View only\" badge.",
      "The screen warns you before losing unsaved changes, but save the draft as you go anyway.",
    ],
    related: ["Workflow Instances", "My Tasks"],
  },

  "Workflow Instances": {
    summary:
      "Every run of a published workflow, showing where each one has got to. Use it to check whether a process is still waiting on somebody.",
    steps: [
      "Open Tools & Design > Workflow Instances.",
      "Choose \"Running\", \"Completed\" or \"All\" with the buttons at the top right.",
      "Read the table: \"Process\" is the workflow, \"Business Key\" is the document or item it concerns, and \"Current Step\" is where it is waiting.",
      "Check \"Started\" and \"Updated\" to spot runs that have sat still for too long.",
      "Click the refresh icon to reload the list.",
    ],
    fields: [
      { name: "Current Step", desc: "The step the run is sitting at right now. If a step name appears here for days, somebody has an open task they have not done." },
      { name: "Version", desc: "Which published version of the workflow this run is following. Older runs finish on the version they started with." },
    ],
    tips: [
      "This screen only shows what is happening; you cannot push a run forward from here. Do that by completing the task in My Tasks.",
      "The list shows the most recent runs, not the full history.",
    ],
    related: ["Workflow Designer", "My Tasks"],
  },

  "Download": {
    summary:
      "The one place for everything you install on your own PCs: the POS Launcher, which installs and keeps the cashier POS up to date, and the Tally Connector, which sends vouchers into TallyPrime.",
    steps: [
      "Open Tools & Design > Download.",
      "For a till, download the POS Launcher zip on the cashier PC and extract it to a permanent folder, for example C:\\TradeLink247\\. Keep all the files together.",
      "Run launchPOSClinet.exe. On the first run it downloads the POS itself, so the PC needs internet.",
      "Log in to the POS and pick the branch. A new PC may need approval in System Administration > POS Machine Approval.",
      "Make a desktop shortcut to launchPOSClinet.exe (right-click > Send to > Desktop) and always open the POS from it, so updates are picked up.",
      "For Tally, download the Tally Connector installer on the PC that runs TallyPrime, then pair it from Accounting > Tally Integration > Connectors.",
    ],
    tips: [
      "You never reinstall the POS for an upgrade: each time the launcher starts, it checks for a newer version and downloads it.",
      "If the POS says it is not found and no update is available, check that the PC can reach tradelink247.com.",
      "Windows may warn about a downloaded program. Keep the file and allow it to run.",
      "Install the Tally Connector on the Tally machine itself, not on the server.",
    ],
    related: ["POS Machine Approval", "Tally Integration"],
  },

  "Upload": {
    summary:
      "Loads starting data into a branch from an Excel file: the item list, opening stock and the supplier list. Used mainly when a branch is first set up.",
    steps: [
      "Prepare the Excel file (.xlsx). The first row is treated as headings and is skipped, and the columns must be in the exact order listed below.",
      "Open Tools & Design > Upload.",
      "Choose the \"Branch Code\" the data belongs to.",
      "Choose the \"File Type\": ITEM_MASTER, OPENING_STOCK, SUPPLIER_MST or INI.",
      "Click the file box and pick your file.",
      "Click \"Upload\" and wait. A green message means it worked; a red one tells you what went wrong.",
      "Check the result on the matching screen (item list, stock report or supplier list) before loading the next file.",
    ],
    fields: [
      { name: "ITEM_MASTER", desc: "The product list. Columns in this order: Item Name, Tax Rate, Unit Name, Item Code, Standard Price, HSN Code, Item ID, Barcode, Category 1, Category 2, Cess Rate." },
      { name: "OPENING_STOCK", desc: "Starting stock per branch. Columns in this order: Voucher Date, Item Name, Branch Code, Quantity In, Batch Code, Expiry Date. Tax, unit, code, price and barcode are taken from the item list, not from this file." },
      { name: "SUPPLIER_MST", desc: "The supplier list. Columns in this order: Supplier Name, Supplier Address, Supplier GST, Supplier State, Supplier Phone." },
      { name: "INI", desc: "A settings file for a branch. It is simply stored against the branch; nothing is read into items, stock or suppliers." },
    ],
    tips: [
      "Load ITEM_MASTER first. An opening stock row whose item name does not already exist is skipped silently, so stock goes missing without an error.",
      "An item row replaces any existing item with the same item name, so a second upload of the same file overwrites rather than duplicating.",
      "A supplier whose name already exists is skipped, so corrections to an existing supplier must be made on the supplier screen.",
      "Names must match exactly, spaces and spelling included. Most failed loads are a name typed differently in the two files.",
      "Upload opening stock once. Running the same file twice adds the quantities again and inflates your stock.",
      "Use the branch code the data really belongs to; the file is loaded against whatever branch is selected.",
    ],
    accounting:
      "Opening stock adds quantity into the branch's stock with the standard price from the item list, so it changes what stock reports and valuations show. It does not post an opening journal to the ledgers; ask your accountant to raise the matching opening entry.",
    related: ["Download", "Branch Creation"],
  },

  "Franchise Master": {
    summary:
      "The list of franchises, their agreement details and their branches. This is also where a new franchise is set up automatically (provisioned) so it can start trading.",
    steps: [
      "Open Franchise > Franchise Master.",
      "Click the add button to create one. Fill in \"Franchise Code\" and \"Franchise Name\", the type, address, GST and PAN, contact details and the agreement details such as \"Agreement Date\", \"Agreement Expiry\", \"Royalty %\" and \"Territory\". Save.",
      "Pick the franchise from the list on the left. Use the search box above the list to find one quickly.",
      "On the \"Details\" tab, check the information and use the pencil icon to correct anything.",
      "While the status is DRAFT, click \"Provision\" to run the automatic setup. Watch the \"Provisioning\" tab: each step shows as pending, running, done or failed.",
      "If provisioning fails, read the red message on the failed step, then click \"Retry\", or \"Reset to Draft\" to start again.",
      "On the \"Branches\" tab, click the add button to create a branch for the franchise, or use an existing master branch, and fill in the branch code, name, manager, address and GST.",
      "Use \"Suspend\", \"Reactivate\" or \"Terminate\" to change the franchise's standing as the agreement changes.",
    ],
    fields: [
      { name: "Franchise Code", desc: "Unique short code, 3 to 20 characters, letters, numbers and hyphens." },
      { name: "Status", desc: "DRAFT before setup, PROVISIONING while it runs, ACTIVE when trading, SUSPENDED when paused, TERMINATED when finished, PROVISIONING_FAILED when setup did not complete." },
      { name: "Config tab", desc: "Extra settings stored as Key, Value, Type and Description. Only add keys you have been told to add." },
    ],
    tips: [
      "Suspending stops a franchise trading. Terminating is final, so be sure before you confirm.",
      "Provisioning can take a few minutes. Use the refresh icon on the \"Provisioning\" tab rather than clicking \"Provision\" again.",
      "Set the franchise up here first; its users are added under Franchise Users.",
    ],
    related: ["Franchise Users", "Branch Creation"],
  },

  "Franchise Users": {
    summary:
      "The people who may work in a particular franchise, and what they can do there. Access can be granted and revoked at any time.",
    steps: [
      "Open Franchise > Franchise Users.",
      "Choose the franchise in \"Select Franchise\". Its users load below.",
      "Click \"Add User\", type the \"Username\" and \"Password\", choose the \"Role\" (User, Admin or Manager) and save.",
      "Check the new person appears in the table, with who granted the access and when.",
      "To take access away, click \"Revoke\" on their row and confirm.",
    ],
    tips: [
      "Username and password are both required; the box refuses to save without them.",
      "Revoking removes access to that franchise only. It does not delete the person from the system.",
      "Give Admin only to someone who should be able to change the franchise's own settings.",
    ],
    related: ["Franchise Master", "User Creation"],
  },

  "About": {
    summary:
      "A short page naming the application. There is nothing to fill in or change.",
    steps: [
      "Open Support & Legal > About to see the page.",
    ],
  },

  "Terms & Conditions": {
    summary:
      "The terms you accept by using TradeLink 247. Read-only.",
    steps: [
      "Open Support & Legal > Terms & Conditions and read through the sections.",
    ],
    related: ["Privacy Policy", "Refund Policy"],
  },

  "Privacy Policy": {
    summary:
      "How your company's and your customers' information is collected, stored and used. Read-only.",
    steps: [
      "Open Support & Legal > Privacy Policy and read through the sections.",
    ],
    related: ["Terms & Conditions", "Refund Policy"],
  },

  "Refund Policy": {
    summary:
      "When subscription payments can be refunded or cancelled, including the table of what applies in each case. Read-only.",
    steps: [
      "Open Support & Legal > Refund Policy and read the sections and the table.",
    ],
    related: ["Terms & Conditions", "Privacy Policy"],
  },
};

export default content;
