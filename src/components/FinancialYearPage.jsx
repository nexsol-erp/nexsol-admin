import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  Switch,
  Tag,
  message,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";

const { Title, Text } = Typography;

function getTenantAndToken() {
  const tenantId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  if (!tenantId) throw new Error("tenancyId missing in localStorage");
  if (!token) throw new Error("jwtToken missing in localStorage");
  return { tenantId, token };
}

async function apiFetch(path, options = {}) {
  const { tenantId, token } = getTenantAndToken();
  const res = await fetch(`/api/${tenantId}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  // some endpoints may return empty body
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

function fyStatusTag(active, locked) {
  if (active) return <Tag color="green">ACTIVE</Tag>;
  if (locked) return <Tag color="red">LOCKED</Tag>;
  return <Tag>INACTIVE</Tag>;
}

export default function FinancialYearPage() {
  const [loading, setLoading] = useState(false);
  const [activeFY, setActiveFY] = useState(null);
  const [fyList, setFyList] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();

  const columns = useMemo(
    () => [
      {
        title: "FY Code",
        dataIndex: "fyCode",
        key: "fyCode",
        render: (v) => <Text strong>{v}</Text>,
      },
      {
        title: "Start",
        dataIndex: "startDate",
        key: "startDate",
        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : "-"),
      },
      {
        title: "End",
        dataIndex: "endDate",
        key: "endDate",
        render: (v) => (v ? dayjs(v).format("YYYY-MM-DD") : "-"),
      },
      {
        title: "Status",
        key: "status",
        render: (_, r) => fyStatusTag(r.active, r.locked),
      },
      {
        title: "Actions",
        key: "actions",
        render: (_, r) => (
          <Space>
            <Button
              type="primary"
              disabled={r.active || r.locked}
              onClick={() => onActivate(r.id)}
            >
              Activate
            </Button>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fyList]
  );

  async function loadAll() {
    setLoading(true);
    try {
      const [active, list] = await Promise.all([
        apiFetch("/financial-year/active", { method: "GET" }).catch(() => null),
        apiFetch("/financial-year", { method: "GET" }),
      ]);
      setActiveFY(active);
      setFyList(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error(e.message || "Failed to load financial years");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function onActivate(fyId) {
    Modal.confirm({
      title: "Activate this Financial Year?",
      content: "Voucher numbering will reset for the new active financial year.",
      okText: "Activate",
      onOk: async () => {
        setLoading(true);
        try {
          await apiFetch(`/financial-year/${fyId}/activate`, { method: "POST" });
          message.success("Financial year activated");
          await loadAll();
        } catch (e) {
          message.error(e.message || "Activation failed");
        } finally {
          setLoading(false);
        }
      },
    });
  }

  function openCreate() {
    // Default FY code suggestion: based on selected start year later
    createForm.resetFields();
    createForm.setFieldsValue({
      makeActive: true,
      fyCode: "",
      startDate: dayjs().month(3).date(1), // April 1 (month is 0-indexed)
      endDate: dayjs().add(1, "year").month(2).date(31), // next Mar 31
    });
    setCreateOpen(true);
  }

  async function onCreateSubmit() {
    try {
      const values = await createForm.validateFields();

      const payload = {
        fyCode: values.fyCode,
        startDate: values.startDate.format("YYYY-MM-DD"),
        endDate: values.endDate.format("YYYY-MM-DD"),
        makeActive: !!values.makeActive,
      };

      setLoading(true);
      await apiFetch("/financial-year", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      message.success("Financial year created");
      setCreateOpen(false);
      await loadAll();
    } catch (e) {
      // antd validation throws object; fetch throws Error
      if (e?.errorFields) return;
      message.error(e.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  // Auto-fill FY code when start/end changes (optional convenience)
  function autoFillFyCode() {
    const s = createForm.getFieldValue("startDate");
    const e = createForm.getFieldValue("endDate");
    if (!s || !e) return;
    const startYear = dayjs(s).year();
    const endYear = dayjs(e).year();
    // common format: 2025-2026
    createForm.setFieldsValue({ fyCode: `${startYear}-${endYear}` });
  }

  return (
    <div style={{ padding: 16 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card
            title="Active Financial Year"
            loading={loading}
            extra={
              <Button onClick={loadAll} disabled={loading}>
                Refresh
              </Button>
            }
          >
            {activeFY ? (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>FY Code:</Text> <Text>{activeFY.fyCode}</Text>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Start:</Text>{" "}
                  <Text>{dayjs(activeFY.startDate).format("YYYY-MM-DD")}</Text>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>End:</Text>{" "}
                  <Text>{dayjs(activeFY.endDate).format("YYYY-MM-DD")}</Text>
                </div>
                <div>{fyStatusTag(activeFY.active, activeFY.locked)}</div>
                <div style={{ marginTop: 12 }}>
                  <Text type="secondary">
                    Vouchers outside this date range will be rejected by backend.
                  </Text>
                </div>
              </>
            ) : (
              <Text type="warning">
                No active financial year found. Create one and activate.
              </Text>
            )}
          </Card>

          <Card style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Button type="primary" onClick={openCreate} block>
                Create Financial Year
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} md={16}>
          <Card
            title={<Title level={5} style={{ margin: 0 }}>Financial Years</Title>}
            loading={loading}
          >
            <Table
              rowKey="id"
              columns={columns}
              dataSource={fyList}
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Create Financial Year"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreateSubmit}
        okText="Save"
        confirmLoading={loading}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="Start Date"
            name="startDate"
            rules={[{ required: true, message: "Start date is required" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              onChange={() => autoFillFyCode()}
            />
          </Form.Item>

          <Form.Item
            label="End Date"
            name="endDate"
            rules={[{ required: true, message: "End date is required" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              format="YYYY-MM-DD"
              onChange={() => autoFillFyCode()}
            />
          </Form.Item>

          <Form.Item
            label="FY Code"
            name="fyCode"
            rules={[{ required: true, message: "FY code is required" }]}
            extra='Example: "2025-2026"'
          >
            <Input placeholder="2025-2026" />
          </Form.Item>

          <Form.Item label="Make Active" name="makeActive" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Text type="secondary">
            Tip: If you activate a new FY, voucher numbers start again from 1
            per voucher type.
          </Text>
        </Form>
      </Modal>
    </div>
  );
}
