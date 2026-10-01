import React, { useEffect, useRef, useState } from "react";
import { Alert, App, Button, Card, Col, Descriptions, Divider, Input, InputNumber, Radio, Row, Select, Space, Switch, Table, Tabs, Typography } from "antd";
import { wb, showDate } from "../api";
import CameraPanel from "../components/CameraPanel";

export default function SettingsPage({ active, isAdmin, auth, lock, onChanged }) {
  const [reload, setReload] = useState(0);
  if (!active) return null;
  return (
    <>
      {!isAdmin && <Alert type="info" showIcon style={{ marginBottom: 12 }} message="Settings are read-only. Sign in as an admin to change them." />}
      {isAdmin && lock?.serverSupports && (lock.locksOnRestart || !lock.setupDone || lock.unlocked) && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={lock.locksOnRestart
          ? "Settings lock when the app is next started. To change them after that, an admin allows it in the web admin (Weighbridge PCs)."
          : lock.unlocked
            ? `Settings were opened from the web admin${lock.unlockedBy ? ` by ${lock.unlockedBy}` : ""}. They lock again after you save and restart the app.`
            : "Settings lock after the first save, from the next start. After that, only the web admin (Weighbridge PCs) can open them."} />
      )}
      <ServerCopy isAdmin={isAdmin} lock={lock} onFetched={() => { setReload((n) => n + 1); onChanged?.(); }} />
      <Tabs key={reload} tabPosition="left" items={[
        { key: "indicator", label: "Indicator", children: <IndicatorSettings isAdmin={isAdmin} /> },
        { key: "printing", label: "Printing", children: <PrintSettings isAdmin={isAdmin} /> },
        { key: "weighing", label: "Weighing", children: <WeighingSettings isAdmin={isAdmin} /> },
        { key: "camera", label: "Camera", children: <CameraSettings isAdmin={isAdmin} /> },
        { key: "data", label: "Branch & data", children: <DataSettings auth={auth} isAdmin={isAdmin} onChanged={onChanged} /> },
      ]} />
    </>
  );
}

// ── Copy on the server ───────────────────────────────────────────────────────
// Every save sends a copy of these Settings to the server. "Fetch from server" puts it back,
// after a reinstall, or copies another PC's at the same branch onto a new PC.

function ServerCopy({ isAdmin, lock, onFetched }) {
  const { message, modal } = App.useApp();
  const [info, setInfo] = useState(null); // { supported, copy }
  const [busy, setBusy] = useState(false);

  const load = () => wb("serverSettingsCopy").then(setInfo).catch(() => setInfo(null));
  useEffect(() => { load(); }, [lock?.backupSavedAt]);

  const copy = info?.copy;
  const from = copy ? (copy.thisPc ? "this PC" : copy.machineName || "another PC at this branch") : "";
  const when = copy?.savedAt ? showDate(copy.savedAt) : "";

  const fetchNow = () => modal.confirm({
    title: "Replace this PC's settings with the copy on the server?",
    content: `Indicator, printing and weighing settings saved ${when ? `on ${when} ` : ""}from ${from}${copy?.savedBy ? ` by ${copy.savedBy}` : ""}. You can change them again afterwards.`,
    okText: "Fetch from server",
    onOk: async () => {
      setBusy(true);
      try {
        await wb("fetchServerSettings");
        message.success("Settings fetched from the server");
        onFetched();
        load();
      } catch (e) {
        message.error(e.message);
      } finally {
        setBusy(false);
      }
    },
  });

  if (!info?.supported) return null;
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Text>
          {copy
            ? <>Copy on the server: saved {when && <>{when} </>}from <b>{from}</b>{copy.savedBy ? ` by ${copy.savedBy}` : ""}.</>
            : "No copy of these settings on the server yet. One is sent when settings are saved."}
          {lock?.backupPending && copy && <Typography.Text type="secondary"> Latest changes not sent yet.</Typography.Text>}
        </Typography.Text>
        <Button onClick={fetchNow} loading={busy} disabled={!copy || !isAdmin || lock?.locked}>Fetch from server</Button>
      </Space>
    </Card>
  );
}

