import React, { useState, useRef, useEffect } from "react";
import {
  Form, Input, InputNumber, Button, AutoComplete, Table, Row, Col, Divider, Typography, message,
} from "antd";
import ReactToPrint from 'react-to-print';
import InvoicePrint from './InvoicePrint';

const { Title } = Typography;

const POSEntry = () => {
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [itemOptions, setItemOptions] = useState([]);
  const [selectedItem, setSelectedItem] = useState({ itemName: "", qty: 1, rate: 0 });
  const [barcode, setBarcode] = useState("");
  const [billToPrint, setBillToPrint] = useState(null);

  const barcodeInputRef = useRef();
  const printTriggerRef = useRef();
  const printContentRef = useRef();

  useEffect(() => {
    const focusInput = () => barcodeInputRef.current?.focus();
    window.addEventListener("keydown", focusInput);
    return () => window.removeEventListener("keydown", focusInput);
  }, []);

  const handleSearchItem = async (value) => {
    if (value.length < 2) return;
    const res = await fetch(`/api/items?search=${value}`);
    const data = await res.json();
    setItemOptions(data.map((item) => ({
      value: item.id,
      label: item.name,
      rate: item.rate,
    })));
  };

  const handleBarcodeEnter = async () => {
    try {
      const res = await fetch(`/api/items/barcode/${barcode}`);
      const item = await res.json();
      if (!item) return message.error("Item not found");
      setSelectedItem({ itemName: item.name, rate: item.rate, qty: 1 });
    } catch {
      message.error("Barcode lookup failed");
    }
    setBarcode("");
  };

  const handleAddItem = () => {
    const { itemName, qty, rate } = selectedItem;
    if (!itemName || !qty || !rate) {
      return message.error("Fill item, qty, rate");
    }
    const amount = qty * rate;
    const newItem = { key: Date.now(), itemName, qty, rate, amount };
    const updated = [...items, newItem];
    setItems(updated);
    setTotalAmount(updated.reduce((sum, item) => sum + item.amount, 0));
    setSelectedItem({ itemName: "", qty: 1, rate: 0 });
  };

  const handleRemoveItem = (key) => {
    const updated = items.filter((item) => item.key !== key);
    setItems(updated);
    setTotalAmount(updated.reduce((sum, item) => sum + item.amount, 0));
  };

  const handleFinish = (values) => {
    const bill = {
      ...values,
      items,
      totalAmount,
    };
    setBillToPrint(bill);
    setTimeout(() => {
      printTriggerRef.current.click();
    }, 100);
    message.success("Invoice ready to print");

    form.resetFields();
    setItems([]);
    setTotalAmount(0);
    setSelectedItem({ itemName: "", qty: 1, rate: 0 });
  };

  const columns = [
    { title: "Item", dataIndex: "itemName" },
    { title: "Qty", dataIndex: "qty" },
    { title: "Rate", dataIndex: "rate" },
    { title: "Amount", dataIndex: "amount" },
    {
      title: "Action",
      render: (_, record) => (
        <Button danger size="small" onClick={() => handleRemoveItem(record.key)}>Remove</Button>
      ),
    },
  ];

  return (
    <div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "flex-start",
      minHeight: "100vh",
      padding: "40px 20px",
      backgroundColor: "#f7f7f7"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 900,
        background: "#fff",
        padding: 24,
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
      }}>
      <Form layout="vertical" form={form} onFinish={handleFinish}>
        <Title level={3}>POS Entry</Title>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="customer" label="Customer" rules={[{ required: true }]}>
              <Input placeholder="Customer name" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="voucherDate" label="Voucher Date" rules={[{ required: true }]}>
              <Input type="date" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="voucherNo" label="Voucher No" rules={[{ required: true }]}>
              <Input placeholder="Auto or manual" />
            </Form.Item>
          </Col>
        </Row>

        <Divider>Barcode Scanner</Divider>
        <Input
          ref={barcodeInputRef}
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onPressEnter={handleBarcodeEnter}
          style={{ position: "absolute", left: "-1000px" }}
        />

        <Divider>Item Entry</Divider>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <AutoComplete
              style={{ width: "100%" }}
              placeholder="Search item"
              value={selectedItem.itemName}
              onSearch={handleSearchItem}
              options={itemOptions}
              onSelect={(value, option) =>
                setSelectedItem({ ...selectedItem, itemName: option.label, rate: option.rate })
              }
              filterOption={false}
            />
          </Col>
          <Col span={4}>
            <InputNumber
              placeholder="Qty"
              value={selectedItem.qty}
              min={1}
              onChange={(qty) => setSelectedItem({ ...selectedItem, qty })}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
          </Col>
          <Col span={4}>
            <InputNumber
              placeholder="Rate"
              value={selectedItem.rate}
              min={0}
              onChange={(rate) => setSelectedItem({ ...selectedItem, rate })}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
          </Col>
          <Col span={4}>
            <Button type="primary" onClick={handleAddItem}>
              Add
            </Button>
          </Col>
        </Row>

        <Table
          style={{ marginTop: 20 }}
          columns={columns}
          dataSource={items}
          pagination={false}
          bordered
          size="small"
        />

        <Divider>Summary</Divider>
        <Row gutter={16}>
          <Col span={6}>
            <Form.Item label="Total">
              <Input value={totalAmount.toFixed(2)} readOnly />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="tendered" label="Amount Tendered" rules={[{ required: true }]}>
              <InputNumber min={0} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item shouldUpdate>
              {() => {
                const tendered = form.getFieldValue("tendered") || 0;
                const balance = tendered - totalAmount;
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
        <Row gutter={16}>
          <Col>
            <Button type="primary" htmlType="submit">Submit</Button>
          </Col>
          <Col>
            <Button
              onClick={() => {
                form.resetFields();
                setItems([]);
                setSelectedItem({ itemName: "", qty: 1, rate: 0 });
                setTotalAmount(0);
              }}
            >
              Reset
            </Button>
          </Col>
        </Row>
      </Form>

      {/* 🔒 Centralized Print Section */}
      {billToPrint && (
        <>
          <ReactToPrint
            trigger={() => <button ref={printTriggerRef} style={{ display: "none" }}>Print</button>}
            content={() => printContentRef.current}
          />
           <div style={{ display: "none" }}>
            <InvoicePrint ref={printContentRef} bill={billToPrint} />
          </div>
        </>
      )}
    </div>
  </div>
);
}
export default POSEntry;
