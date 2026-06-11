import React, { useEffect, useState } from "react";
import { Button, DatePicker, Select, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { localSearchItems } from "../cache/itemCache";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function r2(v) { return Math.round((Number(v) || 0) * 100) / 100; }
function fmt(v) { return r2(v) === 0 ? "" : r2(v).toFixed(2); }

function esc(s) {
  return String(s || "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

// ── Print ─────────────────────────────────────────────────────────────────────

function buildPrintHtml({ itemName, branchCode, fromDate, toDate, openingBalance, rows, closingBalance }) {
  const printedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  const totalIn  = rows.reduce((s, r) => s + (Number(r.qtyIn)  || 0), 0);
  const totalOut = rows.reduce((s, r) => s + (Number(r.qtyOut) || 0), 0);

  const bodyRows = rows.map((r) => `
    <tr>
      <td>${esc(r.voucherDate?.slice(0, 10) || "")}</td>
      <td>${esc(r.voucherNumber || r.sourceVoucher || "")}</td>
      <td>${esc(r.particulars || "")}</td>
      <td class="num">${fmt(r.qtyIn)}</td>
      <td class="num">${fmt(r.qtyOut)}</td>
      <td class="num">${r2(r.balance).toFixed(2)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px;
         width: 258px; color: #000; background: #fff; padding: 6px 4px; }
  .title  { text-align: center; font-size: 11px; font-weight: bold; margin: 3px 0; }
  .meta   { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  hr.dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table   { width: 100%; border-collapse: collapse; font-size: 9px; }
  th      { padding: 1px 2px; border-bottom: 1px dashed #000; text-align: left; }
  td      { padding: 1px 2px; }
  .num    { text-align: right; }
  .total  { display: flex; justify-content: space-between; font-size: 10px;
            font-weight: bold; margin: 3px 0; }
  .footer { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <hr class="solid"/>
  <div class="title">ITEM MOVEMENT REPORT</div>
  <hr class="dash"/>
  <div class="meta"><span>${esc(itemName)}</span></div>
  <div class="meta"><span>Branch: ${esc(branchCode)}</span></div>
  <div class="meta"><span>${esc(fromDate)} – ${esc(toDate)}</span></div>
  <div class="meta" style="justify-content:flex-end">Printed: ${esc(printedAt)}</div>
  <hr class="dash"/>
  <div class="total"><span>Opening Balance</span><span>${r2(openingBalance).toFixed(2)}</span></div>
  <hr class="dash"/>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Voucher</th><th>Particulars</th>
        <th class="num">In</th><th class="num">Out</th><th class="num">Bal</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total"><span>Total In</span><span>${r2(totalIn).toFixed(2)}</span></div>
  <div class="total"><span>Total Out</span><span>${r2(totalOut).toFixed(2)}</span></div>
  <div class="total"><span>Closing Balance</span><span>${r2(closingBalance).toFixed(2)}</span></div>
  <hr class="solid"/>
  <div class="footer">*** End of Item Movement Report ***</div>
  <br/><br/>
</body>
</html>`;
}

// ── Columns ───────────────────────────────────────────────────────────────────

const columns = [
  {
    title: "Date", dataIndex: "voucherDate", key: "voucherDate", width: 105,
    render: (v) => v ? String(v).slice(0, 10) : "",
  },
  { title: "Voucher #", key: "voucher", width: 120,
    render: (_, r) => r.voucherNumber || r.sourceVoucher || "" },
  { title: "Particulars", dataIndex: "particulars", key: "particulars" },
  { title: "Batch", dataIndex: "batch", key: "batch", width: 90 },
  { title: "Qty In",  dataIndex: "qtyIn",  key: "qtyIn",  align: "right", width: 80,
    render: (v) => fmt(v) },
  { title: "Qty Out", dataIndex: "qtyOut", key: "qtyOut", align: "right", width: 80,
    render: (v) => fmt(v) },
  { title: "Balance", dataIndex: "balance", key: "balance", align: "right", width: 90,
    render: (v) => <Text strong>{r2(v).toFixed(2)}</Text> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ItemMovementReportPage({ selectedBranchCode }) {
  const [dateRange,       setDateRange]       = useState([dayjs().startOf("week"), dayjs()]);
  const [rows,            setRows]            = useState([]);
  const [openingBalance,  setOpeningBalance]  = useState(null);
  const [closingBalance,  setClosingBalance]  = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [fetched,         setFetched]         = useState(false);

  const [itemOptions,  setItemOptions]  = useState([]);
  const [itemSearch,   setItemSearch]   = useState("");
  const [selectedItem, setSelectedItem] = useState(null);

  const branchCode = String(
    selectedBranchCode || globalThis.POS_BRANCH_CODE ||
    localStorage.getItem("selectedBranchCode") || ""
  ).trim();

  useEffect(() => {
    let cancelled = false;
    localSearchItems(itemSearch, 30).then((items) => {
      if (cancelled) return;
      setItemOptions(items.map((it) => ({ value: it.itemId, label: it.itemName, item: it })));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [itemSearch]);

  const fetchReport = async () => {
    const token    = localStorage.getItem("jwtToken")  || "";
    const tenantId = localStorage.getItem("tenancyId") || "";
    if (!tenantId || !token)  { message.error("Missing session. Please login."); return; }
    if (!branchCode)           { message.error("No branch selected.");           return; }
    if (!selectedItem)         { message.error("Please select an item.");        return; }
    if (!dateRange?.[0] || !dateRange?.[1]) { message.error("Please select a date range."); return; }

    const fromDate = dateRange[0].format("YYYY-MM-DD");
    const toDate   = dateRange[1].format("YYYY-MM-DD");

    setLoading(true);
    try {
      const params = new URLSearchParams({ itemId: selectedItem.value, branchCode, fromDate, toDate });
      const res = await fetch(
        apiUrl(`/api/${tenantId}/reports/item-movement?${params}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await res.text().catch(() => `Error ${res.status}`));
      const data = await res.json();
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setOpeningBalance(data.openingBalance ?? 0);
      setClosingBalance(data.closingBalance ?? 0);
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
      itemName:       selectedItem?.label || "",
      branchCode,
      fromDate:       dateRange[0].format("YYYY-MM-DD"),
      toDate:         dateRange[1].format("YYYY-MM-DD"),
      openingBalance: openingBalance ?? 0,
      rows,
      closingBalance: closingBalance ?? 0,
    });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
      message.success("Print sent");
    } catch (e) {
      message.error("Print failed: " + (e.message || "Unknown error"));
    }
  };

  const totalIn  = rows.reduce((s, r) => s + (Number(r.qtyIn)  || 0), 0);
  const totalOut = rows.reduce((s, r) => s + (Number(r.qtyOut) || 0), 0);

  return (
    <div style={{ padding: 8 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>
          Item Movement Report
        </Title>
        <Space wrap>
          <Text style={{ color: "#374151" }}>Branch:</Text>
          <Text strong style={{ color: "#1f2937" }}>{branchCode || "-"}</Text>

          <Select
            showSearch
            placeholder="Search item…"
            style={{ width: 220 }}
            value={selectedItem?.value ?? undefined}
            filterOption={false}
            onSearch={setItemSearch}
            onChange={(val, opt) => { setSelectedItem(opt); setFetched(false); setRows([]); setOpeningBalance(null); setClosingBalance(null); }}
            options={itemOptions}
            allowClear
            onClear={() => { setSelectedItem(null); setRows([]); setOpeningBalance(null); setClosingBalance(null); }}
          />

          <RangePicker
            value={dateRange}
            onChange={(v) => { setDateRange(v || [dayjs().startOf("month"), dayjs()]); setFetched(false); }}
            allowClear={false}
          />

          <Button type="primary" onClick={fetchReport} loading={loading}>Load</Button>
          <Button onClick={printReport} disabled={!rows.length}>Print</Button>
        </Space>
      </div>

      {/* Opening balance banner */}
      {fetched && openingBalance !== null && (
        <div style={{
          display: "flex", justifyContent: "space-between",
          background: "#f0f4ff", border: "1px solid #c7d2fe",
          borderRadius: 6, padding: "6px 12px", marginBottom: 6,
        }}>
          <Text strong style={{ color: "#3730a3" }}>Opening Balance</Text>
          <Text strong style={{ color: openingBalance >= 0 ? "#16a34a" : "#dc2626", fontSize: 15 }}>
            {r2(openingBalance).toFixed(2)}
          </Text>
        </div>
      )}

      {/* Table */}
      <Table
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={false}
        rowKey={(_, i) => i}
        locale={{ emptyText: fetched ? "No movements found for this period" : "Select item and date range, then click Load" }}
        summary={() =>
          rows.length > 0 ? (
            <Table.Summary fixed>
              <Table.Summary.Row style={{ background: "#f9fafb" }}>
                <Table.Summary.Cell colSpan={4} align="right">
                  <Text strong>Total In / Out</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell align="right">
                  <Text strong style={{ color: "#16a34a" }}>{r2(totalIn).toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell align="right">
                  <Text strong style={{ color: "#dc2626" }}>{r2(totalOut).toFixed(2)}</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell align="right" />
              </Table.Summary.Row>
              <Table.Summary.Row style={{ background: "#eff6ff" }}>
                <Table.Summary.Cell colSpan={6} align="right">
                  <Text strong style={{ color: "#1d4ed8" }}>Closing Balance</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell align="right">
                  <Text strong style={{ fontSize: 14, color: (closingBalance ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                    {r2(closingBalance ?? 0).toFixed(2)}
                  </Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          ) : null
        }
      />
    </div>
  );
}
