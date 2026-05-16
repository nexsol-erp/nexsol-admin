import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Modal, Radio, Select, Space, Table, Typography, message } from "antd";
import ItemLookupModal from "../components/ItemLookupModal";
import { apiUrl } from "../utils/apiUrl";

const { Title, Text } = Typography;

const HOLD_KEY = "stock_transfer_holds";

function round2n(v) {
  const n = Number(v) || 0;
  return Math.round(n * 100) / 100;
}

function round2(v) {
  return round2n(v).toFixed(2);
}

function readHoldList() {
  try {
    const raw = localStorage.getItem(HOLD_KEY) || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function writeHoldList(rows) {
  localStorage.setItem(HOLD_KEY, JSON.stringify(rows));
}

export default function StockTransferPage({ onClose }) {
  const itemSearchRef = useRef(null);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");

  const [itemQuery, setItemQuery] = useState("");
  const [toBranchCode, setToBranchCode] = useState("");
  const [toBranchName, setToBranchName] = useState("");
  const [toBranchState, setToBranchState] = useState("");
  const [toBranchGst, setToBranchGst] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [deliveryAddress1, setDeliveryAddress1] = useState("");
  const [deliveryAddress2, setDeliveryAddress2] = useState("");

  const [printMode, setPrintMode] = useState("pdf");
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [savingHold, setSavingHold] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [holdRows, setHoldRows] = useState([]);
  const [selectedHoldId, setSelectedHoldId] = useState("");

  const tenantId = localStorage.getItem("tenancyId") || "";
  const token = localStorage.getItem("jwtToken") || "";
  const fromBranch = String(globalThis.POS_BRANCH_CODE || localStorage.getItem("selectedBranchCode") || "").trim();

  const branchOptions = useMemo(() => {
    let raw = [];
    try {
      raw = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
      if (!Array.isArray(raw)) raw = [];
    } catch (e) {
      raw = [];
    }
    const seen = new Set();
    return raw
      .map((b) => {
        if (typeof b === "string") return b.trim();
        return String(b?.branchCode ?? b?.code ?? b?.branch ?? b?.value ?? b?.id ?? "").trim();
      })
      .filter((x) => x && x !== fromBranch)
      .filter((x) => {
        if (seen.has(x)) return false;
        seen.add(x);
        return true;
      })
      .map((x) => ({ value: x, label: x }));
  }, [fromBranch]);

  useEffect(() => {
    setHoldRows(readHoldList());
  }, []);

  useEffect(() => {
    if (!toBranchCode || !tenantId || !token) return;
    const run = async () => {
        // Fetch all branches and filter — avoids needing a per-branch endpoint
      const r = await fetch(apiUrl(`/api/${tenantId}/branches`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const list = await r.json();
      const branches = Array.isArray(list) ? list : (list?.data ?? []);
      const b = branches.find(
        (x) => (x.branchCode ?? x.branch_code ?? "").toUpperCase() === toBranchCode.toUpperCase()
      );
      if (!b) return;
      setToBranchName(String(b?.branchName ?? b?.branch_name ?? ""));
      setToBranchState(String(b?.branchState ?? b?.state ?? ""));
      setToBranchGst(String(b?.branchGst ?? b?.gst ?? ""));
      setDeliveryLocation(String(b?.branchBuildingAddress ?? b?.buildingAddress ?? ""));
      setDeliveryAddress1(String(b?.branchAddress1 ?? b?.address1 ?? ""));
      setDeliveryAddress2(String(b?.branchAddress2 ?? b?.address2 ?? ""));
    };
    run().catch(() => {});
  }, [toBranchCode, tenantId, token]);

  const totalQty = useMemo(
    () => items.reduce((s, r) => s + (Number(r.qty) || 0), 0),
    [items]
  );
  const totalAmount = useMemo(
    () => items.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [items]
  );

  const openLookup = () => {
    setLookupQuery(itemQuery || "");
    setLookupOpen(true);
  };

  const updateRow = (key, patch) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        next.amount = round2n((Number(next.qty) || 0) * (Number(next.standard_price) || 0));
        return next;
      })
    );
  };

  const onPickItem = (itm) => {
    const batch = itm.batchCode || "";
    const existing = items.find((r) => r.item_id === itm.itemId && (r.batch || "") === batch);
    if (existing) {
      updateRow(existing.key, { qty: (Number(existing.qty) || 0) + 1 });
      setLookupOpen(false);
      setItemQuery("");
      return;
    }

    const row = {
      key: crypto.randomUUID(),
      item_id: itm.itemId,
      item_name: itm.itemName,
      barcode: itm.barcode,
      qty: 1,
      tax_rate: Number(itm.taxRate || 0),
      standard_price: Number(itm.standardPrice || 0),
      amount: round2n(Number(itm.standardPrice || 0)),
      batch: batch,
      unit: itm.unitName || "",
      expiry: itm.expiry || "",
    };
    setItems((prev) => [row, ...prev]);
    setLookupOpen(false);
    setItemQuery("");
  };

  const resetForm = () => {
    setItems([]);
    setToBranchCode("");
    setToBranchName("");
    setToBranchState("");
    setToBranchGst("");
    setDeliveryLocation("");
    setDeliveryAddress1("");
    setDeliveryAddress2("");
  };

  const saveToHold = () => {
    if (!toBranchCode || !items.length) {
      message.warning("Enter branch and at least one item before Hold DC.");
      return;
    }
    setSavingHold(true);
    try {
      const now = new Date();
      const rec = {
        id: crypto.randomUUID(),
        name: `DC_${toBranchCode}_${now.toISOString().slice(0, 10)}`,
        createdAt: now.toISOString(),
        payload: {
          toBranchCode,
          toBranchName,
          toBranchState,
          toBranchGst,
          deliveryLocation,
          deliveryAddress1,
          deliveryAddress2,
          printMode,
          items,
        },
      };
      const next = [rec, ...holdRows].slice(0, 100);
      setHoldRows(next);
      writeHoldList(next);
      message.success("Hold DC saved");
    } finally {
      setSavingHold(false);
    }
  };

  const recallSelected = () => {
    const row = holdRows.find((x) => x.id === selectedHoldId);
    if (!row) {
      message.warning("Select a hold record.");
      return;
    }
    const p = row.payload || {};
    setToBranchCode(String(p.toBranchCode || ""));
    setToBranchName(String(p.toBranchName || ""));
    setToBranchState(String(p.toBranchState || ""));
    setToBranchGst(String(p.toBranchGst || ""));
    setDeliveryLocation(String(p.deliveryLocation || ""));
    setDeliveryAddress1(String(p.deliveryAddress1 || ""));
    setDeliveryAddress2(String(p.deliveryAddress2 || ""));
    setPrintMode(p.printMode === "thermal" ? "thermal" : "pdf");
    setItems(Array.isArray(p.items) ? p.items : []);
    setRecallOpen(false);
    message.success("DC recalled");
  };

  const saveTransfer = async () => {
    if (!tenantId || !token) {
      message.error("Missing login session. Please login again.");
      return;
    }
    if (!fromBranch || !toBranchCode) {
      message.warning("Select source and destination branch.");
      return;
    }
    if (!items.length) {
      message.warning("Add items first.");
      return;
    }
    if (fromBranch === toBranchCode) {
      message.warning("Destination branch cannot be same as source.");
      return;
    }

    const headerId = crypto.randomUUID();
    const now = new Date();
    // HHmmss fits within Java Integer (max ~235959)
    const numericVoucher = Number(
      String(now.getHours()).padStart(2, "0") +
      String(now.getMinutes()).padStart(2, "0") +
      String(now.getSeconds()).padStart(2, "0")
    );
    // varchar(20) limit — keep format short: ST-{branch}-{HHmmss}
    const voucherNumber = `ST-${fromBranch}-${numericVoucher}`.slice(0, 20);
    // LocalDateTime does not accept trailing 'Z' — strip it
    const voucherDate = now.toISOString().slice(0, 19);
    const body = {
      id: headerId,
      branch_code: fromBranch,
      to_branch_code: toBranchCode,
      voucher_type: "STOCK_TRANSFER",
      voucher_prefix: "ST",
      voucher_number: voucherNumber,
      numeric_voucher_number: numericVoucher,
      voucher_date: voucherDate,
      description: "Stock Transfer",
      delivery_to_location: deliveryLocation,
      delivery_to_address1: deliveryAddress1,
      delivery_to_address2: deliveryAddress2,
      to_branch_name: toBranchName,
      to_branch_state: toBranchState,
      to_branch_gst: toBranchGst,
      dtl: items.map((r) => ({
        id: crypto.randomUUID(),
        parent_id: headerId,
        branch_code: fromBranch,
        voucher_type: "STOCK_TRANSFER",
        voucher_number: voucherNumber,
        voucher_date: voucherDate,
        item_id: r.item_id,
        item_name: r.item_name,
        barcode: r.barcode,
        qty: Number(r.qty) || 0,
        rate: Number(r.standard_price) || 0,
        standard_price: Number(r.standard_price) || 0,
        amount: Number(r.amount) || 0,
        tax_rate: Number(r.tax_rate) || 0,
        cess_rate: 0,
        unit: r.unit || "",
        batch: r.batch || "",
        expiry: r.expiry || null,
      })),
    };

    try {
      setSaving(true);
      const urls = [
        apiUrl(`/api/${tenantId}/stock-transfers/out`),
        apiUrl(`/api/${tenantId}/stock-transfer/out`),
        apiUrl(`/api/${tenantId}/stock-transfer`),
      ];

      let result = null;
      let lastErr = "";
      for (const url of urls) {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          result = await r.json().catch(() => ({}));
          break;
        }
        const t = await r.text().catch(() => "");
        lastErr = `${r.status} ${t || r.statusText}`;
        // continue trying next URL for any non-2xx
      }

      if (!result) throw new Error(lastErr || "Save failed");
      message.success("Stock Transfer saved");

      if (window.POS?.printHtml) {
        const html = buildTransferHtml({
          fromBranch,
          toBranchCode,
          toBranchName,
          items,
          totalAmount,
          totalQty,
        });
        await window.POS.printHtml({
          html,
          silent: printMode === "thermal",
          deviceName: "",
        });
      }

      resetForm();
    } catch (e) {
      message.error("Save failed: " + (e.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: "Item", dataIndex: "item_name", width: 220 },
    { title: "Barcode", dataIndex: "barcode", width: 130 },
    {
      title: "Qty",
      dataIndex: "qty",
      width: 80,
      render: (_, row) => (
        <InputNumber
          min={0}
          value={row.qty}
          onChange={(v) => updateRow(row.key, { qty: Number(v || 0) })}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Rate",
      dataIndex: "standard_price",
      width: 100,
      render: (_, row) => (
        <InputNumber
          min={0}
          value={row.standard_price}
          onChange={(v) => updateRow(row.key, { standard_price: Number(v || 0) })}
          style={{ width: "100%" }}
        />
      ),
    },
    { title: "Tax%", dataIndex: "tax_rate", width: 70 },
    { title: "Amount", dataIndex: "amount", width: 100, render: (v) => round2(v) },
    { title: "Batch", dataIndex: "batch", width: 90 },
    { title: "Unit", dataIndex: "unit", width: 70 },
    { title: "Expiry", dataIndex: "expiry", width: 120 },
    {
      title: "",
      key: "x",
      width: 60,
      render: (_, row) => (
        <Button danger size="small" onClick={() => setItems((p) => p.filter((x) => x.key !== row.key))}>
          X
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Title level={3} style={{ margin: 0, color: "#0b3a75" }}>Stock Transfer</Title>
        <Space>
          <Button onClick={saveToHold} loading={savingHold}>Hold DC</Button>
          <Button onClick={() => setRecallOpen(true)}>Recall DC</Button>
          <Button onClick={onClose}>Close</Button>
          <Button type="primary" onClick={saveTransfer} loading={saving}>Save</Button>
        </Space>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>From Branch</Text>
          <Input value={fromBranch || ""} readOnly />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>To Branch Code</Text>
          <Select
            value={toBranchCode || undefined}
            onChange={setToBranchCode}
            options={branchOptions}
            placeholder="Select branch"
            showSearch
            style={{ width: "100%" }}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch Name</Text>
          <Input value={toBranchName} onChange={(e) => setToBranchName(e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch GST</Text>
          <Input value={toBranchGst} onChange={(e) => setToBranchGst(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Branch State</Text>
          <Input value={toBranchState} onChange={(e) => setToBranchState(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 4 }}>Print Mode</Text>
          <Radio.Group
            options={[
              { label: "PDF File", value: "pdf" },
              { label: "Thermal Printer", value: "thermal" },
            ]}
            value={printMode}
            onChange={(e) => setPrintMode(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Location</Text>
          <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Address 1</Text>
          <Input value={deliveryAddress1} onChange={(e) => setDeliveryAddress1(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Delivery Address 2</Text>
          <Input value={deliveryAddress2} onChange={(e) => setDeliveryAddress2(e.target.value)} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Item Search / Barcode</Text>
        <Input
          ref={itemSearchRef}
          value={itemQuery}
          onChange={(e) => setItemQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "F2") {
              e.preventDefault();
              openLookup();
            }
          }}
          placeholder="Scan barcode (Enter/F2 to browse)"
        />
      </div>

      <Table
        size="small"
        dataSource={items}
        columns={columns}
        pagination={false}
        rowKey="key"
        scroll={{ x: 1200, y: 350 }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
        <div>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Total Qty</Text>
          <Input value={round2(totalQty)} readOnly style={{ width: 140 }} />
        </div>
        <div>
          <Text strong style={{ display: "block", color: "#374151", marginBottom: 2 }}>Total Amount</Text>
          <Input value={round2(totalAmount)} readOnly style={{ width: 160 }} />
        </div>
      </div>

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={lookupQuery}
        onClose={() => setLookupOpen(false)}
        onPick={onPickItem}
      />

      <Modal
        open={recallOpen}
        onCancel={() => setRecallOpen(false)}
        onOk={recallSelected}
        okText="Load"
        title="Recall Held DC"
      >
        <Select
          style={{ width: "100%" }}
          value={selectedHoldId || undefined}
          onChange={setSelectedHoldId}
          options={holdRows.map((h) => ({
            value: h.id,
            label: `${h.name} (${new Date(h.createdAt).toLocaleString()})`,
          }))}
          placeholder="Select hold record"
        />
      </Modal>
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

function buildTransferHtml({ fromBranch, toBranchCode, toBranchName, items, totalAmount, totalQty }) {
  const rows = items
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.item_name)}</td>
        <td style="text-align:right">${Number(r.qty || 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(r.standard_price || 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(r.amount || 0).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <body style="font-family: monospace; width: 320px;">
      <div style="text-align:center;font-weight:bold;">STOCK TRANSFER</div>
      <div>From: ${escapeHtml(fromBranch)}</div>
      <div>To: ${escapeHtml(toBranchCode)} ${escapeHtml(toBranchName || "")}</div>
      <hr/>
      <table style="width:100%; font-size:12px;">
        <thead>
          <tr>
            <th style="text-align:left">Item</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Amt</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr/>
      <div style="display:flex; justify-content:space-between;"><span>Total Qty</span><span>${Number(totalQty || 0).toFixed(2)}</span></div>
      <div style="display:flex; justify-content:space-between;"><span>Total Amount</span><span>${Number(totalAmount || 0).toFixed(2)}</span></div>
    </body>
  </html>`;
}

