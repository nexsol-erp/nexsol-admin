// Invoice Designer for the web invoices: the Sales Entry tax invoice (cash and credit bills) and
// the web POS bill. A template sets the paper, look, logo and which details print; "Prints with"
// picks the template each invoice type uses, and "Built-in" keeps the invoice as it always was.
// The desktop (Electron) POS receipt is not affected by anything here.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Button, Card, Checkbox, Col, Collapse, ColorPicker, Grid, Input, InputNumber, Modal,
  Popconfirm, Row, Segmented, Select, Slider, Space, Spin, Switch, Tag, Tooltip, Typography, message,
} from "antd";
import {
  ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PictureOutlined, PlusOutlined, PrinterOutlined, SaveOutlined,
} from "@ant-design/icons";
import {
  DOC_TYPES, FONTS, PAPERS, PRESETS, STYLES, isThermal, presetConfig, withDefaults,
} from "../invoiceDesign/templateModel";
import { sampleInvoice } from "../invoiceDesign/invoiceModel";
import { renderInvoiceHtml } from "../invoiceDesign/renderInvoice";
import { printHtml } from "../invoiceDesign/printHtml";
import {
  createTemplate, deleteTemplate, getTemplate, listTemplates, setTemplateUse, updateTemplate,
} from "../invoiceDesign/api";

const { Title, Text } = Typography;
const { TextArea } = Input;

const MAX_LOGO_CHARS = 650 * 1024;

