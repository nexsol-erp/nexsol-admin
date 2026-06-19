import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Menu, Popconfirm, Select, Tooltip, Typography, message } from "antd";
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
import ItemSalesReportPage from "./pos/ItemSalesReportPage";
import ItemMovementReportPage from "./pos/ItemMovementReportPage";
import StockTransferInReportPage from "./pos/StockTransferInReportPage";
import UpdateChecker from "./components/UpdateChecker";
import { isLoggedIn, logout, isAdminRole, getBranchLock, clearBranchLock } from "./auth/auth";
import { clearItemCache, hasCache, loadAllItemsToCache } from "./cache/itemCache";
import { registerMachine } from "./utils/posDevice";
import { log } from "./utils/logger";
import { todayIST } from "./utils/timeUtils";

const { Text } = Typography;

function getRoles() {
  try { return JSON.parse(localStorage.getItem("roles") || "[]"); } catch { return []; }
}

function checkDayEndDone(branchCode) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const records = JSON.parse(localStorage.getItem("day_end_records") || "[]");
    return records.some((r) => r.dateKey === today && r.branchCode === branchCode);
  } catch { return false; }
}

function isDayEndRequired(branchCode) {
  try {
    const settings = JSON.parse(localStorage.getItem("pos_settings") || "{}");
    const list = settings.dayEndRequiredBranches;
    return Array.isArray(list) && list.includes(branchCode);
  } catch { return false; }
}

