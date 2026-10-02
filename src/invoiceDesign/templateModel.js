// Invoice Designer templates for the web invoices (web POS bill and the Sales Entry tax invoice).
// The server stores a template's config as given; this file is the one place that says what a
// config holds. withDefaults() fills anything an older or partial config leaves out, so adding a
// setting later never breaks a saved template. The desktop (Electron) POS never reads these.

export const DOC_TYPES = [
  { key: "SALES", label: "Sales invoice (Sales Entry, credit bills)" },
  { key: "POS", label: "Web POS bill" },
];

export const PAPERS = [
  { key: "A4", label: "A4", width: "210mm", height: "297mm" },
  { key: "A5", label: "A5", width: "148mm", height: "210mm" },
  { key: "LETTER", label: "US Letter", width: "8.5in", height: "11in" },
  { key: "THERMAL80", label: "Receipt 80 mm", width: "80mm", height: null },
  { key: "THERMAL58", label: "Receipt 58 mm", width: "58mm", height: null },
];
export const isThermal = (paper) => paper === "THERMAL80" || paper === "THERMAL58";

export const STYLES = [
  { key: "classic", label: "Classic", hint: "Ruled table, centred title" },
  { key: "modern", label: "Modern", hint: "Coloured band and soft rows" },
  { key: "minimal", label: "Minimal", hint: "Lots of white space, thin lines" },
  { key: "bold", label: "Bold", hint: "Large title, solid header row" },
];

export const FONTS = [
  { key: "sans", label: "Sans (Arial, Helvetica)", css: "Arial,Helvetica,sans-serif" },
  { key: "modern", label: "Modern (Segoe UI, Roboto)", css: '"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif' },
  { key: "serif", label: "Serif (Georgia, Times)", css: 'Georgia,"Times New Roman",serif' },
  { key: "mono", label: "Typewriter (Courier)", css: '"Courier New",Courier,monospace' },
];

export const COLUMN_KEYS = [
  { key: "sno", label: "#", align: "center" },
  { key: "item", label: "Item", align: "left" },
  { key: "hsn", label: "HSN/SAC", align: "left" },
  { key: "qty", label: "Qty", align: "right" },
  { key: "unit", label: "Unit", align: "left" },
  { key: "rate", label: "Rate", align: "right" },
  { key: "taxable", label: "Taxable", align: "right" },
  { key: "gstRate", label: "GST %", align: "right" },
  { key: "tax", label: "Tax", align: "right" },
  { key: "amount", label: "Amount", align: "right" },
];

export const DEFAULT_CONFIG = Object.freeze({
  version: 1,
  style: "modern",
  paper: "A4",
  accent: "#1f4e8c",
  font: "modern",
  fontSize: 11,
  logo: { show: true, position: "left", height: 64 },
  business: {
    name: "",
    tagline: "",
    showAddress: true,
    showPhone: true,
    showGstin: true,
    extraLines: "",
  },
  title: { sales: "TAX INVOICE", pos: "INVOICE", showCredit: true },
  details: {
    showCustomer: true,
    showCustomerGstin: true,
    showCustomerAddress: true,
    showShipTo: true,
    showCustomerMobile: true,
    showPlaceOfSupply: true,
    showTaxType: false,
  },
  columns: COLUMN_KEYS.map((c) => ({
    key: c.key,
    label: c.label,
    show: !["unit"].includes(c.key),
  })),
  totals: {
    showTaxBreakdown: true,
    showAmountInWords: true,
    showPayments: true,
    showBalanceDue: true,
    showTendered: true,
    currency: "₹",
  },
  footer: {
    bankDetails: "",
    terms: "",
    notes: "",
    thankYou: "Thank you for your business!",
    showSignature: true,
    signatureLabel: "Authorised Signatory",
  },
});

// Ready-made starting points for a new template.
export const PRESETS = [
  { key: "modern", label: "Modern A4", patch: {} },
  { key: "classic", label: "Classic A4", patch: { style: "classic", accent: "#222222", font: "sans" } },
  { key: "minimal", label: "Minimal A4", patch: { style: "minimal", accent: "#0f766e", details: { showTaxType: false } } },
  { key: "bold", label: "Bold A4", patch: { style: "bold", accent: "#b91c1c" } },
  {
    key: "thermal",
    label: "Receipt 80 mm",
    patch: {
      style: "minimal", paper: "THERMAL80", accent: "#000000", font: "sans", fontSize: 10,
      logo: { show: true, position: "center", height: 48 },
      details: { showShipTo: false, showCustomerAddress: false, showPlaceOfSupply: false },
      columns: COLUMN_KEYS.map((c) => ({ key: c.key, label: c.label, show: ["item", "qty", "rate", "amount"].includes(c.key) })),
      footer: { showSignature: false, thankYou: "** Thank you, visit again **" },
    },
  },
];

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

function merge(base, patch) {
  if (!isObj(patch)) return base;
  const out = { ...base };
  Object.keys(patch).forEach((k) => {
    if (k === "columns") return;
    out[k] = isObj(base[k]) && isObj(patch[k]) ? merge(base[k], patch[k]) : patch[k] === undefined ? base[k] : patch[k];
  });
  return out;
}

// Saved order and labels first, then any column the saved config doesn't know yet (hidden).
function mergeColumns(saved) {
  const known = new Map(COLUMN_KEYS.map((c) => [c.key, c]));
  const out = [];
  (Array.isArray(saved) ? saved : []).forEach((c) => {
    if (!c || !known.has(c.key) || out.some((o) => o.key === c.key)) return;
    out.push({ key: c.key, label: typeof c.label === "string" ? c.label : known.get(c.key).label, show: c.show !== false });
  });
  if (!out.length) return DEFAULT_CONFIG.columns.map((c) => ({ ...c }));
  COLUMN_KEYS.forEach((c) => {
    if (!out.some((o) => o.key === c.key)) out.push({ key: c.key, label: c.label, show: false });
  });
  return out;
}

export function withDefaults(config) {
  const merged = merge(JSON.parse(JSON.stringify(DEFAULT_CONFIG)), config);
  merged.columns = mergeColumns(config && config.columns);
  if (!PAPERS.some((p) => p.key === merged.paper)) merged.paper = DEFAULT_CONFIG.paper;
  if (!STYLES.some((s) => s.key === merged.style)) merged.style = DEFAULT_CONFIG.style;
  if (!FONTS.some((f) => f.key === merged.font)) merged.font = DEFAULT_CONFIG.font;
  if (!/^#[0-9a-fA-F]{6}$/.test(merged.accent || "")) merged.accent = DEFAULT_CONFIG.accent;
  const fs = Number(merged.fontSize);
  merged.fontSize = fs >= 7 && fs <= 16 ? fs : DEFAULT_CONFIG.fontSize;
  const lh = Number(merged.logo.height);
  merged.logo.height = lh >= 16 && lh <= 200 ? lh : DEFAULT_CONFIG.logo.height;
  return merged;
}

export function presetConfig(key) {
  const p = PRESETS.find((x) => x.key === key) || PRESETS[0];
  const cfg = withDefaults(p.patch);
  if (p.patch.columns) cfg.columns = p.patch.columns.map((c) => ({ ...c }));
  return cfg;
}
