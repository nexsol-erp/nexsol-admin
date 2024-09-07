import React, { useState, useEffect, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  CssBaseline,
  Box,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
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
import "./i18n"; // Import i18n configuration

const App = () => {
  const { i18n } = useTranslation(); // Access the i18n instance for language changes
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState("dark");
  const [roles, setRoles] = useState([]);
  const [language, setLanguage] = useState("en"); // Default language is set to English

  // Load the language from localStorage on component mount
  useEffect(() => {
    const storedLanguage = localStorage.getItem("language");
    if (storedLanguage) {
      i18n.changeLanguage(storedLanguage); // Change the language in i18next
      setLanguage(storedLanguage); // Update the state
    }
  }, [i18n]); // Only run this once when the app initializes

  const theme = createTheme({
    typography: {
      fontSize: 12,
      h1: { fontSize: "2rem" },
      h2: { fontSize: "1.75rem" },
      h3: { fontSize: "1.5rem" },
    },
    palette: {
      mode,
    },
  });

  const handleLogin = (roles) => {
    setIsAuthenticated(true);
    setRoles(roles);
  };

  const changeLanguage = (lang) => {
    i18n.changeLanguage(lang); // Change the language using i18next
    setLanguage(lang); // Update the state
    localStorage.setItem("language", lang); // Store the selected language in localStorage
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <Suspense fallback={<CircularProgress />}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Sidebar mode={mode} setMode={setMode} roles={roles} />
          <Box
            sx={{
              display: "flex",
              flexGrow: 1,
              ml: { xs: 0, sm: "240px" },
              mt: 8,
            }}
          >
            <WebSocketProvider>
             

              <Routes>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/sales" element={<SalesDetail />} />
                <Route path="/hsnsales" element={<HSNSalesDetail />} />
                <Route path="/purchasereport" element={<PurchaseDetail />} />
                <Route path="/weighbridge" element={<WeighBridge />} />
                <Route
                  path="/branchcreationpage"
                  element={<BranchCreationPage />}
                />
                <Route
                  path="/usercreationpage"
                  element={<UserCreationPage />}
                />
                <Route path="/schemepage" element={<SchemePage />} />
                <Route
                  path="/publishschemepage"
                  element={<PublishSchemePage />}
                />
                <Route path="/about" element={<About />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/download" element={<DownloadPage />} />
                <Route path="/help" element={<HelpPage />} />
                <Route path="/seasonalreport" element={<SeasonalReport />} />
                <Route
                  path="/categorytypemaster"
                  element={<CategoryTypeMaster />}
                />
                <Route
                  path="/categorynamemaster"
                  element={<CategoryNameMaster />}
                />
                <Route
                  path="/suppliercreation"
                  element={<SupplierCreationForm />}
                />
                <Route path="/purchaseentry" element={<PurchaseEntryForm />} />
                <Route path="/salesentryform" element={<SalesEntryForm />} />
                <Route
                  path="/billseriesreport"
                  element={<BillSeriesReport />}
                />
                <Route path="/uploadpage" element={<UploadPage />} />
                <Route
                  path="/createitemmaster"
                  element={<CreateItemMaster />}
                />
                <Route
                  path="/salessummaryreport"
                  element={<SalesSummaryReport />}
                />
                <Route
                  path="/stockmovementreport"
                  element={<StockMovementReport />}
                />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/invoicedesigner" element={<Invoicedesigner />} />
              </Routes>
            </WebSocketProvider>
          </Box>
        </Router>
      </ThemeProvider>
    </Suspense>
  );
};

export default App;
