import React, { useState, useCallback } from "react";
import {
  Button, Input, InputNumber, Table, Typography, Divider,
  Space, Tag, message, Tabs, DatePicker,
} from "antd";
import dayjs from "dayjs";
import ItemLookupModal from "../components/ItemLookupModal";
import { apiUrl } from "../utils/apiUrl";
import { log, error as logError } from "../utils/logger";

const { Title, Text } = Typography;

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

export default function PhysicalStockPage({ onClose }) {
  const tenantId   = localStorage.getItem("tenancyId") || "";
  const branchCode = localStorage.getItem("selectedBranchCode") || "";
  const token      = localStorage.getItem("jwtToken") || "";
  const headers    = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Entry state ──────────────────────────────────────────────────────────
  const [items, setItems]           = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [itemQuery, setItemQuery]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [lastVoucher, setLastVoucher] = useState("");

  // ── History state ────────────────────────────────────────────────────────
  const [fromDate, setFromDate]     = useState(dayjs().startOf("month"));
  const [toDate, setToDate]         = useState(dayjs());
  const [historyRows, setHistoryRows] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const updateRow = (key, patch) => {
    setItems((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch };
      next.amount = r2(next.qty * next.rate);
      return next;
    }));
  };

  const onPickItem = (itm) => {
    const existing = items.find((r) => r.item_id === itm.itemId);
    if (existing) {
      updateRow(existing.key, { qty: existing.qty + 1 });
      setLookupOpen(false);
      setItemQuery("");
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        item_id: itm.itemId,
        item_name: itm.itemName,
        item_code: itm.itemCode || "",
        barcode: itm.barcode || "",
        qty: 1,
        rate: Number(itm.standardPrice || 0),
        standard_price: Number(itm.standardPrice || 0),
        tax_rate: Number(itm.taxRate || 0),
        unit: itm.unitName || "",
        batch: itm.batchCode || "NB",
        amount: r2(itm.standardPrice || 0),
      },
    ]);
    setLookupOpen(false);
    setItemQuery("");
  };

  const handleSave = async () => {
    if (!items.length) { message.warning("Add at least one item"); return; }
    setSaving(true);
    try {
      const body = {
        branchCode,
        items: items.map((r) => ({
          itemId: r.item_id,
          itemName: r.item_name,
          itemCode: r.item_code,
          barcode: r.barcode,
          qty: r.qty,
          rate: r.rate,
          standardPrice: r.standard_price,
          taxRate: r.tax_rate,
          unit: r.unit,
          batch: r.batch,
          description: "Physical Stock Entry",
        })),
      };
      log("physical-stock save:", JSON.stringify(body));
      const res = await fetch(apiUrl(`/api/${tenantId}/physical-stock`), {
        method: "POST", headers, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      message.success(`Saved! Voucher: ${data.voucherNumber}`);
      setLastVoucher(data.voucherNumber);
      setItems([]);
    } catch (e) {
      message.error("Save failed: " + e.message);
      logError("physical-stock save error:", e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const from = fromDate.format("YYYY-MM-DD");
      const to   = toDate.format("YYYY-MM-DD");
      const res = await fetch(
        apiUrl(`/api/${tenantId}/physical-stock-entries?branchCode=${encodeURIComponent(branchCode)}&fromDate=${from}&toDate=${to}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      setHistoryRows(rows);
    } catch (e) {
      message.error("Failed to load history: " + e.message);
    } finally {
      setHistLoading(false);
    }
  }, [tenantId, branchCode, token, fromDate, toDate]);

  const totalQty    = items.reduce((s, r) => s + (r.qty || 0), 0);
  const totalAmount = items.reduce((s, r) => s + (r.amount || 0), 0);

  const entryColumns = [
    { title: "Item", dataIndex: "item_name", width: 220 },
    { title: "Barcode", dataIndex: "barcode", width: 120 },
    {
      title: "Physical Qty *", dataIndex: "qty", width: 110,
      render: (_, row) => (
        <InputNumber
          min={0} value={row.qty} style={{ width: "100%" }}
          onChange={(v) => updateRow(row.key, { qty: Number(v || 0) })}
        />
      ),
    },
    {
      title: "Rate", dataIndex: "rate", width: 100,
      render: (_, row) => (
        <InputNumber
          min={0} value={row.rate} style={{ width: "100%" }}
          onChange={(v) => updateRow(row.key, { rate: Number(v || 0) })}
        />
      ),
    },
    { title: "Tax%", dataIndex: "tax_rate", width: 60 },
    { title: "Amount", dataIndex: "amount", width: 100, render: (v) => r2(v).toFixed(2) },
    { title: "Unit", dataIndex: "unit", width: 70 },
    { title: "Batch", dataIndex: "batch", width: 90 },
    {
      title: "", key: "del", width: 50,
      render: (_, row) => (
        <Button danger size="small" onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}>✕</Button>
      ),
    },
  ];

  const histColumns = [
    { title: "Item", dataIndex: "itemName", width: 200 },
    { title: "Barcode", dataIndex: "barcode", width: 120 },
    { title: "Qty In", dataIndex: "qtyIn", width: 80, render: (v) => Number(v || 0).toFixed(2) },
    { title: "Rate", dataIndex: "rate", width: 90, render: (v) => Number(v || 0).toFixed(2) },
    { title: "Voucher", dataIndex: "voucherNumber", width: 140 },
    { title: "Date", dataIndex: "voucherDate", width: 150,
      render: (v) => v ? new Date(v).toLocaleString("en-IN") : "—" },
    { title: "Unit", dataIndex: "unitName", width: 70 },
    { title: "Store", dataIndex: "store", width: 70 },
  ];

  return (
    <div style={{ padding: "12px 16px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0, color: "#0b3a75" }}>Physical Stock Entry</Title>
        <Space>
          {branchCode && <Tag color="blue" style={{ fontSize: 13, padding: "2px 10px" }}>{branchCode}</Tag>}
          {lastVoucher && <Tag color="green">Last: {lastVoucher}</Tag>}
          {onClose && <Button onClick={onClose}>Close</Button>}
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: "entry",
            label: "Entry",
            children: (
              <>
                {/* Item search bar */}
                <div style={{ marginBottom: 10 }}>
                  <Text strong style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                    Scan Barcode / Search Item
                  </Text>
                  <Input
                    value={itemQuery}
                    onChange={(e) => setItemQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "F2") {
                        e.preventDefault();
                        setLookupOpen(true);
                      }
                    }}
                    placeholder="Type item name or scan barcode (Enter to browse)"
                    style={{ maxWidth: 400 }}
                    suffix={
                      <Button size="small" type="link" onClick={() => setLookupOpen(true)}>Browse</Button>
                    }
                  />
                </div>

                <Table
                  size="small"
                  dataSource={items}
                  columns={entryColumns}
                  pagination={false}
                  rowKey="key"
                  scroll={{ x: 900, y: 340 }}
                  locale={{ emptyText: "No items added — scan a barcode or use Browse" }}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <Space>
                    <Text style={{ fontSize: 12, color: "#6b7280" }}>
                      Total Qty: <strong>{r2(totalQty).toFixed(2)}</strong>
                      &nbsp;&nbsp;Total Amount: <strong>₹{r2(totalAmount).toFixed(2)}</strong>
                    </Text>
                  </Space>
                  <Space>
                    <Button onClick={() => setItems([])}>Clear All</Button>
                    <Button
                      type="primary"
                      loading={saving}
                      disabled={!items.length}
                      onClick={handleSave}
                      style={{ background: "#1b5e20", borderColor: "#1b5e20" }}
                    >
                      Save Physical Stock
                    </Button>
                  </Space>
                </div>
              </>
            ),
          },
          {
            key: "history",
            label: "History",
            children: (
              <>
                <Space style={{ marginBottom: 12 }}>
                  <DatePicker
                    value={fromDate} onChange={setFromDate}
                    format="DD-MM-YYYY" placeholder="From date"
                  />
                  <DatePicker
                    value={toDate} onChange={setToDate}
                    format="DD-MM-YYYY" placeholder="To date"
                  />
                  <Button type="primary" onClick={loadHistory} loading={histLoading}>Load</Button>
                </Space>
                <Table
                  size="small"
                  dataSource={historyRows}
                  columns={histColumns}
                  rowKey={(r, i) => r.id || i}
                  pagination={{ pageSize: 20 }}
                  scroll={{ x: 900 }}
                  loading={histLoading}
                  locale={{ emptyText: "Select date range and click Load" }}
                />
              </>
            ),
          },
        ]}
      />

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={itemQuery}
        onClose={() => setLookupOpen(false)}
        onPick={onPickItem}
      />
    </div>
  );
}
