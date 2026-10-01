import React, { useEffect, useState } from "react";
import { App, Button, Card, Input, Select, Space, Table, Tag } from "antd";
import { wb, kg, showDate } from "../api";
import { WeightPanel } from "./WeighingPage";

// Empty weights of regular vehicles (Qt: TARE WEIGHT screen). The weight is always read from
// the indicator, here or with "Save as tare weight" on the Weighing screen; it can't be typed.
export default function TaresPage({ active }) {
  const { message } = App.useApp();
  const [reading, setReading] = useState(null);
  const [signal, setSignal] = useState(false);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tares, setTares] = useState([]);
  const [rates, setRates] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({ vehicleNumber: "", wheelType: "" });
  // a vehicle's saved wheel type is locked; it can only be changed in the web admin
  const [lock, setLock] = useState({ vehicle: "", wheelType: "" });

  // live weight
  useEffect(() => {
    const offs = [
      window.WB.onReading((r) => { setReading(r); setSignal(true); }),
      window.WB.onSignal((s) => setSignal(!!s.ok)),
      window.WB.onIndicatorStatus(setStatus),
    ];
    wb("indicatorConfig").then((r) => setStatus(r.status)).catch(() => {});
    return () => offs.forEach((off) => off());
  }, []);

  const load = () => wb("tares").then((r) => setTares(r.tares)).catch((e) => message.error(e.message));
  useEffect(() => {
    if (!active) return;
    load();
    wb("rates").then((r) => setRates(r.rates)).catch(() => {});
  }, [active]);

  useEffect(() => {
    const v = form.vehicleNumber;
    if (!v) { setLock({ vehicle: "", wheelType: "" }); return undefined; }
    const t = setTimeout(async () => {
      try {
        const hist = await wb("history", { vehicleNumber: v });
        setLock({ vehicle: v, wheelType: hist.wheelLocked ? hist.wheelType : "" });
        if (hist.wheelLocked) setForm((f) => (f.vehicleNumber !== v ? f : { ...f, wheelType: hist.wheelType }));
      } catch (_) { /* typing */ }
    }, 250);
    return () => clearTimeout(t);
  }, [form.vehicleNumber]);

  const wheelLocked = !!lock.wheelType && lock.vehicle === form.vehicleNumber;

  const fresh = reading && signal && Date.now() - reading.at < 5000;
  const canSave = fresh && reading.stable && !reading.overload && reading.weight > 0 && form.vehicleNumber && form.wheelType;

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const r = await wb("saveTare", { vehicleNumber: form.vehicleNumber, wheelType: form.wheelType });
      message.success(`Tare weight ${kg(r.tare.tare_weight)} kg saved (${r.tare.voucher_number})`);
      setForm({ vehicleNumber: "", wheelType: "" });
      load();
    } catch (e) { message.error(e.message); } finally { setSaving(false); }
  };

  const shown = filter ? tares.filter((t) => t.vehicleNumber.includes(filter.toUpperCase())) : tares;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small" title="Add a tare weight">
        <div style={{ maxWidth: 520, marginBottom: 12 }}><WeightPanel reading={reading} fresh={fresh} status={status} /></div>
        <Space wrap>
          <Input size="large" placeholder="Vehicle number" value={form.vehicleNumber} style={{ width: 200 }}
            onChange={(e) => { setForm({ ...form, vehicleNumber: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""), wheelType: "" }); }} />
          <Select size="large" placeholder="Wheel type" style={{ width: 200 }} value={form.wheelType || undefined}
            disabled={wheelLocked}
            onChange={(v) => setForm({ ...form, wheelType: v })} options={rates.map((r) => ({ value: r.wheelType, label: r.wheelType }))} />
          {wheelLocked && <span style={{ color: "#888" }}>Wheel type saved for this vehicle · change it in the web admin</span>}
          <Button size="large" type="primary" onClick={save} loading={saving} disabled={!canSave}>Save tare from bridge</Button>
        </Space>
        <div style={{ color: "#888", marginTop: 8 }}>Drive the empty vehicle onto the bridge. The weight is saved when the indicator reading is stable.</div>
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
