// src/components/StockTransferOutInvoice.jsx
import React, { useState, useMemo, useRef } from "react";
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  TextField,
} from "@mui/material";
import { useParams } from "react-router-dom";

const StockTransferOutInvoice = () => {
  const { voucherNumber } = useParams(); // stock transfer voucher from URL
  console.log("[Invoice] Rendered with voucherNumber:", voucherNumber);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [discountPercent, setDiscountPercent] = useState(""); // NEW
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Ref to the exact DOM node we want to print
  const invoiceRef = useRef(null);

  const handleGenerateInvoice = async () => {
    console.log("[Invoice] Generate clicked. invoiceNumber =", invoiceNumber);
    console.log("[Invoice] Discount percent =", discountPercent);

    if (!invoiceNumber) {
      setError("Please enter an invoice number");
      console.warn("[Invoice] No invoice number entered");
      return;
    }

    // Optional: basic validation for discount
    const parsedDiscount =
      discountPercent === "" ? 0 : Number(discountPercent);
    if (Number.isNaN(parsedDiscount) || parsedDiscount < 0) {
      setError("Please enter a valid discount percent (0 or above)");
      console.warn("[Invoice] Invalid discount percent");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      // NOTE: backend should be mapped as
      // @PostMapping("/{voucherNumber}/{discountPercent}/convert-and-invoice")
      const url = `/api/${tenancyId}/stock-transfers/out/${voucherNumber}/${parsedDiscount}/convert-and-invoice`;
      console.log("[Invoice] Calling backend:", url);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invoiceNumber }),
      });

      console.log("[Invoice] Backend response status:", res.status);

      if (!res.ok) {
        const text = await res.text();
        console.error("[Invoice] Backend error body:", text);
        throw new Error(`Failed to generate invoice: ${res.status}`);
      }

      const data = await res.json();
      console.log("[Invoice] Backend JSON data:", data);

      setInvoice(data);
    } catch (err) {
      console.error("[Invoice] Error in handleGenerateInvoice:", err);
      setError(err.message || "Failed to generate invoice");
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    if (!invoice || !invoice.details) {
      return {
        totalQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        grandTotal: 0,
      };
    }
    const result = invoice.details.reduce(
      (acc, line) => {
        const qty = Number(line.qty || 0);
        const taxable = Number(line.taxableValue || 0);
        const cgstAmt = Number(line.cgstAmount || 0);
        const sgstAmt = Number(line.sgstAmount || 0);
        const igstAmt = Number(line.igstAmount || 0); // kept only for correctness in lineTotal
        const total =
          Number(line.lineTotal) || taxable + cgstAmt + sgstAmt + igstAmt;

        acc.totalQty += qty;
        acc.totalTaxable += taxable;
        acc.totalCgst += cgstAmt;
        acc.totalSgst += sgstAmt;
        acc.grandTotal += total;
        return acc;
      },
      {
        totalQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        grandTotal: 0,
      }
    );
    console.log("[Invoice] Calculated totals:", result);
    return result;
  }, [invoice]);

  // TAX SUMMARY (group by HSN + CGST/SGST rates, NO IGST)
  const taxSummary = useMemo(() => {
    if (!invoice || !invoice.details || invoice.details.length === 0) return [];

    const map = new Map();

    invoice.details.forEach((line) => {
      const hsnCode = line.hsnCode || "";
      const cgstRate = Number(line.cgstRate || 0);
      const sgstRate = Number(line.sgstRate || 0);

      const key = `${hsnCode}|${cgstRate}|${sgstRate}`;

      const taxable = Number(line.taxableValue || 0);
      const cgstAmt = Number(line.cgstAmount || 0);
      const sgstAmt = Number(line.sgstAmount || 0);

      if (!map.has(key)) {
        map.set(key, {
          hsnCode,
          cgstRate,
          sgstRate,
          taxableValue: 0,
          cgstAmount: 0,
          sgstAmount: 0,
        });
      }

      const row = map.get(key);
      row.taxableValue += taxable;
      row.cgstAmount += cgstAmt;
      row.sgstAmount += sgstAmt;
    });

    const arr = Array.from(map.values());
    console.log("[Invoice] Tax summary rows:", arr);
    return arr;
  }, [invoice]);

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Print via hidden iframe to avoid popup blockers
  const handlePrint = () => {
    console.log("[Invoice] Print clicked");

    if (!invoiceRef.current) {
      console.error("[Invoice] invoiceRef.current is NULL. Nothing to print.");
      return;
    }

    console.log("[Invoice] invoiceRef.current:", invoiceRef.current);

    const printContents = invoiceRef.current.outerHTML;
    console.log(
      "[Invoice] Length of printContents HTML:",
      printContents ? printContents.length : 0
    );

    if (!printContents) {
      console.error("[Invoice] printContents is empty");
      return;
    }

    const title = invoiceNumber || `Invoice_${voucherNumber}`;

    // Create hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      console.error("[Invoice] Unable to access iframe document");
      document.body.removeChild(iframe);
      return;
    }

    console.log("[Invoice] Writing contents into iframe");

    doc.open();
    doc.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
                Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
              font-size: 12px;
              margin: 0;
              padding: 0;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #000;
              padding: 4px;
            }
            .no-border td, .no-border th {
              border: none !important;
            }
          </style>
        </head>
        <body>
          ${printContents}
        </body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      console.log("[Invoice] iframe onload fired, calling print()");
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (e) {
        console.error("[Invoice] Error in iframe print:", e);
      } finally {
        setTimeout(() => {
          document.body.removeChild(iframe);
          console.log("[Invoice] iframe removed after print");
        }, 100);
      }
    };
  };

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "background.default", // respects theme (dark/light)
        color: "text.primary",
        minHeight: "100vh",
      }}
    >
      {/* Controls (not printed) */}
      <Box
        className="no-print"
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <TextField
          label="Invoice Number"
          size="small"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <TextField
          label="Discount %"
          size="small"
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
          helperText="Leave blank for 0%"
        />
        <Button
          variant="contained"
          onClick={handleGenerateInvoice}
          disabled={loading}
        >
          {loading ? "Generating..." : "Generate Invoice"}
        </Button>

        {invoice && (
          <Button
            variant="outlined"
            color="secondary"
            onClick={handlePrint}
            disabled={loading}
          >
            Print / Save as PDF
          </Button>
        )}

        {error && (
          <Typography color="error" sx={{ ml: 2 }}>
            {error}
          </Typography>
        )}
      </Box>

      {/* Printable area */}
      {invoice && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          {/* Ref is on the actual invoice root */}
          <Paper
            ref={invoiceRef}
            sx={{
              width: "210mm",
              minHeight: "297mm",
              p: 2,
              boxSizing: "border-box",
              bgcolor: "background.paper",
              color: "text.primary",
            }}
            elevation={1}
          >
            {(() => {
              const { header, details } = invoice;
              console.log("[Invoice] Rendering invoice with header:", header);
              console.log("[Invoice] Rendering invoice with details:", details);

              return (
                <>
                  {/* Header */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="h6">
                        {header.companyName}
                      </Typography>
                      <Typography variant="body2">
                        {header.companyAddress}
                      </Typography>
                      {header.companyGstin && (
                        <Typography variant="body2">
                          GSTIN: {header.companyGstin}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: "right" }}>
                      <Typography
                        variant="h6"
                        sx={{
                          textTransform: "uppercase",
                          fontWeight: "bold",
                        }}
                      >
                        GST INVOICE
                      </Typography>
                      <Typography variant="body2">
                        Invoice No: {header.voucherNumber}
                      </Typography>
                      <Typography variant="body2">
                        Date: {formatDate(header.voucherDate)}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  {/* To Branch / Customer ONLY */}
                  <Box sx={{ display: "flex", mb: 1 }}>
                    <Box sx={{ flex: 1, border: "1px solid #000", p: 1 }}>
                      <Typography variant="subtitle2">
                        To (Customer / Branch)
                      </Typography>

                      <Typography variant="body2" fontWeight="bold">
                        {header.toBranchName}
                      </Typography>

                      <Typography variant="body2">
                        {header.toBranchAddress}
                      </Typography>

                      {header.toGstin && (
                        <Typography variant="body2">
                          GSTIN: {header.toGstin}
                        </Typography>
                      )}

                      {header.toState && (
                        <Typography variant="body2">
                          State: {header.toState} ({header.toStateCode})
                        </Typography>
                      )}

                      <Typography variant="body2">
                        Branch Code: {header.toBranchCode}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Items */}
                  <Table size="small" sx={{ mt: 1 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Sl. No.</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>HSN</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell>UOM</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Taxable</TableCell>
                        <TableCell align="right">CGST %</TableCell>
                        <TableCell align="right">CGST Amt</TableCell>
                        <TableCell align="right">SGST %</TableCell>
                        <TableCell align="right">SGST Amt</TableCell>
                        <TableCell align="right">Line Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {details && details.length > 0 ? (
                        details.map((line, index) => (
                          <TableRow key={line.id || index}>
                            <TableCell>{index + 1}</TableCell>
                            <TableCell>{line.itemName}</TableCell>
                            <TableCell>{line.hsnCode}</TableCell>
                            <TableCell align="right">
                              {line.qty}
                            </TableCell>
                            <TableCell>{line.uom}</TableCell>
                            <TableCell align="right">
                              {Number(line.rate || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.taxableValue || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.cgstRate || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.cgstAmount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.sgstRate || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.sgstAmount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              {Number(line.lineTotal || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={12}>No items</TableCell>
                        </TableRow>
                      )}

                      {/* Totals */}
                      <TableRow>
                        <TableCell colSpan={3}>
                          <strong>Totals</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{totals.totalQty}</strong>
                        </TableCell>
                        <TableCell />
                        <TableCell />
                        <TableCell align="right">
                          <strong>
                            {totals.totalTaxable.toFixed(2)}
                          </strong>
                        </TableCell>
                        <TableCell />
                        <TableCell align="right">
                          <strong>{totals.totalCgst.toFixed(2)}</strong>
                        </TableCell>
                        <TableCell />
                        <TableCell align="right">
                          <strong>{totals.totalSgst.toFixed(2)}</strong>
                        </TableCell>
                        <TableCell align="right">
                          <strong>{totals.grandTotal.toFixed(2)}</strong>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {/* TAX SUMMARY SECTION (bottom) */}
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ mb: 0.5, fontWeight: "bold" }}
                    >
                      Tax Summary
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>HSN</TableCell>
                          <TableCell align="right">
                            Taxable Value
                          </TableCell>
                          <TableCell align="right">CGST %</TableCell>
                          <TableCell align="right">CGST Amt</TableCell>
                          <TableCell align="right">SGST %</TableCell>
                          <TableCell align="right">SGST Amt</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {taxSummary.length > 0 ? (
                          taxSummary.map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{row.hsnCode}</TableCell>
                              <TableCell align="right">
                                {row.taxableValue.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                {row.cgstRate.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                {row.cgstAmount.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                {row.sgstRate.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                {row.sgstAmount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6}>
                              No tax data
                            </TableCell>
                          </TableRow>
                        )}

                        {/* Tax summary total row */}
                        {taxSummary.length > 0 && (
                          <TableRow>
                            <TableCell>
                              <strong>Totals</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>
                                {totals.totalTaxable.toFixed(2)}
                              </strong>
                            </TableCell>
                            <TableCell />
                            <TableCell align="right">
                              <strong>
                                {totals.totalCgst.toFixed(2)}
                              </strong>
                            </TableCell>
                            <TableCell />
                            <TableCell align="right">
                              <strong>
                                {totals.totalSgst.toFixed(2)}
                              </strong>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Box>

                  {/* Footer */}
                  <Box sx={{ display: "flex", mt: 2 }}>
                    <Box sx={{ flex: 2, pr: 2 }}>
                      <Typography variant="body2">
                        <strong>Amount in words:</strong> Rs.{" "}
                        {totals.grandTotal.toFixed(2)} only
                      </Typography>
                      <Box
                        sx={{
                          border: "1px solid #000",
                          mt: 1,
                          p: 1,
                          fontSize: "0.8rem",
                        }}
                      >
                        <Typography variant="body2" fontWeight="bold">
                          Declaration:
                        </Typography>
                        <Typography variant="body2">
                          Goods have been invoiced as per applicable GST
                          rules.
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ flex: 1, textAlign: "right" }}>
                      <Typography variant="body2" sx={{ mt: 6 }}>
                        For {header.companyName}
                      </Typography>
                      <Box sx={{ height: "40px" }} />
                      <Typography variant="body2">
                        Authorised Signatory
                      </Typography>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      mt: 2,
                      textAlign: "center",
                      fontSize: "0.7rem",
                    }}
                  >
                    This is a system generated document. No signature is
                    required.
                  </Box>
                </>
              );
            })()}
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default StockTransferOutInvoice;
