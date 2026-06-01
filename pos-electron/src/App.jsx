import React, { useEffect, useRef, useState } from "react";
import { Button, Menu, Popconfirm, Select, Typography, message } from "antd";
import POSPage from "./pos/POSPage";
import LoginPage from "./auth/LoginPage";
import DayEndPage from "./dayend/DayEndPage";
import AcceptStockPage from "./accept-stock/AcceptStockPage";
import StockTransferPage from "./stock-transfer/StockTransferPage";
import StockTransferHistoryPage from "./stock-transfer/StockTransferHistoryPage";
import WeighBridgePage from "./pos/WeighBridgePage";
import PhysicalStockPage from "./pos/PhysicalStockPage";
import KOTPage from "./pos/KOTPage";
import SalesmanReportPage from "./pos/SalesmanReportPage";
import UpdateChecker from "./components/UpdateChecker";
import { isLoggedIn, logout } from "./auth/auth";
import { clearItemCache, hasCache, loadAllItemsToCache } from "./cache/itemCache";
import { registerMachine } from "./utils/posDevice";
import { log } from "./utils/logger";

const { Text } = Typography;

function getRoles() {
  try { return JSON.parse(localStorage.getItem("roles") || "[]"); } catch { return []; }
}

function extractBranchCodes() {
  try {
    const raw = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    return raw
      .map((b) => typeof b === "string" ? b.trim() : String(b?.branchCode ?? b?.code ?? b?.branch ?? b?.value ?? b?.id ?? "").trim())
      .filter((c) => { if (!c || seen.has(c)) return false; seen.add(c); return true; });
  } catch { return []; }
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [activePage, setActivePage] = useState("pos");
  const [roles, setRoles] = useState(getRoles);

  const [branchOptions, setBranchOptions] = useState([]);
  const [selectedBranchCode, setSelectedBranchCode] = useState(() => {
    const saved = localStorage.getItem("selectedBranchCode") || "";
    if (saved) globalThis.POS_BRANCH_CODE = saved;
    return saved;
  });
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [kotPrefillItems, setKotPrefillItems] = useState(null);

  const prevBranchRef = useRef(null);
  const hasWB = roles.includes("WB");

  // Load branch options whenever user logs in
  useEffect(() => {
    if (!loggedIn) return;
    const codes = extractBranchCodes();
    const options = codes.map((c) => ({ value: c, label: c }));
    setBranchOptions(options);
    if (!options.length) return;
    const saved = localStorage.getItem("selectedBranchCode") || "";
    const initial = codes.includes(saved) ? saved : codes[0];
    globalThis.POS_BRANCH_CODE = initial;
    localStorage.setItem("selectedBranchCode", initial);
    setSelectedBranchCode(initial);
  }, [loggedIn]);

  // Initial cache load on login
  useEffect(() => {
    if (!loggedIn) return;
    hasCache()
      .then((ok) => { if (!ok) reloadCache(); })
      .catch(() => {});
  }, [loggedIn]);

  // Reload cache when branch actually changes (not on first set)
  useEffect(() => {
    if (!loggedIn || !selectedBranchCode) return;
    if (prevBranchRef.current !== null && prevBranchRef.current !== selectedBranchCode) {
      reloadCache();
    }
    prevBranchRef.current = selectedBranchCode;
  }, [selectedBranchCode, loggedIn]);

  // Register this machine with the server on login / branch change.
  // Idempotent — safe to call every time. Updates local FY + machineCode cache.
  useEffect(() => {
    if (!loggedIn || !selectedBranchCode) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId) return;
    const machineName = window.navigator?.userAgent?.split(" ").pop() || "";
    registerMachine(tenantId, selectedBranchCode, machineName);
  }, [selectedBranchCode, loggedIn]);

  const reloadCache = async () => {
    setCacheLoading(true);
    try {
      await loadAllItemsToCache({});
      message.success("Item cache loaded");
    } catch (e) {
      message.error(e.message || "Failed to load item cache");
    } finally {
      setCacheLoading(false);
    }
  };

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      await clearItemCache();
      message.success("Stock cache cleared. Press Refresh to reload.");
    } catch (e) {
      message.error("Failed to clear cache: " + (e.message || "Unknown error"));
    } finally {
      setCacheClearing(false);
    }
  };

  const handleKotConvertToPOS = (lines) => {
    setKotPrefillItems(lines);
    setActivePage("pos");
  };

  const handleBranchChange = (code) => {
    globalThis.POS_BRANCH_CODE = code;
    localStorage.setItem("selectedBranchCode", code);
    setSelectedBranchCode(code);
  };

  useEffect(() => {
    if (!window.POS?.onNavigate) return undefined;
    const allowedPages = ["pos", "kot", "day-end", "accept-stock", "stock-transfer", "st-history", "physical-stock"];
    if (hasWB) allowedPages.push("weigh-bridge");
    const unsubscribe = window.POS.onNavigate((page) => {
      if (allowedPages.includes(page)) setActivePage(page);
    });
    return () => unsubscribe?.();
  }, [hasWB]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0f2f5" }}>
      {!loggedIn ? (
        <LoginPage onLoggedIn={() => { setRoles(getRoles()); setLoggedIn(true); }} />
      ) : (
        <div style={{ background: "#ffffff" }}>
          <UpdateChecker />

          {/* Top bar: nav tabs + branch + actions */}
          <div style={{ display: "flex", alignItems: "center", background: "#f8fafc", borderBottom: "1px solid #e5e7eb", paddingRight: 10 }}>
            <Menu
              mode="horizontal"
              selectedKeys={[activePage]}
              onClick={(e) => { log("Menu clicked:", e.key); setActivePage(e.key); }}
              items={[
                { key: "pos", label: "POS" },
                { key: "kot", label: "KOT" },
                { key: "stock-transfer", label: "Stock Transfer" },
                { key: "st-history", label: "ST History" },
                { key: "day-end", label: "Day End" },
                { key: "accept-stock", label: "Accept Stock" },
                ...(hasWB ? [{ key: "weigh-bridge", label: "Weigh Bridge" }] : []),
                { key: "physical-stock", label: "Physical Stock" },
                { key: "salesman-report", label: "Salesman" },
              ]}
              style={{ flex: 1, borderBottom: "none", minWidth: 0 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <Text strong style={{ color: "#374151", fontSize: 12 }}>Branch:</Text>
              {branchOptions.length <= 1 ? (
                <Text style={{ fontSize: 12 }}>{selectedBranchCode || branchOptions[0]?.value || "—"}</Text>
              ) : (
                <Select
                  size="small"
                  style={{ width: 130 }}
                  value={selectedBranchCode || undefined}
                  onChange={handleBranchChange}
                  options={branchOptions}
                  placeholder="Select branch"
                />
              )}
              <Button size="small" loading={cacheLoading} onClick={reloadCache}>
                Refresh
              </Button>
              <Popconfirm
                title="Clear stock cache?"
                description="Cached stock quantities will be wiped. Press Refresh afterwards to reload."
                onConfirm={handleClearCache}
                okText="Clear"
                okButtonProps={{ danger: true }}
                cancelText="Cancel"
              >
                <Button size="small" danger loading={cacheClearing}>
                  Clear Cache
                </Button>
              </Popconfirm>
              <Button
                size="small"
                danger
                onClick={() => { logout(); setLoggedIn(false); }}
              >
                Logout
              </Button>
            </div>
          </div>

          {activePage === "pos" && <POSPage selectedBranchCode={selectedBranchCode} onLogout={() => setLoggedIn(false)} prefillItems={kotPrefillItems} onPrefillUsed={() => setKotPrefillItems(null)} />}
          {activePage === "stock-transfer" && <StockTransferPage onClose={() => setActivePage("pos")} />}
          {activePage === "st-history" && <StockTransferHistoryPage onClose={() => setActivePage("pos")} />}
          {activePage === "day-end" && <DayEndPage />}
          {activePage === "accept-stock" && <AcceptStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "weigh-bridge" && hasWB && <WeighBridgePage />}
          {activePage === "physical-stock" && <PhysicalStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "salesman-report" && <SalesmanReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "kot" && <KOTPage selectedBranchCode={selectedBranchCode} onConvertToPOS={handleKotConvertToPOS} />}
        </div>
      )}
    </div>
  );
}
