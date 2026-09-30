// Weighbridge voucher HTML. Same content as the Qt voucher (wbVoucherPrint): branch header,
// voucher number and date, vehicle, weight, first weight and its date, net weight, amount,
// material. Two layouts: "a5" for a normal printer (what the Qt app prints) and "80mm" for
// a receipt printer.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmtDate(stamp) {
  // "2026-09-30 14:05:09" → "30/09/2026 14:05"
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(stamp || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : String(stamp || "");
}

function fmtKg(v) {
  const n = Number(v) || 0;
  return (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toLocaleString("en-IN", { maximumFractionDigits: 3 })) + " kg";
}

function voucherHtml(row, { header = [], layout = "a5", currency = "₹", footer = "Thank you for your business!", copyLabel = "" } = {}) {
  const fw = Number(row.first_weight) || 0;
  const net = fw ? Math.abs((Number(row.lcd_number) || 0) - fw) : 0;
  const lines = header.filter((l) => String(l || "").trim());
  const title = lines[0] || "WEIGHBRIDGE";
  const rest = lines.slice(1);

  const rows = [
    ["Vehicle No.", row.vehicle_number, "big"],
    ["Wheel Type", row.wheel_type],
    row.material ? ["Material", row.material] : null,
    row.mobile_number ? ["Mobile", row.mobile_number] : null,
    "hr",
    ["Weight", fmtKg(row.lcd_number), "big"],
    fw ? [row.first_weight_kind === "tare" ? "Tare Weight" : "First Weight", fmtKg(fw)] : null,
    fw && row.first_weight_date ? [row.first_weight_kind === "tare" ? "Tare Date" : "First Weight Date", fmtDate(row.first_weight_date)] : null,
    fw ? ["Net Weight", fmtKg(net), "big"] : null,
    "hr",
    ["Amount", `${currency} ${(Number(row.amount) || 0).toFixed(2)}`, "big"],
  ].filter(Boolean);

  const body = rows.map((r) => (r === "hr"
    ? '<tr><td colspan="2"><hr/></td></tr>'
    : `<tr class="${r[2] || ""}"><td class="k">${esc(r[0])}</td><td class="v">${esc(r[1])}</td></tr>`)).join("");

  const narrow = layout === "80mm";
  const page = narrow ? "@page { size: 80mm auto; margin: 0 }" : "@page { size: A5 portrait; margin: 10mm }";
  const width = narrow ? "width: 72mm; padding: 2mm;" : "";
  const base = narrow ? 12 : 14;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Voucher ${esc(row.voucher_number)}</title><style>
${page}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: ${base}px; color: #000; ${width} }
.h1 { font-size: ${base + 6}px; font-weight: 700; text-align: center; }
.addr { text-align: center; font-size: ${base - 1}px; line-height: 1.35; }
.title { text-align: center; font-weight: 700; letter-spacing: 2px; margin: 6px 0 4px; font-size: ${base}px; }
.copy { text-align: center; font-size: ${base - 2}px; }
.meta { display: flex; justify-content: space-between; font-weight: 700; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; }
td { padding: ${narrow ? 2 : 4}px 0; vertical-align: top; }
td.k { color: #333; width: 45%; }
td.v { font-weight: 700; text-align: right; }
tr.big td.v { font-size: ${base + 3}px; }
hr { border: none; border-top: 1px dashed #000; margin: 2px 0; }
.solid { border-top: 2px solid #000; margin: 6px 0; }
.foot { text-align: center; margin-top: 8px; }
.sign { display: flex; justify-content: space-between; margin-top: ${narrow ? 18 : 36}px; font-size: ${base - 2}px; }
.decl { font-size: ${base - 3}px; margin-top: 6px; }
</style></head><body>
<div class="h1">${esc(title)}</div>
${rest.map((l) => `<div class="addr">${esc(l)}</div>`).join("")}
<div class="solid"></div>
<div class="title">WEIGHBRIDGE VOUCHER</div>
${copyLabel ? `<div class="copy">${esc(copyLabel)}</div>` : ""}
<div class="meta"><span>No. ${esc(row.voucher_number)}</span><span>${esc(fmtDate(row.voucher_date))}</span></div>
<hr/>
<table>${body}</table>
<div class="solid"></div>
<div class="decl">The above weights are recorded accurately and truthfully.</div>
<div class="sign"><span>Driver</span><span>Operator</span></div>
<div class="foot">${esc(footer)}</div>
</body></html>`;
}

function pdfFileName(row) {
  const safe = (s) => String(s || "").replace(/[^A-Za-z0-9_-]/g, "");
  return [safe(row.vehicle_number), safe(row.voucher_number), safe(row.mobile_number)].filter(Boolean).join("-") + ".pdf";
}

module.exports = { voucherHtml, pdfFileName, fmtDate };