// Returns null if ok to proceed, or "YYYY-MM-DD" (the date needing day end) if blocked.
// Locally tracks the last date the POS properly closed (per branch).
// Only active when day end is configured as required for the branch (via POS Settings).
function checkDateAdvanceBlock(branchCode) {
  if (!branchCode) return null;
  if (!isDayEndRequired(branchCode)) return null;
  try {
    const key = `pos_business_date_${branchCode}`;
    const today = todayIST();
    const saved = localStorage.getItem(key);
    if (!saved) {
      localStorage.setItem(key, today);
      return null;
    }
    if (today <= saved) return null; // same day, no advance
    // Date advanced — check if day end was done for the saved date
    const records = JSON.parse(localStorage.getItem("day_end_records") || "[]");
    const done = records.some((r) => r.dateKey === saved && r.branchCode === branchCode);
    if (done) {
      localStorage.setItem(key, today);
      return null;
    }
    return saved; // blocked: must complete day end for this date
  } catch { return null; }
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
  const [isDayEndDone, setIsDayEndDone] = useState(() => checkDayEndDone(localStorage.getItem("selectedBranchCode") || ""));
  const [dayEndBlock, setDayEndBlock] = useState(null); // "YYYY-MM-DD" of pending date, or null

  // Recheck day-end status and date-advance block whenever page, branch, or login changes.
  useEffect(() => {
    if (!loggedIn) return;
    const done = checkDayEndDone(selectedBranchCode);
    setIsDayEndDone(done);
    const block = checkDateAdvanceBlock(selectedBranchCode);
    setDayEndBlock(block);
    if (block && activePage !== "day-end") { setActivePage("day-end"); return; }
    // If today's day end is done AND this branch requires it, push user away from billing pages
    if (done && isDayEndRequired(selectedBranchCode) && (activePage === "pos" || activePage === "kot")) setActivePage("day-end");
  }, [activePage, selectedBranchCode, loggedIn]);

  const prevBranchRef = useRef(null);
  const hasWB = roles.includes("WB");
  const hasPhysicalStock = roles.includes("PHYSICAL_STOCK") || roles.includes("PHYSICAL_STOCK_REDUCE");

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

  // Sync branch day-end requirements and today's day-end status from the backend on login.
  useEffect(() => {
    if (!loggedIn) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken")  || "";
    if (!tenantId || !token) return;
    const authHeaders = { Authorization: `Bearer ${token}` };

    // 1. Sync which branches require day end
    fetch(`/api/${tenantId}/branches`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        const required = list.filter((b) => b.dayEndRequired).map((b) => b.branchCode);
        const settings = JSON.parse(localStorage.getItem("pos_settings") || "{}");
        settings.dayEndRequiredBranches = required;
        localStorage.setItem("pos_settings", JSON.stringify(settings));
      })
      .catch(() => {});

    // 2. Reconcile today's day-end records against the backend.
    //    If admin cleared a day end, remove the stale localStorage record so billing unblocks.
    const branch = localStorage.getItem("selectedBranchCode") || "";
    if (!branch) return;
    const today = todayIST();
    fetch(`/api/${tenantId}/day-end/details/${branch}/${today}`, { headers: authHeaders })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!Array.isArray(data)) return;
        const existsInBackend = data.length > 0;
        const records = JSON.parse(localStorage.getItem("day_end_records") || "[]");
        const existsLocally = records.some((r) => r.dateKey === today && r.branchCode === branch);
        if (existsLocally && !existsInBackend) {
          const cleaned = records.filter((r) => !(r.dateKey === today && r.branchCode === branch));
          localStorage.setItem("day_end_records", JSON.stringify(cleaned));
        }
      })
      .catch(() => {});
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
    const allowedPages = ["pos", "kot", "day-end", "accept-stock", "stock-transfer", "st-history"];
    if (hasWB) allowedPages.push("weigh-bridge");
    if (hasPhysicalStock) allowedPages.push("physical-stock");
    const unsubscribe = window.POS.onNavigate((page) => {
      if (allowedPages.includes(page)) setActivePage(page);
    });
    return () => unsubscribe?.();
  }, [hasWB, hasPhysicalStock]);

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
              onClick={(e) => {
                log("Menu clicked:", e.key);
                if (dayEndBlock && e.key !== "day-end") {
                  message.warning(`Complete Day End for ${dayEndBlock} before continuing`);
                  return;
                }
                if (isDayEndDone && isDayEndRequired(selectedBranchCode) && (e.key === "pos" || e.key === "kot")) {
                  message.warning("Day End is completed. Billing is closed for today.");
                  return;
                }
                setActivePage(e.key);
              }}
              items={[
                { key: "pos", label: "POS" },
                { key: "kot", label: "KOT" },
                { key: "stock-transfer", label: "Stock Transfer" },
                { key: "st-history", label: "ST History" },
                { key: "day-end", label: "Day End" },
                { key: "accept-stock", label: "Accept Stock" },
                ...(hasWB ? [{ key: "weigh-bridge", label: "Weigh Bridge" }] : []),
                ...(hasPhysicalStock ? [{ key: "physical-stock", label: "Physical Stock" }] : []),
                {
                  key: "reports",
                  label: "Reports",
                  children: [
                    {
                      key: "salesman-report",
                      label: isDayEndDone ? "Salesman" : <Tooltip title="Complete Day End first">Salesman</Tooltip>,
                      disabled: !isDayEndDone,
                    },
                    { key: "item-sales-report",        label: "Item Sales" },
                    { key: "item-movement-report",     label: "Item Movement" },
                    { key: "st-in-report",             label: "Stock Transfer In" },
                  ],
                },
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
              {isAdminRole(roles) && (() => {
                const lock = getBranchLock();
                return lock ? (
                  <Popconfirm
                    title="Unlock this installation?"
                    description={`Locked to: ${lock.userCode.toUpperCase()} / ${lock.branchCode.toUpperCase()}. Remove lock to allow a different branch?`}
                    onConfirm={() => { clearBranchLock(); message.success("Branch lock cleared"); }}
                    okText="Unlock"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                  >
                    <Button size="small" danger>Unlock Branch</Button>
                  </Popconfirm>
                ) : null;
              })()}
              <Button
                size="small"
                danger
                onClick={() => { logout(); setLoggedIn(false); }}
              >
                Logout
              </Button>
            </div>
          </div>

          {dayEndBlock && (
            <Alert
              type="error"
              showIcon
              banner
              message={`Day End not completed for ${dayEndBlock}. Complete Day End to unlock the POS.`}
            />
          )}
          {!dayEndBlock && isDayEndDone && isDayEndRequired(selectedBranchCode) && (
            <Alert
              type="warning"
              showIcon
              banner
              message="Day End completed for today — Billing is closed. Use Reports to view the day's summary."
            />
          )}

          {activePage === "pos" && <POSPage selectedBranchCode={selectedBranchCode} onLogout={() => setLoggedIn(false)} prefillItems={kotPrefillItems} onPrefillUsed={() => setKotPrefillItems(null)} />}
          {activePage === "stock-transfer" && <StockTransferPage onClose={() => setActivePage("pos")} />}
          {activePage === "st-history" && <StockTransferHistoryPage onClose={() => setActivePage("pos")} />}
          {activePage === "day-end" && <DayEndPage />}
          {activePage === "accept-stock" && <AcceptStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "weigh-bridge" && hasWB && <WeighBridgePage />}
          {activePage === "physical-stock" && hasPhysicalStock && <PhysicalStockPage roles={roles} onClose={() => setActivePage("pos")} />}
          {activePage === "salesman-report" && isDayEndDone && <SalesmanReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "item-sales-report" && <ItemSalesReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "item-movement-report" && <ItemMovementReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "st-in-report" && <StockTransferInReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "kot" && <KOTPage selectedBranchCode={selectedBranchCode} onConvertToPOS={handleKotConvertToPOS} />}
        </div>
      )}
    </div>
  );
}
