import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Input, InputNumber, Modal, Radio, Select, Space, Table, Tag, Typography, message } from "antd";
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

const { Title, Text } = Typography;

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

export default function StockTransferPage({ onClose }) {
  const itemSearchRef      = useRef(null);
  const qtyRefs            = useRef(new Map()); // rowKey → InputNumber instance
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
  const [aiState, setAiState] = useState("idle"); // idle | loading | done | none | error
  const [aiError, setAiError] = useState("");
  const [aiCount, setAiCount] = useState(0);
  const [maxAiItems, setMaxAiItems] = useState(
    () => Number(localStorage.getItem("ai_transfer_max_items") || 20)
  );
  const skipAiFetch = useRef(false); // set before recall to avoid overwriting recalled items

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
      .catch(() => {
        setTransferBranchCodes(null);
      });
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
          // within same urgency: higher forecast demand first
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
          toBranchCode,
          toBranchName,
          toBranchState,
          toBranchGst,
          deliveryLocation,
          deliveryAddress1,
          deliveryAddress2,
          printMode,
          items,
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
    if (!row) {
      message.warning("Select a hold record.");
      return;
    }
    const p = row.payload || {};
    skipAiFetch.current = true; // don't overwrite recalled items with AI suggestions
    setToBranchCode(String(p.toBranchCode || ""));
    setToBranchName(String(p.toBranchName || ""));
    setToBranchState(String(p.toBranchState || ""));
    setToBranchGst(String(p.toBranchGst || ""));
    setDeliveryLocation(String(p.deliveryLocation || ""));
    setDeliveryAddress1(String(p.deliveryAddress1 || ""));
    setDeliveryAddress2(String(p.deliveryAddress2 || ""));
    setPrintMode(p.printMode === "thermal" ? "thermal" : "a4");
    setItems(Array.isArray(p.items) ? p.items : []);
    const next = holdRows.filter((x) => x.id !== selectedHoldId);
    setHoldRows(next);
    writeHoldList(next);
    setSelectedHoldId("");
    setRecallOpen(false);
    message.success("DC recalled");
  };

  const saveTransfer = async () => {
    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }
    if (!fromBranch || !toBranchCode) {
      message.warning("Select source and destination branch.");
      return;
    }
    if (!items.length) {
      message.warning("Add items first.");
      return;
    }
    if (fromBranch === toBranchCode) {
      message.warning("Destination branch cannot be same as source.");
      return;
    }

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
      let saveLocally = false;
      for (const url of urls) {
        try {
          const r = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          if (r.ok) {
            result = await r.json().catch(() => ({}));
            break;
          }
          const t = await r.text().catch(() => "");
          lastErr = `${r.status} ${t || r.statusText}`;
          if (r.status >= 500) { saveLocally = true; break; }
        } catch (fetchErr) {
          saveLocally = true;
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
        toBranchCode,
        toBranchName,
        toBranchState,
        toBranchGst,
        deliveryLocation,
        deliveryAddress1,
        deliveryAddress2,
        voucherNumber,
        voucherDate,
        items,
        totalAmount,
        totalQty,
      };

      const cacheLines = items.map((r) => ({ itemId: r.item_id, batchCode: r.batch || "", qty: Number(r.qty) || 0 }));

      if (!result) {
        if (saveLocally || !navigator.onLine) {
          await queueStockTransfer({ tenantId, branchCode: fromBranch, token, payload: body, voucherNumber });
          setPendingCount((c) => c + 1);
          await applySaleToCache(cacheLines);
          // Not printed here: the transfer hasn't actually reached the server yet, so there is
          // nothing on record to back a printed delivery challan. Reprint from Stock Transfer
          // History once it has synced (Sync / Retry Failed) and is confirmed on the server.
          message.warning("Server error — Stock Transfer saved locally, NOT printed. It will sync when resolved; reprint from History afterwards.");
          resetForm();
          return;
        }
        throw new Error(lastErr || "Save failed");
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
            <span>{name}</span>
            <Tag
              icon={<RobotOutlined />}
              color={URGENCY_COLOR[row.ai_urgency] || "purple"}
              style={{ fontSize: 10, padding: "0 4px" }}
            >
              {row.ai_urgency || "AI"}
            </Tag>
          </Space>
        ) : name,
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
          style={{ width: "100%" }}
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
          style={{ width: "100%" }}
        />
      ),
    },
    { title: "Tax%", dataIndex: "tax_rate", width: 70 },
    { title: "Amount", dataIndex: "amount", width: 100, render: (v) => round2(v) },
    { title: "Batch", dataIndex: "batch", width: 90 },
    { title: "Unit", dataIndex: "unit", width: 70 },
    { title: "Expiry", dataIndex: "expiry", width: 120 },
    {
      title: "",
      key: "x",
      width: 60,
      render: (_, row) => (
        <Button danger size="small" onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}>
          X
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>Stock Transfer</Title>
        <Space>
          <Space size={4}>
            <RobotOutlined style={{ color: "#7c3aed" }} />
            <Text type="secondary" style={{ fontSize: 12 }}>Max AI items</Text>
            <InputNumber
              min={1}
              max={200}
              value={maxAiItems}
              onChange={updateMaxAiItems}
              style={{ width: 64 }}
              size="small"
            />
          </Space>
          <Button onClick={saveToHold} loading={savingHold}>Hold DC</Button>
          <Button onClick={() => setRecallOpen(true)}>Recall DC</Button>
          {pendingCount > 0 && (
            <Badge count={pendingCount} size="small">
              <Button
                icon={<SyncOutlined spin={syncing} />}
                loading={syncing}
                onClick={async () => {
                  setSyncing(true);
                  const { synced, failed } = await syncPendingStockTransfers().catch(() => ({ synced: 0, failed: 0 }));
                  const count = await getPendingStockCount().catch(() => 0);
                  const failedNow = await getFailedStockCount().catch(() => 0);
                  setPendingCount(count);
                  setFailedCount(failedNow);
                  setSyncing(false);
                  if (synced > 0) message.success(`Synced ${synced} offline transfer(s)`);
                  if (failed > 0) message.warning(`${failed} transfer(s) still pending`);
                }}
              >
                Sync
              </Button>
            </Badge>
          )}
          {failedCount > 0 && (
            <Badge count={failedCount} size="small">
              <Button
                danger
                loading={retrying}
                onClick={async () => {
                  setRetrying(true);
                  await retryFailedStockTransfers().catch(() => {});
                  const { synced, failed } = await syncPendingStockTransfers().catch(() => ({ synced: 0, failed: 0 }));
                  const count = await getPendingStockCount().catch(() => 0);
                  const failedNow = await getFailedStockCount().catch(() => 0);
                  setPendingCount(count);
                  setFailedCount(failedNow);
                  setRetrying(false);
                  if (synced > 0) message.success(`Synced ${synced} previously failed transfer(s)`);
                  if (failed > 0) message.warning(`${failed} transfer(s) still failing — check server/network`);
                }}
              >
                Retry Failed
              </Button>
            </Badge>
          )}
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" onClick={saveTransfer} loading={saving}>Save</Button>
        </Space>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>From Branch</Text>
          <Input value={fromBranch || ""} readOnly />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>To Branch Code</Text>
          <Select
            value={toBranchCode || undefined}
            onChange={setToBranchCode}
            options={branchOptions}
            placeholder="Select branch"
            showSearch
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch Name</Text>
          <Input value={toBranchName} onChange={(e) => setToBranchName(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch GST</Text>
          <Input value={toBranchGst} onChange={(e) => setToBranchGst(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch State</Text>
          <Input value={toBranchState} onChange={(e) => setToBranchState(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 4 }}>Print Mode</Text>
          <Radio.Group
            options={[
              { label: "A4", value: "a4" },
              { label: "Thermal", value: "thermal" },
            ]}
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Location</Text>
          <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Address 1</Text>
          <Input value={deliveryAddress1} onChange={(e) => setDeliveryAddress1(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Address 2</Text>
          <Input value={deliveryAddress2} onChange={(e) => setDeliveryAddress2(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Item Search / Barcode</Text>
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
          placeholder="Scan barcode (Enter/F2 to browse)"
        />
      </div>

      {aiState === "loading" && (
        <Alert
          message="AI is generating stock transfer suggestions based on demand forecast…"
          type="info"
          showIcon
          icon={<RobotOutlined />}
          style={{ marginBottom: 8 }}
        />
      )}
      {aiState === "done" && (
        <Alert
          message={`${aiCount} item(s) suggested by AI based on demand forecast. Review quantities and edit as needed.`}
          type="success"
          showIcon
          icon={<RobotOutlined />}
          closable
          style={{ marginBottom: 8 }}
        />
      )}
      {aiState === "none" && (
        <Alert
          message="No AI suggestions for this branch pair. Add items manually."
          type="info"
          showIcon
          icon={<RobotOutlined />}
          closable
          style={{ marginBottom: 8 }}
        />
      )}
      {aiState === "error" && (
        <Alert
          message={aiError || "AI suggestions unavailable. Add items manually."}
          type="warning"
          showIcon
          closable
          style={{ marginBottom: 8 }}
        />
      )}

      <Table
        size="small"
        dataSource={items}
        columns={columns}
        pagination={false}
        rowKey="key"
        scroll={{ x: 1200, y: 350 }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
        <div>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Total Qty</Text>
          <Input value={round2(totalQty)} readOnly style={{ width: 140 }} />
        </div>
        <div>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Total Amount</Text>
          <Input value={round2(totalAmount)} readOnly style={{ width: 160 }} />
        </div>
      </div>

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


