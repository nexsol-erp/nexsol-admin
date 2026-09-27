// The desktop POS receipt (80 mm, printed as HTML through Electron). Pure: returns the HTML.
// ml is the optional multi-language print pack; without it the receipt prints as it always has.

import { localizer } from "../multilanguage/localizer";

export function buildReceiptHtml({ items, totalAmount, tendered, balance, receipts, itemwiseDiscount = 0, roundOff = 0, branchInfo, posAddressLines, salesmanName, customerMobile, voucherNumber, ml }) {
  const b = branchInfo || {};
  const L = localizer(ml);
  // Web Admin ▸ POS Address Configuration lines take priority once set for the
  // branch; otherwise fall back to the old fixed-field concatenation, deduped
  // (two of these columns holding identical text used to print the same
  // address line twice).
  const configuredLines = Array.isArray(posAddressLines) ? posAddressLines.filter(Boolean) : [];
  const addrParts = configuredLines.length
    ? configuredLines
    : [...new Set([b.branchBuildingAddress, b.branchAddress1, b.branchState, b.branchCountry].filter(Boolean))];

  const addrHtml  = addrParts.map((line) => `<div class="addr">${esc(line)}</div>`).join("");
  const phoneHtml = b.branchStreetAddress ? `<div class="addr">Ph: ${esc(b.branchStreetAddress)}</div>` : "";
  const gstHtml   = b.branchGst ? `<div class="addr">GST: ${esc(b.branchGst)}</div>` : "";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  // Item rows
  let serial = 0;
  const itemRows = items.map((r) => {
    serial++;
    const taxLabel = Number(r.tax_rate) > 0 ? `(${Number(r.tax_rate).toFixed(0)}%)` : "";
    const qty = Number(r.qty) || 0;
    const amt = Number(r.amount) || 0;
    // Show effective per-unit rate derived from amount so Rate × Qty always equals Amount
    const effectiveRate = qty > 0 ? (Math.round((amt / qty) * 100) / 100) : (Number(r.standard_price) || 0);
    return `
      <tr>
        <td class="sno">${serial}</td>
        <td class="iname">${L.item(esc(r.item_name), r.item_name, r.item_id)}${taxLabel ? `<span class="tax-badge">${taxLabel}</span>` : ""}</td>
        <td class="num">${qty.toFixed(2)}</td>
        <td class="num">${effectiveRate.toFixed(2)}</td>
        <td class="num">${amt.toFixed(2)}</td>
      </tr>`;
  }).join("");

  // Tax breakdown — back-calculate tax from GST-inclusive amount (Indian retail: MRP includes GST)
  const taxMap = {};
  items.forEach((r) => {
    const rate = Number(r.tax_rate) || 0;
    if (rate <= 0) return;
    if (!taxMap[rate]) taxMap[rate] = 0;
    taxMap[rate] += (Number(r.amount) || 0) * rate / (100 + rate);
  });
  let totalTax = 0;
  const taxRows = Object.entries(taxMap).map(([rate, taxAmt]) => {
    totalTax += taxAmt;
    const half = taxAmt / 2;
    return `
      <tr><td colspan="3">CGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>
      <tr><td colspan="3">SGST @${(rate/2).toFixed(1)}%</td><td class="num">${half.toFixed(2)}</td></tr>`;
  }).join("");
  const taxTotalRow = totalTax > 0
    ? `<tr class="tax-total"><td colspan="3"><b>Total Tax</b></td><td class="num"><b>${totalTax.toFixed(2)}</b></td></tr>`
    : "";

  // Payment rows
  const payRows = (receipts || [])
    .filter((r) => Number(r.amount) > 0)
    .map((r) => `
      <tr>
        <td class="pay-mode">${esc(r.receipt_mode)}</td>
        <td class="num">${Number(r.amount).toFixed(2)}</td>
      </tr>`).join("");

  const tenderRow = Number(tendered) > 0
    ? `<tr><td class="pay-mode">${L.label("TENDERED", "Tendered")}</td><td class="num">${Number(tendered).toFixed(2)}</td></tr>` : "";
  const balanceRow = Number(balance) > 0
    ? `<tr class="balance-row"><td class="pay-mode"><b>${L.label("BALANCE", "Balance")}</b></td><td class="num"><b>${Number(balance).toFixed(2)}</b></td></tr>` : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    width: 258px;
    color: #000;
    background: #fff;
    padding: 6px 4px 6px 1px;
  }
  .shop-name { font-size: 14px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
  .addr { font-size: 10px; text-align: center; line-height: 1.4; }
  .gst  { font-size: 10px; text-align: center; font-weight: bold; margin-top: 1px; }
  .dash { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  .meta { font-size: 10px; display: flex; justify-content: space-between; margin: 2px 0; }
  .meta-single { font-size: 10px; margin: 1px 0; }
  .invoice-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 2px; margin: 3px 0; }

  table.items { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.items th { text-align: left; font-size: 10px; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.items th.num { text-align: right; padding-right: 3px; }
  table.items td { padding: 1px 2px; vertical-align: top; }
  table.items td.sno  { width: 14px; color: #000; }
  table.items td.iname { width: 118px; }
  table.items td.num { text-align: right; padding-right: 3px; }
  .tax-badge { font-size: 9px; color: #000; margin-left: 2px; }

  table.tax  { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.tax td { padding: 1px 2px; }
  table.tax td.num { text-align: right; padding-right: 3px; }
  .tax-label { font-size: 10px; font-weight: bold; margin: 3px 0 1px 0; }
  .tax-total td { border-top: 1px dashed #000; }

  .total-line { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; margin: 4px 0; }

  table.pay { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.pay td { padding: 1px 2px; }
  table.pay td.pay-mode { text-transform: uppercase; }
  table.pay td.num { text-align: right; padding-right: 3px; }
  .balance-row td { border-top: 1px dashed #000; font-size: 11px; }

  .footer { text-align: center; font-size: 10px; margin-top: 4px; line-height: 1.6; }
  .footer .thanks { font-weight: bold; font-size: 11px; }
${L.css}</style>
</head>
<body>
  <div class="shop-name">${L.branch(esc(b.branchName || b.branchCode || "POS INVOICE"))}</div>
  ${addrHtml}
  ${phoneHtml}
  ${gstHtml}
  <hr class="solid"/>
  <div class="invoice-title">${L.label("TAX_INVOICE", "TAX INVOICE")}</div>
  <hr class="dash"/>
  <div class="meta"><span>${L.label("INVOICE_NUMBER", "Invoice:")} ${esc(voucherNumber || "—")}</span><span>${dateStr} ${timeStr}</span></div>
  ${customerMobile ? `<div class="meta-single">Customer: ${esc(customerMobile)}</div>` : ""}
  ${salesmanName   ? `<div class="meta-single">Served by: ${esc(salesmanName)}</div>` : ""}
  <hr class="dash"/>

  <table class="items">
    <thead>
      <tr>
        <th></th>
        <th>${L.stack("ITEM", "Item")}</th>
        <th class="num">${L.stack("QUANTITY", "Qty")}</th>
        <th class="num">${L.stack("RATE", "Rate")}</th>
        <th class="num">${L.stack("AMOUNT", "Amt")}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <hr class="dash"/>

  ${totalTax > 0 ? `
  <div class="tax-label">Tax Details</div>
  <table class="tax">
    <tbody>
      ${taxRows}
      ${taxTotalRow}
    </tbody>
  </table>
  <hr class="dash"/>` : ""}

  ${Number(itemwiseDiscount) > 0 ? `
  <div class="total-line"><span>GROSS</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
  <div class="total-line" style="color:#389e0d"><span>DISCOUNT</span><span>-${Number(itemwiseDiscount).toFixed(2)}</span></div>
  <div class="total-line"><span>SUB TOTAL</span><span>${(Number(totalAmount||0) - Number(itemwiseDiscount)).toFixed(2)}</span></div>
  ${Number(roundOff) !== 0 ? `<div class="total-line" style="font-size:11px;color:#888"><span>ROUND OFF</span><span>${Number(roundOff) > 0 ? "+" : ""}${Number(roundOff).toFixed(2)}</span></div>` : ""}
  <div class="total-line"><span>NET PAYABLE</span><span>${(Number(totalAmount||0) - Number(itemwiseDiscount) + Number(roundOff)).toFixed(2)}</span></div>
  ` : `
  <div class="total-line"><span>${L.label("TOTAL", "TOTAL")}</span><span>${Number(totalAmount||0).toFixed(2)}</span></div>
  ${Number(roundOff) !== 0 ? `<div class="total-line" style="font-size:11px;color:#888"><span>ROUND OFF</span><span>${Number(roundOff) > 0 ? "+" : ""}${Number(roundOff).toFixed(2)}</span></div>
  <div class="total-line"><span>NET PAYABLE</span><span>${(Number(totalAmount||0) + Number(roundOff)).toFixed(2)}</span></div>` : ""}
  `}
  <hr class="solid"/>

  <table class="pay">
    <tbody>
      ${payRows}
      ${tenderRow}
      ${balanceRow}
    </tbody>
  </table>
  <hr class="dash"/>

  <div class="footer">
    <div class="thanks">${L.label("THANK_YOU", "Thank you for your business!")}</div>
    <div>Please visit us again</div>
  </div>
  <br/><br/>
</body>
</html>`;
}

function esc(s) {
  return String(s||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
