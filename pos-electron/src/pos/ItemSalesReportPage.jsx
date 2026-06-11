import React, { useEffect, useState } from "react";
import { Button, DatePicker, Select, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { localSearchItems } from "../cache/itemCache";

const { Title, Text } = Typography;

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ── Thermal print HTML ────────────────────────────────────────────────────────

function buildPrintHtml({ branchCode, dateKey, grouped }) {
  const printedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  let totalQty = 0;
  const salesmanBlocks = Object.entries(grouped).map(([salesman, items]) => {
    const subQty = items.reduce((s, r) => s + r.qty, 0);
    totalQty += subQty;
    const lines = items.map((r) => `
      <tr>
        <td>${esc(r.itemName)}</td>
        <td class="num">${r2(r.qty).toFixed(2)}</td>
      </tr>`).join("");
    return `
      <tr class="salesman-row"><td colspan="2">${esc(salesman)}</td></tr>
      ${lines}
      <tr class="subtotal-row">
        <td>Subtotal</td>
        <td class="num">${r2(subQty).toFixed(2)}</td>
      </tr>`;
  }).join('<tr><td colspan="2"><hr class="dash"/></td></tr>');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px; width: 258px;
    color: #000; background: #fff;
    padding: 6px 4px 6px 1px;
  }
  .report-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; }
  .meta { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  hr.dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table.t { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.t th { font-size: 10px; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.t th.num, table.t td.num { text-align: right; padding-right: 3px; }
  table.t td { padding: 1px 2px; }
  .salesman-row td { font-weight: bold; padding-top: 4px; font-size: 10px; background: #f0f0f0; }
  .subtotal-row td { border-top: 1px dashed #000; font-weight: bold; }
  .total-line { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; margin: 3px 0; }
  .footer { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <hr class="solid"/>
  <div class="report-title">ITEM SALES REPORT</div>
  <hr class="dash"/>
  <div class="meta"><span>Branch: ${esc(branchCode || "-")}</span><span>${esc(dateKey)}</span></div>
  <div class="meta" style="justify-content:flex-end">Printed: ${esc(printedAt)}</div>
  <hr class="dash"/>
  <table class="t">
    <thead>
      <tr>
        <th style="text-align:left">Item</th>
        <th class="num">Qty</th>
      </tr>
    </thead>
    <tbody>${salesmanBlocks}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total-line"><span>Total Qty</span><span>${r2(totalQty).toFixed(2)}</span></div>
  <hr class="solid"/>
  <div class="footer">*** End of Item Sales Report ***</div>
  <br/><br/>
</body>
</html>`;
}

// ── Table columns ─────────────────────────────────────────────────────────────

const columns = [
  { title: "Salesman",  dataIndex: "salesmanName", key: "salesmanName", width: 130 },
  { title: "Item",      dataIndex: "itemName",     key: "itemName" },
  { title: "Qty",       dataIndex: "qty",          key: "qty", align: "right", width: 80,
    render: (v) => r2(v).toFixed(2) },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ItemSalesReportPage({ selectedBranchCode }) {
  const [reportDate, setReportDate] = useState(dayjs());
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const [itemOptions,   setItemOptions]   = useState([]);
  const [itemSearch,    setItemSearch]    = useState("");
  const [selectedItem,  setSelectedItem]  = useState(null); // { value: itemId, label: itemName }

  // Search items from local cache as user types
  useEffect(() => {
    let cancelled = false;
    localSearchItems(itemSearch, 30).then((items) => {
      if (cancelled) return;
      setItemOptions(items.map((it) => ({ value: it.itemId, label: it.itemName })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [itemSearch]);

  const branchCode = String(
    selectedBranchCode || globalThis.POS_BRANCH_CODE ||
    localStorage.getItem("selectedBranchCode") || ""
  ).trim();

  const fetchReport = async () => {
    const token    = localStorage.getItem("jwtToken")  || "";
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId || !token) { message.error("Missing session. Please login."); return; }
    if (!branchCode)         { message.error("No branch selected."); return; }

    const dateKey = reportDate.format("YYYY-MM-DD");
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/${tenantId}/item-sales-summary?branchCode=${encodeURIComponent(branchCode)}&date=${dateKey}`),
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
    if (!filteredRows.length)   { message.warning("No data to print");       return; }

    // Group rows by salesman for the print layout
    const grouped = {};
    filteredRows.forEach((r) => {
      const key = r.salesmanName || "Unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    const html = buildPrintHtml({ branchCode, dateKey: reportDate.format("YYYY-MM-DD"), grouped });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
      message.success("Print sent");
    } catch (e) {
      message.error("Print failed: " + (e.message || "Unknown error"));
    }
  };

  const filteredRows = selectedItem
    ? rows.filter((r) => r.itemName === selectedItem.label)
    : rows;

  const totalQty = filteredRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Item Sales Report
        </Title>
        <Space wrap>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>
          <Select
            showSearch
            placeholder="All items"
            style={{ width: 200 }}
            value={selectedItem?.value ?? undefined}
            filterOption={false}
            onSearch={setItemSearch}
            onChange={(val, opt) => setSelectedItem(opt ?? null)}
            options={itemOptions}
            allowClear
            onClear={() => setSelectedItem(null)}
          />
          <DatePicker
            value={reportDate}
            onChange={(d) => { setReportDate(d || dayjs()); setFetched(false); }}
          />
          <Button type="primary" onClick={fetchReport} loading={loading}>Load</Button>
          <Button onClick={printReport} disabled={!filteredRows.length}>Print</Button>
        </Space>
      </div>

      <Table
        size="small"
        dataSource={filteredRows}
        columns={columns}
        pagination={false}
        rowKey={(r, i) => `${r.salesmanName}-${r.itemName}-${i}`}
        locale={{ emptyText: fetched ? "No sales for this period" : "Select date and click Load" }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary.Row>
              <Table.Summary.Cell colSpan={2} align="right">
                <Text strong>Total Qty</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell align="right">
                <Text strong>{r2(totalQty).toFixed(2)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          ) : null
        }
      />
    </div>
  );
}
