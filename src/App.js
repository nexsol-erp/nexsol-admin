import React, { useState, useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress, AppBar, Toolbar, IconButton, Typography } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

// Components
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import SalesDetail from "./components/SalesDetail";
import PurchaseDetail from "./components/PurchaseDetail";
import About from "./components/About";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { WebSocketProvider } from "./components/WebSocketContext";
import DownloadPage from "./components/DownloadPage";
import HelpPage from "./components/HelpPage";
import WeighBridge from "./components/WeighBridge";
import HSNSalesDetail from "./components/HSNWiseSalesDetail";
import BranchCreationPage from "./components/BranchCreationPage";
import BranchUpdatePage from "./components/BranchUpdatePage";
import BranchDayEndSettingsPage from "./components/BranchDayEndSettingsPage";
import DayEndClearPage from "./components/DayEndClearPage";
import UserCreationPage from "./components/UserCreationPage";
import SchemePage from "./components/SchemePage";
import PublishSchemePage from "./components/PublishSchemePage";
import SeasonalReport from "./components/SeasonalReport";
import CategoryTypeMaster from "./components/CategoryTypeMaster";
import CategoryNameMaster from "./components/CategoryNameMaster";
import SupplierCreationForm from "./components/SupplierCreationForm";
import PurchaseEntryForm from "./components/PurchaseEntryForm";
import SalesEntryForm from "./components/SalesEntryForm";
import StockMovementReport from "./components/StockMovementReport";
import ItemMovementReport from "./components/ItemMovementReport";
import ItemVelocityReport from "./components/ItemVelocityReport";
import BillSeriesReport from "./components/BillSeriesReport";
import UploadPage from "./components/UploadPage";
import Invoicedesigner from "./components/InvoiceDesigner";
import CreateItemMaster from "./components/CreateItemMaster";
import SalesSummaryReport from "./components/SalesSummaryReport";
import WorkflowDesigner from "./components/WorkflowDesigner";
import StockTurnoverReport from "./components/StockTurnoverReport";
import ItemSalesReport from "./components/ItemSalesReport";
import DocumentList from "./components/DocumentList";
import HSNWisePurchaseReport from "./components/HSNWisePurchaseReport";
import HsnSalesSummaryReport from "./components/HsnSalesSummaryReport";
import StockReport from "./components/StockReport";
import POSEntry from "./components/POSEntry";
import ItemSearchPage from "./components/ItemSearchPage";
import MainLayout from "./components/MainLayout";

import StockReportAllBranch from "./components/StockReportAllBranch"
import StockAnomalyReport from "./components/StockAnomalyReport"
import StockReportExclusionPage from "./components/StockReportExclusionPage"

import SalesReportAllBranch from "./components/SalesReportAllBranch"
import WeighBridgeEngageReport from "./components/WeighBridgeEngageReport";
import WeighbridgeUsageReport from "./components/WeighbridgeUsageReport";
import ManageAccountHeads from "./components/ManageAccountHeads";
import StatementOfAccount from "./components/StatementOfAccount";
import BranchRequestList from "./components/BranchRequestList";
import ReprocessVoucherForm from "./components/ReprocessVoucherForm"
import BranchStockReport from "./components/BranchStockReport"
import BranchStockDiffReport from "./components/BranchStockDiffReport";
import ItemCategoryLinker from "./components/ItemCategoryLinker";
import TaxUpdateManager from "./components/TaxUpdateManager";
import TaxUpdatePreview from "./components/TaxUpdatePreview";

import SalesCategoryWiseReportAllBranch from "./components/SalesCategoryWiseReportAllBranch";
import BpmnEditor from "./components/BpmnEditor";
import StockTransferOutReport from "./components/StockTransferOutReport";
import BranchAssignment from "./components/BranchAssignment";
import BranchTransferAssignment from "./components/BranchTransferAssignment";
import StockTransferInvoicePrint from "./components/StockTransferInvoicePrint";
import StockTransferOutInvoice from "./components/StockTransferOutInvoice";
import CategoryPriceEditDialog from "./components/CategoryPriceEditDialog";
import StockTransferInReport from "./components/StockTransferInReport";
import SalesTaxSummary from "./components/SalesTaxSummary";
import PhysicalStockEntryReport from "./components/PhysicalStockEntryReport";

