import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box } from "@mui/material";
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

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState("dark");
  const [roles, setRoles] = useState([]);

  const theme = createTheme({
    palette: {
      mode,
    },
  });

  const handleLogin = (roles) => {
    setIsAuthenticated(true);
    setRoles(roles);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
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
              <Route path="/purchase" element={<PurchaseDetail />} />
              <Route path="/weighbridge" element={<WeighBridge />} />
              <Route
                path="/branchcreationpage"
                element={<BranchCreationPage />}
              />
              <Route path="/usercreationpage" element={<UserCreationPage />} />
              <Route path="/schemepage" element={<SchemePage />} />

              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/download" element={<DownloadPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </WebSocketProvider>
        </Box>
      </Router>
    </ThemeProvider>
  );
};

export default App;
