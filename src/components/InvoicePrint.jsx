import React, { forwardRef } from "react";
import "./invoice.css";

const InvoicePrint = forwardRef(({ bill }, ref) => {
  if (!bill) return null;

  const bi = bill.branchInfo || {};
  const storeName = bi.branchName || "MY STORE";

  // Phone is stored in branchStreetAddress — show labeled, not as address line
  const phone = bi.branchStreetAddress;
  const addressParts = [
    bi.branchBuildingAddress,
    bi.branchAddress1,
    bi.branchAddress2,
  ].filter(Boolean);
  const storeGst  = bi.branchGst || bill.gstin;
  const storeState = bi.branchState;

  const salesDetails = bill.salesDetails || [];

  // Tax breakdown (CGST + SGST split)
  const taxMap = {};
  salesDetails.forEach((item) => {
    const rate = Number(item.taxRate ?? item.tax_rate ?? 0);
    if (rate <= 0) return;
    const taxAmt = (Number(item.amount) || 0) * rate / 100;
    taxMap[rate] = (taxMap[rate] || 0) + taxAmt;
  });
  const totalTax = Object.values(taxMap).reduce((s, v) => s + v, 0);

  const fmtDate = (d) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return String(d); }
  };

  return (
    <div className="receipt-container" ref={ref}>
      {/* Header */}
      <div className="receipt-header">
        <h2 style={{ margin: 0, fontSize: "18px" }}>{storeName}</h2>
        {addressParts.map((line, i) => <div key={i}>{line}</div>)}
        {storeState && !addressParts.some((p) => p?.includes(storeState)) && <div>{storeState}</div>}
        {phone && <div>Ph: {phone}</div>}
        {storeGst && <div>GSTIN: {storeGst}</div>}
      </div>

      <div className="receipt-divider" />

      {/* Meta */}
      <div className="receipt-info">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Bill No: {bill.voucherNumber || "N/A"}</span>
          <span>{fmtDate(bill.voucherDate)}</span>
        </div>
        <div>Customer: <span className="uppercase">{bill.customer?.name || "Walk-In"}</span></div>
      </div>

      <div className="receipt-divider" />

      {/* Items */}
      <table className="receipt-table">
        <thead>
          <tr>
            <th style={{ width: "45%" }}>ITEM</th>
            <th className="text-right" style={{ width: "15%" }}>QTY</th>
            <th className="text-right" style={{ width: "20%" }}>RATE</th>
            <th className="text-right" style={{ width: "20%" }}>AMT</th>
          </tr>
        </thead>
        <tbody>
          {salesDetails.map((item, index) => (
            <tr key={index}>
              <td style={{ paddingRight: 5 }}>{item.itemName}</td>
              <td className="text-right">{item.qty}</td>
              <td className="text-right">{Number(item.rate || 0).toFixed(2)}</td>
              <td className="text-right">{Number(item.amount || 0).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      {/* Tax breakdown */}
      {totalTax > 0 && (
        <>
          <div style={{ fontSize: "11px", fontWeight: "bold", marginBottom: 2 }}>Tax Details</div>
          {Object.entries(taxMap).map(([rate, taxAmt]) => {
            const half = taxAmt / 2;
            return (
              <React.Fragment key={rate}>
                <div className="receipt-summary" style={{ fontSize: "11px" }}>
                  <span>CGST @{(Number(rate) / 2).toFixed(1)}%</span>
                  <span>{half.toFixed(2)}</span>
                </div>
                <div className="receipt-summary" style={{ fontSize: "11px" }}>
                  <span>SGST @{(Number(rate) / 2).toFixed(1)}%</span>
                  <span>{half.toFixed(2)}</span>
                </div>
              </React.Fragment>
            );
          })}
          <div className="receipt-summary text-bold" style={{ fontSize: "12px", borderTop: "1px dashed #ccc", paddingTop: 2 }}>
            <span>Total Tax</span>
            <span>{totalTax.toFixed(2)}</span>
          </div>
          <div className="receipt-divider" />
        </>
      )}

      {/* Total */}
      <div className="receipt-summary text-bold" style={{ fontSize: "14px" }}>
        <span>TOTAL:</span>
        <span>Rs. {Number(bill.totalAmount || 0).toFixed(2)}</span>
      </div>

      {Number(bill.tendered) > 0 && (
        <>
          <div className="receipt-summary">
            <span>Cash Tendered:</span>
            <span>{Number(bill.tendered).toFixed(2)}</span>
          </div>
          <div className="receipt-summary">
            <span>Change Due:</span>
            <span>{Math.max(Number(bill.tendered) - Number(bill.totalAmount || 0), 0).toFixed(2)}</span>
          </div>
        </>
      )}

      <div className="receipt-divider" />

      {/* Footer */}
      <div className="receipt-footer">
        <div>** THANK YOU VISIT AGAIN **</div>
        <div style={{ marginTop: 5 }}>software by Maple ERP</div>
      </div>
    </div>
  );
});

export default InvoicePrint;
