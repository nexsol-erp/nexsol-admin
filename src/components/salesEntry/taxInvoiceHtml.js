// The A4 tax invoice the web Sales Entry prints. Pure: returns the HTML, the screen prints it.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => r2(n).toFixed(2);
const PAY_LABELS = { CASH: "Cash", UPI: "UPI", CARD: "Card" };

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven",
  "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n) {
  return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}
// Indian numbering (crore / lakh / thousand), as printed on GST invoices.
function rupeesInWords(amount) {
  const total = Math.round((Number(amount) || 0) * 100);
  let n = Math.floor(total / 100);
  const paise = total % 100;
  if (n === 0 && paise === 0) return "Rupees Zero Only";
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${crore >= 100 ? rupeesInWords(crore).replace(/^Rupees | Only$/g, "") : twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  const rupees = parts.length ? `Rupees ${parts.join(" ")}` : "Rupees Zero";
  return `${rupees}${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function taxInvoiceHtml(inv) {
  const td = (v, align = "left") => `<td style="border:1px solid #ccc;padding:4px 6px;text-align:${align};">${v}</td>`;
  const th = (v, align = "left") => `<th style="border:1px solid #ccc;padding:4px 6px;text-align:${align};background:#f3f3f3;">${v}</th>`;
  const rows = inv.lines.map((l, i) => `<tr>
      ${td(i + 1, "center")}${td(esc(l.itemName))}${td(esc(l.hsnCode || ""))}
      ${td(l.qty, "right")}${td(money(l.rate), "right")}${td(money(l.taxableAmount), "right")}
      ${td(`${l.taxRate}%`, "right")}${td(money(l.taxAmount), "right")}${td(money(l.amount), "right")}
    </tr>`).join("");
  const taxRows = inv.interState
    ? `<tr><td>IGST</td><td style="text-align:right;">${money(inv.igstAmount)}</td></tr>`
    : `<tr><td>CGST</td><td style="text-align:right;">${money(inv.cgstAmount)}</td></tr>
       <tr><td>SGST</td><td style="text-align:right;">${money(inv.sgstAmount)}</td></tr>`;
  const payRows = (inv.payments || []).map((p) =>
    `<tr><td>Paid by ${esc(PAY_LABELS[p.receiptMode] || p.receiptMode)}</td><td style="text-align:right;">${money(p.amount)}</td></tr>`).join("");
  const addr = (s) => esc(s || "").replace(/\n/g, "<br>");

  const html = `<!doctype html><html><head><title>Tax Invoice ${esc(inv.voucherNumber)}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}
    h2{text-align:center;margin:0 0 12px}
    table{border-collapse:collapse;width:100%}
    .parties td{vertical-align:top;border:1px solid #ccc;padding:6px 8px;width:33%}
    .totals{width:320px;margin-left:auto;margin-top:10px}
    .totals td{padding:3px 6px}
    .grand td{font-weight:bold;border-top:1px solid #333}
  </style></head><body>
    <h2>TAX INVOICE${inv.credit ? " (CREDIT)" : ""}</h2>
    <table class="parties"><tr>
      <td><b>${esc(inv.branchName || inv.branchCode)}</b><br>${addr(inv.branchAddress)}
          ${inv.branchState ? `<br>State: ${esc(inv.branchState)}` : ""}
          ${inv.branchGst ? `<br>GSTIN: <b>${esc(inv.branchGst)}</b>` : ""}</td>
      <td><b>Invoice No:</b> ${esc(inv.voucherNumber)}<br><b>Date:</b> ${esc(inv.voucherDate)}
          <br><b>Place of supply:</b> ${esc(inv.customerState || inv.branchState || "")}
          <br><b>Tax:</b> ${inv.interState ? "IGST (inter-state)" : "CGST + SGST"}</td>
      <td></td>
    </tr><tr>
      <td><b>Bill to</b><br><b>${esc(inv.customerName)}</b><br>${addr(inv.billingAddress)}
          ${inv.customerState ? `<br>State: ${esc(inv.customerState)}` : ""}
          ${inv.customerGst ? `<br>GSTIN: <b>${esc(inv.customerGst)}</b>` : "<br>Unregistered"}
          ${inv.customerMobile ? `<br>Mobile: ${esc(inv.customerMobile)}` : ""}</td>
      <td colspan="2"><b>Ship to</b><br>${addr(inv.deliveryAddress || inv.billingAddress)}</td>
    </tr></table>
    <table style="margin-top:10px"><thead><tr>
      ${th("#")}${th("Item")}${th("HSN")}${th("Qty", "right")}${th("Rate", "right")}
      ${th("Taxable", "right")}${th("GST", "right")}${th("Tax", "right")}${th("Amount", "right")}
    </tr></thead><tbody>${rows}</tbody></table>
    <table class="totals">
      <tr><td>Taxable value</td><td style="text-align:right;">${money(inv.taxableAmount)}</td></tr>
      ${taxRows}
      <tr class="grand"><td>Invoice total</td><td style="text-align:right;">${money(inv.totalAmount)}</td></tr>
      ${payRows}
      ${inv.credit ? `<tr class="grand"><td>Balance due</td><td style="text-align:right;">${money(inv.balanceDue)}</td></tr>` : ""}
    </table>
    <p style="margin-top:12px"><b>Amount in words:</b> ${esc(rupeesInWords(inv.totalAmount))}</p>
    <div style="margin-top:48px;text-align:right">For <b>${esc(inv.branchName || inv.branchCode)}</b><br><br><br>Authorised Signatory</div>
  </body></html>`;
  return html;
}
