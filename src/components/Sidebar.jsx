import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Switch,
  Drawer,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Typography,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import {
  Dashboard,
  AutoGraph,
  AdminPanelSettings,
  Replay,
  PointOfSale,
  RestaurantMenu,
  Receipt,
  ShoppingCart,
  Category,
  Scale,
  Speed,
  Analytics,
  AddBusiness,
  Business,
  Group,
  Loyalty,
  Tune,
  Assessment,
  PlaylistAddCheck,
  AccountTree,
  CloudDownload,
  CloudUpload,
  Description,
  Info,
  HelpOutline,
  ExitToApp,
  ExpandLess,
  ExpandMore,
  ModeNightRounded,
  Refresh,
  Pages,
  AccountBalance,
  Build,
  Map,
  LockReset,
} from "@mui/icons-material";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBranch } from "./BranchContext";

const DRAWER_WIDTH = 240;

const C = {
  bg: "#1a2038",
  headerBg: "#141a2e",
  activeBg: "rgba(255,227,163,0.10)",
  activeBorder: "#ffe3a3",
  hover: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.85)",
  textMuted: "rgba(255,255,255,0.35)",
  textActive: "#ffe3a3",
  icon: "rgba(255,227,163,0.60)",
  divider: "rgba(255,255,255,0.07)",
  subLine: "rgba(255,227,163,0.18)",
};

const ic = (node) => React.cloneElement(node, { fontSize: "small" });

