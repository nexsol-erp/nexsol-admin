import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, InputNumber, Modal, Radio, Select, Space, Table, Tag, message } from "antd";
import { RobotOutlined, SyncOutlined } from "@ant-design/icons";
import ItemLookupModal from "../components/ItemLookupModal";
import { apiUrl, aiUrl } from "../utils/apiUrl";
import { db } from "../cache/itemCacheDb";
import { decodeJwtPayload } from "../auth/auth";
import {
  queueStockTransfer,
  getPendingStockCount,
  getFailedStockCount,
  retryFailedStockTransfers,
  syncPendingStockTransfers,
} from "./offlineStockQueue";
import { applySaleToCache } from "../cache/itemCache";
import { buildTransferHtml } from "./transferPrint";
import { generateTransferVoucherNumber } from "../utils/posDevice";
import { nowIST, todayIST } from "../utils/timeUtils";

const HOLD_KEY = "stock_transfer_holds";

function round2n(v) {
  const n = Number(v) || 0;
  return Math.round(n * 100) / 100;
}

function round2(v) {
  return round2n(v).toFixed(2);
}

function readHoldList() {
  try {
    const raw = localStorage.getItem(HOLD_KEY) || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeHoldList(rows) {
  localStorage.setItem(HOLD_KEY, JSON.stringify(rows));
}

// POS-style field label
const lbl = (text) => (
  <div style={{ fontSize: 11, fontWeight: "bold", color: "#000", marginBottom: 1 }}>{text}</div>
);

export default function StockTransferPage({ onClose }) {
  const itemSearchRef      = useRef(null);
  const qtyRefs            = useRef(new Map());
  const pendingQtyFocusKey = useRef(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");

  const [itemQuery, setItemQuery] = useState("");
  const [toBranchCode, setToBranchCode] = useState("");
  const [toBranchName, setToBranchName] = useState("");
  const [toBranchState, setToBranchState] = useState("");
  const [toBranchGst, setToBranchGst] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryAddress1, setDeliveryAddress1] = useState("");
  const [deliveryAddress2, setDeliveryAddress2] = useState("");

  const [printMode, setPrintMode] = useState("pdf");
  const [reasonCode, setReasonCode] = useState("NORMAL DC");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingHold, setSavingHold] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [holdRows, setHoldRows] = useState([]);
  const [selectedHoldId, setSelectedHoldId] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // AI recommendations
  const [aiState, setAiState] = useState("idle");
  const [aiError, setAiError] = useState("");
  const [aiCount, setAiCount] = useState(0);
  const [maxAiItems, setMaxAiItems] = useState(
    () => Number(localStorage.getItem("ai_transfer_max_items") || 20)
  );
  const skipAiFetch = useRef(false);

  const updateMaxAiItems = (val) => {
    const n = Math.max(1, Math.min(200, Number(val) || 20));
    setMaxAiItems(n);
    localStorage.setItem("ai_transfer_max_items", String(n));
  };

  const tenantId = localStorage.getItem("tenancyId") || "";
  const token = localStorage.getItem("jwtToken") || "";
  const payload = decodeJwtPayload(token) || {};
  const username = String(payload.sub || payload.username || "");
  const fromBranch = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

  const [allBranches, setAllBranches] = useState([]);
  const [transferBranchCodes, setTransferBranchCodes] = useState(null);

  const EXCLUDED_BRANCH_TYPES = new Set(["BAKERY_PROD", "BAKERY_BO"]);

  const branchOptions = useMemo(() => {
    const seen = new Set();
    return allBranches
      .filter((b) => {
        const type = b.branchType ?? b.branch_type ?? null;
        return !type || !EXCLUDED_BRANCH_TYPES.has(type);
      })
      .map((b) => String(b.branchCode ?? "").trim())
      .filter((code) => code && code !== fromBranch)
      .filter((code) => !transferBranchCodes || transferBranchCodes.has(code))
      .filter((code) => {
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((code) => ({ value: code, label: code }));
  }, [allBranches, fromBranch, transferBranchCodes]);

  useEffect(() => {
    setHoldRows(readHoldList());
  }, []);

  useEffect(() => {
    if (!tenantId || !token) return;
    fetch(apiUrl(`/api/${tenantId}/branches`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setAllBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [tenantId, token]);

  useEffect(() => {
    if (!tenantId || !token || !username) {
      setTransferBranchCodes(null);
      return;
    }
    fetch(apiUrl(`/api/${tenantId}/admin/users/${encodeURIComponent(username)}/transfer-branches`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const codes = Array.isArray(data)
          ? data.filter((x) => typeof x === "string")
          : Array.isArray(data.branches)
            ? data.branches.filter((x) => typeof x === "string")
            : [];
        setTransferBranchCodes(codes.length ? new Set(codes) : null);
      })
      .catch(() => { setTransferBranchCodes(null); });
  }, [tenantId, token, username]);

  useEffect(() => {
    if (!toBranchCode) return;
    const b = allBranches.find(
      (x) => String(x.branchCode ?? "").toUpperCase() === toBranchCode.toUpperCase()
    );
    if (!b) return;
    setToBranchName(String(b.branchName ?? ""));
    setToBranchState(String(b.branchState ?? ""));
    setToBranchGst(String(b.branchGst ?? ""));
    setDeliveryLocation(String(b.branchBuildingAddress ?? ""));
    setDeliveryAddress1(String(b.branchAddress1 ?? ""));
    setDeliveryAddress2(String(b.branchAddress2 ?? ""));
  }, [toBranchCode, allBranches]);

  const URGENCY_RANK = { critical: 0, high: 1, medium: 2 };

  const fetchAiRecommendations = useCallback(async (targetBranch, limit) => {
    if (!tenantId || !fromBranch || !targetBranch) return;
    setAiState("loading");
    setAiError("");
    setItems([]);
    try {
      const res = await fetch(aiUrl(`/ai-service/${tenantId}/recommendations?horizon=7`));
      if (!res.ok) {
        if (res.status === 503) {
          setAiError("AI model not trained yet. Go to AI Dashboard → Retrain Model first.");
        } else if (res.status === 502 || res.status === 504) {
          setAiError("AI service is not responding. Check that the service is running.");
        } else {
          const body = await res.json().catch(() => ({}));
          setAiError(body.detail || `AI service error (HTTP ${res.status}).`);
        }
        setAiState("error");
        return;
      }
      const recs = await res.json();

      const filtered = (Array.isArray(recs) ? recs : [])
        .filter(
          (r) =>
            String(r.from_branch || "").toUpperCase() === fromBranch.toUpperCase() &&
            String(r.to_branch || "").toUpperCase() === targetBranch.toUpperCase()
        )
        .sort((a, b) => {
          const ua = URGENCY_RANK[a.urgency] ?? 9;
          const ub = URGENCY_RANK[b.urgency] ?? 9;
          if (ua !== ub) return ua - ub;
          return (Number(b.to_forecast_7d) || 0) - (Number(a.to_forecast_7d) || 0);
        })
        .slice(0, limit);

      if (!filtered.length) {
        setAiState("none");
        return;
      }

      const rows = await Promise.all(
        filtered.map(async (rec) => {
          const cached = await db.items.get(String(rec.item_id)).catch(() => null);
          const price = Number(cached?.standardPrice || 0);
          const qty = Number(rec.qty) || 1;
          return {
            key: crypto.randomUUID(),
            item_id: String(rec.item_id),
            item_name: cached?.itemName || rec.item_name || "",
            barcode: cached?.barcode || "",
            qty,
            tax_rate: Number(cached?.taxRate || 0),
            standard_price: price,
            amount: round2n(qty * price),
            batch: cached?.batchCode || "",
            unit: cached?.unitName || "",
            expiry: cached?.expiry || "",
            ai_suggested: true,
            ai_urgency: rec.urgency || "",
          };
        })
      );

      setItems(rows);
      setAiCount(rows.length);
      setAiState("done");
    } catch (e) {
      console.warn("[AI] Recommendations fetch failed:", e.message);
      setAiState("error");
    }
  }, [tenantId, fromBranch]);

  useEffect(() => {
    if (!toBranchCode) {
      setAiState("idle");
      setAiCount(0);
      return;
    }
    if (skipAiFetch.current) {
      skipAiFetch.current = false;
      return;
    }
    fetchAiRecommendations(toBranchCode, maxAiItems);
  }, [toBranchCode, fetchAiRecommendations, maxAiItems]);

  useEffect(() => {
    let cancelled = false;
    const IDLE_MS = 120_000;
    const tick = async () => {
      if (cancelled) return;
      const idle = Date.now() - lastActivityRef.current >= IDLE_MS;
      if (navigator.onLine && idle) {
        const { synced } = await syncPendingStockTransfers().catch(() => ({ synced: 0 }));
        if (synced > 0) message.success(`Synced ${synced} offline stock transfer(s)`);
      }
      const count = await getPendingStockCount().catch(() => 0);
      const failed = await getFailedStockCount().catch(() => 0);
      if (!cancelled) {
        setPendingCount(count);
        setFailedCount(failed);
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    const onOnline = () => { lastActivityRef.current = 0; tick(); };
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const totalQty = useMemo(
    () => items.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [items]
  );
  const totalAmount = useMemo(
    () => items.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [items]
  );

  const openLookup = () => {
    setLookupQuery(itemQuery || "");
    setLookupOpen(true);
  };

  const updateRow = (key, patch) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        next.amount = round2n((Number(next.qty) || 0) * (Number(next.standard_price) || 0));
        return next;
      })
    );
  };

  const onPickItem = (itm) => {
    const batch = itm.batchCode || "";
    const existing = items.find((r) => r.item_id === itm.itemId && (r.batch || "") === batch);
    if (existing) {
      updateRow(existing.key, { qty: (Number(existing.qty) || 0) + 1 });
      pendingQtyFocusKey.current = existing.key;
      setItemQuery("");
      setLookupOpen(false);
      return;
    }

    const row = {
      key: crypto.randomUUID(),
      item_id: itm.itemId,
      item_name: itm.itemName,
      barcode: itm.barcode,
      qty: 1,
      tax_rate: Number(itm.taxRate || 0),
      standard_price: Number(itm.standardPrice || 0),
      amount: round2n(Number(itm.standardPrice || 0)),
      batch: batch,
      unit: itm.unitName || "",
      expiry: itm.expiry || "",
    };
    pendingQtyFocusKey.current = row.key;
    setItems((prev) => [row, ...prev]);
    setItemQuery("");
    setLookupOpen(false);
  };

  const resetForm = () => {
    setItems([]);
    setToBranchCode("");
    setToBranchName("");
    setToBranchState("");
    setToBranchGst("");
    setDeliveryLocation("");
    setDeliveryAddress1("");
    setDeliveryAddress2("");
  };

  const saveToHold = () => {
    if (!toBranchCode || !items.length) {
      message.warning("Enter branch and at least one item before Hold DC.");
      return;
    }
    setSavingHold(true);
    try {
      const rec = {
        id: crypto.randomUUID(),
        name: `DC_${toBranchCode}_${todayIST()}`,
        createdAt: nowIST(),
        payload: {
          toBranchCode, toBranchName, toBranchState, toBranchGst,
          deliveryLocation, deliveryAddress1, deliveryAddress2,
          printMode, reasonCode, items,
        },
      };
      const next = [rec, ...holdRows].slice(0, 100);
      setHoldRows(next);
      writeHoldList(next);
      resetForm();
      message.success("Hold DC saved");
    } finally {
      setSavingHold(false);
    }
  };

  const recallSelected = () => {
    const row = holdRows.find((x) => x.id === selectedHoldId);
    if (!row) { message.warning("Select a hold record."); return; }
    const p = row.payload || {};
    skipAiFetch.current = true;
    setToBranchCode(String(p.toBranchCode || ""));
    setToBranchName(String(p.toBranchName || ""));
    setToBranchState(String(p.toBranchState || ""));
    setToBranchGst(String(p.toBranchGst || ""));
    setDeliveryLocation(String(p.deliveryLocation || ""));
    setDeliveryAddress1(String(p.deliveryAddress1 || ""));
    setDeliveryAddress2(String(p.deliveryAddress2 || ""));
    setPrintMode(p.printMode === "thermal" ? "thermal" : "a4");
    setReasonCode(String(p.reasonCode || "NORMAL DC"));
    setItems(Array.isArray(p.items) ? p.items : []);
    const next = holdRows.filter((x) => x.id !== selectedHoldId);
    setHoldRows(next);
    writeHoldList(next);
    setSelectedHoldId("");
    setRecallOpen(false);
    message.success("DC recalled");
  };

  const saveTransfer = async () => {
    if (!tenantId || !token) { message.error("Missing login session. Please login again."); return; }
    if (!navigator.onLine) {
      message.error("No network connection. Stock Transfer requires an active internet connection.");
      return;
    }
    if (!fromBranch || !toBranchCode) { message.warning("Select source and destination branch."); return; }
    if (!items.length) { message.warning("Add items first."); return; }
    if (fromBranch === toBranchCode) { message.warning("Destination branch cannot be same as source."); return; }

    const headerId = crypto.randomUUID();
    const { voucherNumber, numericSeq: numericVoucher } = generateTransferVoucherNumber(fromBranch);
    const voucherDate = nowIST();
    const body = {
      id: headerId,
      branch_code: fromBranch,
      to_branch_code: toBranchCode,
      voucher_type: "STOCK_TRANSFER",
      voucher_prefix: "ST",
      voucher_number: voucherNumber,
      numeric_voucher_number: numericVoucher,
      voucher_date: voucherDate,
      description: "Stock Transfer",
      reason_code: reasonCode,
      delivery_to_location: deliveryLocation,
      delivery_to_address1: deliveryAddress1,
      delivery_to_address2: deliveryAddress2,
      to_branch_name: toBranchName,
      to_branch_state: toBranchState,
      to_branch_gst: toBranchGst,
      lines: items.map((r) => ({
        id: crypto.randomUUID(),
        item_id: r.item_id,
        item_name: r.item_name,
        barcode: r.barcode,
        qty: Number(r.qty) || 0,
        rate: Number(r.standard_price) || 0,
        standard_price: Number(r.standard_price) || 0,
        amount: Number(r.amount) || 0,
        tax_rate: Number(r.tax_rate) || 0,
        cess_rate: 0,
        unit: r.unit || "",
        batch: r.batch || "",
        expiry: r.expiry || null,
      })),
    };

    lastActivityRef.current = Date.now();
    try {
      setSaving(true);
      const urls = [
        apiUrl(`/api/${tenantId}/stock-transfers/out`),
        apiUrl(`/api/${tenantId}/stock-transfer/out`),
        apiUrl(`/api/${tenantId}/stock-transfer`),
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (r.ok) { result = await r.json().catch(() => ({})); break; }
          const t = await r.text().catch(() => "");
          lastErr = `${r.status} ${t || r.statusText}`;
          if (r.status >= 500) break;
        } catch (fetchErr) {
          lastErr = fetchErr.message;
          break;
        }
      }

      const fromBranchObj = allBranches.find(
        (x) => String(x.branchCode ?? "").toUpperCase() === fromBranch.toUpperCase()
      ) || {};
      const printArgs = {
        printMode,
        fromBranch,
        fromBranchName: String(fromBranchObj.branchName ?? ""),
        fromBranchGst: String(fromBranchObj.branchGst ?? ""),
        fromBranchState: String(fromBranchObj.branchState ?? ""),
        fromBranchAddress: [
          fromBranchObj.branchBuildingAddress,
          fromBranchObj.branchAddress1,
          fromBranchObj.branchAddress2,
        ].filter(Boolean).join(", "),
        toBranchCode, toBranchName, toBranchState, toBranchGst,
        deliveryLocation, deliveryAddress1, deliveryAddress2,
        voucherNumber, voucherDate, reasonCode,
        items, totalAmount, totalQty,
      };

      const cacheLines = items.map((r) => ({ itemId: r.item_id, batchCode: r.batch || "", qty: Number(r.qty) || 0 }));

      if (!result) {
        throw new Error(lastErr || "Server did not confirm the stock transfer. Please check your network and try again.");
      }

      await applySaleToCache(cacheLines);
      message.success("Stock Transfer saved");

      if (window.POS?.printHtml) {
        await window.POS.printHtml({
          html: buildTransferHtml(printArgs),
          silent: printMode === "thermal",
          deviceName: "",
        }).catch(() => {});
      }

      resetForm();
    } catch (e) {
      message.error("Save failed: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const URGENCY_COLOR = { critical: "red", high: "orange", medium: "blue" };

  const columns = [
    {
      title: "Item",
      dataIndex: "item_name",
      width: 220,
      render: (name, row) =>
        row.ai_suggested ? (
          <Space size={4}>
            <span style={{ fontWeight: 600 }}>{name}</span>
            <Tag
              icon={<RobotOutlined />}
              color={URGENCY_COLOR[row.ai_urgency] || "purple"}
              style={{ fontSize: 10, padding: "0 4px" }}
            >
              {row.ai_urgency || "AI"}
            </Tag>
          </Space>
        ) : <span style={{ fontWeight: 600 }}>{name}</span>,
    },
    { title: "Barcode", dataIndex: "barcode", width: 130 },
    {
      title: "Qty",
      dataIndex: "qty",
      width: 80,
      render: (_, row) => (
        <InputNumber
          ref={(el) => {
            if (el) qtyRefs.current.set(row.key, el);
            else qtyRefs.current.delete(row.key);
          }}
          min={0}
          value={row.qty}
          onChange={(v) => updateRow(row.key, { qty: Number(v || 0) })}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              itemSearchRef.current?.focus();
            }
          }}
          style={{ width: "100%", borderRadius: 0 }}
        />
      ),
    },
    {
      title: "Rate",
      dataIndex: "standard_price",
      width: 100,
      render: (_, row) => (
        <InputNumber
          min={0}
          value={row.standard_price}
          onChange={(v) => updateRow(row.key, { standard_price: Number(v || 0) })}
          style={{ width: "100%", borderRadius: 0 }}
        />
      ),
    },
    { title: "Tax%", dataIndex: "tax_rate", width: 60 },
    { title: "Amount", dataIndex: "amount", width: 100, render: (v) => round2(v) },
    { title: "Batch", dataIndex: "batch", width: 90 },
    { title: "Unit", dataIndex: "unit", width: 60 },
    { title: "Expiry", dataIndex: "expiry", width: 100 },
    {
      title: "",
      key: "x",
      width: 42,
      render: (_, row) => (
        <Button
          danger size="small"
          style={{ borderRadius: 0, padding: "0 6px" }}
          onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}
        >
          ✕
        </Button>
      ),
    },
  ];

  const markActivity = () => { lastActivityRef.current = Date.now(); };

  const canSave = !saving && !!fromBranch && !!toBranchCode && items.length > 0 && fromBranch !== toBranchCode;

  return (
    <div
      className="pos-container"
      onKeyDown={markActivity}
      onClick={markActivity}
    >
      {/* ── Title bar ── */}
      <div style={{
        background: "#00695c", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>Stock Transfer{fromBranch ? ` — ${fromBranch}` : ""}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {aiState === "loading" && <span style={{ fontSize: 11, color: "#93c5fd" }}><RobotOutlined spin /> Loading AI…</span>}
          {aiState === "done"    && <span style={{ fontSize: 11, color: "#86efac" }}><RobotOutlined /> {aiCount} AI items</span>}
          {aiState === "none"    && <span style={{ fontSize: 11, color: "#d1d5db" }}><RobotOutlined /> No AI suggestions</span>}
          {aiState === "error"   && <span style={{ fontSize: 11, color: "#fca5a5" }}><RobotOutlined /> AI unavailable</span>}
          {pendingCount > 0 && (
            <button
              onClick={async () => {
                setSyncing(true);
                const { synced, failed } = await syncPendingStockTransfers().catch(() => ({ synced: 0, failed: 0 }));
                const count = await getPendingStockCount().catch(() => 0);
                const failedNow = await getFailedStockCount().catch(() => 0);
                setPendingCount(count);
                setFailedCount(failedNow);
                setSyncing(false);
                if (synced > 0) message.success(`Synced ${synced} offline stock transfer(s)`);
                if (failed > 0) message.warning(`${failed} transfer(s) still pending`);
              }}
              style={{ fontSize: 11, color: "#fff", background: "transparent", border: "1px solid rgba(255,255,255,0.4)", padding: "1px 8px", cursor: "pointer" }}
            >
              <SyncOutlined spin={syncing} /> {pendingCount} pending
            </button>
          )}
          {failedCount > 0 && (
            <button
              onClick={async () => {
                setRetrying(true);
                await retryFailedStockTransfers().catch(() => {});
                const { synced } = await syncPendingStockTransfers().catch(() => ({ synced: 0 }));
                const count = await getPendingStockCount().catch(() => 0);
                const failedNow = await getFailedStockCount().catch(() => 0);
                setPendingCount(count);
                setFailedCount(failedNow);
                setRetrying(false);
                if (synced > 0) message.success(`Synced ${synced} previously failed transfer(s)`);
              }}
              style={{ fontSize: 11, color: "#fff", background: "#dc2626", border: "1px solid #b91c1c", padding: "1px 8px", cursor: "pointer" }}
            >
              {retrying ? "Retrying…" : `${failedCount} failed`}
            </button>
          )}
        </div>
      </div>

      {/* ── Main two-panel body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{
          width: 270, minWidth: 250, flexShrink: 0,
          background: "#c8dcd8",
          borderRight: "2px solid #4d8e87",
          display: "flex", flexDirection: "column",
          padding: "6px 8px", gap: 4, overflow: "auto",
        }}>
          <div>
            {lbl("From Branch")}
            <Input size="small" value={fromBranch || ""} readOnly style={{ borderRadius: 0 }} />
          </div>

          <div>
            {lbl("To Branch Code")}
            <Select
              size="small"
              value={toBranchCode || undefined}
              onChange={setToBranchCode}
              options={branchOptions}
              placeholder="Select branch"
              showSearch
              style={{ width: "100%" }}
            />
          </div>

          <div>
            {lbl("Branch Name")}
            <Input size="small" value={toBranchName} onChange={(e) => setToBranchName(e.target.value)} style={{ borderRadius: 0 }} />
          </div>

          <div>
            {lbl("Branch GST")}
            <Input size="small" value={toBranchGst} onChange={(e) => setToBranchGst(e.target.value)} style={{ borderRadius: 0 }} />
          </div>

          <div>
            {lbl("Branch State")}
            <Input size="small" value={toBranchState} onChange={(e) => setToBranchState(e.target.value)} style={{ borderRadius: 0 }} />
          </div>

          <div>
            {lbl("Reason Code")}
            <Select
              size="small"
              value={reasonCode}
              onChange={setReasonCode}
              style={{ width: "100%" }}
              options={[
                { value: "NORMAL DC",                label: "1. NORMAL DC" },
                { value: "EXPIRY AND DEFECT RETURN", label: "2. EXPIRY AND DEFECT RETURN" },
                { value: "DC MISTAKE",               label: "3. DC MISTAKE" },
              ]}
            />
          </div>

          <div>
            {lbl("Print Mode")}
            <Radio.Group
              options={[{ label: "A4", value: "a4" }, { label: "Thermal", value: "thermal" }]}
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value)}
              size="small"
            />
          </div>

          <div style={{ fontWeight: "bold", fontSize: 11, color: "#000", marginTop: 4, borderBottom: "1px solid #4d8e87", paddingBottom: 2 }}>
            Delivery Address
          </div>

          <div>
            {lbl("Location")}
            <Input size="small" value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} style={{ borderRadius: 0 }} />
          </div>
          <div>
            {lbl("Address 1")}
            <Input size="small" value={deliveryAddress1} onChange={(e) => setDeliveryAddress1(e.target.value)} style={{ borderRadius: 0 }} />
          </div>
          <div>
            {lbl("Address 2")}
            <Input size="small" value={deliveryAddress2} onChange={(e) => setDeliveryAddress2(e.target.value)} style={{ borderRadius: 0 }} />
          </div>

          <div>
            {lbl("Max AI Items")}
            <InputNumber
              size="small"
              min={1} max={200}
              value={maxAiItems}
              onChange={updateMaxAiItems}
              style={{ width: "100%", borderRadius: 0 }}
            />
          </div>

          {/* AI error detail */}
          {aiState === "error" && aiError && (
            <div style={{ fontSize: 10, color: "#7f1d1d", background: "#fee2e2", border: "1px solid #fca5a5", padding: "3px 5px" }}>
              {aiError}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6 }}>
            <button
              onClick={saveTransfer}
              disabled={!canSave}
              style={{
                flex: 2, height: 44, fontSize: 16, fontWeight: "bold",
                background: canSave ? "#ffc8ff" : "#b0c8c4",
                border: "2px outset #4d8e87",
                cursor: canSave ? "pointer" : "not-allowed",
                color: "#000",
              }}
            >
              {saving ? "Saving…" : "Save DC"}
            </button>
            <button
              onClick={saveToHold}
              disabled={savingHold || !toBranchCode || !items.length}
              style={{
                flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                background: (!savingHold && toBranchCode && items.length) ? "#fff3cd" : "#b0c8c4",
                border: "2px outset #4d8e87",
                cursor: (!savingHold && toBranchCode && items.length) ? "pointer" : "not-allowed",
                color: "#000",
              }}
            >
              Hold
            </button>
            <Badge count={holdRows.length} size="small" offset={[-4, 4]}>
              <button
                onClick={() => setRecallOpen(true)}
                style={{
                  flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                  background: holdRows.length ? "#d4edda" : "#b0c8c4",
                  border: "2px outset #4d8e87", cursor: "pointer", color: "#000",
                }}
              >
                Recall
              </button>
            </Badge>
            <button
              onClick={onClose}
              style={{
                flex: 1, height: 44, fontSize: 13, fontWeight: "bold",
                background: "#b0c8c4", border: "2px outset #4d8e87", cursor: "pointer", color: "#000",
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 8px", overflow: "hidden", background: "#c8dcd8" }}>
          {/* Item search + totals on same row */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 5 }}>
            <div style={{ flex: 1 }}>
              {lbl("Item Search / Barcode")}
              <Input
                ref={itemSearchRef}
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "F2") {
                    e.preventDefault();
                    openLookup();
                  }
                }}
                placeholder="Scan barcode — Enter / F2 to browse"
                style={{ borderRadius: 0 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>QTY</span>
              <Input
                readOnly
                value={round2(totalQty)}
                style={{ width: 80, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>Total</span>
              <Input
                readOnly
                value={round2(totalAmount)}
                style={{ width: 130, fontSize: 18, fontWeight: "bold", borderRadius: 0, textAlign: "right", background: "#fffff0" }}
              />
            </div>
          </div>

          {/* Items table */}
          <Table
            className="qt-st-table"
            size="small"
            dataSource={items}
            columns={columns}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1000, y: "calc(100vh - 150px)" }}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      {/* ── Item Lookup Modal ── */}
      <ItemLookupModal
        open={lookupOpen}
        initialQuery={lookupQuery}
        onClose={() => setLookupOpen(false)}
        onPick={onPickItem}
        onAfterClose={() => {
          const key = pendingQtyFocusKey.current;
          if (key) {
            pendingQtyFocusKey.current = null;
            qtyRefs.current.get(key)?.focus();
          }
        }}
      />

      {/* ── Recall Modal ── */}
      <Modal
        open={recallOpen}
        onCancel={() => setRecallOpen(false)}
        onOk={recallSelected}
        okText="Load"
        title="Recall Held DC"
      >
        <Select
          style={{ width: "100%" }}
          value={selectedHoldId || undefined}
          onChange={setSelectedHoldId}
          options={holdRows.map((h) => ({
            value: h.id,
            label: `${h.name} (${new Date(h.createdAt).toLocaleString()})`,
          }))}
          placeholder="Select hold record"
        />
      </Modal>
    </div>
  );
}