// Shrinks the picked image so the template stays small: at most 800 x 400 px, PNG when the
// source may be transparent, JPEG otherwise.
function readLogo(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) {
      reject(new Error("Pick a PNG, JPEG, GIF or WebP image."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read the image."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Couldn't read the image."));
      img.onload = () => {
        const scale = Math.min(1, 800 / img.width, 400 / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let url = canvas.toDataURL(file.type === "image/jpeg" ? "image/jpeg" : "image/png", 0.9);
        if (url.length > MAX_LOGO_CHARS) url = canvas.toDataURL("image/jpeg", 0.85);
        if (url.length > MAX_LOGO_CHARS) reject(new Error("The logo is too large. Use a smaller image."));
        else resolve(url);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const S = {
  page: { padding: 16, maxWidth: 1440, margin: "0 auto", background: "#f5f7fa", minHeight: "100%", color: "#111" },
  card: { borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  field: { marginBottom: 12 },
  label: { display: "block", fontSize: 12, color: "rgba(0,0,0,0.6)", marginBottom: 4 },
  switchRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" },
  styleCard: (on, accent) => ({
    border: `2px solid ${on ? accent : "#e5e7eb"}`, borderRadius: 8, padding: "8px 10px", cursor: "pointer",
    background: on ? "#f0f5ff" : "#fff", height: "100%",
  }),
};

const Field = ({ label, children, hint }) => (
  <div style={S.field}>
    <span style={S.label}>{label}</span>
    {children}
    {hint && <Text type="secondary" style={{ fontSize: 11 }}>{hint}</Text>}
  </div>
);

const Toggle = ({ label, checked, onChange }) => (
  <div style={S.switchRow}>
    <span>{label}</span>
    <Switch size="small" checked={checked} onChange={onChange} />
  </div>
);

// The designed invoice, shrunk to fit the preview pane.
function Preview({ html, paper }) {
  const box = useRef(null);
  const [width, setWidth] = useState(800);
  useEffect(() => {
    if (!box.current) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const thermal = isThermal(paper);
  const pageWidth = thermal ? 360 : paper === "A5" ? 620 : 860;
  const zoom = Math.min(1, (width - 8) / pageWidth);
  const scaled = html.replace("</head>", `<style>@media screen{html{zoom:${zoom.toFixed(3)}}}</style></head>`);
  return (
    <div ref={box}>
      <iframe
        title="Invoice preview" srcDoc={scaled}
        style={{ width: "100%", height: thermal ? 760 : Math.max(560, Math.round(1180 * zoom)), border: 0, borderRadius: 8, background: "#e9ecef" }}
      />
    </div>
  );
}

const InvoiceDesigner = () => {
  const screens = Grid.useBreakpoint();
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [uses, setUses] = useState({});
  const [loadError, setLoadError] = useState(null);

  // The template being edited: id null for one not saved yet.
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState(() => presetConfig("modern"));
  const [logo, setLogo] = useState(null);
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewKind, setPreviewKind] = useState("SALES");
  const [newOpen, setNewOpen] = useState(false);
  const [newPreset, setNewPreset] = useState("modern");
  const fileRef = useRef(null);

  const snapshot = JSON.stringify({ name, config, logo });
  const dirty = savedSnapshot !== snapshot;

  const loadOverview = async () => {
    const data = await listTemplates();
    setInstalled(data.installed !== false);
    setTemplates(data.templates || []);
    setUses(data.uses || {});
    return data;
  };

  const openTemplate = async (id) => {
    const t = await getTemplate(id);
    const cfg = withDefaults(t.config);
    setEditId(t.id);
    setName(t.name);
    setConfig(cfg);
    setLogo(t.logo || null);
    setSavedSnapshot(JSON.stringify({ name: t.name, config: cfg, logo: t.logo || null }));
  };

  const startNew = (presetKey, copyName) => {
    const cfg = presetConfig(presetKey);
    setEditId(null);
    setName(copyName || `${PRESETS.find((p) => p.key === presetKey)?.label || "My"} invoice`);
    setConfig(cfg);
    setLogo(null);
    setSavedSnapshot(null);
  };

  useEffect(() => {
    loadOverview()
      .then((data) => {
        const list = data.templates || [];
        const firstUsed = Object.values(data.uses || {})[0];
        if (list.length) return openTemplate(firstUsed || list[0].id);
        startNew("modern", "My invoice");
        return null;
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (path, value) => setConfig((prev) => {
    const next = JSON.parse(JSON.stringify(prev));
    const keys = path.split(".");
    let o = next;
    keys.slice(0, -1).forEach((k) => { o = o[k]; });
    o[keys[keys.length - 1]] = value;
    return next;
  });

  const setColumn = (i, patch) => setConfig((prev) => ({
    ...prev, columns: prev.columns.map((c, j) => (j === i ? { ...c, ...patch } : c)),
  }));
  const moveColumn = (i, d) => setConfig((prev) => {
    const cols = [...prev.columns];
    const j = i + d;
    if (j < 0 || j >= cols.length) return prev;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    return { ...prev, columns: cols };
  });

  const previewHtml = useMemo(
    () => renderInvoiceHtml({ config, logo }, sampleInvoice(previewKind)),
    [config, logo, previewKind],
  );

  const pickLogo = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setLogo(await readLogo(file));
      if (!config.logo.show) set("logo.show", true);
    } catch (err) {
      message.error(err.message);
    }
  };

  const save = async () => {
    if (!name.trim()) return message.warning("Give the template a name");
    setSaving(true);
    try {
      const body = { name: name.trim(), config, logo };
      const t = editId ? await updateTemplate(editId, body) : await createTemplate(body);
      setEditId(t.id);
      setName(t.name);
      setSavedSnapshot(JSON.stringify({ name: t.name, config, logo }));
      await loadOverview();
      message.success(`Template "${t.name}" saved`);
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editId) return;
    try {
      await deleteTemplate(editId);
      message.success("Template deleted");
      const data = await loadOverview();
      if (data.templates && data.templates.length) await openTemplate(data.templates[0].id);
      else startNew("modern", "My invoice");
    } catch (e) {
      message.error(e.message);
    }
  };

  const changeUse = async (docType, templateId) => {
    try {
      const data = await setTemplateUse(docType, templateId ?? null);
      setTemplates(data.templates || []);
      setUses(data.uses || {});
      const label = DOC_TYPES.find((d) => d.key === docType).label;
      message.success(templateId ? `${label} now prints with "${templates.find((t) => t.id === templateId)?.name}"` : `${label} prints the built-in invoice`);
    } catch (e) {
      message.error(e.message);
    }
  };

  const switchTo = (id) => {
    const go = () => openTemplate(id).catch((e) => message.error(e.message));
    if (!dirty) return go();
    Modal.confirm({ title: "Discard unsaved changes?", okText: "Discard", onOk: go });
    return null;
  };

  if (loading) return <div style={{ ...S.page, textAlign: "center", paddingTop: 80 }}><Spin size="large" /></div>;
  if (loadError) return <div style={S.page}><Alert type="error" showIcon message="Couldn't load invoice templates" description={loadError} /></div>;

  const templateOptions = templates.map((t) => ({ value: t.id, label: t.name }));
  const useOptions = [{ value: 0, label: "Built-in invoice (as today)" }, ...templateOptions];
  const thermal = isThermal(config.paper);

  const panels = [
    {
      key: "look",
      label: "Paper and look",
      children: (
        <>
          <Field label="Template name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></Field>
          <Row gutter={12}>
            <Col span={12}>
              <Field label="Paper">
                <Select style={{ width: "100%" }} value={config.paper} onChange={(v) => set("paper", v)}
                  options={PAPERS.map((p) => ({ value: p.key, label: p.label }))} />
              </Field>
            </Col>
            <Col span={12}>
              <Field label="Accent colour">
                <ColorPicker value={config.accent} showText disabledAlpha
                  onChangeComplete={(c) => set("accent", c.toHexString())}
                  presets={[{ label: "Suggested", colors: ["#1f4e8c", "#0f766e", "#b91c1c", "#7c3aed", "#c2410c", "#222222"] }]} />
              </Field>
            </Col>
          </Row>
          {!thermal && (
            <Field label="Style">
              <Row gutter={[8, 8]}>
                {STYLES.map((s) => (
                  <Col span={12} key={s.key}>
                    <div role="button" tabIndex={0} style={S.styleCard(config.style === s.key, config.accent)}
                      onClick={() => set("style", s.key)} onKeyDown={(e) => e.key === "Enter" && set("style", s.key)}>
                      <div style={{ fontWeight: 600 }}>{s.label}</div>
                      <div style={{ fontSize: 11, color: "#666" }}>{s.hint}</div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Field>
          )}
          <Row gutter={12}>
            <Col span={16}>
              <Field label="Font">
                <Select style={{ width: "100%" }} value={config.font} onChange={(v) => set("font", v)}
                  options={FONTS.map((f) => ({ value: f.key, label: f.label }))} />
              </Field>
            </Col>
            <Col span={8}>
              <Field label="Text size (pt)">
                <InputNumber min={7} max={16} style={{ width: "100%" }} value={config.fontSize} onChange={(v) => v && set("fontSize", v)} />
              </Field>
            </Col>
          </Row>
        </>
      ),
    },
    {
      key: "business",
      label: "Logo and business details",
      children: (
        <>
          <Field label="Logo">
            <Space wrap>
              {logo
                ? <img src={logo} alt="Logo" style={{ height: 48, maxWidth: 160, objectFit: "contain", border: "1px solid #eee", borderRadius: 4, background: "#fff" }} />
                : <Text type="secondary">No logo yet</Text>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={pickLogo} />
              <Button icon={<PictureOutlined />} onClick={() => fileRef.current?.click()}>{logo ? "Change" : "Upload logo"}</Button>
              {logo && <Button danger type="text" onClick={() => setLogo(null)}>Remove</Button>}
            </Space>
          </Field>
          {logo && (
            <>
              <Toggle label="Show logo" checked={config.logo.show} onChange={(v) => set("logo.show", v)} />
              <Field label="Logo position">
                <Segmented block value={config.logo.position} onChange={(v) => set("logo.position", v)}
                  options={[{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }]} />
              </Field>
              <Field label={`Logo height (${config.logo.height}px)`}>
                <Slider min={24} max={160} value={config.logo.height} onChange={(v) => set("logo.height", v)} />
              </Field>
            </>
          )}
          <Field label="Business name" hint="Leave blank to print the branch name.">
            <Input value={config.business.name} placeholder="Branch name" onChange={(e) => set("business.name", e.target.value)} />
          </Field>
          <Field label="Tagline">
            <Input value={config.business.tagline} placeholder="e.g. Fresh from our ovens since 1998" onChange={(e) => set("business.tagline", e.target.value)} />
          </Field>
          <Toggle label="Branch address" checked={config.business.showAddress} onChange={(v) => set("business.showAddress", v)} />
          <Toggle label="Phone" checked={config.business.showPhone} onChange={(v) => set("business.showPhone", v)} />
          <Toggle label="GSTIN" checked={config.business.showGstin} onChange={(v) => set("business.showGstin", v)} />
          <Field label="More lines under the address" hint="Email, website, FSSAI or licence numbers. One per line.">
            <TextArea rows={3} value={config.business.extraLines} onChange={(e) => set("business.extraLines", e.target.value)} />
          </Field>
        </>
      ),
    },
    {
      key: "details",
      label: "Title and customer details",
      children: (
        <>
          <Row gutter={12}>
            <Col span={12}>
              <Field label="Sales invoice title"><Input value={config.title.sales} onChange={(e) => set("title.sales", e.target.value)} /></Field>
            </Col>
            <Col span={12}>
              <Field label="POS bill title"><Input value={config.title.pos} onChange={(e) => set("title.pos", e.target.value)} /></Field>
            </Col>
          </Row>
          <Toggle label='Add "(CREDIT)" to credit bills' checked={config.title.showCredit} onChange={(v) => set("title.showCredit", v)} />
          <Toggle label="Customer" checked={config.details.showCustomer} onChange={(v) => set("details.showCustomer", v)} />
          <Toggle label="Customer GSTIN" checked={config.details.showCustomerGstin} onChange={(v) => set("details.showCustomerGstin", v)} />
          <Toggle label="Billing address" checked={config.details.showCustomerAddress} onChange={(v) => set("details.showCustomerAddress", v)} />
          <Toggle label="Ship-to address" checked={config.details.showShipTo} onChange={(v) => set("details.showShipTo", v)} />
          <Toggle label="Customer mobile" checked={config.details.showCustomerMobile} onChange={(v) => set("details.showCustomerMobile", v)} />
          <Toggle label="Place of supply" checked={config.details.showPlaceOfSupply} onChange={(v) => set("details.showPlaceOfSupply", v)} />
          <Toggle label="Tax type (CGST + SGST or IGST)" checked={config.details.showTaxType} onChange={(v) => set("details.showTaxType", v)} />
        </>
      ),
    },
    {
      key: "columns",
      label: "Item columns",
      children: (
        <>
          <Text type="secondary" style={{ fontSize: 12 }}>Tick the columns to print, rename them, and use the arrows to change the order.</Text>
          {config.columns.map((c, i) => (
            <div key={c.key} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
              <Checkbox checked={c.show} onChange={(e) => setColumn(i, { show: e.target.checked })} />
              <Input size="small" value={c.label} disabled={!c.show} onChange={(e) => setColumn(i, { label: e.target.value })} />
              <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveColumn(i, -1)} aria-label="Move up" />
              <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === config.columns.length - 1} onClick={() => moveColumn(i, 1)} aria-label="Move down" />
            </div>
          ))}
        </>
      ),
    },
    {
      key: "totals",
      label: "Totals",
      children: (
        <>
          <Field label="Currency symbol before the total">
            <Input style={{ width: 120 }} maxLength={6} value={config.totals.currency} onChange={(e) => set("totals.currency", e.target.value)} />
          </Field>
          <Toggle label="GST rate-wise breakdown" checked={config.totals.showTaxBreakdown} onChange={(v) => set("totals.showTaxBreakdown", v)} />
          <Toggle label="Amount in words" checked={config.totals.showAmountInWords} onChange={(v) => set("totals.showAmountInWords", v)} />
          <Toggle label="Payments received" checked={config.totals.showPayments} onChange={(v) => set("totals.showPayments", v)} />
          <Toggle label="Balance due on credit bills" checked={config.totals.showBalanceDue} onChange={(v) => set("totals.showBalanceDue", v)} />
          <Toggle label="Cash tendered and change (POS)" checked={config.totals.showTendered} onChange={(v) => set("totals.showTendered", v)} />
        </>
      ),
    },
    {
      key: "footer",
      label: "Footer",
      children: (
        <>
          <Field label="Bank details"><TextArea rows={3} placeholder={"Bank: State Bank of India\nA/c: 1234567890  IFSC: SBIN0000123"} value={config.footer.bankDetails} onChange={(e) => set("footer.bankDetails", e.target.value)} /></Field>
          <Field label="Terms and conditions"><TextArea rows={3} placeholder="Goods once sold will not be taken back." value={config.footer.terms} onChange={(e) => set("footer.terms", e.target.value)} /></Field>
          <Field label="Notes"><TextArea rows={2} value={config.footer.notes} onChange={(e) => set("footer.notes", e.target.value)} /></Field>
          <Field label="Closing line"><Input value={config.footer.thankYou} onChange={(e) => set("footer.thankYou", e.target.value)} /></Field>
          <Toggle label="Signature block" checked={config.footer.showSignature} onChange={(v) => set("footer.showSignature", v)} />
          {config.footer.showSignature && (
            <Field label="Signature caption"><Input value={config.footer.signatureLabel} onChange={(e) => set("footer.signatureLabel", e.target.value)} /></Field>
          )}
        </>
      ),
    },
  ];

  return (
    <div style={S.page}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: "#111" }}>Invoice Designer</Title>
          <Text type="secondary">Design the printed invoice for Sales Entry (cash and credit bills) and the web POS. The desktop POS receipt is not changed.</Text>
        </div>
        <Space wrap>
          <Select style={{ minWidth: 220 }} placeholder="Open a template" value={editId ?? undefined}
            options={templateOptions} onChange={switchTo} disabled={!installed || !templates.length} />
          <Button icon={<PlusOutlined />} onClick={() => setNewOpen(true)} disabled={!installed}>New</Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} disabled={!installed || (!dirty && !!editId)}>
            {editId ? (dirty ? "Save changes" : "Saved") : "Save template"}
          </Button>
        </Space>
      </div>

      {!installed && (
        <Alert style={{ marginBottom: 12 }} type="warning" showIcon
          message="Invoice templates aren't set up on this company's database yet"
          description="Ask your administrator to run the V086 migration. Until then every invoice prints the built-in layout, and you can still try designs here." />
      )}

      <Card size="small" style={{ ...S.card, marginBottom: 12 }} title="Prints with">
        <Row gutter={[16, 8]}>
          {DOC_TYPES.map((d) => (
            <Col xs={24} md={12} key={d.key}>
              <span style={S.label}>{d.label}</span>
              <Select style={{ width: "100%" }} value={uses[d.key] ?? 0} disabled={!installed || !templates.length}
                options={useOptions} onChange={(v) => changeUse(d.key, v || null)} />
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={9} xl={8}>
          <Card size="small" style={S.card}
            title={<Space>{name || "Untitled"}{!editId && <Tag>Not saved</Tag>}{editId && dirty && <Tag color="orange">Unsaved changes</Tag>}
              {editId && (templates.find((t) => t.id === editId)?.usedFor || []).map((u) => <Tag color="blue" key={u}>{u === "POS" ? "Web POS" : "Sales"}</Tag>)}</Space>}
            extra={editId && (
              <Popconfirm title="Delete this template?" description="Invoices using it go back to the built-in layout."
                okText="Delete" okButtonProps={{ danger: true }} onConfirm={remove}>
                <Tooltip title="Delete template"><Button type="text" danger icon={<DeleteOutlined />} /></Tooltip>
              </Popconfirm>
            )}>
            <Collapse ghost defaultActiveKey={["look", "business"]} items={panels} />
          </Card>
        </Col>
        <Col xs={24} lg={15} xl={16}>
          <Card size="small" style={S.card}
            title={<Segmented value={previewKind} onChange={setPreviewKind}
              options={[{ value: "SALES", label: screens.sm ? "Sales invoice (credit)" : "Sales" }, { value: "POS", label: screens.sm ? "Web POS bill" : "POS" }]} />}
            extra={<Button icon={<PrinterOutlined />} onClick={() => printHtml(previewHtml)}>Test print</Button>}>
            <Preview html={previewHtml} paper={config.paper} />
          </Card>
        </Col>
      </Row>

      <Modal title="New template" open={newOpen} okText="Create" onCancel={() => setNewOpen(false)}
        onOk={() => {
          const go = () => { startNew(newPreset); setNewOpen(false); };
          if (dirty && editId) Modal.confirm({ title: "Discard unsaved changes?", okText: "Discard", onOk: go });
          else go();
        }}>
        <Text type="secondary">Start from a layout. You can change everything afterwards.</Text>
        <Row gutter={[8, 8]} style={{ marginTop: 12 }}>
          {PRESETS.map((p) => (
            <Col span={12} key={p.key}>
              <div role="button" tabIndex={0} style={S.styleCard(newPreset === p.key, "#1677ff")}
                onClick={() => setNewPreset(p.key)} onKeyDown={(e) => e.key === "Enter" && setNewPreset(p.key)}>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Modal>
    </div>
  );
};

export default InvoiceDesigner;
