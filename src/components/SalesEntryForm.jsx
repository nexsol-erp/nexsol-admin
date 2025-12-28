import React, { useState, useEffect } from "react";
import {
  Form, Input, Button, Select, Table, Typography, Space, InputNumber, message, Spin
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { getItems } from "../services/apiservice";
import InvoiceGenerator from "./InvoiceGenerator";
import { useTranslation } from "react-i18next";

const { Title } = Typography;

const SalesEntryForm = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [customers, setCustomers] = useState([]);
  const [itemList, setItemList] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [salesDetails, setSalesDetails] = useState([]);
  const [savedSalesEntry, setSavedSalesEntry] = useState(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [loading, setLoading] = useState(false); // For loading state

  useEffect(() => {
    setLoading(true);
    fetchItems();
    fetchCustomers();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await getItems();
      setItemList(response.data);
      setFilteredItems(response.data);
    } catch (err) {
      message.error("Error fetching items");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/customers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setCustomers(data);
    } catch {
      message.error("Error fetching customers");
    }
  };

  const handleCustomerChange = (value) => {
    const cust = customers.find(c => c.name === value);
    if (cust) {
      form.setFieldsValue({
        customer: value,
        customerAddress: cust?.address || "",
        customerGST: cust?.gst || "",
      });
      setIsCreatingCustomer(false);
    } else {
      setIsCreatingCustomer(true);
      form.setFieldsValue({
        customerAddress: "",
        customerGST: "",
      });
    }
  };

  const handleCreateCustomer = async () => {
    setLoading(true);
    try {
      const { customer, customerAddress, customerGST } = form.getFieldsValue();
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");

      const response = await fetch(`/api/${tenancyId}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: customer, address: customerAddress, gst: customerGST }),
      });

      if (response.ok) {
        const newCustomer = await response.json();
        setCustomers([...customers, newCustomer]);
        message.success("Customer created successfully");
        setIsCreatingCustomer(false);
      } else {
        message.error("Failed to create customer");
      }
    } catch (err) {
      console.error(err);
      message.error("Error creating customer");
    } finally {
      setLoading(false);
    }
  };

  const handleItemSearch = (val) => {
    const filtered = itemList.filter(item =>
      item.itemName.toLowerCase().includes(val.toLowerCase())
    );
    setFilteredItems(filtered);
  };

  const handleItemSelect = (itemName) => {
    const item = itemList.find(i => i.itemName === itemName);
    if (item) {
      form.setFieldsValue({
        barcode: item.barcode,
        standardPrice: item.standardPrice,
        taxRate: item.taxRate,
        quantity: 1,
        amount: item.standardPrice,
      });
    }
  };

  const handleBarcodeEnter = (e) => {
    if (e.key === "Enter") {
      const found = itemList.find(i => i.barcode === e.target.value);
      if (found) {
        form.setFieldsValue({
          itemName: found.itemName,
          barcode: found.barcode,
          standardPrice: found.standardPrice,
          taxRate: found.taxRate,
          quantity: 1,
          amount: found.standardPrice,
        });
      } else {
        message.warning("Item not found");
      }
    }
  };

  const handleQuantityChange = (qty) => {
    const price = form.getFieldValue("standardPrice") || 0;
    const amount = (qty * price).toFixed(2);
    form.setFieldsValue({ amount });
  };

  const handleAddItem = () => {
    const values = form.getFieldsValue([
      "itemName", "barcode", "standardPrice", "taxRate", "quantity", "amount",
    ]);

    if (!values.itemName || !values.quantity || !values.standardPrice) {
      return message.warning("Please fill all item details");
    }

    const newItem = {
      itemName: values.itemName,
      barcode: values.barcode,
      standardPrice: parseFloat(values.standardPrice),
      taxRate: parseFloat(values.taxRate),
      qty: parseFloat(values.quantity),
      amount: parseFloat(values.amount),
    };

    setSalesDetails([...salesDetails, newItem]);
    form.resetFields(["itemName", "barcode", "standardPrice", "taxRate", "quantity", "amount"]);
  };

  const handleDeleteItem = (index) => {
    const updated = salesDetails.filter((_, i) => i !== index);
    setSalesDetails(updated);
  };

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const salesEntry = {
        customer: {
          name: values.customer,
          address: values.customerAddress,
          gst: values.customerGST,
        },
        branch_code: localStorage.getItem("branchCode") || "WEB",
        voucher_date: new Date().toISOString(),
        salesDetails,
      };

      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const response = await fetch(`/api/${tenancyId}/sales`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salesEntry),
      });

      if (response.ok) {
        const result = await response.json();
        const invoice = { ...salesEntry, ...result };
        setSavedSalesEntry(invoice);
        form.resetFields();
        setSalesDetails([]);
        message.success(t("salesEntrySuccess"));
      } else {
        message.error(t("salesEntryFailure"));
      }
    } catch (err) {
      console.error(err);
      message.error(t("salesEntryError"));
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: t("itemName"), dataIndex: "itemName" },
    { title: t("barcode"), dataIndex: "barcode" },
    { title: t("standardPrice"), dataIndex: "standardPrice" },
    { title: t("taxRate"), dataIndex: "taxRate" },
    { title: t("quantity"), dataIndex: "qty" },
    { title: t("totalAmount"), dataIndex: "amount" },
    {
      title: t("actions"),
      render: (_, __, index) => (
        <Button icon={<DeleteOutlined />} danger onClick={() => handleDeleteItem(index)} />
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "auto", background: '#f5f5f5', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}>
      <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>{t("salesEntry")}</Title>

      <Form layout="vertical" form={form} onFinish={handleSave}>
        <Form.Item name="customer" label={t("customer")} rules={[{ required: true }]}> 
          <Select onChange={handleCustomerChange} showSearch placeholder={t("selectCustomer")}>
            {customers.map((cust) => (
              <Select.Option key={cust.id} value={cust.name}>
                {cust.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {isCreatingCustomer && (
          <>
            <Form.Item name="customerAddress" label={t("customerAddress")}>
              <Input placeholder={t("enterAddress")} />
            </Form.Item>

            <Form.Item name="customerGST" label={t("customerGST")}>
              <Input placeholder={t("enterGST")} />
            </Form.Item>
            <Button type="primary" onClick={handleCreateCustomer}>
              {t("createCustomer")}
            </Button>
          </>
        )}

        <Form.Item name="customerAddress" label={t("customerAddress")}>
          <Input.TextArea autoSize readOnly />
        </Form.Item>

        <Form.Item name="customerGST" label={t("customerGST")}>
          <Input readOnly />
        </Form.Item>

        <Title level={5}>{t("addItem")}</Title>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Input
            placeholder={t("barcode")}
            onKeyDown={handleBarcodeEnter}
            style={{ width: 120 }}
            value={form.getFieldValue("barcode")}
            onChange={e => form.setFieldsValue({ barcode: e.target.value })}
          />
          <Select
            placeholder={t("itemName")}
            showSearch
            style={{ width: 160 }}
            onSearch={handleItemSearch}
            onSelect={handleItemSelect}
            filterOption={false}
            value={form.getFieldValue("itemName")}
            onChange={val => form.setFieldsValue({ itemName: val })}
          >
            {filteredItems.map((item) => (
              <Select.Option key={item.item_id} value={item.itemName}>
                {item.itemName}
              </Select.Option>
            ))}
          </Select>
          <InputNumber
            placeholder={t("standardPrice")}
            disabled
            style={{ width: 100 }}
            value={form.getFieldValue("standardPrice")}
          />
          <InputNumber
            placeholder={t("taxRate")}
            disabled
            style={{ width: 80 }}
            value={form.getFieldValue("taxRate")}
          />
          <InputNumber
            placeholder={t("quantity")}
            min={1}
            style={{ width: 80 }}
            value={form.getFieldValue("quantity")}
            onChange={handleQuantityChange}
          />
          <Input
            placeholder={t("totalAmount")}
            disabled
            style={{ width: 100 }}
            value={form.getFieldValue("amount")}
          />
          <Button type="primary" onClick={handleAddItem}>
            {t("addItem")}
          </Button>
        </div>

        <Table
          style={{ marginTop: 20 }}
          columns={columns}
          dataSource={salesDetails}
          pagination={false}
          rowKey={(_, index) => index}
          footer={() => (
            <div style={{ textAlign: "right", fontWeight: "bold" }}>
              {t("grandTotal")}: ₹{salesDetails.reduce((sum, i) => sum + (i.amount || 0), 0).toFixed(2)}
            </div>
          )}
        />

        <Space style={{ marginTop: 24 }}>
          <Button type="primary" htmlType="submit" loading={loading}>
            {t("save")}
          </Button>
          {savedSalesEntry && <InvoiceGenerator salesEntry={savedSalesEntry} />}
        </Space>

        {loading && <Spin style={{ display: 'block', margin: '20px auto' }} />}
      </Form>
    </div>
  );
};

export default SalesEntryForm;
