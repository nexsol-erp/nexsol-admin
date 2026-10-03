import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Form, Input, Button, Select, Table, Typography, Space, InputNumber, message, Spin,
  Modal, Checkbox, Card, Result, Row, Col, Grid, Segmented, Tag, Avatar, Divider, Empty,
} from "antd";
import {
  DeleteOutlined, PlusOutlined, MinusOutlined, SearchOutlined, UserAddOutlined, PhoneOutlined,
  EnvironmentOutlined, SaveOutlined, PrinterOutlined, EditOutlined, CloseOutlined,
} from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { getItems } from "../services/apiservice";
import { useBranch } from "./BranchContext";
import { taxInvoiceHtml } from "./salesEntry/taxInvoiceHtml";
import usePrintPack from "../multilanguage/usePrintPack";
import useInvoiceTemplate from "../invoiceDesign/useInvoiceTemplate";
import { renderInvoiceHtml } from "../invoiceDesign/renderInvoice";
import { fromSalesInvoice } from "../invoiceDesign/invoiceModel";
import { printHtml } from "../invoiceDesign/printHtml";

const { Title, Text } = Typography;

// First two digits of a GSTIN are the state code. Used to fill the state on a new customer and to
// decide CGST + SGST versus IGST. The backend makes the same decision when it saves the invoice.
const GST_STATES = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
  "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
};
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const PAY_MODES = ["CASH", "UPI", "CARD"];
const PAY_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card" };

const gstStateCode = (gstin) => {
  const g = (gstin || "").trim();
  return /^[0-9]{2}/.test(g) ? g.slice(0, 2) : null;
};
const norm = (s) => (s || "").trim().toUpperCase() || null;

