import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Input, InputNumber, Modal, Radio, Select, Space, Table, Typography, message } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import ItemLookupModal from "../components/ItemLookupModal";
import { apiUrl } from "../utils/apiUrl";
import { queueStockTransfer, getPendingStockCount, syncPendingStockTransfers } from "./offlineStockQueue";
import { applySaleToCache } from "../cache/itemCache";
import { buildTransferHtml } from "./transferPrint";

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
  const itemSearchRef = useRef(null);
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
  const [syncing, setSyncing] = useState(false);
  const lastActivityRef = useRef(Date.now());

  const tenantId = localStorage.getItem("tenancyId") || "";
  const token = localStorage.getItem("jwtToken") || "";
  const fromBranch = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

  const [allBranches, setAllBranches] = useState([]);

  const EXCLUDED_BRANCH_TYPES = new Set(["BAKERY_PROD", "BAKERY_BO"]);

  const branchOptions = useMemo(() => {
    const seen = new Set();
    return allBranches
      .filter((b) => {
        const type = b.branchType ?? b.branch_type ?? null;
        return type && !EXCLUDED_BRANCH_TYPES.has(type);
      })
      .map((b) => String(b.branchCode ?? "").trim())
      .filter((code) => code && code !== fromBranch)
      .filter((code) => {
        if (seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((code) => ({ value: code, label: code }));
  }, [allBranches, fromBranch]);

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
      if (!cancelled) setPendingCount(count);
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
      setLookupOpen(false);
      setItemQuery("");
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
    setItems((prev) => [row, ...prev]);
    setLookupOpen(false);
    setItemQuery("");
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
      const now = new Date();
      const rec = {
        id: crypto.randomUUID(),
        name: `DC_${toBranchCode}_${now.toISOString().slice(0, 10)}`,
        createdAt: now.toISOString(),
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
    const now = new Date();
    // HHmmss fits within Java Integer (max ~235959)
    const numericVoucher = Number(
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0")
    );
    // varchar(20) limit — keep format short: ST-{branch}-{HHmmss}
    const voucherNumber = `ST-${fromBranch}-${numericVoucher}`.slice(0, 20);
    // LocalDateTime does not accept trailing 'Z' — strip it
    const voucherDate = now.toISOString().slice(0, 19);
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
      dtl: items.map((r) => ({
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
          message.warning("Server error — Stock Transfer saved locally and will sync when resolved.");
          if (window.POS?.printHtml) {
            const html = buildTransferHtml(printArgs);
            await window.POS.printHtml({ html, silent: printMode === "thermal", deviceName: "" });
          }
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

  const columns = [
    { title: "Item", dataIndex: "item_name", width: 220 },
    { title: "Barcode", dataIndex: "barcode", width: 130 },
    {
      title: "Qty",
      dataIndex: "qty",
      width: 80,
      render: (_, row) => (
        <InputNumber
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
                  setPendingCount(count);
                  setSyncing(false);
                  if (synced > 0) message.success(`Synced ${synced} offline transfer(s)`);
                  if (failed > 0) message.warning(`${failed} transfer(s) still pending`);
                }}
              >
                Sync
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


