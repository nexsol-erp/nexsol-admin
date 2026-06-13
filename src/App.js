import React, { useState, useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
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
import StockReport from "./components/StockReport";
import POSEntry from "./components/POSEntry";
import ItemSearchPage from "./components/ItemSearchPage";
import MainLayout from "./components/MainLayout";

import StockReportAllBranch from "./components/StockReportAllBranch"

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
import KOTEntry from "./components/KOTEntry";
import GoodsReceiptForm from "./components/GoodsReceiptForm";
import ReceiptModePage from "./components/ReceiptModePage";
import UpiConfigPage from "./components/UpiConfigPage";
import TermsAndConditionsPage from "./components/TermsAndConditionsPage";
import RefundPolicyPage from "./components/RefundPolicyPage";
import PrivacyPolicyPage from "./components/PrivacyPolicyPage";
import BranchStockViewReport from "./components/BranchStockViewReport";
import ItemTransferReport from "./components/ItemTransferReport";
import AIDashboardPage from "./components/AIDashboardPage";
import MenuMasterPage from "./components/MenuMasterPage";
import RoleMenuPage from "./components/RoleMenuPage";
import RoleManagementPage from "./components/RoleManagementPage";

// ========================
// AUTH WRAPPER COMPONENT
// ========================
const AuthenticatedApp = ({ mode, setMode, roles, setRoles }) => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = (loginRoles) => {
    localStorage.setItem("roles", JSON.stringify(loginRoles));
    setRoles(loginRoles);
    navigate("/dashboard");
  };

  const isAuthenticated = !!roles.length;

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
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

      <Sidebar mode={mode} setMode={setMode} roles={roles} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <Box sx={{ display: "flex", flexGrow: 1, ml: { xs: 0, sm: "240px" }, mt: { xs: "48px", sm: 8 } }}>
        <WebSocketProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<SalesDetail />} />
            <Route path="/hsnsales" element={<HSNSalesDetail />} />
            <Route path="/purchasereport" element={<PurchaseDetail />} />
            <Route path="/weighbridge" element={<WeighBridge />} />
            <Route path="/branchcreationpage" element={<BranchCreationPage />} />
            <Route path="/branch-update" element={<BranchUpdatePage />} />
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
            <Route path="/branch-price" element={<BranchPricePage />} />
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
<Route path="/item-transfer-report" element={<ItemTransferReport />} />
<Route path="/ai-dashboard" element={<AIDashboardPage />} />
<Route path="/menu-master" element={<MenuMasterPage />} />
<Route path="/role-menu" element={<RoleMenuPage />} />
<Route path="/role-management" element={<RoleManagementPage />} />
<Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
<Route path="/refund-policy" element={<RefundPolicyPage />} />
<Route path="/privacy-policy" element={<PrivacyPolicyPage />} />



          </Routes>
        </WebSocketProvider>
      </Box>
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
          <AuthenticatedApp
            mode={mode}
            setMode={setMode}
            roles={roles}
            setRoles={setRoles}
          />
        </Router>
      </ThemeProvider>
    </Suspense>
  );
};

export default App;