import FinancialYearPage from "./components/FinancialYearPage";
import VersionManagementPage from "./components/VersionManagementPage";
import DayEndReport from "./components/DayEndReport";
import BranchPricePage from "./components/BranchPricePage";
import PhysicalStockCorrection from "./components/PhysicalStockCorrection";
import ProductionDefPage from "./components/ProductionDefPage";
import ProductionPlanningPage from "./components/ProductionPlanningPage";
import ProductionExecutionPage from "./components/ProductionExecutionPage";


import "./i18n"; // i18n config
import LandingPage from "./components/landing/LandingPage";
import SignUpPage from "./components/landing/SignUpPage";
import KOTEntry from "./components/KOTEntry";
import GoodsReceiptForm from "./components/GoodsReceiptForm";
import ReceiptModePage from "./components/ReceiptModePage";
import UpiConfigPage from "./components/UpiConfigPage";
import TermsAndConditionsPage from "./components/TermsAndConditionsPage";
import RefundPolicyPage from "./components/RefundPolicyPage";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage";
import BranchStockViewReport from "./components/BranchStockViewReport";
import BranchInventoryReport from "./components/BranchInventoryReport";
import BranchInventoryLedger from "./components/BranchInventoryLedger";
import ItemTransferReport from "./components/ItemTransferReport";
import AIDashboardPage from "./components/AIDashboardPage";
import AIReportChatbot from "./components/AIReportChatbot";
import MenuMasterPage from "./components/MenuMasterPage";
import RoleMenuPage from "./components/RoleMenuPage";
import RoleManagementPage from "./components/RoleManagementPage";
import SalesmanReport from "./components/SalesmanReport";
import CategoryItemReport from "./components/CategoryItemReport";
import MenuMapPage from "./components/MenuMapPage";
import SetupWizardPage from "./components/SetupWizardPage";
import StockTransferDiscountPage from "./components/StockTransferDiscountPage";
import PosMachineApprovalPage from "./components/PosMachineApprovalPage";

// Accounting
import ReceiptEntry from "./components/accounting/ReceiptEntry";
import PaymentEntry from "./components/accounting/PaymentEntry";
import TrialBalance from "./components/accounting/TrialBalance";
import LedgerStatement from "./components/accounting/LedgerStatement";
import CustomerStatement from "./components/accounting/CustomerStatement";
import SupplierStatement from "./components/accounting/SupplierStatement";
import ProfitLoss from "./components/accounting/ProfitLoss";
import BalanceSheet from "./components/accounting/BalanceSheet";
import CashFlow from "./components/accounting/CashFlow";
import BankReconciliation from "./components/accounting/BankReconciliation";
import InventoryLedger from "./components/accounting/InventoryLedger";
import StockValuation from "./components/accounting/StockValuation";
import CustomerAging from "./components/accounting/CustomerAging";
import SupplierAging from "./components/accounting/SupplierAging";
import InterBranchTransfer from "./components/accounting/InterBranchTransfer";
import PeriodClosing from "./components/accounting/PeriodClosing";
import BudgetManager from "./components/accounting/BudgetManager";
import BudgetVsActual from "./components/accounting/BudgetVsActual";
import { UnitProvider } from "./components/UnitContext";
import { BranchProvider } from "./components/BranchContext";

