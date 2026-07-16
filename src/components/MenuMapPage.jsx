import React, { useState, useMemo } from "react";
import {
  Box, Typography, TextField, InputAdornment, Chip, Paper, Grid,
} from "@mui/material";
import {
  Search as SearchIcon,
  Dashboard, AutoGraph, PlaylistAddCheck, Receipt, ShoppingCart,
  Category, AddBusiness, Scale, Loyalty, Tune, Assessment, Analytics,
  AccountBalance, Build, HelpOutline, Map,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const SECTIONS = [
  {
    key: "dashboard",
    title: "Dashboard & Intelligence",
    icon: <Dashboard />,
    color: "#1565C0",
    items: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "AI Stock Intelligence", path: "/ai-dashboard" },
      { label: "Menu Map", path: "/menu-map" },
      { label: "My Tasks", path: "/my-tasks" },
    ],
  },
  {
    key: "setup",
    title: "Setup & Administration",
    icon: <PlaylistAddCheck />,
    color: "#4A148C",
    items: [
      { label: "Create Menus", path: "/menu-master" },
      { label: "Create Roles", path: "/role-management" },
      { label: "Assign Menus to Roles", path: "/role-menu" },
      { label: "Create Branches", path: "/branchcreationpage" },
      { label: "Create Users", path: "/usercreationpage" },
      { label: "Assign Branches & Roles", path: "/branchassingment" },
      { label: "Transfer Branch Permissions", path: "/branch-transfer-assignment" },
      { label: "Branch Day End Settings", path: "/branch-day-end-settings" },
      { label: "Clear Day End", path: "/day-end-clear" },
      { label: "Version Management", path: "/version-management" },
      { label: "Admin Page", path: "/branch-request-list" },
      { label: "Reprocess Voucher", path: "/reprocess-voucher-form" },
    ],
  },
  {
    key: "sales",
    title: "Sales",
    icon: <Receipt />,
    color: "#C62828",
    items: [
      { label: "POS", path: "/pos" },
      { label: "KOT", path: "/kot" },
      { label: "Sales Entry", path: "/salesentryform" },
    ],
  },
  {
    key: "purchase",
    title: "Purchase",
    icon: <ShoppingCart />,
    color: "#BF360C",
    items: [
      { label: "Purchase Entry", path: "/purchaseentry" },
      { label: "Goods Receipt", path: "/goodsreceipt" },
      { label: "Purchase Correction", path: "/purchase-correction" },
      { label: "Purchase Correction Approval", path: "/purchase-correction-approval" },
      { label: "Purchase Correction History", path: "/purchase-correction-history" },
    ],
  },
  {
    key: "production",
    title: "Production",
    icon: <Category />,
    color: "#1B5E20",
    items: [
      { label: "Production Definition", path: "/production-def" },
      { label: "Production Planning", path: "/production-planning" },
      { label: "Production Execution", path: "/production-execution" },
    ],
  },
  {
    key: "stock",
    title: "Stock Operations",
    icon: <AddBusiness />,
    color: "#006064",
    items: [
      { label: "Physical Stock Correction", path: "/physical-stock-correction" },
    ],
  },
  {
    key: "weighbridge",
    title: "Weighbridge",
    icon: <Scale />,
    color: "#37474F",
    items: [
      { label: "Weighbridge Entry", path: "/weighbridge" },
      { label: "Weight-Count", path: "/bridge-count" },
      { label: "WeighBridge Usage Report", path: "/weighbridgeusage" },
    ],
  },
  {
    key: "scheme",
    title: "Schemes & Promotions",
    icon: <Loyalty />,
    color: "#880E4F",
    items: [
      { label: "Scheme Creation", path: "/schemepage" },
      { label: "Manage Scheme", path: "/publishschemepage" },
    ],
  },
  {
    key: "masters",
    title: "Masters",
    icon: <Tune />,
    color: "#004D40",
    items: [
      { label: "Branch Details", path: "/branch-update" },
      { label: "Item Cost Override", path: "/item-cost-override" },
      { label: "Receipt Modes", path: "/receipt-modes" },
      { label: "Item Search", path: "/itemsearch" },
      { label: "Item Creation", path: "/createitemmaster" },
      { label: "Branch Price", path: "/branch-price" },
      { label: "Stock Transfer Discount", path: "/stock-transfer-discount" },
      { label: "Price Edit Category Wise", path: "/category-price-edit" },
      { label: "Category Type", path: "/categorytypemaster" },
      { label: "Category Name", path: "/categorynamemaster" },
      { label: "Category Link", path: "/item-category-linker" },
      { label: "Report Exclusions", path: "/report-exclusions" },
      { label: "Tax Update Manager", path: "/tax-update-manager" },
      { label: "Tax Update Preview", path: "/tax-update-preview" },
      { label: "Supplier Creation", path: "/suppliercreation" },
    ],
  },
  {
    key: "sales_reports",
    title: "Sales Reports",
    icon: <Assessment />,
    color: "#AD1457",
    items: [
      { label: "Sales Report", path: "/sales" },
      { label: "Sales Re Print", path: "/salessummaryreport" },
      { label: "Sales Tax Summary", path: "/salestaxsummary" },
      { label: "HSN wise Sales", path: "/hsnsales" },
      { label: "HSN Sales Summary", path: "/hsn-sales-summary" },
      { label: "All Branch Sales Report", path: "/sales-report-all-branch" },
      { label: "All Branch Categorywise Sales", path: "/sales-category-wise-report-all-branch" },
      { label: "Season Sales Report", path: "/seasonalreport" },
      { label: "Salesman Report", path: "/salesman-report" },
      { label: "Branch Profit Report", path: "/branch-profit-report" },
      { label: "Monthly Branch Profit Report", path: "/monthly-branch-profit-report" },
    ],
  },
  {
    key: "purchase_reports",
    title: "Purchase Reports",
    icon: <Assessment />,
    color: "#E65100",
    items: [
      { label: "Purchase Report", path: "/purchasereport" },
      { label: "HSN wise Purchase", path: "/hsnwise-purchase-report" },
    ],
  },
  {
    key: "stock_reports",
    title: "Stock & Inventory Reports",
    icon: <Assessment />,
    color: "#0277BD",
    items: [
      { label: "Item Stock Report", path: "/item-stock-report" },
      { label: "All Branch Stock Report", path: "/stock-report-all-branch" },
      { label: "Branch Stock Report", path: "/branch-stock-view" },
      { label: "Branch Stock Management", path: "/branch-stock-report" },
      { label: "Branch Inventory Report", path: "/branch-inventory" },
      { label: "Branch Inventory Ledger", path: "/branch-inventory-ledger" },
      { label: "Stock Movement Report", path: "/stockmovementreport" },
      { label: "Physical Stock Report", path: "/physicalstockreport" },
      { label: "Stock Turnover Report", path: "/stock-turnover" },
      { label: "Stock Anomaly Report", path: "/stock-anomaly-report" },
    ],
  },
  {
    key: "item_reports",
    title: "Item Analysis Reports",
    icon: <Analytics />,
    color: "#2E7D32",
    items: [
      { label: "Item Sales Report", path: "/item-sales" },
      { label: "Item Movement Report", path: "/item-movement-report" },
      { label: "Item Velocity Report", path: "/item-velocity-report" },
      { label: "Item Transfer Report", path: "/item-transfer-report" },
      { label: "Category Item Report", path: "/category-item-report" },
      { label: "Stock Transfer In Report", path: "/stocktransfer-in-report" },
      { label: "Stock Transfer Out Report", path: "/stocktransfer-out-report" },
      { label: "Production Planning Report", path: "/production-planning-report" },
      { label: "Production Execution Report", path: "/production-execution-report" },
    ],
  },
  {
    key: "ops_reports",
    title: "Operations Reports",
    icon: <Assessment />,
    color: "#4527A0",
    items: [
      { label: "Day End Report", path: "/day-end-report" },
      { label: "Bill Series Report", path: "/billseriesreport" },
      { label: "Documents List", path: "/documents-list" },
    ],
  },
  {
    key: "accounting_setup",
    title: "Accounting Setup",
    icon: <AccountBalance />,
    color: "#0D47A1",
    items: [
      { label: "Accounting Setup",       path: "/accounting/setup" },
      { label: "Ledger Accounts",        path: "/accounting/ledger-accounts" },
      { label: "Expense Head Management",path: "/expense-head-management" },
      { label: "Financial Year Setup",   path: "/financialyearpage" },
    ],
  },
  {
    key: "accounting_txn",
    title: "Accounting Transactions",
    icon: <AccountBalance />,
    color: "#1565C0",
    items: [
      { label: "Receipt Entry",          path: "/accounting/receipt-entry" },
      { label: "Payment Entry",          path: "/accounting/payment-entry" },
      { label: "Branch Monthly Expense", path: "/branch-monthly-expense" },
      { label: "Inter-Branch Transfer",  path: "/accounting/inter-branch-transfer" },
    ],
  },
  {
    key: "accounting_reports",
    title: "Accounting Reports",
    icon: <AccountBalance />,
    color: "#1976D2",
    items: [
      { label: "Trial Balance",          path: "/accounting/trial-balance" },
      { label: "Ledger Statement",       path: "/accounting/ledger-statement" },
      { label: "Profit & Loss",          path: "/accounting/profit-loss" },
      { label: "Balance Sheet",          path: "/accounting/balance-sheet" },
      { label: "Cash Flow",              path: "/accounting/cash-flow" },
      { label: "Customer Statement",     path: "/accounting/customer-statement" },
      { label: "Supplier Statement",     path: "/accounting/supplier-statement" },
      { label: "Customer Aging",         path: "/accounting/customer-aging" },
      { label: "Supplier Aging",         path: "/accounting/supplier-aging" },
      { label: "Bank Reconciliation",    path: "/accounting/bank-reconciliation" },
      { label: "Inventory Ledger",       path: "/accounting/inventory-ledger" },
      { label: "Stock Valuation",        path: "/accounting/stock-valuation" },
      { label: "Period Closing",         path: "/accounting/period-closing" },
      { label: "Budget Manager",         path: "/accounting/budget-manager" },
      { label: "Budget vs Actual",       path: "/accounting/budget-vs-actual" },
    ],
  },
  {
    key: "tools",
    title: "Tools & Design",
    icon: <Build />,
    color: "#EF6C00",
    items: [
      { label: "Invoice Designer", path: "/invoicedesigner" },
      { label: "Workflow Designer", path: "/bpmn-editorr" },
      { label: "Download", path: "/download" },
      { label: "Upload", path: "/uploadpage" },
    ],
  },
  {
    key: "support",
    title: "Support & Legal",
    icon: <HelpOutline />,
    color: "#33691E",
    items: [
      { label: "Help", path: "/help" },
      { label: "About", path: "/about" },
      { label: "Terms & Conditions", path: "/terms-and-conditions" },
      { label: "Privacy Policy", path: "/privacy-policy" },
      { label: "Refund Policy", path: "/refund-policy" },
    ],
  },
];

const MenuMapPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return SECTIONS;
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => it.label.toLowerCase().includes(q)),
    })).filter((sec) =>
      sec.title.toLowerCase().includes(q) || sec.items.length > 0
    );
  }, [q]);

  const totalItems = SECTIONS.reduce((s, sec) => s + sec.items.length, 0);
  const matchCount = q ? filtered.reduce((s, sec) => s + sec.items.length, 0) : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2,
              background: "linear-gradient(135deg, #1565C0 0%, #4A148C 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(21,101,192,0.4)",
            }}
          >
            <Map sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary", letterSpacing: "-0.5px" }}>
            Application Menu Map
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          {totalItems} features across {SECTIONS.length} sections — click any item to navigate
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ maxWidth: 540, mx: "auto", mb: 3.5 }}>
        <TextField
          fullWidth
          size="medium"
          placeholder="Search any feature…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#1565C0" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              fontSize: "1rem",
              bgcolor: "background.paper",
              color: "text.primary",
              boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              "& fieldset": { borderColor: "divider" },
              "&:hover fieldset": { borderColor: "#1565C0" },
              "&.Mui-focused fieldset": { borderColor: "#1565C0", borderWidth: 2 },
            },
            "& .MuiInputBase-input": { color: "inherit" },
          }}
        />
        {matchCount !== null && (
          <Typography variant="caption" sx={{ mt: 0.75, display: "block", textAlign: "center", color: "text.secondary" }}>
            {matchCount === 0
              ? "No matches found"
              : `${matchCount} match${matchCount !== 1 ? "es" : ""} found`}
          </Typography>
        )}
      </Box>

      {/* Sections Grid */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "#bbb" }}>
          <SearchIcon sx={{ fontSize: 52, mb: 1.5 }} />
          <Typography variant="h6" sx={{ color: "#aaa" }}>No features match &ldquo;{query}&rdquo;</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((sec) => (
            <Grid item xs={12} sm={6} md={4} key={sec.key}>
              <Paper
                elevation={0}
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "all 0.2s ease",
                  "&:hover": {
                    boxShadow: `0 8px 28px ${sec.color}30`,
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {/* Solid coloured header */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    background: `linear-gradient(135deg, ${sec.color} 0%, ${sec.color}CC 100%)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                  }}
                >
                  <Box sx={{ color: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                    {React.cloneElement(sec.icon, { fontSize: "small" })}
                  </Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ color: "#fff", fontSize: "0.83rem", letterSpacing: "0.2px", flexGrow: 1 }}
                  >
                    {sec.title}
                  </Typography>
                  <Box
                    sx={{
                      minWidth: 22, height: 22, borderRadius: "50%",
                      bgcolor: "rgba(255,255,255,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                      {sec.items.length}
                    </Typography>
                  </Box>
                </Box>

                {/* Items */}
                <Box sx={{ p: 1.75, display: "flex", flexWrap: "wrap", gap: 0.8, bgcolor: "background.paper" }}>
                  {sec.items.map((item) => {
                    const isMatch = q && item.label.toLowerCase().includes(q);
                    return (
                      <Chip
                        key={item.path}
                        label={item.label}
                        size="small"
                        onClick={() => navigate(item.path)}
                        sx={{
                          fontSize: "0.74rem",
                          height: 27,
                          cursor: "pointer",
                          bgcolor: isMatch ? sec.color : "action.hover",
                          color: isMatch ? "#fff" : "text.primary",
                          border: `1.5px solid ${isMatch ? sec.color : "transparent"}`,
                          borderColor: isMatch ? sec.color : "divider",
                          fontWeight: isMatch ? 700 : 500,
                          transition: "all 0.15s ease",
                          "&:hover": {
                            bgcolor: sec.color,
                            color: "#fff",
                            borderColor: sec.color,
                            transform: "translateY(-1px)",
                            boxShadow: `0 4px 10px ${sec.color}50`,
                          },
                          "& .MuiChip-label": { px: 1.25 },
                        }}
                      />
                    );
                  })}
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default MenuMapPage;
