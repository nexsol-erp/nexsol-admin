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
  const lines = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.salesmanName)}</td>
        <td style="text-align:right">${r.totalBills}</td>
        <td style="text-align:right">${round2(r.totalAmount).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <body style="font-family: monospace; width: 300px;">
      <div style="text-align:center;font-weight:bold;">SALESMAN SALES REPORT</div>
      <hr/>
      <div>Branch: ${escapeHtml(branchCode || "-")}</div>
      <div>Date: ${escapeHtml(dateKey)}</div>
      <div>Printed: ${new Date().toLocaleString()}</div>
      <hr/>
      <table style="width:100%; font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left">Salesman</th>
            <th style="text-align:right">Bills</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <hr/>
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>Total</span>
        <span>${totalBills} bills</span>
        <span>${round2(totalAmount).toFixed(2)}</span>
      </div>
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
