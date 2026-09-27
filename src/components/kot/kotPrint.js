// 80 mm slips for the web KOT screen: kitchen order, guest bill (proforma) and the final receipt.
// Same layout as the desktop POS (pos-electron/src/pos/kotPrint.js) so kitchens see one format.
// Bill and receipt take an optional multi-language pack (ml); without it they print as always.

import { localizer } from "../../multilanguage/localizer";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n, d = 2) => Number(n || 0).toFixed(d);
const when = (d) =>
  new Date(d || Date.now()).toLocaleString("en-IN", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  });

const STYLE = `
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 11px; width: 72mm; margin: 0; color: #000; }
  h3 { text-align: center; margin: 0 0 2px; font-size: 14px; text-transform: uppercase; }
  .c { text-align: center; } .b { font-weight: bold; } .s { font-size: 9px; } .r { text-align: right; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 9px; }
  td { padding: 2px 0; vertical-align: top; }
  .tot td { font-weight: bold; border-top: 1px solid #000; padding-top: 3px; font-size: 13px; }
`;

function head({ branchName, branchAddress, branchGst }, fallback, L) {
  return `<h3>${L.branch(esc(branchName || fallback))}</h3>
    ${branchAddress ? `<div class="c s">${esc(branchAddress)}</div>` : ""}
    ${branchGst ? `<div class="c s">GSTIN: ${esc(branchGst)}</div>` : ""}<hr/>`;
}

function tableAndCaptain(tableName, salesMan, L) {
  return `${tableName ? `<div><b>${L.label("TABLE", "Table:")}</b> ${esc(tableName)}</div>` : ""}
    ${salesMan ? `<div><b>Captain:</b> ${esc(salesMan)}</div>` : ""}<hr/>`;
}

function itemRows(items, L) {
  return items.map((r) => `<tr><td>${L.item(esc(r.itemName), r.itemName, r.itemId)}</td><td class="r" style="padding:2px 4px">${num(r.qty)}</td>
      <td class="r" style="padding:2px 4px">${num(r.rate)}</td><td class="r">${num(r.amount)}</td></tr>`).join("");
}

// GST is included in POS rates, so back it out per rate.
function gstRows(items) {
  const byRate = {};
  items.forEach((r) => {
    const rate = Number(r.taxRate || 0);
    if (rate) byRate[rate] = (byRate[rate] || 0) + Number(r.amount || 0);
  });
  return Object.entries(byRate)
    .map(([rate, gross]) => `<tr><td>GST ${rate}% (incl.)</td><td class="r">${num((gross * rate) / (100 + Number(rate)))}</td></tr>`)
    .join("");
}

const itemHead = (L) => `<thead><tr><th>${L.stack("ITEM", "Item")}</th><th class="r">${L.stack("QUANTITY", "Qty")}</th>`
  + `<th class="r">${L.stack("RATE", "Rate")}</th><th class="r">${L.stack("AMOUNT", "Amt")}</th></tr></thead>`;

export function kotSlipHtml({ branch = {}, kotNumber, tableName, salesMan, items, duplicate }) {
  const rows = items.map((r) => `<tr><td style="font-size:12px">${esc(r.itemName)}</td>
      <td class="r b" style="font-size:13px">${num(r.qty, Number(r.qty) % 1 ? 2 : 0)}</td></tr>`).join("");
  return `<html><head><title>KOT</title><style>${STYLE}</style></head><body>
    <h3>${esc(branch.branchName || "Kitchen Order")}</h3><hr/>
    <div class="c b" style="font-size:15px">KOT # ${esc(kotNumber)}</div>
    <div class="c s">${when()}</div><hr/>
    ${tableAndCaptain(tableName, salesMan, localizer(null))}
    <table><thead><tr><th>Item</th><th class="r">Qty</th></tr></thead><tbody>${rows}</tbody></table><hr/>
    ${duplicate ? `<div class="c b">** DUPLICATE KOT **</div>` : ""}
    <div class="c" style="margin-top:6px">${items.length} item${items.length === 1 ? "" : "s"}</div>
  </body></html>`;
}

