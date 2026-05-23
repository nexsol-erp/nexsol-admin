import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Table, Typography, Space, Divider, Select, message } from "antd";
import { logout } from "../auth/auth";
import ItemLookupModal from "../components/ItemLookupModal";
import { hasCache, loadAllItemsToCache, applySaleToCache } from "../cache/itemCache";
import { log, warn, error as logError } from "../utils/logger";
import { apiUrl } from "../utils/apiUrl";

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

    const tenantId  = localStorage.getItem("tenancyId") || "79001a";
    const token     = localStorage.getItem("jwtToken") || "";
    const branchCode = selectedBranchCode || "";

    const headerId = crypto.randomUUID();
    const numericVoucherNumber = Math.floor(Math.random() * 100000);
    const voucherNumber = `POS-${numericVoucherNumber}`;

    const header = {
      id: headerId,
      branch_code: branchCode,
      sales_man_name: salesmanName || "",
      customer_mobile: customerMobile || "",
      numeric_voucher_number: numericVoucherNumber,
      voucher_number: voucherNumber,
      voucher_prefix: "POS",
      voucher_date: new Date().toISOString(),
      company_mst_id: tenantId,
      is_synched: "0",
    };

    const details = items.map((item) => ({
      id: crypto.randomUUID(),
      parent_id: headerId,
      item_name: item.item_name || "",
      item_id: item.item_id || "",
      barcode: item.barcode || "",
      tax_rate: Number(item.tax_rate) || 0,
      cess_rate: 0,
      unit: item.unit || "",
      item_code: item.item_code || "",
      qty: Number(item.qty) || 0,
      rate: Number(item.standard_price) || 0,
      standard_price: Number(item.standard_price) || 0,
      amount: Number(item.amount) || 0,
      batch: item.batch || "",
      expiry: item.expiry || null,
      description: "",
    }));

    const payload = { sales: [{ header, details }] };

    try {
      log("posting sale | tenantId:", tenantId, "| branch:", branchCode,
          "| lines:", details.length, "| hasToken:", !!token, "| tokenLen:", token.length,
          "| payload:", JSON.stringify(payload));
      const saleUrl = apiUrl(`/api/${tenantId}/sales-upload/${branchCode}`);
      log("sale POST url:", saleUrl);
      const response = await fetch(saleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": tenantId,
        },
        body: JSON.stringify(payload),
      });
      log("sale POST response:", response.status, response.statusText);
      const rawText = await response.text().catch(() => "");
      log("sale POST response body:", rawText);
      if (!response.ok) {
        logError("sale POST error body (raw):", rawText);
        let errMsg = `Save failed: ${response.status}`;
        try { const j = JSON.parse(rawText); errMsg = j.message || errMsg; } catch (_) {}
        throw new Error(errMsg);
      }
      let result;
      try { result = JSON.parse(rawText); } catch (_) { result = {}; }
      if (result.failedIds?.length > 0) {
        const msgs = Object.values(result.errorMessages || {}).join("; ");
        logError("sale upload failed ids:", JSON.stringify(result.failedIds), "| errors:", msgs);
        throw new Error(msgs || "Sale upload reported failures");
      }
      await applySaleToCache(items.map((item) => ({
        itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
      })));
      message.success("Sales saved successfully");
      // Auto-print: capture snapshot before clearing state
      doPrint({ snapshot: [...items], voucherNumber, silent: true });
      setItems([]); setTendered(0);
      setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
      setCustomerMobile(""); setSalesmanCode(""); setSalesmanName("");
      setTimeout(() => itemSearchRef.current?.focus?.(), 50);
    } catch (e) {
      message.error("Save failed: " + (e.message || "Unknown error"));
    }
  };

  // Branch info (name, address, GST) for receipt header
  const [branchInfo, setBranchInfo] = useState(null);
  useEffect(() => {
    if (!selectedBranchCode) { log("branchInfo: no selectedBranchCode, skipping fetch"); return; }
    const tenantId = localStorage.getItem("tenancyId") || "";
    const token    = localStorage.getItem("jwtToken") || "";
    log("branchInfo fetch | tenantId:", tenantId, "| branchCode:", selectedBranchCode);
    fetch(apiUrl(`/api/${tenantId}/branches`), { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then((text) => {
        log("branchInfo raw response (first 300):", text.substring(0, 300));
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }
        // Spring may double-encode the string — unwrap one level if so
        if (typeof data === "string") { try { data = JSON.parse(data); } catch { data = {}; } }
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        log("branchInfo list length:", list.length, "| codes:", list.map((b) => b.branchCode).join(","));
        const found = list.find((b) => b.branchCode === selectedBranchCode) || null;
        setBranchInfo(found);
        log("branchInfo set:", JSON.stringify(found));
      })
      .catch((e) => logError("branchInfo fetch error:", e.message));
  }, [selectedBranchCode]);

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

  const doPrint = async ({ snapshot, voucherNumber, silent = false }) => {
    log("doPrint | branchInfo:", JSON.stringify(branchInfo), "| voucherNumber:", voucherNumber);
    if (!window.POS?.printHtml) return;
    const html = buildReceiptHtml({
      items: snapshot, totalAmount, tendered, balance, receipts,
      branchInfo, salesmanName, customerMobile, voucherNumber,
    });
    try {
      await window.POS.printHtml({ html, silent, deviceName: selectedPrinter });
      if (!silent) message.success("Print sent");
    } catch (e) { message.error("Print failed: " + e.message); }
  };

  const printTestInvoice = () => doPrint({ snapshot: items, voucherNumber: "", silent: false });

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

function buildReceiptHtml({ items, totalAmount, tendered, balance, receipts, branchInfo, salesmanName, customerMobile, voucherNumber }) {
  const b = branchInfo || {};
  const addrParts = [
    b.branchBuildingAddress,
    b.branchAddress1,
    b.branchStreetAddress,
    b.branchState,
    b.branchCountry,
  ].filter(Boolean);

  const addrHtml = addrParts.map((line) => `<div class="addr">${esc(line)}</div>`).join("");
  const gstHtml  = b.branchGst ? `<div class="addr">GST: ${esc(b.branchGst)}</div>` : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Item rows
  let serial = 0;
  const itemRows = items.map((r) => {
    serial++;
    const taxLabel = Number(r.tax_rate) > 0 ? `(${Number(r.tax_rate).toFixed(0)}%)` : "";
    return `
      <tr>
        <td class="sno">${serial}</td>
        <td class="iname">${esc(r.item_name)}${taxLabel ? `<span class="tax-badge">${taxLabel}</span>` : ""}</td>
        <td class="num">${Number(r.qty||0).toFixed(2)}</td>
        <td class="num">${Number(r.standard_price||0).toFixed(2)}</td>
        <td class="num">${Number(r.amount||0).toFixed(2)}</td>
      </tr>`;
  }).join("");

  // Tax breakdown — CGST / SGST split per Qt style
  const taxMap = {};
  items.forEach((r) => {
    const rate = Number(r.tax_rate) || 0;
    if (rate <= 0) return;
    if (!taxMap[rate]) taxMap[rate] = 0;
    taxMap[rate] += (Number(r.amount) || 0) * rate / 100;
  });
  let totalTax = 0;
  const taxRows = Object.entries(taxMap).map(([rate, taxAmt]) => {
    totalTax += taxAmt;
    const half = taxAmt / 2;
    return `
      <tr><td colspan="3">CGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>
      <tr><td colspan="3">SGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>`;
  }).join("");
  const taxTotalRow = totalTax > 0
    ? `<tr class="tax-total"><td colspan="3"><b>Total Tax</b></td><td class="num"><b>${totalTax.toFixed(2)}</b></td></tr>`
    : "";

  // Payment rows
  const payRows = (receipts || [])
    .filter((r) => Number(r.amount) > 0)
    .map((r) => `
      <tr>
        <td class="pay-mode">${esc(r.receipt_mode)}</td>
        <td class="num">${Number(r.amount).toFixed(2)}</td>
      </tr>`).join("");

  const tenderRow = Number(tendered) > 0
    ? `<tr><td class="pay-mode">Tendered</td><td class="num">${Number(tendered).toFixed(2)}</td></tr>` : "";
  const balanceRow = Number(balance) > 0
    ? `<tr class="balance-row"><td class="pay-mode"><b>Balance</b></td><td class="num"><b>${Number(balance).toFixed(2)}</b></td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 302px;
    color: #000;
    background: #fff;
    padding: 6px 4px;
  }
  .shop-name { font-size: 15px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
  .addr { font-size: 10px; text-align: center; line-height: 1.4; }
  .gst  { font-size: 10px; text-align: center; font-weight: bold; margin-top: 1px; }
  .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  .meta { font-size: 11px; display: flex; justify-content: space-between; margin: 2px 0; }
  .meta-single { font-size: 11px; margin: 1px 0; }
  .invoice-title { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 2px; margin: 3px 0; }

  table.items { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.items th { text-align: left; font-size: 10px; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.items th.num { text-align: right; }
  table.items td { padding: 1px 2px; vertical-align: top; }
  table.items td.sno  { width: 14px; color: #555; }
  table.items td.iname { width: 130px; }
  table.items td.num { text-align: right; }
  .tax-badge { font-size: 9px; color: #444; margin-left: 2px; }

  table.tax  { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.tax td { padding: 1px 2px; }
  table.tax td.num { text-align: right; }
  .tax-label { font-size: 10px; font-weight: bold; margin: 3px 0 1px 0; }
  .tax-total td { border-top: 1px dashed #000; }

  .total-line { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 4px 0; }

  table.pay { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.pay td { padding: 1px 2px; }
  table.pay td.pay-mode { text-transform: uppercase; }
  table.pay td.num { text-align: right; }
  .balance-row td { border-top: 1px dashed #000; font-size: 12px; }

  .footer { text-align: center; font-size: 11px; margin-top: 4px; line-height: 1.6; }
  .footer .thanks { font-weight: bold; font-size: 12px; }
</style>
</head>
<body>
  <div class="shop-name">${esc(b.branchName || "POS INVOICE")}</div>
  ${addrHtml}
  ${gstHtml}
  <hr class="solid"/>
  <div class="invoice-title">TAX INVOICE</div>
  <hr class="dash"/>
  <div class="meta"><span>Invoice: ${esc(voucherNumber || "—")}</span><span>${dateStr} ${timeStr}</span></div>
  ${customerMobile ? `<div class="meta-single">Customer: ${esc(customerMobile)}</div>` : ""}
  ${salesmanName   ? `<div class="meta-single">Served by: ${esc(salesmanName)}</div>` : ""}
  <hr class="dash"/>

  <table class="items">
    <thead>
      <tr>
        <th></th>
        <th>Item</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Amt</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="dash"/>

  ${totalTax > 0 ? `
  <div class="tax-label">Tax Details</div>
  <table class="tax">
    <tbody>
      ${taxRows}
      ${taxTotalRow}
    </tbody>
  </table>
  <hr class="dash"/>` : ""}

  <div class="total-line"><span>TOTAL</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
  <hr class="solid"/>

  <table class="pay">
    <tbody>
      ${payRows}
      ${tenderRow}
      ${balanceRow}
    </tbody>
  </table>
  <hr class="dash"/>

  <div class="footer">
    <div class="thanks">Thank you for your business!</div>
    <div>Please visit us again</div>
  </div>
  <br/><br/>
</body>
</html>`;
}

function esc(s) {
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
