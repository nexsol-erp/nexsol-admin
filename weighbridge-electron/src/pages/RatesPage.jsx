import React, { useEffect, useState } from "react";
import { Alert, App, Button, Card, Input, InputNumber, Space, Table } from "antd";
import { wb } from "../api";

// Charge per wheel type. Kept on the server (every branch and the web admin see the same
// list) and cached here, so weighing works offline. The newest rate for a wheel type wins.
// Rates are changed in the web admin (Weighbridge Rates); this PC can change them only while the
// web admin allows it (Weighbridge PCs). Servers without that switch keep the admin-only rule.
export default function RatesPage({ active, isAdmin, lock }) {
  const canEdit = lock?.ratesManaged ? !!lock.ratesUnlocked : isAdmin;
  const { message } = App.useApp();
  const [rates, setRates] = useState([]);
  const [form, setForm] = useState({ wheelType: "", wheelRate: null });
  const [busy, setBusy] = useState(false);

  const load = () => wb("rates").then((r) => setRates(r.rates)).catch((e) => message.error(e.message));
  useEffect(() => { if (active) load(); }, [active]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await wb("addRate", form);
      setRates(r.rates);
      setForm({ wheelType: "", wheelRate: null });
      message.success("Rate saved");
    } catch (e) { message.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Space direction="vertical" style={{ width: "100%", maxWidth: 800 }} size={12}>
      {canEdit ? (
        <Card size="small" title="Set a rate">
          <Space wrap>
            <Input size="large" placeholder="Wheel type, e.g. 10 WHEEL" style={{ width: 240 }} value={form.wheelType}
              onChange={(e) => setForm({ ...form, wheelType: e.target.value })} />
            <InputNumber size="large" min={1} addonBefore="₹" placeholder="Rate" style={{ width: 180 }} value={form.wheelRate}
              onChange={(v) => setForm({ ...form, wheelRate: v })} />
            <Button size="large" type="primary" loading={busy} onClick={save}>Save</Button>
          </Space>
          <div style={{ color: "#777", marginTop: 8, fontSize: 13 }}>Needs the internet. Changing an existing wheel type's rate applies from now on.</div>
        </Card>
      ) : (
        <Alert type="info" showIcon message={lock?.ratesManaged
          ? "Rates are set in the web admin (Weighbridge Rates). This PC can only view them. An admin can allow rate changes here from Weighbridge PCs."
          : "Only an admin can change rates."} />
      )}
      <Card size="small" title="Current rates" extra={<Button size="small" onClick={() => wb("syncNow").then(load)}>Refresh</Button>}>
        <Table size="small" rowKey="wheelType" pagination={false} dataSource={rates} columns={[
          { title: "Wheel type", dataIndex: "wheelType" },
          { title: "Rate", dataIndex: "wheelRate", align: "right", render: (v) => `₹ ${Number(v).toFixed(2)}` },
        ]} />
      </Card>
    </Space>
  );
}