// ── Indicator ────────────────────────────────────────────────────────────────
// Everything that differs between indicator makes is a field here, so a new model is set
// up on site: pick the closest preset, watch the raw data, adjust, save.

const F = ({ label, children, help, span = 8 }) => (
  <Col span={span} style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 13, color: "#555", marginBottom: 2 }}>{label}</div>
    {children}
    {help && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{help}</div>}
  </Col>
);

function IndicatorSettings({ isAdmin }) {
  const { message } = App.useApp();
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState("qt-default");
  const [p, setP] = useState(null); // the edited profile
  const [ports, setPorts] = useState([]);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    Promise.all([wb("presets"), wb("indicatorConfig")]).then(([pr, cfg]) => {
      setPresets(pr.presets);
      setPresetId(cfg.config.presetId);
      setP(cfg.profile);
      setStatus(cfg.status);
    }).catch((e) => message.error(e.message));
    loadPorts();
    return window.WB.onIndicatorStatus(setStatus);
  }, []);

  const loadPorts = () => wb("ports").then((r) => setPorts(r.ports)).catch(() => {});

  // Switching preset loads its defaults but keeps the port the cable is on.
  const choosePreset = (id) => {
    const preset = presets.find((x) => x.id === id);
    if (!preset) return;
    setPresetId(id);
    setP((cur) => ({
      ...cur,
      name: preset.name,
      mode: preset.mode,
      poll: { command: "", intervalMs: 500, ...(preset.poll || {}) },
      frame: { ...preset.frame },
      decode: { ...preset.decode },
      transport: { ...cur.transport, ...preset.transport },
    }));
  };

  const setT = (patch) => setP((cur) => ({ ...cur, transport: { ...cur.transport, ...patch } }));
  const setFrame = (patch) => setP((cur) => ({ ...cur, frame: { ...cur.frame, ...patch } }));
  const setDecode = (patch) => setP((cur) => ({ ...cur, decode: { ...cur.decode, ...patch } }));
  const setPoll = (patch) => setP((cur) => ({ ...cur, poll: { ...cur.poll, ...patch } }));
  const setTop = (patch) => setP((cur) => ({ ...cur, ...patch }));

  const overrides = () => {
    const { presetId: _ignored, ...rest } = p;
    return rest;
  };

  const save = async () => {
    try {
      const r = await wb("saveIndicator", { presetId, overrides: overrides() });
      setP(r.profile);
      message.success("Saved. Reconnecting to the indicator.");
    } catch (e) { message.error(e.message); }
  };

  if (!p) return null;
  const preset = presets.find((x) => x.id === presetId);
  const t = p.transport;
  const ro = !isAdmin;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Card size="small" title="Indicator model" extra={<Typography.Text type={status?.state === "connected" ? "success" : "danger"}>{status?.state === "connected" ? `Connected · ${status.message}` : status?.message || "Not connected"}</Typography.Text>}>
        <Row gutter={12}>
          <F label="Preset" span={12} help={preset?.makes}>
            <Select disabled={ro} style={{ width: "100%" }} value={presetId} onChange={choosePreset} options={presets.map((x) => ({ value: x.id, label: x.name }))} />
          </F>
          <F label="Connection" span={12}>
            <Radio.Group disabled={ro} value={t.type} onChange={(e) => setT({ type: e.target.value })} optionType="button">
              <Radio.Button value="serial">Serial (COM port)</Radio.Button>
              <Radio.Button value="tcp">Network (TCP/IP)</Radio.Button>
            </Radio.Group>
          </F>
        </Row>
        {t.type === "tcp" ? (
          <Row gutter={12}>
            <F label="Indicator / converter IP address"><Input disabled={ro} value={t.host} onChange={(e) => setT({ host: e.target.value.trim() })} placeholder="192.168.1.50" /></F>
            <F label="TCP port"><InputNumber disabled={ro} style={{ width: "100%" }} value={t.port} onChange={(v) => setT({ port: v })} /></F>
          </Row>
        ) : (
          <Row gutter={12}>
            <F label="COM port" help={<a onClick={loadPorts}>Refresh list</a>}>
              <Select disabled={ro} style={{ width: "100%" }} value={t.path} onChange={(v) => setT({ path: v })} showSearch
                options={[...ports.map((x) => ({ value: x.path, label: `${x.path}${x.manufacturer ? ` · ${x.manufacturer}` : ""}` })),
                  ...(ports.some((x) => x.path === t.path) || !t.path ? [] : [{ value: t.path, label: `${t.path} (not found)` }])]} />
            </F>
            <F label="Baud rate">
              <Select disabled={ro} style={{ width: "100%" }} value={t.baudRate} onChange={(v) => setT({ baudRate: v })}
                options={[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((b) => ({ value: b, label: String(b) }))} />
            </F>
            <F label="Data bits / parity / stop bits">
              <Space.Compact style={{ width: "100%" }}>
                <Select disabled={ro} style={{ width: "30%" }} value={t.dataBits} onChange={(v) => setT({ dataBits: v })} options={[5, 6, 7, 8].map((b) => ({ value: b, label: String(b) }))} />
                <Select disabled={ro} style={{ width: "40%" }} value={t.parity} onChange={(v) => setT({ parity: v })} options={["none", "even", "odd", "mark", "space"].map((b) => ({ value: b, label: b }))} />
                <Select disabled={ro} style={{ width: "30%" }} value={t.stopBits} onChange={(v) => setT({ stopBits: v })} options={[1, 1.5, 2].map((b) => ({ value: b, label: String(b) }))} />
              </Space.Compact>
            </F>
            <F label="Flow control">
              <Select disabled={ro} style={{ width: "100%" }} value={t.flowControl} onChange={(v) => setT({ flowControl: v })}
                options={[{ value: "none", label: "None" }, { value: "hardware", label: "Hardware (RTS/CTS)" }, { value: "software", label: "Software (XON/XOFF)" }]} />
            </F>
            <F label="Raise DTR / RTS" help="Some indicators only send when these are on">
              <Space><Switch disabled={ro} checked={t.dtr !== false} onChange={(v) => setT({ dtr: v })} /> DTR <Switch disabled={ro} checked={t.rts !== false} onChange={(v) => setT({ rts: v })} /> RTS</Space>
            </F>
          </Row>
        )}
      </Card>

      <Card size="small" title="Data format">
        <Row gutter={12}>
          <F label="Output mode">
            <Radio.Group disabled={ro} value={p.mode} onChange={(e) => setTop({ mode: e.target.value })} optionType="button">
              <Radio.Button value="continuous">Continuous</Radio.Button>
              <Radio.Button value="poll">Polled</Radio.Button>
            </Radio.Group>
          </F>
          {p.mode === "poll" && <>
            <F label="Poll command" help="e.g. SI<CR><LF>, W<CR>, P, \x05"><Input disabled={ro} className="mono" value={p.poll.command} onChange={(e) => setPoll({ command: e.target.value })} /></F>
            <F label="Poll every (ms)"><InputNumber disabled={ro} min={100} style={{ width: "100%" }} value={p.poll.intervalMs} onChange={(v) => setPoll({ intervalMs: v })} /></F>
          </>}
        </Row>
        <Row gutter={12}>
          <F label="Framing">
            <Select disabled={ro} style={{ width: "100%" }} value={p.frame.type} onChange={(v) => setFrame({ type: v })}
              options={[{ value: "delimited", label: "Start and end markers" }, { value: "fixed", label: "Start marker + fixed length" }]} />
          </F>
          <F label="Start marker" help="<STX>, =, blank for none"><Input disabled={ro} className="mono" value={p.frame.start} onChange={(e) => setFrame({ start: e.target.value })} /></F>
          {p.frame.type === "fixed"
            ? <F label="Message length (bytes after start)"><InputNumber disabled={ro} min={1} style={{ width: "100%" }} value={p.frame.length} onChange={(v) => setFrame({ length: v })} /></F>
            : <F label="End marker" help="<CR>, <LF>, <ETX>; use | for either"><Input disabled={ro} className="mono" value={p.frame.end} onChange={(e) => setFrame({ end: e.target.value })} /></F>}
        </Row>
        <Row gutter={12}>
          <F label="Decoder">
            <Select disabled={ro} style={{ width: "100%" }} value={p.decode.type} onChange={(v) => setDecode({ type: v })}
              options={[{ value: "regex", label: "Pattern (text formats)" }, { value: "fixed", label: "Fixed positions" }, { value: "toledo", label: "Mettler Toledo status bytes" }]} />
          </F>
          {p.decode.type === "regex" && <>
            <F label="Weight pattern" span={16} help="Regular expression with a (?<weight>…) group; optional sign, unit, status groups">
              <Input disabled={ro} className="mono" value={p.decode.pattern} onChange={(e) => setDecode({ pattern: e.target.value })} />
            </F>
            <F label="Digits sent reversed"><Switch disabled={ro} checked={!!p.decode.reverse} onChange={(v) => setDecode({ reverse: v })} /></F>
            <F label="Stable when status matches"><Input disabled={ro} className="mono" value={p.decode.stablePattern || ""} onChange={(e) => setDecode({ stablePattern: e.target.value })} /></F>
            <F label="Moving when status matches"><Input disabled={ro} className="mono" value={p.decode.motionPattern || ""} onChange={(e) => setDecode({ motionPattern: e.target.value })} /></F>
          </>}
          {p.decode.type === "fixed" && <>
            <F label="Weight starts at / length">
              <Space.Compact><InputNumber disabled={ro} min={0} value={p.decode.weightAt} onChange={(v) => setDecode({ weightAt: v })} /><InputNumber disabled={ro} min={1} value={p.decode.weightLength} onChange={(v) => setDecode({ weightLength: v })} /></Space.Compact>
            </F>
            <F label="Sign at / decimals digit at" help="Positions count from 0; leave blank if not sent">
              <Space.Compact><InputNumber disabled={ro} min={0} value={p.decode.signAt} onChange={(v) => setDecode({ signAt: v })} /><InputNumber disabled={ro} min={0} value={p.decode.decimalsAt} onChange={(v) => setDecode({ decimalsAt: v })} /></Space.Compact>
            </F>
          </>}
          {p.decode.type === "toledo" && (
            <F label="Take kg/lb from status byte"><Switch disabled={ro} checked={!!p.decode.unitFromStatus} onChange={(v) => setDecode({ unitFromStatus: v })} /></F>
          )}
        </Row>
        <Divider style={{ margin: "6px 0 12px" }} />
        <Row gutter={12}>
          <F label="Unit when none is sent" span={4}>
            <Select disabled={ro} style={{ width: "100%" }} value={p.unit} onChange={(v) => setTop({ unit: v })} options={["kg", "t", "lb", "g"].map((u) => ({ value: u, label: u }))} />
          </F>
          <F label="Implied decimals" span={4}><InputNumber disabled={ro} min={0} max={5} style={{ width: "100%" }} value={p.impliedDecimals} onChange={(v) => setTop({ impliedDecimals: v })} /></F>
          <F label="Decimal comma" span={4}><Switch disabled={ro} checked={!!p.decimalComma} onChange={(v) => setTop({ decimalComma: v })} /></F>
          <F label="Multiply by" span={4}><InputNumber disabled={ro} min={0} style={{ width: "100%" }} value={p.multiplier} onChange={(v) => setTop({ multiplier: v })} /></F>
          <F label="Round to (kg)" span={4}><InputNumber disabled={ro} min={0} style={{ width: "100%" }} value={p.resolution} onChange={(v) => setTop({ resolution: v })} /></F>
          <F label="No signal after (ms)" span={4}><InputNumber disabled={ro} min={500} style={{ width: "100%" }} value={p.noSignalMs} onChange={(v) => setTop({ noSignalMs: v })} /></F>
          <F label="Stable after N same readings" span={4}><InputNumber disabled={ro} min={1} style={{ width: "100%" }} value={p.stableCount} onChange={(v) => setTop({ stableCount: v })} /></F>
          <F label="…within (kg)" span={4}><InputNumber disabled={ro} min={0} style={{ width: "100%" }} value={p.stableToleranceKg} onChange={(v) => setTop({ stableToleranceKg: v })} /></F>
          <F label="Empty bridge up to (kg)" span={4}><InputNumber disabled={ro} min={0} style={{ width: "100%" }} value={p.zeroBandKg} onChange={(v) => setTop({ zeroBandKg: v })} /></F>
          <F label="Bridge engaged above (kg)" span={4}><InputNumber disabled={ro} min={0} style={{ width: "100%" }} value={p.engageThresholdKg} onChange={(v) => setTop({ engageThresholdKg: v })} /></F>
        </Row>
        <Space>
          <Button type="primary" disabled={ro} onClick={save}>Save and reconnect</Button>
          <Button onClick={() => wb("exportProfile", { presetId, overrides: overrides() }).then((r) => r.saved && message.success(`Saved ${r.filePath}`)).catch((e) => message.error(e.message))}>Export profile</Button>
          <Button disabled={ro} onClick={() => wb("importProfile").then((r) => { if (r.loaded) { setPresetId(r.presetId); setP((cur) => ({ ...cur, ...r.overrides })); message.info("Loaded. Check it, then Save."); } }).catch((e) => message.error(e.message))}>Import profile</Button>
          <Button onClick={() => wb("restartIndicator")}>Reconnect</Button>
        </Space>
      </Card>

      <Monitor presetId={presetId} overrides={overrides} />
    </Space>
  );
}

