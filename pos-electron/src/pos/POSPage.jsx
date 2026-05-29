import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, InputNumber, Select, Table, message, Tag, Tooltip } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import { logout } from "../auth/auth";
import ItemLookupModal from "../components/ItemLookupModal";
import { applySaleToCache, findItemByName } from "../cache/itemCache";
import { evaluateSchemes, buildOfferRows } from "./schemeEngine";
import { log, warn, error as logError } from "../utils/logger";
import { apiUrl } from "../utils/apiUrl";
import { queueSale, getPendingCount, syncPendingSales } from "./offlineQueue";

export default function POSPage({ onLogout, selectedBranchCode = "", prefillItems = null, onPrefillUsed }) {

  const itemSearchRef = useRef(null);
  const tenderedRef = useRef(null);
  const saveButtonRef = useRef(null);
  const qtyInputRefs = useRef({});
  const lastActivityRef = useRef(Date.now());
  const pendingQtyFocusKey = useRef(null);

  const [customerMobile, setCustomerMobile] = useState("");
  const [salesmanCode, setSalesmanCode] = useState("");
  const [salesmanName, setSalesmanName] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [items, setItems] = useState([]);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [schemes, setSchemes] = useState([]);
  const [categoryMap, setCategoryMap] = useState({});

  // Offline queue — poll every 10 s; sync only when idle >= 30 s and online
  useEffect(() => {
    getPendingCount().then(setPendingCount);

    let busy = false;

    const trySync = async () => {
      if (busy || !navigator.onLine) return;
      const count = await getPendingCount();
      if (!count) return;
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs < 120_000) return;

      busy = true;
      setSyncing(true);
      log("offlineQueue: idle sync triggered | pending:", count, "| idleMs:", idleMs);
      const { synced, failed } = await syncPendingSales();
      if (synced > 0) message.success(`Synced ${synced} offline sale${synced > 1 ? "s" : ""}`);
      if (failed > 0) message.warning(`${failed} sale${failed > 1 ? "s" : ""} still pending`);
      setPendingCount(await getPendingCount());
      setSyncing(false);
      busy = false;
    };

    const interval = setInterval(trySync, 10_000);
    // Also attempt immediately when coming back online
    window.addEventListener("online", trySync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", trySync);
    };
  }, []);

  useEffect(() => { log("POSPage mounted"); }, []);

  useEffect(() => {
    const tenantId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    if (!tenantId || !token) return;
    const hdr = { Authorization: `Bearer ${token}` };

    fetch(`/api/${tenantId}/scheme`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setSchemes(Array.isArray(data) ? data : []))
      .catch(() => {});

    fetch(`/api/${tenantId}/item-category-map/all`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const map = {};
        for (const row of rows) {
          const id = String(row.itemId || "").trim();
          const cat = String(row.categoryName || "").trim();
          if (!id || !cat) continue;
          if (!map[id]) map[id] = [];
          if (!map[id].includes(cat)) map[id].push(cat);
        }
        setCategoryMap(map);
      })
      .catch(() => {});

    fetch(`/api/${tenantId}/receipt-modes`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        setReceipts(
          rows.map((r) => ({
            key: r.receiptMode,
            receipt_mode: r.receiptMode,
            amount: 0,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Load items pre-filled from KOT Convert-to-POS
  useEffect(() => {
    if (!prefillItems?.length) return;
    setItems(prefillItems);
    onPrefillUsed?.();
    setTimeout(() => itemSearchRef.current?.focus?.(), 100);
  }, [prefillItems]);

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
  ]);

  const totalAmount   = useMemo(() => items.reduce((s, r) => s + (Number(r.amount) || 0), 0), [items]);
  const activeOffers  = useMemo(() => evaluateSchemes(items, schemes, categoryMap), [items, schemes, categoryMap]);
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
    if (!selectedBranchCode) { message.warning("Select branch code"); return; }

    const tenantId  = localStorage.getItem("tenancyId") || "79001a";
    const token     = localStorage.getItem("jwtToken") || "";
    const branchCode = selectedBranchCode || "";

    // ── Apply schemes: remove stale offer rows, re-evaluate, inject free items ──
    const baseItems = items.filter((r) => !r.is_offer);
    const offers = evaluateSchemes(baseItems, schemes, categoryMap);
    const offerRows = await buildOfferRows(offers, findItemByName);
    const finalItems = [...baseItems, ...offerRows];
    if (offerRows.length > 0) {
      setItems(finalItems);
      const labels = offerRows.map((r) => `${r.item_name} ×${r.qty} (FREE)`).join(", ");
      message.success(`Scheme applied — ${labels}`, 4);
    }
    // Cash-back offers: informational
    offers
      .filter((o) => o.offerType === "Cash Back")
      .forEach((o) =>
        message.info(`Cash Back: ₹${o.cashBackAmount} from scheme "${o.schemeName}"`, 5)
      );

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

    const details = finalItems.map((item) => ({
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
      description: item.description || "",
    }));

    const receiptLines = receipts
      .filter((r) => (Number(r.amount) || 0) > 0)
      .map((r) => ({ receipt_mode: r.receipt_mode, amount: Number(r.amount) }));

    const payload = { sales: [{ header, details, receipts: receiptLines }] };

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
        const err = new Error(errMsg);
        err.httpStatus = response.status;
        throw err;
      }
      let result;
      try { result = JSON.parse(rawText); } catch (_) { result = {}; }
      if (result.failedIds?.length > 0) {
        const msgs = Object.values(result.errorMessages || {}).join("; ");
        logError("sale upload failed ids:", JSON.stringify(result.failedIds), "| errors:", msgs);
        throw new Error(msgs || "Sale upload reported failures");
      }
      await applySaleToCache(finalItems.map((item) => ({
        itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
      })));
      message.success("Sales saved successfully");
      // Auto-print: capture snapshot before clearing state
      doPrint({ snapshot: [...finalItems], voucherNumber, silent: true });
      setItems([]); setTendered(0);
      setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
      setCustomerMobile(""); setSalesmanCode(""); setSalesmanName("");
      setTimeout(() => itemSearchRef.current?.focus?.(), 50);
    } catch (e) {
      if (e.httpStatus === 401) {
        message.error("Session expired — please log in again.", 6);
        return;
      }
      const isNetworkError = !navigator.onLine || e instanceof TypeError;
      const isServerError  = e.httpStatus >= 500;
      if (isNetworkError || isServerError) {
        try {
          await queueSale({ tenantId, branchCode, payload, voucherNumber });
          await applySaleToCache(finalItems.map((item) => ({
            itemId: item.item_id, batchCode: item.batch || "", qty: Number(item.qty) || 0,
          })));
          message.warning(isNetworkError
            ? "No network — sale saved offline, will sync automatically when connected"
            : `Server error (${e.httpStatus}) — sale saved offline, will retry when server recovers`);
          doPrint({ snapshot: [...finalItems], voucherNumber, silent: true });
          setItems([]); setTendered(0);
          setReceipts((prev) => prev.map((r) => ({ ...r, amount: 0 })));
          setCustomerMobile(""); setSalesmanCode(""); setSalesmanName("");
          setTimeout(() => itemSearchRef.current?.focus?.(), 50);
          setPendingCount((c) => c + 1);
        } catch (qErr) {
          logError("offlineQueue: failed to queue sale:", qErr.message);
          message.error("Save failed and could not queue offline: " + qErr.message);
        }
      } else {
        message.error("Save failed: " + (e.message || "Unknown error"));
      }
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
    { title: "Item", dataIndex: "item_name", width: 200, render: (v) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: "barcode",   dataIndex: "barcode",       width: 120 },
    { title: "stock",     dataIndex: "available_qty", width: 70, render: (v) => (v == null ? "-" : round2(v)) },
    {
      title: "qty", dataIndex: "qty", width: 80,
      render: (_, row) => (
        <InputNumber
          ref={(el) => { if (el) qtyInputRefs.current[row.key] = el; else delete qtyInputRefs.current[row.key]; }}
          value={row.qty} min={0}
          onChange={(val) => updateItem(row.key, { qty: val })}
          onPressEnter={() => itemSearchRef.current?.focus?.()}
          style={{ width: "100%", borderRadius: 0 }}
        />
      ),
    },
    { title: "Rate", dataIndex: "standard_price", width: 90, render: (v) => round2(v) },
    { title: "Tax",  dataIndex: "tax_rate",       width: 70 },
    { title: "amount",   dataIndex: "amount",   width: 100, render: (v) => round2(v) },
    { title: "batch",    dataIndex: "batch",    width: 90 },
    { title: "unit",     dataIndex: "unit",     width: 60 },
    { title: "expiry",   dataIndex: "expiry",   width: 100 },
    {
      title: "", key: "x", width: 42,
      render: (_, row) => (
        <Button danger size="small" style={{ borderRadius: 0, padding: "0 6px" }} onClick={() => deleteItem(row.key)}>✕</Button>
      ),
    },
  ];

  const receiptColumns = [
    { title: "Payment Type", dataIndex: "receipt_mode", width: 130 },
    {
      title: "Amount", dataIndex: "amount", width: 120,
      render: (_, row) => (
        <InputNumber
          value={row.amount} min={0} style={{ width: "100%", borderRadius: 0 }}
          onChange={(val) => setReceipts((prev) => prev.map((r) => r.key === row.key ? { ...r, amount: Number(val || 0) } : r))}
          onKeyDown={(e) => { if (e.key === "Enter") setSingleReceiptToTotal(row.receipt_mode); }}
        />
      ),
    },
  ];

  const markActivity = () => { lastActivityRef.current = Date.now(); };

  const qtLabel = (text) => (
    <div style={{ fontSize: 11, fontWeight: "bold", color: "#000", marginBottom: 1 }}>{text}</div>
  );

  return (
    <div className="pos-container" onKeyDown={markActivity} onClick={markActivity}>
      {/* ── Title bar ── */}
      <div style={{
        background: "#0b3a75", color: "#fff", padding: "3px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        fontSize: 13, fontWeight: "bold", flexShrink: 0,
      }}>
        <span>POS Window{selectedBranchCode ? ` — ${selectedBranchCode}` : ""}</span>
        {pendingCount > 0 && (
          <Tooltip title={syncing ? "Syncing…" : `${pendingCount} offline sale(s) — click to sync`}>
            <Tag
              color="warning"
              icon={<SyncOutlined spin={syncing} />}
              style={{ cursor: "pointer", marginRight: 4 }}
              onClick={async () => {
                if (syncing) return;
                setSyncing(true);
                const { synced, failed } = await syncPendingSales();
                if (synced > 0) message.success(`Synced ${synced} offline sale${synced > 1 ? "s" : ""}`);
                if (failed > 0) message.warning(`${failed} still pending`);
                setPendingCount(await getPendingCount());
                setSyncing(false);
              }}
            >
              {pendingCount} pending
            </Tag>
          </Tooltip>
        )}
      </div>

      {/* ── Main two-panel body ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* ══ LEFT PANEL (controls + payment) ══ */}
        <div style={{
          width: 270, minWidth: 250, flexShrink: 0,
          background: "#d4d0c8",
          borderRight: "2px solid #808080",
          display: "flex", flexDirection: "column",
          padding: "6px 8px", gap: 4, overflow: "auto",
        }}>
          {/* Customer Mobile */}
          <div>
            {qtLabel("Customer Mobile")}
            <Input
              size="small" value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              style={{ borderRadius: 0 }}
            />
          </div>

          {/* Salesman */}
          <div>
            {qtLabel("SalesMan Code")}
            <Input
              size="small" value={salesmanCode}
              onChange={(e) => { setSalesmanCode(e.target.value); setSalesmanName(e.target.value); }}
              style={{ borderRadius: 0 }}
            />
            <Input
              size="small" value={salesmanName} disabled
              style={{ borderRadius: 0, marginTop: 2 }}
            />
          </div>

          {/* Receipt Details */}
          <div style={{ fontWeight: "bold", fontSize: 13, color: "#000", marginTop: 4, borderBottom: "1px solid #808080", paddingBottom: 2 }}>
            Receipt Details
          </div>
          <Table
            className="qt-receipt-table"
            size="small"
            dataSource={receipts}
            columns={receiptColumns}
            pagination={false}
            rowKey="key"
            showHeader
            onRow={(record) => ({ onClick: () => setSingleReceiptToTotal(record.receipt_mode) })}
          />

          {/* Payment totals */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Total Received</span>
            <Input readOnly value={round2(totalReceived)}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Amount Tendered</span>
            <InputNumber
              ref={tenderedRef} value={tendered} min={0}
              onChange={(v) => setTendered(Number(v || 0))}
              onPressEnter={onSave}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: "bold" }}>Balance to Pay</span>
            <Input readOnly value={round2(balance)}
              style={{ width: 110, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
          </div>

          {/* Offer panel — live scheme results */}
          {activeOffers.length > 0 && (
            <div style={{
              background: "#fffbe6", border: "1px solid #ffe58f",
              borderRadius: 0, padding: "4px 6px", marginTop: 4,
            }}>
              <div style={{ fontSize: 11, fontWeight: "bold", color: "#7c5800", marginBottom: 2 }}>
                Offers Applicable
              </div>
              {activeOffers.map((o, i) => (
                <div key={i} style={{ fontSize: 11, color: "#5a4000", lineHeight: 1.5 }}>
                  {o.offerType === "Free Qty" && `🎁 ${o.offerItemName} ×${o.offerQty} FREE`}
                  {o.offerType === "Item Discount Percent" && `🏷 ${o.offerDiscountPercent}% off on ${o.offerItemName}`}
                  {o.offerType === "Cash Back" && `💵 Cash Back ₹${o.cashBackAmount}`}
                  <span style={{ color: "#999", marginLeft: 4 }}>({o.schemeName})</span>
                </div>
              ))}
            </div>
          )}

          {/* Save + Close buttons */}
          <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", gap: 6 }}>
            <button
              ref={saveButtonRef}
              onClick={onSave}
              disabled={!canSave}
              style={{
                flex: 1, height: 44, fontSize: 17, fontWeight: "bold",
                background: canSave ? "#ffc8ff" : "#c8c8c8",
                border: "2px outset #ccc",
                cursor: canSave ? "pointer" : "not-allowed",
                color: "#000",
              }}
            >
              Save
            </button>
            <button
              onClick={() => { logout(); onLogout?.(); }}
              style={{
                flex: 1, height: 44, fontSize: 17, fontWeight: "bold",
                background: "#d4d0c8", border: "2px outset #ccc", cursor: "pointer", color: "#000",
              }}
            >
              Close
            </button>
          </div>

          {/* Printer */}
          <div style={{ marginTop: 6 }}>
            {qtLabel("Printer")}
            <div style={{ display: "flex", gap: 4 }}>
              <Select
                size="small" style={{ flex: 1 }} value={selectedPrinter} onChange={setSelectedPrinter}
                options={printers.map((p) => ({ value: p.name, label: p.name }))}
                placeholder="Select printer"
              />
              <Button size="small" style={{ borderRadius: 0 }} onClick={refreshPrinters}>↻</Button>
            </div>
            <Button size="small" style={{ width: "100%", marginTop: 3, borderRadius: 0 }} onClick={printTestInvoice}>
              Print Test Invoice
            </Button>
          </div>
        </div>

        {/* ══ RIGHT PANEL (items table) ══ */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 8px", overflow: "hidden", background: "#d4d0c8" }}>
          {/* Item search + totals on same line */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 5 }}>
            <div style={{ flex: 1 }}>
              {qtLabel("Item Search / Barcode")}
              <Input
                className="item-search-input"
                ref={itemSearchRef}
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
                placeholder="Scan barcode or type name — Enter / F2 to browse"
                style={{ borderRadius: 0 }}
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>QTY</span>
              <Input readOnly value={round2(totalQty)}
                style={{ width: 80, fontSize: 14, fontWeight: "bold", borderRadius: 0, textAlign: "right" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: "#000" }}>Total</span>
              <Input readOnly value={round2(totalAmount)}
                style={{ width: 120, fontSize: 18, fontWeight: "bold", borderRadius: 0, textAlign: "right", background: "#fffff0" }} />
            </div>
          </div>

          {/* Items table — olive/khaki */}
          <Table
            className="qt-items-table"
            size="small"
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            rowKey="key"
            scroll={{ x: 1000, y: "calc(100vh - 210px)" }}
            style={{ flex: 1 }}
          />
        </div>
      </div>

      <ItemLookupModal
        open={lookupOpen}
        initialQuery={lookupQuery}
        onClose={closeLookup}
        onAfterClose={() => {
          const key = pendingQtyFocusKey.current;
          if (key) {
            pendingQtyFocusKey.current = null;
            qtyInputRefs.current[key]?.focus?.();
          }
        }}
        onPick={(itm) => {
          const batch     = itm.batchCode || "";
          const available = Number.isFinite(Number(itm.availableQty)) ? Number(itm.availableQty) : null;
          const existing  = items.find((r) => r.item_id === itm.itemId && (r.batch || "") === batch);

          if (existing) {
            const nextQty = (Number(existing.qty) || 0) + 1;
            const allowed = getAvailableQty(existing) ?? available;
            if (allowed !== null && nextQty > allowed) { message.warning(`Only ${allowed} in stock for ${existing.item_name}`); return; }
            updateItem(existing.key, { qty: nextQty, available_qty: allowed });
            setItemQuery(""); pendingQtyFocusKey.current = existing.key; closeLookup({ focusSearch: false });
            return;
          }
          if (available !== null && available <= 0) { message.warning(`No stock for ${itm.itemName}`); return; }

          const row = {
            key: crypto.randomUUID(), item_id: itm.itemId, item_name: itm.itemName,
            barcode: itm.barcode, qty: 1, available_qty: available,
            tax_rate: itm.taxRate, standard_price: itm.standardPrice,
            amount: round2n(Number(itm.standardPrice) || 0),
            batch, unit: itm.unitName || "", expiry: itm.expiry || "",
            category: itm.category || "",
          };
          setItems((p) => [row, ...p]);
          setItemQuery(""); pendingQtyFocusKey.current = row.key; closeLookup({ focusSearch: false });
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
    b.branchState,
    b.branchCountry,
  ].filter(Boolean);

  const addrHtml  = addrParts.map((line) => `<div class="addr">${esc(line)}</div>`).join("");
  const phoneHtml = b.branchStreetAddress ? `<div class="addr">Ph: ${esc(b.branchStreetAddress)}</div>` : "";
  const gstHtml   = b.branchGst ? `<div class="addr">GST: ${esc(b.branchGst)}</div>` : "";

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
  ${phoneHtml}
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
