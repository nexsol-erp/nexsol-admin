// src/components/KOTEntry.jsx
// Web KOT: table billing like the desktop POS KOT page. Pick a table, add items, send them to the
// kitchen (KOT), print the bill, then settle it into a sales invoice. Orders are kept on the server
// (/api/{tenant}/kot/tables) so every phone and tablet in the branch sees the same tables.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Badge, Button, Card, Checkbox, Dropdown, Empty, Grid, Input, InputNumber, Modal, Result,
  Segmented, Select, Space, Spin, Tag, Tooltip, Typography, message,
} from "antd";
import {
  AppstoreOutlined, ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined,
  DeleteOutlined, DollarOutlined, FireOutlined, LockOutlined, MergeCellsOutlined, MinusOutlined,
  MoreOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, ScissorOutlined, SearchOutlined,
  SettingOutlined, SyncOutlined, UserOutlined,
} from "@ant-design/icons";
import BarcodeScannerModal from "./BarcodeScannerModal";
import ItemPicker, { findByCode, normalizeItem } from "./pos/ItemPicker";
import { useBranch } from "./BranchContext";
import { billHtml, kotSlipHtml, printHtml, receiptHtml } from "./kot/kotPrint";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const LS_CACHE_KEY = "pos-item-cache-v1"; // shared with the web POS screen
const LS_RECENT_KEY = "kot-recent-items-v1";
const tablesKey = (branch) => `kot-tables-v1-${branch}`;
const PAY_MODES = ["CASH", "UPI", "CARD"];
const PAY_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card" };

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Server status (kot_trans_hdr.pos_converted) → how a table looks on the board.
const STATUS = {
  FREE: { label: "Free", color: "#389e0d", bg: "#f6ffed", border: "#b7eb8f" },
  OPEN: { label: "Ordering", color: "#d48806", bg: "#fffbe6", border: "#ffe58f" },
  PRINTED: { label: "In kitchen", color: "#d4380d", bg: "#fff2e8", border: "#ffbb96" },
  BILLED: { label: "Bill printed", color: "#1d39c4", bg: "#f0f5ff", border: "#adc6ff" },
};