// ========================
// ORDERED MENU ROUTE MAP  (mirrors Sidebar menuItems order)
// ========================
const ROUTE_ORDER = [
  { key: "Dashboard",                        path: "/dashboard" },
  { key: "AI Stock Intelligence",            path: "/ai-dashboard" },
  { key: "AI Report Assistant",             path: "/ai-report" },
  { key: "Menu Map",                         path: "/menu-map" },
  { key: "Admin Page",                       path: "/branch-request-list" },
  { key: "Reprocess Voucher",               path: "/reprocess-voucher-form" },
  { key: "POS",                              path: "/pos" },
  { key: "KOT",                             path: "/kot" },
  { key: "Sales Entry",                      path: "/salesentryform" },
  { key: "HSN wise Sales",                   path: "/hsnsales" },
  { key: "HSN Sales Summary",                path: "/hsn-sales-summary" },
  { key: "HSN wise Purchase",                path: "/hsnwise-purchase-report" },
  { key: "Purchase Entry",                   path: "/purchaseentry" },
  { key: "Goods Receipt",                    path: "/goodsreceipt" },
  { key: "Production Def",                   path: "/production-def" },
  { key: "Production Planning",              path: "/production-planning" },
  { key: "Production Execution",             path: "/production-execution" },
  { key: "Weighbridge",                      path: "/weighbridge" },
  { key: "Weight-Count",                     path: "/bridge-count" },
  { key: "WeighBridge Usage",                path: "/weighbridgeusage" },
  { key: "Branch Details",                   path: "/branch-update" },
  { key: "Branch Day End Settings",          path: "/branch-day-end-settings" },
  { key: "Version Management",               path: "/version-management" },
  { key: "Scheme Creation",                  path: "/schemepage" },
  { key: "Manage Scheme",                    path: "/publishschemepage" },
  { key: "Menu Master",                      path: "/menu-master" },
  { key: "Role Management",                  path: "/role-management" },
  { key: "Role Menu Access",                 path: "/role-menu" },
  { key: "Branch Creation",                  path: "/branchcreationpage" },
  { key: "User Creation",                    path: "/usercreationpage" },
  { key: "Branch Assignment",                path: "/branchassingment" },
  { key: "Transfer Branch Permissions",      path: "/branch-transfer-assignment" },
  { key: "Financial Year Setup",             path: "/financialyearpage" },
  { key: "Receipt Modes",                    path: "/receipt-modes" },
  { key: "UPI Payment Setup",               path: "/upi-config" },
  { key: "Item Search",                      path: "/itemsearch" },
  { key: "Item Creation",                    path: "/createitemmaster" },
  { key: "Branch Price",                     path: "/branch-price" },
  { key: "Stock Transfer Discount",          path: "/stock-transfer-discount" },
  { key: "Price Edit Category Wise",         path: "/category-price-edit" },
  { key: "Category Link",                    path: "/item-category-linker" },
  { key: "Manage Account Heads",             path: "/manage-account-heads" },
  { key: "Statement Of Account",             path: "/statement-of-account" },
  { key: "Category Type",                    path: "/categorytypemaster" },
  { key: "Category Name",                    path: "/categorynamemaster" },
  { key: "Supplier Creation",                path: "/suppliercreation" },
  { key: "Tax Update Manager",               path: "/tax-update-manager" },
  { key: "Tax Update Preview",               path: "/tax-update-preview" },
  { key: "Physical Stock Correction",        path: "/physical-stock-correction" },
  { key: "Sales Re Print",                   path: "/salessummaryreport" },
  { key: "Sales Report",                     path: "/sales" },
  { key: "Sales Tax Summary",                path: "/salestaxsummary" },
  { key: "Purchase Report",                  path: "/purchasereport" },
  { key: "Stock Movement Report",            path: "/stockmovementreport" },
  { key: "Item Movement Report",             path: "/item-movement-report" },
  { key: "Item Velocity Report",             path: "/item-velocity-report" },
  { key: "Physical Stock Report",            path: "/physicalstockreport" },
  { key: "All Branch Stock Report",          path: "/stock-report-all-branch" },
  { key: "Branch Stock Management",          path: "/branch-stock-report" },
  { key: "All Branch Sales Report",          path: "/sales-report-all-branch" },
  { key: "All Branch Categorywise Sales Report", path: "/sales-category-wise-report-all-branch" },
  { key: "Item Stock Report",                path: "/item-stock-report" },
  { key: "Day End Report",                   path: "/day-end-report" },
  { key: "Clear Day End",                    path: "/day-end-clear" },
  { key: "Bill Series Report",               path: "/billseriesreport" },
  { key: "Season Sales Report",              path: "/seasonalreport" },
  { key: "Stock Turnover Report",            path: "/stock-turnover" },
  { key: "Stock Anomaly Report",             path: "/stock-anomaly-report" },
  { key: "Report Exclusions",               path: "/report-exclusions" },
  { key: "Item Sales Report",                path: "/item-sales" },
  { key: "Documents List",                   path: "/documents-list" },
  { key: "Branch Stock Diff Report",         path: "/branch-stock-diff-report" },
  { key: "Branch Stock Report",              path: "/branch-stock-view" },
  { key: "Branch Inventory Report",          path: "/branch-inventory" },
  { key: "Branch Inventory Ledger",          path: "/branch-inventory-ledger" },
  { key: "Stock Transfer Out Report",        path: "/stocktransfer-out-report" },
  { key: "Stock Transfer In Report",         path: "/stocktransfer-in-report" },
  { key: "Item Transfer Report",             path: "/item-transfer-report" },
  { key: "Salesman Report",                  path: "/salesman-report" },
  { key: "Category Item Report",             path: "/category-item-report" },
  // Accounting
  { key: "Receipt Entry",                   path: "/accounting/receipt-entry" },
  { key: "Payment Entry",                   path: "/accounting/payment-entry" },
  { key: "Trial Balance",                   path: "/accounting/trial-balance" },
  { key: "Ledger Statement",                path: "/accounting/ledger-statement" },
  { key: "Customer Statement",              path: "/accounting/customer-statement" },
  { key: "Supplier Statement",              path: "/accounting/supplier-statement" },
  { key: "Profit & Loss",                   path: "/accounting/profit-loss" },
  { key: "Balance Sheet",                   path: "/accounting/balance-sheet" },
  { key: "Cash Flow",                       path: "/accounting/cash-flow" },
  { key: "Bank Reconciliation",             path: "/accounting/bank-reconciliation" },
  { key: "Inventory Ledger",                path: "/accounting/inventory-ledger" },
  { key: "Stock Valuation",                 path: "/accounting/stock-valuation" },
  { key: "Customer Aging",                  path: "/accounting/customer-aging" },
  { key: "Supplier Aging",                  path: "/accounting/supplier-aging" },
  { key: "Inter-Branch Transfer",           path: "/accounting/inter-branch-transfer" },
  { key: "Period Closing",                  path: "/accounting/period-closing" },
  { key: "Budget Manager",                  path: "/accounting/budget-manager" },
  { key: "Budget vs Actual",                path: "/accounting/budget-vs-actual" },
  { key: "Download",                         path: "/download" },
  { key: "Upload",                           path: "/uploadpage" },
  { key: "Invoice Designer",                 path: "/invoicedesigner" },
  { key: "Workflow Designer",                path: "/bpmn-editorr" },
  { key: "About",                            path: "/about" },
  { key: "Help",                             path: "/help" },
];

