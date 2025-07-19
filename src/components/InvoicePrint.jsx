import React, { forwardRef } from "react";
import { Typography, Table } from "antd";
import "./invoice.css"; // Custom CSS for 80mm

const { Title, Text } = Typography;

const InvoicePrint = forwardRef(({ bill }, ref) => {
  const columns = [
    { title: "Item", dataIndex: "itemName", key: "itemName" },
    { title: "Qty", dataIndex: "qty", key: "qty", width: 40 },
    { title: "Rate", dataIndex: "rate", key: "rate", width: 60 },
    { title: "Amount", dataIndex: "amount", key: "amount", width: 70 },
  ];

  return (
    <div className="receipt-container" ref={ref}>
      <div className="receipt-header">
        <img src="/logo.png" alt="Logo" className="receipt-logo" />
        <Title level={5} style={{ marginBottom: 0 }}>My Store</Title>
        <Text>123 Main Street</Text><br />
        <Text>GSTIN: 1234567890</Text>
      </div>

      <div className="receipt-info">
        <Text>Customer: {bill.customer}</Text><br />
        <Text>Date: {bill.voucherDate}</Text><br />
        <Text>Voucher #: {bill.voucherNo}</Text>
      </div>

      <Table
        dataSource={bill.items}
        columns={columns}
        pagination={false}
        size="small"
        bordered
        className="receipt-table"
      />

      <div className="receipt-summary">
        <Text strong>Total: ₹{bill.totalAmount.toFixed(2)}</Text><br />
        <Text>Tendered: ₹{bill.tendered}</Text><br />
        <Text>Balance: ₹{(bill.tendered - bill.totalAmount).toFixed(2)}</Text>
      </div>

      <div className="receipt-footer">
        <Text>Thank you! Visit Again</Text>
      </div>
    </div>
  );
});

export default InvoicePrint;
