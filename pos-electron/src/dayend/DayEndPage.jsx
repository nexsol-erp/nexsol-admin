import React, { useEffect, useMemo, useState } from "react";
import { Button, DatePicker, InputNumber, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

function round2n(v) {
  const n = Number(v) || 0;
  return Math.round(n * 100) / 100;
}

function loadDayEndRecords() {
  try {
    const raw = localStorage.getItem("day_end_records") || "[]";
    const rows = JSON.parse(raw);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    return [];
  }
}

function saveDayEndRecords(rows) {
  localStorage.setItem("day_end_records", JSON.stringify(rows));
}

export default function DayEndPage() {
  const [dayEndDate, setDayEndDate] = useState(dayjs());
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [qtyByDenom, setQtyByDenom] = useState(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [String(d), 0]))
  );

  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const [branchInfo, setBranchInfo] = useState(null);

  useEffect(() => {
    if (!branchCode) return;
    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken") || "";
    fetch(apiUrl(`/api/${tenantId}/branches`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        const found = list.find((b) => b.branchCode === branchCode) || null;
        setBranchInfo(found);
      })
      .catch(() => {});
  }, [branchCode]);

  // Recheck saved state whenever date or branch changes
  useEffect(() => {
    const dateKey = dayEndDate.format("YYYY-MM-DD");
    const records = loadDayEndRecords();
    setIsSaved(records.some((r) => r.dateKey === dateKey && r.branchCode === branchCode));
  }, [dayEndDate, branchCode]);

  const rows = useMemo(() => {
    return DENOMINATIONS.map((currency) => {
      const quantity = Number(qtyByDenom[String(currency)] || 0);
      const amount = round2n(currency * quantity);
      return {
        key: String(currency),
        currency,
        quantity,
        amount,
      };
    });
  }, [qtyByDenom]);

  const grandTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );

  const updateQty = (currency, value) => {
    const nextQty = Math.max(Number(value || 0), 0);
    setQtyByDenom((prev) => ({ ...prev, [String(currency)]: nextQty }));
  };

  const onSaveDayEnd = async () => {
    if (saving) return;
    if (!(grandTotal > 0)) {
      message.warning("Grand total must be greater than 0 to save Day End");
      return;
    }
    const dateKey = dayEndDate.format("YYYY-MM-DD");
    const records = loadDayEndRecords();
    const exists = records.some((r) => r.dateKey === dateKey && r.branchCode === branchCode);
    if (exists) {
      message.warning("Day End is already done for this date and branch");
      return;
    }

    const token = localStorage.getItem("jwtToken") || "";
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }

    const lineItems = rows
      .filter((r) => Number(r.quantity || 0) > 0)
      .map((r) => ({
        currency: Number(r.currency || 0),
        quantity: Number(r.quantity || 0),
        amount: Number(r.amount || 0),
      }));

    const payload = {
      branchCode,
      dayEndDate: dateKey,
      details: lineItems,
      totalAmount: round2n(grandTotal),
    };

    const localRecord = {
      id: crypto.randomUUID(),
      branchCode,
      dateKey,
      createdAt: new Date().toISOString(),
      lines: rows.map((r) => ({
        currency: r.currency,
        quantity: r.quantity,
        amount: r.amount,
      })),
      grandTotal: round2n(grandTotal),
    };

    try {
      setSaving(true);
      const res = await fetch(apiUrl(`/api/${tenantId}/day-end/details`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Save failed (${res.status})`);
      }

      records.push(localRecord);
      saveDayEndRecords(records);
      setIsSaved(true);
      message.success("Day End completed successfully");

      // Fetch sales summary then auto-print
      let salesSummary = {};
      try {
        const sumRes = await fetch(
          apiUrl(`/api/${tenantId}/day-end/summary/${branchCode}/${dateKey}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (sumRes.ok) salesSummary = await sumRes.json();
      } catch (_) {}

      if (window.POS?.printHtml) {
        const html = buildDayEndReportHtml({
          branchInfo, branchCode, dateKey,
          printedAt: new Date().toISOString(),
          rows, grandTotal, salesSummary,
        });
        window.POS.printHtml({ html, silent: true, deviceName: "" }).catch(() => {});
      }
    } catch (e) {
      message.error("Day End save failed: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const printReport = async () => {
    if (!window.POS?.printHtml) {
      message.error("Print API not available");
      return;
    }
    const dateKey  = dayEndDate.format("YYYY-MM-DD");
    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken") || "";
    const headers  = { Authorization: `Bearer ${token}` };

    // Fetch saved day-end denomination rows from backend
    let fetchedRows = [];
    let fetchedTotal = 0;
    try {
      const detRes = await fetch(
        apiUrl(`/api/${tenantId}/day-end/details/${branchCode}/${dateKey}`),
        { headers }
      );
      if (detRes.ok) {
        const data = await detRes.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedRows = data.map((e) => ({
            currency: Number(e.currency || 0),
            quantity: Number(e.quantity || 0),
            amount:   Number(e.amount   || 0),
          }));
          fetchedTotal = fetchedRows.reduce((s, r) => s + r.amount, 0);
        }
      }
    } catch (_) {}

    const printRows  = fetchedRows;
    const printTotal = fetchedTotal;

    let salesSummary = {};
    try {
      const sumRes = await fetch(
        apiUrl(`/api/${tenantId}/day-end/summary/${branchCode}/${dateKey}`),
        { headers }
      );
      if (sumRes.ok) salesSummary = await sumRes.json();
    } catch (_) {}

    const html = buildDayEndReportHtml({
      branchInfo, branchCode, dateKey,
      printedAt: new Date().toISOString(),
      rows: printRows, grandTotal: printTotal, salesSummary,
    });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
    } catch (e) {
      message.error("Print failed: " + (e.message || "Unknown error"));
    }
  };

  const columns = [
    { title: "Currency", dataIndex: "currency", width: 160, render: (v) => <Text strong>{v}</Text> },
    {
      title: "Quantity",
      dataIndex: "quantity",
      width: 200,
      render: (_, row) => (
        <InputNumber
          min={0}
          precision={0}
          value={row.quantity}
          onChange={(val) => updateQty(row.currency, val)}
          style={{ width: "100%" }}
        />
      ),
    },
    { title: "Amount", dataIndex: "amount", width: 180, render: (v) => Number(v || 0).toFixed(2) },
  ];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Day End
        </Title>
        <Space>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>
          <DatePicker value={dayEndDate} onChange={(d) => setDayEndDate(d || dayjs())} />
          <Button onClick={printReport} disabled={!isSaved}>Print</Button>
          <Button type="primary" onClick={onSaveDayEnd} loading={saving} disabled={!(grandTotal > 0) || isSaved}>
            Save Day End
          </Button>
        </Space>
      </div>

      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        rowKey="key"
      />
      <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Text strong style={{ color: "#374151" }}>Grand Total:</Text>
        <Text strong style={{ color: "#1f2937" }}>{Number(grandTotal || 0).toFixed(2)}</Text>
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildDayEndReportHtml({ branchInfo, branchCode, dateKey, printedAt, rows, grandTotal, salesSummary = {} }) {
  const b = branchInfo || {};
  const branchName = b.branchName || branchCode || "";
  const addrParts  = [b.branchBuildingAddress, b.branchAddress1, b.branchState].filter(Boolean);
  const phone      = b.branchStreetAddress || "";
  const gst        = b.branchGst || "";

  const addrHtml = addrParts.map((l) => `<div class="addr">${escapeHtml(l)}</div>`).join("");
  const phoneHtml = phone ? `<div class="addr">Ph: ${escapeHtml(phone)}</div>` : "";
  const gstHtml   = gst   ? `<div class="addr">GST: ${escapeHtml(gst)}</div>`  : "";

  const printedDate = new Date(printedAt).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // Denomination rows (only non-zero)
  const denomRows = rows
    .filter((r) => Number(r.quantity || 0) > 0)
    .map((r) => `
      <tr>
        <td class="num">${escapeHtml(String(r.currency))}</td>
        <td class="num">${Number(r.quantity || 0)}</td>
        <td class="num">${Number(r.amount || 0).toFixed(2)}</td>
      </tr>`)
    .join("");

  // Sales summary from backend
  const byMode       = Array.isArray(salesSummary.byMode) ? salesSummary.byMode : [];
  const totalSales   = Number(salesSummary.totalSales   || 0);
  const billCount    = Number(salesSummary.billCount    || 0);
  const totalReceipts = Number(salesSummary.totalReceipts || 0);

  const receiptRows = byMode.map((m) => `
      <tr>
        <td>${escapeHtml(String(m.receiptMode || ""))}</td>
        <td class="num">${Number(m.amount || 0).toFixed(2)}</td>
      </tr>`).join("");

  const salesSection = byMode.length > 0 || totalSales > 0 ? `
    <hr class="dash"/>
    <div class="section-title">Sales Summary</div>
    <table class="t">
      <tbody>
        <tr><td>Total Bills</td><td class="num">${billCount}</td></tr>
        <tr class="bold-row"><td>Total Sales</td><td class="num">${totalSales.toFixed(2)}</td></tr>
      </tbody>
    </table>
    <hr class="dash"/>
    <div class="section-title">Receipt Mode Breakdown</div>
    <table class="t">
      <thead><tr><th>Mode</th><th class="num">Amount</th></tr></thead>
      <tbody>
        ${receiptRows}
      </tbody>
    </table>
    <hr class="dash"/>
    <div class="total-line"><span>Total Receipts</span><span>${totalReceipts.toFixed(2)}</span></div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    width: 258px;
    color: #000;
    background: #fff;
    padding: 6px 4px 6px 1px;
  }
  .shop-name { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 2px; }
  .addr { font-size: 9px; text-align: center; line-height: 1.4; }
  .report-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; }
  .meta { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  .section-title { font-size: 10px; font-weight: bold; margin: 3px 0 1px 0; }
  hr.dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table.t { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.t th { font-size: 10px; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.t th.num { text-align: right; padding-right: 3px; }
  table.t td { padding: 1px 2px; }
  table.t td.num { text-align: right; padding-right: 3px; }
  .total-line { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 3px 0; }
  .bold-row td { font-weight: bold; border-top: 1px dashed #000; }
  .footer { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <div class="shop-name">${escapeHtml(branchName)}</div>
  ${addrHtml}${phoneHtml}${gstHtml}
  <hr class="solid"/>
  <div class="report-title">DAY END COLLECTION REPORT</div>
  <hr class="dash"/>
  <div class="meta"><span>Branch: ${escapeHtml(branchCode)}</span><span>${escapeHtml(dateKey)}</span></div>
  <div class="meta" style="justify-content:flex-end">Printed: ${escapeHtml(printedDate)}</div>
  <hr class="dash"/>

  <div class="section-title">Cash Denomination</div>
  <table class="t">
    <thead>
      <tr>
        <th class="num">Currency</th>
        <th class="num">Qty</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${denomRows}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total-line"><span>Cash Total</span><span>${Number(grandTotal || 0).toFixed(2)}</span></div>

  ${salesSection}

  <hr class="solid"/>
  <div class="footer">*** End of Day End Report ***</div>
  <br/><br/>
</body>
</html>`;
}
