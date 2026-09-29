import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, Paper, Divider, Chip, TextField, InputAdornment, Button,
  Table, TableHead, TableBody, TableRow, TableCell, Alert, IconButton, Drawer, useMediaQuery,
} from "@mui/material";
import { Search as SearchIcon, OpenInNew, MenuBook, Close } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { menuSections } from "../menuCatalog";
import { useMenuAccess } from "./MenuAccessContext";
import guides from "./help/content/guides";
import general from "./help/content/general";
import salesPurchase from "./help/content/salesPurchase";
import stockProduction from "./help/content/stockProduction";
import mastersAdmin from "./help/content/mastersAdmin";
import accounting from "./help/content/accounting";
import desktop from "./help/content/desktop";
import screenshots from "./help/content/screenshots";

// ============================================================================
// HELP - the user manual. Concept guides come from help/content/guides.js;
// the menu reference is generated from the shared menu catalog, so every
// sidebar menu gets an entry, filled from the per-module content files.
// ============================================================================

const MENU_CONTENT = { ...general, ...salesPurchase, ...stockProduction, ...mastersAdmin, ...accounting };
const DESKTOP_ORDER = [
  "Installing & first login", "POS", "KOT", "Keyboard shortcuts", "Schemes at the till", "UPI payments",
  "Sales Return", "Day End", "Daily Expense", "Expense Report", "Stock Transfer", "ST History", "Accept Stock",
  "Physical Stock", "Weigh Bridge", "Salesman", "Item Sales", "Item Movement", "Stock Transfer In",
  "Current Stock", "Working offline", "Updates",
];

const C = {
  bg: "#f4f6f9", paper: "#ffffff", text: "#2b2f36", muted: "#5f6773", brand: "#1565c0",
  brandSoft: "#e8f1fc", border: "#e1e5ea", code: "#1e1e1e",
};

export const helpSlug = (s) => "menu-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const deskSlug = (s) => "pos-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// All searchable text in an entry or guide, lower-cased.
const textOf = (v) => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(textOf).join(" ");
  if (typeof v === "object") return Object.values(v).map(textOf).join(" ");
  return "";
};
const matches = (hay, words) => words.every((w) => hay.includes(w));

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
const P = ({ children }) => (
  <Typography sx={{ color: C.text, lineHeight: 1.75, mb: 1.25, fontSize: 15 }}>{children}</Typography>
);
const H = ({ children }) => (
  <Typography sx={{ color: C.text, fontWeight: 700, fontSize: 16, mt: 2.5, mb: 1 }}>{children}</Typography>
);
const List = ({ items, ordered }) => {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag style={{ color: C.text, paddingLeft: 22, margin: "0 0 12px", lineHeight: 1.75, fontSize: 15 }}>
      {items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
    </Tag>
  );
};
const DataTable = ({ head, rows }) => (
  <Box sx={{ overflowX: "auto", mb: 2, border: `1px solid ${C.border}`, borderRadius: 1.5 }}>
    <Table size="small" sx={{ "& td, & th": { color: C.text, borderColor: C.border, fontSize: 14, verticalAlign: "top" } }}>
      <TableHead>
        <TableRow sx={{ bgcolor: C.brandSoft }}>
          {head.map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r, i) => (
          <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);
const Code = ({ children }) => (
  <Box component="pre" sx={{ bgcolor: C.code, color: "#e6e6e6", p: 2, borderRadius: 1.5, fontSize: 13.5, overflowX: "auto", mb: 2, whiteSpace: "pre-wrap" }}>
    {children}
  </Box>
);
const Shot = ({ src, caption }) => (
  <Box component="figure" sx={{ m: 0, mb: 2 }}>
    <Box
      component="img"
      src={`/help/${src}`}
      alt={caption || ""}
      loading="lazy"
      sx={{ width: "100%", maxWidth: 900, border: `1px solid ${C.border}`, borderRadius: 1.5, display: "block", bgcolor: "#fff" }}
    />
    {caption && <Typography component="figcaption" sx={{ color: C.muted, fontSize: 13, mt: 0.75 }}>{caption}</Typography>}
  </Box>
);
const TONES = { info: "info", warn: "warning", tip: "success" };
const btnSx = { color: C.brand, borderColor: "#9dbbe3", flexShrink: 0, "&:hover": { borderColor: C.brand, bgcolor: C.brandSoft } };

const MenuLinks = ({ keys, labelOf, hrefOf = (k) => `#${helpSlug(k)}` }) => (
  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1, mb: 1 }}>
    <Typography sx={{ color: C.muted, fontSize: 13, mr: 0.5, alignSelf: "center" }}>See:</Typography>
    {keys.map((k) => (
      <Chip
        key={k} size="small" component="a" clickable href={hrefOf(k)} label={labelOf(k)}
        sx={{ bgcolor: C.brandSoft, color: C.brand, fontWeight: 600 }}
      />
    ))}
  </Box>
);

