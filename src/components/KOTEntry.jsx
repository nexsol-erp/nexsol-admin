// src/components/KOTEntry.jsx
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
  Divider,
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
} from "@ant-design/icons";
import { useReactToPrint } from "react-to-print";
import InvoicePrint from "./InvoicePrint"; // you can reuse, or later create KOTPrint
import BarcodeScannerModal from "./BarcodeScannerModal";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const LS_CACHE_KEY = "pos-item-cache-v1"; // reuse same item cache

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

const KOTEntry = () => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [form] = Form.useForm();

  const [scanOpen, setScanOpen] = useState(false);
  const [cache, setCache] = useState(loadCache());

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

  const [kotToPrint, setKotToPrint] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Print (reuse InvoicePrint for now)
  const handlePrint = useReactToPrint({
    contentRef: printContentRef,
    copyStyles: true,
    pageStyle: `
      @page { size: 80mm auto; margin: 0; }
      html, body { width: 80mm; margin: 0 !important; padding: 0 !important; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
    onBeforePrint: async () => {
      if (!kotToPrint) throw new Error("Nothing to print");
      if (!printContentRef.current) throw new Error("Print DOM not mounted");
    },
    onAfterPrint: () => {
      setKotToPrint(null);
      setPreviewOpen(false);
    },
  });

  const syncItems = async () => {
    try {
      setSyncing(true);

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
      barcodeInputRef.current?.focus?.();
    }
  };

  useEffect(() => {
    if (!cache || cache.length === 0) syncItems();
    barcodeInputRef.current?.focus?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      qty: 1,
    });
    setSearchOpen(false);
    setTimeout(() => qtyRef.current?.focus?.(), 50);
  };

  const addLineMerge = ({ id, itemName, rate, qtyToAdd = 1 }) => {
    const addQty = Number(qtyToAdd) || 1;
    const addRate = Number(rate) || 0;
    const addName = String(itemName || "").trim();
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

    if (!it) return message.error("Item not found");

    addLineMerge({ id: it.id, itemName: it.name, rate: it.rate, qtyToAdd: 1 });
    message.success(`${it.name} added`);
    barcodeInputRef.current?.focus?.();
  };

  const handleBarcodeEnter = () => {
    if (!barcode) return;
    addByBarcode(barcode);
    setBarcode("");
  };

  const handleAddItem = () => {
    const { itemName, qty, rate, id } = selectedItem;
    if (!itemName || !(Number(qty) > 0)) return message.warning("Please enter item and quantity");

    addLineMerge({ id, itemName, rate, qtyToAdd: qty });
    setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });

    setTimeout(() => document.querySelector("#item-search input")?.focus?.(), 50);
  };

  const handleRemoveItem = (key) => setItems((prev) => prev.filter((it) => it.key !== key));

  // ✅ KOT: send salesmanCode + tableName as header values to backend
  const saveKotToDatabase = async (kotData) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    const { salesmanCode, tableName } = kotData;

    // Keep same body structure as SalesTransHdr (as you requested "everything else remain same")
    // Only add headers for KOT meta.
    const salesTransHdr = {
      customer: {
        id: kotData.customerId || "001",
        name: kotData.customerName || "POS",
        address: null,
        gst: null,
        mobile: kotData.customerMobile || null,
        state: null,
        country: null,
      },
      voucherNumber: kotData.voucherNo || null,
      voucherDate: new Date().toISOString(),
      numericVoucherNumber: kotData.NumericVoucherNumber || null,
      salesManName: kotData.salesManName || null,
      customerMobile: kotData.customerMobile || null,
      voucherPrefix: kotData.voucherPrefix || "KOT",
      voucherSufix: kotData.voucherSufix || null,
      voucherSufix: kotData.voucherSufix || null,
      voucherSufix: kotData.voucherSufix || null,
      kotTable : kotData.tableName || null,
      details: items.map((item) => ({
        itemId: item.id,
        itemName: item.itemName,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
      })),
    };

    const response = await fetch(`/api/${tenancyId}/kot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(salesTransHdr),
    });

    if (!response.ok) {
      let errMsg = "Failed to save KOT";
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

    const salesmanCode = String(values.salesmanCode || "").trim();
    const tableName = String(values.tableName || "").trim();

    if (!salesmanCode) return message.error("Salesman Code is required");
    if (!tableName) return message.error("Table Name is required");

    setSaving(true);

    try {
      const kotData = {
        ...values,
        salesmanCode,
        tableName,
        customerId: values.customerId || null,
        customerName: values.customer || "",
        items,
        totalAmount,
        tendered: values.tendered || 0,
        createdAt: new Date().toISOString(),
      };

      message.loading({ content: "Saving KOT...", key: "saving" });
      const savedResult = await saveKotToDatabase(kotData);

      if (!savedResult || !(savedResult.voucherNumber || savedResult.kotNumber)) {
        throw new Error("Invalid response from server");
      }

      message.success({ content: "KOT saved successfully!", key: "saving", duration: 1.5 });
      setKotToPrint(savedResult);
      setPreviewOpen(true);
    } catch (e) {
      console.error(e);
      message.error({ content: `Failed: ${e.message}`, duration: 5 });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPrint = async () => {
    if (!kotToPrint) return message.error("KOT not ready to print");
    await new Promise((r) => setTimeout(r, 150));
    if (!printContentRef.current) return message.error("Print content not mounted yet.");

    handlePrint();

    setTimeout(() => {
      form.resetFields();
      setItems([]);
      setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });
      setTotalAmount(0);
      barcodeInputRef.current?.focus?.();
    }, 500);
  };

  const columns = [
    { title: "Item Name", dataIndex: "itemName", render: (t) => <Text strong>{t}</Text> },
    { title: "Qty", dataIndex: "qty", width: 80, align: "center", render: (v) => <Tag>{v}</Tag> },
    { title: "Rate", dataIndex: "rate", width: 100, align: "right", render: (v) => `₹${Number(v || 0).toFixed(2)}` },
    {
      title: "Total",
      dataIndex: "amount",
      width: 120,
      align: "right",
      render: (v) => (
        <Text type="success" strong>
          ₹{Number(v || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: "",
      width: 60,
      render: (_, r) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(r.key)} />
      ),
    },
  ];

  const MobileCart = () => (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((it) => (
        <Card key={it.key} size="small" bodyStyle={{ padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {it.itemName}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Qty: <b>{it.qty}</b> &nbsp;|&nbsp; Rate: <b>₹{Number(it.rate).toFixed(2)}</b>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 800 }}>₹{Number(it.amount).toFixed(2)}</div>
              <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemoveItem(it.key)} />
            </div>
          </div>
        </Card>
      ))}
      {!items.length && (
        <div style={{ padding: 30, textAlign: "center", opacity: 0.6 }}>
          <ShoppingCartOutlined style={{ fontSize: 34 }} />
          <div style={{ marginTop: 8 }}>Cart is empty</div>
        </div>
      )}
    </div>
  );

  const MobileBottomBar = () => (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(255,255,255,0.98)",
        borderTop: "1px solid #f0f0f0",
        padding: "10px 12px",
        zIndex: 999,
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <Button icon={<CameraOutlined />} onClick={() => setScanOpen(true)} block>
          Scan
        </Button>
        <Button icon={<SearchOutlined />} onClick={() => setSearchOpen(true)} block>
          Lookup
        </Button>
        <Button icon={<SyncOutlined spin={syncing} />} onClick={syncItems} block>
          Sync
        </Button>
        <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving} block>
          Save KOT
        </Button>
      </div>
      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span>Total</span>
        <b>₹{totalAmount.toFixed(2)}</b>
      </div>
    </div>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f2f5",
        padding: isMobile ? 12 : 20,
        paddingBottom: isMobile ? 90 : 20,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ background: "#1890ff", color: "#fff", padding: "6px 10px", borderRadius: 8 }}>
            <ShoppingCartOutlined style={{ fontSize: 18 }} />
          </div>
          <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: "#001529" }}>
            KOT Terminal
          </Title>
        </div>

        {!isMobile && (
          <Space>
            <Tag icon={<BarcodeOutlined />} color="processing">
              Ready to Scan
            </Tag>
            <Button icon={<CameraOutlined />} onClick={() => setScanOpen(true)}>
              Scan
            </Button>
            <Tooltip title="F2 / Ctrl+K">
              <Button icon={<SearchOutlined />} onClick={() => setSearchOpen(true)}>
                Lookup
              </Button>
            </Tooltip>
            <Button icon={<SyncOutlined spin={syncing} />} onClick={syncItems}>
              Sync DB
            </Button>
          </Space>
        )}
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          voucherDate: new Date().toISOString().slice(0, 10),
          customer: "POS",
        }}
      >
        <Row gutter={isMobile ? 10 : 16}>
          {/* Left */}
          <Col xs={24} lg={16}>
            {/* ✅ KOT Header fields */}
            <Card
              size={isMobile ? "small" : "default"}
              title="KOT Header"
              style={{ marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              bodyStyle={{ padding: isMobile ? 12 : 16 }}
            >
              <Row gutter={10}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="salesmanCode"
                    label="Salesman Code"
                    rules={[{ required: true, message: "Salesman Code required" }]}
                    style={{ marginBottom: 10 }}
                  >
                    <Input size="large" placeholder="E.g. S001" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="tableName"
                    label="Table Name"
                    rules={[{ required: true, message: "Table Name required" }]}
                    style={{ marginBottom: 10 }}
                  >
                    <Input size="large" placeholder="E.g. T1 / Table-5" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            {/* Item Entry */}
            <Card
              size={isMobile ? "small" : "default"}
              title={
                <Space>
                  <SearchOutlined /> Item Entry
                </Space>
              }
              style={{ marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
              bodyStyle={{ padding: isMobile ? 12 : 16 }}
            >
              <Row gutter={10} align="middle">
                <Col xs={24} sm={12} flex="auto">
                  <AutoComplete
                    id="item-search"
                    style={{ width: "100%" }}
                    placeholder="Type Item Name / Barcode"
                    value={selectedItem.itemName}
                    options={itemOptions}
                    onSearch={(txt) => setSelectedItem((s) => ({ ...s, itemName: txt }))}
                    onSelect={(_, opt) => {
                      setSelectedItem((s) => ({
                        ...s,
                        itemName: opt.data?.name ?? opt.label,
                        rate: opt.data?.rate ?? s.rate,
                        id: opt.data?.id ?? null,
                      }));
                      setTimeout(() => qtyRef.current?.focus?.(), 0);
                    }}
                  >
                    <Input size="large" prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />} />
                  </AutoComplete>
                </Col>

                <Col xs={8} sm={4}>
                  <InputNumber
                    ref={qtyRef}
                    size="large"
                    placeholder="Qty"
                    value={selectedItem.qty}
                    min={1}
                    style={{ width: "100%" }}
                    onChange={(qty) => setSelectedItem((s) => ({ ...s, qty }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  />
                </Col>

                <Col xs={10} sm={6}>
                  <InputNumber
                    size="large"
                    placeholder="Rate"
                    prefix="₹"
                    value={selectedItem.rate}
                    min={0}
                    style={{ width: "100%" }}
                    onChange={(rate) => setSelectedItem((s) => ({ ...s, rate }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
                  />
                </Col>

                <Col xs={6} sm={4}>
                  <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAddItem} block>
                    Add
                  </Button>
                </Col>
              </Row>
            </Card>

            {/* Cart */}
            <Card style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }} bodyStyle={{ padding: isMobile ? 12 : 0 }}>
              {isMobile ? (
                <MobileCart />
              ) : (
                <Table columns={columns} dataSource={items} pagination={false} size="middle" rowKey="key" />
              )}
            </Card>
          </Col>

          {/* Right */}
          <Col xs={24} lg={8}>
            <Card title="KOT Details" size="small" style={{ marginBottom: 12 }}>
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item name="voucherNo" label="KOT No" style={{ marginBottom: 10 }}>
                    <Input prefix={<FileTextOutlined />} placeholder="Auto" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="voucherDate" label="Date" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                    <Input type="date" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="customer" label="Customer" style={{ marginBottom: 8 }}>
                <Input prefix={<UserOutlined />} placeholder="POS" />
              </Form.Item>

              <Form.Item name="customerMobile" label="Mobile" style={{ marginBottom: 0 }}>
                <Input placeholder="Customer Mobile" />
              </Form.Item>
            </Card>

            {!isMobile && (
              <Card style={{ background: "#001529", color: "white", textAlign: "center", marginBottom: 12 }} bodyStyle={{ padding: 24 }}>
                <div style={{ opacity: 0.8, fontSize: 14 }}>TOTAL</div>
                <div style={{ fontSize: 42, fontWeight: "bold", color: "#fff", lineHeight: 1.2 }}>
                  <span style={{ fontSize: 24, verticalAlign: "top" }}>₹</span>
                  {totalAmount.toFixed(2)}
                </div>
              </Card>
            )}

            <Card title="Payment (Optional)" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <Form.Item name="tendered" label="Amount Tendered">
                <InputNumber
                  size="large"
                  style={{ width: "100%" }}
                  prefix="₹"
                  min={0}
                  step={1}
                  precision={2}
                  inputMode="numeric"
                  controls={false}
                  placeholder="0.00"
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", ","].includes(e.key)) e.preventDefault();
                  }}
                />
              </Form.Item>

              {!isMobile && (
                <>
                  <Divider />
                  <Row gutter={10}>
                    <Col span={12}>
                      <Button
                        block
                        size="large"
                        onClick={() => {
                          form.resetFields();
                          setItems([]);
                          setTotalAmount(0);
                        }}
                      >
                        Reset
                      </Button>
                    </Col>
                    <Col span={12}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        block
                        size="large"
                        icon={saving ? <SyncOutlined spin /> : <SaveOutlined />}
                        loading={saving}
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Save & Print KOT"}
                      </Button>
                    </Col>
                  </Row>
                </>
              )}
            </Card>
          </Col>
        </Row>
      </Form>

      {/* Hidden barcode input (hardware scanner / manual) */}
      <input
        ref={barcodeInputRef}
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleBarcodeEnter()}
        style={{ position: "fixed", top: 0, left: 0, opacity: 0, width: 1, zIndex: -1 }}
        autoFocus
      />

      {/* Hidden print DOM */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, width: "80mm", background: "white", zIndex: -1 }}>
        <InvoicePrint ref={printContentRef} bill={kotToPrint} />
      </div>

      {/* Preview */}
      <Modal
        title={
          <Space>
            <SaveOutlined />
            KOT Preview
            {(kotToPrint?.voucherNumber || kotToPrint?.kotNumber) && (
              <Tag color="success">KOT: {kotToPrint?.voucherNumber || kotToPrint?.kotNumber}</Tag>
            )}
          </Space>
        }
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setKotToPrint(null);
        }}
        width={isMobile ? "95vw" : 800}
        footer={[
          <Button key="cancel" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleConfirmPrint}>
            Print KOT
          </Button>,
        ]}
      >
        {kotToPrint ? (
          <div style={{ maxHeight: "70vh", overflow: "auto", border: "1px solid #d9d9d9", borderRadius: 6, padding: 12 }}>
            <InvoicePrint bill={kotToPrint} />
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
            <p style={{ marginTop: 16 }}>Loading KOT...</p>
          </div>
        )}
      </Modal>

      {/* Lookup */}
      <Modal
        title={
          <Space>
            <SearchOutlined /> Item Lookup
          </Space>
        }
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={isMobile ? "95vw" : 600}
      >
        <Input
          id="search-input"
          placeholder="Start typing..."
          prefix={<SearchOutlined />}
          size="large"
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
          style={{ marginTop: 10, maxHeight: 350, overflow: "auto" }}
          dataSource={filtered}
          size="small"
          bordered
          renderItem={(it, idx) => (
            <List.Item
              onClick={() => selectFromCache(it)}
              style={{
                cursor: "pointer",
                background: idx === searchIndex ? "#e6f7ff" : "white",
              }}
            >
              <List.Item.Meta
                title={<Text strong>{it.name}</Text>}
                description={
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Code: {it.id} | Barcode: {it.barcode || "N/A"}
                  </Text>
                }
              />
              <div style={{ fontWeight: "bold" }}>₹{Number(it.rate).toFixed(2)}</div>
            </List.Item>
          )}
        />
      </Modal>

      {/* Camera scan */}
      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => {
          setScanOpen(false);
          barcodeInputRef.current?.focus?.();
        }}
        onDetected={(code) => addByBarcode(code)}
      />

      {isMobile && <MobileBottomBar />}
    </div>
  );
};

export default KOTEntry;
