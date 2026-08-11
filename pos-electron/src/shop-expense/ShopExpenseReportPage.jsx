import React, { useEffect, useState, useCallback } from "react";
import { DatePicker, Select, Input, Table, Button, Tag, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { buildExpenseVoucherHtml } from "./expensePrint";

const { RangePicker } = DatePicker;

const PAYMENT_MODES = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"];
const STATUSES = ["ACTIVE", "VOIDED"];

// Branch-locked report — only this terminal's branch, no edit/delete/void
// actions anywhere in this UI (the backend refuses those for POS users
// regardless, but they're not even offered here to avoid confusion).
export default function ShopExpenseReportPage({ onClose }) {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken") || "";
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const headers = { Authorization: `Bearer ${token}` };

  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs()]);
  const [expenseTypeId, setExpenseTypeId] = useState(null);
  const [paymentMode, setPaymentMode] = useState(null);
  const [enteredBy, setEnteredBy] = useState("");
  const [status, setStatus] = useState(null);
  const [voucherNumber, setVoucherNumber] = useState("");
  const [heads, setHeads] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [branchInfo, setBranchInfo] = useState(null);

  useEffect(() => {
    if (!tenantId || !branchCode) return;
    fetch(apiUrl(`/api/${tenantId}/expense-heads/pos/${branchCode}`), { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setHeads(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch(apiUrl(`/api/${tenantId}/branches`), { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setBranchInfo(list.find((b) => b.branchCode === branchCode) || null);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchCode]);

  const search = useCallback(async () => {
    if (!tenantId || !branchCode) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        branchCode,
        fromDate: dateRange?.[0]?.format("YYYY-MM-DD") || "",
        toDate:   dateRange?.[1]?.format("YYYY-MM-DD") || "",
        page: "0",
        size: "200",
      });
      if (expenseTypeId) params.set("expenseTypeId", expenseTypeId);
      if (paymentMode)   params.set("paymentMode", paymentMode);
      if (enteredBy)     params.set("enteredBy", enteredBy);
      if (status)        params.set("status", status);
      if (voucherNumber) params.set("voucherNumber", voucherNumber);

      const res = await fetch(apiUrl(`/api/${tenantId}/shop-expenses?${params}`), { headers });
      if (!res.ok) throw new Error(`Search failed (${res.status})`);
      const data = await res.json();
      const content = data.content || [];
      setRows(content);
      setTotal(content.reduce((s, r) => s + Number(r.amount || 0), 0));
    } catch (e) {
      message.error(e.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, branchCode, dateRange, expenseTypeId, paymentMode, enteredBy, status, voucherNumber]);

  useEffect(() => { search(); }, [search]);

  const reprint = (record) => {
    if (!window.POS?.printHtml) { message.error("Print API not available"); return; }
    const html = buildExpenseVoucherHtml({
      branchInfo, branchCode,
      voucherNumber: record.voucher_number,
      expenseDate: record.expense_date,
      expenseTypeName: record.expense_type_name,
      amount: record.amount,
      paymentMode: record.payment_mode,
      payee: record.payee,
      referenceNo: record.reference_no,
      remarks: record.remarks,
      enteredByUsername: record.entered_by_username,
      printedAt: new Date().toISOString(),
      isReprint: true,
    });
    window.POS.printHtml({ html, silent: false, deviceName: "" })
      .catch((e) => message.error("Print failed: " + (e.message || "Unknown error")));
  };

  const columns = [
    { title: "Voucher No", dataIndex: "voucher_number", width: 170 },
    { title: "Date", dataIndex: "expense_date", width: 100 },
    { title: "Expense Head", dataIndex: "expense_type_name", width: 160 },
    { title: "Amount", dataIndex: "amount", width: 100, align: "right", render: (v) => Number(v || 0).toFixed(2) },
    { title: "Mode", dataIndex: "payment_mode", width: 110 },
    { title: "Payee", dataIndex: "payee", width: 140 },
    { title: "Ref No", dataIndex: "reference_no", width: 110 },
    { title: "Entered By", dataIndex: "entered_by_username", width: 120 },
    {
      title: "Status", dataIndex: "status", width: 90,
      render: (v) => <Tag color={v === "VOIDED" ? "red" : "green"}>{v}</Tag>,
    },
    {
      title: "Action", width: 100,
      render: (_, record) => <Button size="small" onClick={() => reprint(record)}>Print</Button>,
    },
  ];

  const btnBase = {
    height: 28, fontSize: 12, fontWeight: "bold",
    border: "2px outset #b39ddb", cursor: "pointer", color: "#000", padding: "0 12px",
  };

  return (
    <div className="pos-container">
      <div style={{
        background: "#4a148c", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>Shop Expense Report — {branchCode}</span>
        {onClose && <button onClick={onClose} style={{ ...btnBase, background: "#e1bee7" }}>Close</button>}
      </div>

      <div style={{
        background: "#7b1fa2", padding: "8px 10px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", flexShrink: 0,
      }}>
        <RangePicker value={dateRange} onChange={(v) => setDateRange(v || [dayjs().startOf("month"), dayjs()])} format="DD-MM-YYYY" size="small" />
        <Select
          allowClear placeholder="Expense Head" size="small" style={{ width: 160 }}
          value={expenseTypeId} onChange={setExpenseTypeId}
          options={heads.map((h) => ({ value: h.id, label: h.name }))}
        />
        <Select
          allowClear placeholder="Payment Mode" size="small" style={{ width: 130 }}
          value={paymentMode} onChange={setPaymentMode}
          options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
        />
        <Input
          allowClear placeholder="Entered By" size="small" style={{ width: 120 }}
          value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)}
        />
        <Select
          allowClear placeholder="Status" size="small" style={{ width: 110 }}
          value={status} onChange={setStatus}
          options={STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Input
          allowClear placeholder="Voucher No" size="small" style={{ width: 150 }}
          value={voucherNumber} onChange={(e) => setVoucherNumber(e.target.value)}
        />
        <Button size="small" type="primary" onClick={search} loading={loading}>Search</Button>
      </div>

      <div style={{ flex: 1, padding: 8, background: "#f3e5f5", overflow: "auto" }}>
        <Table
          size="small"
          dataSource={rows}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 50 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={3}><b>Total</b></Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right"><b>{total.toFixed(2)}</b></Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={6} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </div>
    </div>
  );
}
