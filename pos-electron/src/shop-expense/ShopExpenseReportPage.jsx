import React, { useEffect, useState, useCallback } from "react";
import { DatePicker, Select, Input, InputNumber, Table, Button, Tag, Modal, Popconfirm, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { buildExpenseVoucherHtml } from "./expensePrint";

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const PAYMENT_MODES = ["CASH", "CARD", "UPI", "BANK_TRANSFER", "OTHER"];
const STATUSES = ["ACTIVE", "VOIDED"];

// Branch-locked report — only this terminal's branch. Edit and Delete are
// allowed only for today's own-branch expenses while day-end hasn't been done
// for this branch/date (server re-verifies both on every save/delete); once
// either is no longer true, the expense can only be corrected/voided from Web
// Admin.
export default function ShopExpenseReportPage({ onClose }) {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken") || "";
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

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

  const [editRecord, setEditRecord] = useState(null);
  const [editChecking, setEditChecking] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editAmount, setEditAmount] = useState(null);
  const [editExpenseTypeId, setEditExpenseTypeId] = useState(null);
  const [editPaymentMode, setEditPaymentMode] = useState(null);
  const [editPayee, setEditPayee] = useState("");
  const [editReferenceNo, setEditReferenceNo] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [deletingId, setDeletingId] = useState(null);

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

  // Live server check — the terminal's local day_end_records cache is
  // per-terminal only, so editability must be re-verified against the
  // server (day_end_dtl) rather than trusted from local state.
  const isDayEndDone = async (forDate) => {
    const res = await fetch(apiUrl(`/api/${tenantId}/day-end/details/${branchCode}/${forDate}`), { headers });
    if (!res.ok) throw new Error(`Day-end check failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  };

  const openEdit = async (record) => {
    setEditChecking(true);
    try {
      if (await isDayEndDone(record.expense_date)) {
        message.warning("Day end has already been done for this date — edit this expense from Web Admin instead.");
        return;
      }
      setEditRecord(record);
      setEditAmount(Number(record.amount));
      setEditExpenseTypeId(record.expense_type_id);
      setEditPaymentMode(record.payment_mode);
      setEditPayee(record.payee || "");
      setEditReferenceNo(record.reference_no || "");
      setEditRemarks(record.remarks || "");
    } catch (e) {
      message.error(e.message || "Could not check day-end status");
    } finally {
      setEditChecking(false);
    }
  };

  const closeEdit = () => setEditRecord(null);

  const saveEdit = async () => {
    if (!editRecord) return;
    if (!editExpenseTypeId) { message.warning("Select an expense head."); return; }
    if (!editAmount || Number(editAmount) <= 0) { message.warning("Enter an amount greater than zero."); return; }
    if (!editPaymentMode) { message.warning("Select a payment mode."); return; }

    setEditSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/${tenantId}/shop-expenses/${editRecord.id}/edit`), {
        method: "POST",
        headers,
        body: JSON.stringify({
          expense_type_id: editExpenseTypeId,
          amount: Number(editAmount),
          payment_mode: editPaymentMode,
          payee: editPayee || null,
          reference_no: editReferenceNo || null,
          remarks: editRemarks || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
      message.success("Expense updated");
      closeEdit();
      search();
    } catch (e) {
      message.error(e.message || "Failed to update expense");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteExpense = async (record) => {
    setDeletingId(record.id);
    try {
      const res = await fetch(apiUrl(`/api/${tenantId}/shop-expenses/${record.id}`), {
        method: "DELETE",
        headers,
        body: JSON.stringify({ reason: "Deleted from POS" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Delete failed (${res.status})`);
      }
      message.success("Expense deleted");
      search();
    } catch (e) {
      message.error(e.message || "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  const today = dayjs().format("YYYY-MM-DD");
  // Same gating as Edit — same-day, not-yet-voided; the server also re-verifies
  // day-end-not-done at the moment of delete, since that can change mid-session.
  const canEdit = (record) => record.status !== "VOIDED" && record.expense_date === today;

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
      title: "Action", width: 220,
      render: (_, record) => (
        <>
          <Button size="small" onClick={() => reprint(record)}>Print</Button>
          {canEdit(record) && (
            <Button size="small" style={{ marginLeft: 6 }} loading={editChecking} onClick={() => openEdit(record)}>
              Edit
            </Button>
          )}
          {canEdit(record) && (
            <Popconfirm
              title="Delete this expense?"
              description="This cannot be undone from POS."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => deleteExpense(record)}
            >
              <Button size="small" danger style={{ marginLeft: 6 }} loading={deletingId === record.id}>
                Delete
              </Button>
            </Popconfirm>
          )}
        </>
      ),
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

      <Modal
        title={editRecord ? `Edit Expense — ${editRecord.voucher_number}` : "Edit Expense"}
        open={!!editRecord}
        onCancel={closeEdit}
        onOk={saveEdit}
        confirmLoading={editSaving}
        okText="Save"
      >
        {editRecord && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Expense Head</div>
              <Select
                value={editExpenseTypeId}
                onChange={setEditExpenseTypeId}
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="label"
                options={heads.map((h) => ({ value: h.id, label: h.name }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Amount</div>
              <InputNumber min={0.01} precision={2} value={editAmount} onChange={setEditAmount} style={{ width: "100%" }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Payment Mode</div>
              <Select
                value={editPaymentMode}
                onChange={setEditPaymentMode}
                style={{ width: "100%" }}
                options={PAYMENT_MODES.map((m) => ({ value: m, label: m }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Paid To / Payee</div>
              <Input value={editPayee} onChange={(e) => setEditPayee(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Bill / Reference No</div>
              <Input value={editReferenceNo} onChange={(e) => setEditReferenceNo(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              <div style={{ fontSize: 11, fontWeight: "bold", marginBottom: 2 }}>Remarks</div>
              <TextArea rows={2} value={editRemarks} onChange={(e) => setEditRemarks(e.target.value)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
