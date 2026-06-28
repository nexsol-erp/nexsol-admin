function e(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmtNum(n, d = 2) { return Number(n || 0).toFixed(d); }

function taxSummaryRows(items) {
  const map = {};
  for (const r of items) {
    const rate = Number(r.taxRate || r.tax_rate || 0);
    if (!rate) continue;
    if (!map[rate]) map[rate] = 0;
    map[rate] += Number(r.amount || 0);
  }
  return Object.entries(map).map(([rate, gross]) => {
    const taxAmt = gross * Number(rate) / (100 + Number(rate));
    return `<tr><td>GST ${rate}%</td><td style="text-align:right">₹${fmtNum(taxAmt)}</td></tr>`;
  }).join("");
}

const BILL_STYLE = `
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: "Courier New", monospace; font-size: 10px; width: 72mm; margin: 0; }
  h3   { text-align: center; margin: 0 0 2px; font-size: 13px; text-transform: uppercase; }
  .center { text-align: center; }
  .bold   { font-weight: bold; }
  hr  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th  { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 9px; }
  td  { padding: 2px 0; vertical-align: top; }
  .r  { text-align: right; }
  .total-row td { font-weight: bold; border-top: 1px solid #000; padding-top: 3px; }
`;

export function buildBillHtml({ branchName, branchAddress, branchGst, tableName, salesMan, items, voucherDate, kotNumber }) {
  const dateStr = voucherDate
    ? new Date(voucherDate).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  const total = items.reduce((s, r) => s + (Number(r.amount || 0)), 0);

  const rows = items.map((r) => `
    <tr>
      <td>${e(r.itemName || r.item_name)}</td>
      <td class="r" style="padding:2px 4px">${fmtNum(r.qty)}</td>
      <td class="r" style="padding:2px 4px">${fmtNum(r.rate || r.standard_price)}</td>
      <td class="r">${fmtNum(r.amount)}</td>
    </tr>`).join("");

  const taxRows = taxSummaryRows(items);

  return `<html><head><style>${BILL_STYLE}</style></head><body>
    <h3>${e(branchName || "BILL")}</h3>
    ${branchAddress ? `<div class="center" style="font-size:9px">${e(branchAddress)}</div>` : ""}
    ${branchGst ? `<div class="center" style="font-size:9px">GSTIN: ${e(branchGst)}</div>` : ""}
    <hr/>
    <div class="bold center" style="font-size:12px">PROFORMA INVOICE</div>
    ${kotNumber ? `<div class="center" style="font-size:9px">KOT # ${e(kotNumber)}</div>` : ""}
    ${dateStr ? `<div class="center" style="font-size:9px">${dateStr}</div>` : ""}
    <hr/>
    ${tableName ? `<div><b>Table:</b> ${e(tableName)}</div>` : ""}
    ${salesMan  ? `<div><b>Captain:</b> ${e(salesMan)}</div>` : ""}
    <hr/>
    <table>
      <thead><tr>
        <th>Item</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amt</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    ${taxRows ? `<table><tbody>${taxRows}</tbody></table><hr/>` : ""}
    <table><tbody>
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="r" style="font-size:13px">₹${fmtNum(total)}</td>
      </tr>
    </tbody></table>
    <hr/>
    <div class="center" style="margin-top:6px;font-size:9px">** PROFORMA — NOT A TAX INVOICE **</div>
    <div class="center" style="font-size:9px">Thank you!</div>
  </body></html>`;
}

export function buildFinalReceiptHtml({ branchName, branchAddress, branchGst, tableName, salesMan, items, voucherNumber, voucherDate, payMode, tendered, change }) {
  const dateStr = voucherDate
    ? new Date(voucherDate).toLocaleString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  const total = items.reduce((s, r) => s + (Number(r.amount || 0)), 0);

  const rows = items.map((r) => `
    <tr>
      <td>${e(r.itemName || r.item_name)}</td>
      <td class="r" style="padding:2px 4px">${fmtNum(r.qty)}</td>
      <td class="r" style="padding:2px 4px">${fmtNum(r.rate || r.standard_price)}</td>
      <td class="r">${fmtNum(r.amount)}</td>
    </tr>`).join("");

  const taxRows = taxSummaryRows(items);
  const isCash  = (payMode || "").toUpperCase() === "CASH";

  return `<html><head><style>${BILL_STYLE}</style></head><body>
    <h3>${e(branchName || "RECEIPT")}</h3>
    ${branchAddress ? `<div class="center" style="font-size:9px">${e(branchAddress)}</div>` : ""}
    ${branchGst ? `<div class="center" style="font-size:9px">GSTIN: ${e(branchGst)}</div>` : ""}
    <hr/>
    <div class="bold center" style="font-size:12px">TAX INVOICE</div>
    ${voucherNumber ? `<div class="center" style="font-size:9px">Bill # ${e(voucherNumber)}</div>` : ""}
    ${dateStr ? `<div class="center" style="font-size:9px">${dateStr}</div>` : ""}
    <hr/>
    ${tableName ? `<div><b>Table:</b> ${e(tableName)}</div>` : ""}
    ${salesMan  ? `<div><b>Captain:</b> ${e(salesMan)}</div>` : ""}
    <hr/>
    <table>
      <thead><tr>
        <th>Item</th>
        <th style="text-align:right">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amt</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    ${taxRows ? `<table><tbody>${taxRows}</tbody></table><hr/>` : ""}
    <table><tbody>
      <tr class="total-row">
        <td>TOTAL</td>
        <td class="r" style="font-size:13px">₹${fmtNum(total)}</td>
      </tr>
      <tr><td>Payment</td><td class="r">${e(payMode || "CASH")}</td></tr>
      ${isCash && tendered ? `<tr><td>Tendered</td><td class="r">₹${fmtNum(tendered)}</td></tr>` : ""}
      ${isCash && tendered ? `<tr><td>Change</td><td class="r">₹${fmtNum(change || 0)}</td></tr>` : ""}
    </tbody></table>
    <hr/>
    <div class="center" style="margin-top:6px">Thank you, visit again!</div>
  </body></html>`;
}

export function buildKotHtml({ branchName, branchAddress, kotNumber, voucherDate, salesMan, tableName, items, isDuplicate }) {
  const dateStr = voucherDate
    ? new Date(voucherDate).toLocaleString("en-IN", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      })
    : "";

  const rows = items
    .map(
      (r) => `
    <tr>
      <td style="padding:2px 0">${e(r.itemName)}</td>
      <td style="text-align:right;padding:2px 4px">${Number(r.qty || 0).toFixed(2)}</td>
      <td style="text-align:right;padding:2px 0">${Number(r.rate || 0).toFixed(2)}</td>
    </tr>`
    )
    .join("");

  return `<html><head><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: "Courier New", monospace; font-size: 10px; width: 72mm; margin: 0; }
    h3 { text-align: center; margin: 0 0 2px; font-size: 13px; text-transform: uppercase; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 9px; }
    .dup { text-align: center; font-weight: bold; letter-spacing: 1px; margin: 4px 0; }
  </style></head><body>
    <h3>${e(branchName || "KITCHEN ORDER")}</h3>
    ${branchAddress ? `<div class="center" style="font-size:9px">${e(branchAddress)}</div>` : ""}
    <hr/>
    <div class="bold center" style="font-size:14px">KOT # ${e(kotNumber)}</div>
    ${dateStr ? `<div class="center" style="font-size:9px">${dateStr}</div>` : ""}
    <hr/>
    ${tableName ? `<div><b>Table:</b> ${e(tableName)}</div>` : ""}
    ${salesMan ? `<div><b>Captain:</b> ${e(salesMan)}</div>` : ""}
    <hr/>
    <table>
      <thead>
        <tr>
          <th>Item Name</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Rate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <hr/>
    ${isDuplicate ? `<div class="dup">** DUPLICATE KOT **</div>` : ""}
    <div class="center" style="margin-top:6px">Happy Cooking!</div>
  </body></html>`;
}