// Raw bytes from the indicator as they arrive, and what the current settings make of them.
function Monitor({ presetId, overrides }) {
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState([]);
  const [sample, setSample] = useState("");
  const [results, setResults] = useState(null);
  const box = useRef(null);

  useEffect(() => {
    if (!on) return undefined;
    wb("monitor", { on: true });
    const add = (l) => setLines((cur) => [...cur.slice(-200), l]);
    const offs = [
      window.WB.onRaw((r) => add(`RAW  ${r.text}    [${r.hex}]`)),
      window.WB.onFrame((f) => add(`${f.ok ? "OK  " : "BAD "} ${f.text}`)),
    ];
    return () => { offs.forEach((o) => o()); wb("monitor", { on: false }); };
  }, [on]);

  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [lines]);

  const test = () => wb("testParse", { presetId, overrides: overrides(), sample }).then((r) => setResults(r.results)).catch((e) => setResults([{ frame: e.message }]));

  return (
    <Card size="small" title="Raw data monitor" extra={<Space><Switch checked={on} onChange={setOn} /> Show live data <Button size="small" onClick={() => setLines([])}>Clear</Button></Space>}>
      <div className="monitor" ref={box}>{lines.join("\n") || (on ? "Waiting for data…" : "Turn on to see exactly what the indicator sends. BAD lines are messages the current settings could not read.")}</div>
      <Typography.Paragraph style={{ marginTop: 12, marginBottom: 4 }}>
        Test the settings above on a sample, before saving. Paste text from the monitor (control characters as &lt;STX&gt;, &lt;CR&gt;, \x02 …).
      </Typography.Paragraph>
      <Space.Compact style={{ width: "100%" }}>
        <Input className="mono" value={sample} onChange={(e) => setSample(e.target.value)} placeholder="<STX>001230<CR>" onPressEnter={test} />
        <Button onClick={test}>Test</Button>
      </Space.Compact>
      {results && (
        <Table size="small" style={{ marginTop: 8 }} pagination={false} rowKey={(_, i) => i} dataSource={results}
          locale={{ emptyText: "No complete message found: check the start and end markers" }}
          columns={[
            { title: "Message", dataIndex: "frame", render: (v) => <span className="mono">{v}</span> },
            { title: "Weight (kg)", key: "w", render: (_, r) => (r.reading ? r.reading.weight : "not read") },
            { title: "Stable", key: "s", render: (_, r) => (r.reading ? String(r.reading.stable ?? "by repetition") : "") },
          ]} />
      )}
    </Card>
  );
}

