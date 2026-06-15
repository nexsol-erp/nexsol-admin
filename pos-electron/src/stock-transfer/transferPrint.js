export function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildTransferHtml({
  printMode,
  fromBranch, fromBranchName, fromBranchGst, fromBranchState, fromBranchAddress,
  toBranchCode, toBranchName, toBranchGst, toBranchState,
  deliveryLocation, deliveryAddress1, deliveryAddress2,
  voucherNumber, voucherDate,
  items, totalAmount, totalQty,
}) {
  const e = escapeHtml;
  const toAddr = [deliveryLocation, deliveryAddress1, deliveryAddress2].filter(Boolean).join(", ");

  if (printMode === "a4") {
    const rows = items.map((r, i) => `
      <tr>
        <td style="padding:4px 6px;border:1px solid #ccc;">${i + 1}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${e(r.item_name)}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;">${e(r.barcode || "")}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:center;">${e(r.unit || "")}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:right;">${Number(r.qty || 0).toFixed(2)}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:right;">${Number((r.standard_price ?? r.rate) || 0).toFixed(2)}</td>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:right;">${Number(r.tax_rate || 0).toFixed(2)}%</td>
        <td style="padding:4px 6px;border:1px solid #ccc;text-align:right;">${Number(r.amount || 0).toFixed(2)}</td>
      </tr>`).join("");

    return `<html><head><style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
      h2 { text-align: center; margin: 0 0 12px; font-size: 16px; letter-spacing: 1px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
      .box { border: 1px solid #bbb; border-radius: 4px; padding: 8px 10px; }
      .box-title { font-weight: bold; font-size: 11px; color: #555; margin-bottom: 4px; text-transform: uppercase; }
      .box p { margin: 2px 0; }
      .meta { display: flex; gap: 24px; margin-bottom: 12px; }
      .meta span { font-size: 11px; }
      table { width: 100%; border-collapse: collapse; }
      thead tr { background: #f0f0f0; }
      th { padding: 5px 6px; border: 1px solid #ccc; text-align: left; font-size: 11px; }
      .totals { margin-top: 10px; display: flex; justify-content: flex-end; gap: 30px; font-weight: bold; }
    </style></head><body>
      <h2>STOCK TRANSFER</h2>
      <div class="meta">
        <span><b>Voucher No:</b> ${e(voucherNumber || "")}</span>
        <span><b>Date:</b> ${e(voucherDate ? voucherDate.slice(0, 10) : "")}</span>
      </div>
      <div class="grid">
        <div class="box">
          <div class="box-title">From Branch</div>
          <p><b>${e(fromBranch)}</b>${fromBranchName ? " — " + e(fromBranchName) : ""}</p>
          ${fromBranchGst ? `<p>GST: ${e(fromBranchGst)}</p>` : ""}
          ${fromBranchState ? `<p>State: ${e(fromBranchState)}</p>` : ""}
          ${fromBranchAddress ? `<p>${e(fromBranchAddress)}</p>` : ""}
        </div>
        <div class="box">
          <div class="box-title">To Branch</div>
          <p><b>${e(toBranchCode)}</b>${toBranchName ? " — " + e(toBranchName) : ""}</p>
          ${toBranchGst ? `<p>GST: ${e(toBranchGst)}</p>` : ""}
          ${toBranchState ? `<p>State: ${e(toBranchState)}</p>` : ""}
          ${toAddr ? `<p>${e(toAddr)}</p>` : ""}
        </div>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Item</th><th>Barcode</th><th>Unit</th>
          <th style="text-align:right">Qty</th>
          <th style="text-align:right">Rate</th>
          <th style="text-align:right">Tax%</th>
          <th style="text-align:right">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <span>Total Qty: ${Number(totalQty || 0).toFixed(2)}</span>
        <span>Total Amount: ${Number(totalAmount || 0).toFixed(2)}</span>
      </div>
    </body></html>`;
  }

  // Thermal (narrow) — same font/size/class structure as Day End printout
  const rows = items.map((r) => `
    <tr>
      <td>${e(r.item_name)}</td>
      <td class="num">${Number(r.qty || 0).toFixed(2)}</td>
      <td class="num">${Number((r.standard_price ?? r.rate) || 0).toFixed(2)}</td>
      <td class="num">${Number(r.amount || 0).toFixed(2)}</td>
    </tr>`).join("");

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
  .title      { text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; }
  .meta       { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  .section-title { font-size: 10px; font-weight: bold; margin: 3px 0 1px 0; }
  .addr       { font-size: 9px; line-height: 1.4; }
  hr.dash     { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid    { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table.t     { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.t th  { font-size: 10px; font-weight: bold; padding: 1px 2px; border-bottom: 1px dashed #000; }
  table.t th.num { text-align: right; padding-right: 3px; }
  table.t td  { padding: 1px 2px; }
  table.t td.num { text-align: right; padding-right: 3px; }
  .total-line { display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin: 3px 0; }
  .footer     { text-align: center; font-size: 9px; margin-top: 6px; }
</style>
</head>
<body>
  <hr class="solid"/>
  <div class="title">STOCK TRANSFER</div>
  <hr class="dash"/>
  <div class="meta">
    <span>Voucher: ${e(voucherNumber || "")}</span>
    <span>${e(voucherDate ? voucherDate.slice(0, 10) : "")}</span>
  </div>
  <hr class="dash"/>
  <div class="section-title">From: ${e(fromBranch)}${fromBranchName ? " " + e(fromBranchName) : ""}</div>
  ${fromBranchGst ? `<div class="addr">GST: ${e(fromBranchGst)}</div>` : ""}
  ${fromBranchState ? `<div class="addr">${e(fromBranchState)}</div>` : ""}
  ${fromBranchAddress ? `<div class="addr">${e(fromBranchAddress)}</div>` : ""}
  <hr class="dash"/>
  <div class="section-title">To: ${e(toBranchCode)}${toBranchName ? " " + e(toBranchName) : ""}</div>
  ${toBranchGst ? `<div class="addr">GST: ${e(toBranchGst)}</div>` : ""}
  ${toBranchState ? `<div class="addr">${e(toBranchState)}</div>` : ""}
  ${toAddr ? `<div class="addr">${e(toAddr)}</div>` : ""}
  <hr class="dash"/>
  <table class="t">
    <thead><tr>
      <th>Item</th>
      <th class="num">Qty</th>
      <th class="num">Rate</th>
      <th class="num">Amt</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <hr class="dash"/>
  <div class="total-line"><span>Total Qty</span><span>${Number(totalQty || 0).toFixed(2)}</span></div>
  <div class="total-line"><span>Total Amount</span><span>${Number(totalAmount || 0).toFixed(2)}</span></div>
  <hr class="solid"/>
  <div class="footer">*** End of Stock Transfer ***</div>
  <br/><br/>
</body>
</html>`;
}
