import React, { useEffect, useState } from "react";
import { Button, DatePicker, Radio, Space, Table, Typography, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { decodeJwtPayload } from "../auth/auth";
import { buildTransferHtml } from "./transferPrint";

const { Title, Text } = Typography;

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function StockTransferHistoryPage({ onClose }) {
  const [date, setDate] = useState(dayjs());
  const [vouchers, setVouchers] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printMode, setPrintMode] = useState("a4");
  const [allBranches, setAllBranches] = useState([]);

  const tenantId = localStorage.getItem("tenancyId") || "";
  const token = localStorage.getItem("jwtToken") || "";
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const payload = decodeJwtPayload(token) || {};
  const username = String(payload.sub || payload.username || "");

  const [transferBranchCodes, setTransferBranchCodes] = useState(null);

  useEffect(() => {
    if (!tenantId || !token || !username) { setTransferBranchCodes(null); return; }
    fetch(apiUrl(`/api/${tenantId}/admin/users/${encodeURIComponent(username)}/transfer-branches`), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const codes = Array.isArray(data)
          ? data.filter((x) => typeof x === "string")
          : Array.isArray(data.branches) ? data.branches.filter((x) => typeof x === "string") : [];
        setTransferBranchCodes(codes.length ? new Set(codes) : null);
      })
      .catch(() => { setTransferBranchCodes(null); });
  }, [tenantId, token, username]);

  useEffect(() => {
    if (!tenantId || !token) return;
    fetch(apiUrl(`/api/${tenantId}/branches`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setAllBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [tenantId, token]);

  const fetchHistory = async () => {
    if (!tenantId || !token) { message.error("Missing login session."); return; }
    if (!date) { message.warning("Select a date."); return; }

    const d = date.format("YYYY-MM-DD");
    const url = apiUrl(
      `/api/${tenantId}/stock-transfers/out?fromBranch=${encodeURIComponent(branchCode || "ALL")}&toBranch=ALL&fromDate=${d}&toDate=${d}`
    );

    try {
      setLoading(true);
      setSelectedKey("");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []);

      // Group flat rows by voucherNumber
      const map = new Map();
      for (const r of rows) {
        const key = String(r.voucherNumber ?? "");
        if (!map.has(key)) {
          map.set(key, {
            key,
            voucherNumber: key,
            voucherDate: String(r.voucherDate ?? ""),
            fromBranch: String(r.branchCode ?? ""),
            toBranchCode: String(r.toBranchCode ?? ""),
            lines: [],
          });
        }
        map.get(key).lines.push({
          item_name: String(r.itemName ?? ""),
          qty: toNum(r.qty),
          standard_price: toNum(r.rate),
          rate: toNum(r.rate),
          amount: toNum(r.amount),
          barcode: "",
          unit: "",
          tax_rate: 0,
          batch: "",
        });
      }

      const grouped = Array.from(map.values()).map((v) => ({
        ...v,
        totalQty: v.lines.reduce((s, l) => s + l.qty, 0),
        totalAmount: v.lines.reduce((s, l) => s + l.amount, 0),
      }));

      const filtered = transferBranchCodes
        ? grouped.filter((v) => transferBranchCodes.has(v.toBranchCode))
        : grouped;

      setVouchers(filtered);
      if (!filtered.length) message.info("No stock transfers found for this date.");
    } catch (e) {
      message.error("Fetch failed: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const selectedVoucher = vouchers.find((v) => v.key === selectedKey);

  const handlePrint = async () => {
    if (!selectedVoucher) { message.warning("Select a voucher to print."); return; }
    if (!window.POS?.printHtml) { message.error("Print not available."); return; }

    const fromBranchObj = allBranches.find(
      (x) => String(x.branchCode ?? "").toUpperCase() === selectedVoucher.fromBranch.toUpperCase()
    ) || {};
    const toBranchObj = allBranches.find(
      (x) => String(x.branchCode ?? "").toUpperCase() === selectedVoucher.toBranchCode.toUpperCase()
    ) || {};

    const html = buildTransferHtml({
      printMode,
      fromBranch: selectedVoucher.fromBranch,
      fromBranchName: String(fromBranchObj.branchName ?? ""),
      fromBranchGst: String(fromBranchObj.branchGst ?? ""),
      fromBranchState: String(fromBranchObj.branchState ?? ""),
      fromBranchAddress: [
        fromBranchObj.branchBuildingAddress,
        fromBranchObj.branchAddress1,
        fromBranchObj.branchAddress2,
      ].filter(Boolean).join(", "),
      toBranchCode: selectedVoucher.toBranchCode,
      toBranchName: String(toBranchObj.branchName ?? ""),
      toBranchGst: String(toBranchObj.branchGst ?? ""),
      toBranchState: String(toBranchObj.branchState ?? ""),
      deliveryLocation: String(toBranchObj.branchBuildingAddress ?? ""),
      deliveryAddress1: String(toBranchObj.branchAddress1 ?? ""),
      deliveryAddress2: String(toBranchObj.branchAddress2 ?? ""),
      voucherNumber: selectedVoucher.voucherNumber,
      voucherDate: selectedVoucher.voucherDate,
      items: selectedVoucher.lines,
      totalQty: selectedVoucher.totalQty,
      totalAmount: selectedVoucher.totalAmount,
    });

    try {
      setPrinting(true);
      await window.POS.printHtml({ html, silent: printMode === "thermal", deviceName: "" }).catch(() => {});
    } finally {
      setPrinting(false);
    }
  };

  const voucherColumns = [
    { title: "Voucher No", dataIndex: "voucherNumber", width: 160 },
    { title: "Date", dataIndex: "voucherDate", width: 160, render: (v) => v ? v.slice(0, 16).replace("T", " ") : "" },
    { title: "From", dataIndex: "fromBranch", width: 100 },
    { title: "To", dataIndex: "toBranchCode", width: 100 },
    { title: "Total Qty", dataIndex: "totalQty", width: 100, render: (v) => toNum(v).toFixed(2) },
    { title: "Total Amt", dataIndex: "totalAmount", width: 110, render: (v) => toNum(v).toFixed(2) },
  ];

  const lineColumns = [
    { title: "Item", dataIndex: "item_name", width: 240 },
    { title: "Qty", dataIndex: "qty", width: 90, render: (v) => toNum(v).toFixed(2) },
    { title: "Rate", dataIndex: "rate", width: 100, render: (v) => toNum(v).toFixed(2) },
    { title: "Amount", dataIndex: "amount", width: 110, render: (v) => toNum(v).toFixed(2) },
  ];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>Stock Transfer History</Title>
        <Space>
          <DatePicker value={date} onChange={setDate} allowClear={false} />
          <Button type="primary" onClick={fetchHistory} loading={loading}>Fetch</Button>
          <Radio.Group
            options={[{ label: "A4", value: "a4" }, { label: "Thermal", value: "thermal" }]}
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          />
          <Button
            icon={<PrinterOutlined />}
            onClick={handlePrint}
            loading={printing}
            disabled={!selectedVoucher}
          >
            Reprint
          </Button>
          <Button onClick={onClose}>Close</Button>
        </Space>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", marginBottom: 4, color: "#374151" }}>Vouchers</Text>
          <Table
            size="small"
            dataSource={vouchers}
            columns={voucherColumns}
            pagination={false}
            rowKey="key"
            scroll={{ x: 730, y: 440 }}
            rowClassName={(r) => r.key === selectedKey ? "ant-table-row-selected" : ""}
            onRow={(record) => ({ onClick: () => setSelectedKey(record.key) })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", marginBottom: 4, color: "#374151" }}>
            {selectedVoucher ? `Lines — ${selectedVoucher.voucherNumber}` : "Lines"}
          </Text>
          <Table
            size="small"
            dataSource={selectedVoucher?.lines ?? []}
            columns={lineColumns}
            pagination={false}
            rowKey={(r, i) => i}
            scroll={{ x: 540, y: 440 }}
          />
        </div>
      </div>
    </div>
  );
}
