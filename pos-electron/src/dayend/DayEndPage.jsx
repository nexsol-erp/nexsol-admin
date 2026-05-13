import React, { useMemo, useState } from "react";
import { Button, DatePicker, InputNumber, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;

const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

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
  const [qtyByDenom, setQtyByDenom] = useState(() =>
    Object.fromEntries(DENOMINATIONS.map((d) => [String(d), 0]))
  );

  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

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
      message.success("Day End completed successfully");
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

    const html = buildDayEndReportHtml({
      branchCode,
      dateKey: dayEndDate.format("YYYY-MM-DD"),
      printedAt: new Date().toISOString(),
      rows,
      grandTotal,
    });

    try {
      await window.POS.printHtml({ html, silent: false, deviceName: "" });
      message.success("Print sent");
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
          <Button onClick={printReport}>Print</Button>
          <Button type="primary" onClick={onSaveDayEnd} loading={saving}>
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

function buildDayEndReportHtml({ branchCode, dateKey, printedAt, rows, grandTotal }) {
  const lines = rows
    .filter((r) => Number(r.quantity || 0) > 0)
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.currency)}</td>
        <td style="text-align:right">${Number(r.quantity || 0).toFixed(0)}</td>
        <td style="text-align:right">${Number(r.amount || 0).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  return `
  <html>
    <body style="font-family: monospace; width: 300px;">
      <div style="text-align:center;font-weight:bold;">DAY END COLLECTION REPORT</div>
      <hr/>
      <div>Branch: ${escapeHtml(branchCode || "-")}</div>
      <div>Date: ${escapeHtml(dateKey)}</div>
      <div>Printed: ${escapeHtml(new Date(printedAt).toLocaleString())}</div>
      <hr/>
      <table style="width:100%; font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left">Currency</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      <hr/>
      <div style="display:flex; justify-content:space-between; font-weight:bold;">
        <span>Grand Total</span>
        <span>${Number(grandTotal || 0).toFixed(2)}</span>
      </div>
    </body>
  </html>
  `;
}
