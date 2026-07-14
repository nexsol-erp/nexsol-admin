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
import SalesReturnPage from "./pos/SalesReturnPage";
import UpdateChecker from "./components/UpdateChecker";
import { isLoggedIn, logout, isAdminRole, getBranchLock, clearBranchLock } from "./auth/auth";
import { clearItemCache, hasCache, loadAllItemsToCache } from "./cache/itemCache";
import { db } from "./cache/itemCacheDb";
import { registerMachine, fetchApprovedMachines, claimMachine } from "./utils/posDevice";
import { connect as wsConnect, disconnect as wsDisconnect, onMessage as wsOnMessage } from "./utils/posWebSocket";
import { log } from "./utils/logger";
import { todayIST } from "./utils/timeUtils";

const { Text } = Typography;

function getRoles() {
  try { return JSON.parse(localStorage.getItem("roles") || "[]"); } catch { return []; }
}

function checkDayEndDone(branchCode) {
  try {
    const today = todayIST();
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
  const [isDayEndDone, setIsDayEndDone] = useState(() => checkDayEndDone(localStorage.getItem("selectedBranchCode") || ""));
  const [dayEndBlock, setDayEndBlock] = useState(null); // "YYYY-MM-DD" of pending date, or null
  const [machineStatus, setMachineStatus] = useState(() => {
    const branch = localStorage.getItem("selectedBranchCode") || "";
    return localStorage.getItem(`posMachineStatus_${branch}`) || "";
  });

  const [approvedMachines,    setApprovedMachines]    = useState([]);
  const [fetchingMachines,    setFetchingMachines]    = useState(false);
  const [selectedMachineCode, setSelectedMachineCode] = useState("");
  const [claiming,            setClaiming]            = useState(false);


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

  // WebSocket — kept alive for the whole app session (all pages, not just POS),
  // so the server's online status reflects the app being open, not just the POS tab.
  useEffect(() => {
    if (!loggedIn || !selectedBranchCode) return;
    const tenant = localStorage.getItem("tenancyId") || "";
    const wsBase = typeof window !== "undefined" ? window.POS?.wsServer : "";
    wsConnect(tenant, selectedBranchCode, wsBase);
    return () => wsDisconnect();
  }, [loggedIn, selectedBranchCode]);

  // WebSocket message handlers — also kept alive for the whole app session (not
  // just while POSPage is mounted), so price/catalog pushes still land on the
  // local IndexedDB cache while the user is on Stock Transfer, Physical Stock, etc.
  useEffect(() => {
    if (!loggedIn || !selectedBranchCode) return;

    const unsubPrice = wsOnMessage("PRICE_CHANGE", async (msg) => {
      log("posWebSocket: PRICE_CHANGE received", JSON.stringify(msg));
      const changed = Array.isArray(msg.items)
        ? msg.items
        : msg.itemId ? [msg] : [];

      if (changed.length) {
        for (const patch of changed) {
          const existing = await db.items.get(patch.itemId);
          if (existing) await db.items.put({ ...existing, ...patch });
        }
        message.info(`Price updated for ${changed.length} item(s)`, 3);
      } else {
        message.info("Price update received — refreshing item cache…", 3);
        loadAllItemsToCache().catch(() => {});
      }
    });

    const unsubCatalog = wsOnMessage("CATALOG_REFRESH", () => {
      message.info("Catalogue updated — refreshing item cache…", 3);
      loadAllItemsToCache().catch(() => {});
    });

    const unsubNotify = wsOnMessage("NOTIFICATION", (msg) => {
      const text = msg.message || msg.text || "New notification";
      const type = (msg.type || "info").toLowerCase();
      if (type === "error")   message.error(text, 6);
      else if (type === "warning") message.warning(text, 5);
      else message.info(text, 4);
    });

    return () => {
      unsubPrice();
      unsubCatalog();
      unsubNotify();
    };
  }, [loggedIn, selectedBranchCode]);

  // Register this machine with the server on login / branch change.
  // New devices come back PENDING; approved devices come back with machineCode + FY data.
  useEffect(() => {
    if (!loggedIn || !selectedBranchCode) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId) return;
    const machineName = window.navigator?.userAgent?.split(" ").pop() || "";
    registerMachine(tenantId, selectedBranchCode, machineName).then((data) => {
      if (data?.status) setMachineStatus(data.status);
    });
  }, [selectedBranchCode, loggedIn]);

  // Poll every 30 s while PENDING so the screen unblocks as soon as admin approves.
  useEffect(() => {
    if (machineStatus !== "PENDING" || !loggedIn || !selectedBranchCode) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId) return;
    const machineName = window.navigator?.userAgent?.split(" ").pop() || "";
    const id = setInterval(() => {
      registerMachine(tenantId, selectedBranchCode, machineName).then((data) => {
        if (data?.status) setMachineStatus(data.status);
      });
    }, 30_000);
    return () => clearInterval(id);
  }, [machineStatus, loggedIn, selectedBranchCode]);

  // Fetch approved machines for the branch whenever the PENDING screen is shown.
  useEffect(() => {
    if (machineStatus !== "PENDING" || !loggedIn || !selectedBranchCode) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId) return;
    setFetchingMachines(true);
    fetchApprovedMachines(tenantId, selectedBranchCode).then((list) => {
      setApprovedMachines(list);
      setFetchingMachines(false);
    });
  }, [machineStatus, loggedIn, selectedBranchCode]);

  // Update window title whenever machine code is available.
  useEffect(() => {
    if (machineStatus !== "APPROVED" || !selectedBranchCode) return;
    const code = localStorage.getItem(`posMachineCode_${selectedBranchCode}`) || "";
    if (code && window.POS?.setWindowTitle) {
      window.POS.setWindowTitle(code);
    }
  }, [machineStatus, selectedBranchCode]);

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

  if (loggedIn && machineStatus === "PENDING") {
    const machineId = localStorage.getItem(`posMachineId_${selectedBranchCode}`) || "—";
    const tenantId  = localStorage.getItem("tenancyId") || "";

    const handleClaim = async () => {
      if (!selectedMachineCode) return;
      setClaiming(true);
      const data = await claimMachine(tenantId, selectedBranchCode, selectedMachineCode);
      setClaiming(false);
      if (data?.status === "APPROVED") {
        setMachineStatus("APPROVED");
      } else {
        message.error("Failed to claim machine. Please try again.");
      }
    };

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
        <div style={{ background: "#fff", padding: "40px 48px", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", maxWidth: 520, width: "100%" }}>
          <div style={{ textAlign: "center", fontSize: 48, marginBottom: 12 }}>⏳</div>
          <h2 style={{ textAlign: "center", marginBottom: 6 }}>Machine Pending Approval</h2>
          <p style={{ color: "#6b7280", marginBottom: 20, textAlign: "center" }}>
            This POS terminal is registered but has not yet been approved by an administrator.
          </p>

          <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: "#374151" }}>
            <strong>Branch:</strong> {selectedBranchCode}<br />
            <strong>Registration ID:</strong> {machineId}
          </div>

          {/* Machine picker */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, marginBottom: 20 }}>
            <p style={{ fontWeight: 600, marginBottom: 8, color: "#111827" }}>
              Or select an existing machine for this branch:
            </p>
            {fetchingMachines ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading machines…</p>
            ) : approvedMachines.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>
                No approved machines found for branch <strong>{selectedBranchCode}</strong>. Ask your manager to approve this terminal.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {approvedMachines.map((m) => (
                  <label
                    key={m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderRadius: 8, cursor: "pointer",
                      border: `2px solid ${selectedMachineCode === m.machineCode ? "#1976d2" : "#e5e7eb"}`,
                      background: selectedMachineCode === m.machineCode ? "#eff6ff" : "#fff",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="machineCode"
                      value={m.machineCode}
                      checked={selectedMachineCode === m.machineCode}
                      onChange={() => setSelectedMachineCode(m.machineCode)}
                      style={{ accentColor: "#1976d2" }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#1976d2" }}>{m.machineCode}</span>
                    {m.machineName && <span style={{ color: "#6b7280", fontSize: 13 }}>— {m.machineName}</span>}
                  </label>
                ))}
              </div>
            )}
            <Button
              type="primary"
              disabled={!selectedMachineCode || claiming}
              loading={claiming}
              onClick={handleClaim}
              style={{ width: "100%" }}
            >
              Use Machine {selectedMachineCode || "…"}
            </Button>
          </div>

          <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginBottom: 12 }}>
            Checking for approval every 30 seconds…
          </p>
          <Button danger size="small" style={{ width: "100%" }} onClick={() => { logout(); setLoggedIn(false); setMachineStatus(""); }}>
            Logout
          </Button>
        </div>
      </div>
    );
  }

  if (loggedIn && machineStatus === "REJECTED") {
    const machineId = localStorage.getItem(`posMachineId_${selectedBranchCode}`) || "—";
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
        <div style={{ textAlign: "center", background: "#fff", padding: "48px 64px", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", maxWidth: 480 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ marginBottom: 8, color: "#dc2626" }}>Machine Registration Rejected</h2>
          <p style={{ color: "#6b7280", marginBottom: 24 }}>
            An administrator has rejected this POS terminal. Contact your manager to resolve this.
          </p>
          <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "#374151" }}>
            <strong>Branch:</strong> {selectedBranchCode}<br />
            <strong>Registration ID:</strong> {machineId}
          </div>
          <Button danger size="small" onClick={() => { logout(); setLoggedIn(false); setMachineStatus(""); }}>
            Logout
          </Button>
        </div>
      </div>
    );
  }

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
                { key: "sales-return", label: "Sales Return" },
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

          {activePage === "pos" && <POSPage selectedBranchCode={selectedBranchCode} onLogout={() => setLoggedIn(false)} />}
          {activePage === "stock-transfer" && <StockTransferPage onClose={() => setActivePage("pos")} />}
          {activePage === "st-history" && <StockTransferHistoryPage onClose={() => setActivePage("pos")} />}
          {activePage === "day-end" && <DayEndPage pendingDate={dayEndBlock} />}
          {activePage === "accept-stock" && <AcceptStockPage onClose={() => setActivePage("pos")} />}
          {activePage === "sales-return" && <SalesReturnPage selectedBranchCode={selectedBranchCode} onClose={() => setActivePage("pos")} />}
          {activePage === "weigh-bridge" && hasWB && <WeighBridgePage />}
          {activePage === "physical-stock" && hasPhysicalStock && <PhysicalStockPage roles={roles} onClose={() => setActivePage("pos")} />}
          {activePage === "salesman-report" && isDayEndDone && <SalesmanReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "item-sales-report" && <ItemSalesReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "item-movement-report" && <ItemMovementReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "st-in-report" && <StockTransferInReportPage selectedBranchCode={selectedBranchCode} />}
          {activePage === "kot" && <KOTPage selectedBranchCode={selectedBranchCode} />}
        </div>
      )}
    </div>
  );
}
