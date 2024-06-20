import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import LoginForm from "./components/LoginForm";
import Dashboard from "./components/Dashboard";
import SalesDetail from "./components/SalesDetail";
import PurchaseDetail from "./components/PurchaseDetail";
import About from "./components/About";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import { WebSocketProvider } from "./components/WebSocketContext";
import { Box } from "@mui/material";
import DownloadPage from "./components/DownloadPage";
import HelpPage from "./components/HelpPage";
import WeighBridge from "./components/WeighBridge";

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [mode, setMode] = useState("light");

  const theme = createTheme({
    palette: {
      mode,
    },
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Sidebar mode={mode} setMode={setMode} />
        <Box sx={{ display: "flex", flexGrow: 1, ml: "15%" }}>
          <WebSocketProvider>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/sales" element={<SalesDetail />} />
              <Route path="/purchase" element={<PurchaseDetail />} />
              <Route path="/weighbridge" element={<WeighBridge />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/download" element={<DownloadPage />} />
              <Route path="/help" element={<HelpPage />} />
              {/* Add the new route */}
            </Routes>
          </WebSocketProvider>
        </Box>
      </Router>
    </ThemeProvider>
  );
};

export default App;
