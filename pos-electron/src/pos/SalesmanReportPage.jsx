import React, { useState } from "react";
import { Button, DatePicker, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;

function round2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPrintHtml({ branchCode, dateKey, rows, totalBills, totalAmount }) {
  const printedDate = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const lines = rows
    .map((r) => `
      <tr>
        <td>${escapeHtml(r.salesmanName)}</td>
        <td class="num">${r.totalBills}</td>
        <td class="num">${round2(r.totalAmount).toFixed(2)}</td>
      </tr>`)
    .join("");

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
  .footer { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <hr class="solid"/>
  <div class="report-title">SALESMAN SALES REPORT</div>
  <hr class="dash"/>
  <div class="meta"><span>Branch: ${escapeHtml(branchCode || "-")}</span><span>${escapeHtml(dateKey)}</span></div>
  <div class="meta" style="justify-content:flex-end">Printed: ${escapeHtml(printedDate)}</div>
  <hr class="dash"/>
  <table class="t">
    <thead>
      <tr>
        <th style="text-align:left">Salesman</th>
        <th class="num">Bills</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total-line"><span>Total</span><span>${totalBills} bills</span><span>${round2(totalAmount).toFixed(2)}</span></div>
  <hr class="solid"/>
  <div class="footer">*** End of Salesman Report ***</div>
  <br/><br/>
</body>
</html>`;
}

const columns = [
  { title: "Salesman", dataIndex: "salesmanName", key: "salesmanName" },
  { title: "Total Bills", dataIndex: "totalBills", key: "totalBills", align: "right" },
  {
    title: "Total Amount",
    dataIndex: "totalAmount",
    key: "totalAmount",
    align: "right",
    render: (v) => round2(v).toFixed(2),
  },
];

export default function SalesmanReportPage({ selectedBranchCode }) {
  const [reportDate, setReportDate] = useState(dayjs());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const branchCode = String(
    selectedBranchCode || globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || ""
  ).trim();

  const fetchReport = async () => {
    const token = localStorage.getItem("jwtToken") || "";
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId || !token) { message.error("Missing session. Please login."); return; }
    if (!branchCode) { message.error("No branch selected."); return; }

    const dateKey = reportDate.format("YYYY-MM-DD");
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/${tenantId}/salesman-summary?branchCode=${encodeURIComponent(branchCode)}&date=${dateKey}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `Error ${res.status}`);
      }
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setFetched(true);
    } catch (e) {
      message.error("Failed to load report: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const printReport = async () => {
    if (!window.POS?.printHtml) { message.error("Print API not available"); return; }
    if (!rows.length) { message.warning("No data to print"); return; }

    const totalBills = rows.reduce((s, r) => s + (Number(r.totalBills) || 0), 0);
    const totalAmount = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);
    const html = buildPrintHtml({ branchCode, dateKey: reportDate.format("YYYY-MM-DD"), rows, totalBills, totalAmount });

    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
      message.success("Print sent");
    } catch (e) {
      message.error("Print failed: " + (e.message || "Unknown error"));
    }
  };

  const totalBills = rows.reduce((s, r) => s + (Number(r.totalBills) || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.totalAmount) || 0), 0);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Salesman Sales Report
        </Title>
        <Space>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>
          <DatePicker value={reportDate} onChange={(d) => { setReportDate(d || dayjs()); setFetched(false); }} />
          <Button type="primary" onClick={fetchReport} loading={loading}>
            Load
          </Button>
          <Button onClick={printReport} disabled={!rows.length}>
            Print
          </Button>
        </Space>
      </div>

      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        rowKey="salesmanName"
        locale={{ emptyText: fetched ? "No sales for this date" : "Select date and click Load" }}
      />

      {rows.length > 0 && (
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 16 }}>
          <Text strong>Total Bills: {totalBills}</Text>
          <Text strong>Total Amount: {round2(totalAmount).toFixed(2)}</Text>
        </div>
      )}
    </div>
  );
}
