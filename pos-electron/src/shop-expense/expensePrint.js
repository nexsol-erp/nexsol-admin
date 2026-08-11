// Thermal (58/80mm) EXPENSE VOUCHER receipt builder, modeled on
// dayend/DayEndPage.jsx's buildDayEndReportHtml — a single-record/report style
// receipt, not the item-table style of stock-transfer/transferPrint.js.
// Paper width is applied at the OS print-job level (electron/main.js print:html
// handler reads pos-config.json printer.paperWidthMm) — this template itself
// only needs to render at a sensible fixed width like the other thermal templates.

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildExpenseVoucherHtml({
  branchInfo, branchCode,
  voucherNumber, expenseDate, expenseTypeName,
  amount, paymentMode, payee, referenceNo, remarks,
  enteredByUsername, printedAt, isReprint = false,
}) {
  const b = branchInfo || {};
  const branchName = b.branchName || branchCode || "";
  const addrParts  = [b.branchBuildingAddress, b.branchAddress1, b.branchState].filter(Boolean);
  const gst        = b.branchGst || "";

  const addrHtml = addrParts.map((l) => `<div class="addr">${escapeHtml(l)}</div>`).join("");
  const gstHtml  = gst ? `<div class="addr">GST: ${escapeHtml(gst)}</div>` : "";

  const printedDate = new Date(printedAt || Date.now()).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const expenseDateStr = expenseDate
    ? new Date(expenseDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  const row = (label, value) => value == null || value === "" ? "" : `
    <tr><td class="lbl">${escapeHtml(label)}</td><td class="val">${escapeHtml(String(value))}</td></tr>`;

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
  .shop-name { font-size: 13px; font-weight: bold; text-align: center; margin-bottom: 2px; }
  .addr { font-size: 9px; text-align: center; line-height: 1.4; }
  .report-title { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin: 3px 0; }
  .reprint-banner {
    text-align: center; font-size: 11px; font-weight: bold; color: #b00020;
    border: 1px solid #b00020; margin: 3px 0; padding: 2px;
  }
  .meta { font-size: 9px; display: flex; justify-content: space-between; margin: 2px 0; }
  hr.dash  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  hr.solid { border: none; border-top: 2px solid #000; margin: 4px 0; }
  table.t { width: 100%; border-collapse: collapse; font-size: 10px; }
  table.t td.lbl { padding: 2px 2px; color: #333; width: 42%; }
  table.t td.val { padding: 2px 2px; font-weight: 600; text-align: right; word-break: break-word; }
  .amount-line {
    display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 4px 0;
  }
  .footer { text-align: center; font-size: 9px; margin-top: 10px; }
  .sign-space { margin-top: 22px; border-top: 1px dashed #000; text-align: center; font-size: 9px; padding-top: 2px; }
</style>
</head>
<body>
  <div class="shop-name">${escapeHtml(branchName)}</div>
  ${addrHtml}${gstHtml}
  <hr class="solid"/>
  <div class="report-title">EXPENSE VOUCHER</div>
  ${isReprint ? `<div class="reprint-banner">REPRINT / DUPLICATE COPY</div>` : ""}
  <div class="meta"><span>Branch: ${escapeHtml(branchCode)}</span><span>${escapeHtml(voucherNumber)}</span></div>
  <div class="meta"><span>Date: ${escapeHtml(expenseDateStr)}</span><span>Printed: ${escapeHtml(printedDate)}</span></div>
  <hr class="dash"/>

  <table class="t">
    <tbody>
      ${row("Expense Head", expenseTypeName)}
      ${row("Payment Mode", paymentMode)}
      ${row("Paid To", payee)}
      ${row("Reference No", referenceNo)}
      ${row("Remarks", remarks)}
      ${row("Entered By", enteredByUsername)}
    </tbody>
  </table>

  <hr class="dash"/>
  <div class="amount-line"><span>Amount</span><span>&#8377; ${Number(amount || 0).toFixed(2)}</span></div>
  <hr class="solid"/>

  <div class="sign-space">Signature</div>
  <div class="footer">*** ${isReprint ? "REPRINT — " : ""}End of Expense Voucher ***</div>
  <br/><br/>
</body>
</html>`;
}
