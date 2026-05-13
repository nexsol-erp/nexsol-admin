import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import App from "./App.jsx";
import "antd/dist/reset.css";
import "./styles/theme.css";
import { testBackendAPI, testLocalCache, testAddMockItems, loadAllItemsToCache } from "./cache/itemCache";

// Expose test functions to window for debugging
window.testBackendAPI = testBackendAPI;
window.testLocalCache = testLocalCache;
window.testAddMockItems = testAddMockItems;
window.loadAllItemsToCache = loadAllItemsToCache;

const antdTheme = {
  token: {
    colorPrimary: "#1677ff",
    colorBgContainer: "#ffffff",
    colorText: "#1f2937",
    colorTextSecondary: "#6b7280",
    colorTextPlaceholder: "#9ca3af",
    colorBorder: "#d1d5db",
    colorBgLayout: "#f0f2f5",
    colorBgElevated: "#ffffff",
    colorFill: "#f5f5f5",
    colorFillSecondary: "#fafafa",
    fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    borderRadius: 6,
  },
  components: {
    Card: { colorBgContainer: "#ffffff" },
    Table: { colorBgContainer: "#ffffff" },
    Input: { colorBgContainer: "#ffffff" },
    InputNumber: { colorBgContainer: "#ffffff" },
    Select: { colorBgContainer: "#ffffff" },
    Modal: { colorBgElevated: "#ffffff" },
    Menu: { colorBgContainer: "#ffffff" },
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider theme={antdTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