const S = {
  // The app shell can be in dark mode while antd cards stay light, so keep a light surface.
  shell: { flex: 1, minWidth: 0, background: "#f0f2f5", color: "rgba(0,0,0,0.88)", minHeight: "calc(100vh - 64px)" },
  page: { padding: 16, maxWidth: 1400, margin: "0 auto" },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  logo: {
    width: 40, height: 40, borderRadius: 10, background: "#c026d3", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
  },
  card: { borderRadius: 10, minWidth: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  label: { fontSize: 12, color: "rgba(0,0,0,0.55)", marginBottom: 4 },
  totalBox: { background: "linear-gradient(135deg, #141a2e 0%, #24304f 100%)", color: "#fff", borderRadius: 10, padding: "14px 18px" },
  statRow: { display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8 },
  bottomBar: {
    position: "fixed", right: 0, bottom: 0, zIndex: 1000, background: "#fff",
    borderTop: "1px solid #e5e5e5", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", color: "#111",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
  },
  lineRow: {
    display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #f0f0f0",
  },
};

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

const defaultTables = () => Array.from({ length: 12 }, (_, i) => `T${i + 1}`);

// Sort T2 before T10.
const byName = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

function minutesSince(ts) {
  if (!ts) return null;
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}
const ago = (m) => (m == null ? "" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);

async function call(method, path, body) {
  const res = await fetch(`/api/${localStorage.getItem("tenancyId")}/kot${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    if (res.status === 401) throw new Error("Your session has expired. Please log in again.");
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

const toLocalLines = (ticket) => (ticket?.lines || []).map((l) => ({ ...l, key: l.id }));

const KOTEntry = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.lg;
  const isPhone = !screens.sm;
  const { branch: branchCode, setBranch, branches } = useBranch();
  const branchInfo = useMemo(() => branches.find((b) => b.branchCode === branchCode) || null, [branches, branchCode]);
  const printBranch = useMemo(() => ({
    branchName: branchInfo?.branchName,
    branchGst: branchInfo?.branchGst,
    branchAddress: [branchInfo?.branchBuildingAddress, branchInfo?.branchAddress1].filter(Boolean).join(", "),
  }), [branchInfo]);

  // ── board ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [tableNames, setTableNames] = useState(defaultTables);
  const [filter, setFilter] = useState("ALL");
  const [tableSearch, setTableSearch] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [newTable, setNewTable] = useState("");
  const [, setTick] = useState(0); // re-render every minute so "open for" stays current

  // ── order ────────────────────────────────────────────────────────────────
  const [view, setView] = useState("board");
  const [table, setTable] = useState(null);
  const [ticket, setTicket] = useState(null); // last server copy (id, kotNumber, status)
  const [lines, setLines] = useState([]);
  const [salesMan, setSalesMan] = useState(() => localStorage.getItem("kot-captain") || "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [mobilePane, setMobilePane] = useState("Menu");

  // ── items ────────────────────────────────────────────────────────────────
  const [cache, setCache] = useState(() => readJson(LS_CACHE_KEY, []).map(normalizeItem));
  const [recent, setRecent] = useState(() => readJson(LS_RECENT_KEY, []));
  const [syncing, setSyncing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const searchRef = useRef(null);

  // ── dialogs ──────────────────────────────────────────────────────────────
  const [settleOpen, setSettleOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitKeys, setSplitKeys] = useState([]);
  const [splitTarget, setSplitTarget] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState(null);
  const [done, setDone] = useState(null); // { inv, tableName, salesMan, tendered }

  // ── data loading ─────────────────────────────────────────────────────────
  const loadBoard = useCallback(async (quiet = false) => {
    if (!branchCode) return;
    if (!quiet) setLoadingBoard(true);
    try {
      setTickets((await call("GET", `/tables?branchCode=${encodeURIComponent(branchCode)}`)) || []);
    } catch (e) {
      if (!quiet) message.error(e.message);
    } finally {
      setLoadingBoard(false);
    }
  }, [branchCode]);

  useEffect(() => {
    if (!branchCode) return;
    setTableNames(readJson(tablesKey(branchCode), null) || defaultTables());
    loadBoard();
  }, [branchCode, loadBoard]);

  // Other devices change tables too, so refresh the board while it is on screen.
  useEffect(() => {
    if (view !== "board") return undefined;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (document.visibilityState === "visible") loadBoard(true);
    }, 20000);
    return () => clearInterval(id);
  }, [view, loadBoard]);

  const syncItems = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/${localStorage.getItem("tenancyId")}/items`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
      });
      if (!res.ok) throw new Error("Couldn't load items");
      const normalized = (await res.json()).map(normalizeItem);
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify(normalized));
      setCache(normalized);
      message.success(`${normalized.length.toLocaleString("en-IN")} items synced`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!cache.length) syncItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (view === "order" && (e.key === "F2" || (e.ctrlKey && e.key.toLowerCase() === "k"))) {
        e.preventDefault();
        setMobilePane("Menu");
        setTimeout(() => searchRef.current?.focus?.(), 30);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  // ── board derived ────────────────────────────────────────────────────────
  const ticketByTable = useMemo(() => {
    const m = {};
    tickets.forEach((t) => { m[t.tableName] = t; });
    return m;
  }, [tickets]);

  // Tables set up on this device, plus any table another device has an order on.
  const allTables = useMemo(
    () => Array.from(new Set([...tableNames, ...tickets.map((t) => t.tableName)])).sort(byName),
    [tableNames, tickets]
  );

  const statusOf = (name) => ticketByTable[name]?.status || "FREE";

  const counts = useMemo(() => {
    const c = { ALL: allTables.length, FREE: 0, OPEN: 0, PRINTED: 0, BILLED: 0 };
    allTables.forEach((n) => { c[statusOf(n)] += 1; });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTables, ticketByTable]);

  const runningTotal = tickets.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);

  const visibleTables = allTables.filter((n) => {
    if (tableSearch && !n.toLowerCase().includes(tableSearch.trim().toLowerCase())) return false;
    if (filter === "ALL") return true;
    if (filter === "BUSY") return statusOf(n) !== "FREE";
    return statusOf(n) === filter;
  });

  const saveTableNames = (next) => {
    const sorted = Array.from(new Set(next)).sort(byName);
    setTableNames(sorted);
    try { localStorage.setItem(tablesKey(branchCode), JSON.stringify(sorted)); } catch {}
  };

  const addTable = () => {
    const name = newTable.trim().toUpperCase();
    if (!name) return;
    if (name.length > 50) return message.warning("Keep table names under 50 characters");
    if (allTables.includes(name)) return message.warning(`${name} is already on the board`);
    saveTableNames([...tableNames, name]);
    setNewTable("");
  };

  // ── order: open / leave ──────────────────────────────────────────────────
  const loadTicketIntoView = (t) => {
    setTicket(t);
    setLines(toLocalLines(t));
    if (t?.salesManName) setSalesMan(t.salesManName);
    setDirty(false);
  };

  const openTable = async (name) => {
    setTable(name);
    setMobilePane("Menu");
    const existing = ticketByTable[name];
    if (existing) {
      loadTicketIntoView(existing);
      setMobilePane(isMobile ? "Order" : "Menu");
      // Pick up changes another device made since the board last refreshed.
      call("GET", `/tables/${existing.id}`).then(loadTicketIntoView).catch(() => {});
    } else {
      setTicket(null);
      setLines([]);
      setDirty(false);
    }
    setView("order");
    setTimeout(() => { if (!isMobile) searchRef.current?.focus?.(); }, 60);
  };

  const backToBoard = () => {
    setView("board");
    setTable(null);
    setTicket(null);
    setLines([]);
    setDirty(false);
    loadBoard(true);
  };

  // Leaving keeps the order on the table (like Hold on the desktop). An empty order frees it.
  const leaveTable = async () => {
    try {
      if (dirty && lines.length) {
        setBusy("save");
        await save();
        message.success(`${table} saved`);
      } else if (ticket?.id && !lines.length && !ticket.lines?.some((l) => l.printed)) {
        await call("DELETE", `/tables/${ticket.id}`);
      }
      backToBoard();
    } catch (e) {
      message.error(e.message);
    } finally {
      setBusy("");
    }
  };

  // ── order: lines ─────────────────────────────────────────────────────────
  const addItem = (it, qty = 1) => {
    setLines((prev) => {
      const idx = prev.findIndex((l) => !l.printed && String(l.itemId) === String(it.id) && Number(l.rate) === Number(it.rate));
      if (idx >= 0) {
        const next = [...prev];
        const q = r2(Number(next[idx].qty) + qty);
        next[idx] = { ...next[idx], qty: q, amount: r2(q * Number(next[idx].rate)) };
        return next;
      }
      return [...prev, {
        key: `n-${Date.now()}-${Math.random()}`, id: null, itemId: it.id, itemName: it.name, barcode: it.barcode || null,
        unit: it.unit || null, taxRate: it.taxRate || 0, qty, rate: it.rate, amount: r2(qty * it.rate), printed: false,
      }];
    });
    setDirty(true);
    const nextRecent = [it.id, ...recent.filter((x) => x !== it.id)].slice(0, 24);
    setRecent(nextRecent);
    try { localStorage.setItem(LS_RECENT_KEY, JSON.stringify(nextRecent)); } catch {}
  };

  const changeQty = (key, qty) => {
    const q = r2(qty);
    setLines((prev) => (q <= 0
      ? prev.filter((l) => l.key !== key)
      : prev.map((l) => (l.key === key ? { ...l, qty: q, amount: r2(q * Number(l.rate)) } : l))));
    setDirty(true);
  };

  const addByCode = (raw) => {
    const it = findByCode(cache, raw);
    if (!it) return false;
    addItem(it);
    message.success({ content: `${it.name} added`, duration: 1 });
    return true;
  };

  // ── order: server actions ────────────────────────────────────────────────
  const save = async () => {
    const t = await call("PUT", "/tables", {
      id: ticket?.id || null,
      branchCode,
      tableName: table,
      salesManName: salesMan || null,
      lines: lines.map((l) => ({
        id: l.id, itemId: l.itemId, itemName: l.itemName, barcode: l.barcode, unit: l.unit,
        taxRate: l.taxRate, qty: l.qty, rate: l.rate, amount: l.amount, printed: l.printed,
      })),
    });
    loadTicketIntoView(t);
    return t;
  };

  const ensureSaved = async () => (dirty || !ticket?.id ? save() : ticket);

  const run = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
    } catch (e) {
      message.error({ content: e.message, duration: 5 });
    } finally {
      setBusy("");
    }
  };

  const sendKot = (onlyNew) => run("kot", async () => {
    const t = await ensureSaved();
    const res = await call("POST", `/tables/${t.id}/print`, { onlyNew });
    printHtml(kotSlipHtml({
      branch: printBranch, kotNumber: res.ticket.kotNumber, tableName: table,
      salesMan: res.ticket.salesManName, items: res.printLines, duplicate: res.duplicate,
    }));
    message.success(res.duplicate ? "Duplicate KOT printed" : `KOT sent to kitchen · ${res.printLines.length} item${res.printLines.length === 1 ? "" : "s"}`);
    if (res.duplicate) loadTicketIntoView(res.ticket);
    else backToBoard();
  });

  const printBill = () => run("bill", async () => {
    const t = await ensureSaved();
    const billed = await call("POST", `/tables/${t.id}/bill`);
    loadTicketIntoView(billed);
    printHtml(billHtml({ branch: printBranch, kotNumber: billed.kotNumber, tableName: table, salesMan: billed.salesManName, items: billed.lines }));
  });

  const openSettle = () => run("settle", async () => {
    await ensureSaved();
    setSettleOpen(true);
  });

  const settle = async ({ customerId, payments, tendered }) => {
    const inv = await call("POST", `/tables/${ticket.id}/convert`, { customerId, salesManName: salesMan || null, payments });
    const info = { inv, tableName: table, salesMan: salesMan || ticket.salesManName, tendered };
    setSettleOpen(false);
    printHtml(receiptHtml(info));
    setDone(info);
    backToBoard();
  };

  const discard = () => Modal.confirm({
    title: `Discard the order on ${table}?`,
    content: "The items haven't gone to the kitchen, so the table will be freed.",
    okText: "Discard",
    okButtonProps: { danger: true },
    onOk: async () => {
      try {
        if (ticket?.id) await call("DELETE", `/tables/${ticket.id}`);
        backToBoard();
      } catch (e) {
        message.error(e.message);
      }
    },
  });

  const openSplit = () => run("split", async () => {
    await ensureSaved();
    setSplitKeys([]);
    setSplitTarget(null);
    setSplitOpen(true);
  });

  const doSplit = () => run("split", async () => {
    const target = await call("POST", `/tables/${ticket.id}/split`, { lineIds: splitKeys, targetTable: splitTarget });
    setSplitOpen(false);
    message.success(`Moved ${splitKeys.length} item${splitKeys.length === 1 ? "" : "s"} to ${target.tableName}`);
    const moveAll = splitKeys.length === lines.length;
    if (moveAll) return backToBoard();
    loadTicketIntoView(await call("GET", `/tables/${ticket.id}`));
    loadBoard(true);
  });

  const openMerge = () => run("merge", async () => {
    await ensureSaved();
    await loadBoard(true);
    setMergeSource(null);
    setMergeOpen(true);
  });

  const doMerge = () => run("merge", async () => {
    const from = tickets.find((t) => t.id === mergeSource);
    loadTicketIntoView(await call("POST", `/tables/${ticket.id}/merge`, { sourceId: mergeSource }));
    setMergeOpen(false);
    message.success(`${from?.tableName || "Table"} merged into ${table}`);
    loadBoard(true);
  });

  // ── order derived ────────────────────────────────────────────────────────
  const total = r2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const gstIncluded = r2(lines.reduce((s, l) => {
    const rate = Number(l.taxRate) || 0;
    return s + (rate ? (Number(l.amount) * rate) / (100 + rate) : 0);
  }, 0));
  const itemCount = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const sentLines = lines.filter((l) => l.printed);
  const newLines = lines.filter((l) => !l.printed);
  const status = ticket?.status || (lines.length ? "OPEN" : "FREE");

  const newQtyByItem = useMemo(() => {
    const m = {};
    newLines.forEach((l) => { m[l.itemId] = (m[l.itemId] || 0) + Number(l.qty); });
    return m;
  }, [newLines]);

  const otherBusyTables = tickets.filter((t) => t.id !== ticket?.id);

  // ════════════════════════════════════════════════════════════════════════
  // Board
  // ════════════════════════════════════════════════════════════════════════
  const statTile = (label, value, color) => (
    <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>{label}</div>
      <div style={{ fontSize: isPhone ? 18 : 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );

  const tableCard = (name) => {
    const t = ticketByTable[name];
    const st = STATUS[t?.status || "FREE"] || STATUS.FREE;
    const mins = t ? minutesSince(t.voucherDate) : null;
    const pending = t ? t.lines.filter((l) => !l.printed).length : 0;
    return (
      <div
        key={name}
        role="button"
        tabIndex={0}
        onClick={() => openTable(name)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openTable(name)}
        style={{
          background: st.bg, border: `1.5px solid ${st.border}`, borderTop: `4px solid ${st.color}`, borderRadius: 12,
          padding: 12, cursor: "pointer", userSelect: "none", minHeight: isPhone ? 104 : 122, display: "flex",
          flexDirection: "column", justifyContent: "space-between", boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          transition: "transform .1s, box-shadow .1s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)"; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
          <div style={{ fontSize: isPhone ? 20 : 24, fontWeight: 800, color: "#1f1f1f", lineHeight: 1.1, wordBreak: "break-word" }}>{name}</div>
          {pending > 0 && (
            <Tooltip title={`${pending} item${pending === 1 ? "" : "s"} not sent to kitchen`}>
              <Badge count={pending} style={{ background: "#faad14" }} />
            </Tooltip>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: st.color }}>{st.label}</div>
          {t ? (
            <>
              <div style={{ fontSize: isPhone ? 15 : 17, fontWeight: 700, color: "#1f1f1f" }}>{inr(t.totalAmount)}</div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {mins != null && <span><ClockCircleOutlined /> {ago(mins)}</span>}
                {t.salesManName && <span><UserOutlined /> {t.salesManName}</span>}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.45)" }}>Tap to start</div>
          )}
        </div>
      </div>
    );
  };

  const board = (
    <>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={S.logo}><FireOutlined /></div>
          <div style={{ minWidth: 0 }}>
            <Title level={isPhone ? 5 : 4} style={{ margin: 0 }}>KOT · Tables</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {branchInfo ? `${branchInfo.branchCode} · ${branchInfo.branchName}` : "Pick a table to start an order"}
            </Text>
          </div>
        </div>
        <Space wrap>
          {branches.length > 1 && (
            <Select
              value={branchCode || undefined}
              placeholder="Branch"
              onChange={setBranch}
              style={{ minWidth: 160 }}
              options={branches.map((b) => ({ value: b.branchCode, label: b.branchName ? `${b.branchCode} · ${b.branchName}` : b.branchCode }))}
            />
          )}
          <Tooltip title="Refresh tables">
            <Button icon={<ReloadOutlined spin={loadingBoard} />} onClick={() => loadBoard()} />
          </Tooltip>
          <Tooltip title={`${cache.length.toLocaleString("en-IN")} items on this device`}>
            <Button icon={<SyncOutlined spin={syncing} />} onClick={syncItems}>{isPhone ? null : "Sync items"}</Button>
          </Tooltip>
          <Button icon={<SettingOutlined />} onClick={() => setManageOpen(true)}>{isPhone ? null : "Tables"}</Button>
        </Space>
      </div>

      {!branchCode ? (
        <Card style={S.card}><Empty description="Select a branch to see its tables" /></Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isPhone ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
            {statTile("Free tables", counts.FREE, STATUS.FREE.color)}
            {statTile("Occupied", counts.OPEN + counts.PRINTED + counts.BILLED, STATUS.PRINTED.color)}
            {statTile("Bill printed", counts.BILLED, STATUS.BILLED.color)}
            {statTile("Running total", inr(runningTotal), "#1f1f1f")}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ maxWidth: "100%", overflowX: "auto" }}>
              <Segmented
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "ALL", label: `All ${counts.ALL}` },
                  { value: "FREE", label: `Free ${counts.FREE}` },
                  { value: "BUSY", label: `Occupied ${counts.OPEN + counts.PRINTED + counts.BILLED}` },
                  { value: "BILLED", label: `Billed ${counts.BILLED}` },
                ]}
              />
            </div>
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              placeholder="Find table"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              style={{ width: isPhone ? "100%" : 200 }}
            />
          </div>

          <Spin spinning={loadingBoard && !tickets.length}>
            {visibleTables.length ? (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${isPhone ? 130 : 160}px, 1fr))`, gap: 12 }}>
                {visibleTables.map(tableCard)}
              </div>
            ) : (
              <Card style={S.card}><Empty description={filter === "ALL" ? "No tables yet. Add some from Tables." : "No tables here"} /></Card>
            )}
          </Spin>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16, fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
            {Object.entries(STATUS).map(([k, s]) => (
              <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }} />{s.label}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  );

  // ════════════════════════════════════════════════════════════════════════
  // Order
  // ════════════════════════════════════════════════════════════════════════
  const st = STATUS[status] || STATUS.OPEN;

  const qtyStepper = (l) => (
    <Space.Compact size="small">
      <Button icon={<MinusOutlined />} aria-label="Less" onClick={() => changeQty(l.key, Number(l.qty) - 1)} />
      <InputNumber
        size="small" min={0} value={l.qty} controls={false} inputMode="decimal"
        style={{ width: 48, textAlign: "center" }}
        onChange={(v) => v != null && changeQty(l.key, v)}
      />
      <Button icon={<PlusOutlined />} aria-label="More" onClick={() => changeQty(l.key, Number(l.qty) + 1)} />
    </Space.Compact>
  );

  const lineRow = (l) => (
    <div key={l.key} style={S.lineRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.itemName}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {l.printed ? `${l.qty} × ${inr(l.rate)}` : inr(l.rate)} · <b style={{ color: "#1f1f1f" }}>{inr(l.amount)}</b>
        </Text>
      </div>
      {l.printed ? (
        <Tooltip title="Already sent to the kitchen">
          <Tag icon={<LockOutlined />} color="volcano" style={{ margin: 0 }}>Sent</Tag>
        </Tooltip>
      ) : (
        <Space size={4}>
          {qtyStepper(l)}
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove" onClick={() => changeQty(l.key, 0)} />
        </Space>
      )}
    </div>
  );

  const menuPane = (
    <Card style={S.card} bodyStyle={{ padding: isPhone ? 12 : 16 }}>
      <ItemPicker
        ref={searchRef}
        items={cache}
        recent={recent}
        qtyById={newQtyByItem}
        onPick={(it) => addItem(it)}
        onCode={addByCode}
        onScan={() => setScanOpen(true)}
        accent="#c026d3"
        accentBg="#fdf4ff"
        isPhone={isPhone}
        isMobile={isMobile}
        maxHeight="calc(100vh - 290px)"
      />
    </Card>
  );

  const moreMenu = {
    items: [
      { key: "reprint", icon: <PrinterOutlined />, label: "Reprint full KOT", disabled: !sentLines.length },
      { key: "split", icon: <ScissorOutlined />, label: "Move items to another table", disabled: !lines.length },
      { key: "merge", icon: <MergeCellsOutlined />, label: "Merge another table here", disabled: !lines.length || !otherBusyTables.length },
      { type: "divider" },
      { key: "discard", icon: <DeleteOutlined />, label: "Discard order", danger: true, disabled: sentLines.length > 0 },
    ],
    onClick: ({ key }) => {
      if (key === "reprint") sendKot(false);
      if (key === "split") openSplit();
      if (key === "merge") openMerge();
      if (key === "discard") discard();
    },
  };

  const actionButtons = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      <Button
        size="large" type="primary" icon={<FireOutlined />} loading={busy === "kot"} disabled={!newLines.length}
        onClick={() => sendKot(true)} style={{ gridColumn: "1 / -1", background: newLines.length ? "#c026d3" : undefined, borderColor: newLines.length ? "#c026d3" : undefined }}
      >
        {newLines.length ? `Send KOT · ${newLines.length} new` : "All items sent"}
      </Button>
      <Button size="large" icon={<PrinterOutlined />} loading={busy === "bill"} disabled={!lines.length} onClick={printBill}>
        Print bill
      </Button>
      <Button
        size="large" type="primary" icon={<DollarOutlined />} loading={busy === "settle"} disabled={!lines.length}
        onClick={openSettle} style={lines.length ? { background: "#16a34a", borderColor: "#16a34a" } : undefined}
      >
        Settle
      </Button>
    </div>
  );

  const orderPane = (
    <Card style={S.card} bodyStyle={{ padding: isPhone ? 12 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Text strong style={{ fontSize: 15 }}>Order</Text>
        <Space size={4}>
          {ticket?.kotNumber && <Tag color="purple" style={{ margin: 0 }}>KOT {ticket.kotNumber}</Tag>}
          <Dropdown menu={moreMenu} trigger={["click"]} placement="bottomRight">
            <Button icon={<MoreOutlined />} aria-label="More actions" />
          </Dropdown>
        </Space>
      </div>

      {!lines.length ? (
        <Empty
          image={<AppstoreOutlined style={{ fontSize: 40, color: "#bfbfbf" }} />}
          imageStyle={{ height: 44 }}
          description={<span>No items yet<br /><Text type="secondary" style={{ fontSize: 12 }}>Tap items on the menu to add them</Text></span>}
          style={{ padding: "24px 0" }}
        />
      ) : (
        <div style={{ maxHeight: isMobile ? "none" : "calc(100vh - 470px)", minHeight: isMobile ? 0 : 120, overflowY: isMobile ? "visible" : "auto" }}>
          {newLines.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#d48806", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 }}>
                New · not sent to kitchen
              </div>
              {newLines.map(lineRow)}
            </>
          )}
          {sentLines.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#d4380d", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 12 }}>
                <CheckCircleOutlined /> Sent to kitchen
              </div>
              {sentLines.map(lineRow)}
            </>
          )}
        </div>
      )}

      <div style={{ ...S.totalBox, marginTop: 12 }}>
        <div style={S.statRow}><span>Items</span><span>{r2(itemCount)}</span></div>
        <div style={S.statRow}><span>GST included</span><span>{inr(gstIncluded)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 14, opacity: 0.9 }}>Total</span>
          <span style={{ fontSize: 26, fontWeight: 700 }}>{inr(total)}</span>
        </div>
      </div>

      {!isMobile && <div style={{ marginTop: 12 }}>{actionButtons()}</div>}
    </Card>
  );

  const order = (
    <>
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={leaveTable} loading={busy === "save"} aria-label="Back to tables">
            {isPhone ? null : "Tables"}
          </Button>
          <div style={{ minWidth: 0 }}>
            <Space size={8} align="center" wrap>
              <Title level={isPhone ? 4 : 3} style={{ margin: 0 }}>{table}</Title>
              <Tag style={{ margin: 0, color: st.color, background: st.bg, borderColor: st.border, fontWeight: 600 }}>{st.label}</Tag>
              {dirty && <Tag color="gold" style={{ margin: 0 }}>Unsaved</Tag>}
            </Space>
            {ticket?.voucherDate && (
              <div><Text type="secondary" style={{ fontSize: 12 }}><ClockCircleOutlined /> Open {ago(minutesSince(ticket.voucherDate))}</Text></div>
            )}
          </div>
        </div>
        <Input
          prefix={<UserOutlined style={{ color: "#bfbfbf" }} />}
          placeholder="Captain / waiter"
          value={salesMan}
          maxLength={50}
          onChange={(e) => {
            setSalesMan(e.target.value);
            setDirty(true);
            try { localStorage.setItem("kot-captain", e.target.value); } catch {}
          }}
          style={{ width: isPhone ? "100%" : 220 }}
        />
      </div>

      {isMobile ? (
        <>
          <Segmented
            block
            value={mobilePane}
            onChange={setMobilePane}
            style={{ marginBottom: 12 }}
            options={[
              { value: "Menu", label: "Menu" },
              { value: "Order", label: <span>Order {lines.length ? <Badge count={lines.length} size="small" style={{ background: "#c026d3" }} /> : null}</span> },
            ]}
          />
          {mobilePane === "Menu" ? menuPane : orderPane}
          <div style={{ height: 150 }} />
          <div style={{ ...S.bottomBar, left: screens.sm ? 240 : 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.55)" }}>{lines.length} line{lines.length === 1 ? "" : "s"} · {table}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{inr(total)}</div>
            </div>
            <div style={{ flex: 1, maxWidth: 360 }}>{actionButtons()}</div>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 400px", gap: 16, alignItems: "start" }}>
          {menuPane}
          <div style={{ position: "sticky", top: 16 }}>{orderPane}</div>
        </div>
      )}
    </>
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.shell}>
      <div style={{ ...S.page, padding: isPhone ? 12 : 16 }}>{view === "board" ? board : order}</div>

      <SettleModal
        open={settleOpen}
        tableName={table}
        total={total}
        unsent={newLines.length}
        onCancel={() => setSettleOpen(false)}
        onSettle={settle}
      />

      <Modal
        open={splitOpen}
        title={`Move items from ${table}`}
        onCancel={() => setSplitOpen(false)}
        onOk={doSplit}
        okText="Move items"
        okButtonProps={{ disabled: !splitKeys.length || !splitTarget, loading: busy === "split" }}
        centered
      >
        <Text type="secondary" style={{ fontSize: 12 }}>Select the items, then the table to move them to.</Text>
        <div style={{ maxHeight: 260, overflowY: "auto", margin: "8px 0 12px", border: "1px solid #f0f0f0", borderRadius: 8, padding: "4px 12px" }}>
          <Checkbox.Group value={splitKeys} onChange={setSplitKeys} style={{ width: "100%" }}>
            {lines.map((l) => (
              <div key={l.id || l.key} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #fafafa" }}>
                <Checkbox value={l.id}>{l.itemName} × {l.qty}</Checkbox>
                <Text>{inr(l.amount)}</Text>
              </div>
            ))}
          </Checkbox.Group>
        </div>
        <div style={S.label}>Move to</div>
        <Select
          style={{ width: "100%" }}
          placeholder="Pick a table"
          value={splitTarget}
          onChange={setSplitTarget}
          showSearch
          options={allTables.filter((n) => n !== table).map((n) => {
            const t = ticketByTable[n];
            return { value: n, label: t ? `${n} · ${(STATUS[t.status] || STATUS.OPEN).label} · ${inr(t.totalAmount)}` : `${n} · Free` };
          })}
        />
      </Modal>

      <Modal
        open={mergeOpen}
        title={`Merge into ${table}`}
        onCancel={() => setMergeOpen(false)}
        onOk={doMerge}
        okText="Merge"
        okButtonProps={{ disabled: !mergeSource, loading: busy === "merge" }}
        centered
      >
        <Text type="secondary" style={{ fontSize: 12 }}>
          All items from the table you pick move to {table}, and that table becomes free.
        </Text>
        <Select
          style={{ width: "100%", marginTop: 12 }}
          placeholder="Pick a table"
          value={mergeSource}
          onChange={setMergeSource}
          options={otherBusyTables.map((t) => ({ value: t.id, label: `${t.tableName} · ${(STATUS[t.status] || STATUS.OPEN).label} · ${inr(t.totalAmount)}` }))}
        />
      </Modal>

      <Modal open={manageOpen} title="Tables" onCancel={() => setManageOpen(false)} footer={null} centered>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tables are set up per branch on this device. A table with an open order always shows, whichever device started it.
        </Text>
        <Space.Compact style={{ width: "100%", margin: "12px 0" }}>
          <Input
            placeholder="e.g. T13, VIP-1, Terrace 2"
            value={newTable}
            onChange={(e) => setNewTable(e.target.value)}
            onPressEnter={addTable}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={addTable}>Add</Button>
        </Space.Compact>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {tableNames.map((n) => (
            <Tag
              key={n}
              closable={!ticketByTable[n]}
              onClose={(e) => { e.preventDefault(); saveTableNames(tableNames.filter((x) => x !== n)); }}
              style={{ fontSize: 13, padding: "2px 8px", margin: 0 }}
            >
              {n}
            </Tag>
          ))}
        </div>
      </Modal>

      <Modal open={!!done} onCancel={() => setDone(null)} footer={null} centered width={420}>
        {done && (
          <Result
            status="success"
            title={`Invoice ${done.inv.voucherNumber}`}
            subTitle={`${done.tableName} settled · ${inr(done.inv.totalAmount)}`}
            extra={[
              <Button key="print" icon={<PrinterOutlined />} onClick={() => printHtml(receiptHtml(done))}>Reprint receipt</Button>,
              <Button key="next" type="primary" onClick={() => setDone(null)}>Next table</Button>,
            ]}
          >
            {(() => {
              const cash = done.inv.payments?.find((p) => p.receiptMode === "CASH");
              const change = cash && done.tendered > cash.amount ? r2(done.tendered - cash.amount) : 0;
              return change > 0 ? (
                <div style={{ textAlign: "center", fontSize: 18 }}>Give change <b style={{ color: "#16a34a" }}>{inr(change)}</b></div>
              ) : null;
            })()}
          </Result>
        )}
      </Modal>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onDetected={(code) => {
          setScanOpen(false);
          if (!addByCode(code)) message.error("Item not found");
        }}
      />
    </div>
  );
};

// Payment for a table: one mode, or split across Cash / UPI / Card. Customer defaults to walk-in.
function SettleModal({ open, tableName, total, unsent, onCancel, onSettle }) {
  const [mode, setMode] = useState("CASH");
  const [tendered, setTendered] = useState(0);
  const [split, setSplit] = useState({ CASH: 0, UPI: 0, CARD: 0 });
  const [customers, setCustomers] = useState(null);
  const [customerId, setCustomerId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("CASH");
    setTendered(total);
    setSplit({ CASH: 0, UPI: 0, CARD: 0 });
    setCustomerId(null);
    if (customers === null) {
      fetch(`/api/${localStorage.getItem("tenancyId")}/customers`, { headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` } })
        .then((r) => (r.ok ? r.json() : []))
        .then((d) => setCustomers(Array.isArray(d) ? d : []))
        .catch(() => setCustomers([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const splitPaid = r2(PAY_MODES.reduce((s, m) => s + (Number(split[m]) || 0), 0));
  const change = mode === "CASH" ? r2((Number(tendered) || 0) - total) : 0;
  const quick = useMemo(() => {
    const v = [r2(total)];
    [100, 500, 2000].forEach((n) => { const x = Math.ceil(total / n) * n; if (!v.includes(x)) v.push(x); });
    return v.slice(0, 4);
  }, [total]);

  const ready = mode === "SPLIT" ? Math.abs(splitPaid - total) < 0.01 : mode !== "CASH" || (Number(tendered) || 0) >= total - 0.001;

  const submit = async () => {
    const payments = mode === "SPLIT"
      ? PAY_MODES.filter((m) => Number(split[m]) > 0).map((m) => ({ receiptMode: m, amount: r2(split[m]) }))
      : [{ receiptMode: mode, amount: r2(total) }];
    setSaving(true);
    try {
      await onSettle({ customerId, payments, tendered: mode === "CASH" ? Number(tendered) || 0 : 0 });
    } catch (e) {
      message.error({ content: e.message, duration: 5 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onCancel={onCancel} footer={null} centered width={440} title={`Settle ${tableName || ""}`} destroyOnClose>
      <div style={{ ...S.totalBox, textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, opacity: 0.8 }}>Amount to collect</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{inr(total)}</div>
      </div>

      {unsent > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }}
          message={`${unsent} item${unsent === 1 ? " hasn't" : "s haven't"} been sent to the kitchen yet.`} />
      )}

      <div style={S.label}>Customer</div>
      <Select
        allowClear
        showSearch
        loading={customers === null}
        style={{ width: "100%", marginBottom: 12 }}
        placeholder="Walk-in customer"
        value={customerId}
        onChange={setCustomerId}
        optionFilterProp="label"
        options={(customers || []).map((c) => ({ value: c.id, label: [c.name, c.mobile].filter(Boolean).join(" · ") }))}
      />

      <div style={S.label}>Payment</div>
      <Segmented
        block
        value={mode}
        onChange={setMode}
        style={{ marginBottom: 12 }}
        options={[...PAY_MODES.map((m) => ({ value: m, label: PAY_LABELS[m] })), { value: "SPLIT", label: "Split" }]}
      />

      {mode === "CASH" && (
        <>
          <div style={S.label}>Cash received</div>
          <InputNumber size="large" prefix="₹" min={0} value={tendered} inputMode="decimal" controls={false}
            style={{ width: "100%" }} onChange={(v) => setTendered(v || 0)} onFocus={(e) => e.target.select()} />
          <Space wrap style={{ marginTop: 8 }}>
            {quick.map((v) => <Button key={v} size="small" onClick={() => setTendered(v)}>{inr(v)}</Button>)}
          </Space>
          <div style={{ marginTop: 10, fontSize: 15 }}>
            {change >= 0
              ? <>Change: <b style={{ color: "#16a34a" }}>{inr(change)}</b></>
              : <>Short by: <b style={{ color: "#cf1322" }}>{inr(-change)}</b></>}
          </div>
        </>
      )}

      {mode === "SPLIT" && (
        <div style={{ display: "grid", gap: 8 }}>
          {PAY_MODES.map((m) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", gap: 8, alignItems: "center" }}>
              <Text>{PAY_LABELS[m]}</Text>
              <InputNumber prefix="₹" min={0} value={split[m]} controls={false} inputMode="decimal" style={{ width: "100%" }}
                onChange={(v) => setSplit((s) => ({ ...s, [m]: v || 0 }))} />
              <Button size="small" onClick={() => setSplit((s) => ({ ...s, [m]: r2(Number(s[m] || 0) + total - splitPaid) }))}
                disabled={splitPaid >= total}>Rest</Button>
            </div>
          ))}
          <Text type={Math.abs(splitPaid - total) < 0.01 ? "success" : "warning"}>
            {Math.abs(splitPaid - total) < 0.01 ? "Fully paid" : `Remaining ${inr(total - splitPaid)}`}
          </Text>
        </div>
      )}

      <Button type="primary" block size="large" icon={<DollarOutlined />} disabled={!ready} loading={saving} onClick={submit}
        style={{ marginTop: 16, background: ready ? "#16a34a" : undefined, borderColor: ready ? "#16a34a" : undefined }}>
        Save invoice & print receipt
      </Button>
    </Modal>
  );
}

export default KOTEntry;