// ── Printing ─────────────────────────────────────────────────────────────────
function PrintSettings({ isAdmin }) {
  const { message } = App.useApp();
  const [s, setS] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [folder, setFolder] = useState("");

  useEffect(() => {
    wb("settings").then((r) => { setS(r.print); setFolder(r.pdfFolder); }).catch((e) => message.error(e.message));
    wb("printers").then((r) => setPrinters(r.printers)).catch(() => {});
  }, []);

  if (!s) return null;
  const ro = !isAdmin;
  const set = (patch) => setS((cur) => ({ ...cur, ...patch }));
  const save = () => wb("savePrint", { print: s }).then((r) => { setS(r.print); message.success("Saved"); }).catch((e) => message.error(e.message));

  return (
    <Card size="small" title="Voucher printing" style={{ maxWidth: 900 }}>
      <Row gutter={12}>
        <F label="Printer" span={12}>
          <Select disabled={ro} style={{ width: "100%" }} value={s.printer} onChange={(v) => set({ printer: v })}
            options={[{ value: "", label: "Windows default printer" }, ...printers.map((p) => ({ value: p.name, label: p.displayName || p.name }))]} />
        </F>
        <F label="Paper" span={6}>
          <Select disabled={ro} style={{ width: "100%" }} value={s.layout} onChange={(v) => set({ layout: v })}
            options={[{ value: "a5", label: "A5 (like the old app)" }, { value: "80mm", label: "80 mm receipt" }]} />
        </F>
        <F label="Copies" span={6}><InputNumber disabled={ro} min={1} max={5} style={{ width: "100%" }} value={s.copies} onChange={(v) => set({ copies: v })} /></F>
        <F label="Print after every save" span={6}><Switch disabled={ro} checked={s.autoPrint} onChange={(v) => set({ autoPrint: v })} /></F>
        <F label="Keep a PDF copy" span={6}><Switch disabled={ro} checked={s.keepPdf} onChange={(v) => set({ keepPdf: v })} /></F>
        <F label="PDF folder" span={12} help={<a onClick={() => wb("openFolder", { which: "pdf" })}>Open folder</a>}>
          <Space.Compact style={{ width: "100%" }}>
            <Input disabled value={s.pdfFolder || folder} />
            <Button disabled={ro} onClick={() => wb("pickFolder").then((r) => r.folder && set({ pdfFolder: r.folder }))}>Change</Button>
          </Space.Compact>
        </F>
        <F label="Header lines (first line is the title)" span={12}>
          <Input.TextArea disabled={ro} rows={5} value={(s.header || []).join("\n")} onChange={(e) => set({ header: e.target.value.split("\n") })} />
        </F>
        <F label="Footer" span={12}><Input disabled={ro} value={s.footer} onChange={(e) => set({ footer: e.target.value })} /></F>
      </Row>
      <Space>
        <Button type="primary" disabled={ro} onClick={save}>Save</Button>
        <Button onClick={() => wb("testPrint").then((r) => (r.print.error ? message.error(r.print.error) : message.success("Test voucher sent"))).catch((e) => message.error(e.message))}>Print a test voucher</Button>
      </Space>
    </Card>
  );
}

