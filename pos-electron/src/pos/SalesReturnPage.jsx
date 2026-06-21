import React, { useRef, useState } from "react";
import {
  Alert, Button, Divider, InputNumber, Select, Space,
  Table, Tag, Typography, message,
} from "antd";
import { CloseOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import { apiUrl } from "../utils/apiUrl";
import { getToken, getTenancyId } from "../auth/auth";

const { Text, Title } = Typography;

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export default function SalesReturnPage({ selectedBranchCode, onClose }) {
  const tenantId = getTenancyId();
  const branchCode =
    selectedBranchCode ||
    globalThis.POS_BRANCH_CODE ||
    localStorage.getItem("selectedBranchCode") ||
    "";

  const [voucherQuery, setVoucherQuery]     = useState("");
  const [fetchLoading, setFetchLoading]     = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState(null);
  const [returnLines, setReturnLines]       = useState([]);
  const [refundMode, setRefundMode]         = useState("CASH");
  const [saving, setSaving]                 = useState(false);
  const [savedVoucher, setSavedVoucher]     = useState(null);

  const searchRef = useRef(null);

  const authHeaders = {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };

  // ── Fetch original invoice ──────────────────────────────────────────────
  const fetchInvoice = async () => {
    const q = voucherQuery.trim();
    if (!q) { message.warning("Enter a voucher number"); return; }

    setFetchLoading(true);
    setOriginalInvoice(null);
    setSavedVoucher(null);
    setReturnLines([]);

    try {
      const res = await fetch(
        apiUrl(`/api/${tenantId}/sales-return/original?voucherNo=${encodeURIComponent(q)}`),
        { headers: authHeaders }
      );
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Invoice not found" : `Error ${res.status}`);
      }
      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        message.warning("All items in this invoice have already been returned");
        return;
      }
      setOriginalInvoice(data);
      // Pre-fill all returnable items at full returnable qty
      setReturnLines(
        data.items.map((item) => ({
          key: item.dtlId,
          ...item,
          returnQty: item.returnableQty,
        }))
      );
    } catch (e) {
      message.error(e.message || "Failed to fetch invoice");
    } finally {
      setFetchLoading(false);
    }
  };

  // ── Row helpers ─────────────────────────────────────────────────────────
  const updateQty = (key, value) => {
    setReturnLines((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const qty = Math.max(0, Math.min(Number(value) || 0, row.returnableQty));
        return { ...row, returnQty: round2(qty) };
      })
    );
  };

  const removeRow = (key) => setReturnLines((prev) => prev.filter((r) => r.key !== key));

  const activeLines = returnLines.filter((r) => r.returnQty > 0);

  const totalAmount = activeLines.reduce(
    (sum, r) => sum + round2(r.returnQty * (r.rate || r.standardPrice || 0)),
    0
  );

  // ── Save return ─────────────────────────────────────────────────────────
  const saveReturn = async () => {
    if (!originalInvoice) { message.warning("No invoice loaded"); return; }
    if (activeLines.length === 0) { message.warning("No items selected for return"); return; }

    setSaving(true);
    try {
      const payload = {
        originalVoucherNo: originalInvoice.voucherNumber,
        refundMode,
        lines: activeLines.map((r) => ({
          dtlId: r.dtlId,
          itemId: r.itemId,
          itemName: r.itemName,
          barcode: r.barcode || "",
          batch: r.batch || "",
          expiry: r.expiry || null,
          returnQty: r.returnQty,
          rate: r.rate || r.standardPrice || 0,
          taxRate: r.taxRate || 0,
        })),
      };

      const res = await fetch(
        apiUrl(`/api/${tenantId}/sales-return/${encodeURIComponent(branchCode)}`),
        { method: "POST", headers: authHeaders, body: JSON.stringify(payload) }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Save failed (${res.status})`);

      setSavedVoucher(result.returnVoucherNo);
      message.success(`Return saved — ${result.returnVoucherNo}`);
      setOriginalInvoice(null);
      setReturnLines([]);
      setVoucherQuery("");
    } catch (e) {
      message.error(e.message || "Failed to save return");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setOriginalInvoice(null);
    setReturnLines([]);
    setVoucherQuery("");
    setSavedVoucher(null);
    setTimeout(() => searchRef.current?.focus?.(), 50);
  };

  // ── Table columns ───────────────────────────────────────────────────────
  const columns = [
    {
      title: "Item",
      dataIndex: "itemName",
      ellipsis: true,
    },
    {
      title: "Batch",
      dataIndex: "batch",
      width: 70,
      render: (v) => v || "—",
    },
    {
      title: "Orig Qty",
      dataIndex: "qty",
      width: 80,
      align: "right",
      render: (v) => Number(v || 0).toFixed(2),
    },
    {
      title: "Returned",
      dataIndex: "returnedQty",
      width: 80,
      align: "right",
      render: (v) =>
        v > 0 ? (
          <Text type="warning">{Number(v).toFixed(2)}</Text>
        ) : (
          "—"
        ),
    },
    {
      title: "Can Return",
      dataIndex: "returnableQty",
      width: 90,
      align: "right",
      render: (v) => <Text strong>{Number(v || 0).toFixed(2)}</Text>,
    },
    {
      title: "Return Qty",
      dataIndex: "returnQty",
      width: 110,
      align: "right",
      render: (val, record) => (
        <InputNumber
          size="small"
          min={0}
          max={record.returnableQty}
          step={0.01}
          precision={2}
          value={val}
          style={{ width: 90 }}
          onChange={(v) => updateQty(record.key, v)}
        />
      ),
    },
    {
      title: "Rate",
      width: 80,
      align: "right",
      render: (_, r) =>
        Number(r.rate || r.standardPrice || 0).toFixed(2),
    },
    {
      title: "Tax%",
      dataIndex: "taxRate",
      width: 55,
      align: "right",
      render: (v) => v || 0,
    },
    {
      title: "Return Amt",
      width: 100,
      align: "right",
      render: (_, r) => {
        const amt = round2(r.returnQty * (r.rate || r.standardPrice || 0));
        return (
          <Text strong style={{ color: amt > 0 ? "#d97706" : "#9ca3af" }}>
            {amt.toFixed(2)}
          </Text>
        );
      },
    },
    {
      title: "",
      width: 36,
      render: (_, r) => (
        <Button
          size="small"
          type="text"
          danger
          onClick={() => removeRow(r.key)}
          title="Remove from return"
          style={{ padding: "0 4px" }}
        >
          ✕
        </Button>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 12, background: "#f0f2f5", minHeight: "100vh" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Title level={4} style={{ margin: 0 }}>
          Sales Return
        </Title>
        <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 4 }}>
          Branch: {branchCode}
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button size="small" icon={<CloseOutlined />} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Voucher search */}
      <div
        style={{
          background: "#fff",
          padding: "10px 14px",
          borderRadius: 4,
          marginBottom: 10,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Text strong style={{ whiteSpace: "nowrap" }}>
          Original Voucher No:
        </Text>
        <input
          ref={searchRef}
          value={voucherQuery}
          onChange={(e) => setVoucherQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") fetchInvoice(); }}
          placeholder="Enter or scan bill number and press Enter"
          autoFocus
          style={{
            flex: 1,
            maxWidth: 360,
            padding: "4px 8px",
            border: "1px solid #d9d9d9",
            borderRadius: 0,
            fontSize: 13,
            outline: "none",
          }}
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={fetchInvoice}
          loading={fetchLoading}
          style={{ borderRadius: 0 }}
        >
          Fetch
        </Button>
        {originalInvoice && (
          <Button onClick={reset} style={{ borderRadius: 0 }}>
            New Search
          </Button>
        )}
      </div>

      {/* Original invoice summary strip */}
      {originalInvoice && (
        <div
          style={{
            background: "#fffbeb",
            border: "1px solid #fbbf24",
            borderRadius: 4,
            padding: "7px 14px",
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          <Space split={<Divider type="vertical" style={{ margin: "0 4px" }} />} wrap>
            <span>
              <b>Bill:</b> {originalInvoice.voucherNumber}
            </span>
            <span>
              <b>Date:</b>{" "}
              {originalInvoice.voucherDate
                ? new Date(originalInvoice.voucherDate).toLocaleDateString("en-IN")
                : "—"}
            </span>
            <span>
              <b>Branch:</b> {originalInvoice.branchCode}
            </span>
            {originalInvoice.receipts?.map((r) => (
              <span key={r.receiptMode}>
                <b>{r.receiptMode}:</b> ₹{Number(r.amount || 0).toFixed(2)}
              </span>
            ))}
          </Space>
        </div>
      )}

      {/* Success */}
      {savedVoucher && (
        <Alert
          type="success"
          showIcon
          message={`Sales Return saved — Voucher No: ${savedVoucher}`}
          style={{ marginBottom: 10 }}
          closable
          onClose={() => setSavedVoucher(null)}
          action={
            <Button size="small" onClick={reset}>
              Process Another
            </Button>
          }
        />
      )}

      {/* Items table */}
      {returnLines.length > 0 && (
        <>
          <div
            style={{
              background: "#fff",
              borderRadius: 4,
              marginBottom: 10,
              overflow: "hidden",
            }}
          >
            <Table
              size="small"
              dataSource={returnLines}
              columns={columns}
              pagination={false}
              rowKey="key"
              rowClassName={(r) => (r.returnQty <= 0 ? "srtn-row-zero" : "")}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              background: "#fff",
              padding: "10px 14px",
              borderRadius: 4,
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Text strong>Refund Mode:</Text>
              <Select
                value={refundMode}
                onChange={setRefundMode}
                style={{ width: 170 }}
                options={[
                  { value: "CASH",   label: "CASH" },
                  { value: "CARD",   label: "CARD" },
                  { value: "UPI",    label: "UPI" },
                  { value: "BANK",   label: "BANK" },
                  { value: "CREDIT", label: "CUSTOMER CREDIT" },
                ]}
              />
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Text>Items:</Text>
              <Tag color="orange">{activeLines.length}</Tag>
            </div>

            <div style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "center" }}>
              <span>
                <Text strong style={{ fontSize: 14 }}>Total Refund: </Text>
                <Text
                  strong
                  style={{
                    fontSize: 22,
                    color: totalAmount > 0 ? "#d97706" : "#6b7280",
                    marginLeft: 4,
                  }}
                >
                  ₹{totalAmount.toFixed(2)}
                </Text>
              </span>

              <Button
                type="primary"
                danger
                icon={<SaveOutlined />}
                size="large"
                onClick={saveReturn}
                loading={saving}
                disabled={activeLines.length === 0}
                style={{ borderRadius: 0, minWidth: 140 }}
              >
                Save Return
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!originalInvoice && !fetchLoading && !savedVoucher && (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            color: "#9ca3af",
            fontSize: 13,
          }}
        >
          Enter the original bill number and press Fetch or Enter
        </div>
      )}

      <style>{`
        .srtn-row-zero td { opacity: 0.35; }
      `}</style>
    </div>
  );
}
