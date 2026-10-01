import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, App, AutoComplete, Button, Card, Col, Input, Radio, Row, Select, Space, Table, Tag, Typography } from "antd";
import { wb, kg, showDate } from "../api";

const EMPTY = { vehicleNumber: "", wheelType: "", material: "", mobileNumber: "", kind: "none", sourceId: "" };

export default function WeighingPage({ active }) {
  const { message, modal } = App.useApp();
  const [reading, setReading] = useState(null);
  const [signal, setSignal] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [rates, setRates] = useState([]);
  const [history, setHistory] = useState({ weights: [], tares: [] });
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [materialOptions, setMaterialOptions] = useState([]);
  const [quote, setQuote] = useState(null);
  const [saving, setSaving] = useState(false);
  const [last, setLast] = useState(null);
  const [bump, setBump] = useState(0); // re-read the vehicle's history
  // A vehicle's saved wheel type is locked; it can only be changed in the web admin.
  const [lock, setLock] = useState({ vehicle: "", wheelType: "" });
  const vehicleRef = useRef(null);

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

  useEffect(() => {
    if (!active) return;
    wb("rates").then((r) => setRates(r.rates)).catch(() => {});
    setTimeout(() => vehicleRef.current?.focus(), 50);
  }, [active]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // vehicle typed: suggestions, its wheel type and its history
  useEffect(() => {
    const v = form.vehicleNumber;
    const t = setTimeout(async () => {
      try {
        const [veh, hist] = await Promise.all([wb("vehicles", { prefix: v }), v ? wb("history", { vehicleNumber: v }) : null]);
        setVehicleOptions(veh.vehicles.map((x) => ({ value: x.vehicleNumber, label: `${x.vehicleNumber}${x.wheelType ? `  ·  ${x.wheelType}` : ""}` })));
        setHistory(hist ? { weights: hist.weights, tares: hist.tares } : { weights: [], tares: [] });
        setLock({ vehicle: v, wheelType: hist?.wheelLocked ? hist.wheelType : "" });
        if (hist?.wheelLocked) {
          setForm((f) => (f.vehicleNumber !== v ? f : { ...f, wheelType: hist.wheelType }));
        }
      } catch (_) { /* typing */ }
    }, 250);
    return () => clearTimeout(t);
  }, [form.vehicleNumber, last, bump]);

  // amount, first weight and net weight, worked out by the same code that saves
  const weight = reading?.weight || 0;
  useEffect(() => {
    wb("quote", {
      vehicleNumber: form.vehicleNumber,
      wheelType: form.wheelType,
      source: form.kind === "none" ? { kind: "none" } : { kind: form.kind, id: form.sourceId },
      weight,
    }).then((r) => setQuote(r.quote)).catch(() => setQuote(null));
  }, [form.vehicleNumber, form.wheelType, form.kind, form.sourceId, weight]);

  const fresh = reading && signal && Date.now() - reading.at < 5000;
  const wheelLocked = !!lock.wheelType && lock.vehicle === form.vehicleNumber;
  const canSave = fresh && reading.stable && !reading.overload && weight > 0 && form.vehicleNumber && form.wheelType
    && (form.kind === "none" || form.sourceId);

  const save = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { row, print } = await wb("save", {
        vehicleNumber: form.vehicleNumber,
        wheelType: form.wheelType,
        material: form.material,
        mobileNumber: form.mobileNumber,
        source: form.kind === "none" ? { kind: "none" } : { kind: form.kind, id: form.sourceId },
      });
      setLast({ row, print });
      if (print.error) message.warning(`Saved voucher ${row.voucher_number}, but printing failed: ${print.error}`);
      else message.success(`Saved voucher ${row.voucher_number}`);
      setForm(EMPTY);
      setTimeout(() => vehicleRef.current?.focus(), 50);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  }, [canSave, saving, form, message]);

  // F9 or Ctrl+S saves, like a till
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === "F9" || (e.ctrlKey && e.key.toLowerCase() === "s")) { e.preventDefault(); save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, save]);

  const saveTareFromBridge = () => {
    if (!form.vehicleNumber) { message.warning("Enter the vehicle number first"); return; }
    modal.confirm({
      title: `Save ${kg(weight)} kg as the tare weight of ${form.vehicleNumber}?`,
      content: "Only do this when the vehicle is empty.",
      okText: "Save tare weight",
      onOk: async () => {
        try {
          const r = await wb("saveTare", { vehicleNumber: form.vehicleNumber, wheelType: form.wheelType, fromBridge: true });
          message.success(`Tare weight saved (${r.tare.voucher_number})`);
          setBump((n) => n + 1);
        } catch (e) { message.error(e.message); }
      },
    });
  };

  const pickPrevious = (row) => set({ kind: "previous", sourceId: row.id });
  const pickTare = (row) => set({ kind: "tare", sourceId: row.id });

  const openId = history.weights.find((w) => w.roundTrip === 0)?.id;

  return (
    <Row gutter={16}>
      <Col xs={24} lg={13}>
        <WeightPanel reading={reading} fresh={fresh} status={status} />

        <Card style={{ marginTop: 12 }} styles={{ body: { paddingBottom: 8 } }}>
          <Row gutter={12}>
            <Col span={12}>
              <Label>Vehicle number</Label>
              <AutoComplete style={{ width: "100%" }} options={vehicleOptions} value={form.vehicleNumber}
                onChange={(v) => { set({ vehicleNumber: String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), wheelType: "", kind: "none", sourceId: "" }); }}>
                <Input ref={vehicleRef} size="large" placeholder="KL07AB1234" style={{ fontWeight: 700, letterSpacing: 1 }} />
              </AutoComplete>
            </Col>
            <Col span={12}>
              <Label>
                Wheel type
                {wheelLocked && <span style={{ marginLeft: 8, color: "#888", fontWeight: 400 }}>locked · change in web admin</span>}
              </Label>
              <Select size="large" style={{ width: "100%" }} value={form.wheelType || undefined} onChange={(v) => set({ wheelType: v })}
                disabled={wheelLocked}
                placeholder="Select" options={rates.map((r) => ({ value: r.wheelType, label: `${r.wheelType}  ·  ₹${r.wheelRate}` }))} />
            </Col>
            <Col span={12} style={{ marginTop: 10 }}>
              <Label>Material</Label>
              <AutoComplete style={{ width: "100%" }} options={materialOptions.map((m) => ({ value: m }))} value={form.material}
                onSearch={(p) => wb("materials", { prefix: p }).then((r) => setMaterialOptions(r.materials)).catch(() => {})}
                onChange={(v) => set({ material: v })}>
                <Input size="large" placeholder="Sand, Metal…" />
              </AutoComplete>
            </Col>
            <Col span={12} style={{ marginTop: 10 }}>
              <Label>Driver mobile</Label>
              <Input size="large" value={form.mobileNumber} maxLength={15} onChange={(e) => set({ mobileNumber: e.target.value.replace(/\D/g, "") })} />
            </Col>
          </Row>

          <div style={{ marginTop: 14 }}>
            <Radio.Group value={form.kind} onChange={(e) => set({ kind: e.target.value, sourceId: "" })} optionType="button" buttonStyle="solid" size="large">
              <Radio.Button value="none">New weighing</Radio.Button>
              <Radio.Button value="previous">Use previous weight</Radio.Button>
              <Radio.Button value="tare">Use tare weight</Radio.Button>
            </Radio.Group>
          </div>

          <Row gutter={12} style={{ marginTop: 14 }} align="middle">
            <Col span={12}>
              <div className="amount-box">
                <div style={{ color: "#555" }}>Amount</div>
                <div className="value">₹ {(quote?.amount ?? 0).toFixed(2)}</div>
                <div style={{ color: "#777", fontSize: 13 }}>{form.wheelType ? quote?.reason : "Select the wheel type"}</div>
              </div>
            </Col>
            <Col span={12}>
              <Stat label={form.kind === "tare" ? "Tare weight" : "First weight"} value={quote?.firstWeight ? `${kg(quote.firstWeight)} kg` : "—"} sub={quote?.firstWeightDate ? showDate(quote.firstWeightDate) : ""} />
              <Stat label="Net weight" value={quote?.netWeight ? `${kg(quote.netWeight)} kg` : "—"} big />
            </Col>
          </Row>

          <Space style={{ marginTop: 14, marginBottom: 6 }} wrap>
            <Button type="primary" size="large" disabled={!canSave} loading={saving} onClick={save} style={{ minWidth: 200, height: 52, fontSize: 18 }}>
              Save &amp; Print (F9)
            </Button>
            <Button size="large" onClick={() => setForm(EMPTY)}>Clear</Button>
            <Button size="large" onClick={saveTareFromBridge} disabled={!fresh || !reading?.stable || !form.vehicleNumber}>Save as tare weight</Button>
          </Space>
          {!canSave && <Hint reading={reading} fresh={fresh} form={form} />}
        </Card>
      </Col>

      <Col xs={24} lg={11}>
        {last && <LastVoucher last={last} />}

        {form.kind !== "tare" && (
          <Card size="small" title={`Previous weighings${form.vehicleNumber ? ` · ${form.vehicleNumber}` : ""}`} style={{ marginTop: last ? 12 : 0 }}>
            <Table size="small" rowKey="id" pagination={false} scroll={{ y: 300 }} dataSource={history.weights}
              locale={{ emptyText: form.vehicleNumber ? "No earlier weighings for this vehicle" : "Type a vehicle number" }}
              rowClassName={(r) => (r.id === openId ? "row-open" : "")}
              onRow={(r) => ({ onClick: () => pickPrevious(r), style: { cursor: "pointer" } })}
              rowSelection={form.kind === "previous" ? { type: "radio", selectedRowKeys: [form.sourceId], onChange: (k) => set({ sourceId: k[0] }) } : undefined}
              columns={[
                { title: "Voucher", dataIndex: "voucherNumber", width: 80 },
                { title: "Date", dataIndex: "voucherDate", render: showDate, width: 130 },
                { title: "Weight", dataIndex: "weight", render: (v) => `${kg(v)} kg`, align: "right" },
                { title: "Paid", dataIndex: "amount", render: (v) => `₹${Number(v || 0).toFixed(0)}`, align: "right", width: 70 },
                { title: "", dataIndex: "roundTrip", width: 110, render: (v, r) => (r.id === openId ? <Tag color="green">Open · free return</Tag> : <Tag>Closed</Tag>) },
              ]} />
          </Card>
        )}

        {form.kind === "tare" && (
          <Card size="small" title={`Saved tare weights · ${form.vehicleNumber || ""}`} style={{ marginTop: last ? 12 : 0 }}>
            <Table size="small" rowKey="id" pagination={false} dataSource={history.tares}
              locale={{ emptyText: "No tare weight saved for this vehicle" }}
              onRow={(r) => ({ onClick: () => pickTare(r), style: { cursor: "pointer" } })}
              rowSelection={{ type: "radio", selectedRowKeys: [form.sourceId], onChange: (k) => set({ sourceId: k[0] }) }}
              columns={[
                { title: "Voucher", dataIndex: "voucherNumber", width: 80 },
                { title: "Date", dataIndex: "voucherDate", render: showDate },
                { title: "Tare", dataIndex: "tareWeight", render: (v) => `${kg(v)} kg`, align: "right" },
              ]} />
          </Card>
        )}
      </Col>
    </Row>
  );
}

