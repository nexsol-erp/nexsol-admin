// Prints an invoice (see invoiceModel.js) with an Invoice Designer template. Pure: returns a
// whole HTML document; printHtml.js prints it and the designer previews it. Everything a user
// typed goes through esc(); the logo is used only when it is a data: image.

import { withDefaults, PAPERS, FONTS, isThermal } from "./templateModel";
import { localizer } from "../multilanguage/localizer";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl2br = (s) => esc(s).replace(/\r?\n/g, "<br>");
const LOGO_RE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;
const PAY_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card", CREDIT: "Credit" };
// Second-language keys for column headings, when the multi-language module is on.
const ML_KEYS = { item: "ITEM", hsn: "HSN", qty: "QUANTITY", rate: "RATE", tax: "TAX", amount: "AMOUNT" };
const ALIGN = { sno: "center", item: "left", hsn: "left", unit: "left" };

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`);
const three = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", n % 100 ? two(n % 100) : ""].filter(Boolean).join(" ");

function indianWords(n) {
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${crore >= 100 ? indianWords(crore) : two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(" ");
}
function westernWords(n) {
  const scales = ["", " Thousand", " Million", " Billion"];
  const parts = [];
  for (let i = 0; n > 0 && i < scales.length; i += 1) {
    const chunk = n % 1000;
    if (chunk) parts.unshift(`${three(chunk)}${scales[i]}`);
    n = Math.floor(n / 1000);
  }
  return parts.join(" ");
}

// "Rupees One Thousand Two Hundred and Fifty Paise Only" for ₹; plain words for other currencies.
export function amountInWords(amount, currency) {
  const total = Math.round((Number(amount) || 0) * 100);
  const whole = Math.floor(total / 100);
  const cents = total % 100;
  const rupees = /^(₹|rs\.?|inr)$/i.test(String(currency || "").trim());
  const words = (rupees ? indianWords(whole) : westernWords(whole)) || "Zero";
  if (rupees) return `Rupees ${words}${cents ? ` and ${two(cents)} Paise` : ""} Only`;
  return `${words}${cents ? ` and ${String(cents).padStart(2, "0")}/100` : ""} Only`;
}

const fmtDate = (d) => {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d));
  const dt = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: m ? "UTC" : undefined });
};

function css(t, thermal) {
  const paper = PAPERS.find((p) => p.key === t.paper) || PAPERS[0];
  const font = (FONTS.find((f) => f.key === t.font) || FONTS[0]).css;
  const a = t.accent;
  const page = thermal
    ? `@page{size:${paper.width} auto;margin:0}`
    : `@page{size:${paper.key === "LETTER" ? "letter" : paper.key};margin:12mm}`;
  const sheet = thermal
    ? `.sheet{width:${paper.width};padding:3mm;box-sizing:border-box}`
    : `.sheet{box-sizing:border-box}`;
  const screen = thermal
    ? `@media screen{body{background:#e9ecef;padding:16px}.sheet{background:#fff;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.18)}}`
    : `@media screen{body{background:#e9ecef;padding:16px}.sheet{background:#fff;width:${paper.width};min-height:${paper.height};padding:12mm;margin:0 auto;box-shadow:0 1px 6px rgba(0,0,0,.18)}}`;
  const styles = {
    classic: `.items th{background:#f3f3f3;color:#111;border:1px solid #bbb}.items td{border:1px solid #ccc}
      .box{border:1px solid #ccc}.title{text-align:center;border-bottom:2px solid ${a};padding-bottom:4px}`,
    modern: `.hd{border-bottom:3px solid ${a};padding-bottom:10px}.items th{background:${a};color:#fff;border:0}
      .items td{border-bottom:1px solid #e5e7eb}.items tbody tr:nth-child(even) td{background:#f7f9fc}
      .box{background:#f7f9fc;border-radius:6px}.label{color:${a}}.grand td{background:${a};color:#fff}`,
    minimal: `.items th{border-bottom:1.5px solid #111;color:#555;font-weight:600;background:none}.items td{border-bottom:1px solid #eee}
      .box{border-top:1px solid #ddd;padding-left:0;padding-right:0}.title{color:${a};font-weight:300;letter-spacing:.12em}
      .grand td{border-top:1.5px solid #111}`,
    bold: `.hd{background:${a};color:#fff;padding:12px 14px;border-radius:4px}.hd .muted{color:rgba(255,255,255,.85)}
      .hd .logo{background:#fff;padding:6px;border-radius:4px}
      .title{font-size:2.1em}.items th{background:#111;color:#fff}.items td{border-bottom:1px solid #ddd}
      .box{border:2px solid ${a}}.grand td{background:#111;color:#fff}`,
  };
  return `${page}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0;padding:0}
  body{font-family:${font};font-size:${t.fontSize}pt;color:#111;line-height:1.35}
  ${sheet}
  ${screen}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;margin:0;${thermal ? "" : "width:auto;min-height:0;padding:0"}}}
  table{border-collapse:collapse;width:100%}
  .muted{color:#555}.small{font-size:.88em}.right{text-align:right}.center{text-align:center}
  .hd{display:flex;gap:14px;align-items:flex-start}
  .hd.logo-center{flex-direction:column;align-items:center;text-align:center}
  .hd.logo-right{flex-direction:row-reverse}
  .hd .biz{flex:1;min-width:0}
  .hd.logo-right .biz{text-align:right}
  .logo{display:block;max-width:220px;object-fit:contain}
  .bizname{font-size:1.55em;font-weight:700;margin:0}
  .title{font-size:1.6em;font-weight:700;margin:14px 0 8px;color:${a}}
  .meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:8px 0 12px}
  .box{padding:8px 10px}
  .label{font-size:.8em;text-transform:uppercase;letter-spacing:.06em;color:#666;font-weight:600;margin-bottom:3px}
  .items{margin-top:4px}
  .items th,.items td{padding:5px 6px;vertical-align:top}
  .items th{font-size:.86em;text-align:left}
  .sum{display:flex;gap:16px;margin-top:12px;align-items:flex-start}
  .sum .left{flex:1;min-width:0}
  .totals{width:46%;min-width:220px}
  .totals td{padding:4px 8px}
  .grand td{font-weight:700;font-size:1.12em}
  .taxtbl th,.taxtbl td{border:1px solid #ddd;padding:3px 5px;font-size:.86em}
  .taxtbl th{background:#f3f3f3}
  .foot{margin-top:18px;display:flex;gap:16px;align-items:flex-end}
  .foot .left{flex:1;min-width:0}
  .sign{text-align:right;min-width:200px}
  .sign .line{border-top:1px solid #333;margin-top:42px;padding-top:4px}
  .thanks{text-align:center;margin-top:14px;font-weight:600;color:${a}}
  ${styles[t.style] || ""}
  ${thermal ? `.hd{flex-direction:column;align-items:center;text-align:center;background:none!important;color:#111!important;padding:0!important;border:0!important}
    .hd .muted{color:#333!important}.hd .logo{background:none!important;padding:0!important}.bizname{font-size:1.3em}.title{text-align:center;font-size:1.15em;margin:6px 0;color:#111;border:0}
    .items th{background:none!important;color:#111!important;border-bottom:1px dashed #000!important;border-top:1px dashed #000!important;padding:3px 2px}
    .items td{padding:2px;border:0!important;background:none!important}
    .rule{border-top:1px dashed #000;margin:5px 0}.row{display:flex;justify-content:space-between;gap:8px}
    .grand-row{font-weight:700;font-size:1.15em}.thanks{color:#111}` : ""}`;
}

function businessBlock(t, inv, L) {
  const b = t.business;
  const name = b.name.trim() || inv.branch.name;
  const out = [`<div class="bizname">${L.branch(esc(name))}</div>`];
  if (b.tagline.trim()) out.push(`<div class="muted">${esc(b.tagline)}</div>`);
  if (b.showAddress) {
    inv.branch.addressLines.forEach((l) => out.push(`<div class="muted">${esc(l)}</div>`));
    if (inv.branch.state && !inv.branch.addressLines.some((l) => l.includes(inv.branch.state))) {
      out.push(`<div class="muted">${esc(inv.branch.state)}</div>`);
    }
  }
  if (b.showPhone && inv.branch.phone) out.push(`<div class="muted">Ph: ${esc(inv.branch.phone)}</div>`);
  if (b.showGstin && inv.branch.gstin) out.push(`<div><b>GSTIN: ${esc(inv.branch.gstin)}</b></div>`);
  if (b.extraLines.trim()) out.push(`<div class="muted">${nl2br(b.extraLines.trim())}</div>`);
  return out.join("");
}

function logoImg(t, logo) {
  if (!t.logo.show || !logo || !LOGO_RE.test(logo)) return "";
  return `<img class="logo" src="${logo}" alt="" style="height:${t.logo.height}px">`;
}

function columnsFor(t) {
  return t.columns.filter((c) => c.show);
}

function cell(key, l, i, money) {
  switch (key) {
    case "sno": return String(i + 1);
    case "hsn": return esc(l.hsn);
    case "qty": return esc(Number(l.qty).toLocaleString("en-IN", { maximumFractionDigits: 3 }));
    case "unit": return esc(l.unit);
    case "rate": return money(l.rate);
    case "taxable": return money(l.taxable);
    case "gstRate": return `${esc(l.taxRate)}%`;
    case "tax": return money(l.tax);
    case "amount": return money(l.amount);
    default: return "";
  }
}

function itemsTable(t, inv, L, money) {
  const cols = columnsFor(t);
  const head = cols.map((c) => {
    const align = ALIGN[c.key] || "right";
    const label = ML_KEYS[c.key] ? L.stack(ML_KEYS[c.key], esc(c.label)) : esc(c.label);
    return `<th style="text-align:${align}">${label}</th>`;
  }).join("");
  const rows = inv.lines.map((l, i) => `<tr>${cols.map((c) => {
    const align = ALIGN[c.key] || "right";
    const v = c.key === "item" ? L.item(esc(l.itemName), l.itemName, l.itemId) : cell(c.key, l, i, money);
    return `<td style="text-align:${align}">${v}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="items"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function taxTable(inv, money) {
  if (!inv.taxRows.some((r) => r.tax > 0)) return "";
  const head = inv.interState
    ? "<th>GST %</th><th class=\"right\">Taxable</th><th class=\"right\">IGST</th>"
    : "<th>GST %</th><th class=\"right\">Taxable</th><th class=\"right\">CGST</th><th class=\"right\">SGST</th>";
  const rows = inv.taxRows.filter((r) => r.tax > 0).map((r) => inv.interState
    ? `<tr><td>${esc(r.rate)}%</td><td class="right">${money(r.taxable)}</td><td class="right">${money(r.igst)}</td></tr>`
    : `<tr><td>${esc(r.rate)}%</td><td class="right">${money(r.taxable)}</td><td class="right">${money(r.cgst)}</td><td class="right">${money(r.sgst)}</td></tr>`).join("");
  return `<table class="taxtbl" style="margin-top:8px"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function totalRows(t, inv, L, money, cur) {
  const tt = t.totals;
  const rows = [];
  const row = (label, value, cls = "") => rows.push(`<tr class="${cls}"><td>${label}</td><td class="right">${value}</td></tr>`);
  const hasTax = inv.cgst + inv.sgst + inv.igst > 0;
  if (hasTax) row("Taxable value", money(inv.taxableAmount));
  if (inv.interState && inv.igst > 0) row("IGST", money(inv.igst));
  if (!inv.interState && hasTax) { row("CGST", money(inv.cgst)); row("SGST", money(inv.sgst)); }
  row(L.label("TOTAL", "Total"), `${esc(cur)}${cur ? " " : ""}${money(inv.totalAmount)}`, "grand");
  if (tt.showPayments) {
    inv.payments.filter((p) => p.amount > 0).forEach((p) => row(`Paid by ${esc(PAY_LABELS[p.mode] || p.mode)}`, money(p.amount)));
  }
  if (tt.showTendered && inv.tendered != null) {
    row(L.label("TENDERED", "Cash tendered"), money(inv.tendered));
    row(L.label("BALANCE", "Change"), money(inv.change));
  }
  if (tt.showBalanceDue && inv.credit) row("Balance due", money(inv.balanceDue), "grand");
  return rows.join("");
}

function titleText(t, inv) {
  const base = inv.kind === "POS" ? t.title.pos : t.title.sales;
  return `${esc(base)}${inv.credit && t.title.showCredit ? " (CREDIT)" : ""}`;
}

function a4Body(t, inv, logo, L, money, cur) {
  const d = t.details;
  const pos = t.logo.position;
  const header = `<div class="hd logo-${esc(pos)}">${logoImg(t, logo)}<div class="biz">${businessBlock(t, inv, L)}</div></div>`;

  const billTo = [];
  if (d.showCustomer) {
    billTo.push(`<div class="label">${L.label("BUYER", "Bill to")}</div><div><b>${esc(inv.customer.name)}</b></div>`);
    if (d.showCustomerAddress) inv.customer.billingLines.forEach((l) => billTo.push(`<div>${esc(l)}</div>`));
    if (d.showCustomerAddress && inv.customer.state) billTo.push(`<div>State: ${esc(inv.customer.state)}</div>`);
    if (d.showCustomerGstin) billTo.push(inv.customer.gstin ? `<div>GSTIN: <b>${esc(inv.customer.gstin)}</b></div>` : (inv.kind === "SALES" ? "<div class=\"muted\">Unregistered</div>" : ""));
    if (d.showCustomerMobile && inv.customer.mobile) billTo.push(`<div>Mobile: ${esc(inv.customer.mobile)}</div>`);
  }
  const shipTo = d.showShipTo && inv.customer.shippingLines.length
    ? `<div class="label">Ship to</div>${inv.customer.shippingLines.map((l) => `<div>${esc(l)}</div>`).join("")}` : "";
  const info = [
    `<div class="label">${L.label("INVOICE_NUMBER", "Invoice No")}</div><div><b>${esc(inv.voucherNumber)}</b></div>`,
    `<div class="label" style="margin-top:6px">${L.label("DATE", "Date")}</div><div>${esc(fmtDate(inv.voucherDate))}</div>`,
  ];
  if (d.showPlaceOfSupply && inv.placeOfSupply) info.push(`<div class="label" style="margin-top:6px">Place of supply</div><div>${esc(inv.placeOfSupply)}</div>`);
  if (d.showTaxType) info.push(`<div class="label" style="margin-top:6px">Tax</div><div>${inv.interState ? "IGST (inter-state)" : "CGST + SGST"}</div>`);
  const boxes = [billTo.join(""), shipTo, info.join("")].filter(Boolean);
  const meta = boxes.map((h) => `<div class="box">${h}</div>`).join("");

  const tt = t.totals;
  const left = [];
  if (tt.showAmountInWords) left.push(`<div class="label">Amount in words</div><div>${esc(amountInWords(inv.totalAmount, cur))}</div>`);
  if (tt.showTaxBreakdown) left.push(taxTable(inv, money));
  if (t.footer.bankDetails.trim()) left.push(`<div class="label" style="margin-top:10px">Bank details</div><div class="small">${nl2br(t.footer.bankDetails.trim())}</div>`);

  const f = t.footer;
  const footLeft = [];
  if (f.terms.trim()) footLeft.push(`<div class="label">Terms &amp; conditions</div><div class="small">${nl2br(f.terms.trim())}</div>`);
  if (f.notes.trim()) footLeft.push(`<div class="label" style="margin-top:8px">Notes</div><div class="small">${nl2br(f.notes.trim())}</div>`);
  const sign = f.showSignature
    ? `<div class="sign">For <b>${esc(t.business.name.trim() || inv.branch.name)}</b><div class="line">${esc(f.signatureLabel)}</div></div>` : "";

  return `${header}
    <div class="title">${titleText(t, inv)}</div>
    <div class="meta" style="grid-template-columns:repeat(${boxes.length},minmax(0,1fr))">${meta}</div>
    ${itemsTable(t, inv, L, money)}
    <div class="sum"><div class="left">${left.join("")}</div><table class="totals">${totalRows(t, inv, L, money, cur)}</table></div>
    ${footLeft.length || sign ? `<div class="foot"><div class="left">${footLeft.join("")}</div>${sign}</div>` : ""}
    ${f.thankYou.trim() ? `<div class="thanks">${esc(f.thankYou)}</div>` : ""}`;
}

function thermalBody(t, inv, logo, L, money, cur) {
  const d = t.details;
  const tt = t.totals;
  const row = (l, r, cls = "") => `<div class="row ${cls}"><span>${l}</span><span>${r}</span></div>`;
  const out = [`<div class="hd">${logoImg(t, logo)}<div class="biz">${businessBlock(t, inv, L)}</div></div>`,
    `<div class="title">${titleText(t, inv)}</div>`,
    row(`${L.label("BILL_NUMBER", "Bill No")}: ${esc(inv.voucherNumber)}`, esc(fmtDate(inv.voucherDate)))];
  if (d.showCustomer) out.push(`<div>${L.label("CUSTOMER", "Customer")}: ${esc(inv.customer.name)}</div>`);
  if (d.showCustomerGstin && inv.customer.gstin) out.push(`<div>GSTIN: ${esc(inv.customer.gstin)}</div>`);
  if (d.showCustomerMobile && inv.customer.mobile) out.push(`<div>Mobile: ${esc(inv.customer.mobile)}</div>`);
  if (d.showCustomerAddress) inv.customer.billingLines.forEach((l) => out.push(`<div>${esc(l)}</div>`));
  out.push(itemsTable(t, inv, L, money));
  out.push('<div class="rule"></div>');
  const hasTax = inv.cgst + inv.sgst + inv.igst > 0;
  if (tt.showTaxBreakdown && hasTax) {
    inv.taxRows.filter((r) => r.tax > 0).forEach((r) => {
      if (inv.interState) out.push(row(`IGST @${esc(r.rate)}%`, money(r.igst), "small"));
      else {
        out.push(row(`CGST @${esc(r.rate / 2)}%`, money(r.cgst), "small"));
        out.push(row(`SGST @${esc(r.rate / 2)}%`, money(r.sgst), "small"));
      }
    });
    out.push('<div class="rule"></div>');
  }
  out.push(row(L.label("TOTAL", "TOTAL"), `${esc(cur)}${cur ? " " : ""}${money(inv.totalAmount)}`, "grand-row"));
  if (tt.showPayments) inv.payments.filter((p) => p.amount > 0 && inv.kind !== "POS").forEach((p) => out.push(row(`Paid by ${esc(PAY_LABELS[p.mode] || p.mode)}`, money(p.amount))));
  if (tt.showTendered && inv.tendered != null) {
    out.push(row(L.label("TENDERED", "Cash tendered"), money(inv.tendered)));
    out.push(row(L.label("BALANCE", "Change"), money(inv.change)));
  }
  if (tt.showBalanceDue && inv.credit) out.push(row("Balance due", money(inv.balanceDue), "grand-row"));
  if (tt.showAmountInWords) out.push(`<div class="small" style="margin-top:4px">${esc(amountInWords(inv.totalAmount, cur))}</div>`);
  const f = t.footer;
  if (f.bankDetails.trim()) out.push(`<div class="rule"></div><div class="small">${nl2br(f.bankDetails.trim())}</div>`);
  if (f.terms.trim()) out.push(`<div class="rule"></div><div class="small">${nl2br(f.terms.trim())}</div>`);
  if (f.notes.trim()) out.push(`<div class="small" style="margin-top:4px">${nl2br(f.notes.trim())}</div>`);
  if (f.thankYou.trim()) out.push(`<div class="thanks">${esc(f.thankYou)}</div>`);
  return out.join("\n");
}

/**
 * template: { config, logo } as the server returns it (config may be partial).
 * inv: from invoiceModel.js. ml: the optional multi-language print pack.
 */
export function renderInvoiceHtml(template, inv, ml) {
  const t = withDefaults(template && template.config);
  const logo = template && template.logo;
  const L = localizer(ml);
  const thermal = isThermal(t.paper);
  const cur = t.totals.currency || "";
  const money = (n) => esc((Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const body = thermal ? thermalBody(t, inv, logo, L, money, cur) : a4Body(t, inv, logo, L, money, cur);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${titleText(t, inv)} ${esc(inv.voucherNumber)}</title>
<style>${css(t, thermal)}
${L.css}</style></head><body><div class="sheet">${body}</div></body></html>`;
}
