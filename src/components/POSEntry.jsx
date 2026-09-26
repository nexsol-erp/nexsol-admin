// src/components/POSEntry.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Form,
  Input,
  InputNumber,
  Button,
  AutoComplete,
  Table,
  Row,
  Col,
  Typography,
  message,
  List,
  Card,
  Tag,
  Tooltip,
  Space,
  Modal,
  Spin,
  Grid,
  Empty,
} from "antd";
import {
  BarcodeOutlined,
  PrinterOutlined,
  SyncOutlined,
  UserOutlined,
  SearchOutlined,
  DeleteOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  FileTextOutlined,
  SaveOutlined,
  CameraOutlined,
  MinusOutlined,
  ClearOutlined,
} from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import InvoicePrint from "./InvoicePrint";
import BarcodeScannerModal from "./BarcodeScannerModal";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const LS_CACHE_KEY = "pos-item-cache-v1";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const inr = (n) => `₹${r2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const S = {
  // The app shell can be in dark mode while antd cards stay light, so the POS keeps its own
  // light surface (as it always has) to keep the header text readable.
  shell: { flex: 1, minWidth: 0, background: "#f0f2f5", color: "rgba(0,0,0,0.88)", minHeight: "calc(100vh - 64px)" },
  page: { padding: 16, maxWidth: 1400, margin: "0 auto" },
  header: {
    display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    gap: 12, marginBottom: 16,
  },
  logo: {
    width: 40, height: 40, borderRadius: 10, background: "#1677ff", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0,
  },
  // A grid track of minmax(0, 1fr) keeps long item names from widening the page on phones.
  stack: { display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 16 },
  card: { borderRadius: 10, minWidth: 0, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  label: { fontSize: 12, color: "rgba(0,0,0,0.55)", marginBottom: 4 },
  lineCard: {
    border: "1px solid #f0f0f0", borderRadius: 8, padding: 10, background: "#fff",
    display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, alignItems: "center",
  },
  totalBox: {
    background: "linear-gradient(135deg, #141a2e 0%, #24304f 100%)", color: "#fff",
    borderRadius: 10, padding: "16px 20px",
  },
  statRow: { display: "flex", justifyContent: "space-between", fontSize: 13, opacity: 0.8 },
  bottomBar: {
    position: "fixed", right: 0, bottom: 0, zIndex: 1000, background: "#fff",
    borderTop: "1px solid #e5e5e5", boxShadow: "0 -2px 8px rgba(0,0,0,0.08)", color: "#111",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 16px calc(10px + env(safe-area-inset-bottom))",
  },
};

function normalizeItem(it) {
  return {
    id:
      it.id ??
      it.itemId ??
      it.code ??
      it.itemCode ??
      String(it.barcode ?? it.name ?? it.itemName ?? ""),
    name: it.itemName ?? it.name ?? it.title ?? it.description ?? String(it.id ?? ""),
    barcode: it.barcode ?? it.barCode ?? it.qr ?? "",
    rate:
      Number(
        it.rate ??
          it.saleRate ??
          it.sellingPrice ??
          it.mrp ??
          it.standardPrice ??
          it.price ??
          it.purchaseRate ??
          0
      ) || 0,
    taxRate: Number(it.taxRate ?? it.tax_rate ?? 0) || 0,
  };
}

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

const POSEntry = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.lg; // phones and tablets get one column and a bottom bar
  const isPhone = !screens.sm;

  const [form] = Form.useForm();

  const [scanOpen, setScanOpen] = useState(false);
  const [cache, setCache] = useState(loadCache());
  const [branchInfo, setBranchInfo] = useState(null);

  const [items, setItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);

  const barcodeInputRef = useRef(null);
  const qtyRef = useRef(null);
  const printContentRef = useRef(null);

  const [selectedItem, setSelectedItem] = useState({
    itemName: "",
    qty: 1,
    rate: 0,
    id: null,
  });
  const [barcode, setBarcode] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);

  const [billToPrint, setBillToPrint] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const tendered = Form.useWatch("tendered", form);

  // The hidden input catches a USB/Bluetooth scanner's keystrokes. On a phone or tablet
  // focusing it opens the on-screen keyboard over the bill, so only do it on desktop.
  // Read the width directly: useBreakpoint is still empty on the first render.
  const focusScanner = () => {
    if (window.matchMedia("(min-width: 992px)").matches) barcodeInputRef.current?.focus?.();
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
    try {
      setSyncing(true);

      // ✅ real API example (keep as-is)
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const res = await fetch(`/api/${tenancyId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch items");

      const rawItems = await res.json();
      const normalized = rawItems.map(normalizeItem);

      localStorage.setItem(LS_CACHE_KEY, JSON.stringify(normalized));
      setCache(normalized);

      message.success("Synced items successfully");
    } catch (err) {
      console.error(err);
      message.error(err?.message || "Failed to sync items from API");
    } finally {
      setSyncing(false);
      focusScanner();
    }
  };

  useEffect(() => {
    if (!cache || cache.length === 0) syncItems();
    focusScanner();
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
        setSearchOpen(true);
        setTimeout(() => document.getElementById("search-input")?.focus(), 50);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setTotalAmount(items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0));
  }, [items]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cache.slice(0, 50);

    return cache
      .filter(
        (it) =>
          it.name?.toLowerCase().includes(q) ||
          String(it.id)?.toLowerCase().includes(q) ||
          String(it.barcode)?.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [searchQuery, cache]);

  const itemOptions = useMemo(() => {
    const v = (selectedItem.itemName || "").trim().toLowerCase();
    const list = v
      ? (cache || []).filter(
          (it) =>
            it.name?.toLowerCase().includes(v) ||
            String(it.barcode || "").toLowerCase().includes(v)
        )
      : cache || [];

    return list.slice(0, 20).map((it) => ({
      value: it.id,
      label: it.name,
      data: it,
    }));
  }, [cache, selectedItem.itemName]);

  const selectFromCache = (it) => {
    setSelectedItem({
      id: it.id,
      itemName: it.name,
      rate: Number(it.rate) || 0,
      taxRate: Number(it.taxRate) || 0,
      qty: 1,
    });
    setSearchOpen(false);
    setTimeout(() => qtyRef.current?.focus?.(), 50);
  };

  const addLineMerge = ({ id, itemName, rate, taxRate = 0, qtyToAdd = 1 }) => {
    const addQty = Number(qtyToAdd) || 1;
    const addRate = Number(rate) || 0;
    const addName = String(itemName || "").trim();
    const addTaxRate = Number(taxRate) || 0;

    if (!addName || addQty <= 0) return;

    setItems((prev) => {
      const idx = prev.findIndex(
        (r) =>
          String(r.itemName || "").trim().toLowerCase() === addName.toLowerCase() &&
          Number(r.rate) === Number(addRate)
      );

      if (idx >= 0) {
        const next = [...prev];
        const row = next[idx];
        const newQty = (Number(row.qty) || 0) + addQty;
        next[idx] = {
          ...row,
          qty: newQty,
          amount: Math.round(newQty * Number(row.rate) * 100) / 100,
        };
        return next;
      }

      const newItem = {
        key: Date.now(),
        id,
        itemName: addName,
        qty: addQty,
        rate: addRate,
        taxRate: addTaxRate,
        amount: Math.round(addQty * addRate * 100) / 100,
      };

      return [...prev, newItem];
    });
  };

  const addByBarcode = (rawCode) => {
    const code = String(rawCode || "").trim().toLowerCase();
    if (!code) return;

    const it = cache.find(
      (x) =>
        String(x.barcode || "").toLowerCase() === code ||
        String(x.id || "").toLowerCase() === code
    );

    if (!it) {
      message.error("Item not found");
      return;
    }

    addLineMerge({ id: it.id, itemName: it.name, rate: it.rate, taxRate: it.taxRate, qtyToAdd: 1 });
    message.success(`${it.name} added`);
    focusScanner();
  };

  const handleBarcodeEnter = () => {
    if (!barcode) return;
    addByBarcode(barcode);
    setBarcode("");
  };

  const handleAddItem = () => {
    const { itemName, qty, rate, taxRate, id } = selectedItem;
    if (!itemName || !(Number(qty) > 0)) return message.warning("Please enter item and quantity");

    addLineMerge({ id, itemName, rate, taxRate, qtyToAdd: qty });
    setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });

    setTimeout(() => {
      const el = document.querySelector("#item-search input");
      el?.focus?.();
    }, 50);
  };

  const handleRemoveItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  const changeQty = (key, qty) => {
    const q = Number(qty) || 0;
    if (q <= 0) return handleRemoveItem(key);
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, qty: q, amount: r2(q * Number(it.rate)) } : it))
    );
  };

  const resetBill = () => {
    form.resetFields();
    setItems([]);
    setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });
    setTotalAmount(0);
    focusScanner();
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

  const saveBillToDatabase = async (billData) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    const salesTransHdr = {
      customer: {
        id: billData.customerId || "001",
        name: billData.customerName || "POS",
        address: null,
        gst: null,
        mobile: billData.customerMobile || null,
        state: null,
        country: null,
      },
      voucherNumber: billData.voucherNo || null,
      voucherDate: new Date().toISOString(),
      NumericVoucherNumber: billData.NumericVoucherNumber || null,
      salesManName: billData.salesManName || null,
      customerMobile: billData.customerMobile || null,
      voucherPrefix: billData.voucherPrefix || "INV",
      voucherSufix: billData.voucherSufix || null,
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

  const handleFinish = async (values) => {
    if (!items.length) return message.error("Cart is empty");
    setSaving(true);

    try {
      const billData = {
        ...values,
        customerId: values.customerId || null,
        customerName: values.customer || "",
        items,
        totalAmount,
        tendered: values.tendered || 0,
        createdAt: new Date().toISOString(),
      };

      message.loading({ content: "Saving invoice...", key: "saving" });
      const savedResult = await saveBillToDatabase(billData);

      if (!savedResult || !savedResult.voucherNumber) throw new Error("Invalid response from server");

      message.success({ content: "Saved successfully!", key: "saving", duration: 1.5 });
      setBillToPrint({
        ...savedResult,
        branchInfo,
        totalAmount: savedResult.totalAmount ?? totalAmount,
        tendered: values.tendered || 0,
        customer: savedResult.customer ?? { name: values.customer || "Walk-In" },
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
      message.error({ content: `Failed: ${e.message}`, duration: 5 });
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


  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
  const balance = r2((Number(tendered) || 0) - totalAmount);
  const isDue = balance < 0;

  // Exact amount plus the next round notes a customer is likely to hand over.
  const quickTender = useMemo(() => {
    if (!(totalAmount > 0)) return [];
    const vals = [r2(totalAmount)];
    [100, 500, 2000].forEach((n) => {
      const v = Math.ceil(totalAmount / n) * n;
      if (!vals.includes(v)) vals.push(v);
    });
    return vals.slice(0, 4);
  }, [totalAmount]);

  const qtyStepper = (it) => (
    <Space.Compact size="small">
      <Button icon={<MinusOutlined />} aria-label="Less" onClick={() => changeQty(it.key, Number(it.qty) - 1)} />
      <InputNumber
        size="small"
        min={0}
        value={it.qty}
        controls={false}
        style={{ width: 52, textAlign: "center" }}
        onChange={(v) => v != null && changeQty(it.key, v)}
      />
      <Button icon={<PlusOutlined />} aria-label="More" onClick={() => changeQty(it.key, Number(it.qty) + 1)} />
    </Space.Compact>
  );

  const columns = [
    {
      title: "#",
      width: 48,
      align: "center",
      render: (_, __, i) => <Text type="secondary">{i + 1}</Text>,
    },
    { title: "Item", dataIndex: "itemName", ellipsis: true, render: (t) => <Text strong>{t}</Text> },
    { title: "Qty", dataIndex: "qty", width: 150, align: "center", render: (_, r) => qtyStepper(r) },
    { title: "Rate", dataIndex: "rate", width: 110, align: "right", render: (v) => inr(v) },
    { title: "Amount", dataIndex: "amount", width: 130, align: "right", render: (v) => <Text strong>{inr(v)}</Text> },
    {
      title: "",
      width: 52,
      render: (_, r) => (
        <Tooltip title="Remove">
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(r.key)} />
        </Tooltip>
      ),
    },
  ];

  const emptyCart = (
    <Empty
      image={<ShoppingCartOutlined style={{ fontSize: 44, color: "#bfbfbf" }} />}
      imageStyle={{ height: 50 }}
      description={
        <span>
          No items yet
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {isMobile ? "Tap Scan or search for an item" : "Scan a barcode, or search above (F2 for lookup)"}
          </Text>
        </span>
      }
      style={{ padding: "32px 0" }}
    />
  );

  const header = (
    <div style={S.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={S.logo}>
          <ShoppingCartOutlined />
        </div>
        <div style={{ minWidth: 0 }}>
          <Title level={isPhone ? 5 : 4} style={{ margin: 0 }}>
            POS Billing
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {branchInfo
              ? `${branchInfo.branchCode} · ${branchInfo.branchName}${branchInfo.branchState ? ` · ${branchInfo.branchState}` : ""}`
              : "Counter sale"}
          </Text>
        </div>
      </div>

      <Space wrap>
        {!isMobile && (
          <Tag icon={<BarcodeOutlined />} color="processing" style={{ margin: 0 }}>
            Scanner ready
          </Tag>
        )}
        <Tooltip title={`${cache.length.toLocaleString("en-IN")} items on this device`}>
          <Button icon={<SyncOutlined spin={syncing} />} onClick={syncItems}>
            {isPhone ? null : "Sync items"}
          </Button>
        </Tooltip>
        {!isMobile && (
          <>
            <Button icon={<CameraOutlined />} onClick={() => setScanOpen(true)}>
              Camera scan
            </Button>
            <Tooltip title="F2 or Ctrl+K">
              <Button icon={<SearchOutlined />} onClick={() => setSearchOpen(true)}>
                Lookup
              </Button>
            </Tooltip>
          </>
        )}
      </Space>
    </div>
  );

  const itemEntry = (
    <Card style={S.card} bodyStyle={{ padding: isPhone ? 12 : 16 }}>
      {isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          <Button size="large" type="primary" ghost icon={<CameraOutlined />} onClick={() => setScanOpen(true)}>
            Scan
          </Button>
          <Button size="large" icon={<SearchOutlined />} onClick={() => setSearchOpen(true)}>
            Lookup
          </Button>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gap: 8,
          alignItems: "end",
          gridTemplateColumns: isMobile ? "minmax(0, 1fr) minmax(0, 1fr) auto" : "minmax(0, 1fr) 96px 130px auto",
        }}
      >
        <div style={{ gridColumn: isMobile ? "1 / -1" : "auto", minWidth: 0 }}>
          <div style={S.label}>Item</div>
          <AutoComplete
            id="item-search"
            style={{ width: "100%" }}
            value={selectedItem.itemName}
            options={itemOptions.map((o) => ({
              ...o,
              label: (
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.data.name}</span>
                  <Text type="secondary">{inr(o.data.rate)}</Text>
                </div>
              ),
            }))}
            onSearch={(txt) => setSelectedItem((s) => ({ ...s, itemName: txt }))}
            onSelect={(_, opt) => {
              setSelectedItem((s) => ({
                ...s,
                itemName: opt.data?.name ?? s.itemName,
                rate: opt.data?.rate ?? s.rate,
                taxRate: opt.data?.taxRate ?? s.taxRate,
                id: opt.data?.id ?? null,
              }));
              setTimeout(() => qtyRef.current?.focus?.(), 0);
            }}
          >
            <Input
              size="large"
              placeholder="Item name or barcode"
              prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              allowClear
            />
          </AutoComplete>
        </div>

        <div>
          <div style={S.label}>Qty</div>
          <InputNumber
            ref={qtyRef}
            size="large"
            value={selectedItem.qty}
            min={1}
            inputMode="decimal"
            style={{ width: "100%" }}
            onChange={(qty) => setSelectedItem((s) => ({ ...s, qty }))}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
        </div>

        <div>
          <div style={S.label}>Rate</div>
          <InputNumber
            size="large"
            prefix="₹"
            value={selectedItem.rate}
            min={0}
            inputMode="decimal"
            controls={false}
            style={{ width: "100%" }}
            onChange={(rate) => setSelectedItem((s) => ({ ...s, rate }))}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
        </div>

        <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddItem}>
          Add
        </Button>
      </div>
    </Card>
  );

  const cartCard = (
    <Card
      style={S.card}
      title={
        <Space>
          <ShoppingCartOutlined />
          Bill items
          {items.length > 0 && <Tag style={{ marginLeft: 4 }}>{items.length}</Tag>}
        </Space>
      }
      extra={
        items.length > 0 && (
          <Button type="text" danger size="small" icon={<ClearOutlined />} onClick={confirmClear}>
            Clear
          </Button>
        )
      }
      bodyStyle={{ padding: isMobile ? 12 : 0 }}
    >
      {!items.length ? (
        emptyCart
      ) : isMobile ? (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((it) => (
            <div key={it.key} style={S.lineCard}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.itemName}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {inr(it.rate)} each
                </Text>
                <div style={{ marginTop: 6 }}>{qtyStepper(it)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{inr(it.amount)}</div>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label="Remove"
                  onClick={() => handleRemoveItem(it.key)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={items}
          pagination={false}
          scroll={{ y: "calc(100vh - 420px)" }}
          size="middle"
          rowKey="key"
        />
      )}
    </Card>
  );

  const customerCard = (
    <Card style={S.card} size="small" title={<Space><UserOutlined />Customer & invoice</Space>}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0 10px" }}>
        <Form.Item name="customer" label="Customer" style={{ marginBottom: 10 }}>
          <Input placeholder="Walk-in" />
        </Form.Item>
        <Form.Item name="customerMobile" label="Mobile" style={{ marginBottom: 10 }}>
          <Input placeholder="Optional" inputMode="tel" maxLength={15} />
        </Form.Item>
        <Form.Item name="voucherNo" label="Voucher no" style={{ marginBottom: 0 }}>
          <Input prefix={<FileTextOutlined style={{ color: "#bfbfbf" }} />} placeholder="Auto" />
        </Form.Item>
        <Form.Item name="voucherDate" label="Date" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
          <Input type="date" />
        </Form.Item>
      </div>
    </Card>
  );

  const paymentCard = (
    <Card style={S.card} bodyStyle={{ padding: 16 }}>
      <div style={S.totalBox}>
        <div style={S.statRow}>
          <span>{items.length} item{items.length === 1 ? "" : "s"}</span>
          <span>Qty {totalQty}</span>
        </div>
        <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.7, marginTop: 10 }}>TOTAL PAYABLE</div>
        <div style={{ fontSize: isPhone ? 32 : 38, fontWeight: 700, lineHeight: 1.15 }}>{inr(totalAmount)}</div>
      </div>

      <Form.Item
        name="tendered"
        label="Cash received"
        style={{ marginTop: 16, marginBottom: 8 }}
        rules={[
          { required: true, message: "Enter the amount received" },
          {
            validator: (_, value) =>
              value == null || value >= 0 ? Promise.resolve() : Promise.reject(new Error("Amount must be 0 or more")),
          },
        ]}
      >
        <InputNumber
          size="large"
          style={{ width: "100%" }}
          prefix="₹"
          min={0}
          step={1}
          precision={2}
          inputMode="decimal"
          controls={false}
          placeholder="0.00"
          onKeyDown={(e) => {
            if (["e", "E", "+", "-", ","].includes(e.key)) e.preventDefault();
          }}
        />
      </Form.Item>

      {quickTender.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {quickTender.map((v, i) => (
            <Button key={v} size="small" onClick={() => form.setFieldsValue({ tendered: v })}>
              {i === 0 ? "Exact" : `₹${v.toLocaleString("en-IN")}`}
            </Button>
          ))}
        </div>
      )}

      <div
        style={{
          background: isDue ? "#fff1f0" : "#f6ffed",
          border: `1px solid ${isDue ? "#ffccc7" : "#b7eb8f"}`,
          borderRadius: 8,
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text strong style={{ color: isDue ? "#cf1322" : "#389e0d" }}>
          {isDue ? "Balance due" : "Change to return"}
        </Text>
        <Text strong style={{ fontSize: 20, color: isDue ? "#cf1322" : "#389e0d" }}>
          {inr(Math.abs(balance))}
        </Text>
      </div>

      {!isMobile && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginTop: 16 }}>
          <Button size="large" icon={<ClearOutlined />} onClick={confirmClear}>
            Clear
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<SaveOutlined />}
            loading={saving}
            disabled={!items.length}
          >
            Save & Print
          </Button>
        </div>
      )}
    </Card>
  );

  return (
    <div style={S.shell}>
    <div style={{ ...S.page, padding: isPhone ? 12 : 16, paddingBottom: isMobile ? 96 : 16 }}>
      {header}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        scrollToFirstError
        initialValues={{
          voucherDate: new Date().toISOString().slice(0, 10),
          customer: "POS",
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={15} xl={16}>
            <div style={S.stack}>
              {itemEntry}
              {cartCard}
            </div>
          </Col>
          <Col xs={24} lg={9} xl={8}>
            <div style={isMobile ? S.stack : { ...S.stack, position: "sticky", top: 80 }}>
              {paymentCard}
              {customerCard}
            </div>
          </Col>
        </Row>
      </Form>

      {/* hidden barcode input */}
      <input
        ref={barcodeInputRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleBarcodeEnter()}
        style={{ position: "fixed", top: 0, left: 0, opacity: 0, width: 1, zIndex: -1 }}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Hidden print DOM */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, width: "80mm", background: "white", zIndex: -1 }}>
        <InvoicePrint ref={printContentRef} bill={billToPrint} />
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
        width={isPhone ? "100%" : 520}
        style={isPhone ? { top: 0, maxWidth: "100vw", margin: 0, paddingBottom: 0 } : undefined}
        footer={[
          <Button key="cancel" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleConfirmPrint}>
            Print invoice
          </Button>,
        ]}
      >
        {billToPrint ? (
          <div
            style={{
              maxHeight: "70vh",
              overflow: "auto",
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: 12,
              background: "#fafafa",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div style={{ background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
              <InvoicePrint bill={billToPrint} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading invoice...</p>
          </div>
        )}
      </Modal>

      {/* Lookup */}
      <Modal
        title={
          <Space>
            <SearchOutlined /> Item lookup
          </Space>
        }
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={isPhone ? "100%" : 600}
        style={isPhone ? { top: 0, maxWidth: "100vw", margin: 0, paddingBottom: 0 } : undefined}
      >
        <Input
          id="search-input"
          placeholder="Name, code or barcode"
          prefix={<SearchOutlined />}
          size="large"
          allowClear
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSearchIndex((i) => Math.min(i + 1, filtered.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSearchIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter") {
              const it = filtered[searchIndex];
              if (it) selectFromCache(it);
            }
          }}
        />
        <List
          style={{ marginTop: 10, maxHeight: isPhone ? "65vh" : 380, overflow: "auto" }}
          dataSource={filtered}
          size="small"
          bordered
          locale={{ emptyText: "No matching items" }}
          renderItem={(it, idx) => (
            <List.Item
              onClick={() => selectFromCache(it)}
              style={{
                cursor: "pointer",
                background: idx === searchIndex ? "#e6f4ff" : "white",
              }}
            >
              <List.Item.Meta
                title={<Text strong>{it.name}</Text>}
                description={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Code {it.id} · Barcode {it.barcode || "none"}
                  </Text>
                }
              />
              <div style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{inr(it.rate)}</div>
            </List.Item>
          )}
        />
      </Modal>

      {/* Scanner */}
      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          focusScanner();
        }}
        onDetected={(code) => addByBarcode(code)}
      />

      {/* Phones and tablets: total and Save always in reach */}
      {isMobile && (
        <div style={{ ...S.bottomBar, left: screens.sm ? 240 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
              {items.length} item{items.length === 1 ? "" : "s"} · Total
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2 }}>{inr(totalAmount)}</div>
          </div>
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
            disabled={!items.length}
            style={{ minWidth: 150 }}
          >
            Save & Print
          </Button>
        </div>
      )}
    </div>
    </div>
  );
};

export default POSEntry;
