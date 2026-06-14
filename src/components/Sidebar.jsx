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
} from "@mui/icons-material";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

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

  const [openMenus, setOpenMenus] = useState({});
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  // null = not yet loaded; empty Set = loaded but no assignments (show all)
  const [allowedMenuNames, setAllowedMenuNames] = useState(null);
  const [menuFetchTrigger, setMenuFetchTrigger] = useState(0);

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch branches");
      const data = await response.json();
      const list = Array.isArray(data) ? data : data.branches || data.data || [];
      const filtered = allowedBranches.length
        ? list.filter((b) => allowedBranches.includes(b.branchCode))
        : [];
      setBranches(filtered);
      if (!branch && filtered.length === 1) setBranch(filtered[0].branchCode);
      if (branch && !filtered.some((b) => b.branchCode === branch)) setBranch("");
    } catch (e) {
      console.error("Error fetching branches:", e);
      setBranches([]);
      setBranch("");
    }
  };

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
    localStorage.setItem("branchCode", e.target.value);
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

  const toggleMenu = (idx) =>
    setOpenMenus((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleNavClick = () => setMobileOpen(false);

  const isActive = (link) => !!link && location.pathname === link;

  const menuItems = [
    {
      menuKey: "Dashboard",
      label: t("Dashboard"),
      icon: <Dashboard />,
      link: "/dashboard",
      roles: ["admin",  "manager"],
    },
    {
      menuKey: "Initial Setup",
      label: t("Initial Setup"),
      icon: <PlaylistAddCheck />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Menu Master",     label: t("1. Create Menus"),              link: "/menu-master",         roles: ["admin"] },
        { menuKey: "Role Management", label: t("2. Create Roles"),              link: "/role-management",     roles: ["admin"] },
        { menuKey: "Role Menu Access",label: t("3. Assign Menus to Roles"),     link: "/role-menu",           roles: ["admin"] },
        { menuKey: "Branch Creation", label: t("4. Create Branches"),           link: "/branchcreationpage",  roles: ["admin"] },
        { menuKey: "User Creation",   label: t("5. Create Users"),              link: "/usercreationpage",    roles: ["admin"] },
        { menuKey: "Branch Assignment",label: t("6. Assign Branches & Roles"), link: "/branchassingment",    roles: ["admin"] },
        { menuKey: "Transfer Branch Permissions", label: t("7. Transfer Branch Permissions"), link: "/branch-transfer-assignment", roles: ["admin"] },
      ],
    },
    {
      menuKey: "AI Stock Intelligence",
      label: t("AI Stock Intelligence"),
      icon: <AutoGraph />,
      link: "/ai-dashboard",
      roles: ["admin", "manager"],
    },
    {
      menuKey: "Admin Page",
      label: t("Admin Page"),
      icon: <AdminPanelSettings />,
      link: "/branch-request-list",
      roles: ["admin", "WB"],
    },
    {
      menuKey: "Reprocess Voucher",
      label: t("Reprocess Voucher"),
      icon: <Replay />,
      link: "/reprocess-voucher-form",
      roles: ["admin", "WB"],
    },
    {
      menuKey: "POS",
      label: t("POS"),
      icon: <PointOfSale />,
      link: "/pos",
      roles: ["admin", "user"],
    },
    {
      menuKey: "KOT",
      label: t("KOT"),
      icon: <RestaurantMenu />,
      link: "/kot",
      roles: ["admin", "user"],
    },
    {
      menuKey: "Sales Entry",
      label: t("Sales Entry"),
      icon: <Receipt />,
      link: "/salesentryform",
      roles: ["admin"],
    },
    {
      menuKey: "HSN wise Sales",
      label: t("HSN wise Sales"),
      icon: <Pages />,
      link: "/hsnsales",
      roles: ["admin", "franchiseeuser", "user"],
    },
    {
      menuKey: "HSN wise Purchase",
      label: t("HSN wise Purchase"),
      icon: <Pages />,
      link: "/hsnwise-purchase-report",
      roles: ["admin", "user"],
    },
    {
      menuKey: "Purchase",
      label: t("Purchase"),
      icon: <ShoppingCart />,
      link: "",
      roles: ["admin", "manager"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Purchase Entry", label: t("Purchase Entry"), link: "/purchaseentry", roles: ["user", "manager", "admin"] },
        { menuKey: "Goods Receipt", label: t("Goods Receipt"), link: "/goodsreceipt", roles: ["user", "manager", "admin"] },
      ],
    },
    {
      menuKey: "Production",
      label: t("Production"),
      icon: <Category />,
      link: "",
      roles: ["admin", "manager", "user"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Production Def", label: t("Production Def"), link: "/production-def", roles: ["admin", "manager", "user"] },
        { menuKey: "Production Planning", label: t("Production Planning"), link: "/production-planning", roles: ["admin", "manager", "user"] },
        { menuKey: "Production Execution", label: t("Production Execution"), link: "/production-execution", roles: ["admin", "manager", "user"] },
      ],
    },
    {
      menuKey: "Weighbridge",
      label: t("Weighbridge"),
      icon: <Scale />,
      link: "/weighbridge",
      roles: ["WB"],
    },
    {
      menuKey: "Weight-Count",
      label: t("Weight-Count"),
      icon: <Speed />,
      link: "/bridge-count",
      roles: ["WB"],
    },
    {
      menuKey: "WeighBridge Usage",
      label: t("WeighBridge Usage"),
      icon: <Analytics />,
      link: "/weighbridgeusage",
      roles: ["WB"],
    },
    {
      menuKey: "Branch Details",
      label: t("Branch Details"),
      icon: <Business />,
      link: "/branch-update",
      roles: ["admin"],
    },
    {
      menuKey: "Version Management",
      label: t("Version Management"),
      icon: <AdminPanelSettings />,
      link: "/version-management",
      roles: ["admin"],
    },
    {
      menuKey: "Scheme",
      label: t("Scheme"),
      icon: <Loyalty />,
      link: "",
      roles: ["admin"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Scheme Creation", label: t("Scheme Creation"), link: "/schemepage", roles: ["admin"] },
        { menuKey: "Manage Scheme", label: t("Manage Scheme"), link: "/publishschemepage", roles: ["admin"] },
      ],
    },
    {
      menuKey: "Masters",
      label: t("Masters"),
      icon: <Tune />,
      link: "",
      roles: ["admin", "user", "cgn", "franchiseeuser"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Financial Year Setup", label: t("Financial Year Setup"), link: "/financialyearpage", roles: ["admin", "franchiseeuser"] },
        { menuKey: "Receipt Modes", label: t("Receipt Modes"), link: "/receipt-modes", roles: ["admin"] },
        { menuKey: "UPI Payment Setup", label: t("UPI Payment Setup"), link: "/upi-config", roles: ["admin"] },
        { menuKey: "Item Search", label: t("Item Search"), link: "/itemsearch", roles: ["admin", "user", "cgn", "franchiseeuser"] },
        { menuKey: "Item Creation", label: t("Item Creation"), link: "/createitemmaster", roles: ["admin", "user"] },
        { menuKey: "Branch Price", label: t("Branch Price"), link: "/branch-price", roles: ["admin", "franchiseeuser"] },
        { menuKey: "Price Edit Category Wise", label: t("Price Edit Category Wise"), link: "/category-price-edit", roles: ["admin", "user"] },
        { menuKey: "Category Link", label: t("Category Link"), link: "/item-category-linker", roles: ["admin", "user"] },
        { menuKey: "Manage Account Heads", label: t("Manage Account Heads"), link: "/manage-account-heads", roles: ["admin", "user"] },
        { menuKey: "Statement Of Account", label: t("Statement Of Account"), link: "/statement-of-account", roles: ["admin", "user"] },
        { menuKey: "Category Type", label: t("Category Type"), link: "/categorytypemaster", roles: ["admin", "user"] },
        { menuKey: "Category Name", label: t("Category Name"), link: "/categorynamemaster", roles: ["admin", "user"] },
        { menuKey: "Supplier Creation", label: t("Supplier Creation"), link: "/suppliercreation", roles: ["admin", "user", "cgn"] },
        { menuKey: "Tax Update Manager", label: t("Tax Update Manager"), link: "/tax-update-manager", roles: ["admin", "user"] },
        { menuKey: "Tax Update Preview", label: t("Tax Update Preview"), link: "/tax-update-preview", roles: ["admin", "user"] },
        { menuKey: "Physical Stock Correction", label: t("Physical Stock Correction"), link: "/physical-stock-correction", roles: ["admin", "manager"] },
      ],
    },
    {
      menuKey: "Reports",
      label: t("Reports"),
      icon: <Assessment />,
      link: "",
      roles: ["admin", "manager", "cgn", "user", "franchiseeuser", "WB"],
      hasSubmenu: true,
      submenu: [
        { menuKey: "Sales Re Print", label: t("Sales  Re Print"), link: "/salessummaryreport", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Sales Report", label: t("Sales Report"), link: "/sales", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Sales Tax Summary", label: t("Sales Tax Summary"), link: "/salestaxsummary", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Purchase Report", label: t("Purchase Report"), link: "/purchasereport", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Stock Movement Report", label: t("Stock Movement Report"), link: "/stockmovementreport", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Item Movement Report", label: t("Item Movement Report"), link: "/item-movement-report", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Item Velocity Report", label: t("Item Velocity Report"), link: "/item-velocity-report", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "Physical Stock Report", label: t("Physical Stock Report"), link: "/physicalstockreport", roles: ["admin", "user", "manager", "franchiseeuser"] },
        { menuKey: "All Branch Stock Report", label: t("All Branch Stock Report"), link: "/stock-report-all-branch", roles: ["admin", "user", "manager", "cgn", "franchiseeuser"] },
        { menuKey: "Branch Stock Management", label: t("Branch Stock Management"), link: "/branch-stock-report", roles: ["admin"] },
        { menuKey: "All Branch Sales Report", label: t("All Branch Sales Report"), link: "/sales-report-all-branch", roles: ["admin", "user", "manager"] },
        { menuKey: "All Branch Categorywise Sales Report", label: t("All Branch Categorywise Sales Report"), link: "/sales-category-wise-report-all-branch", roles: ["admin", "user", "manager"] },
        { menuKey: "Item Stock Report", label: t("Item Stock Report"), link: "/item-stock-report", roles: ["admin", "user", "manager", "cgn"] },
        { menuKey: "Day End Report", label: t("Day End Report"), link: "/day-end-report", roles: ["admin", "manager"] },
        { menuKey: "Bill Series Report", label: t("Bill Series Report"), link: "/billseriesreport", roles: ["admin", "user", "manager"] },
        { menuKey: "Season Sales Report", label: t("Season Sales Report"), link: "/seasonalreport", roles: ["admin"] },
        { menuKey: "Stock Turnover Report", label: t("Stock Turnover Report"), link: "/stock-turnover", roles: ["user", "admin"] },
        { menuKey: "Item Sales Report", label: t("Item Sales Report"), link: "/item-sales", roles: ["user", "admin"] },
        { menuKey: "Documents List", label: t("Documents List"), link: "/documents-list", roles: ["user", "admin", "WB"] },
        { menuKey: "Branch Stock Diff Report", label: t("Branch Stock Diff Report"), link: "/branch-stock-diff-report", roles: ["admin", "franchiseeuser"] },
        { menuKey: "Branch Stock Report", label: t("Branch Stock Report"), link: "/branch-stock-view", roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Branch Inventory Report", label: t("Branch Inventory Report"), link: "/branch-inventory", roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Branch Inventory Ledger", label: t("Branch Inventory Ledger"), link: "/branch-inventory-ledger", roles: ["admin", "manager", "user", "franchiseeuser"] },
        { menuKey: "Stock Transfer Out Report", label: t("Stock Transfer Out Report"), link: "/stocktransfer-out-report", roles: ["admin", "franchiseeuser"] },
        { menuKey: "Stock Transfer In Report", label: t("Stock Transfer In Report"), link: "/stocktransfer-in-report", roles: ["admin", "franchiseeuser", "user"] },
        { menuKey: "Item Transfer Report", label: t("Item Transfer Report"), link: "/item-transfer-report", roles: ["admin", "manager", "user", "franchiseeuser"] },
      ],
    },
    {
      menuKey: "Download",
      label: t("Download"),
      icon: <CloudDownload />,
      link: "/download",
      roles: ["user", "manager", "admin", "WB"],
    },
    {
      menuKey: "Upload",
      label: t("Upload"),
      icon: <CloudUpload />,
      link: "/uploadpage",
      roles: ["admin"],
    },
    {
      menuKey: "Invoice Designer",
      label: t("Invoice Designer"),
      icon: <Description />,
      link: "/invoicedesigner",
      roles: ["user", "admin", "manager"],
    },
    {
      menuKey: "Workflow Designer",
      label: t("Workflow Designer"),
      icon: <AccountTree />,
      link: "/bpmn-editorr",
      roles: ["user", "admin", "manager"],
    },
    {
      menuKey: "About",
      label: t("About"),
      icon: <Info />,
      link: "/about",
      roles: ["manager"],
    },
    {
      menuKey: "Help",
      label: t("Help"),
      icon: <HelpOutline />,
      link: "/help",
      roles: ["user", "admin", "manager"],
    },
    {
      menuKey: "Terms & Conditions",
      label: t("Terms & Conditions"),
      icon: <Description />,
      link: "/terms-and-conditions",
      roles: ["user", "admin", "manager"],
    },
    {
      menuKey: "Privacy Policy",
      label: t("Privacy Policy"),
      icon: <Description />,
      link: "/privacy-policy",
      roles: ["user", "admin", "manager"],
    },
    {
      menuKey: "Refund Policy",
      label: t("Refund Policy"),
      icon: <Description />,
      link: "/refund-policy",
      roles: ["user", "admin", "manager"],
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
    </Box>
  );
};

export default Sidebar;