function WeightPanel({ reading, fresh, status }) {
  const connected = status?.state === "connected";
  const w = fresh ? reading.weight : null;
  const color = !fresh ? "#546e7a" : reading.overload ? "#ff5252" : reading.stable ? "#00e676" : "#ffd54f";
  return (
    <div className="weight-panel">
      {reading?.simulated && <Tag color="magenta" style={{ marginBottom: 6 }}>SIMULATOR</Tag>}
      <div className="weight-digits" style={{ color }}>
        {w === null ? "------" : kg(w)} <span style={{ fontSize: 32 }}>kg</span>
      </div>
      <div className="weight-meta">
        <span>
          {!connected ? <Tag color="red">{status?.message || "Indicator not connected"}</Tag>
            : !fresh ? <Tag color="orange">No signal from indicator</Tag>
              : reading.overload ? <Tag color="red">OVERLOAD</Tag>
                : reading.stable ? <Tag color="green">STABLE</Tag> : <Tag color="gold">MOVING</Tag>}
        </span>
        <span>{connected ? status.message : ""}</span>
      </div>
    </div>
  );
}

function LastVoucher({ last }) {
  const { message } = App.useApp();
  const { row, print } = last;
  return (
    <Card size="small" title={`Last voucher ${row.voucher_number}`} extra={
      <Button size="small" onClick={() => wb("reprint", { id: row.id }).then((r) => (r.print.error ? message.error(r.print.error) : message.success("Sent to printer"))).catch((e) => message.error(e.message))}>Reprint</Button>
    }>
      <Space size="large" wrap>
        <span><b>{row.vehicle_number}</b></span>
        <span>{kg(row.lcd_number)} kg</span>
        {row.first_weight ? <span>Net {kg(Math.abs(row.lcd_number - row.first_weight))} kg</span> : null}
        <span>₹{Number(row.amount).toFixed(2)}</span>
        {print.printed ? <Tag color="green">Printed</Tag> : <Tag color="red">Not printed</Tag>}
      </Space>
    </Card>
  );
}

function Hint({ reading, fresh, form }) {
  let text = "";
  if (!form.vehicleNumber) text = "Enter the vehicle number.";
  else if (!form.wheelType) text = "Select the wheel type.";
  else if (form.kind !== "none" && !form.sourceId) text = form.kind === "tare" ? "Pick a saved tare weight." : "Pick the previous weighing on the right.";
  else if (!fresh) text = "Waiting for a reading from the weighbridge.";
  else if (reading.overload) text = "The indicator shows overload.";
  else if (!(reading.weight > 0)) text = "No weight on the bridge.";
  else if (!reading.stable) text = "Waiting for the weight to settle.";
  return text ? <Alert type="info" showIcon message={text} style={{ marginTop: 6 }} /> : null;
}

const Label = ({ children }) => <div style={{ fontSize: 13, color: "#555", marginBottom: 2 }}>{children}</div>;

function Stat({ label, value, sub, big }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 13, color: "#555" }}>{label}</div>
      <Typography.Text strong style={{ fontSize: big ? 24 : 18 }}>{value}</Typography.Text>
      {sub && <div style={{ fontSize: 12, color: "#888" }}>{sub}</div>}
    </div>
  );
}
