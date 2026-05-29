import React from "react";
import { Box, Typography, Paper, Divider, Chip } from "@mui/material";

const Section = ({ id, title, children }) => (
  <Box id={id} sx={{ mb: 4 }}>
    <Typography variant="h5" sx={{ color: "#1565c0", fontWeight: 700, mb: 1.5, mt: 3 }}>
      {title}
    </Typography>
    <Divider sx={{ mb: 2 }} />
    {children}
  </Box>
);

const SubSection = ({ title, children }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h6" sx={{ color: "#333", fontWeight: 600, mb: 0.75, fontSize: "1rem" }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const P = ({ children }) => (
  <Typography paragraph sx={{ color: "#444", lineHeight: 1.8, mb: 1 }}>
    {children}
  </Typography>
);

const OL = ({ items }) => (
  <ol style={{ color: "#444", paddingLeft: 22, lineHeight: 2 }}>
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ol>
);

const UL = ({ items }) => (
  <ul style={{ color: "#444", paddingLeft: 22, lineHeight: 2 }}>
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

const MenuRow = ({ name, desc }) => (
  <Box sx={{ display: "flex", gap: 1.5, mb: 0.75, alignItems: "flex-start" }}>
    <Chip label={name} size="small" sx={{ bgcolor: "#e3f2fd", color: "#1565c0", fontWeight: 600, fontSize: 11.5, flexShrink: 0, mt: 0.25 }} />
    <Typography sx={{ color: "#444", fontSize: 14, lineHeight: 1.6 }}>{desc}</Typography>
  </Box>
);

const toc = [
  { id: "overview",        label: "System Overview" },
  { id: "first-login",     label: "First Login & What You See" },
  { id: "setup-sequence",  label: "Getting Started — Setup Sequence" },
  { id: "upload-formats",  label: "Excel Upload Formats" },
  { id: "web-menus",       label: "Web Application Menus" },
  { id: "desktop-app",     label: "POS Desktop Application" },
  { id: "roles",           label: "User Roles & Access" },
  { id: "reports",         label: "Reports Guide" },
  { id: "tips",            label: "Tips & Common Mistakes" },
  { id: "support",         label: "Contact Support" },
];

const HelpPage = () => (
  <Box sx={{ p: 4, backgroundColor: "#f5f5f5", minHeight: "100vh" }}>
    <Paper elevation={3} sx={{ padding: 4, maxWidth: 1000, margin: "auto", borderRadius: 3, backgroundColor: "#fafafa" }}>

      {/* Title */}
      <Typography variant="h4" sx={{ color: "#212121", fontWeight: 800, mb: 0.5 }}>
        TradeLink 247 — User Manual
      </Typography>
      <Typography sx={{ color: "#666", mb: 3 }}>
        Everything a new user needs to get up and running quickly.
      </Typography>

      {/* Table of Contents */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 4, borderRadius: 2, bgcolor: "#f0f7ff" }}>
        <Typography sx={{ fontWeight: 700, mb: 1, color: "#1565c0" }}>Table of Contents</Typography>
        <ol style={{ margin: 0, paddingLeft: 20, color: "#1565c0", lineHeight: 2.2 }}>
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} style={{ color: "#1565c0", textDecoration: "none", fontSize: 14 }}>
                {t.label}
              </a>
            </li>
          ))}
        </ol>
      </Paper>

      {/* 1. Overview */}
      <Section id="overview" title="1. System Overview">
        <P>
          TradeLink 247 is a cloud-based multi-tenant ERP designed for retail and distribution businesses.
          It covers sales, purchases, inventory, production, and reporting — all accessible from a web
          browser, with a dedicated POS desktop app for each branch till.
        </P>
        <P>
          Each company that signs up gets a completely isolated database (multi-tenancy). Your data is
          never mixed with another company's data.
        </P>
        <SubSection title="Key Concepts">
          <UL items={[
            "Company / Tenant — the top-level account created when you sign up.",
            "Branch — a physical store or warehouse location within your company.",
            "User — a person who logs in. Each user is assigned to one or more branches.",
            "Role — controls which menus a user can see (system-admin, admin, user, manager…).",
            "Item Master — the central catalogue of products with price, tax rate, barcode, and HSN code.",
            "Voucher — any recorded transaction (sale, purchase, stock transfer) with a unique number.",
          ]} />
        </SubSection>
      </Section>

      {/* 2. First Login */}
      <Section id="first-login" title="2. First Login & What You See">
        <P>
          After signing up you are logged in as <strong>system-admin</strong> — the highest privilege
          level. The sidebar on the left is your main navigation. All menus are visible to system-admin.
        </P>
        <SubSection title="Sidebar areas">
          <UL items={[
            "Brand header — shows 'TradeLink 247 Business Suite'.",
            "Branch selector — once you create branches, pick one here. This filters reports and POS data.",
            "Refresh Cache — clears locally cached items/categories. Use it after uploading new data.",
            "Menu list — scrollable list of all modules.",
            "Dark Mode toggle — switch between light and dark themes.",
            "Logout — ends your session.",
          ]} />
        </SubSection>
      </Section>

      {/* 3. Setup Sequence */}
      <Section id="setup-sequence" title="3. Getting Started — Setup Sequence">
        <P>
          Follow these steps in order. Skipping ahead often causes errors (e.g. uploading stock before
          creating branches will fail because the branch code does not yet exist).
        </P>
        <OL items={[
          <><strong>Sign Up</strong> — Creates your company account and a system-admin user automatically.</>,
          <><strong>Log In</strong> — Use the username and password you set during signup.</>,
          <><strong>Financial Year Setup</strong> (Masters → Financial Year Setup) — Define your current financial year (e.g. Apr 2025 – Mar 2026). Voucher numbering resets at the start of each year.</>,
          <><strong>Create Branch</strong> (Branch Creation) — Add at least one branch. Note the Branch Code — you will need it in uploads and POS config.</>,
          <><strong>Branch Details</strong> (Branch Details) — Fill in the branch name, address, GST number, and phone. These appear on printed receipts.</>,
          <><strong>Receipt Modes</strong> (Masters → Receipt Modes) — Define how customers can pay: CASH, CARD, UPI, etc. The POS will show only the modes you add here.</>,
          <><strong>Category Type</strong> (Masters → Category Type) — Create broad product groups, e.g. "FMCG", "Electronics".</>,
          <><strong>Category Name</strong> (Masters → Category Name) — Create specific categories within a type, e.g. "Beverages", "Snacks".</>,
          <><strong>Supplier Creation</strong> (Masters → Supplier Creation) — Add your suppliers, or upload them from Excel (see Upload Formats).</>,
          <><strong>Upload Item Masters</strong> (Upload) — Import your product catalogue from Excel. See the Item Master format below.</>,
          <><strong>Upload Stock</strong> (Upload) — Import opening stock for each branch. See the Stock format below.</>,
          <><strong>Create Users</strong> (User Creation) — Create one user per branch operator. Assign role "user" for cashiers or "manager" for supervisors.</>,
          <><strong>Branch Assignment</strong> (Masters → Branch Assignment) — Link each user to the branch(es) they can access.</>,
          <><strong>Role Menu Access</strong> (Masters → Role Menu Access) — Optionally restrict which menus each role can see.</>,
          <><strong>Download Desktop App</strong> (Download) — Download and install the TradeLink 247 POS app on the branch computer.</>,
          <><strong>Configure POS</strong> — Edit <code>pos-config.json</code> next to the installed .exe. Set <code>apiServer</code> to your server URL and <code>printer.paperWidthMm</code> / <code>paperHeightMm</code> to match your thermal printer paper size.</>,
          <><strong>Test Print</strong> — Open the POS app, select your printer, and click "Print Test Invoice". This auto-detects and saves the paper size.</>,
        ]} />
      </Section>

      {/* 4. Upload Formats */}
      <Section id="upload-formats" title="4. Excel Upload Formats">
        <SubSection title="Item Master">
          <P>Upload via <strong>Upload → Item Masters</strong>. Columns must be in this exact order:</P>
          <OL items={[
            "Item Name (text)",
            "Tax Rate (number — e.g. 18 for 18%)",
            "Unit Name (text — e.g. PCS, KG, LTR)",
            "Item Code (text)",
            "Standard Price (number — selling price)",
            "HSN Code (text)",
            "Item ID (text — your unique product ID)",
            "Barcode (text)",
          ]} />
          <P><strong>Note:</strong> Tax Rate and Standard Price must be numeric. All other columns must be text format in Excel.</P>
        </SubSection>

        <SubSection title="Stock Upload">
          <P>Upload via <strong>Upload → Stock</strong>. Columns in order:</P>
          <OL items={[
            "Stock Date (dd/MM/yyyy format)",
            "Item Name (text — must match Item Master exactly)",
            "Branch Code (text — must match an existing branch)",
            "Qty (number)",
            "Batch (text — use 'NB' if no batch tracking)",
            "Expiry Date (dd/MM/yyyy format — leave blank if not applicable)",
          ]} />
          <P><strong>Note:</strong> Dates must be in dd/MM/yyyy format. Qty is numeric. All others are text.</P>
        </SubSection>

        <SubSection title="Supplier Master">
          <P>Upload via <strong>Upload → Supplier Mst</strong>. Columns in order:</P>
          <OL items={[
            "Supplier Name (text)",
            "Address (text)",
            "GST (text)",
            "State (text)",
            "Phone (text)",
          ]} />
        </SubSection>
      </Section>

      {/* 5. Web Menus */}
      <Section id="web-menus" title="5. Web Application Menus">

        <SubSection title="Dashboard">
          <P>Overview of today's sales, stock levels, and key performance indicators across all branches.</P>
        </SubSection>

        <SubSection title="AI Stock Intelligence">
          <P>AI-powered stock analysis. Detects slow-moving items, predicts reorder points, and highlights unusual movement patterns.</P>
        </SubSection>

        <SubSection title="Sales Entry">
          <P>Manual web-based sales entry for situations where the POS desktop is unavailable.</P>
        </SubSection>

        <SubSection title="HSN wise Sales / HSN wise Purchase">
          <P>View and export sales or purchase data grouped by HSN code — useful for GST filing.</P>
        </SubSection>

        <SubSection title="Purchase">
          <MenuRow name="Purchase Entry" desc="Record a purchase invoice against a supplier. Increases stock automatically." />
          <MenuRow name="Goods Receipt" desc="Confirm physical receipt of goods ordered. Links to purchase orders." />
        </SubSection>

        <SubSection title="Production">
          <MenuRow name="Production Def" desc="Define a bill of materials — which raw materials produce which finished goods." />
          <MenuRow name="Production Planning" desc="Plan production runs based on demand or stock levels." />
          <MenuRow name="Production Execution" desc="Record actual production and consume raw materials from stock." />
        </SubSection>

        <SubSection title="Branch Creation & Branch Details">
          <P>Create and manage branch locations. Branch Details lets you update address, GST, and contact info that prints on receipts.</P>
        </SubSection>

        <SubSection title="User Creation">
          <P>Create login accounts for branch staff. Assign a role and the system generates credentials. The user can then be linked to specific branches via Branch Assignment.</P>
        </SubSection>

        <SubSection title="Scheme">
          <MenuRow name="Scheme Creation" desc="Create promotional schemes: free quantity, item discount %, or cash back — triggered by purchase amount or item quantity." />
          <MenuRow name="Manage Scheme" desc="Publish, pause, or delete active schemes. The POS applies schemes in real time during billing." />
        </SubSection>

        <SubSection title="Masters">
          <MenuRow name="Financial Year Setup" desc="Define the active financial year. Voucher sequences reset each year." />
          <MenuRow name="Receipt Modes" desc="Add payment types (CASH, CARD, UPI, etc.) that appear in the POS." />
          <MenuRow name="Item Search" desc="Quickly find and inspect any item in the master catalogue." />
          <MenuRow name="Item Creation" desc="Create a single item manually rather than via bulk upload." />
          <MenuRow name="Price Edit Category Wise" desc="Bulk-update selling prices for all items in a category." />
          <MenuRow name="Category Link" desc="Link items to categories for scheme matching and reporting." />
          <MenuRow name="Category Type / Category Name" desc="Hierarchical product classification: Type is the parent (e.g. FMCG), Name is the child (e.g. Beverages)." />
          <MenuRow name="Supplier Creation" desc="Add or manage suppliers manually." />
          <MenuRow name="Tax Update Manager / Preview" desc="Bulk-update tax rates across items, with a preview before committing." />
          <MenuRow name="Branch Assignment" desc="Control which branches each user can access." />
          <MenuRow name="Physical Stock Correction" desc="Adjust stock quantities after a physical count without creating a purchase entry." />
          <MenuRow name="Menu Master" desc="View all registered menu keys in the system." />
          <MenuRow name="Role Management" desc="Create custom roles beyond the defaults." />
          <MenuRow name="Role Menu Access" desc="Control exactly which menus each role can see." />
          <MenuRow name="Manage Account Heads / Statement of Account" desc="Manage financial ledgers and view account statements." />
        </SubSection>

        <SubSection title="Upload">
          <P>Bulk-import data from Excel: Item Masters, Stock, and Supplier Master. See Section 4 for exact column formats.</P>
        </SubSection>

        <SubSection title="Download">
          <P>Download the latest TradeLink 247 POS desktop installer (.exe) for Windows. Install one copy per branch computer.</P>
        </SubSection>

        <SubSection title="Invoice Designer">
          <P>Design custom invoice templates for printed documents.</P>
        </SubSection>
      </Section>

      {/* 6. Desktop App */}
      <Section id="desktop-app" title="6. POS Desktop Application">
        <P>
          The desktop app is an Electron application installed on each branch counter. It works offline
          and syncs sales to the server automatically when connectivity is restored.
        </P>

        <SubSection title="Configuration (pos-config.json)">
          <P>Located next to the installed <code>.exe</code>. Edit with Notepad:</P>
          <Box component="pre" sx={{ bgcolor: "#1e1e1e", color: "#d4d4d4", p: 2, borderRadius: 2, fontSize: 13, overflowX: "auto", mb: 1 }}>
{`{
  "apiServer": "http://YOUR-SERVER-IP:8084",
  "printer": {
    "paperWidthMm": 70,
    "paperHeightMm": 3276
  }
}`}
          </Box>
          <P>Set <code>apiServer</code> to your backend server's IP and port. The printer dimensions must exactly match the custom paper size configured in Windows printer settings.</P>
        </SubSection>

        <SubSection title="Desktop Menus">
          <MenuRow name="POS" desc="Main billing screen. Scan barcodes or search by name. Supports offline mode — sales queue locally and sync when server is reachable." />
          <MenuRow name="KOT" desc="Kitchen Order Ticket system. Create orders for the kitchen; convert to a POS bill when the customer pays." />
          <MenuRow name="Day End" desc="Generate an end-of-day summary showing total sales, payment breakdown, and item quantities sold." />
          <MenuRow name="Stock Transfer" desc="Transfer stock from this branch to another. Creates a transfer-out record here and a pending transfer-in at the destination." />
          <MenuRow name="Accept Stock" desc="Accept incoming stock transfers from other branches." />
          <MenuRow name="Weigh Bridge" desc="Integrates with a serial-port weighbridge to capture weights directly into transactions." />
        </SubSection>

        <SubSection title="POS Workflow">
          <OL items={[
            "Open POS → select your branch and printer.",
            "Scan a barcode or type an item name and press Enter.",
            "Adjust quantity if needed.",
            "Enter the amount tendered. The balance is calculated automatically.",
            "Press Save (or Enter from the tendered field). The receipt prints silently.",
            "If the server is offline, the sale is saved locally and will sync automatically once the connection is restored (the yellow 'pending' badge shows the count).",
          ]} />
        </SubSection>

        <SubSection title="Test Print & Paper Size">
          <P>
            Click <strong>Print Test Invoice</strong> in the printer section (bottom-left of POS). The app
            queries the selected printer for its paper dimensions, saves them to <code>pos-config.json</code>
            automatically, and opens the system print dialog so you can verify alignment. If the paper size
            is not detected automatically, set <code>paperWidthMm</code> and <code>paperHeightMm</code>
            manually in the config file to match your Windows printer settings.
          </P>
        </SubSection>
      </Section>

      {/* 7. Roles */}
      <Section id="roles" title="7. User Roles & Access">
        <MenuRow name="system-admin" desc="Assigned automatically on signup. Has access to every menu. Cannot be restricted by Role Menu Access." />
        <MenuRow name="admin" desc="Full access to branches, users, uploads, reports, and masters. Suitable for store managers or owners." />
        <MenuRow name="user" desc="Access to POS, sales, purchase entry, item search, and most reports. Suitable for cashiers and branch operators." />
        <MenuRow name="manager" desc="Access to dashboard, AI analytics, purchase, and reports. No access to branch/user administration." />
        <MenuRow name="WB" desc="Weighbridge operator. Sees only weighbridge menus." />
        <MenuRow name="franchiseeuser" desc="Franchisee view — reports and selected masters only." />
        <P>
          You can further restrict any role using <strong>Masters → Role Menu Access</strong>. Assign
          specific menus to a role; only those menus will be visible. system-admin always sees everything
          regardless of Role Menu Access settings.
        </P>
      </Section>

      {/* 8. Reports */}
      <Section id="reports" title="8. Reports Guide">
        <SubSection title="Sales Reports">
          <MenuRow name="Sales Report" desc="Detailed line-by-line sales for a date range and branch." />
          <MenuRow name="Sales Re Print" desc="Reprint any past sales invoice by voucher number." />
          <MenuRow name="Sales Tax Summary" desc="Tax collected grouped by GST rate — use for GST returns." />
          <MenuRow name="HSN wise Sales" desc="Sales grouped by HSN code for GST filing." />
          <MenuRow name="All Branch Sales Report" desc="Consolidated sales across all branches." />
          <MenuRow name="All Branch Categorywise Sales" desc="Sales broken down by product category across branches." />
          <MenuRow name="Item Sales Report" desc="Sales volume and value per item." />
          <MenuRow name="Season Sales Report" desc="Compare sales across different time periods or seasons." />
          <MenuRow name="Bill Series Report" desc="Verify voucher number continuity — useful for audit." />
        </SubSection>
        <SubSection title="Stock Reports">
          <MenuRow name="Stock Movement Report" desc="Complete in/out history for each item in a branch." />
          <MenuRow name="Physical Stock Report" desc="Snapshot of current physical stock after corrections." />
          <MenuRow name="All Branch Stock Report" desc="Current stock for all items across every branch." />
          <MenuRow name="Item Stock Report" desc="Current stock for a specific item across branches." />
          <MenuRow name="Branch Stock Report / Management" desc="Stock levels per branch with variance analysis." />
          <MenuRow name="Branch Stock Diff Report" desc="Highlight discrepancies between expected and actual stock." />
          <MenuRow name="Stock Turnover Report" desc="How fast each item is selling — identify slow movers." />
          <MenuRow name="Stock Transfer Out / In Reports" desc="Full history of inter-branch stock movements." />
        </SubSection>
        <SubSection title="Purchase Reports">
          <MenuRow name="Purchase Report" desc="All purchase invoices for a date range." />
          <MenuRow name="HSN wise Purchase" desc="Purchase grouped by HSN code for input tax credit reconciliation." />
        </SubSection>
      </Section>

      {/* 9. Tips */}
      <Section id="tips" title="9. Tips & Common Mistakes">
        <UL items={[
          "Always complete Financial Year Setup before creating branches — the year is needed for voucher numbering.",
          "Item Names in stock uploads must match the Item Master exactly (case-sensitive). A mismatch will skip that row.",
          "Branch Codes are permanent. Choose a short, meaningful code (e.g. BLR01, DEL02) during Branch Creation.",
          "If menus disappear after user creation, check Role Menu Access — the user's role may not have been granted access to those menus.",
          "After uploading new items or stock, click Refresh Cache in the sidebar so the POS desktop picks up the changes.",
          "The POS works offline — sales are queued and sync automatically. The yellow badge on the title bar shows pending count.",
          "If a receipt prints blank, check that pos-config.json paperWidthMm/paperHeightMm match the Windows custom paper size exactly.",
          "Schemes are evaluated in real time during POS billing. Publish a scheme via Manage Scheme before billing starts.",
          "For GST returns: use HSN wise Sales and Sales Tax Summary reports — they give CGST + SGST split per rate.",
          "Reprocess Voucher can fix sales that failed to sync to the server due to temporary errors.",
        ]} />
      </Section>

      {/* 10. Support */}
      <Section id="support" title="10. Contact Support">
        <P>
          If you encounter any issue not covered in this manual, reach out to the support team:
        </P>
        <P>
          <strong>Email:</strong> erp.nexsol@gmail.com
        </P>
        <P>
          When contacting support, include your company name, the menu or feature involved, and a
          brief description of what you expected versus what happened. Screenshots are very helpful.
        </P>
      </Section>

    </Paper>
  </Box>
);

export default HelpPage;
