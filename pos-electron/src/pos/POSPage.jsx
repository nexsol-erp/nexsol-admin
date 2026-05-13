import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Table, Typography, Space, Divider, Select, message } from "antd";
import { logout } from "../auth/auth";
import ItemLookupModal from "../components/ItemLookupModal";
import { hasCache, loadAllItemsToCache, applySaleToCache } from "../cache/itemCache";
import { log, warn, error as logError } from "../utils/logger";

const { Text, Title } = Typography;

export default function POSPage({ onLogout }) {
  const [cacheStatus, setCacheStatus] = useState({ loaded: false, loading: false, loadedCount: 0 });

  const itemSearchRef = useRef(null);
  const tenderedRef = useRef(null);
  const saveButtonRef = useRef(null);
  const qtyInputRefs = useRef({});

  const [customerMobile, setCustomerMobile] = useState("");
  const [salesmanCode, setSalesmanCode] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [branchOptions, setBranchOptions] = useState([]);
  const [selectedBranchCode, setSelectedBranchCode] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [items, setItems] = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");

  // Branch options from JWT
  useEffect(() => {
    log("POSPage mounted");
    const extractBranchCode = (b) => {
      if (typeof b === "string") return b.trim();
      if (b && typeof b === "object")
        return String(b.branchCode ?? b.code ?? b.branch ?? b.value ?? b.id ?? "").trim();
      return "";
    };
    let raw = [];
    try {
      const raw_str = localStorage.getItem("allowedBranches") || "[]";
      log("allowedBranches raw:", raw_str);
      raw = JSON.parse(raw_str);
      if (!Array.isArray(raw)) { warn("allowedBranches is not an array:", raw); raw = []; }
    } catch (e) { logError("allowedBranches parse error:", e); raw = []; }

    const seen = new Set();
    const options = raw
      .map(extractBranchCode)
      .filter((code) => { if (!code || seen.has(code)) return false; seen.add(code); return true; })
      .map((code) => ({ value: code, label: code }));

    log("branch options:", options);
    setBranchOptions(options);
    if (!options.length) { warn("no branch options found"); setSelectedBranchCode(""); return; }
    if (options.length === 1) { log("auto-selecting single branch:", options[0].value); setSelectedBranchCode(options[0].value); return; }
    const saved = localStorage.getItem("selectedBranchCode") || "";
    const selected = options.some((o) => o.value === saved) ? saved : options[0].value;
    log("selected branch:", selected);
    setSelectedBranchCode(selected);
  }, []);

  useEffect(() => {
    const code = selectedBranchCode || "";
    globalThis.POS_BRANCH_CODE = code;
    if (code) localStorage.setItem("selectedBranchCode", code);
  }, [selectedBranchCode]);

  // Load cache on mount
  useEffect(() => {
    (async () => {
      log("checking item cache...");
      try {
        const ok = await hasCache();
        log("hasCache result:", ok);
        setCacheStatus((s) => ({ ...s, loaded: ok }));
        if (!ok) {
          log("cache empty, loading from backend...");
          setCacheStatus((s) => ({ ...s, loading: true }));
          try {
            await loadAllItemsToCache({
              onProgress: ({ loaded, total }) => {
                log(`cache load progress: ${loaded}/${total}`);
                setCacheStatus((s) => ({ ...s, loadedCount: loaded }));
              },
            });
            log("cache loaded successfully");
            setCacheStatus((s) => ({ ...s, loaded: true, loading: false }));
          } catch (e) {
            logError("loadAllItemsToCache failed:", e);
            setCacheStatus((s) => ({ ...s, loading: false }));
            message.error(e.message || "Failed to load item cache");
          }
        } else {
          log("cache already populated, skipping load");
        }
      } catch (e) {
        logError("hasCache check failed:", e);
      }
    })();
  }, []);

  const openLookup = (q = "") => { log("openLookup:", q); setLookupQuery(q); setLookupOpen(true); };
  const focusQtyInput = (rowKey, delay = 0) => {
    setTimeout(() => qtyInputRefs.current[rowKey]?.focus?.(), delay);
  };
  const closeLookup = ({ focusSearch = true } = {}) => {
    setLookupOpen(false);
    if (focusSearch) setTimeout(() => itemSearchRef.current?.focus?.(), 50);
  };

  const [receipts, setReceipts] = useState([
    { key: "CASH", receipt_mode: "CASH", amount: 0 },
    { key: "CARD", receipt_mode: "CARD", amount: 0 },
    { key: "UPI",  receipt_mode: "UPI",  amount: 0 },
  ]);

  const totalAmount   = useMemo(() => items.reduce((s, r) => s + (Number(r.amount) || 0), 0), [items]);
  const totalQty      = useMemo(() => items.reduce((s, r) => s + (Number(r.qty) || 0), 0), [items]);
  const totalReceived = useMemo(() => receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0), [receipts]);

  const [tendered, setTendered] = useState(0);
  const balance = useMemo(
    () => Math.max((Number(tendered) || 0) - (Number(totalAmount) || 0), 0),
    [tendered, totalAmount]
  );

  const canSave = useMemo(() => {
    const bill = Number(totalAmount) || 0;
    const rec  = Number(totalReceived) || 0;
    const ten  = Number(tendered) || 0;
    if (bill <= 0) return false;
    if (Math.abs(rec - bill) > 0.001) return false;
    if (ten > 0 && ten < bill) return false;
    return true;
  }, [totalAmount, totalReceived, tendered]);

  // Auto-set CASH receipt
  useEffect(() => {
    const bill = Number(totalAmount) || 0;
    const ten  = Number(tendered) || 0;
    const cash = ten > 0 ? Math.min(ten, bill) : bill;
    setReceipts((prev) =>
      prev.map((r) => r.receipt_mode.toUpperCase() === "CASH" ? { ...r, amount: round2n(cash) } : r)
    );
  }, [tendered, totalAmount]);

  const setSingleReceiptToTotal = (mode) => {
    const bill = round2n(totalAmount);
    setReceipts((prev) => prev.map((r) => ({ ...r, amount: r.receipt_mode === mode ? bill : 0 })));
  };

  const getAvailableQty = (row) => {
    const n = Number(row?.available_qty);
    return Number.isFinite(n) ? n : null;
  };

  const updateItem = (key, patch) => {
    setItems((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        const available   = getAvailableQty(next);
        const requestedQty = Number(next.qty) || 0;
        if (Object.hasOwn(patch, "qty") && available !== null && requestedQty > available) {
          next.qty = available;
          message.warning(`Only ${available} in stock for ${next.item_name}`);
        }
        next.amount = round2n((Number(next.qty) || 0) * (Number(next.standard_price) || 0));
        return next;
      })
    );
  };

  const deleteItem = (key) => setItems((p) => p.filter((r) => r.key !== key));

  const onSave = async () => {
    log("onSave called | canSave:", canSave, "| items:", items.length, "| branch:", selectedBranchCode);
    if (!canSave) { warn("onSave blocked: canSave=false"); return; }
    if (branchOptions.length > 0 && !selectedBranchCode) { message.warning("Select branch code"); return; }

    const salesDetails = items.map((item) => ({
      itemId: item.item_id, itemName: item.item_name, barcode: item.barcode,
      qty: Number(item.qty) || 0, rate: Number(item.standard_price) || 0,
      standardPrice: Number(item.standard_price) || 0, amount: Number(item.amount) || 0,
      batch: item.batch || "", expiry: item.expiry || null, unit: item.unit || "",
      taxRate: Number(item.tax_rate) || 0, description: "", itemCode: "",
    }));

    const payload = {
      customerMobile, salesManName: salesmanName,
      voucherDate: new Date().toISOString(), voucherPrefix: "POS",
      voucherNumber: `POS-${Date.now()}`,
      NumericVoucherNumber: Math.floor(Math.random() * 100000),
      branch_code: selectedBranchCode || globalThis.POS_BRANCH_CODE || "",
      salesDetails,
    };

    try {
      const tenantId = localStorage.getItem("tenancyId") || "79001a";
      const token    = localStorage.getItem("jwtToken") || "";
      log("posting sale | tenantId:", tenantId, "| lines:", salesDetails.length);
      const response = await fetch(`/api/${tenantId}/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      log("sale POST response:", response.status, response.statusText);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        logError("sale POST error body:", err);
        throw new Error(err.message || `Save failed: ${response.status}`);
      }
      await applySaleToCache(items.map((item) => ({
        itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
      })));
      message.success("Sales saved successfully");
      setItems([]); setTendered(0);
      setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
      setCustomerMobile(""); setSalesmanCode(""); setSalesmanName("");
      setTimeout(() => itemSearchRef.current?.focus?.(), 50);
    } catch (e) {
      message.error("Save failed: " + (e.message || "Unknown error"));
    }
  };

  // Printing
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");

  const refreshPrinters = async () => {
    if (!window.POS?.listPrinters) return;
    const list = await window.POS.listPrinters();
    setPrinters(list || []);
    if (!selectedPrinter && list?.length) setSelectedPrinter(list[0].name);
  };

  useEffect(() => { refreshPrinters(); }, []);

  const printTestInvoice = async () => {
    if (!window.POS?.printHtml) { message.error("Print API not available"); return; }
    const html = buildReceiptHtml({ items, totalAmount, tendered, balance });
    try {
      await window.POS.printHtml({ html, silent: false, deviceName: selectedPrinter });
      message.success("Print sent");
    } catch (e) { message.error("Print failed: " + e.message); }
  };

  const itemColumns = [
    { title: "Item",    dataIndex: "item_name",     width: 220, render: (v) => <Text strong>{v}</Text> },
    { title: "Barcode", dataIndex: "barcode",        width: 130 },
    { title: "Stock",   dataIndex: "available_qty",  width: 80, render: (v) => (v == null ? "-" : round2(v)) },
    {
      title: "Qty", dataIndex: "qty", width: 90,
      render: (_, row) => (
        <InputNumber
          ref={(el) => { if (el) qtyInputRefs.current[row.key] = el; else delete qtyInputRefs.current[row.key]; }}
          value={row.qty} min={0}
          onChange={(val) => updateItem(row.key, { qty: val })}
          onPressEnter={() => itemSearchRef.current?.focus?.()}
          style={{ width: "100%" }}
        />
      ),
    },
    {
      title: "Rate", dataIndex: "standard_price", width: 100,
      render: (_, row) => (
        <InputNumber
          value={row.standard_price} min={0}
          onChange={(val) => updateItem(row.key, { standard_price: val })}
          onPressEnter={() => tenderedRef.current?.focus?.()}
          style={{ width: "100%" }}
        />
      ),
    },
    { title: "Tax%",   dataIndex: "tax_rate", width: 70 },
    { title: "Amount", dataIndex: "amount",   width: 100, render: (v) => round2(v) },
    { title: "Batch",  dataIndex: "batch",    width: 100 },
    { title: "Unit",   dataIndex: "unit",     width: 70 },
    { title: "Expiry", dataIndex: "expiry",   width: 110 },
    {
      title: "", key: "x", width: 50,
      render: (_, row) => (
        <Button danger size="small" onClick={() => deleteItem(row.key)}>✕</Button>
      ),
    },
  ];

  const receiptColumns = [
    { title: "Payment Type", dataIndex: "receipt_mode", width: 160 },
    {
      title: "Amount", dataIndex: "amount", width: 140,
      render: (_, row) => (
        <InputNumber
          value={row.amount} min={0} style={{ width: "100%" }}
          onChange={(val) => setReceipts((prev) => prev.map((r) => r.key === row.key ? { ...r, amount: Number(val || 0) } : r))}
          onKeyDown={(e) => { if (e.key === "Enter") setSingleReceiptToTotal(row.receipt_mode); }}
        />
      ),
    },
  ];

  return (
    <div className="pos-container">
      {/* ---- Header ---- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Title level={4} style={{ margin: 0, color: "#0b3a75" }}>
            {branchOptions.length === 1 && selectedBranchCode ? `POS — ${selectedBranchCode}` : "POS Window"}
          </Title>
          {branchOptions.length > 1 && (
            <Select
              size="small" style={{ width: 140 }}
              value={selectedBranchCode || undefined}
              onChange={setSelectedBranchCode}
              options={branchOptions}
              placeholder="Branch"
            />
          )}
        </div>
        <Space size={8}>
          <Button
            size="small"
            loading={cacheStatus.loading}
            onClick={async () => {
              setCacheStatus((s) => ({ ...s, loading: true }));
              try {
                await loadAllItemsToCache({ onProgress: ({ loaded }) => setCacheStatus((s) => ({ ...s, loadedCount: loaded })) });
                setCacheStatus((s) => ({ ...s, loaded: true, loading: false }));
                message.success("Item cache refreshed");
              } catch (e) {
                setCacheStatus((s) => ({ ...s, loading: false }));
                message.error(e.message || "Refresh failed");
              }
            }}
          >
            Refresh Items
          </Button>
          <Button danger size="small" onClick={() => { logout(); onLogout?.(); }}>
            Logout
          </Button>
        </Space>
      </div>

      <Divider style={{ margin: "4px 0 8px 0" }} />

      {/* ---- Main layout ---- */}
      <div style={{ display: "flex", gap: 12, height: "calc(100vh - 120px)" }}>

        {/* LEFT PANEL */}
        <div style={{ flex: "0 0 260px", overflow: "auto", borderRight: "1px solid #e5e7eb", paddingRight: 10 }}>
          <div style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#374151" }}>Customer Mobile</Text>
            <Input size="small" value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} />
          </div>

          <div style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#374151" }}>Salesman Code</Text>
            <Input
              size="small" value={salesmanCode}
              onChange={(e) => { setSalesmanCode(e.target.value); setSalesmanName(e.target.value); }}
            />
            <Text style={{ fontSize: 12, display: "block", marginTop: 4, marginBottom: 2, color: "#374151" }}>Salesman Name</Text>
            <Input size="small" value={salesmanName} disabled />
          </div>

          <Divider style={{ margin: "6px 0" }} />

          <Text strong style={{ fontSize: 11, color: "#374151" }}>Receipt Details</Text>
          <Table
            size="small" dataSource={receipts} columns={receiptColumns}
            pagination={false} rowKey="key" style={{ marginTop: 4 }}
            onRow={(record) => ({ onClick: () => setSingleReceiptToTotal(record.receipt_mode) })}
          />

          <Divider style={{ margin: "6px 0" }} />

          <Text strong style={{ fontSize: 11, color: "#374151" }}>Printer</Text>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <Select
              size="small" style={{ flex: 1 }}
              value={selectedPrinter} onChange={setSelectedPrinter}
              options={printers.map((p) => ({ value: p.name, label: p.name }))}
              placeholder="Select printer"
            />
            <Button size="small" onClick={refreshPrinters}>↻</Button>
          </div>
          <Button size="small" onClick={printTestInvoice} style={{ width: "100%", marginTop: 4 }}>
            Print Test Invoice
          </Button>

          <Divider style={{ margin: "6px 0" }} />

          <Button size="small" onClick={() => window.POS?.closeWindow?.() || window.close?.()}>
            Close Window
          </Button>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ marginBottom: 6 }}>
            <Text style={{ fontSize: 12, display: "block", marginBottom: 2, color: "#374151" }}>
              Item Search / Barcode
            </Text>
            <Input
              className="item-search-input"
              ref={itemSearchRef}
              value={itemQuery}
              onChange={(e) => setItemQuery(e.target.value)}
              placeholder="Scan barcode or type name — Enter / F2 to browse"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  openLookup(itemQuery.trim() || "");
                  setItemQuery("");
                } else if (e.key === "Tab" && !e.shiftKey) {
                  e.preventDefault();
                  saveButtonRef.current?.focus?.();
                } else if (e.key === "F2") {
                  e.preventDefault();
                  openLookup(itemQuery || "");
                }
              }}
            />
          </div>

          <Table
            className="pos-item-table"
            size="small"
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1050, y: "calc(100vh - 360px)" }}
            style={{ flex: 1 }}
          />

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <div>
              <Text style={{ fontSize: 12, color: "#374151" }}>Total QTY</Text>
              <Input value={round2(totalQty)} readOnly style={{ width: 120, fontSize: 16, fontWeight: 600, marginTop: 2 }} />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: "#374151" }}>Total Amount</Text>
              <Input value={round2(totalAmount)} readOnly style={{ width: 160, fontSize: 16, fontWeight: 600, marginTop: 2 }} />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Footer totals + Save ---- */}
      <Divider style={{ margin: "8px 0" }} />
      <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Total Received", value: round2(totalReceived), width: 150 },
            { label: "Amount Tendered", value: null,                  width: 150 },
            { label: "Balance",         value: round2(balance),       width: 130 },
          ].map(({ label, value, width }) =>
            value !== null ? (
              <div key={label}>
                <Text style={{ fontSize: 12, color: "#374151", display: "block", marginBottom: 2 }}>{label}</Text>
                <Input readOnly value={value} style={{ width, fontSize: 15, fontWeight: 700 }} />
              </div>
            ) : (
              <div key={label}>
                <Text style={{ fontSize: 12, color: "#374151", display: "block", marginBottom: 2 }}>{label}</Text>
                <InputNumber
                  ref={tenderedRef} value={tendered} min={0}
                  onChange={(v) => setTendered(Number(v || 0))}
                  onPressEnter={onSave}
                  style={{ width: 150, fontSize: 15, fontWeight: 700 }}
                />
              </div>
            )
          )}
        </div>
        <Button
          ref={saveButtonRef} type="primary" size="large"
          onClick={onSave} disabled={!canSave}
          style={{ minWidth: 180, height: 44, fontSize: 16, fontWeight: 700 }}
        >
          Save Bill
        </Button>
      </div>

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={lookupQuery}
        onClose={closeLookup}
        onPick={(itm) => {
          const batch     = itm.batchCode || "";
          const available = Number.isFinite(Number(itm.availableQty)) ? Number(itm.availableQty) : null;
          const existing  = items.find((r) => r.item_id === itm.itemId && (r.batch || "") === batch);

          if (existing) {
            const nextQty = (Number(existing.qty) || 0) + 1;
            const allowed = getAvailableQty(existing) ?? available;
            if (allowed !== null && nextQty > allowed) { message.warning(`Only ${allowed} in stock for ${existing.item_name}`); return; }
            updateItem(existing.key, { qty: nextQty, available_qty: allowed });
            setItemQuery(""); closeLookup({ focusSearch: false }); focusQtyInput(existing.key, 80);
            return;
          }
          if (available !== null && available <= 0) { message.warning(`No stock for ${itm.itemName}`); return; }

          const row = {
            key: crypto.randomUUID(), item_id: itm.itemId, item_name: itm.itemName,
            barcode: itm.barcode, qty: 1, available_qty: available,
            tax_rate: itm.taxRate, standard_price: itm.standardPrice,
            amount: round2n(Number(itm.standardPrice) || 0),
            batch, unit: itm.unitName || "", expiry: itm.expiry || "",
          };
          setItems((p) => [row, ...p]);
          setItemQuery(""); closeLookup({ focusSearch: false }); focusQtyInput(row.key, 80);
        }}
      />
    </div>
  );
}

function round2(v)  { return (Number(v) || 0).toFixed(2); }
function round2n(v) { return Math.round((Number(v) || 0) * 100) / 100; }

function buildReceiptHtml({ items, totalAmount, tendered, balance }) {
  const rows = items.map((r) => `
    <tr>
      <td>${esc(r.item_name)}</td>
      <td style="text-align:right">${Number(r.qty||0).toFixed(2)}</td>
      <td style="text-align:right">${Number(r.standard_price||0).toFixed(2)}</td>
      <td style="text-align:right">${Number(r.amount||0).toFixed(2)}</td>
    </tr>`).join("");

  return `<html><body style="font-family:monospace;width:300px;color:#000">
    <div style="text-align:center;font-weight:bold">POS INVOICE</div><hr/>
    <table style="width:100%;font-size:12px">
      <thead><tr><th style="text-align:left">Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amt</th></tr></thead>
      <tbody>${rows}</tbody>
    </table><hr/>
    <div style="display:flex;justify-content:space-between"><span>Total</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Tendered</span><span>${Number(tendered||0).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Balance</span><span>${Number(balance||0).toFixed(2)}</span></div>
    <hr/><div style="text-align:center">Thank you!</div>
  </body></html>`;
}

function esc(s) {
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
