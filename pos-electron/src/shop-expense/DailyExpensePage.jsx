import React, { useEffect, useRef, useState, useCallback } from "react";
import { DatePicker, Input, InputNumber, Select, message } from "antd";
import dayjs from "dayjs";
import Dexie from "dexie";
import { apiUrl } from "../utils/apiUrl";
import { decodeJwtPayload } from "../auth/auth";
import { buildExpenseVoucherHtml } from "./expensePrint";

const { TextArea } = Input;

const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "OTHER", label: "Other" },
];

// Own small offline queue, following WeighBridgePage.jsx's proven pattern
// (own Dexie table + queue-on-fetch-failure + auto-sync) rather than the
// unused/unwired offlineStockQueue.js module.
const expenseDb = new Dexie("shopExpenseOfflineCache");
expenseDb.version(1).stores({
  pending: "++localId, clientTxnId, createdAt",
});

export default function DailyExpensePage({ onClose }) {
  const tenantId = localStorage.getItem("tenancyId") || "";
  const token    = localStorage.getItem("jwtToken") || "";
  const payload  = decodeJwtPayload(token);
  const username = String(payload?.sub || payload?.username || "");
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const headRef = useRef(null);

  const [heads, setHeads] = useState([]);
  const [expenseDate, setExpenseDate] = useState(() => dayjs());
  const [expenseTypeId, setExpenseTypeId] = useState(null);
  const [amount, setAmount] = useState(null);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [payee, setPayee] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [clientTxnId, setClientTxnId] = useState(() => crypto.randomUUID());
  const [branchInfo, setBranchInfo] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!tenantId || !branchCode) return;
    fetch(apiUrl(`/api/${tenantId}/expense-heads/pos/${branchCode}`), { headers })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setHeads(Array.isArray(data) ? data : []))
      .catch(() => message.error("Failed to load expense heads"));

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

  const fetchPendingCount = useCallback(async () => {
    setPendingCount(await expenseDb.pending.count());
  }, []);

  const syncPending = useCallback(async () => {
    const records = await expenseDb.pending.toArray();
    if (!records.length) return;
    let ok = 0, fail = 0;
    for (const rec of records) {
      const { localId, createdAt, ...body } = rec;
      try {
        const res = await fetch(apiUrl(`/api/${tenantId}/shop-expenses`), {
          method: "POST", headers, body: JSON.stringify(body),
        });
        if (res.ok) { await expenseDb.pending.delete(localId); ok++; } else { fail++; }
      } catch (_) { fail++; }
    }
    fetchPendingCount();
    if (ok > 0) message.success(`Synced ${ok} pending expense${ok > 1 ? "s" : ""}`);
    if (fail > 0) message.warning(`${fail} expense${fail > 1 ? "s" : ""} still pending (server unreachable)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, fetchPendingCount]);

  useEffect(() => {
    fetchPendingCount();
    const onOnline = () => syncPending();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [fetchPendingCount, syncPending]);

  const resetForm = () => {
    setExpenseTypeId(null);
    setAmount(null);
    setPaymentMode("CASH");
    setPayee("");
    setReferenceNo("");
    setRemarks("");
    setClientTxnId(crypto.randomUUID());
    setTimeout(() => headRef.current?.focus?.(), 50);
  };

  const printVoucher = (savedRecord, isReprint = false) => {
    if (!window.POS?.printHtml) return;
    const headName = heads.find((h) => h.id === savedRecord.expense_type_id)?.name
      || savedRecord.expense_type_name || "";
    const html = buildExpenseVoucherHtml({
      branchInfo, branchCode,
      voucherNumber: savedRecord.voucher_number,
      expenseDate: savedRecord.expense_date,
      expenseTypeName: headName,
      amount: savedRecord.amount,
      paymentMode: savedRecord.payment_mode,
      payee: savedRecord.payee,
      referenceNo: savedRecord.reference_no,
      remarks: savedRecord.remarks,
      enteredByUsername: savedRecord.entered_by_username || username,
      printedAt: new Date().toISOString(),
      isReprint,
    });
    // Fire-and-forget — non-thermal print opens a blocking OS dialog; the
    // expense is already saved, so Saving state must not wait on it.
    window.POS.printHtml({ html, silent: true, deviceName: "" })
      .catch((e) => message.error("Print failed: " + (e.message || "Unknown error")));
  };

  const saveExpense = async (andPrint) => {
    if (saving) return;
    if (!tenantId || !token) { message.error("Missing login session. Please login again."); return; }
    if (!branchCode) { message.error("No branch selected."); return; }
    if (!expenseTypeId) { message.warning("Select an expense head."); return; }
    if (!amount || Number(amount) <= 0) { message.warning("Enter an amount greater than zero."); return; }
    if (!paymentMode) { message.warning("Select a payment mode."); return; }

    const body = {
      branch_code: branchCode,
      expense_date: expenseDate.format("YYYY-MM-DD"),
      expense_type_id: expenseTypeId,
      amount: Number(amount),
      payment_mode: paymentMode,
      payee: payee || null,
      reference_no: referenceNo || null,
      remarks: remarks || null,
      client_txn_id: clientTxnId,
    };

    setSaving(true);
    try {
      const res = await fetch(apiUrl(`/api/${tenantId}/shop-expenses`), {
        method: "POST", headers, body: JSON.stringify(body),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Save failed (${res.status})`);
      }
      const saved = await res.json();
      message.success(`Expense saved — ${saved.voucher_number}`);
      if (andPrint) printVoucher(saved, false);
      resetForm();
    } catch (e) {
      // Network failure (server unreachable) — queue for later sync rather than losing the entry.
      // A validation error from a reachable server (4xx with JSON body) is NOT queued.
      const isNetworkFailure = e instanceof TypeError || /failed to fetch|network/i.test(e.message || "");
      if (isNetworkFailure) {
        await expenseDb.pending.add({ ...body, createdAt: new Date().toISOString() });
        await fetchPendingCount();
        message.warning("No connection — expense queued locally and will sync automatically.");
        resetForm();
      } else {
        message.error("Save failed: " + (e.message || "Unknown error"));
      }
    } finally {
      setSaving(false);
    }
  };

  const lbl = (text) => (
    <div style={{ fontSize: 11, fontWeight: "bold", color: "#4a148c", marginBottom: 2 }}>{text}</div>
  );

  const btnBase = {
    height: 30, fontSize: 12, fontWeight: "bold",
    border: "2px outset #b39ddb", cursor: "pointer", color: "#000",
    padding: "0 14px",
  };

  const canSave = !saving && expenseTypeId && Number(amount) > 0 && paymentMode;

  return (
    <div className="pos-container">
      {/* ── Title bar ── */}
      <div style={{
        background: "#4a148c", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>
          Daily Expense{branchCode ? ` — ${branchCode}` : ""}
          {pendingCount > 0 && (
            <span style={{ marginLeft: 10, fontSize: 11, color: "#ffe0b2" }}>
              ({pendingCount} pending sync)
            </span>
          )}
        </span>
        {onClose && (
          <button onClick={onClose} style={{ ...btnBase, background: "#e1bee7" }}>Close</button>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1, padding: 16, background: "#f3e5f5", overflow: "auto",
      }}>
        <div style={{
          maxWidth: 560, margin: "0 auto", background: "#fff",
          border: "1px solid #b39ddb", padding: 16,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              {lbl("Expense Date")}
              <DatePicker
                value={expenseDate}
                onChange={(d) => setExpenseDate(d || dayjs())}
                allowClear={false}
                format="DD-MM-YYYY"
                style={{ width: "100%", borderRadius: 0 }}
              />
            </div>
            <div>
              {lbl("Expense Head")}
              <Select
                ref={headRef}
                value={expenseTypeId}
                onChange={setExpenseTypeId}
                placeholder="Select expense head"
                style={{ width: "100%" }}
                showSearch
                optionFilterProp="label"
                options={heads.map((h) => ({ value: h.id, label: h.name }))}
                autoFocus
              />
            </div>
            <div>
              {lbl("Amount")}
              <InputNumber
                min={0.01}
                precision={2}
                value={amount}
                onChange={setAmount}
                style={{ width: "100%", borderRadius: 0 }}
                onPressEnter={() => canSave && saveExpense(false)}
              />
            </div>
            <div>
              {lbl("Payment Mode")}
              <Select
                value={paymentMode}
                onChange={setPaymentMode}
                style={{ width: "100%" }}
                options={PAYMENT_MODES}
              />
            </div>
            <div>
              {lbl("Paid To / Payee (optional)")}
              <Input value={payee} onChange={(e) => setPayee(e.target.value)} style={{ borderRadius: 0 }} />
            </div>
            <div>
              {lbl("Bill / Reference No (optional)")}
              <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} style={{ borderRadius: 0 }} />
            </div>
            <div style={{ gridColumn: "1 / span 2" }}>
              {lbl("Remarks (optional)")}
              <TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} style={{ borderRadius: 0 }} />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => saveExpense(true)}
              disabled={!canSave}
              style={{ ...btnBase, background: canSave ? "#c8e6c9" : "#e0e0e0", cursor: canSave ? "pointer" : "not-allowed" }}
            >
              {saving ? "Saving…" : "Save and Print"}
            </button>
            <button
              onClick={() => saveExpense(false)}
              disabled={!canSave}
              style={{ ...btnBase, background: canSave ? "#d1c4e9" : "#e0e0e0", cursor: canSave ? "pointer" : "not-allowed" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