export function billHtml({ branch = {}, kotNumber, tableName, salesMan, items, ml }) {
  const L = localizer(ml);
  const total = items.reduce((s, r) => s + Number(r.amount || 0), 0);
  const gst = gstRows(items);
  return `<html><head><title>Bill</title><style>${STYLE}${L.css}</style></head><body>
    ${head(branch, "Bill", L)}
    <div class="c b" style="font-size:12px">PROFORMA BILL</div>
    ${kotNumber ? `<div class="c s">KOT # ${esc(kotNumber)}</div>` : ""}
    <div class="c s">${when()}</div><hr/>
    ${tableAndCaptain(tableName, salesMan, L)}
    <table>${itemHead(L)}<tbody>${itemRows(items, L)}</tbody></table><hr/>
    ${gst ? `<table><tbody>${gst}</tbody></table><hr/>` : ""}
    <table><tbody><tr class="tot"><td>${L.label("TOTAL", "TOTAL")}</td><td class="r">&#8377;${num(total)}</td></tr></tbody></table><hr/>
    <div class="c s" style="margin-top:6px">** NOT A TAX INVOICE **</div>
    <div class="c s">${L.label("THANK_YOU", "Thank you!")}</div>
  </body></html>`;
}

// inv is the server's WebSalesInvoiceResponse.
export function receiptHtml({ inv, tableName, salesMan, tendered, ml }) {
  const L = localizer(ml);
  const items = (inv.lines || []).map((l) => ({ ...l, qty: Number(l.qty), rate: Number(l.rate), amount: Number(l.amount) }));
  const pays = (inv.payments || []).map((p) => `<tr><td>Paid by ${esc(p.receiptMode)}</td><td class="r">${num(p.amount)}</td></tr>`).join("");
  const cash = (inv.payments || []).find((p) => p.receiptMode === "CASH");
  const change = cash && tendered > cash.amount ? tendered - cash.amount : 0;
  const tax = inv.interState
    ? `<tr><td>IGST</td><td class="r">${num(inv.igstAmount)}</td></tr>`
    : `<tr><td>CGST</td><td class="r">${num(inv.cgstAmount)}</td></tr><tr><td>SGST</td><td class="r">${num(inv.sgstAmount)}</td></tr>`;
  return `<html><head><title>Receipt</title><style>${STYLE}${L.css}</style></head><body>
    ${head(inv, "Receipt", L)}
    <div class="c b" style="font-size:12px">${L.label("TAX_INVOICE", "TAX INVOICE")}</div>
    <div class="c s">${L.label("BILL_NUMBER", "Bill #")} ${esc(inv.voucherNumber)}</div>
    <div class="c s">${when()}</div><hr/>
    ${inv.customerName && inv.customerName !== "POS" ? `<div><b>${L.label("CUSTOMER", "Customer:")}</b> ${esc(inv.customerName)}</div>` : ""}
    ${inv.customerGst ? `<div><b>GSTIN:</b> ${esc(inv.customerGst)}</div>` : ""}
    ${tableAndCaptain(tableName, salesMan, L)}
    <table>${itemHead(L)}<tbody>${itemRows(items, L)}</tbody></table><hr/>
    <table><tbody><tr><td>Taxable</td><td class="r">${num(inv.taxableAmount)}</td></tr>${tax}</tbody></table><hr/>
    <table><tbody><tr class="tot"><td>${L.label("TOTAL", "TOTAL")}</td><td class="r">&#8377;${num(inv.totalAmount)}</td></tr>
      ${pays}${change > 0 ? `<tr><td>${L.label("TENDERED", "Tendered")}</td><td class="r">${num(tendered)}</td></tr><tr><td>${L.label("BALANCE", "Change")}</td><td class="r">${num(change)}</td></tr>` : ""}
    </tbody></table><hr/>
    <div class="c" style="margin-top:6px">${L.label("THANK_YOU", "Thank you, visit again!")}</div>
  </body></html>`;
}

// Prints through a hidden iframe: no pop-up blocker, and it works in phone browsers.
export function printHtml(html) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", right: 0, bottom: 0, width: 0, height: 0, border: 0 });
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  const remove = () => frame.isConnected && frame.remove();
  frame.contentWindow.onafterprint = () => setTimeout(remove, 100);
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 250);
  setTimeout(remove, 60000);
}