const Sidebar = ({ mode, setMode, roles = [], mobileOpen, setMobileOpen }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const { branch: selectedBranch, setBranch: setSelectedBranch, branches } = useBranch();

  const [openMenus, setOpenMenus] = useState({});
  // null = not yet loaded; empty Set = loaded but no assignments (show all)
  const [allowedMenuNames, setAllowedMenuNames] = useState(null);
  const [menuFetchTrigger, setMenuFetchTrigger] = useState(0);

  useEffect(() => {
    if (!roles || roles.length === 0) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/role-menus/accessible-menus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(roles),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllowedMenuNames(new Set(Array.isArray(data) ? data : [])))
      .catch(() => setAllowedMenuNames(new Set()));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, menuFetchTrigger]);

  const isSystemAdmin = roles.includes("system-admin");

  const isMenuAllowed = (key) => {
    if (isSystemAdmin || !allowedMenuNames || allowedMenuNames.size === 0) return true;
    return allowedMenuNames.has(key);
  };

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
  };

  const handleLogout = () => {
    localStorage.removeItem("tenancyId");
    localStorage.removeItem("authToken");
    localStorage.removeItem("branchCode");
    window.location.reload();
  };

  const handleRefresh = () => {
    localStorage.removeItem("items");
    localStorage.removeItem("categories");
    setAllowedMenuNames(null);
    setMenuFetchTrigger((n) => n + 1);
  };

  // ── Change password dialog ──────────────────────────────────────────────
  const [pwOpen, setPwOpen]             = useState(false);
  const [pwCurrent, setPwCurrent]       = useState("");
  const [pwNew, setPwNew]               = useState("");
  const [pwConfirm, setPwConfirm]       = useState("");
  const [pwLoading, setPwLoading]       = useState(false);
  const [pwError, setPwError]           = useState("");
  const [pwSuccess, setPwSuccess]       = useState("");

  const openPwDialog = () => {
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setPwError(""); setPwSuccess("");
    setPwOpen(true);
  };

  const handleChangePassword = async () => {
    if (pwNew !== pwConfirm) { setPwError("New passwords do not match"); return; }
    if (pwNew.length < 4)    { setPwError("New password must be at least 4 characters"); return; }
    setPwLoading(true);
    setPwError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token     = localStorage.getItem("jwtToken");
      const res = await fetch(`/api/${tenancyId}/change-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (data.success) {
        setPwSuccess("Password changed successfully. Please log in again.");
        setTimeout(() => { localStorage.removeItem("jwtToken"); window.location.reload(); }, 2000);
      } else {
        setPwError(data.message || "Failed to change password");
      }
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  const toggleMenu = (idx) =>
    setOpenMenus((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleNavClick = () => setMobileOpen(false);

  const isActive = (link) => !!link && location.pathname === link;

  const menuItems = [
    // ── Dashboard & Intelligence ──────────────────────────────────────────
    { menuKey: "Dashboard", label: t("Dashboard"), icon: <Dashboard />, link: "/dashboard", roles: ["admin", "manager"] },
    { menuKey: "AI Stock Intelligence", label: t("AI Stock Intelligence"), icon: <AutoGraph />, link: "/ai-dashboard", roles: ["admin", "manager"] },
    { menuKey: "AI Report Assistant",  label: t("AI Report Assistant"),  icon: <AutoGraph />, link: "/ai-report",    roles: ["admin", "manager", "user"] },
    { menuKey: "Menu Map", label: t("Menu Map"), icon: <Map />, link: "/menu-map", roles: ["admin", "manager", "user"] },

    // ── Setup & Administration ────────────────────────────────────────────
    {
      menuKey: "Initial Setup", label: t("Setup & Administration"), icon: <PlaylistAddCheck />, link: "",
      roles: ["admin", "WB"], hasSubmenu: true,
      submenu: [
        { menuKey: "Menu Master",                   label: t("1. Create Menus"),                link: "/menu-master",                  roles: ["admin"] },
        { menuKey: "Role Management",               label: t("2. Create Roles"),                link: "/role-management",              roles: ["admin"] },
        { menuKey: "Role Menu Access",              label: t("3. Assign Menus to Roles"),       link: "/role-menu",                    roles: ["admin"] },
        { menuKey: "Branch Creation",               label: t("4. Create Branches"),             link: "/branchcreationpage",           roles: ["admin"] },
        { menuKey: "User Creation",                 label: t("5. Create Users"),                link: "/usercreationpage",             roles: ["admin"] },
        { menuKey: "Branch Assignment",             label: t("6. Assign Branches & Roles"),     link: "/branchassingment",             roles: ["admin"] },
        { menuKey: "Transfer Branch Permissions",   label: t("7. Transfer Branch Permissions"), link: "/branch-transfer-assignment",   roles: ["admin"] },
        { menuKey: "Branch Day End Settings",       label: t("Branch Day End Settings"),        link: "/branch-day-end-settings",      roles: ["admin"] },
        { menuKey: "Clear Day End",                 label: t("Clear Day End"),                  link: "/day-end-clear",                roles: ["admin"] },
        { menuKey: "Version Management",            label: t("Version Management"),             link: "/version-management",           roles: ["admin"] },
        { menuKey: "Admin Page",                    label: t("Admin Page"),                     link: "/branch-request-list",          roles: ["admin", "WB"] },
        { menuKey: "Reprocess Voucher",             label: t("Reprocess Voucher"),              link: "/reprocess-voucher-form",       roles: ["admin", "WB"] },
        { menuKey: "POS Machine Approval",          label: t("POS Machine Approval"),           link: "/pos-machine-approval",          roles: ["admin", "MACHINE_ADMIN"] },
        { menuKey: "UPI Payment Setup",              label: t("UPI Payment Setup"),               link: "/upi-config",                     roles: ["admin"] },
      ],
    },

    // ── Sales ─────────────────────────────────────────────────────────────
    {
      menuKey: "Sales", label: t("Sales"), icon: <Receipt />, link: "",
      roles: ["admin", "user"], hasSubmenu: true,
      submenu: [
        { menuKey: "POS",          label: t("POS"),          link: "/pos",            roles: ["admin", "user"] },
        { menuKey: "KOT",          label: t("KOT"),          link: "/kot",            roles: ["admin", "user"] },
        { menuKey: "Sales Entry",  label: t("Sales Entry"),  link: "/salesentryform", roles: ["admin"] },
      ],
    },

    // ── Purchase ──────────────────────────────────────────────────────────
    {
      menuKey: "Purchase", label: t("Purchase"), icon: <ShoppingCart />, link: "",
      roles: ["admin", "manager", "user"], hasSubmenu: true,
      submenu: [
        { menuKey: "Purchase Entry",               label: t("Purchase Entry"),               link: "/purchaseentry",                roles: ["user", "manager", "admin"] },
        { menuKey: "Goods Receipt",                label: t("Goods Receipt"),                link: "/goodsreceipt",                 roles: ["user", "manager", "admin"] },
        { menuKey: "Purchase Correction",          label: t("Purchase Correction"),          link: "/purchase-correction",          roles: ["admin", "manager"] },
        { menuKey: "Purchase Correction Approval", label: t("Purchase Correction Approval"), link: "/purchase-correction-approval", roles: ["admin", "manager"] },
        { menuKey: "Purchase Correction History",  label: t("Purchase Correction History"),  link: "/purchase-correction-history",  roles: ["admin", "manager", "user"] },
      ],
    },

    // ── Production ────────────────────────────────────────────────────────
    {
      menuKey: "Production", label: t("Production"), icon: <Category />, link: "",
      roles: ["admin", "manager", "user"], hasSubmenu: true,
      submenu: [
        { menuKey: "Production Def",       label: t("Production Def"),       link: "/production-def",       roles: ["admin", "manager", "user"] },
        { menuKey: "Production Planning",  label: t("Production Planning"),  link: "/production-planning",  roles: ["admin", "manager", "user"] },
        { menuKey: "Production Execution", label: t("Production Execution"), link: "/production-execution", roles: ["admin", "manager", "user"] },
      ],
    },

    // ── Stock Operations ──────────────────────────────────────────────────
    {
      menuKey: "Stock Operations", label: t("Stock Operations"), icon: <AddBusiness />, link: "",
      roles: ["admin", "manager"], hasSubmenu: true,
      submenu: [
        { menuKey: "Physical Stock Correction", label: t("Physical Stock Correction"), link: "/physical-stock-correction", roles: ["admin", "manager"] },
      ],
    },

    // ── Weighbridge ───────────────────────────────────────────────────────
    {
      menuKey: "Weighbridge Group", label: t("Weighbridge"), icon: <Scale />, link: "",
      roles: ["WB"], hasSubmenu: true,
      submenu: [
        { menuKey: "Weighbridge",       label: t("Weighbridge Entry"),  link: "/weighbridge",     roles: ["WB"] },
        { menuKey: "Weight-Count",      label: t("Weight-Count"),       link: "/bridge-count",    roles: ["WB"] },
        { menuKey: "WeighBridge Usage", label: t("WeighBridge Usage"),  link: "/weighbridgeusage", roles: ["WB"] },
      ],
    },

    // ── Scheme ────────────────────────────────────────────────────────────
    {
      menuKey: "Scheme", label: t("Scheme"), icon: <Loyalty />, link: "",
      roles: ["admin"], hasSubmenu: true,
      submenu: [
        { menuKey: "Scheme Creation", label: t("Scheme Creation"), link: "/schemepage",        roles: ["admin"] },
        { menuKey: "Manage Scheme",   label: t("Manage Scheme"),   link: "/publishschemepage", roles: ["admin"] },
      ],
    },

    // ── Masters ───────────────────────────────────────────────────────────
    {
      menuKey: "Masters", label: t("Masters"), icon: <Tune />, link: "",
      roles: ["admin", "user", "cgn", "franchiseeuser"], hasSubmenu: true,
      submenu: [
        { menuKey: "Branch Details",           label: t("Branch Details"),           link: "/branch-update",          roles: ["admin"] },
        { menuKey: "Item Cost Override",       label: t("Item Cost Override"),       link: "/item-cost-override",     roles: ["admin"] },
        { menuKey: "Receipt Modes",            label: t("Receipt Modes"),            link: "/receipt-modes",        roles: ["admin"] },
        { menuKey: "Item Search",              label: t("Item Search"),              link: "/itemsearch",           roles: ["admin", "user", "cgn", "franchiseeuser"] },
        { menuKey: "Item Creation",            label: t("Item Creation"),            link: "/createitemmaster",     roles: ["admin", "user"] },
        { menuKey: "Branch Price",              label: t("Branch Price"),              link: "/branch-price",               roles: ["admin", "franchiseeuser"] },
        { menuKey: "Stock Transfer Discount",   label: t("Stock Transfer Discount"),   link: "/stock-transfer-discount",    roles: ["admin"] },
        { menuKey: "Price Edit Category Wise",  label: t("Price Edit Category Wise"),  link: "/category-price-edit",        roles: ["admin", "user"] },
        { menuKey: "Category Type",            label: t("Category Type"),            link: "/categorytypemaster",   roles: ["admin", "user"] },
        { menuKey: "Category Name",            label: t("Category Name"),            link: "/categorynamemaster",   roles: ["admin", "user"] },
        { menuKey: "Category Link",            label: t("Category Link"),            link: "/item-category-linker", roles: ["admin", "user"] },
        { menuKey: "Report Exclusions",        label: t("Report Exclusions"),        link: "/report-exclusions",    roles: ["admin"] },
        { menuKey: "Tax Update Manager",       label: t("Tax Update Manager"),       link: "/tax-update-manager",   roles: ["admin", "user"] },
        { menuKey: "Tax Update Preview",       label: t("Tax Update Preview"),       link: "/tax-update-preview",   roles: ["admin", "user"] },
        { menuKey: "Supplier Creation",        label: t("Supplier Creation"),        link: "/suppliercreation",     roles: ["admin", "user", "cgn"] },
      ],
    },

    // ── Reports ───────────────────────────────────────────────────────────
    {
      menuKey: "Reports", label: t("Reports"), icon: <Assessment />, link: "",
      roles: ["admin", "manager", "cgn", "user", "franchiseeuser", "WB"], hasSubmenu: true,
      submenu: [
        // Sales
        { menuKey: "Sales Report",                         label: t("Sales Report"),                         link: "/sales",                                 roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Sales Re Print",                       label: t("Sales Re Print"),                       link: "/salessummaryreport",                    roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Sales Tax Summary",                    label: t("Sales Tax Summary"),                    link: "/salestaxsummary",                       roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "HSN wise Sales",                       label: t("HSN wise Sales"),                       link: "/hsnsales",                              roles: ["admin", "franchiseeuser", "user"] },
        { menuKey: "HSN Sales Summary",                    label: t("HSN Sales Summary"),                    link: "/hsn-sales-summary",                     roles: ["admin", "franchiseeuser", "user"] },
        { menuKey: "All Branch Sales Report",              label: t("All Branch Sales Report"),              link: "/sales-report-all-branch",               roles: ["admin", "user", "manager"] },
        { menuKey: "All Branch Categorywise Sales Report", label: t("All Branch Categorywise Sales Report"), link: "/sales-category-wise-report-all-branch", roles: ["admin", "user", "manager"] },
        { menuKey: "Season Sales Report",                  label: t("Season Sales Report"),                  link: "/seasonalreport",                        roles: ["admin"] },
        { menuKey: "Salesman Report",                      label: t("Salesman Report"),                      link: "/salesman-report",                       roles: ["admin", "manager", "user"] },
        // Purchase
        { menuKey: "Purchase Report",                      label: t("Purchase Report"),                      link: "/purchasereport",                        roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "HSN wise Purchase",                    label: t("HSN wise Purchase"),                    link: "/hsnwise-purchase-report",               roles: ["admin", "user"] },
        // Stock & Inventory
        { menuKey: "Item Stock Report",                    label: t("Item Stock Report"),                    link: "/item-stock-report",                     roles: ["admin", "user", "manager", "cgn"] },
        { menuKey: "All Branch Stock Report",              label: t("All Branch Stock Report"),              link: "/stock-report-all-branch",               roles: ["admin", "user", "manager", "cgn", "franchiseeuser"] },
        { menuKey: "Branch Stock Report",                  label: t("Branch Stock Report"),                  link: "/branch-stock-view",                     roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Branch Stock Management",              label: t("Branch Stock Management"),              link: "/branch-stock-report",                   roles: ["admin"] },
        { menuKey: "Branch Inventory Report",              label: t("Branch Inventory Report"),              link: "/branch-inventory",                      roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Branch Inventory Ledger",              label: t("Branch Inventory Ledger"),              link: "/branch-inventory-ledger",               roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Stock Movement Report",                label: t("Stock Movement Report"),                link: "/stockmovementreport",                   roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Physical Stock Report",                label: t("Physical Stock Report"),                link: "/physicalstockreport",                   roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Stock Turnover Report",                label: t("Stock Turnover Report"),                link: "/stock-turnover",                        roles: ["user", "admin"] },
        { menuKey: "Stock Anomaly Report",                 label: t("Stock Anomaly Report"),                 link: "/stock-anomaly-report",                  roles: ["admin", "manager"] },
        // Item Analysis
        { menuKey: "Item Sales Report",                    label: t("Item Sales Report"),                    link: "/item-sales",                            roles: ["user", "admin"] },
        { menuKey: "Item Movement Report",                 label: t("Item Movement Report"),                 link: "/item-movement-report",                  roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Item Velocity Report",                 label: t("Item Velocity Report"),                 link: "/item-velocity-report",                  roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Item Transfer Report",                 label: t("Item Transfer Report"),                 link: "/item-transfer-report",                  roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Category Item Report",                 label: t("Category Item Report"),                 link: "/category-item-report",                  roles: ["admin", "manager", "user"] },
        { menuKey: "Stock Transfer In Report",             label: t("Stock Transfer In Report"),             link: "/stocktransfer-in-report",               roles: ["admin", "franchiseeuser", "user"] },
        { menuKey: "Stock Transfer Out Report",            label: t("Stock Transfer Out Report"),            link: "/stocktransfer-out-report",              roles: ["admin", "franchiseeuser"] },
        // Profit
        { menuKey: "Branch Profit Report",             label: t("Branch Profit Report"),             link: "/branch-profit-report",              roles: ["admin", "manager"] },
        { menuKey: "Monthly Branch Profit Report",     label: t("Monthly Branch Profit Report"),     link: "/monthly-branch-profit-report",      roles: ["admin", "manager"] },
        // Operations
        { menuKey: "Day End Report",                       label: t("Day End Report"),                       link: "/day-end-report",                        roles: ["admin", "manager"] },
        { menuKey: "Bill Series Report",                   label: t("Bill Series Report"),                   link: "/billseriesreport",                      roles: ["admin", "user", "manager"] },
        { menuKey: "Documents List",                       label: t("Documents List"),                       link: "/documents-list",                        roles: ["user", "admin", "WB"] },
      ],
    },

    // ── Accounting ────────────────────────────────────────────────────────
    {
      menuKey: "Accounting", label: t("Accounting"), icon: <AccountBalance />, link: "",
      roles: ["admin", "manager"], hasSubmenu: true,
      submenu: [
        // Setup & Masters
        { menuKey: "Accounting Setup",       label: t("Accounting Setup"),       link: "/accounting/setup",               roles: ["admin"] },
        { menuKey: "Ledger Accounts",        label: t("Ledger Accounts"),        link: "/accounting/ledger-accounts",     roles: ["admin"] },
        { menuKey: "Expense Head Management",label: t("Expense Head Management"),link: "/expense-head-management",        roles: ["admin"] },
        { menuKey: "Financial Year Setup",   label: t("Financial Year Setup"),   link: "/financialyearpage",              roles: ["admin", "franchiseeuser"] },
        // Transactions
        { menuKey: "Receipt Entry",          label: t("Receipt Entry"),          link: "/accounting/receipt-entry",       roles: ["admin", "manager"] },
        { menuKey: "Payment Entry",          label: t("Payment Entry"),          link: "/accounting/payment-entry",       roles: ["admin", "manager"] },
        { menuKey: "Branch Monthly Expense", label: t("Branch Monthly Expense"), link: "/branch-monthly-expense",         roles: ["admin", "manager"] },
        { menuKey: "Inter-Branch Transfer",  label: t("Inter-Branch Transfer"),  link: "/accounting/inter-branch-transfer", roles: ["admin", "manager"] },
        // Reports
        { menuKey: "Trial Balance",          label: t("Trial Balance"),          link: "/accounting/trial-balance",       roles: ["admin", "manager"] },
        { menuKey: "Ledger Statement",       label: t("Ledger Statement"),       link: "/accounting/ledger-statement",    roles: ["admin", "manager"] },
        { menuKey: "Profit & Loss",          label: t("Profit & Loss"),          link: "/accounting/profit-loss",         roles: ["admin", "manager"] },
        { menuKey: "Balance Sheet",          label: t("Balance Sheet"),          link: "/accounting/balance-sheet",       roles: ["admin", "manager"] },
        { menuKey: "Cash Flow",              label: t("Cash Flow"),              link: "/accounting/cash-flow",           roles: ["admin", "manager"] },
        { menuKey: "Customer Statement",     label: t("Customer Statement"),     link: "/accounting/customer-statement",  roles: ["admin", "manager"] },
        { menuKey: "Supplier Statement",     label: t("Supplier Statement"),     link: "/accounting/supplier-statement",  roles: ["admin", "manager"] },
        { menuKey: "Customer Aging",         label: t("Customer Aging"),         link: "/accounting/customer-aging",      roles: ["admin", "manager"] },
        { menuKey: "Supplier Aging",         label: t("Supplier Aging"),         link: "/accounting/supplier-aging",      roles: ["admin", "manager"] },
        { menuKey: "Bank Reconciliation",    label: t("Bank Reconciliation"),    link: "/accounting/bank-reconciliation", roles: ["admin", "manager"] },
        { menuKey: "Inventory Ledger",       label: t("Inventory Ledger"),       link: "/accounting/inventory-ledger",    roles: ["admin", "manager"] },
        { menuKey: "Stock Valuation",        label: t("Stock Valuation"),        link: "/accounting/stock-valuation",     roles: ["admin", "manager"] },
        // Operations
        { menuKey: "Period Closing",         label: t("Period Closing"),         link: "/accounting/period-closing",      roles: ["admin"] },
        { menuKey: "Budget Manager",         label: t("Budget Manager"),         link: "/accounting/budget-manager",      roles: ["admin", "manager"] },
        { menuKey: "Budget vs Actual",       label: t("Budget vs Actual"),       link: "/accounting/budget-vs-actual",    roles: ["admin", "manager"] },
      ],
    },

    // ── Franchise Management ──────────────────────────────────────────────
    {
      menuKey: "Franchise Management", label: t("Franchise"), icon: <Business />, link: "",
      roles: ["admin", "system-admin"], hasSubmenu: true,
      submenu: [
        { menuKey: "Franchise Master", label: t("Franchise Master"), link: "/franchise-master", roles: ["admin", "system-admin"] },
      ],
    },

    // ── Tools & Design ────────────────────────────────────────────────────
    {
      menuKey: "Tools", label: t("Tools & Design"), icon: <Build />, link: "",
      roles: ["user", "admin", "manager", "WB"], hasSubmenu: true,
      submenu: [
        { menuKey: "Invoice Designer",  label: t("Invoice Designer"),  link: "/invoicedesigner", roles: ["user", "admin", "manager"] },
        { menuKey: "Workflow Designer", label: t("Workflow Designer"), link: "/bpmn-editorr",    roles: ["user", "admin", "manager"] },
        { menuKey: "Download",          label: t("Download"),          link: "/download",         roles: ["user", "manager", "admin", "WB"] },
        { menuKey: "Upload",            label: t("Upload"),            link: "/uploadpage",       roles: ["admin"] },
      ],
    },

    // ── Support & Legal ───────────────────────────────────────────────────
    {
      menuKey: "Support & Legal", label: t("Support & Legal"), icon: <HelpOutline />, link: "",
      roles: ["user", "admin", "manager"], hasSubmenu: true,
      submenu: [
        { menuKey: "Help",               label: t("Help"),               link: "/help",                 roles: ["user", "admin", "manager"] },
        { menuKey: "About",              label: t("About"),              link: "/about",                roles: ["user", "admin", "manager"] },
        { menuKey: "Terms & Conditions", label: t("Terms & Conditions"), link: "/terms-and-conditions", roles: ["user", "admin", "manager"] },
        { menuKey: "Privacy Policy",     label: t("Privacy Policy"),     link: "/privacy-policy",       roles: ["user", "admin", "manager"] },
        { menuKey: "Refund Policy",      label: t("Refund Policy"),      link: "/refund-policy",        roles: ["user", "admin", "manager"] },
      ],
    },
  ];

  // Auto-open submenus that contain the active route
  useEffect(() => {
    menuItems.forEach((item, idx) => {
      if (item.hasSubmenu && item.submenu?.some((s) => s.link === location.pathname)) {
        setOpenMenus((prev) => ({ ...prev, [idx]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const itemButtonSx = (link) => ({
    px: 2,
    py: 0.85,
    minHeight: 40,
    borderLeft: isActive(link) ? `3px solid ${C.activeBorder}` : "3px solid transparent",
    bgcolor: isActive(link) ? C.activeBg : "transparent",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
    "& .MuiListItemIcon-root": {
      color: isActive(link) ? C.textActive : C.icon,
      minWidth: 36,
      transition: "color 0.15s ease",
    },
    "& .MuiListItemText-primary": {
      fontSize: 13.5,
      fontWeight: isActive(link) ? 600 : 400,
      color: isActive(link) ? C.textActive : C.text,
      lineHeight: 1.4,
    },
    "&:hover": {
      bgcolor: isActive(link) ? C.activeBg : C.hover,
      "& .MuiListItemIcon-root": { color: C.textActive },
      "& .MuiListItemText-primary": { color: C.textActive },
    },
  });

  const parentButtonSx = (isOpen, hasActive) => ({
    px: 2,
    py: 0.85,
    minHeight: 40,
    borderLeft: hasActive ? `3px solid ${C.activeBorder}` : "3px solid transparent",
    bgcolor: hasActive ? C.activeBg : "transparent",
    transition: "background-color 0.15s ease",
    "& .MuiListItemIcon-root": {
      color: hasActive ? C.textActive : C.icon,
      minWidth: 36,
    },
    "& .MuiListItemText-primary": {
      fontSize: 13.5,
      fontWeight: hasActive || isOpen ? 600 : 400,
      color: hasActive || isOpen ? C.textActive : C.text,
    },
    "&:hover": {
      bgcolor: hasActive ? C.activeBg : C.hover,
      "& .MuiListItemIcon-root": { color: C.textActive },
      "& .MuiListItemText-primary": { color: C.textActive },
    },
  });

  const subItemButtonSx = (link) => ({
    pl: "44px",
    py: 0.65,
    minHeight: 34,
    bgcolor: isActive(link) ? C.activeBg : "transparent",
    "& .MuiListItemText-primary": {
      fontSize: 12.5,
      fontWeight: isActive(link) ? 600 : 400,
      color: isActive(link) ? C.textActive : "rgba(255,255,255,0.65)",
    },
    "&:hover": {
      bgcolor: C.hover,
      "& .MuiListItemText-primary": { color: C.textActive },
    },
    transition: "background-color 0.15s ease",
  });

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: C.bg }}>

      {/* ── Brand header ───────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2,
          pt: 2.5,
          pb: 2,
          bgcolor: C.headerBg,
          borderBottom: `1px solid ${C.divider}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ffe3a3 0%, #f5a623 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1a2038", lineHeight: 1 }}>
              T
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: C.textActive, lineHeight: 1.2 }}>
              TradeLink 247
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: C.textMuted, letterSpacing: "0.5px" }}>
              Business Suite
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Branch selector ────────────────────────────────────────── */}
      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          borderBottom: `1px solid ${C.divider}`,
          flexShrink: 0,
        }}
      >
        <FormControl fullWidth size="small">
          <Select
            value={selectedBranch}
            onChange={handleBranchChange}
            displayEmpty
            renderValue={(v) =>
              v ? (
                <Typography sx={{ fontSize: 12.5, color: C.textActive }}>{v}</Typography>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: C.textMuted }}>
                  {t("Select Branch")}
                </Typography>
              )
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.05)",
              borderRadius: "8px",
              color: C.textActive,
              fontSize: 12.5,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,227,163,0.4)" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: C.activeBorder },
              "& .MuiSvgIcon-root": { color: C.textMuted },
            }}
          >
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode} sx={{ fontSize: 13 }}>
                {t(b.branchCode)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={<Refresh sx={{ fontSize: "14px !important" }} />}
          onClick={handleRefresh}
          sx={{
            mt: 1,
            width: "100%",
            fontSize: 11.5,
            color: C.textMuted,
            bgcolor: "rgba(255,255,255,0.04)",
            borderRadius: "8px",
            py: 0.5,
            textTransform: "none",
            letterSpacing: "0.2px",
            border: `1px solid ${C.divider}`,
            "&:hover": { bgcolor: C.hover, color: C.text, borderColor: "rgba(255,255,255,0.15)" },
          }}
        >
          {allowedMenuNames === null && menuFetchTrigger > 0 ? t("Refreshing…") : t("Refresh Cache")}
        </Button>
      </Box>

      {/* ── Scrollable menu ────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          pt: 0.5,
          pb: 1,
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.12)", borderRadius: 4 },
        }}
      >
        <List disablePadding>
          {menuItems.map((item, idx) => {
            // When role-menu assignments are active, they are the sole visibility source.
            // Fall back to hardcoded role arrays only when no assignments are configured.
            const usingAssignments = allowedMenuNames !== null && allowedMenuNames.size > 0;
            if (!isSystemAdmin && !usingAssignments && !item.roles.some((r) => roles.includes(r))) return null;

            if (item.hasSubmenu) {
              const isOpen = !!openMenus[idx];
              const hasActive = item.submenu?.some((s) => isActive(s.link));
              const visibleSubs = item.submenu.filter((s) =>
                (isSystemAdmin || usingAssignments || s.roles.some((r) => roles.includes(r))) && isMenuAllowed(s.menuKey)
              );
              if (visibleSubs.length === 0) return null;

              return (
                <React.Fragment key={idx}>
                  <ListItemButton
                    onClick={() => toggleMenu(idx)}
                    sx={parentButtonSx(isOpen, hasActive)}
                  >
                    <ListItemIcon>{ic(item.icon)}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isOpen ? (
                      <ExpandLess sx={{ fontSize: 16, color: C.textMuted }} />
                    ) : (
                      <ExpandMore sx={{ fontSize: 16, color: C.textMuted }} />
                    )}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <Box
                      sx={{
                        ml: "35px",
                        borderLeft: `1px solid ${C.subLine}`,
                      }}
                    >
                      {visibleSubs.map((sub, sIdx) => (
                        <ListItemButton
                          key={sIdx}
                          component={Link}
                          to={sub.link}
                          onClick={handleNavClick}
                          sx={subItemButtonSx(sub.link)}
                        >
                          <ListItemText primary={sub.label} />
                        </ListItemButton>
                      ))}
                    </Box>
                  </Collapse>
                </React.Fragment>
              );
            }

            if (!isMenuAllowed(item.menuKey)) return null;
            return (
              <ListItemButton
                key={idx}
                component={Link}
                to={item.link}
                onClick={handleNavClick}
                sx={itemButtonSx(item.link)}
              >
                <ListItemIcon>{ic(item.icon)}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${C.divider}`,
          px: 1,
          pt: 0.75,
          pb: 1,
        }}
      >
        {/* Dark mode toggle */}
        <ListItemButton
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            mb: 0.5,
            "& .MuiListItemText-primary": { fontSize: 13, color: C.textMuted },
            "&:hover": { bgcolor: C.hover, "& .MuiListItemText-primary": { color: C.text } },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <ModeNightRounded sx={{ fontSize: 18, color: C.icon }} />
          </ListItemIcon>
          <ListItemText primary={t("Dark Mode")} />
          <Switch
            size="small"
            checked={mode === "dark"}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: C.activeBorder },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                bgcolor: "rgba(255,227,163,0.4)",
              },
            }}
          />
        </ListItemButton>

        {/* Change Password */}
        <ListItemButton
          onClick={openPwDialog}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            mb: 0.5,
            "& .MuiListItemText-primary": { fontSize: 13, color: C.textMuted },
            "&:hover": { bgcolor: C.hover, "& .MuiListItemText-primary": { color: C.text } },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <LockReset sx={{ fontSize: 18, color: C.icon }} />
          </ListItemIcon>
          <ListItemText primary={t("Change Password")} />
        </ListItemButton>

        {/* Logout */}
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            "& .MuiListItemText-primary": { fontSize: 13, color: "rgba(255,100,100,0.75)" },
            "&:hover": {
              bgcolor: "rgba(255,80,80,0.08)",
              "& .MuiListItemText-primary": { color: "#ff6b6b" },
              "& .MuiListItemIcon-root": { color: "#ff6b6b" },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <ExitToApp sx={{ fontSize: 18, color: "rgba(255,100,100,0.6)" }} />
          </ListItemIcon>
          <ListItemText primary={t("Logout")} />
        </ListItemButton>
      </Box>
    </Box>
  );

  /* ── Change Password Dialog ─────────────────────────────────────────── */
  const pwDialog = (
    <Dialog open={pwOpen} onClose={() => !pwLoading && setPwOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Change Password</DialogTitle>
      <DialogContent>
        {pwError   && <Alert severity="error"   sx={{ mb: 1.5 }}>{pwError}</Alert>}
        {pwSuccess && <Alert severity="success" sx={{ mb: 1.5 }}>{pwSuccess}</Alert>}
        <TextField
          label="Current Password" type="password" fullWidth margin="dense"
          value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
        <TextField
          label="New Password" type="password" fullWidth margin="dense"
          value={pwNew} onChange={(e) => setPwNew(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
        <TextField
          label="Confirm New Password" type="password" fullWidth margin="dense"
          value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPwOpen(false)} disabled={pwLoading}>Cancel</Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          disabled={pwLoading || !!pwSuccess || !pwCurrent || !pwNew || !pwConfirm}
        >
          {pwLoading ? "Saving…" : "Change Password"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: "none", bgcolor: C.bg },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            border: "none",
            bgcolor: C.bg,
            boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {pwDialog}
    </Box>
  );
};

export default Sidebar;