const Blocks = ({ blocks, labelOf }) => blocks.map((b, i) => {
  if (b.h) return <H key={i}>{b.h}</H>;
  if (b.p) return <P key={i}>{b.p}</P>;
  if (b.ul) return <List key={i} items={b.ul} />;
  if (b.ol) return <List key={i} items={b.ol} ordered />;
  if (b.table) return <DataTable key={i} {...b.table} />;
  if (b.note) return <Alert key={i} severity={TONES[b.tone] || "info"} sx={{ mb: 2, fontSize: 14 }}>{b.note}</Alert>;
  if (b.code) return <Code key={i}>{b.code}</Code>;
  if (b.img) return <Shot key={i} src={b.img} caption={b.caption} />;
  if (b.menus) return <MenuLinks key={i} keys={b.menus} labelOf={labelOf} />;
  return null;
});

// One menu (or desktop screen) entry.
const Entry = ({ id, title, path, entry, shot, onOpen, labelOf, hrefOf }) => (
  <Paper id={id} variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 2, borderColor: C.border, bgcolor: C.paper, scrollMarginTop: 80 }}>
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap" }}>
      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 17, color: C.text }}>{title}</Typography>
        {path && <Typography sx={{ color: C.muted, fontSize: 13 }}>{path}</Typography>}
      </Box>
      {onOpen && (
        <Button size="small" variant="outlined" endIcon={<OpenInNew sx={{ fontSize: 16 }} />} onClick={onOpen} sx={btnSx}>
          Open
        </Button>
      )}
    </Box>
    {entry ? (
      <Box sx={{ mt: 1.25 }}>
        {entry.summary && <P>{entry.summary}</P>}
        {shot && <Shot src={shot.src} caption={shot.caption} />}
        {entry.steps?.length > 0 && (<><H>Step by step</H><List items={entry.steps} ordered /></>)}
        {entry.fields?.length > 0 && (
          <><H>Fields</H><DataTable head={["Field", "What to enter"]} rows={entry.fields.map((f) => [f.name, f.desc])} /></>
        )}
        {entry.accounting && (
          <Alert severity="info" icon={false} sx={{ mb: 1.5, fontSize: 14 }}>
            <strong>Stock and accounts: </strong>{entry.accounting}
          </Alert>
        )}
        {entry.tips?.length > 0 && (<><H>Tips</H><List items={entry.tips} /></>)}
        {entry.related?.length > 0 && labelOf && <MenuLinks keys={entry.related} labelOf={labelOf} hrefOf={hrefOf} />}
      </Box>
    ) : (
      <Typography sx={{ color: C.muted, mt: 1, fontSize: 14 }}>Instructions for this screen are being written.</Typography>
    )}
  </Paper>
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
  { id: "cash-summary",    label: "Daily Cash Summary — Configuration Guide" },
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
          <P>The one place for everything you install on your own PCs: the POS Launcher (installs and auto-updates the cashier POS) and the Tally Connector (sends vouchers into TallyPrime). Each download explains what it is and how to set it up.</P>
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
const HelpPage = () => {
  const navigate = useNavigate();
  const { isEntryAllowed } = useMenuAccess();
  const isDesktop = useMediaQuery("(min-width:1100px)");
  const [query, setQuery] = useState("");
  const [tocOpen, setTocOpen] = useState(false);

  const sections = useMemo(() => menuSections().filter((s) => s.items.some((it) => it.link)), []);

  const labelOf = useMemo(() => {
    const map = {};
    sections.forEach((s) => s.items.forEach((it) => { map[it.menuKey] = it.label; }));
    return (k) => map[k] || k;
  }, [sections]);

  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searching = words.length > 0;

  const shownGuides = useMemo(
    () => guides.filter((g) => !searching || matches((g.title + " " + textOf(g.blocks)).toLowerCase(), words)),
    [searching, words.join(" ")] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const shownSections = useMemo(() => sections.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => it.link && it.menuKey !== "Help").filter((it) => {
      if (!searching) return true;
      const hay = `${it.label} ${it.menuKey} ${sec.title} ${textOf(MENU_CONTENT[it.menuKey])}`.toLowerCase();
      return matches(hay, words);
    }),
  })).filter((sec) => sec.items.length > 0), [sections, searching, words.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownDesktop = useMemo(() => {
    const keys = [...DESKTOP_ORDER.filter((k) => desktop[k]), ...Object.keys(desktop).filter((k) => !DESKTOP_ORDER.includes(k))];
    return keys.filter((k) => !searching || matches(`${k} ${textOf(desktop[k])}`.toLowerCase(), words));
  }, [searching, words.join(" ")]); // eslint-disable-line react-hooks/exhaustive-deps

  const menuCount = shownSections.reduce((n, s) => n + s.items.length, 0);
  const hitCount = shownGuides.length + menuCount + shownDesktop.length;

  // Deep links (/help#menu-trial-balance) once content has rendered.
  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(t);
  }, []);

  const guideGroups = ["Start here", "Concepts"];
  const tailGuides = shownGuides.filter((g) => !guideGroups.includes(g.group));

  const go = (id) => {
    setTocOpen(false);
    document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const toc = (
    <Box sx={{ fontSize: 14 }}>
      {[...guideGroups, "Menu reference", "Desktop POS app", "Help"].map((grp) => {
        let links = [];
        if (grp === "Menu reference") links = shownSections.map((s) => ({ id: `sec-${s.key}`, label: s.title, n: s.items.length }));
        else if (grp === "Desktop POS app") links = shownDesktop.length ? [{ id: "desktop-app", label: "All desktop screens", n: shownDesktop.length }] : [];
        else links = shownGuides.filter((g) => g.group === grp).map((g) => ({ id: g.id, label: g.title }));
        if (!links.length) return null;
        return (
          <Box key={grp} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, mb: 0.5 }}>{grp}</Typography>
            {links.map((l) => (
              <Box
                key={l.id} component="a" href={`#${l.id}`}
                onClick={(e) => { e.preventDefault(); go(l.id); }}
                sx={{ display: "flex", justifyContent: "space-between", gap: 1, py: 0.4, color: C.brand, textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
              >
                <span>{l.label}</span>{l.n != null && <span style={{ color: C.muted }}>{l.n}</span>}
              </Box>
            ))}
          </Box>
        );
      })}
    </Box>
  );

  const renderGuide = (g) => (
    <Box key={g.id} id={g.id} sx={{ mb: 4, scrollMarginTop: 80 }}>
      <Typography variant="h5" sx={{ color: C.brand, fontWeight: 700, mb: 1 }}>{g.title}</Typography>
      <Divider sx={{ mb: 2 }} />
      <Blocks blocks={g.blocks} labelOf={labelOf} />
    </Box>
  );

  return (
    <Box sx={{ bgcolor: C.bg, minHeight: "100vh", p: { xs: 1.5, md: 3 }, width: "100%", maxWidth: "100%", minWidth: 0, overflowX: "hidden", boxSizing: "border-box" }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", display: "flex", gap: 3, alignItems: "flex-start" }}>
        {isDesktop && (
          <Paper variant="outlined" sx={{ width: 270, flexShrink: 0, p: 2, position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", bgcolor: C.paper, borderColor: C.border }}>
            {toc}
          </Paper>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 3, bgcolor: C.paper, borderColor: C.border }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <MenuBook sx={{ color: C.brand }} />
              <Typography variant="h4" sx={{ color: C.text, fontWeight: 800, fontSize: { xs: 24, md: 30 }, flex: 1 }}>
                TradeLink 247 User Guide
              </Typography>
              {!isDesktop && (
                <Button size="small" variant="outlined" onClick={() => setTocOpen(true)} sx={btnSx}>Contents</Button>
              )}
            </Box>
            <Typography sx={{ color: C.muted, mt: 0.5, mb: 2 }}>
              Setup, every menu step by step, accounting and stock costing, GST and the desktop POS.
            </Typography>
            <TextField
              fullWidth size="small" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide, e.g. closing stock, e-way bill, day end, receipt"
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                endAdornment: query && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQuery("")} aria-label="Clear search"><Close fontSize="small" /></IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiInputBase-root": { bgcolor: "#fff", color: C.text },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#c3cad3" },
                "& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: C.brand },
                "& .MuiInputAdornment-root .MuiSvgIcon-root": { color: C.muted },
                "& input::placeholder": { color: C.muted, opacity: 1 },
              }}
            />
            {searching && (
              <Typography sx={{ color: C.muted, fontSize: 13, mt: 1 }}>
                {hitCount === 0 ? "Nothing matches. Try fewer or different words." : `${hitCount} section${hitCount === 1 ? "" : "s"} match.`}
              </Typography>
            )}
          </Paper>

          {shownGuides.filter((g) => guideGroups.includes(g.group)).map(renderGuide)}

          {shownSections.length > 0 && (
            <Box id="menu-reference" sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ color: C.brand, fontWeight: 700, mb: 1 }}>Menu reference</Typography>
              <Divider sx={{ mb: 2 }} />
              <P>Every menu in the web app, in sidebar order. The Open button appears on menus your role can use.</P>
              {shownSections.map((sec) => (
                <Box key={sec.key} id={`sec-${sec.key}`} sx={{ mb: 3, scrollMarginTop: 80 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 19, color: C.text, mb: 1.5 }}>{sec.title}</Typography>
                  {sec.items.map((it) => {
                    const allowed = isEntryAllowed ? isEntryAllowed(it.menuKey, it.roles, sec.parentRoles) : true;
                    return (
                      <Entry
                        key={it.menuKey}
                        id={helpSlug(it.menuKey)}
                        title={it.label}
                        path={`${sec.title} > ${it.label}`}
                        entry={MENU_CONTENT[it.menuKey]}
                        shot={screenshots[it.menuKey]}
                        onOpen={allowed ? () => navigate(it.link) : null}
                        labelOf={labelOf}
                      />
                    );
                  })}
                </Box>
              ))}
            </Box>
          )}

          {shownDesktop.length > 0 && (
            <Box id="desktop-app" sx={{ mb: 4, scrollMarginTop: 80 }}>
              <Typography variant="h5" sx={{ color: C.brand, fontWeight: 700, mb: 1 }}>Desktop POS app</Typography>
              <Divider sx={{ mb: 2 }} />
              <P>The Windows till app for each counter. Install it from Tools & Design > Download.</P>
              {shownDesktop.map((k) => (
                <Entry
                  key={k} id={deskSlug(k)} title={k} entry={desktop[k]} shot={screenshots[`desktop:${k}`]}
                  labelOf={(r) => (desktop[r] ? r : labelOf(r))}
                  hrefOf={(r) => `#${desktop[r] ? deskSlug(r) : helpSlug(r)}`}
                />
              ))}
            </Box>
          )}

          {tailGuides.map(renderGuide)}
        </Box>
      </Box>

      <Drawer anchor="left" open={tocOpen} onClose={() => setTocOpen(false)} PaperProps={{ sx: { width: 290, p: 2, bgcolor: C.paper } }}>
        {toc}
      </Drawer>
    </Box>
  );
};

export default HelpPage;
