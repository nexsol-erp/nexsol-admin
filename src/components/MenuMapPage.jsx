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
    color: "#1565c0",
    bg: "#e3f2fd",
    items: [
      { label: "Dashboard", path: "/dashboard" },
      { label: "AI Stock Intelligence", path: "/ai-dashboard" },
      { label: "Menu Map", path: "/menu-map" },
    ],
  },
  {
    key: "setup",
    title: "Setup & Administration",
    icon: <PlaylistAddCheck />,
    color: "#6a1b9a",
    bg: "#f3e5f5",
    items: [
      { label: "Create Menus", path: "/menu-master" },
      { label: "Create Roles", path: "/role-management" },
      { label: "Assign Menus to Roles", path: "/role-menu" },
      { label: "Create Branches", path: "/branchcreationpage" },
      { label: "Create Users", path: "/usercreationpage" },
      { label: "Assign Branches & Roles", path: "/branchassingment" },
      { label: "Transfer Branch Permissions", path: "/branch-transfer-assignment" },
      { label: "Branch Details", path: "/branch-update" },
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
    color: "#b71c1c",
    bg: "#ffebee",
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
    color: "#e65100",
    bg: "#fff3e0",
    items: [
      { label: "Purchase Entry", path: "/purchaseentry" },
      { label: "Goods Receipt", path: "/goodsreceipt" },
    ],
  },
  {
    key: "production",
    title: "Production",
    icon: <Category />,
    color: "#2e7d32",
    bg: "#e8f5e9",
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
    color: "#1565c0",
    bg: "#e8eaf6",
    items: [
      { label: "Physical Stock Correction", path: "/physical-stock-correction" },
    ],
  },
  {
    key: "weighbridge",
    title: "Weighbridge",
    icon: <Scale />,
    color: "#37474f",
    bg: "#eceff1",
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
    color: "#7b1fa2",
    bg: "#fce4ec",
    items: [
      { label: "Scheme Creation", path: "/schemepage" },
      { label: "Manage Scheme", path: "/publishschemepage" },
    ],
  },
  {
    key: "masters",
    title: "Masters",
    icon: <Tune />,
    color: "#004d40",
    bg: "#e0f2f1",
    items: [
      { label: "Financial Year Setup", path: "/financialyearpage" },
      { label: "Receipt Modes", path: "/receipt-modes" },
      { label: "UPI Payment Setup", path: "/upi-config" },
      { label: "Item Search", path: "/itemsearch" },
      { label: "Item Creation", path: "/createitemmaster" },
      { label: "Branch Price", path: "/branch-price" },
      { label: "Price Edit Category Wise", path: "/category-price-edit" },
      { label: "Category Type", path: "/categorytypemaster" },
      { label: "Category Name", path: "/categorynamemaster" },
      { label: "Category Link", path: "/item-category-linker" },
      { label: "Tax Update Manager", path: "/tax-update-manager" },
      { label: "Tax Update Preview", path: "/tax-update-preview" },
      { label: "Supplier Creation", path: "/suppliercreation" },
      { label: "Manage Account Heads", path: "/manage-account-heads" },
      { label: "Statement Of Account", path: "/statement-of-account" },
    ],
  },
  {
    key: "sales_reports",
    title: "Sales Reports",
    icon: <Assessment />,
    color: "#880e4f",
    bg: "#fce4ec",
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
    ],
  },
  {
    key: "purchase_reports",
    title: "Purchase Reports",
    icon: <Assessment />,
    color: "#bf360c",
    bg: "#fbe9e7",
    items: [
      { label: "Purchase Report", path: "/purchasereport" },
      { label: "HSN wise Purchase", path: "/hsnwise-purchase-report" },
    ],
  },
  {
    key: "stock_reports",
    title: "Stock & Inventory Reports",
    icon: <Assessment />,
    color: "#0277bd",
    bg: "#e1f5fe",
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
    ],
  },
  {
    key: "item_reports",
    title: "Item Analysis Reports",
    icon: <Analytics />,
    color: "#00695c",
    bg: "#e0f2f1",
    items: [
      { label: "Item Sales Report", path: "/item-sales" },
      { label: "Item Movement Report", path: "/item-movement-report" },
      { label: "Item Velocity Report", path: "/item-velocity-report" },
      { label: "Item Transfer Report", path: "/item-transfer-report" },
      { label: "Category Item Report", path: "/category-item-report" },
      { label: "Stock Transfer In Report", path: "/stocktransfer-in-report" },
      { label: "Stock Transfer Out Report", path: "/stocktransfer-out-report" },
    ],
  },
  {
    key: "ops_reports",
    title: "Operations Reports",
    icon: <Assessment />,
    color: "#4527a0",
    bg: "#ede7f6",
    items: [
      { label: "Day End Report", path: "/day-end-report" },
      { label: "Bill Series Report", path: "/billseriesreport" },
      { label: "Documents List", path: "/documents-list" },
    ],
  },
  {
    key: "accounting",
    title: "Accounting",
    icon: <AccountBalance />,
    color: "#1a237e",
    bg: "#e8eaf6",
    items: [
      { label: "Receipt Entry", path: "/accounting/receipt-entry" },
      { label: "Payment Entry", path: "/accounting/payment-entry" },
      { label: "Trial Balance", path: "/accounting/trial-balance" },
      { label: "Ledger Statement", path: "/accounting/ledger-statement" },
      { label: "Customer Statement", path: "/accounting/customer-statement" },
      { label: "Supplier Statement", path: "/accounting/supplier-statement" },
      { label: "Profit & Loss", path: "/accounting/profit-loss" },
      { label: "Balance Sheet", path: "/accounting/balance-sheet" },
      { label: "Cash Flow", path: "/accounting/cash-flow" },
      { label: "Bank Reconciliation", path: "/accounting/bank-reconciliation" },
      { label: "Inventory Ledger", path: "/accounting/inventory-ledger" },
      { label: "Stock Valuation", path: "/accounting/stock-valuation" },
      { label: "Customer Aging", path: "/accounting/customer-aging" },
      { label: "Supplier Aging", path: "/accounting/supplier-aging" },
      { label: "Inter-Branch Transfer", path: "/accounting/inter-branch-transfer" },
      { label: "Period Closing", path: "/accounting/period-closing" },
      { label: "Budget Manager", path: "/accounting/budget-manager" },
      { label: "Budget vs Actual", path: "/accounting/budget-vs-actual" },
    ],
  },
  {
    key: "tools",
    title: "Tools & Design",
    icon: <Build />,
    color: "#4e342e",
    bg: "#efebe9",
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
    color: "#558b2f",
    bg: "#f1f8e9",
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
  const matchCount = q
    ? filtered.reduce((s, sec) => s + sec.items.length, 0)
    : null;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 0.5 }}>
          <Map sx={{ color: "#1565c0", fontSize: 30 }} />
          <Typography variant="h4" fontWeight={700} color="text.primary">
            Application Menu Map
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {totalItems} features across {SECTIONS.length} sections — click any item to navigate
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ maxWidth: 520, mx: "auto", mb: 3 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search any feature…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "text.secondary" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              fontSize: "0.95rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            },
          }}
        />
        {matchCount !== null && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", textAlign: "center" }}>
            {matchCount === 0
              ? "No matches found"
              : `${matchCount} match${matchCount !== 1 ? "es" : ""} found`}
          </Typography>
        )}
      </Box>

      {/* Sections Grid */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
          <SearchIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography>No features match "{query}"</Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((sec) => (
            <Grid item xs={12} sm={6} md={4} key={sec.key}>
              <Paper
                elevation={0}
                variant="outlined"
                sx={{
                  height: "100%",
                  borderRadius: 2,
                  overflow: "hidden",
                  borderColor: `${sec.color}30`,
                  transition: "box-shadow 0.2s",
                  "&:hover": { boxShadow: `0 4px 16px ${sec.color}22` },
                }}
              >
                {/* Card Header */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.2,
                    background: `linear-gradient(135deg, ${sec.color}18 0%, ${sec.color}08 100%)`,
                    borderBottom: `2px solid ${sec.color}30`,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <Box sx={{ color: sec.color, display: "flex", alignItems: "center" }}>
                    {React.cloneElement(sec.icon, { fontSize: "small" })}
                  </Box>
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    sx={{ color: sec.color, fontSize: "0.82rem", letterSpacing: "0.3px" }}
                  >
                    {sec.title}
                  </Typography>
                  <Chip
                    label={sec.items.length}
                    size="small"
                    sx={{
                      ml: "auto",
                      height: 18,
                      fontSize: "0.68rem",
                      bgcolor: `${sec.color}18`,
                      color: sec.color,
                      fontWeight: 700,
                      "& .MuiChip-label": { px: 0.8 },
                    }}
                  />
                </Box>

                {/* Items */}
                <Box sx={{ p: 1.5, display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {sec.items.map((item) => {
                    const isMatch = q && item.label.toLowerCase().includes(q);
                    return (
                      <Chip
                        key={item.path}
                        label={item.label}
                        size="small"
                        onClick={() => navigate(item.path)}
                        sx={{
                          fontSize: "0.75rem",
                          height: 26,
                          cursor: "pointer",
                          bgcolor: isMatch ? sec.color : "transparent",
                          color: isMatch ? "#fff" : "text.primary",
                          border: `1px solid ${isMatch ? sec.color : "#e0e0e0"}`,
                          fontWeight: isMatch ? 700 : 400,
                          transition: "all 0.15s",
                          "&:hover": {
                            bgcolor: sec.color,
                            color: "#fff",
                            borderColor: sec.color,
                            transform: "translateY(-1px)",
                            boxShadow: `0 3px 8px ${sec.color}44`,
                          },
                          "& .MuiChip-label": { px: 1 },
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
