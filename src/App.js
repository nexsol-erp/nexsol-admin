import React, { useState, useEffect, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box, CircularProgress } from "@mui/material";
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
import ItemCategoryMapping from "./components/ItemCategoryMapping"
import StockReportAllBranch from "./components/StockReportAllBranch"

import SalesReportAllBranch from "./components/SalesReportAllBranch"
import WeighBridgeEngageReport from "./components/WeighBridgeEngageReport";
import WeighbridgeUsageReport from "./components/WeighbridgeUsageReport";
import ManageAccountHeads from "./components/ManageAccountHeads";
import StatementOfAccount from "./components/StatementOfAccount";
import BranchRequestList from "./components/BranchRequestList";
import ReprocessVoucherForm from "./components/ReprocessVoucherForm"
import BranchStockReport from "./components/BranchStockReport"


import "./i18n"; // i18n config

// ========================
// AUTH WRAPPER COMPONENT
// ========================
const AuthenticatedApp = ({ mode, setMode, roles, setRoles }) => {
  const navigate = useNavigate();

  const handleLogin = (roles) => {
    localStorage.setItem("roles", JSON.stringify(roles));
    setRoles(roles);
    navigate("/main");
  };

  const isAuthenticated = !!roles.length;

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <>
      <Sidebar mode={mode} setMode={setMode} roles={roles} />
      <Box sx={{ display: "flex", flexGrow: 1, ml: { xs: 0, sm: "240px" }, mt: 8 }}>
        <WebSocketProvider>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/sales" element={<SalesDetail />} />
            <Route path="/hsnsales" element={<HSNSalesDetail />} />
            <Route path="/purchasereport" element={<PurchaseDetail />} />
            <Route path="/weighbridge" element={<WeighBridge />} />
            <Route path="/branchcreationpage" element={<BranchCreationPage />} />
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
            <Route path="/item-category-linking" element={<ItemCategoryMapping />} />
            <Route path="/stock-report-all-branch" element={<StockReportAllBranch />} />
            <Route path="/sales-report-all-branch" element={<SalesReportAllBranch />} />
            <Route path="/bridge-count" element={<WeighBridgeEngageReport />} />
            <Route path="/weighbridgeusage" element={<WeighbridgeUsageReport />} />
            <Route path="/manage-account-heads" element={<ManageAccountHeads />} />
            <Route path="/statement-of-account" element={<StatementOfAccount />} />
            <Route path="/branch-request-list" element={<BranchRequestList />} />
            <Route path="/reprocess-voucher-form" element={<ReprocessVoucherForm />} />
            <Route path="/branch-stock-report" element={<BranchStockReport />} />
            
            
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
