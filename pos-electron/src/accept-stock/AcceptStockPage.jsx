import React, { useMemo, useState } from "react";
import { Button, Input, Space, Table, Typography, message } from "antd";

const { Title, Text } = Typography;

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(x, branchCode) {
  return {
    id: String(x.id ?? ""),
    branch_code: String(x.branch_code ?? x.branchCode ?? branchCode ?? ""),
    from_branch_code: String(x.from_branch_code ?? x.fromBranchCode ?? ""),
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
    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }
    if (!branchCode) {
      message.warning("Please select branch in POS first.");
      return;
    }

    try {
      setLoading(true);
      const urls = [
        `/api/${tenantId}/stock-transfer/${encodeURIComponent(branchCode)}`,
        `/api/${tenantId}/stock-transfer?toBranch=${encodeURIComponent(branchCode)}`,
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          result = await res.json();
          break;
        }
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

    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }

    try {
      setDetailLoading(true);
      const urls = [
        `/api/${tenantId}/stock-transfer/${encodeURIComponent(record.id)}/details`,
        `/api/${tenantId}/stock-transfer/details/${encodeURIComponent(record.id)}`,
        `/api/${tenantId}/stock-transfer/${encodeURIComponent(record.id)}`,
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          result = await res.json();
          break;
        }
        const t = await res.text().catch(() => "");
        lastErr = `${res.status} ${t || res.statusText}`;
        if (res.status !== 404) break;
      }

      if (!result) throw new Error(lastErr || "Unable to fetch details");

      const rawDetails = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.details)
            ? result.details
            : Array.isArray(result?.content)
              ? result.content
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
    if (!selectedHeaderId) {
      message.warning("Select a stock transfer row first.");
      return;
    }
    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }

    const header = headers.find((h) => h.id === selectedHeaderId);
    if (!header) {
      message.warning("Selected transfer not found.");
      return;
    }

    const body = {
      outHdrId: header.id,
      remarks: "Accept Stock",
    };

    try {
      setSaving(true);
      const urls = [
        { method: "POST", url: `/api/${tenantId}/stock-transfer/accept` },
        { method: "PUT", url: `/api/${tenantId}/stock-transfer/${encodeURIComponent(header.id)}/accept` },
      ];

      let ok = false;
      let lastErr = "";
      for (const x of urls) {
        const res = await fetch(x.url, {
          method: x.method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          ok = true;
          break;
        }
        const t = await res.text().catch(() => "");
        lastErr = `${res.status} ${t || res.statusText}`;
        if (res.status !== 404) break;
      }

      if (!ok) throw new Error(lastErr || "Unable to save accept stock");

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
    { title: "From Branch", dataIndex: "from_branch_code", width: 120 },
    { title: "Voucher Number", dataIndex: "voucher_number", width: 140 },
    { title: "Source Voucher", dataIndex: "source_voucher_number", width: 140 },
    { title: "Source Date", dataIndex: "source_voucher_date", width: 150 },
    { title: "Voucher Date", dataIndex: "voucher_date", width: 150 },
    { title: "ID", dataIndex: "id", width: 220 },
  ];

  const dtlColumns = [
    { title: "Item", dataIndex: "item_name", width: 220 },
    { title: "Qty", dataIndex: "qty", width: 90, render: (v) => toNum(v).toFixed(2) },
    { title: "Barcode", dataIndex: "barcode", width: 140 },
    { title: "MRP", dataIndex: "standard_price", width: 100, render: (v) => toNum(v).toFixed(2) },
    { title: "Batch", dataIndex: "batch", width: 120 },
    { title: "Amount", dataIndex: "amount", width: 110, render: (v) => toNum(v).toFixed(2) },
    { title: "Tax%", dataIndex: "tax_rate", width: 80 },
    { title: "Unit", dataIndex: "unit", width: 80 },
    { title: "Expiry", dataIndex: "expiry", width: 140 },
  ];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Accept Stock
        </Title>
        <Space>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>
          <Button onClick={fetchStockTransfer} loading={loading}>Fetch Stock Transfer</Button>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" onClick={saveAcceptStock} loading={saving}>Save</Button>
          <Text strong style={{ color: "#374151" }}>Total Amount</Text>
          <Input value={totalAmount.toFixed(2)} readOnly style={{ width: 120 }} />
          <Text strong style={{ color: "#374151" }}>Total Qty</Text>
          <Input value={totalQty.toFixed(2)} readOnly style={{ width: 100 }} />
        </Space>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Table
            size="small"
            dataSource={headers}
            columns={hdrColumns}
            pagination={false}
            rowKey="id"
            scroll={{ x: 920, y: 420 }}
            rowClassName={(r) => (r.id === selectedHeaderId ? "ant-table-row-selected" : "")}
            onRow={(record) => ({
              onClick: () => selectHeader(record),
            })}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <Table
            size="small"
            dataSource={detailRows}
            columns={dtlColumns}
            loading={detailLoading}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1200, y: 420 }}
          />
        </div>
      </div>
    </div>
  );
}