function isInterState(customer, branch) {
  if (!customer || !branch) return false;
  const c = gstStateCode(customer.gst);
  const b = gstStateCode(branch.branchGst);
  if (c && b) return c !== b;
  const cs = norm(customer.state);
  const bs = norm(branch.branchState);
  if (cs && bs) return cs !== bs;
  return false;
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => r2(n).toFixed(2);
const inr = (n) => `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const S = {
  page: { padding: 16, maxWidth: 1280, margin: "0 auto" },
  header: {
    display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    gap: 12, marginBottom: 16,
  },
  // A grid track of minmax(0, 1fr) keeps long selected labels from widening the page on phones.
  stack: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 },
  card: { borderRadius: 10, minWidth: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  step: {
    display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22,
    borderRadius: "50%", background: "#1677ff", color: "#fff", fontSize: 12, fontWeight: 600,
  },
  label: { fontSize: 12, color: "rgba(0,0,0,0.55)", marginBottom: 4 },
  addressBox: {
    background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 6, padding: "6px 10px",
    minHeight: 54, whiteSpace: "pre-wrap",
  },
  lineCard: { border: "1px solid #f0f0f0", borderRadius: 8, padding: 10, marginBottom: 8, background: "#fff" },
  bottomBar: {
    position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000, background: "#fff",
    borderTop: "1px solid #e5e5e5", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", color: "#111",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
  },
};

function calcLine(line) {
  const amount = r2(line.qty * line.rate);
  const taxable = r2((amount * 100) / (100 + (line.taxRate || 0)));
  return { ...line, amount, taxable, tax: r2(amount - taxable) };
}

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
  "Content-Type": "application/json",
});
const api = (path) => `/api/${localStorage.getItem("tenancyId")}${path}`;

// With an Invoice Designer template for sales invoices, print that; otherwise the built-in A4 invoice.
function printTaxInvoice(inv, ml, template, branch) {
  if (template) {
    printHtml(renderInvoiceHtml(template, fromSalesInvoice(inv, branch), ml));
    return;
  }
  const html = taxInvoiceHtml(inv, ml);
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
}

const emptyPayments = { CASH: 0, UPI: 0, CARD: 0 };
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// Picks a saved web invoice to edit: search by number, customer or mobile within a date range.
function EditInvoicePicker({ open, onClose, onPick, branchCode, isMobile }) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setBusy(true);
    const q = new URLSearchParams({ fromDate: from, toDate: to, search, branchCode: branchCode || "" });
    fetch(api(`/sales/web-invoices?${q}`), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => message.error("Couldn't load invoices"))
      .finally(() => setBusy(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load(); }, [open, branchCode]);

  return (
    <Modal open={open} title="Edit an invoice" footer={null} onCancel={onClose} destroyOnClose
      width={isMobile ? "100%" : 720} style={isMobile ? { top: 0, maxWidth: "100vw", margin: 0, paddingBottom: 0 } : undefined}>
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={10}>
          <Input allowClear prefix={<SearchOutlined />} placeholder="Invoice no., customer or mobile"
            value={search} onChange={(e) => setSearch(e.target.value)} onPressEnter={load} />
        </Col>
        <Col xs={12} md={5}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /></Col>
        <Col xs={12} md={5}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" /></Col>
        <Col xs={24} md={4}><Button block type="primary" onClick={load} loading={busy}>Search</Button></Col>
      </Row>
      <Table size="small" rowKey="id" loading={busy} dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: "No web invoices in these dates" }}
        onRow={(r) => ({ onClick: () => onPick(r.id), style: { cursor: "pointer" } })}
        columns={[
          { title: "Invoice", dataIndex: "voucherNumber", render: (v, r) => (<><div style={{ fontWeight: 500 }}>{v}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{String(r.voucherDate || "").slice(0, 10)} · {r.branchCode}</Text></>) },
          { title: "Customer", dataIndex: "customerName", responsive: ["sm"] },
          { title: "Total", dataIndex: "totalAmount", align: "right", render: inr },
          { width: 40, render: () => <EditOutlined style={{ color: "#1677ff" }} /> },
        ]} />
    </Modal>
  );
}

const SalesEntryForm = () => {
  const { branch: branchCode, setBranch, branches } = useBranch();
  const printPack = usePrintPack(branchCode);
  const invoiceTemplate = useInvoiceTemplate("SALES");
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  const [customerForm] = Form.useForm();
  const qtyRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");

  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [lines, setLines] = useState([]);
  const [pick, setPick] = useState({ item: null, qty: 1, rate: null });
  const [credit, setCredit] = useState(false);
  const [payments, setPayments] = useState(emptyPayments);

  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  // The saved invoice being edited ({ id, voucherNumber, voucherDate, branchCode, allocatedAmount }), or null for a new one.
  const [editing, setEditing] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    Promise.all([
      getItems().then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => message.error("Couldn't load items")),
      loadCustomers(),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = searchParams.get("edit");
    if (id) loadForEdit(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loads a saved invoice into the form. Number, date and branch can't change; the server says why
  // an invoice can't be edited at all (e-invoice already sent, sales return made...).
  const loadForEdit = async (id) => {
    setPickerOpen(false);
    setLoading(true);
    try {
      const res = await fetch(api(`/sales/web-invoice/${encodeURIComponent(id)}`), { headers: authHeaders() });
      const inv = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(inv.message || "Couldn't load the invoice");
        return;
      }
      if (inv.editBlockedReason) {
        Modal.warning({ title: `Invoice ${inv.voucherNumber} can't be edited`, content: inv.editBlockedReason });
        return;
      }
      const pay = { ...emptyPayments };
      (inv.payments || []).forEach((p) => {
        const m = (p.receiptMode || "").toUpperCase();
        if (m in pay) pay[m] = r2(pay[m] + Number(p.amount || 0));
        else pay.CASH = r2(pay.CASH + Number(p.amount || 0));
      });
      setSavedInvoice(null);
      setEditing({
        id: inv.id, voucherNumber: inv.voucherNumber, voucherDate: inv.voucherDate,
        branchCode: inv.branchCode, allocatedAmount: Number(inv.allocatedAmount) || 0,
      });
      setCustomerId(inv.customerId);
      setDeliveryAddress(inv.deliveryAddress || "");
      setLines((inv.lines || []).map((l, i) => ({
        key: `${l.itemId}-${i}`,
        itemId: l.itemId, itemName: l.itemName, itemCode: l.itemCode, barcode: l.barcode, unit: l.unit,
        hsnCode: l.hsnCode, taxRate: Number(l.taxRate) || 0, qty: Number(l.qty) || 0, rate: Number(l.rate) || 0,
      })));
      setCredit(!!inv.credit);
      setPayments(pay);
      setSearchParams({ edit: inv.id }, { replace: true });
    } catch (e) {
      console.error(e);
      message.error("Couldn't load the invoice");
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    resetInvoice();
  };

  const loadCustomers = () =>
    fetch(api("/customers"), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => message.error("Couldn't load customers"));

  const customer = useMemo(() => customers.find((c) => c.id === customerId) || null, [customers, customerId]);
  // An invoice being edited keeps its own branch, whatever branch is picked at the top of the app.
  const billBranchCode = editing ? editing.branchCode : branchCode;
  const branch = useMemo(() => branches.find((b) => b.branchCode === billBranchCode) || null, [branches, billBranchCode]);
  const interState = isInterState(customer, branch);

  const calcLines = useMemo(() => lines.map(calcLine), [lines]);
  const totals = useMemo(() => {
    const t = calcLines.reduce((a, l) => ({
      taxable: a.taxable + l.taxable, tax: a.tax + l.tax, total: a.total + l.amount,
    }), { taxable: 0, tax: 0, total: 0 });
    return { taxable: r2(t.taxable), tax: r2(t.tax), total: r2(t.total) };
  }, [calcLines]);
  const paid = r2(PAY_MODES.reduce((s, m) => s + (Number(payments[m]) || 0), 0));
  const balance = r2(totals.total - paid);

  const selectCustomer = (id) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    setDeliveryAddress(c ? (c.deliveryAddress || c.address || "") : "");
  };

  const customerOptions = useMemo(() => customers
    .filter((c) => c.name && c.name !== "POS")
    .map((c) => ({
      value: c.id,
      label: [c.name, c.gst, c.mobile].filter(Boolean).join(" · "),
    })), [customers]);

  const itemOptions = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const list = q
      ? items.filter((i) =>
          (i.itemName || "").toLowerCase().includes(q) ||
          (i.barcode || "").toLowerCase() === q ||
          (i.itemCode || "").toLowerCase() === q)
      : items;
    return list.slice(0, 50).map((i) => ({ value: i.id, label: i.itemName }));
  }, [items, itemSearch]);

  const pickItem = (id) => {
    const it = items.find((i) => i.id === id);
    if (!it) return;
    setPick({ item: it, qty: 1, rate: it.standardPrice ?? 0 });
    setTimeout(() => qtyRef.current?.focus(), 0);
  };

  const addLine = () => {
    const { item, qty, rate } = pick;
    if (!item) return message.warning("Pick an item");
    if (!(qty > 0)) return message.warning("Quantity must be more than zero");
    if (rate == null || rate < 0) return message.warning("Enter a rate");
    setLines((prev) => [...prev, {
      key: `${item.id}-${Date.now()}`,
      itemId: item.itemId || item.id,
      itemName: item.itemName,
      itemCode: item.itemCode,
      barcode: item.barcode,
      unit: item.unitId,
      hsnCode: item.hsnCode,
      taxRate: Number(item.taxRate) || 0,
      qty,
      rate,
    }]);
    setPick({ item: null, qty: 1, rate: null });
    setItemSearch("");
  };

  const updateLine = (key, patch) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const fillRest = (mode) => {
    const others = PAY_MODES.filter((m) => m !== mode).reduce((s, m) => s + (Number(payments[m]) || 0), 0);
    setPayments({ ...payments, [mode]: Math.max(0, r2(totals.total - others)) });
  };

  const createCustomer = async () => {
    const v = await customerForm.validateFields();
    const body = {
      name: v.name.trim(),
      gst: (v.gst || "").trim().toUpperCase() || null,
      mobile: (v.mobile || "").trim() || null,
      state: v.state || null,
      country: "India",
      address: v.address || null,
      deliveryAddress: v.sameAsBilling ? (v.address || null) : (v.deliveryAddress || null),
    };
    const res = await fetch(api("/customers"), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      message.error(data.message || "Couldn't create the customer");
      return;
    }
    setCustomers((prev) => [...prev, data]);
    setCustomerId(data.id);
    setDeliveryAddress(data.deliveryAddress || data.address || "");
    setNewCustomerOpen(false);
    customerForm.resetFields();
    message.success(`Customer ${data.name} added`);
  };

  const resetInvoice = () => {
    setSavedInvoice(null);
    setEditing(null);
    if (searchParams.get("edit")) setSearchParams({}, { replace: true });
    setCustomerId(null);
    setDeliveryAddress("");
    setLines([]);
    setCredit(false);
    setPayments(emptyPayments);
  };

  const save = async () => {
    if (!billBranchCode) return message.warning("Select a branch");
    if (!customer) return message.warning("Select or add a customer");
    if (!lines.length) return message.warning("Add at least one item");
    if (paid - totals.total > 0.01) return message.warning("Payment is more than the invoice total");
    if (!credit && Math.abs(balance) > 0.01) {
      return message.warning(`Payment ${money(paid)} doesn't match the total ${money(totals.total)}. Choose Credit to leave a balance.`);
    }

    setSaving(true);
    try {
      const body = {
        branchCode: billBranchCode,
        voucherDate: editing ? editing.voucherDate : voucherDate,
        customerId: customer.id,
        deliveryAddress,
        credit,
        lines: lines.map(({ itemId, itemName, itemCode, barcode, unit, qty, rate, taxRate }) =>
          ({ itemId, itemName, itemCode, barcode, unit, qty, rate, taxRate })),
        payments: PAY_MODES.filter((m) => Number(payments[m]) > 0).map((m) => ({ receiptMode: m, amount: r2(payments[m]) })),
      };
      const res = editing
        ? await fetch(api(`/sales/web-invoice/${encodeURIComponent(editing.id)}`), { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) })
        : await fetch(api("/sales/web-invoice"), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.message || "Couldn't save the invoice");
        return;
      }
      setSavedInvoice({ ...data, edited: !!editing });
      setEditing(null);
      if (searchParams.get("edit")) setSearchParams({}, { replace: true });
      message.success(`Invoice ${data.voucherNumber} ${editing ? "updated" : "saved"}`);
    } catch (e) {
      console.error(e);
      message.error("Couldn't save the invoice");
    } finally {
      setSaving(false);
    }
  };

  const readiness = [
    !billBranchCode && "Select a branch",
    !customer && "Select or add a customer",
    !lines.length && "Add at least one item",
    paid - totals.total > 0.01 && "Payment is more than the total",
    !credit && lines.length > 0 && Math.abs(balance) > 0.01 && "Payment must equal the total, or choose Credit",
  ].filter(Boolean);
  const ready = readiness.length === 0;
  const cgst = r2(totals.tax / 2);
  const sgst = r2(totals.tax - cgst);
  const itemCount = lines.length;

  const removeLine = (key) => setLines((prev) => prev.filter((x) => x.key !== key));

  // ── pieces ────────────────────────────────────────────────────────────────
  const sectionTitle = (step, title, extra) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
      <Space size={10}>
        <span style={S.step}>{step}</span>
        <span style={{ fontWeight: 600 }}>{title}</span>
      </Space>
      {extra}
    </div>
  );

  const summaryRow = (label, value, opts = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", ...(opts.style || {}) }}>
      <Text type={opts.muted ? "secondary" : undefined} strong={opts.strong}>{label}</Text>
      <Text strong={opts.strong} type={opts.type} style={opts.valueStyle}>{value}</Text>
    </div>
  );

  const customerCard = (
    <Card size="small" style={S.card} title={sectionTitle(1, "Customer",
      <Button size="small" icon={<UserAddOutlined />} onClick={() => setNewCustomerOpen(true)}>
        {isMobile ? "New" : "New customer"}
      </Button>)}>
      <Select showSearch allowClear size="large" style={{ width: "100%" }}
        placeholder="Search by name, GSTIN or mobile" suffixIcon={<SearchOutlined />}
        value={customerId} onChange={selectCustomer} options={customerOptions} optionFilterProp="label" />
      {customer ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <Avatar size={44} style={{ background: "#1677ff", flexShrink: 0 }}>
              {(customer.name || "?").trim().charAt(0).toUpperCase()}
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{customer.name}</div>
              <Space size={[4, 4]} wrap style={{ marginTop: 4 }}>
                {customer.gst
                  ? <Tag color="blue">GSTIN {customer.gst}</Tag>
                  : <Tag>Unregistered</Tag>}
                {customer.state && <Tag>{customer.state}</Tag>}
                {customer.mobile && <Tag icon={<PhoneOutlined />}>{customer.mobile}</Tag>}
                <Tag color={interState ? "purple" : "green"}>{interState ? "IGST" : "CGST + SGST"}</Tag>
              </Space>
            </div>
          </div>
          <Row gutter={[16, 12]} style={{ marginTop: 14 }}>
            <Col xs={24} md={12}>
              <div style={S.label}>Billing address</div>
              <div style={S.addressBox}>{customer.address || <Text type="secondary">Not on file</Text>}</div>
            </Col>
            <Col xs={24} md={12}>
              <div style={S.label}><EnvironmentOutlined /> Delivery address</div>
              <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Where the goods go" />
            </Col>
          </Row>
        </div>
      ) : (
        <Text type="secondary" style={{ display: "block", marginTop: 10 }}>
          GST is worked out from the customer's state, so pick the customer first.
        </Text>
      )}
    </Card>
  );

  const itemPicker = (
    <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
      <Col xs={24} md={11}>
        <Select showSearch size="large" style={{ width: "100%" }} placeholder="Item name, barcode or code"
          suffixIcon={<SearchOutlined />} value={pick.item?.id} filterOption={false} onSearch={setItemSearch}
          onChange={pickItem} options={itemOptions} notFoundContent={itemSearch ? "No matching item" : null} />
      </Col>
      <Col xs={8} md={3}>
        <InputNumber ref={qtyRef} size="large" min={0.001} value={pick.qty} placeholder="Qty" style={{ width: "100%" }}
          inputMode="decimal" onChange={(q) => setPick({ ...pick, qty: q })} onPressEnter={addLine} />
      </Col>
      <Col xs={16} md={5}>
        <InputNumber size="large" min={0} value={pick.rate} placeholder="Rate incl. GST" style={{ width: "100%" }}
          prefix="₹" inputMode="decimal" onChange={(r) => setPick({ ...pick, rate: r })} onPressEnter={addLine} />
      </Col>
      <Col xs={24} md={5}>
        <Button size="large" type="primary" icon={<PlusOutlined />} block onClick={addLine} disabled={!pick.item}>
          Add{pick.item ? ` · GST ${pick.item.taxRate ?? 0}%` : ""}
        </Button>
      </Col>
    </Row>
  );

  const columns = [
    {
      title: "Item", dataIndex: "itemName",
      render: (v, l) => (<><div style={{ fontWeight: 500 }}>{v}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>{l.hsnCode ? `HSN ${l.hsnCode} · ` : ""}GST {l.taxRate}%</Text></>),
    },
    {
      title: "Qty", dataIndex: "qty", width: 100,
      render: (v, l) => <InputNumber min={0.001} value={v} style={{ width: 88 }}
        onChange={(q) => updateLine(l.key, { qty: q || 0 })} />,
    },
    {
      title: "Rate", dataIndex: "rate", width: 130,
      render: (v, l) => <InputNumber min={0} value={v} prefix="₹" style={{ width: 118 }}
        onChange={(r) => updateLine(l.key, { rate: r || 0 })} />,
    },
    { title: "Taxable", dataIndex: "taxable", width: 110, align: "right", render: inr },
    { title: interState ? "IGST" : "GST", dataIndex: "tax", width: 100, align: "right", render: inr },
    { title: "Amount", dataIndex: "amount", width: 120, align: "right", render: (v) => <b>{inr(v)}</b> },
    {
      width: 48,
      render: (_, l) => <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove item"
        onClick={() => removeLine(l.key)} />,
    },
  ];

  const mobileLines = (
    <div>
      {calcLines.map((l) => (
        <div key={l.key} style={S.lineCard}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{l.itemName}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {l.hsnCode ? `HSN ${l.hsnCode} · ` : ""}GST {l.taxRate}% · tax {inr(l.tax)}
              </Text>
            </div>
            <Button type="text" danger icon={<DeleteOutlined />} aria-label="Remove item" onClick={() => removeLine(l.key)} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <Space.Compact>
              <Button icon={<MinusOutlined />} aria-label="Less"
                onClick={() => updateLine(l.key, { qty: Math.max(1, r2(l.qty - 1)) })} />
              <InputNumber min={0.001} value={l.qty} controls={false} inputMode="decimal"
                style={{ width: 56, textAlign: "center" }} onChange={(q) => updateLine(l.key, { qty: q || 0 })} />
              <Button icon={<PlusOutlined />} aria-label="More" onClick={() => updateLine(l.key, { qty: r2(l.qty + 1) })} />
            </Space.Compact>
            <Text type="secondary">×</Text>
            <InputNumber min={0} value={l.rate} prefix="₹" controls={false} inputMode="decimal"
              style={{ flex: 1, minWidth: 0 }} onChange={(r) => updateLine(l.key, { rate: r || 0 })} />
            <Text strong style={{ minWidth: 80, textAlign: "right" }}>{inr(l.amount)}</Text>
          </div>
        </div>
      ))}
    </div>
  );

  const itemsCard = (
    <Card size="small" style={S.card} title={sectionTitle(2, "Items",
      itemCount > 0 && <Text type="secondary">{itemCount} item{itemCount > 1 ? "s" : ""}</Text>)}>
      {itemPicker}
      {calcLines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No items yet. Search above to add one." />
      ) : isMobile ? mobileLines : (
        <Table size="middle" columns={columns} dataSource={calcLines} rowKey="key" pagination={false} />
      )}
    </Card>
  );

  const paymentCard = (
    <Card size="small" style={S.card} title={sectionTitle(3, "Payment")}>
      <Segmented block size="large" value={credit ? "credit" : "paid"}
        onChange={(v) => setCredit(v === "credit")}
        options={[{ label: "Paid in full", value: "paid" }, { label: "Credit", value: "credit" }]} />
      <Text type="secondary" style={{ display: "block", margin: "10px 0 12px" }}>
        {credit
          ? "Enter any down payment. The rest goes on the customer's account and is collected from the Receipt screen."
          : "Split across Cash, UPI and Card if needed. Tap Rest to fill the balance."}
      </Text>
      {editing?.allocatedAmount > 0 && (
        <Text type="warning" style={{ display: "block", marginBottom: 12 }}>
          {inr(editing.allocatedAmount)} was already collected for this invoice on the Receipt screen, so keep at least that much on credit.
        </Text>
      )}
      {PAY_MODES.map((m) => (
        <div key={m} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 64, fontWeight: 500 }}>{PAY_LABELS[m]}</span>
          <InputNumber min={0} value={payments[m] || null} placeholder="0.00" prefix="₹" inputMode="decimal"
            style={{ flex: 1 }} onChange={(v) => setPayments({ ...payments, [m]: v || 0 })} />
          <Button onClick={() => fillRest(m)} disabled={!totals.total}>Rest</Button>
        </div>
      ))}
    </Card>
  );

  const summaryCard = (
    <Card size="small" style={S.card} title={<span style={{ fontWeight: 600 }}>Summary</span>}>
      {summaryRow("Taxable value", inr(totals.taxable), { muted: true })}
      {interState
        ? summaryRow("IGST", inr(totals.tax), { muted: true })
        : (<>{summaryRow("CGST", inr(cgst), { muted: true })}{summaryRow("SGST", inr(sgst), { muted: true })}</>)}
      <Divider style={{ margin: "8px 0" }} />
      {summaryRow("Invoice total", inr(totals.total), { strong: true, valueStyle: { fontSize: 22 } })}
      {summaryRow("Paid now", inr(paid), { muted: true })}
      {credit
        ? summaryRow("On credit", inr(Math.max(0, balance)), { strong: true, type: balance > 0 ? "warning" : undefined })
        : summaryRow("Balance", inr(balance), { type: Math.abs(balance) > 0.01 ? "danger" : "success" })}
      {!isMobile && (
        <>
          <Button type="primary" size="large" block icon={<SaveOutlined />} loading={saving}
            disabled={!ready} onClick={save} style={{ marginTop: 12 }}>{editing ? "Save changes" : "Save invoice"}</Button>
          {!ready && <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>{readiness[0]}</Text>}
        </>
      )}
    </Card>
  );

  if (savedInvoice) {
    const onCredit = savedInvoice.credit && Number(savedInvoice.balanceDue) > 0;
    return (
      <div style={{ ...S.page, maxWidth: 640 }}>
        <Card style={S.card}>
          <Result
            status="success"
            title={`Invoice ${savedInvoice.voucherNumber} ${savedInvoice.edited ? "updated" : "saved"}`}
            subTitle={savedInvoice.customerName}
            style={{ padding: isMobile ? "16px 0" : undefined }}
          />
          {summaryRow("Invoice total", inr(savedInvoice.totalAmount), { strong: true })}
          {summaryRow("Paid now", inr(savedInvoice.paidAmount), { muted: true })}
          {onCredit && summaryRow("On credit", inr(savedInvoice.balanceDue), { strong: true, type: "warning" })}
          <Row gutter={[8, 8]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12}>
              <Button type="primary" size="large" block icon={<PrinterOutlined />}
                onClick={() => printTaxInvoice(savedInvoice, printPack, invoiceTemplate,
                  branches.find((b) => b.branchCode === savedInvoice.branchCode))}>Print tax invoice</Button>
            </Col>
            <Col xs={24} sm={12}>
              <Button size="large" block icon={<PlusOutlined />} onClick={resetInvoice}>New invoice</Button>
            </Col>
            <Col xs={24}>
              <Button size="large" block type="link" icon={<EditOutlined />}
                onClick={() => loadForEdit(savedInvoice.id)}>Edit this invoice</Button>
            </Col>
          </Row>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ ...S.page, paddingBottom: isMobile ? 96 : S.page.padding }}>
      <div style={S.header}>
        <div>
          <Title level={isMobile ? 4 : 3} style={{ margin: 0, color: "inherit" }}>
            {editing ? `Edit invoice ${editing.voucherNumber}` : "Sales Entry"}
          </Title>
          <Text style={{ color: "inherit", opacity: 0.7 }}>
            {editing ? `${editing.branchCode} · ${editing.voucherDate} · number, date and branch stay the same` : "GST tax invoice"}
          </Text>
        </div>
        {editing ? (
          <Button icon={<CloseOutlined />} onClick={cancelEdit}>Cancel edit</Button>
        ) : (
        <div style={{ display: "flex", gap: 8, minWidth: 0, flex: isMobile ? "1 1 100%" : undefined, flexWrap: "wrap" }}>
          <Select style={{ minWidth: isMobile ? 0 : 220, flex: 1 }} value={branchCode || undefined}
            placeholder="Select branch" onChange={setBranch}
            options={branches.map((b) => ({ value: b.branchCode, label: b.branchName ? `${b.branchCode} — ${b.branchName}` : b.branchCode }))} />
          <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)}
            style={{ width: 150, flexShrink: 0 }} aria-label="Invoice date" />
          <Button icon={<EditOutlined />} onClick={() => setPickerOpen(true)}>{isMobile ? "Edit" : "Edit an invoice"}</Button>
        </div>
        )}
      </div>

      <EditInvoicePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={loadForEdit}
        branchCode={branchCode} isMobile={isMobile} />

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={16}>
            <div style={S.stack}>
              {customerCard}
              {itemsCard}
              {isMobile && paymentCard}
              {isMobile && summaryCard}
            </div>
          </Col>
          {!isMobile && (
            <Col xs={24} lg={8}>
              <div style={{ position: "sticky", top: 80 }}>
                <div style={S.stack}>
                  {summaryCard}
                  {paymentCard}
                </div>
              </div>
            </Col>
          )}
        </Row>
      </Spin>

      {isMobile && (
        <div style={{ ...S.bottomBar, left: screens.sm ? 240 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              {ready ? (credit && balance > 0.01 ? `${inr(balance)} on credit` : "Total") : readiness[0]}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{inr(totals.total)}</div>
          </div>
          <Button type="primary" size="large" icon={<SaveOutlined />} loading={saving} disabled={!ready} onClick={save}>
            {editing ? "Save changes" : "Save"}
          </Button>
        </div>
      )}

      <Modal open={newCustomerOpen} title="New customer" okText="Add customer"
        onOk={createCustomer} onCancel={() => setNewCustomerOpen(false)} destroyOnClose
        width={isMobile ? "100%" : 560} style={isMobile ? { top: 0, maxWidth: "100vw", margin: 0, paddingBottom: 0 } : undefined}>
        <Form form={customerForm} layout="vertical" initialValues={{ sameAsBilling: true }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: "Enter the customer's name" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item name="gst" label="GSTIN" normalize={(v) => (v || "").toUpperCase().replace(/\s/g, "")}
            rules={[{ validator: (_, v) => (!v || GSTIN_RE.test(v) ? Promise.resolve() : Promise.reject(new Error("Not a valid GSTIN"))) }]}>
            <Input size="large" placeholder="Leave empty for an unregistered customer" maxLength={15}
              onChange={(e) => {
                const st = GST_STATES[gstStateCode(e.target.value.toUpperCase())];
                if (st) customerForm.setFieldsValue({ state: st });
              }} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="mobile" label="Mobile" rules={[{ pattern: /^[0-9+ ]{0,15}$/, message: "Digits only" }]}>
                <Input size="large" maxLength={15} inputMode="tel" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="state" label="State" rules={[{ required: true, message: "Pick the state (decides IGST)" }]}>
                <Select size="large" showSearch options={Object.values(GST_STATES).sort().map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="address" label="Billing address">
            <Input.TextArea autoSize={{ minRows: 2 }} maxLength={255} />
          </Form.Item>
          <Form.Item name="sameAsBilling" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Checkbox>Deliver to the billing address</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(a, b) => a.sameAsBilling !== b.sameAsBilling}>
            {({ getFieldValue }) => !getFieldValue("sameAsBilling") && (
              <Form.Item name="deliveryAddress" label="Delivery address">
                <Input.TextArea autoSize={{ minRows: 2 }} maxLength={500} />
              </Form.Item>
            )}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SalesEntryForm;