// ── Weighing ─────────────────────────────────────────────────────────────────
function WeighingSettings({ isAdmin }) {
  const { message } = App.useApp();
  const [s, setS] = useState(null);
  const [sim, setSim] = useState(12500);
  useEffect(() => { wb("settings").then((r) => setS(r.weighing)).catch(() => {}); }, []);
  if (!s) return null;
  const save = (patch) => wb("saveWeighing", { weighing: patch }).then((r) => setS(r.weighing)).catch((e) => message.error(e.message));
  return (
    <Card size="small" title="Weighing" style={{ maxWidth: 700 }}>
      <Space direction="vertical" size={16}>
        <Space><Switch disabled={!isAdmin} checked={s.requireStable} onChange={(v) => save({ requireStable: v })} /> Save only on a stable weight</Space>
        <Space><Switch disabled={!isAdmin} checked={s.simulator} onChange={(v) => save({ simulator: v })} /> Simulator (for training and testing without a vehicle)</Space>
        {s.simulator && (
          <Space>
            <InputNumber value={sim} onChange={setSim} addonAfter="kg" />
            <Button onClick={() => wb("simulate", { weight: sim }).catch((e) => message.error(e.message))}>Put on bridge</Button>
            <Button onClick={() => wb("simulate", { weight: null })}>Clear</Button>
          </Space>
        )}
        <Typography.Text type="secondary">The amount is always worked out from the wheel type rate: a return weighing of a paid first weighing is free, anything else is charged in full.</Typography.Text>
      </Space>
    </Card>
  );
}

