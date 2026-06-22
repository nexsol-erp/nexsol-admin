import React, { useMemo, useState } from "react";
import { Table, message } from "antd";
import { apiUrl } from "../utils/apiUrl";
import { applyStockReceiptToCache } from "../cache/itemCache";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(x, branchCode) {
  return {
    id: String(x.id ?? ""),
    branch_code: String(x.branch_code ?? x.branchCode ?? branchCode ?? ""),
    from_branch_code: String(x.from_branch_code ?? x.fromBranchCode ?? x.branch_code ?? ""),
    voucher_number: String(x.voucher_number ?? x.voucherNumber ?? ""),
    source_voucher_number: String(x.source_voucher_number ?? x.sourceVoucherNumber ?? ""),
    source_voucher_date: String(x.source_voucher_date ?? x.sourceVoucherDate ?? ""),
    voucher_date: String(x.voucher_date ?? x.voucherDate ?? ""),
    accepted: String(x.accepted ?? "NO"),
    details: Array.isArray(x.details) ? x.details : [],
  };
}

function normalizeDetail(x, parentId) {
  const qty = toNum(x.qty);
  const standardPrice = toNum(x.standard_price ?? x.standardPrice);
  const amount = toNum(x.amount) || qty * standardPrice;
  return {
    key: String(x.id ?? crypto.randomUUID()),
    item_name: String(x.item_name ?? x.itemName ?? ""),
    qty,
    barcode: String(x.barcode ?? ""),
    standard_price: standardPrice,
    batch: String(x.batch ?? ""),
    amount,
    tax_rate: toNum(x.tax_rate ?? x.taxRate),
    unit: String(x.unit ?? x.unitName ?? ""),
    expiry: String(x.expiry ?? x.expiryDate ?? ""),
    rate: toNum(x.rate),
    item_id: String(x.item_id ?? x.itemId ?? ""),
    parent_id: String(x.parent_id ?? x.parentId ?? parentId ?? ""),
    description: String(x.description ?? ""),
    id: String(x.id ?? ""),
  };
}

