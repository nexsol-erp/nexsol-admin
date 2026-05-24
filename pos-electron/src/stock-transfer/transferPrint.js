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

  // Thermal (narrow)
  const rows = items.map((r) => `
    <tr>
      <td>${e(r.item_name)}</td>
      <td style="text-align:right">${Number(r.qty || 0).toFixed(2)}</td>
      <td style="text-align:right">${Number((r.standard_price ?? r.rate) || 0).toFixed(2)}</td>
      <td style="text-align:right">${Number(r.amount || 0).toFixed(2)}</td>
    </tr>`).join("");

  return `<html><head><style>
    @page { size: 80mm auto; margin: 4mm; }
    body { font-family: monospace; font-size: 11px; width: 72mm; }
    h3 { text-align: center; margin: 0 0 4px; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    table { width: 100%; font-size: 10px; }
    th { text-align: left; }
    .row { display: flex; justify-content: space-between; }
  </style></head><body>
    <h3>STOCK TRANSFER</h3>
    ${voucherNumber ? `<div>Voucher: ${e(voucherNumber)}</div>` : ""}
    ${voucherDate ? `<div>Date: ${e(voucherDate.slice(0, 10))}</div>` : ""}
    <hr/>
    <div><b>From:</b> ${e(fromBranch)}${fromBranchName ? " " + e(fromBranchName) : ""}</div>
    ${fromBranchGst ? `<div>GST: ${e(fromBranchGst)}</div>` : ""}
    <hr/>
    <div><b>To:</b> ${e(toBranchCode)}${toBranchName ? " " + e(toBranchName) : ""}</div>
    ${toBranchGst ? `<div>GST: ${e(toBranchGst)}</div>` : ""}
    ${toAddr ? `<div>${e(toAddr)}</div>` : ""}
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
    <div class="row"><span>Total Qty</span><span>${Number(totalQty || 0).toFixed(2)}</span></div>
    <div class="row"><span>Total Amount</span><span>${Number(totalAmount || 0).toFixed(2)}</span></div>
  </body></html>`;
}