// ── Camera ───────────────────────────────────────────────────────────────────
// A photo is taken each time a weighing is saved, kept on this PC and uploaded with it.

function CameraSettings({ isAdmin }) {
  const { message } = App.useApp();
  const [cam, setCam] = useState(null);
  const [devices, setDevices] = useState([]);
  const [saved, setSaved] = useState(null);

  const loadDevices = async () => {
    try {
      // names are only shown once camera access has been granted
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null);
      s?.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "videoinput").map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` })));
    } catch (_) { setDevices([]); }
  };

  useEffect(() => {
    wb("camera").then((r) => { setCam(r.camera); setSaved(r.camera); }).catch(() => {});
    loadDevices();
  }, []);
  if (!cam) return null;

  const set = (patch) => setCam((c) => ({ ...c, ...patch }));
  const save = () => wb("saveCamera", { camera: cam })
    .then((r) => { setCam(r.camera); setSaved(r.camera); message.success("Camera saved"); })
    .catch((e) => message.error(e.message));

  return (
    <Card size="small" title="Camera" style={{ maxWidth: 700 }}>
      <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Typography.Text type="secondary">A photo is taken the moment a weighing is saved and kept on this PC. It can also be uploaded with the weighing (seen in the web admin's Weighbridge Entry) and printed on the voucher.</Typography.Text>
        <Radio.Group disabled={!isAdmin} value={cam.source} onChange={(e) => set({ source: e.target.value })} optionType="button" options={[
          { value: "none", label: "No camera" },
          { value: "webcam", label: "USB / built-in camera" },
          { value: "url", label: "IP camera" },
        ]} />
        {cam.source === "webcam" && (
          <Space wrap>
            <Select disabled={!isAdmin} style={{ width: 360 }} placeholder="Choose the camera" value={cam.deviceId || undefined}
              options={devices} notFoundContent="No camera found"
              onChange={(v) => set({ deviceId: v, deviceLabel: devices.find((d) => d.value === v)?.label || "" })} />
            <Button onClick={loadDevices}>Refresh list</Button>
          </Space>
        )}
        {cam.source === "url" && (
          <div>
            <Input disabled={!isAdmin} value={cam.url} onChange={(e) => set({ url: e.target.value })} placeholder="http://user:password@192.168.1.64/ISAPI/Streaming/channels/101/picture" />
            <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>The camera's snapshot (still picture) address. Hikvision: /ISAPI/Streaming/channels/101/picture · Dahua: /cgi-bin/snapshot.cgi</div>
          </div>
        )}
        {cam.source !== "none" && (
          <Space direction="vertical">
            <Space><Switch disabled={!isAdmin} checked={cam.upload !== false} onChange={(v) => set({ upload: v })} /> Upload photos to the server (seen in the web admin). Off: photos stay on this PC only.</Space>
            <Space><Switch disabled={!isAdmin} checked={!!cam.printPhoto} onChange={(v) => set({ printPhoto: v })} /> Print the photo on the voucher</Space>
          </Space>
        )}
        {cam.source !== "none" && <CameraPanel camera={cam} active title="Preview" />}
        <Space>
          <Button type="primary" disabled={!isAdmin || JSON.stringify(cam) === JSON.stringify(saved)} onClick={save}>Save</Button>
          <Button onClick={() => wb("openPhotoFolder")}>Open photo folder</Button>
        </Space>
      </Space>
    </Card>
  );
}

// ── Branch & data ────────────────────────────────────────────────────────────
function DataSettings({ auth, isAdmin, onChanged }) {
  const { message, modal } = App.useApp();
  const [sync, setSync] = useState(null);
  useEffect(() => {
    wb("syncState").then((r) => setSync(r.state)).catch(() => {});
    return window.WB.onSync(setSync);
  }, []);

  const [update, setUpdate] = useState(null);
  useEffect(() => {
    wb("updateState").then((r) => setUpdate(r.state)).catch(() => {});
    return window.WB.onUpdate(setUpdate);
  }, []);
  const checkUpdate = () => wb("checkUpdate").then((r) => {
    const st = r.state;
    if (st.status === "ready") message.success(`Version ${st.version} is downloaded. Restart to update.`);
    else if (st.status === "none") message.info("This is the latest version.");
    else if (st.status === "error") message.error(`Couldn't check for updates: ${st.error}`);
  }).catch((e) => message.error(e.message));

  const reseed = () => wb("seed").then((r) => message.success(`Copied ${r.seeded.imported.weights} weighings and ${r.seeded.imported.tares} tare weights. Next voucher after ${r.seeded.lastWB}.`)).catch((e) => message.error(e.message));

  const changeBranch = () => modal.confirm({
    title: "Change this PC's branch?",
    content: "Only do this if the PC has moved to another weighbridge.",
    onOk: async () => {
      await wb("setBranch", { branchCode: "" }).catch((e) => message.error(e.message));
      onChanged();
    },
  });

  return (
    <Card size="small" style={{ maxWidth: 800 }}>
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Server">{window.WB.server?.apiServer}</Descriptions.Item>
        <Descriptions.Item label="Company">{auth.tenantId}</Descriptions.Item>
        <Descriptions.Item label="Branch">{auth.branchCode}</Descriptions.Item>
        <Descriptions.Item label="Waiting to upload">{sync ? `${sync.pending.weights} weighings, ${sync.pending.tares} tare weights, ${sync.pending.engage} bridge events${sync.pending.photos ? `, ${sync.pending.photos} camera photos` : ""}` : ""}</Descriptions.Item>
        <Descriptions.Item label="Last sync">{sync?.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleString() : "never"}{sync?.lastError ? ` · ${sync.lastError}` : ""}</Descriptions.Item>
        <Descriptions.Item label="App version">
          {window.WB.version}
          {update?.status === "ready" && ` · version ${update.version} downloaded, restart to update`}
          {update?.status === "downloading" && ` · downloading version ${update.version}…`}
        </Descriptions.Item>
      </Descriptions>
      <Space style={{ marginTop: 12 }} wrap>
        <Button onClick={() => wb("syncNow").then(() => message.success("Sync done")).catch((e) => message.error(e.message))}>Sync now</Button>
        <Button onClick={reseed}>Refresh history from server</Button>
        <Button onClick={() => wb("openFolder", { which: "logs" })}>Open log folder</Button>
        <Button onClick={checkUpdate} loading={update?.status === "checking" || update?.status === "downloading"}>Check for updates</Button>
        <Button danger disabled={!isAdmin} onClick={changeBranch}>Change branch</Button>
      </Space>
    </Card>
  );
}
