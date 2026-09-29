// src/components/POSEntry.jsx
// Web POS counter billing. Items are picked the same way as web KOT: tap item tiles (recently
// sold first), search, or scan a barcode. Save stores the bill as a sales invoice and prints it.
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge, Button, Card, Empty, Grid, Input, InputNumber, Modal, Popover, Segmented, Space, Spin, Tag,
  Tooltip, Typography, message,
} from "antd";
import {
  BarcodeOutlined, ClearOutlined, DeleteOutlined, EditOutlined, MinusOutlined, PlusOutlined,
  PrinterOutlined, SaveOutlined, ShoppingCartOutlined, SyncOutlined, UserOutlined,
} from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import InvoicePrint from "./InvoicePrint";
import BarcodeScannerModal from "./BarcodeScannerModal";
import ItemPicker, { findByCode, normalizeItem } from "./pos/ItemPicker";
import usePrintPack from "../multilanguage/usePrintPack";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const LS_CACHE_KEY = "pos-item-cache-v1"; // shared with web KOT
const LS_RECENT_KEY = "pos-recent-items-v1";
const ACCENT = "#1677ff";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

const S = {
  // The app shell can be in dark mode while antd cards stay light, so keep a light surface.
  shell: { flex: 1, minWidth: 0, background: "#f0f2f5", color: "rgba(0,0,0,0.88)", minHeight: "calc(100vh - 64px)" },
  page: { padding: 16, maxWidth: 1400, margin: "0 auto" },
  header: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 },
  logo: {
    width: 40, height: 40, borderRadius: 10, background: ACCENT, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
  },
  card: { borderRadius: 10, minWidth: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  label: { fontSize: 12, color: "rgba(0,0,0,0.55)", marginBottom: 4 },
  totalBox: { background: "linear-gradient(135deg, #141a2e 0%, #24304f 100%)", color: "#fff", borderRadius: 10, padding: "14px 18px" },
  statRow: { display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8 },
  lineRow: {
    display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center",
    padding: "10px 0", borderBottom: "1px solid #f0f0f0",
  },
  bottomBar: {
    position: "fixed", right: 0, bottom: 0, zIndex: 1000, background: "#fff",
    borderTop: "1px solid #e5e5e5", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", color: "#111",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
  },
};

function readJson(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "null");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

// Line rate can be changed at the counter (loose items, a price the shelf label shows).
function RateEditor({ line, onChange }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(line.rate);
  const apply = () => {
    if (value != null && value >= 0) onChange(value);
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => { setOpen(o); if (o) setValue(line.rate); }}
      trigger="click"
      title="Change rate"
      content={
        <Space.Compact>
          <InputNumber
            autoFocus prefix="₹" min={0} value={value} onChange={setValue} controls={false}
            inputMode="decimal" style={{ width: 120 }} onPressEnter={apply}
          />
          <Button type="primary" onClick={apply}>OK</Button>
        </Space.Compact>
      }
    >
      <Button type="link" size="small" style={{ padding: 0, height: "auto", fontSize: 12 }}>
        {inr(line.rate)} <EditOutlined />
      </Button>
    </Popover>
  );
}