export default function AcceptStockPage({ onClose }) {
  const [headers, setHeaders] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token = localStorage.getItem("jwtToken") || "";

  const totalQty = useMemo(
    () => detailRows.reduce((s, r) => s + toNum(r.qty), 0),
    [detailRows]
  );
  const totalAmount = useMemo(
    () => detailRows.reduce((s, r) => s + toNum(r.amount), 0),
    [detailRows]
  );

  const fetchStockTransfer = async () => {
    if (!tenantId || !token) { message.error("Missing login session. Please login again."); return; }
    if (!branchCode) { message.warning("Please select branch in POS first."); return; }

    try {
      setLoading(true);
      const urls = [
        apiUrl(`/api/${tenantId}/stock-transfer/${encodeURIComponent(branchCode)}`),
        apiUrl(`/api/${tenantId}/stock-transfer?toBranch=${encodeURIComponent(branchCode)}`),
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) { result = await res.json(); break; }
        const t = await res.text().catch(() => "");
        lastErr = `${res.status} ${t || res.statusText}`;
        if (res.status !== 404) break;
      }

      if (!result) throw new Error(lastErr || "Unable to fetch stock transfer");

      const rows = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
      const mapped = rows.map((x) => normalizeHeader(x, branchCode)).filter((x) => x.accepted !== "YES");
      setHeaders(mapped);
      setSelectedHeaderId("");
      setDetailRows([]);
      message.success(`Fetched ${mapped.length} pending stock transfer(s)`);
    } catch (e) {
      message.error("Fetch failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const selectHeader = async (record) => {
    setSelectedHeaderId(record.id);
    setDetailRows([]);

    const embedded = Array.isArray(record.details) ? record.details : [];
    if (embedded.length) {
      setDetailRows(embedded.map((x) => normalizeDetail(x, record.id)));
      return;
    }

    if (!tenantId || !token) { message.error("Missing login session. Please login again."); return; }

    try {
      setDetailLoading(true);
      const urls = [
        apiUrl(`/api/${tenantId}/stock-transfer/${encodeURIComponent(record.id)}/details`),
        apiUrl(`/api/${tenantId}/stock-transfer/details/${encodeURIComponent(record.id)}`),
        apiUrl(`/api/${tenantId}/stock-transfer/${encodeURIComponent(record.id)}`),
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        const res = await fetch(url, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) { result = await res.json(); break; }
        const t = await res.text().catch(() => "");
        lastErr = `${res.status} ${t || res.statusText}`;
        if (res.status !== 404) break;
      }

      if (!result) throw new Error(lastErr || "Unable to fetch details");

      const rawDetails = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)   ? result.data
        : Array.isArray(result?.details) ? result.details
        : Array.isArray(result?.content) ? result.content
        : [];

      setDetailRows(rawDetails.map((x) => normalizeDetail(x, record.id)));
    } catch (e) {
      message.error("Detail fetch failed: " + (e.message || "Unknown error"));
      setDetailRows([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const saveAcceptStock = async () => {
    if (!selectedHeaderId) { message.warning("Select a stock transfer row first."); return; }
    if (!tenantId || !token) { message.error("Missing login session. Please login again."); return; }

    const header = headers.find((h) => h.id === selectedHeaderId);
    if (!header) { message.warning("Selected transfer not found."); return; }

    const body = { outHdrId: header.id, remarks: "Accept Stock" };

    try {
      setSaving(true);
      const urls = [
        { method: "POST", url: apiUrl(`/api/${tenantId}/stock-transfer/accept`) },
        { method: "PUT",  url: apiUrl(`/api/${tenantId}/stock-transfer/${encodeURIComponent(header.id)}/accept`) },
      ];

      let ok = false;
      let lastErr = "";
      for (const x of urls) {
        const res = await fetch(x.url, {
          method: x.method,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) { ok = true; break; }
        const t = await res.text().catch(() => "");
        lastErr = `${res.status} ${t || res.statusText}`;
        if (res.status !== 404) break;
      }

      if (!ok) throw new Error(lastErr || "Unable to save accept stock");

      applyStockReceiptToCache(
        detailRows.map((r) => ({ itemId: r.item_id, qty: r.qty }))
      ).catch(() => {});
      setHeaders((prev) => prev.filter((h) => h.id !== selectedHeaderId));
      setSelectedHeaderId("");
      setDetailRows([]);
      message.success("Stock accepted successfully");
    } catch (e) {
      message.error("Save failed: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const hdrColumns = [
    { title: "From Branch",    dataIndex: "from_branch_code",      width: 120 },
    { title: "Voucher No",     dataIndex: "voucher_number",         width: 140 },
    { title: "Source Voucher", dataIndex: "source_voucher_number",  width: 140 },
    { title: "Source Date",    dataIndex: "source_voucher_date",    width: 120,
      render: (v) => v ? v.slice(0, 10) : "" },
    { title: "Voucher Date",   dataIndex: "voucher_date",           width: 150,
      render: (v) => v ? v.slice(0, 16).replace("T", " ") : "" },
  ];

  const dtlColumns = [
    { title: "Item",   dataIndex: "item_name",      width: 220,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "Qty",    dataIndex: "qty",             width: 80,
      render: (v) => toNum(v).toFixed(2) },
    { title: "MRP",    dataIndex: "standard_price",  width: 90,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Tax%",   dataIndex: "tax_rate",        width: 70 },
    { title: "Amount", dataIndex: "amount",          width: 100,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Barcode", dataIndex: "barcode",        width: 140 },
    { title: "Batch",  dataIndex: "batch",           width: 120 },
    { title: "Unit",   dataIndex: "unit",            width: 80 },
    { title: "Expiry", dataIndex: "expiry",          width: 140 },
  ];

  const selectedHeader = headers.find((h) => h.id === selectedHeaderId);

  const btnBase = {
    height: 28, fontSize: 12, fontWeight: "bold",
    border: "2px outset #9c4dcc", cursor: "pointer", color: "#000",
    padding: "0 12px",
  };

  return (
    <div className="pos-container">

      {/* ── Title bar ── */}
      <div style={{
        background: "#4a148c", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>Accept Stock{branchCode ? ` — ${branchCode}` : ""}</span>
        <button
          onClick={onClose}
          style={{ ...btnBase, background: "#c4b8d0", border: "2px outset #9c4dcc" }}
        >
          Close
        </button>
      </div>

      {/* ── Action bar ── */}
      <div style={{
        background: "#7b1fa2", padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap",
      }}>
        <button
          onClick={fetchStockTransfer}
          disabled={loading}
          style={{ ...btnBase, background: loading ? "#c4b8d0" : "#ffc8ff", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Loading…" : "Fetch"}
        </button>
        <button
          onClick={saveAcceptStock}
          disabled={saving || !selectedHeaderId}
          style={{
            ...btnBase,
            background: saving || !selectedHeaderId ? "#c4b8d0" : "#d4edda",
            cursor: saving || !selectedHeaderId ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Accept"}
        </button>
      </div>

      {/* ── Main body ── */}
      <div style={{
        flex: 1, display: "flex", gap: 8, padding: "8px",
        background: "#d8cce8", overflow: "hidden", minHeight: 0,
      }}>

        {/* Pending transfers panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          border: "1px solid #9c4dcc", background: "#c8b8d8",
        }}>
          <div style={{
            background: "#4a148c", color: "#fff", fontSize: 11, fontWeight: "bold",
            padding: "3px 8px", borderBottom: "1px solid #9c4dcc",
          }}>
            Pending Transfers ({headers.length})
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Table
              className="qt-as-table"
              size="small"
              dataSource={headers}
              columns={hdrColumns}
              pagination={false}
              rowKey="id"
              scroll={{ x: 680, y: "calc(100vh - 200px)" }}
              rowClassName={(r) => r.id === selectedHeaderId ? "as-row-selected" : ""}
              onRow={(record) => ({
                onClick: () => selectHeader(record),
                style: { cursor: "pointer" },
              })}
            />
          </div>
        </div>

        {/* Lines panel */}
        <div style={{
          flex: 1.5, display: "flex", flexDirection: "column",
          border: "1px solid #9c4dcc", background: "#c8b8d8",
        }}>
          <div style={{
            background: "#4a148c", color: "#fff", fontSize: 11, fontWeight: "bold",
            padding: "3px 8px", borderBottom: "1px solid #9c4dcc",
          }}>
            {selectedHeader
              ? `Lines — ${selectedHeader.voucher_number}  (from ${selectedHeader.from_branch_code})`
              : "Lines — select a transfer"}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Table
              className="qt-as-table"
              size="small"
              dataSource={detailRows}
              columns={dtlColumns}
              loading={detailLoading}
              pagination={false}
              rowKey="key"
              scroll={{ x: 970, y: "calc(100vh - 200px)" }}
            />
          </div>
          {selectedHeader && (
            <div style={{
              background: "#6a1b9a", color: "#fff",
              display: "flex", justifyContent: "flex-end", gap: 30,
              padding: "4px 12px", fontSize: 12, fontWeight: "bold",
              borderTop: "1px solid #9c4dcc",
            }}>
              <span>Total Qty: {totalQty.toFixed(2)}</span>
              <span>Total Amount: {totalAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
