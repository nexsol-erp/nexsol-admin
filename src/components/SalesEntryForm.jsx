import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Form, Input, Button, Select, Table, Typography, Space, InputNumber, message, Spin,
  Modal, Radio, Checkbox, Card, Descriptions, Result, Row, Col, Alert,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { getItems } from "../services/apiservice";
import { useBranch } from "./BranchContext";

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

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function printTaxInvoice(inv) {
  const td = (v, align = "left") => `<td style="border:1px solid #ccc;padding:4px 6px;text-align:${align};">${v}</td>`;
  const th = (v, align = "left") => `<th style="border:1px solid #ccc;padding:4px 6px;text-align:${align};background:#f3f3f3;">${v}</th>`;
  const rows = inv.lines.map((l, i) => `<tr>
      ${td(i + 1, "center")}${td(esc(l.itemName))}${td(esc(l.hsnCode || ""))}
      ${td(l.qty, "right")}${td(money(l.rate), "right")}${td(money(l.taxableAmount), "right")}
      ${td(`${l.taxRate}%`, "right")}${td(money(l.taxAmount), "right")}${td(money(l.amount), "right")}
    </tr>`).join("");
  const taxRows = inv.interState
    ? `<tr><td>IGST</td><td style="text-align:right;">${money(inv.igstAmount)}</td></tr>`
    : `<tr><td>CGST</td><td style="text-align:right;">${money(inv.cgstAmount)}</td></tr>
       <tr><td>SGST</td><td style="text-align:right;">${money(inv.sgstAmount)}</td></tr>`;
  const payRows = (inv.payments || []).map((p) =>
    `<tr><td>Paid by ${esc(PAY_LABELS[p.receiptMode] || p.receiptMode)}</td><td style="text-align:right;">${money(p.amount)}</td></tr>`).join("");
  const addr = (s) => esc(s || "").replace(/\n/g, "<br>");

  const html = `<!doctype html><html><head><title>Tax Invoice ${esc(inv.voucherNumber)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}
    h2{text-align:center;margin:0 0 12px}
    table{border-collapse:collapse;width:100%}
    .parties td{vertical-align:top;border:1px solid #ccc;padding:6px 8px;width:33%}
    .totals{width:320px;margin-left:auto;margin-top:10px}
    .totals td{padding:3px 6px}
    .grand td{font-weight:bold;border-top:1px solid #333}
  </style></head><body>
    <h2>TAX INVOICE${inv.credit ? " (CREDIT)" : ""}</h2>
    <table class="parties"><tr>
      <td><b>${esc(inv.branchName || inv.branchCode)}</b><br>${addr(inv.branchAddress)}
          ${inv.branchState ? `<br>State: ${esc(inv.branchState)}` : ""}
          ${inv.branchGst ? `<br>GSTIN: <b>${esc(inv.branchGst)}</b>` : ""}</td>
      <td><b>Invoice No:</b> ${esc(inv.voucherNumber)}<br><b>Date:</b> ${esc(inv.voucherDate)}
          <br><b>Place of supply:</b> ${esc(inv.customerState || inv.branchState || "")}
          <br><b>Tax:</b> ${inv.interState ? "IGST (inter-state)" : "CGST + SGST"}</td>
      <td></td>
    </tr><tr>
      <td><b>Bill to</b><br><b>${esc(inv.customerName)}</b><br>${addr(inv.billingAddress)}
          ${inv.customerState ? `<br>State: ${esc(inv.customerState)}` : ""}
          ${inv.customerGst ? `<br>GSTIN: <b>${esc(inv.customerGst)}</b>` : "<br>Unregistered"}
          ${inv.customerMobile ? `<br>Mobile: ${esc(inv.customerMobile)}` : ""}</td>
      <td colspan="2"><b>Ship to</b><br>${addr(inv.deliveryAddress || inv.billingAddress)}</td>
    </tr></table>
    <table style="margin-top:10px"><thead><tr>
      ${th("#")}${th("Item")}${th("HSN")}${th("Qty", "right")}${th("Rate", "right")}
      ${th("Taxable", "right")}${th("GST", "right")}${th("Tax", "right")}${th("Amount", "right")}
    </tr></thead><tbody>${rows}</tbody></table>
    <table class="totals">
      <tr><td>Taxable value</td><td style="text-align:right;">${money(inv.taxableAmount)}</td></tr>
      ${taxRows}
      <tr class="grand"><td>Invoice total</td><td style="text-align:right;">${money(inv.totalAmount)}</td></tr>
      ${payRows}
      ${inv.credit ? `<tr class="grand"><td>Balance due</td><td style="text-align:right;">${money(inv.balanceDue)}</td></tr>` : ""}
    </table>
  </body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
}

const emptyPayments = { CASH: 0, UPI: 0, CARD: 0 };

const SalesEntryForm = () => {
  const { branch: branchCode, setBranch, branches } = useBranch();
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

  useEffect(() => {
    Promise.all([
      getItems().then((r) => setItems(Array.isArray(r.data) ? r.data : [])).catch(() => message.error("Couldn't load items")),
      loadCustomers(),
    ]).finally(() => setLoading(false));
  }, []);

  const loadCustomers = () =>
    fetch(api("/customers"), { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch(() => message.error("Couldn't load customers"));

  const customer = useMemo(() => customers.find((c) => c.id === customerId) || null, [customers, customerId]);
  const branch = useMemo(() => branches.find((b) => b.branchCode === branchCode) || null, [branches, branchCode]);
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
    setCustomerId(null);
    setDeliveryAddress("");
    setLines([]);
    setCredit(false);
    setPayments(emptyPayments);
  };

  const save = async () => {
    if (!branchCode) return message.warning("Select a branch");
    if (!customer) return message.warning("Select or add a customer");
    if (!lines.length) return message.warning("Add at least one item");
    if (paid - totals.total > 0.01) return message.warning("Payment is more than the invoice total");
    if (!credit && Math.abs(balance) > 0.01) {
      return message.warning(`Payment ${money(paid)} doesn't match the total ${money(totals.total)}. Choose Credit to leave a balance.`);
    }

    setSaving(true);
    try {
      const body = {
        branchCode,
        voucherDate,
        customerId: customer.id,
        deliveryAddress,
        credit,
        lines: lines.map(({ itemId, itemName, itemCode, barcode, unit, qty, rate, taxRate }) =>
          ({ itemId, itemName, itemCode, barcode, unit, qty, rate, taxRate })),
        payments: PAY_MODES.filter((m) => Number(payments[m]) > 0).map((m) => ({ receiptMode: m, amount: r2(payments[m]) })),
      };
      const res = await fetch(api("/sales/web-invoice"), { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        message.error(data.message || "Couldn't save the invoice");
        return;
      }
      setSavedInvoice(data);
      message.success(`Invoice ${data.voucherNumber} saved`);
    } catch (e) {
      console.error(e);
      message.error("Couldn't save the invoice");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: "Item", dataIndex: "itemName" },
    { title: "HSN", dataIndex: "hsnCode", width: 90 },
    {
      title: "Qty", dataIndex: "qty", width: 90,
      render: (v, l) => <InputNumber min={0.001} value={v} size="small" style={{ width: 80 }}
        onChange={(q) => updateLine(l.key, { qty: q || 0 })} />,
    },
    {
      title: "Rate (incl. GST)", dataIndex: "rate", width: 120,
      render: (v, l) => <InputNumber min={0} value={v} size="small" style={{ width: 105 }}
        onChange={(r) => updateLine(l.key, { rate: r || 0 })} />,
    },
    { title: "GST %", dataIndex: "taxRate", width: 70, align: "right" },
    { title: "Taxable", dataIndex: "taxable", width: 100, align: "right", render: money },
    { title: interState ? "IGST" : "CGST + SGST", dataIndex: "tax", width: 100, align: "right", render: money },
    { title: "Amount", dataIndex: "amount", width: 100, align: "right", render: money },
    {
      width: 50,
      render: (_, l) => <Button size="small" danger icon={<DeleteOutlined />}
        onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} />,
    },
  ];

  if (savedInvoice) {
    return (
      <div style={{ padding: 24, maxWidth: 900, margin: "auto" }}>
        <Result
          status="success"
          title={`Invoice ${savedInvoice.voucherNumber} saved`}
          subTitle={savedInvoice.credit && Number(savedInvoice.balanceDue) > 0
            ? `${savedInvoice.customerName}: total ₹${money(savedInvoice.totalAmount)}, paid ₹${money(savedInvoice.paidAmount)}, ₹${money(savedInvoice.balanceDue)} on credit`
            : `${savedInvoice.customerName}: ₹${money(savedInvoice.totalAmount)} paid in full`}
          extra={[
            <Button key="print" type="primary" onClick={() => printTaxInvoice(savedInvoice)}>Print tax invoice</Button>,
            <Button key="new" onClick={resetInvoice}>New invoice</Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "auto" }}>
      <Title level={3} style={{ marginBottom: 16, color: "inherit" }}>Sales Entry</Title>
      <Spin spinning={loading}>
        <Card size="small" style={{ marginBottom: 12 }}>
          <Row gutter={12}>
            <Col xs={24} md={8}>
              <Text type="secondary">Branch</Text>
              <Select style={{ width: "100%" }} value={branchCode || undefined} placeholder="Select branch"
                onChange={setBranch}
                options={branches.map((b) => ({ value: b.branchCode, label: b.branchName ? `${b.branchCode} — ${b.branchName}` : b.branchCode }))} />
            </Col>
            <Col xs={24} md={6}>
              <Text type="secondary">Invoice date</Text>
              <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
            </Col>
          </Row>
        </Card>

        <Card size="small" title="Customer" style={{ marginBottom: 12 }}
          extra={<Button onClick={() => setNewCustomerOpen(true)}>New customer</Button>}>
          <Select showSearch allowClear style={{ width: "100%" }} placeholder="Search by name, GSTIN or mobile"
            value={customerId} onChange={selectCustomer} options={customerOptions} optionFilterProp="label" />
          {customer && (
            <>
              <Descriptions size="small" column={{ xs: 1, md: 3 }} style={{ marginTop: 12 }}>
                <Descriptions.Item label="GSTIN">{customer.gst || "Unregistered"}</Descriptions.Item>
                <Descriptions.Item label="State">{customer.state || "—"}</Descriptions.Item>
                <Descriptions.Item label="Mobile">{customer.mobile || "—"}</Descriptions.Item>
                <Descriptions.Item label="Billing address" span={3}>{customer.address || "—"}</Descriptions.Item>
              </Descriptions>
              <Text type="secondary">Delivery address</Text>
              <Input.TextArea autoSize={{ minRows: 2 }} value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Where the goods go" />
              <div style={{ marginTop: 6 }}>
                <Text type="secondary">
                  {interState ? "Customer is in another state, so this invoice charges IGST." : "Same state as the branch, so this invoice charges CGST + SGST."}
                </Text>
              </div>
            </>
          )}
        </Card>

        <Card size="small" title="Items" style={{ marginBottom: 12 }}>
          <Space wrap style={{ marginBottom: 12 }}>
            <Select showSearch style={{ width: 320 }} placeholder="Item name, barcode or code"
              value={pick.item?.id} filterOption={false} onSearch={setItemSearch}
              onChange={pickItem} options={itemOptions} />
            <InputNumber ref={qtyRef} min={0.001} value={pick.qty} placeholder="Qty" style={{ width: 90 }}
              onChange={(q) => setPick({ ...pick, qty: q })} onPressEnter={addLine} />
            <InputNumber min={0} value={pick.rate} placeholder="Rate incl. GST" style={{ width: 140 }}
              onChange={(r) => setPick({ ...pick, rate: r })} onPressEnter={addLine} />
            <Text type="secondary">{pick.item ? `GST ${pick.item.taxRate ?? 0}%` : ""}</Text>
            <Button type="primary" onClick={addLine}>Add</Button>
          </Space>
          <Table size="small" columns={columns} dataSource={calcLines} rowKey="key" pagination={false}
            scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={5} align="right"><b>Total</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">{money(totals.taxable)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">{money(totals.tax)}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right"><b>₹{money(totals.total)}</b></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              </Table.Summary>
            )} />
          {!interState && totals.tax > 0 && (
            <div style={{ textAlign: "right", marginTop: 6 }}>
              <Text type="secondary">CGST ₹{money(totals.tax / 2)} · SGST ₹{money(totals.tax - r2(totals.tax / 2))}</Text>
            </div>
          )}
        </Card>

        <Card size="small" title="Payment" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <Radio.Group value={credit ? "credit" : "paid"} onChange={(e) => setCredit(e.target.value === "credit")}>
              <Radio.Button value="paid">Paid in full</Radio.Button>
              <Radio.Button value="credit">Credit</Radio.Button>
            </Radio.Group>
          </div>
          {credit && (
            <Alert type="info" showIcon style={{ marginBottom: 12 }}
              message="Enter any down payment below. The rest goes on the customer's account and is collected later from the Receipt screen." />
          )}
          <Space wrap size="large">
            {PAY_MODES.map((m) => (
              <Space key={m} direction="vertical" size={2}>
                <Text type="secondary">{credit ? `Down payment · ${PAY_LABELS[m]}` : PAY_LABELS[m]}</Text>
                <Space.Compact>
                  <InputNumber min={0} value={payments[m]} style={{ width: 130 }}
                    onChange={(v) => setPayments({ ...payments, [m]: v || 0 })} />
                  <Button onClick={() => fillRest(m)}>Rest</Button>
                </Space.Compact>
              </Space>
            ))}
          </Space>
          <div style={{ marginTop: 12 }}>
            <Text>Paid now ₹{money(paid)}</Text>
            <Text style={{ marginLeft: 24 }} type={balance > 0.01 && !credit ? "danger" : undefined}>
              {credit ? `On credit ₹${money(Math.max(0, balance))}` : `Balance ₹${money(balance)}`}
            </Text>
          </div>
        </Card>

        <Button type="primary" size="large" loading={saving} onClick={save}>Save invoice</Button>
      </Spin>

      <Modal open={newCustomerOpen} title="New customer" okText="Add customer"
        onOk={createCustomer} onCancel={() => setNewCustomerOpen(false)} destroyOnClose>
        <Form form={customerForm} layout="vertical" initialValues={{ sameAsBilling: true }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: "Enter the customer's name" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="gst" label="GSTIN" normalize={(v) => (v || "").toUpperCase().replace(/\s/g, "")}
            rules={[{ validator: (_, v) => (!v || GSTIN_RE.test(v) ? Promise.resolve() : Promise.reject(new Error("Not a valid GSTIN"))) }]}>
            <Input placeholder="Leave empty for an unregistered customer" maxLength={15}
              onChange={(e) => {
                const st = GST_STATES[gstStateCode(e.target.value.toUpperCase())];
                if (st) customerForm.setFieldsValue({ state: st });
              }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="mobile" label="Mobile" rules={[{ pattern: /^[0-9+ ]{0,15}$/, message: "Digits only" }]}>
                <Input maxLength={15} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label="State" rules={[{ required: true, message: "Pick the state (decides IGST)" }]}>
                <Select showSearch options={Object.values(GST_STATES).sort().map((s) => ({ value: s, label: s }))} />
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