/** Resolves the first route a user may land on after login. */
async function resolveLoginLanding(loginRoles) {
  // New tenants must complete the setup wizard before accessing the app
  const setupCompleted = localStorage.getItem("setupCompleted");
  if (setupCompleted === "false") return "/setup-wizard";

  if (loginRoles.includes("system-admin")) return "/dashboard";

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  try {
    const res = await fetch(`/api/${tenancyId}/role-menus/accessible-menus`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(loginRoles),
    });
    const data = res.ok ? await res.json() : [];
    const allowed = new Set(Array.isArray(data) ? data : []);

    // No role-menu assignments configured — default to dashboard
    if (allowed.size === 0) return "/dashboard";

    const first = ROUTE_ORDER.find(({ key }) => allowed.has(key));
    return first ? first.path : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

// Redirects "/" to the first route the current user is permitted to access.
const LandingRedirect = ({ roles }) => {
  const navigate = useNavigate();
  useEffect(() => {
    resolveLoginLanding(roles).then((path) => navigate(path, { replace: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

// ========================
// AUTH WRAPPER COMPONENT
// ========================
const AuthenticatedApp = ({ mode, setMode, roles, setRoles }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = async (loginRoles) => {
    localStorage.setItem("roles", JSON.stringify(loginRoles));
    setRoles(loginRoles);
    const landing = await resolveLoginLanding(loginRoles);
    navigate(landing);
  };

  const location = useLocation();
  const isAuthenticated = !!roles.length;
  const setupCompleted = localStorage.getItem("setupCompleted");
  const needsSetup = isAuthenticated && setupCompleted === "false";

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} autoOpen={location.pathname === "/login"} />;
  }

  // Redirect to wizard if setup is not complete (but allow /setup-wizard itself)
  if (needsSetup && window.location.pathname !== "/setup-wizard") {
    return (
      <SetupWizardPage
        onComplete={() => {
          localStorage.setItem("setupCompleted", "true");
          navigate("/dashboard");
        }}
      />
    );
  }

  // Show wizard directly when on /setup-wizard route
  if (window.location.pathname === "/setup-wizard") {
    return (
      <SetupWizardPage
        onComplete={() => {
          localStorage.setItem("setupCompleted", "true");
          navigate("/dashboard");
        }}
      />
    );
  }

  return (
    <>
      {/* Mobile-only top app bar */}
      <AppBar
        position="fixed"
        elevation={2}
        sx={{
          display: { xs: "flex", sm: "none" },
          bgcolor: "#141a2e",
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, color: "#ffe3a3" }}
          >
            <MenuIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#ffe3a3", letterSpacing: "0.3px" }}>
            TradeLink 247
          </Typography>
        </Toolbar>
      </AppBar>

      <BranchProvider>
      <UnitProvider>
      <Sidebar mode={mode} setMode={setMode} roles={roles} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <Box sx={{ display: "flex", flexGrow: 1, ml: { xs: 0, sm: "240px" }, mt: { xs: "48px", sm: 8 } }}>
        <WebSocketProvider>
          <Routes>
            <Route path="/" element={<LandingRedirect roles={roles} />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<SalesDetail />} />
            <Route path="/hsnsales" element={<HSNSalesDetail />} />
            <Route path="/hsn-sales-summary" element={<HsnSalesSummaryReport />} />
            <Route path="/purchasereport" element={<PurchaseDetail />} />
            <Route path="/weighbridge" element={<WeighBridge />} />
            <Route path="/branchcreationpage" element={<BranchCreationPage />} />
            <Route path="/branch-update" element={<BranchUpdatePage />} />
            <Route path="/branch-day-end-settings" element={<BranchDayEndSettingsPage />} />
            <Route path="/usercreationpage" element={<UserCreationPage />} />
            <Route path="/schemepage" element={<SchemePage />} />
            <Route path="/publishschemepage" element={<PublishSchemePage />} />
            <Route path="/about" element={<About />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/seasonalreport" element={<SeasonalReport />} />
            <Route path="/categorytypemaster" element={<CategoryTypeMaster />} />
            <Route path="/categorynamemaster" element={<CategoryNameMaster />} />
            <Route path="/suppliercreation" element={<SupplierCreationForm />} />
            <Route path="/purchaseentry" element={<PurchaseEntryForm />} />
            <Route path="/salesentryform" element={<SalesEntryForm />} />
            <Route path="/billseriesreport" element={<BillSeriesReport />} />
            <Route path="/uploadpage" element={<UploadPage />} />
            <Route path="/createitemmaster" element={<CreateItemMaster />} />
            <Route path="/salessummaryreport" element={<SalesSummaryReport />} />
            <Route path="/stockmovementreport" element={<StockMovementReport />} />
            <Route path="/item-movement-report" element={<ItemMovementReport />} />
            <Route path="/item-velocity-report" element={<ItemVelocityReport />} />
            <Route path="/invoicedesigner" element={<Invoicedesigner />} />
            <Route path="/workflowdesign" element={<WorkflowDesigner />} />
            <Route path="/stock-turnover" element={<StockTurnoverReport />} />
            <Route path="/item-sales" element={<ItemSalesReport />} />
            <Route path="/documents-list" element={<DocumentList />} />
            <Route path="/hsnwise-purchase-report" element={<HSNWisePurchaseReport />} />
            <Route path="/item-stock-report" element={<StockReport />} />
            <Route path="/pos" element={<POSEntry />} />
            <Route path="/itemsearch" element={<ItemSearchPage />} />
            <Route path="/main" element={<MainLayout mode={mode} setMode={setMode} roles={roles} />} />

            <Route path="/stock-report-all-branch" element={<StockReportAllBranch />} />
            <Route path="/stock-anomaly-report" element={<StockAnomalyReport />} />
            <Route path="/report-exclusions" element={<StockReportExclusionPage />} />
            <Route path="/sales-report-all-branch" element={<SalesReportAllBranch />} />
            <Route path="/bridge-count" element={<WeighBridgeEngageReport />} />
            <Route path="/weighbridgeusage" element={<WeighbridgeUsageReport />} />
            <Route path="/manage-account-heads" element={<ManageAccountHeads />} />
            <Route path="/statement-of-account" element={<StatementOfAccount />} />
            <Route path="/branch-request-list" element={<BranchRequestList />} />
            <Route path="/reprocess-voucher-form" element={<ReprocessVoucherForm />} />
            <Route path="/branch-stock-report" element={<BranchStockReport />} />
            <Route path="/branch-stock-diff-report" element={<BranchStockDiffReport />} />
            <Route path="/item-category-linker" element={<ItemCategoryLinker />} />
            <Route path="/tax-update-manager" element={<TaxUpdateManager />} />
            <Route path="/tax-update-preview" element={<TaxUpdatePreview />} />
            <Route path="/sales-category-wise-report-all-branch" element={<SalesCategoryWiseReportAllBranch />} />
            <Route path="/bpmn-editorr" element={<BpmnEditor />} />
            <Route path="/stocktransfer-out-report" element={<StockTransferOutReport />} />
            <Route path="/stocktransfer-in-report" element={<StockTransferInReport />} />
            <Route path="/branchassingment" element={<BranchAssignment />} />
            <Route path="/branch-transfer-assignment" element={<BranchTransferAssignment />} />
            <Route path="/category-price-edit" element={<CategoryPriceEditDialog />} />
            <Route path="/kot" element={<KOTEntry />} />
              <Route path="/salestaxsummary" element={<SalesTaxSummary />} />
              <Route path="/physicalstockreport" element={<PhysicalStockEntryReport />} />
 <Route path="/financialyearpage" element={<FinancialYearPage />} />
            <Route path="/day-end-report" element={<DayEndReport />} />
            <Route path="/day-end-clear" element={<DayEndClearPage />} />
            <Route path="/branch-price" element={<BranchPricePage />} />
            <Route path="/stock-transfer-discount" element={<StockTransferDiscountPage />} />
            <Route path="/version-management" element={<VersionManagementPage />} />

<Route
  path="/stock-transfer-out/invoice/:voucherNumber"
  element={<StockTransferOutInvoice />}
/>

<Route
  path="/physical-stock-correction"
  element={<PhysicalStockCorrection />}
/>
<Route path="/production-def" element={<ProductionDefPage />} />
<Route path="/production-planning" element={<ProductionPlanningPage />} />
<Route path="/production-execution" element={<ProductionExecutionPage />} />
<Route path="/goodsreceipt" element={<GoodsReceiptForm />} />
<Route path="/receipt-modes" element={<ReceiptModePage />} />
<Route path="/upi-config" element={<UpiConfigPage />} />
<Route path="/branch-stock-view" element={<BranchStockViewReport />} />
<Route path="/branch-inventory" element={<BranchInventoryReport />} />
<Route path="/branch-inventory-ledger" element={<BranchInventoryLedger />} />
<Route path="/item-transfer-report" element={<ItemTransferReport />} />
<Route path="/salesman-report" element={<SalesmanReport />} />
<Route path="/category-item-report" element={<CategoryItemReport />} />
<Route path="/menu-map" element={<MenuMapPage />} />
<Route path="/ai-dashboard" element={<AIDashboardPage />} />
<Route path="/ai-report"    element={<AIReportChatbot />} />
<Route path="/menu-master" element={<MenuMasterPage />} />
<Route path="/role-menu" element={<RoleMenuPage />} />
<Route path="/role-management" element={<RoleManagementPage />} />
<Route path="/pos-machine-approval" element={<PosMachineApprovalPage />} />
<Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
<Route path="/refund-policy" element={<RefundPolicyPage />} />
<Route path="/privacy-policy" element={<PrivacyPolicyPage />} />

            {/* Accounting */}
            <Route path="/accounting/receipt-entry" element={<ReceiptEntry />} />
            <Route path="/accounting/payment-entry" element={<PaymentEntry />} />
            <Route path="/accounting/trial-balance" element={<TrialBalance />} />
            <Route path="/accounting/ledger-statement" element={<LedgerStatement />} />
            <Route path="/accounting/customer-statement" element={<CustomerStatement />} />
            <Route path="/accounting/supplier-statement" element={<SupplierStatement />} />
            <Route path="/accounting/profit-loss" element={<ProfitLoss />} />
            <Route path="/accounting/balance-sheet" element={<BalanceSheet />} />
            <Route path="/accounting/cash-flow" element={<CashFlow />} />
            <Route path="/accounting/bank-reconciliation" element={<BankReconciliation />} />
            <Route path="/accounting/inventory-ledger" element={<InventoryLedger />} />
            <Route path="/accounting/stock-valuation" element={<StockValuation />} />
            <Route path="/accounting/customer-aging" element={<CustomerAging />} />
            <Route path="/accounting/supplier-aging" element={<SupplierAging />} />
            <Route path="/accounting/inter-branch-transfer" element={<InterBranchTransfer />} />
            <Route path="/accounting/period-closing" element={<PeriodClosing />} />
            <Route path="/accounting/budget-manager" element={<BudgetManager />} />
            <Route path="/accounting/budget-vs-actual" element={<BudgetVsActual />} />

          </Routes>
        </WebSocketProvider>
      </Box>
      </UnitProvider>
      </BranchProvider>
    </>
  );
};

// ========================
// ROOT APP
// ========================
const App = () => {
  const { i18n } = useTranslation();
  const [mode, setMode] = useState("dark");
  const [roles, setRoles] = useState([]);
  const [language, setLanguage] = useState("en");

  // Language preference
  useEffect(() => {
    const storedLanguage = localStorage.getItem("language");
    if (storedLanguage) {
      i18n.changeLanguage(storedLanguage);
      setLanguage(storedLanguage);
    }
  }, [i18n]);

  // Theme setup
  const theme = createTheme({
    typography: {
      fontSize: 12,
      h1: { fontSize: "2rem" },
      h2: { fontSize: "1.75rem" },
      h3: { fontSize: "1.5rem" },
    },
    palette: { mode },
  });

  return (
    <Suspense fallback={<CircularProgress />}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Routes>
            {/* Public pages — no auth required */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/signup"
              element={
                <SignUpPage
                  onLogin={async (loginRoles) => {
                    localStorage.setItem("roles", JSON.stringify(loginRoles));
                    setRoles(loginRoles);
                    const landing = await resolveLoginLanding(loginRoles);
                    window.location.href = landing;
                  }}
                />
              }
            />
            <Route path="/privacy" element={<PrivacyPolicyPage isPublic />} />
            <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage isPublic />} />
            {/* Authenticated app — all other routes */}
            <Route
              path="/*"
              element={
                <AuthenticatedApp
                  mode={mode}
                  setMode={setMode}
                  roles={roles}
                  setRoles={setRoles}
                />
              }
            />
          </Routes>
        </Router>
      </ThemeProvider>
    </Suspense>
  );
};

export default App;
