import React, { forwardRef } from "react";
import "./invoice.css";

const InvoicePrint = forwardRef(({ bill }, ref) => {
  if (!bill) return null;

  return (
    <div className="receipt-container" ref={ref}>
      {/* Header */}
      <div className="receipt-header">
        <h2 style={{ margin: 0, fontSize: '18px' }}>MY STORE</h2>
        <div>123 Main Street, Market Area</div>
        <div>New Delhi - 110001</div>
        <div>Ph: +91-9876543210</div>
        {bill.gstin && <div>GSTIN: {bill.gstin}</div>}
      </div>

      <div className="receipt-divider" />

      {/* Meta Data */}
      <div className="receipt-info">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bill No: {bill.voucherNumber || 'N/A'}</span>
            <span>{bill.voucherDate}</span>
        </div>
        <div>Customer: <span className="uppercase">{bill.customer.name || 'Walk-In'}</span></div>
      </div>

      <div className="receipt-divider" />

      {/* Items Table */}
      <table className="receipt-table">
        <thead>
          <tr>
            <th style={{ width: '45%' }}>ITEM</th>
            <th className="text-right" style={{ width: '15%' }}>QTY</th>
            <th className="text-right" style={{ width: '20%' }}>RATE</th>
            <th className="text-right" style={{ width: '20%' }}>AMT</th>
          </tr>
        </thead>
        <tbody>
          {bill.salesDetails?.map((item, index) => (
            <tr key={index}>
              <td style={{ paddingRight: 5 }}>
                {item.itemName}
                {/* Optional: Print barcode or ID below name */}
                {/* <div style={{fontSize: '9px', color: '#555'}}>{item.id}</div> */}
              </td>
              <td className="text-right">{item.qty}</td>
              <td className="text-right">{Number(item.rate).toFixed(2)}</td>
              <td className="text-right">{Number(item.amount).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-divider" />

      {/* Totals */}
      <div className="receipt-summary text-bold" style={{ fontSize: '14px' }}>
        <span>TOTAL:</span>
        <span>Rs. {bill.totalAmount?.toFixed(2)}</span>
      </div>
      
      {bill.tendered > 0 && (
        <>
            <div className="receipt-summary">
                <span>Cash Tendered:</span>
                <span>{Number(bill.tendered).toFixed(2)}</span>
            </div>
            <div className="receipt-summary">
                <span>Change Due:</span>
                <span>{(Number(bill.tendered) - bill.totalAmount).toFixed(2)}</span>
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
