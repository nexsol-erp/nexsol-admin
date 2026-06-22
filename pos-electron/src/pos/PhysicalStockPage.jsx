import React, { useState, useCallback } from "react";
import { DatePicker, InputNumber, Table, message } from "antd";
import dayjs from "dayjs";
import ItemLookupModal from "../components/ItemLookupModal";
import { apiUrl } from "../utils/apiUrl";
import { log, error as logError } from "../utils/logger";
import { applyPhysicalStockToCache } from "../cache/itemCache";

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

export default function PhysicalStockPage({ onClose, roles = [] }) {
  const tenantId   = localStorage.getItem("tenancyId") || "";
  const branchCode = localStorage.getItem("selectedBranchCode") || "";
  const token      = localStorage.getItem("jwtToken") || "";
  const hdrs       = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const canReduce = roles.includes("PHYSICAL_STOCK_REDUCE");

  const [activeTab, setActiveTab]       = useState("entry");
  const [items, setItems]               = useState([]);
  const [lookupOpen, setLookupOpen]     = useState(false);
  const [itemQuery, setItemQuery]       = useState("");
  const [saving, setSaving]             = useState(false);
  const [lastVoucher, setLastVoucher]   = useState("");

  const [fromDate, setFromDate]         = useState(dayjs().startOf("month"));
  const [toDate, setToDate]             = useState(dayjs());
  const [historyRows, setHistoryRows]   = useState([]);
  const [histLoading, setHistLoading]   = useState(false);

  const updateRow = (key, patch) => {
    setItems((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const next = { ...r, ...patch, error: false };
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
        current_stock: Number(itm.availableQty ?? 0),
        rate: Number(itm.standardPrice || 0),
        standard_price: Number(itm.standardPrice || 0),
        tax_rate: Number(itm.taxRate || 0),
        unit: itm.unitName || "",
        batch: itm.batchCode || "NB",
        amount: r2(itm.standardPrice || 0),
        error: false,
      },
    ]);
    setLookupOpen(false);
    setItemQuery("");
  };

  const handleSave = async () => {
    if (!items.length) { message.warning("Add at least one item"); return; }

    if (!canReduce) {
      const reducingKeys = new Set(
        items.filter((r) => r.qty < r.current_stock).map((r) => r.key)
      );
      if (reducingKeys.size) {
        setItems((prev) => prev.map((r) => ({ ...r, error: reducingKeys.has(r.key) })));
        message.error("Highlighted items would reduce stock. The PHYSICAL_STOCK_REDUCE role is required.");
        return;
      }
    }

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
        method: "POST", headers: hdrs, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
      message.success(`Saved! Voucher: ${data.voucherNumber}`);
      setLastVoucher(data.voucherNumber);
      applyPhysicalStockToCache(items.map((r) => ({ itemId: r.item_id, qty: r.qty }))).catch((e) =>
        logError("cache update after physical stock:", e.message)
      );
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
    { title: "Item",        dataIndex: "item_name",     width: 220,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "Barcode",     dataIndex: "barcode",       width: 120 },
    {
      title: "Physical Qty", dataIndex: "qty",          width: 120,
      render: (_, row) => (
        <InputNumber
          min={0} value={row.qty} style={{ width: "100%" }}
          onChange={(v) => updateRow(row.key, { qty: Number(v || 0) })}
        />
      ),
    },
    { title: "Curr Stock",  dataIndex: "current_stock", width: 90,
      render: (v) => <span style={{ color: "#444" }}>{Number(v || 0).toFixed(2)}</span> },
    {
      title: "Rate",        dataIndex: "rate",          width: 100,
      render: (_, row) => (
        <InputNumber
          min={0} value={row.rate} style={{ width: "100%" }}
          onChange={(v) => updateRow(row.key, { rate: Number(v || 0) })}
        />
      ),
    },
    { title: "Tax%",        dataIndex: "tax_rate",      width: 60 },
    { title: "Amount",      dataIndex: "amount",        width: 100,
      render: (v) => r2(v).toFixed(2) },
    { title: "Unit",        dataIndex: "unit",          width: 70 },
    { title: "Batch",       dataIndex: "batch",         width: 90 },
    {
      title: "", key: "del", width: 40,
      render: (_, row) => (
        <button
          onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}
          style={{
            background: "#ffcccc", border: "2px outset #cc6666",
            color: "#800000", fontWeight: "bold", fontSize: 12,
            cursor: "pointer", width: 28, height: 22, padding: 0,
          }}
        >✕</button>
      ),
    },
  ];

  const histColumns = [
    { title: "Item",    dataIndex: "itemName",      width: 200,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "Barcode", dataIndex: "barcode",       width: 120 },
    { title: "Qty In",  dataIndex: "qtyIn",         width: 80,
      render: (v) => Number(v || 0).toFixed(2) },
    { title: "Rate",    dataIndex: "rate",          width: 90,
      render: (v) => Number(v || 0).toFixed(2) },
    { title: "Voucher", dataIndex: "voucherNumber", width: 140 },
    { title: "Date",    dataIndex: "voucherDate",   width: 150,
      render: (v) => v ? new Date(v).toLocaleString("en-IN") : "—" },
    { title: "Unit",    dataIndex: "unitName",      width: 70 },
    { title: "Store",   dataIndex: "store",         width: 70 },
  ];

  const btnBase = {
    height: 28, fontSize: 12, fontWeight: "bold",
    border: "2px outset #5080b0", cursor: "pointer", color: "#000",
    padding: "0 12px",
  };

  const tabStyle = (tab) => ({
    ...btnBase,
    background: activeTab === tab ? "#dceaf8" : "#5b8ec0",
    color: activeTab === tab ? "#0d47a1" : "#fff",
    fontWeight: "bold",
    border: activeTab === tab ? "2px inset #5080b0" : "2px outset #5080b0",
  });

  const canSave = !saving && items.length > 0;

  return (
    <div className="pos-container">

      {/* ── Title bar ── */}
      <div style={{
        background: "#0d47a1", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>
          Physical Stock Entry{branchCode ? ` — ${branchCode}` : ""}
          {lastVoucher && (
            <span style={{ fontSize: 11, fontWeight: "normal", marginLeft: 14, opacity: 0.85 }}>
              Last saved: {lastVoucher}
            </span>
          )}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            style={{ ...btnBase, background: "#a8c0d8", border: "2px outset #5080b0" }}
          >
            Close
          </button>
        )}
      </div>

      {/* ── Tab / action bar ── */}
      <div style={{
        background: "#1565c0", padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 8, flexShrink: 0, flexWrap: "wrap",
      }}>
        <button onClick={() => setActiveTab("entry")}   style={tabStyle("entry")}>Entry</button>
        <button onClick={() => setActiveTab("history")} style={tabStyle("history")}>History</button>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)", margin: "0 4px" }} />

        {activeTab === "entry" && (
          <>
            <input
              className="ant-input item-search-input"
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); setLookupOpen(true); }
              }}
              placeholder="Scan barcode or type item name (Enter to browse)"
              style={{
                width: 290, height: 26, fontSize: 12,
                border: "1px solid #5080b0", padding: "0 6px",
                borderRadius: 0,
              }}
            />
            <button
              onClick={() => setLookupOpen(true)}
              style={{ ...btnBase, background: "#dceaf8" }}
            >
              Browse
            </button>

            <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)", margin: "0 4px" }} />

            <button
              onClick={() => setItems([])}
              disabled={!items.length}
              style={{
                ...btnBase,
                background: items.length ? "#ffc8ff" : "#a8c0d8",
                cursor: items.length ? "pointer" : "not-allowed",
              }}
            >
              Clear All
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                ...btnBase,
                background: canSave ? "#d4edda" : "#a8c0d8",
                cursor: canSave ? "pointer" : "not-allowed",
              }}
            >
              {saving ? "Saving…" : "Save Physical Stock"}
            </button>
          </>
        )}

        {activeTab === "history" && (
          <>
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#dceaf8" }}>From</span>
            <DatePicker
              value={fromDate} onChange={setFromDate}
              allowClear={false} format="DD-MM-YYYY" size="small"
              style={{ borderRadius: 0, width: 120 }}
            />
            <span style={{ fontSize: 11, fontWeight: "bold", color: "#dceaf8" }}>To</span>
            <DatePicker
              value={toDate} onChange={setToDate}
              allowClear={false} format="DD-MM-YYYY" size="small"
              style={{ borderRadius: 0, width: 120 }}
            />
            <button
              onClick={loadHistory}
              disabled={histLoading}
              style={{
                ...btnBase,
                background: histLoading ? "#a8c0d8" : "#ffc8ff",
                cursor: histLoading ? "not-allowed" : "pointer",
              }}
            >
              {histLoading ? "Loading…" : "Load"}
            </button>
          </>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", padding: "8px",
        background: "#d8e8f8", overflow: "hidden", minHeight: 0,
      }}>

        {activeTab === "entry" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            border: "1px solid #5080b0", background: "#b8cce0",
          }}>
            <div style={{
              background: "#0d47a1", color: "#fff", fontSize: 11, fontWeight: "bold",
              padding: "3px 8px", borderBottom: "1px solid #5080b0",
            }}>
              Items ({items.length})
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <Table
                className="qt-ps-table"
                size="small"
                dataSource={items}
                columns={entryColumns}
                pagination={false}
                rowKey="key"
                rowClassName={(r) => r.error ? "ps-error-row" : ""}
                scroll={{ x: 920, y: "calc(100vh - 200px)" }}
                locale={{ emptyText: "No items added — scan a barcode or use Browse" }}
              />
            </div>
            <div style={{
              background: "#0d47a1", color: "#fff",
              display: "flex", justifyContent: "flex-end", gap: 30,
              padding: "4px 12px", fontSize: 12, fontWeight: "bold",
              borderTop: "1px solid #5080b0",
            }}>
              <span>Total Qty: {r2(totalQty).toFixed(2)}</span>
              <span>Total Amount: {r2(totalAmount).toFixed(2)}</span>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            border: "1px solid #5080b0", background: "#b8cce0",
          }}>
            <div style={{
              background: "#0d47a1", color: "#fff", fontSize: 11, fontWeight: "bold",
              padding: "3px 8px", borderBottom: "1px solid #5080b0",
            }}>
              History ({historyRows.length})
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <Table
                className="qt-ps-table"
                size="small"
                dataSource={historyRows}
                columns={histColumns}
                rowKey={(r, i) => r.id || i}
                pagination={false}
                scroll={{ x: 900, y: "calc(100vh - 200px)" }}
                loading={histLoading}
                locale={{ emptyText: "Select date range and click Load" }}
              />
            </div>
          </div>
        )}

      </div>

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={itemQuery}
        onClose={() => setLookupOpen(false)}
        onPick={onPickItem}
        hideOutOfStock={false}
      />
    </div>
  );
}
