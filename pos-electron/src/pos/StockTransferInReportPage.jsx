import React, { useState } from "react";
import { Button, DatePicker, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmt(v) { return r2(v).toFixed(2); }

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ── Print ─────────────────────────────────────────────────────────────────────

function buildPrintHtml({ branchCode, fromDate, toDate, rows }) {
  const printedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const totalQty    = rows.reduce((s, r) => s + (Number(r.qty)    || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  const bodyRows = rows.map((r) => `
    <tr>
      <td>${esc(String(r.voucherDate || "").slice(0, 10))}</td>
      <td>${esc(r.voucherNumber || "")}</td>
      <td>${esc(r.fromBranch || "")}</td>
      <td>${esc(r.itemName || "")}</td>
      <td class="num">${fmt(r.qty)}</td>
      <td class="num">${fmt(r.rate)}</td>
      <td class="num">${fmt(r.amount)}</td>
      <td>${esc(r.status || "")}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 10mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; background: #fff; }
  .title  { text-align: center; font-size: 12px; font-weight: bold; margin: 4px 0; }
  .meta   { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  hr.dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table   { width: 100%; border-collapse: collapse; font-size: 9px; }
  th      { padding: 2px 3px; border-bottom: 1px solid #000; text-align: left; background: #f0f0f0; }
  td      { padding: 2px 3px; border-bottom: 1px dashed #ddd; }
  .num    { text-align: right; }
  .total  { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 3px 0; }
  .footer { text-align: center; font-size: 9px; margin-top: 8px; }
</style>
</head>
<body>
  <hr class="solid"/>
  <div class="title">STOCK TRANSFER IN REPORT</div>
  <hr class="dash"/>
  <div class="meta"><span>Branch: ${esc(branchCode)}</span><span>${esc(fromDate)} – ${esc(toDate)}</span></div>
  <div class="meta" style="justify-content:flex-end">Printed: ${esc(printedAt)}</div>
  <hr class="dash"/>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Voucher</th><th>From</th><th>Item</th>
        <th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total"><span>Total Qty</span><span>${fmt(totalQty)}</span></div>
  <div class="total"><span>Total Amount</span><span>${fmt(totalAmount)}</span></div>
  <hr class="solid"/>
  <div class="footer">*** End of Stock Transfer In Report ***</div>
</body>
</html>`;
}

// ── Columns ───────────────────────────────────────────────────────────────────

const columns = [
  {
    title: "Date", dataIndex: "voucherDate", key: "voucherDate", width: 100,
    render: (v) => String(v || "").slice(0, 10),
  },
  { title: "Voucher #",   dataIndex: "voucherNumber", key: "voucherNumber", width: 130 },
  { title: "From Branch", dataIndex: "fromBranch",    key: "fromBranch",    width: 110 },
  { title: "Item",        dataIndex: "itemName",       key: "itemName" },
  {
    title: "Qty", dataIndex: "qty", key: "qty", align: "right", width: 80,
    render: (v) => fmt(v),
  },
  {
    title: "Rate", dataIndex: "rate", key: "rate", align: "right", width: 80,
    render: (v) => fmt(v),
  },
  {
    title: "Amount", dataIndex: "amount", key: "amount", align: "right", width: 90,
    render: (v) => <Text strong>{fmt(v)}</Text>,
  },
  {
    title: "Status", dataIndex: "status", key: "status", width: 100,
    render: (v) => (
      <Tag color={v === "ACCEPTED" ? "success" : "warning"}>
        {v === "ACCEPTED" ? "Accepted" : "Pending"}
      </Tag>
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function StockTransferInReportPage({ selectedBranchCode }) {
  const [dateRange, setDateRange] = useState([dayjs().startOf("month"), dayjs()]);
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false);

  const branchCode = String(
    selectedBranchCode || globalThis.POS_BRANCH_CODE ||
    localStorage.getItem("selectedBranchCode") || ""
  ).trim();

  const fetchReport = async () => {
    const token    = localStorage.getItem("jwtToken")  || "";
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId || !token) { message.error("Missing session. Please login."); return; }
    if (!branchCode)         { message.error("No branch selected.");            return; }
    if (!dateRange?.[0] || !dateRange?.[1]) { message.error("Please select a date range."); return; }

    const fromDate = dateRange[0].format("YYYY-MM-DD");
    const toDate   = dateRange[1].format("YYYY-MM-DD");

    setLoading(true);
    try {
      const params = new URLSearchParams({ branchCode, fromDate, toDate });
      const res = await fetch(
        apiUrl(`/api/${tenantId}/reports/stock-transfer-in?${params}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text().catch(() => `Error ${res.status}`));
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
    if (!rows.length)            { message.warning("No data to print");      return; }
    const html = buildPrintHtml({
      branchCode,
      fromDate: dateRange[0].format("YYYY-MM-DD"),
      toDate:   dateRange[1].format("YYYY-MM-DD"),
      rows,
    });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
      message.success("Print sent");
    } catch (e) {
      message.error("Print failed: " + (e.message || "Unknown error"));
    }
  };

  const totalQty    = rows.reduce((s, r) => s + (Number(r.qty)    || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Stock Transfer In Report
        </Title>
        <Space wrap>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>
          <RangePicker
            value={dateRange}
            onChange={(v) => { setDateRange(v || [dayjs().startOf("month"), dayjs()]); setFetched(false); }}
            allowClear={false}
          />
          <Button type="primary" onClick={fetchReport} loading={loading}>Load</Button>
          <Button onClick={printReport} disabled={!rows.length}>Print</Button>
        </Space>
      </div>

      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        rowKey={(_, i) => i}
        rowClassName={(r) => r.status === "PENDING" ? "row-pending" : ""}
        locale={{ emptyText: fetched ? "No transfers found for this period" : "Select date range and click Load" }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: "#f9fafb" }}>
                <Table.Summary.Cell colSpan={4} align="right">
                  <Text strong>Totals</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell align="right">
                  <Text strong>{fmt(totalQty)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell />
                <Table.Summary.Cell align="right">
                  <Text strong style={{ color: "#1d4ed8" }}>{fmt(totalAmount)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell />
              </Table.Summary.Row>
            </Table.Summary>
          ) : null
        }
      />
    </div>
  );
}
