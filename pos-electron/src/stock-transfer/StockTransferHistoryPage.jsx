import React, { useEffect, useState } from "react";
import { DatePicker, Radio, Table, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { apiUrl } from "../utils/apiUrl";
import { decodeJwtPayload } from "../auth/auth";
import { buildTransferHtml } from "./transferPrint";

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const lbl = (text) => (
  <div style={{ fontSize: 11, fontWeight: "bold", color: "#000", marginBottom: 1 }}>{text}</div>
);

export default function StockTransferHistoryPage({ onClose }) {
  const [fromDate, setFromDate] = useState(dayjs().startOf("month"));
  const [toDate, setToDate]     = useState(dayjs());
  const [vouchers, setVouchers] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printMode, setPrintMode] = useState("a4");
  const [allBranches, setAllBranches] = useState([]);

  const tenantId   = localStorage.getItem("tenancyId") || "";
  const token      = localStorage.getItem("jwtToken") || "";
  const branchCode = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();
  const payload    = decodeJwtPayload(token) || {};
  const username   = String(payload.sub || payload.username || "");

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
    if (!fromDate || !toDate) { message.warning("Select from and to dates."); return; }

    const from = fromDate.format("YYYY-MM-DD");
    const to   = toDate.format("YYYY-MM-DD");
    const url  = apiUrl(
      `/api/${tenantId}/stock-transfers/out?fromBranch=${encodeURIComponent(branchCode || "ALL")}&toBranch=ALL&fromDate=${from}&toDate=${to}`
    );

    try {
      setLoading(true);
      setSelectedKey("");
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json();
      const rows = Array.isArray(json) ? json : (json?.data ?? []);

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
            reasonCode: String(r.reasonCode ?? ""),
            lines: [],
          });
        }
        map.get(key).lines.push({
          item_name: String(r.itemName ?? ""),
          qty: toNum(r.qty),
          standard_price: toNum(r.rate),
          rate: toNum(r.rate),
          amount: toNum(r.amount),
          tax_rate: toNum(r.taxRate ?? 0),
          barcode: "", unit: "", batch: "",
        });
      }

      const grouped = Array.from(map.values()).map((v) => ({
        ...v,
        totalQty:    v.lines.reduce((s, l) => s + l.qty,    0),
        totalAmount: v.lines.reduce((s, l) => s + l.amount, 0),
      }));

      const filtered = transferBranchCodes
        ? grouped.filter((v) => transferBranchCodes.has(v.toBranchCode))
        : grouped;

      setVouchers(filtered);
      if (!filtered.length) message.info("No stock transfers found for this date range.");
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
      fromBranch:        selectedVoucher.fromBranch,
      fromBranchName:    String(fromBranchObj.branchName ?? ""),
      fromBranchGst:     String(fromBranchObj.branchGst ?? ""),
      fromBranchState:   String(fromBranchObj.branchState ?? ""),
      fromBranchAddress: [
        fromBranchObj.branchBuildingAddress,
        fromBranchObj.branchAddress1,
        fromBranchObj.branchAddress2,
      ].filter(Boolean).join(", "),
      toBranchCode:    selectedVoucher.toBranchCode,
      toBranchName:    String(toBranchObj.branchName ?? ""),
      toBranchGst:     String(toBranchObj.branchGst ?? ""),
      toBranchState:   String(toBranchObj.branchState ?? ""),
      deliveryLocation: String(toBranchObj.branchBuildingAddress ?? ""),
      deliveryAddress1: String(toBranchObj.branchAddress1 ?? ""),
      deliveryAddress2: String(toBranchObj.branchAddress2 ?? ""),
      voucherNumber: selectedVoucher.voucherNumber,
      voucherDate:   selectedVoucher.voucherDate,
      reasonCode:    selectedVoucher.reasonCode || "NORMAL DC",
      items:         selectedVoucher.lines,
      totalQty:      selectedVoucher.totalQty,
      totalAmount:   selectedVoucher.totalAmount,
    });

    try {
      setPrinting(true);
      await window.POS.printHtml({ html, silent: printMode === "thermal", deviceName: "" }).catch(() => {});
    } finally {
      setPrinting(false);
    }
  };

  const voucherColumns = [
    { title: "Voucher No",  dataIndex: "voucherNumber", width: 160 },
    { title: "Date",        dataIndex: "voucherDate",   width: 150,
      render: (v) => v ? v.slice(0, 16).replace("T", " ") : "" },
    { title: "From",        dataIndex: "fromBranch",    width: 90 },
    { title: "To",          dataIndex: "toBranchCode",  width: 90 },
    { title: "Reason",      dataIndex: "reasonCode",    width: 120,
      render: (v) => v || "NORMAL DC" },
    { title: "Qty",         dataIndex: "totalQty",      width: 80,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Amount",      dataIndex: "totalAmount",   width: 100,
      render: (v) => toNum(v).toFixed(2) },
  ];

  const lineColumns = [
    { title: "Item",   dataIndex: "item_name", width: 220,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "Qty",    dataIndex: "qty",        width: 80,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Rate",   dataIndex: "rate",       width: 90,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Tax%",   dataIndex: "tax_rate",   width: 70,
      render: (v) => toNum(v).toFixed(2) },
    { title: "Amount", dataIndex: "amount",     width: 100,
      render: (v) => toNum(v).toFixed(2) },
  ];

  const btnBase = {
    height: 28, fontSize: 12, fontWeight: "bold",
    border: "2px outset #4d8e87", cursor: "pointer", color: "#000",
    padding: "0 12px",
  };

  return (
    <div className="pos-container">

      {/* ── Title bar ── */}
      <div style={{
        background: "#00695c", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>Stock Transfer History{branchCode ? ` — ${branchCode}` : ""}</span>
        <button
          onClick={onClose}
          style={{ ...btnBase, background: "#b0c8c4", border: "2px outset #4d8e87" }}
        >
          Close
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{
        background: "#1a7a6e", padding: "5px 10px",
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: "bold", color: "#e0f2f1" }}>From</span>
          <DatePicker
            value={fromDate}
            onChange={setFromDate}
            allowClear={false}
            format="DD-MM-YYYY"
            size="small"
            style={{ borderRadius: 0, width: 120 }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: "bold", color: "#e0f2f1" }}>To</span>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            allowClear={false}
            format="DD-MM-YYYY"
            size="small"
            style={{ borderRadius: 0, width: 120 }}
          />
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{ ...btnBase, background: loading ? "#b0c8c4" : "#ffc8ff", cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "Loading…" : "Fetch"}
        </button>

        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.3)", margin: "0 4px" }} />

        <Radio.Group
          options={[{ label: "A4", value: "a4" }, { label: "Thermal", value: "thermal" }]}
          value={printMode}
          onChange={(e) => setPrintMode(e.target.value)}
          optionType="button"
          buttonStyle="solid"
          size="small"
        />

        <button
          onClick={handlePrint}
          disabled={!selectedVoucher || printing}
          style={{
            ...btnBase,
            background: selectedVoucher && !printing ? "#fff3cd" : "#b0c8c4",
            cursor: selectedVoucher && !printing ? "pointer" : "not-allowed",
          }}
        >
          <PrinterOutlined /> {printing ? "Printing…" : "Reprint"}
        </button>
      </div>

      {/* ── Main body ── */}
      <div style={{
        flex: 1, display: "flex", gap: 8, padding: "8px",
        background: "#c8dcd8", overflow: "hidden", minHeight: 0,
      }}>

        {/* Vouchers panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          border: "1px solid #4d8e87", background: "#b8cec9",
        }}>
          <div style={{
            background: "#00695c", color: "#fff", fontSize: 11, fontWeight: "bold",
            padding: "3px 8px", borderBottom: "1px solid #4d8e87",
          }}>
            Vouchers ({vouchers.length})
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Table
              className="qt-st-table"
              size="small"
              dataSource={vouchers}
              columns={voucherColumns}
              pagination={false}
              rowKey="key"
              scroll={{ x: 730, y: "calc(100vh - 200px)" }}
              rowClassName={(r) => r.key === selectedKey ? "st-row-selected" : ""}
              onRow={(record) => ({
                onClick: () => setSelectedKey(record.key),
                style: { cursor: "pointer" },
              })}
            />
          </div>
        </div>

        {/* Lines panel */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          border: "1px solid #4d8e87", background: "#b8cec9",
        }}>
          <div style={{
            background: "#00695c", color: "#fff", fontSize: 11, fontWeight: "bold",
            padding: "3px 8px", borderBottom: "1px solid #4d8e87",
          }}>
            {selectedVoucher
              ? `Lines — ${selectedVoucher.voucherNumber}  (${selectedVoucher.toBranchCode})`
              : "Lines — select a voucher"}
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Table
              className="qt-st-table"
              size="small"
              dataSource={selectedVoucher?.lines ?? []}
              columns={lineColumns}
              pagination={false}
              rowKey={(_, i) => i}
              scroll={{ x: 560, y: "calc(100vh - 200px)" }}
            />
          </div>
          {selectedVoucher && (
            <div style={{
              background: "#3d7a74", color: "#fff",
              display: "flex", justifyContent: "flex-end", gap: 30,
              padding: "4px 12px", fontSize: 12, fontWeight: "bold",
              borderTop: "1px solid #4d8e87",
            }}>
              <span>Total Qty: {toNum(selectedVoucher.totalQty).toFixed(2)}</span>
              <span>Total Amount: {toNum(selectedVoucher.totalAmount).toFixed(2)}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
