function e(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
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
