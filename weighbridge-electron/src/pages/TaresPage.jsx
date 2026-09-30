import React, { useEffect, useState } from "react";
import { App, Button, Card, Input, InputNumber, Select, Space, Table, Tag } from "antd";
import { wb, kg, showDate } from "../api";

// Empty weights of regular vehicles (Qt: TARE WEIGHT screen). Typed in here, or taken from
// the bridge on the Weighing screen.
export default function TaresPage({ active }) {
  const { message } = App.useApp();
  const [tares, setTares] = useState([]);
  const [rates, setRates] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ vehicleNumber: "", wheelType: "", tareWeight: null });

  const load = () => wb("tares").then((r) => setTares(r.tares)).catch((e) => message.error(e.message));
  useEffect(() => {
    if (!active) return;
    load();
    wb("rates").then((r) => setRates(r.rates)).catch(() => {});
  }, [active]);

  const save = async () => {
    try {
      const r = await wb("saveTare", form);
      message.success(`Tare weight saved (${r.tare.voucher_number})`);
      setForm({ vehicleNumber: "", wheelType: "", tareWeight: null });
      load();
    } catch (e) { message.error(e.message); }
  };

  const shown = filter ? tares.filter((t) => t.vehicleNumber.includes(filter.toUpperCase())) : tares;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small" title="Add a tare weight">
        <Space wrap>
          <Input size="large" placeholder="Vehicle number" value={form.vehicleNumber} style={{ width: 200 }}
            onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
          <Select size="large" placeholder="Wheel type" style={{ width: 200 }} value={form.wheelType || undefined}
            onChange={(v) => setForm({ ...form, wheelType: v })} options={rates.map((r) => ({ value: r.wheelType, label: r.wheelType }))} />
          <InputNumber size="large" placeholder="Tare weight" min={1} addonAfter="kg" value={form.tareWeight} style={{ width: 200 }}
            onChange={(v) => setForm({ ...form, tareWeight: v })} />
          <Button size="large" type="primary" onClick={save} disabled={!form.vehicleNumber || !form.tareWeight}>Save</Button>
        </Space>
      </Card>
      <Card size="small" title="Saved tare weights" extra={<Input.Search placeholder="Vehicle" allowClear onChange={(e) => setFilter(e.target.value)} style={{ width: 220 }} />}>
        <Table size="small" rowKey="id" dataSource={shown} pagination={{ pageSize: 15 }} columns={[
          { title: "Voucher", dataIndex: "voucherNumber", width: 100 },
          { title: "Date", dataIndex: "voucherDate", render: showDate, width: 160 },
          { title: "Vehicle", dataIndex: "vehicleNumber" },
          { title: "Wheel type", dataIndex: "wheelType" },
          { title: "Tare", dataIndex: "tareWeight", align: "right", render: (v) => `${kg(v)} kg` },
          { title: "", dataIndex: "synced", width: 90, render: (v) => (v ? <Tag color="green">Uploaded</Tag> : <Tag color="gold">Waiting</Tag>) },
        ]} />
      </Card>
    </Space>
  );
}