const POSEntry = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.lg; // phones and tablets: one pane at a time and a bottom bar
  const isPhone = !screens.sm;

  const [cache, setCache] = useState(() => readJson(LS_CACHE_KEY, []).map(normalizeItem));
  const [recent, setRecent] = useState(() => readJson(LS_RECENT_KEY, []));
  const [syncing, setSyncing] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [branchInfo, setBranchInfo] = useState(null);

  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState("POS");
  const [customerMobile, setCustomerMobile] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [voucherDate, setVoucherDate] = useState(today);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tendered, setTendered] = useState(null);
  const [mobilePane, setMobilePane] = useState("Items");

  const [billToPrint, setBillToPrint] = useState(null);
  const printPack = usePrintPack(branchInfo?.branchCode);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchRef = useRef(null);
  const printContentRef = useRef(null);

  // The search box doubles as the USB/Bluetooth scanner input on desktop. On phones and
  // tablets focusing it would open the keyboard, so only refocus at desktop widths.
  // (Read the width directly: useBreakpoint is still empty on the first render.)
  const focusSearch = () => {
    if (window.matchMedia("(min-width: 992px)").matches) setTimeout(() => searchRef.current?.focus?.(), 30);
  };

  const handlePrint = useReactToPrint({
    contentRef: printContentRef,
    copyStyles: true,
    pageStyle: `
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0 !important; padding: 0 !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
    onBeforePrint: async () => {
      if (!billToPrint) throw new Error("Nothing to print");
      if (!printContentRef.current) throw new Error("Print DOM not mounted");
    },
    onAfterPrint: () => {
      setBillToPrint(null);
      setPreviewOpen(false);
    },
  });

  const syncItems = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/${localStorage.getItem("tenancyId")}/items`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` },
      });
      if (!res.ok) throw new Error("Couldn't load items");
      const normalized = (await res.json()).map(normalizeItem);
      localStorage.setItem(LS_CACHE_KEY, JSON.stringify(normalized));
      setCache(normalized);
      message.success(`${normalized.length.toLocaleString("en-IN")} items synced`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (!cache.length) syncItems();
    focusSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const branchCode = localStorage.getItem("branchCode");
    if (!tenancyId || !token || !branchCode) return;
    fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        const branches = data?.branches ?? data?.data ?? [];
        const found = branches.find((b) => b.branchCode === branchCode);
        if (found) setBranchInfo(found);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setMobilePane("Items");
        setTimeout(() => searchRef.current?.focus?.(), 30);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── bill lines ───────────────────────────────────────────────────────────
  const totalAmount = useMemo(() => r2(items.reduce((s, it) => s + (Number(it.amount) || 0), 0)), [items]);
  const totalQty = useMemo(() => r2(items.reduce((s, it) => s + (Number(it.qty) || 0), 0)), [items]);
  const qtyById = useMemo(() => {
    const m = {};
    items.forEach((l) => { m[l.id] = (m[l.id] || 0) + Number(l.qty); });
    return m;
  }, [items]);

  const addItem = (it, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((l) => String(l.id) === String(it.id) && Number(l.rate) === Number(it.rate));
      if (idx >= 0) {
        const next = [...prev];
        const q = r2(Number(next[idx].qty) + qty);
        next[idx] = { ...next[idx], qty: q, amount: r2(q * Number(next[idx].rate)) };
        return next;
      }
      return [...prev, {
        key: `${Date.now()}-${Math.random()}`, id: it.id, itemName: it.name, qty,
        rate: Number(it.rate) || 0, taxRate: Number(it.taxRate) || 0, amount: r2(qty * (Number(it.rate) || 0)),
      }];
    });
    const nextRecent = [it.id, ...recent.filter((x) => x !== it.id)].slice(0, 24);
    setRecent(nextRecent);
    try { localStorage.setItem(LS_RECENT_KEY, JSON.stringify(nextRecent)); } catch {}
    focusSearch();
  };

  const addByCode = (raw) => {
    const it = findByCode(cache, raw);
    if (!it) return false;
    addItem(it);
    message.success({ content: `${it.name} added`, duration: 1 });
    return true;
  };

  const changeQty = (key, qty) => {
    const q = r2(qty);
    setItems((prev) => (q <= 0
      ? prev.filter((l) => l.key !== key)
      : prev.map((l) => (l.key === key ? { ...l, qty: q, amount: r2(q * Number(l.rate)) } : l))));
  };

  const changeRate = (key, rate) => {
    const r = r2(rate);
    setItems((prev) => prev.map((l) => (l.key === key ? { ...l, rate: r, amount: r2(Number(l.qty) * r) } : l)));
  };

  const resetBill = () => {
    setItems([]);
    setCustomer("POS");
    setCustomerMobile("");
    setVoucherNo("");
    setVoucherDate(today());
    setTendered(null);
    setMobilePane("Items");
    focusSearch();
  };

  const confirmClear = () => {
    if (!items.length) return resetBill();
    Modal.confirm({
      title: "Clear this bill?",
      content: `${items.length} item${items.length > 1 ? "s" : ""} will be removed.`,
      okText: "Clear",
      okButtonProps: { danger: true },
      onOk: resetBill,
    });
  };

  // ── save & print ─────────────────────────────────────────────────────────
  const saveBillToDatabase = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    // The server saves this as a cash-paid invoice for this branch and posts it to the ledger.
    const salesTransHdr = {
      branchCode: localStorage.getItem("branchCode"),
      customer: {
        id: "001",
        name: customer || "POS",
        address: null,
        gst: null,
        mobile: customerMobile || null,
        state: null,
        country: null,
      },
      voucherNumber: voucherNo || null,
      voucherDate: new Date().toISOString(),
      NumericVoucherNumber: null,
      salesManName: null,
      customerMobile: customerMobile || null,
      voucherPrefix: "INV",
      voucherSufix: null,
      isSynched: 0,
      salesDetails: items.map((item) => ({
        itemId: item.id,
        itemName: item.itemName,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
      })),
    };

    const response = await fetch(`/api/${tenancyId}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(salesTransHdr),
    });

    if (!response.ok) {
      let errMsg = "Failed to save invoice";
      try {
        const errorData = await response.json();
        errMsg = errorData?.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }
    return response.json();
  };

  const handleSave = async () => {
    if (!items.length) return message.error("Add at least one item");
    if (!localStorage.getItem("branchCode")) return message.error("Pick a branch in the menu first.");
    // Blank cash received means the customer paid the exact amount.
    const paid = tendered == null ? totalAmount : Number(tendered) || 0;
    setSaving(true);
    try {
      message.loading({ content: "Saving invoice...", key: "saving" });
      const savedResult = await saveBillToDatabase();
      if (!savedResult || !savedResult.voucherNumber) throw new Error("Invalid response from server");

      message.success({ content: "Saved successfully!", key: "saving", duration: 1.5 });
      setBillToPrint({
        ...savedResult,
        branchInfo,
        totalAmount: savedResult.totalAmount ?? totalAmount,
        tendered: paid,
        customer: savedResult.customer ?? { name: customer || "Walk-In" },
        salesDetails: savedResult.salesDetails ?? items.map((it) => ({
          itemId: it.id,
          itemName: it.itemName,
          qty: it.qty,
          rate: it.rate,
          taxRate: it.taxRate || 0,
          amount: it.amount,
        })),
      });
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      message.error({ content: `Failed: ${e.message}`, key: "saving", duration: 5 });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPrint = async () => {
    if (!billToPrint) return message.error("Invoice not ready to print");
    await new Promise((r) => setTimeout(r, 150));
    if (!printContentRef.current) return message.error("Print content not mounted yet.");
    handlePrint();
    setTimeout(resetBill, 500);
  };

  // ── payment derived ──────────────────────────────────────────────────────
  const paidNow = tendered == null ? totalAmount : Number(tendered) || 0;
  const balance = r2(paidNow - totalAmount);
  const isDue = balance < 0;

  // Exact amount plus the next round notes a customer is likely to hand over.
  const quickTender = useMemo(() => {
    if (!(totalAmount > 0)) return [];
    const vals = [totalAmount];
    [100, 500, 2000].forEach((n) => {
      const v = Math.ceil(totalAmount / n) * n;
      if (!vals.includes(v)) vals.push(v);
    });
    return vals.slice(0, 4);
  }, [totalAmount]);

  // ════════════════════════════════════════════════════════════════════════
  const qtyStepper = (l) => (
    <Space.Compact size="small">
      <Button icon={<MinusOutlined />} aria-label="Less" onClick={() => changeQty(l.key, Number(l.qty) - 1)} />
      <InputNumber
        size="small" min={0} value={l.qty} controls={false} inputMode="decimal"
        style={{ width: 48, textAlign: "center" }}
        onChange={(v) => v != null && changeQty(l.key, v)}
      />
      <Button icon={<PlusOutlined />} aria-label="More" onClick={() => changeQty(l.key, Number(l.qty) + 1)} />
    </Space.Compact>
  );

  const lineRow = (l) => (
    <div key={l.key} style={S.lineRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.itemName}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <RateEditor line={l} onChange={(v) => changeRate(l.key, v)} />
          <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
          <b>{inr(l.amount)}</b>
        </div>
      </div>
      <Space size={4}>
        {qtyStepper(l)}
        <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove" onClick={() => changeQty(l.key, 0)} />
      </Space>
    </div>
  );

  const header = (
    <div style={S.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={S.logo}><ShoppingCartOutlined /></div>
        <div style={{ minWidth: 0 }}>
          <Title level={isPhone ? 5 : 4} style={{ margin: 0 }}>POS Billing</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {branchInfo
              ? `${branchInfo.branchCode} · ${branchInfo.branchName}${branchInfo.branchState ? ` · ${branchInfo.branchState}` : ""}`
              : "Counter sale"}
          </Text>
        </div>
      </div>
      <Space wrap>
        {!isMobile && (
          <Tag icon={<BarcodeOutlined />} color="processing" style={{ margin: 0 }}>Scanner ready</Tag>
        )}
        <Tooltip title={`${cache.length.toLocaleString("en-IN")} items on this device`}>
          <Button icon={<SyncOutlined spin={syncing} />} onClick={syncItems} disabled={syncing}>
            {isPhone ? null : "Sync items"}
          </Button>
        </Tooltip>
      </Space>
    </div>
  );

  const itemsPane = (
    <Card style={S.card} bodyStyle={{ padding: isPhone ? 12 : 16 }}>
      <ItemPicker
        ref={searchRef}
        items={cache}
        recent={recent}
        qtyById={qtyById}
        onPick={(it) => addItem(it)}
        onCode={addByCode}
        onScan={() => setScanOpen(true)}
        accent={ACCENT}
        accentBg="#e6f4ff"
        isPhone={isPhone}
        isMobile={isMobile}
        maxHeight="calc(100vh - 290px)"
      />
    </Card>
  );

  const customerSection = (
    <div style={{ marginTop: 12 }}>
      <Button
        type="link" size="small" icon={<UserOutlined />} style={{ padding: 0 }}
        onClick={() => setDetailsOpen((o) => !o)}
      >
        {customer && customer !== "POS" ? customer : "Walk-in customer"}
        {customerMobile ? ` · ${customerMobile}` : ""}
        <span style={{ color: "rgba(0,0,0,0.45)", marginLeft: 6 }}>{detailsOpen ? "Hide" : "Edit"}</span>
      </Button>
      {detailsOpen && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 10, marginTop: 8 }}>
          <div>
            <div style={S.label}>Customer</div>
            <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" />
          </div>
          <div>
            <div style={S.label}>Mobile</div>
            <Input value={customerMobile} onChange={(e) => setCustomerMobile(e.target.value)} placeholder="Optional" inputMode="tel" maxLength={15} />
          </div>
          <div>
            <div style={S.label}>Voucher no</div>
            <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="Auto" />
          </div>
          <div>
            <div style={S.label}>Date</div>
            <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );

  const billPane = (
    <Card style={S.card} bodyStyle={{ padding: isPhone ? 12 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Space size={6}>
          <Text strong style={{ fontSize: 15 }}>Bill</Text>
          {items.length > 0 && <Tag style={{ margin: 0 }}>{items.length}</Tag>}
        </Space>
        {items.length > 0 && (
          <Button type="text" danger size="small" icon={<ClearOutlined />} onClick={confirmClear}>Clear</Button>
        )}
      </div>

      {!items.length ? (
        <Empty
          image={<ShoppingCartOutlined style={{ fontSize: 40, color: "#bfbfbf" }} />}
          imageStyle={{ height: 44 }}
          description={
            <span>
              No items yet
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {isMobile ? "Tap items to add them" : "Tap items, search, or scan a barcode"}
              </Text>
            </span>
          }
          style={{ padding: "20px 0" }}
        />
      ) : (
        <div style={{ maxHeight: isMobile ? "none" : "calc(100vh - 560px)", minHeight: isMobile ? 0 : 120, overflowY: isMobile ? "visible" : "auto" }}>
          {items.map(lineRow)}
        </div>
      )}

      {customerSection}

      <div style={{ ...S.totalBox, marginTop: 12 }}>
        <div style={S.statRow}><span>{items.length} item{items.length === 1 ? "" : "s"}</span><span>Qty {totalQty}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 14, opacity: 0.9 }}>Total</span>
          <span style={{ fontSize: 28, fontWeight: 700 }}>{inr(totalAmount)}</span>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={S.label}>Cash received</div>
        <InputNumber
          size="large"
          style={{ width: "100%" }}
          prefix="₹"
          min={0}
          precision={2}
          inputMode="decimal"
          controls={false}
          placeholder={totalAmount > 0 ? `${totalAmount.toFixed(2)} (exact)` : "0.00"}
          value={tendered}
          onChange={setTendered}
          onKeyDown={(e) => {
            if (["e", "E", "+", "-", ","].includes(e.key)) e.preventDefault();
          }}
        />
      </div>

      {quickTender.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {quickTender.map((v, i) => (
            <Button key={v} size="small" onClick={() => setTendered(v)} type={Number(tendered) === v ? "primary" : "default"} ghost={Number(tendered) === v}>
              {i === 0 ? "Exact" : `₹${v.toLocaleString("en-IN")}`}
            </Button>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          background: isDue ? "#fff1f0" : "#f6ffed",
          border: `1px solid ${isDue ? "#ffccc7" : "#b7eb8f"}`,
          borderRadius: 8,
          padding: "8px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ color: isDue ? "#cf1322" : "#389e0d" }}>{isDue ? "Balance due" : "Change to return"}</Text>
        <Text strong style={{ fontSize: 20, color: isDue ? "#cf1322" : "#389e0d" }}>{inr(Math.abs(balance))}</Text>
      </div>

      {!isMobile && (
        <Button
          type="primary" size="large" block icon={<SaveOutlined />} loading={saving} disabled={!items.length}
          onClick={handleSave} style={{ marginTop: 12, height: 48, fontSize: 16 }}
        >
          Save & Print
        </Button>
      )}
    </Card>
  );

  return (
    <div style={S.shell}>
      <div style={{ ...S.page, padding: isPhone ? 12 : 16, paddingBottom: isMobile ? 96 : 16 }}>
        {header}

        {isMobile ? (
          <>
            <Segmented
              block
              value={mobilePane}
              onChange={setMobilePane}
              style={{ marginBottom: 12 }}
              options={[
                { value: "Items", label: "Items" },
                {
                  value: "Bill",
                  label: <span>Bill {items.length ? <Badge count={items.length} size="small" style={{ background: ACCENT }} /> : null}</span>,
                },
              ]}
            />
            {mobilePane === "Items" ? itemsPane : billPane}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 420px", gap: 16, alignItems: "start" }}>
            {itemsPane}
            <div style={{ position: "sticky", top: 16 }}>{billPane}</div>
          </div>
        )}
      </div>

      {/* Hidden print DOM */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, width: "80mm", background: "white", zIndex: -1 }}>
        <InvoicePrint ref={printContentRef} bill={billToPrint} ml={printPack} />
      </div>

      {/* Preview */}
      <Modal
        title={
          <Space>
            <SaveOutlined />
            Invoice saved
            {billToPrint?.voucherNumber && <Tag color="success">Bill {billToPrint.voucherNumber}</Tag>}
          </Space>
        }
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setBillToPrint(null);
        }}
        // Centered on phones: a modal pinned to the top slides under the app bar.
        width={isPhone ? "calc(100vw - 16px)" : 520}
        centered={isPhone}
        footer={[
          <Button key="cancel" onClick={() => setPreviewOpen(false)}>Close</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleConfirmPrint}>Print invoice</Button>,
        ]}
      >
        {billToPrint ? (
          <div
            style={{
              maxHeight: "70vh", overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 8, padding: 12,
              background: "#fafafa", display: "flex", justifyContent: "center",
            }}
          >
            <div style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
              <InvoicePrint bill={billToPrint} ml={printPack} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading invoice...</p>
          </div>
        )}
      </Modal>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          focusSearch();
        }}
        onDetected={(code) => {
          setScanOpen(false);
          if (!addByCode(code)) message.error("Item not found");
        }}
      />

      {/* Phones and tablets: total and Save always in reach */}
      {isMobile && (
        <div style={{ ...S.bottomBar, left: screens.sm ? 240 : 0 }}>
          <button
            type="button"
            onClick={() => setMobilePane("Bill")}
            style={{ minWidth: 0, background: "none", border: 0, padding: 0, textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
          >
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              {items.length} item{items.length === 1 ? "" : "s"} · {mobilePane === "Items" ? "View bill" : "Total"}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{inr(totalAmount)}</div>
          </button>
          <Button
            type="primary" size="large" icon={<SaveOutlined />} onClick={handleSave}
            loading={saving} disabled={!items.length} style={{ minWidth: 150 }}
          >
            Save & Print
          </Button>
        </div>
      )}
    </div>
  );
};

export default POSEntry;
