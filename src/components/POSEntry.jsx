import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Form, Input, InputNumber, Button, AutoComplete, Table,
  Row, Col, Divider, Typography, message, Modal, List,
} from "antd";
import ReactToPrint from "react-to-print";
import InvoicePrint from "./InvoicePrint";

const { Title } = Typography;

/* ---------------- Normalization & Cache ---------------- */

const LS_CACHE_KEY = "pos-item-cache-v1";

// Normalize a single API item into a consistent shape
function normalizeItem(it) {
  return {
    id:
      it.id ??
      it.itemId ??
      it.code ??
      it.itemCode ??
      String(it.barcode ?? it.name ?? it.itemName ?? ""),
    name:
      it.itemName ??
      it.name ??
      it.title ??
      it.description ??
      String(it.id ?? ""),
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

function normalizeItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeItem);
}

function loadCache() {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(data) ? data : [];
    const looksNormalized = arr.length === 0 || ("name" in arr[0] && "rate" in arr[0]);
    return looksNormalized ? arr : normalizeItems(arr);
  } catch {
    return [];
  }
}

function saveCache(items) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(items));
  } catch {}
}

/* ---------------- Component ---------------- */

const POSEntry = () => {
  const [form] = Form.useForm();
  const [cache, setCache] = useState(loadCache); // normalized items cache

  const [items, setItems] = useState([]); // invoice lines
  const [totalAmount, setTotalAmount] = useState(0);

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

  const barcodeInputRef = useRef();
  const printTriggerRef = useRef();
  const printContentRef = useRef();

  /* ------------- Sync from API → local cache ------------- */
  const syncItems = async () => {
    try {
      setSyncing(true);
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const res = await fetch(`/api/${tenancyId}/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("API did not return an array");

      const mapped = normalizeItems(data);
      setCache(mapped);
      saveCache(mapped);
      message.success(`Synced ${mapped.length} items`);
    } catch (err) {
      console.error(err);
      message.error("Failed to sync items from API");
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync once if cache empty; migrate old cache if needed
  useEffect(() => {
    if (!cache || cache.length === 0) {
      syncItems();
    } else if (!cache[0]?.name || cache[0].name === cache[0].id) {
      const fixed = normalizeItems(cache);
      setCache(fixed);
      saveCache(fixed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------- Barcode focus (scanner friendly) ------------- */
  useEffect(() => {
    const focus = () => barcodeInputRef.current?.focus();
    focus();
    const onKey = () => focus();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ------------- Global hotkeys ------------- */
  useEffect(() => {
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (e.key === "F2" || (meta && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => document.getElementById("search-input")?.focus(), 0);
      }
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        form.submit();
      }
      if (meta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleAddItem();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [form, selectedItem]);

  /* ------------- Totals ------------- */
  useEffect(() => {
    setTotalAmount(items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0));
  }, [items]);

  /* ------------- Local-cache search (popup + autocomplete) ------------- */
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return (cache || []).slice(0, 50);
    return (cache || [])
      .filter(
        (it) =>
          it.name?.toLowerCase().includes(q) ||
          String(it.id)?.toLowerCase().includes(q) ||
          String(it.barcode)?.toLowerCase().includes(q)
      )
      .slice(0, 100);
  }, [searchQuery, cache]);

  const selectFromCache = (it) => {
    setSelectedItem({
      id: it.id,
      itemName: it.name,
      rate: Number(it.rate) || 0,
      qty: 1,
    });
    setSearchOpen(false);
    setTimeout(() => document.getElementById("qty-input")?.focus(), 0);
  };

  const itemOptions = useMemo(() => {
    const v = (selectedItem.itemName || "").trim().toLowerCase();
    const src = cache || [];
    const list = v
      ? src.filter(
          (it) =>
            it.name?.toLowerCase().includes(v) ||
            String(it.id)?.toLowerCase().includes(v) ||
            String(it.barcode)?.toLowerCase().includes(v)
        )
      : src;
    return list.slice(0, 50).map((it) => ({
      value: it.id,
      label: it.name,
      data: it,
    }));
  }, [cache, selectedItem.itemName]);

  /* ------------- Barcode handling ------------- */
  const handleBarcodeEnter = () => {
    const code = (barcode || "").trim().toLowerCase();
    if (!code) return;
    const src = cache || [];
    const it = src.find(
      (x) =>
        String(x.barcode)?.toLowerCase() === code ||
        String(x.id)?.toLowerCase() === code
    );
    if (!it) {
      message.error("Item not found for barcode");
      setBarcode("");
      return;
    }
    setSelectedItem({
      id: it.id,
      itemName: it.name,
      rate: Number(it.rate) || 0,
      qty: 1,
    });
    setBarcode("");
    setTimeout(() => document.getElementById("qty-input")?.focus(), 0);
  };

  /* ------------- Add / Remove items ------------- */
  const handleAddItem = () => {
    const { itemName, qty, rate, id } = selectedItem;
    if (!itemName || !(Number(qty) > 0) || !(Number(rate) >= 0)) {
      return message.error("Fill item, qty, rate");
    }
    const amount = Number(qty) * Number(rate);
    const newItem = {
      key: Date.now(),
      id,
      itemName,
      qty: Number(qty),
      rate: Number(rate),
      amount: Math.round(amount * 100) / 100,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });
    setTimeout(() => document.getElementById("item-search")?.focus(), 0);
  };

  const handleRemoveItem = (key) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  /* ------------- Submit & Print ------------- */
  const handleFinish = (values) => {
    if (!items.length) return message.error("Add at least one item");
    const bill = { ...values, items, totalAmount };
    setBillToPrint(bill);
    setTimeout(() => {
      printTriggerRef.current?.click();
    }, 100);
    message.success("Invoice ready to print");
    // reset
    form.resetFields();
    setItems([]);
    setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });
  };

  /* ------------- Table ------------- */
  const columns = [
    { title: "Item", dataIndex: "itemName" },
    { title: "Qty", dataIndex: "qty", align: "right" },
    { title: "Rate", dataIndex: "rate", align: "right" },
    { title: "Amount", dataIndex: "amount", align: "right" },
    {
      title: "Action",
      render: (_, r) => (
        <Button danger size="small" onClick={() => handleRemoveItem(r.key)}>
          Remove
        </Button>
      ),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        padding: 24,
        backgroundColor: "#f5f6f8",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 980,
          background: "#fff",
          padding: 20,
          borderRadius: 10,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <Form layout="vertical" form={form} onFinish={handleFinish}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Title level={4} style={{ margin: 0 }}>
              POS Entry
            </Title>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <small style={{ color: "#888" }}>
                F2/Ctrl+K: Search • Ctrl+S: Submit • Ctrl+N: Add line
              </small>
              <Button loading={syncing} onClick={syncItems} size="small">
                Sync Items
              </Button>
            </div>
          </div>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="customer"
                label="Customer"
                rules={[{ required: true }]}
              >
                <Input placeholder="Customer name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="voucherDate"
                label="Voucher Date"
                rules={[{ required: true }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="voucherNo"
                label="Voucher No"
                rules={[{ required: true }]}
              >
                <Input placeholder="Auto or manual" />
              </Form.Item>
            </Col>
          </Row>

          {/* Hidden but focused barcode input */}
          <input
            ref={barcodeInputRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleBarcodeEnter();
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              opacity: 0,
              width: 1,
              height: 1,
              zIndex: -1,
            }}
            aria-hidden
          />

          <Divider>Item Entry</Divider>
          <Row gutter={12} align="middle">
            <Col span={10}>
              {/* Local-cache backed autocomplete */}
              <AutoComplete
                id="item-search"
                style={{ width: "100%" }}
                placeholder="Search item (F2 for popup)"
                value={selectedItem.itemName}
                options={itemOptions}
                onSearch={(txt) =>
                  setSelectedItem((s) => ({ ...s, itemName: txt }))
                }
                onSelect={(_, opt) =>
                  setSelectedItem((s) => ({
                    ...s,
                    itemName: opt.data?.name ?? opt.label,
                    rate: opt.data?.rate ?? s.rate,
                    id: opt.data?.id ?? null,
                  }))
                }
                filterOption={false}
              >
                <Input onPressEnter={handleAddItem} />
              </AutoComplete>
            </Col>
            <Col span={4}>
              <InputNumber
                id="qty-input"
                placeholder="Qty"
                value={selectedItem.qty}
                min={1}
                style={{ width: "100%" }}
                onChange={(qty) => setSelectedItem((s) => ({ ...s, qty }))}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              />
            </Col>
            <Col span={4}>
              <InputNumber
                placeholder="Rate"
                value={selectedItem.rate}
                min={0}
                style={{ width: "100%" }}
                onChange={(rate) => setSelectedItem((s) => ({ ...s, rate }))}
                onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
              />
            </Col>
            <Col span={6} style={{ display: "flex", gap: 8 }}>
              <Button type="primary" onClick={handleAddItem} style={{ flex: 1 }}>
                Add (Enter)
              </Button>
              {/* Optional: allow adding a quick item into local cache */}
              <Button
                onClick={() => {
                  const name = (selectedItem.itemName || "").trim();
                  const rate = Number(selectedItem.rate) || 0;
                  if (!name) return message.error("Enter item name to add to cache");
                  const newItem = {
                    id: crypto.randomUUID(),
                    name,
                    barcode: "",
                    rate,
                  };
                  const next = [newItem, ...(cache || [])];
                  setCache(next);
                  saveCache(next);
                  message.success("Item added to local cache");
                }}
              >
                + Cache
              </Button>
            </Col>
          </Row>

          <Table
            style={{ marginTop: 16 }}
            columns={columns}
            dataSource={items}
            pagination={false}
            bordered
            size="small"
            rowKey="key"
          />

          <Divider>Summary</Divider>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Total">
                <Input value={totalAmount.toFixed(2)} readOnly />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="tendered"
                label="Amount Tendered"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item shouldUpdate>
                {() => {
                  const tendered = form.getFieldValue("tendered") || 0;
                  const balance = (Number(tendered) || 0) - totalAmount;
                  return (
                    <Form.Item label="Balance">
                      <Input value={balance.toFixed(2)} readOnly />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Divider />
          <Row gutter={12}>
            <Col>
              <Button type="primary" htmlType="submit">
                Submit (Ctrl+S)
              </Button>
            </Col>
            <Col>
              <Button
                onClick={() => {
                  form.resetFields();
                  setItems([]);
                  setSelectedItem({ itemName: "", qty: 1, rate: 0, id: null });
                  setTotalAmount(0);
                }}
              >
                Reset
              </Button>
            </Col>
          </Row>
        </Form>

        {/* Print section */}
        {billToPrint && (
          <>
            <ReactToPrint
              trigger={() => (
                <button ref={printTriggerRef} style={{ display: "none" }}>
                  Print
                </button>
              )}
              content={() => printContentRef.current}
            />
            <div style={{ display: "none" }}>
              <InvoicePrint ref={printContentRef} bill={billToPrint} />
            </div>
          </>
        )}
      </div>

      {/* Popup Local Search (F2 / Ctrl+K) */}
      <Modal
        title="Search Items (Local Cache)"
        open={searchOpen}
        onCancel={() => setSearchOpen(false)}
        footer={null}
        width={720}
        bodyStyle={{ paddingTop: 8 }}
      >
        <Input
          id="search-input"
          placeholder="Type to search name / code / barcode"
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
        <div
          style={{
            marginTop: 8,
            maxHeight: 360,
            overflow: "auto",
            border: "1px solid #eee",
            borderRadius: 6,
          }}
        >
          <List
            dataSource={filtered}
            renderItem={(it, idx) => (
              <List.Item
                onClick={() => selectFromCache(it)}
                style={{
                  cursor: "pointer",
                  background:
                    idx === searchIndex ? "rgba(24,144,255,0.08)" : undefined,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div>
                    <b>{it.name}</b>{" "}
                    <span style={{ color: "#999" }}>({it.id})</span>
                  </div>
                  <div style={{ color: "#666" }}>
                    ₹ {Number(it.rate || 0).toFixed(2)}
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Modal>
    </div>
  );
};

export default POSEntry;
