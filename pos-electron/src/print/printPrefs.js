const KEY = "pos_print_prefs";

// "" / 0 both mean "use each receipt's own built-in default" — this is the
// out-of-the-box behaviour and stays the default until the user opts into a
// different font/size from Settings ▸ Print Settings.
export const FONT_FAMILY_OPTIONS = [
  { value: "", label: "Default (as designed)" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "'Segoe UI', Tahoma, sans-serif", label: "Segoe UI" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "'Courier New', Courier, monospace", label: "Courier New" },
  { value: "Consolas, 'Courier New', monospace", label: "Consolas" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
];

export const FONT_SIZE_OPTIONS = [
  { value: 0, label: "Default (as designed)" },
  { value: 9, label: "Small (9px)" },
  { value: 11, label: "Medium (11px)" },
  { value: 13, label: "Large (13px)" },
  { value: 16, label: "Extra Large (16px)" },
];

export function getPrintPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      fontFamily: typeof raw.fontFamily === "string" ? raw.fontFamily : "",
      fontSizePx: Number(raw.fontSizePx) || 0,
    };
  } catch {
    return { fontFamily: "", fontSizePx: 0 };
  }
}

export function setPrintPrefs(prefs) {
  localStorage.setItem(
    KEY,
    JSON.stringify({
      fontFamily: prefs.fontFamily || "",
      fontSizePx: Number(prefs.fontSizePx) || 0,
    })
  );
}

/**
 * Same override logic the Electron preload applies to every real print job
 * (electron/preload.js — duplicated there because preload is plain CommonJS,
 * not bundled through Vite). Used here only to render the in-app print preview.
 */
export function applyPrintPrefs(html, prefs = getPrintPrefs()) {
  if (typeof html !== "string" || !html) return html;
  const { fontFamily, fontSizePx } = prefs;
  if (!fontFamily && !fontSizePx) return html;

  const rules = [];
  if (fontFamily) rules.push(`*, *::before, *::after { font-family: ${fontFamily} !important; }`);
  if (fontSizePx) {
    rules.push(
      `body, table, tr, td, th, div, span, p, b, strong, small { font-size: ${fontSizePx}px !important; }`
    );
  }
  const styleTag = `<style id="pos-print-override">${rules.join("\n")}</style>`;
  return html.includes("</head>") ? html.replace("</head>", styleTag + "</head>") : styleTag + html;
}

/** A representative sample receipt used for "Test Print" so the user can judge
 * readability before committing the setting to real sales/vouchers. */
export function buildTestPrintHtml() {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  @page { margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; width: 258px; margin: 0 auto; padding: 6px; }
  .shop-name { font-size: 14px; font-weight: bold; text-align: center; }
  .center { text-align: center; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td, th { padding: 2px 0; }
  .total-line { font-weight: bold; font-size: 12px; border-top: 1px dashed #000; margin-top: 4px; padding-top: 4px; }
</style></head>
<body>
  <div class="shop-name">SAMPLE SHOP NAME</div>
  <div class="center">123 Main Street, City</div>
  <div class="center">GSTIN: 12ABCDE3456F1Z8</div>
  <hr />
  <table>
    <tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Amount</th></tr>
    <tr><td>Sample Item A</td><td align="right">2</td><td align="right">100.00</td></tr>
    <tr><td>Sample Item B</td><td align="right">1</td><td align="right">45.50</td></tr>
  </table>
  <div class="total-line">Total: 145.50</div>
  <div class="center">Thank you, visit again!</div>
</body></html>`;
}
