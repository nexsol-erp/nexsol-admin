// StockTransferOutInvoice.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useReactToPrint } from "react-to-print";

import {
  Box,
  Paper,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Divider,
} from "@mui/material";
import { useParams } from "react-router-dom";

const StockTransferOutInvoice = () => {
  const { transId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoading(true);
        setError("");
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");

        const res = await fetch(
          `/api/${tenancyId}/stock-transfers/out/${transId}/invoice`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(`Failed to load invoice: ${res.status}`);
        }

        const data = await res.json();
        setInvoice(data);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    };

    if (transId) {
      fetchInvoice();
    }
  }, [transId]);

  const handlePrint = () => {
    window.print();
  };

  const totals = useMemo(() => {
    if (!invoice || !invoice.details) {
      return {
        totalQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        grandTotal: 0,
      };
    }

    return invoice.details.reduce(
      (acc, line) => {
        const qty = Number(line.qty || 0);
        const taxable = Number(
          line.taxableValue ?? line.taxableAmount ?? line.amount ?? 0
        );
        const cgstAmt = Number(line.cgstAmount || 0);
        const sgstAmt = Number(line.sgstAmount || 0);
        const igstAmt = Number(line.igstAmount || 0);
        const total = Number(
          line.lineTotal || taxable + cgstAmt + sgstAmt + igstAmt
        );

        acc.totalQty += qty;
        acc.totalTaxable += taxable;
        acc.totalCgst += cgstAmt;
        acc.totalSgst += sgstAmt;
        acc.totalIgst += igstAmt;
        acc.grandTotal += total;
        return acc;
      },
      {
        totalQty: 0,
        totalTaxable: 0,
        totalCgst: 0,
        totalSgst: 0,
        totalIgst: 0,
        grandTotal: 0,
      }
    );
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

  if (loading) {
    return <Box sx={{ p: 2 }}>Loading invoice...</Box>;
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  if (!invoice) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>No invoice data found.</Typography>
      </Box>
    );
  }

  const { header, details } = invoice;

  return (
    <Box sx={{ p: 2, bgcolor: "#f5f5f5" }}>
      {/* Print button - hidden in print */}
      <Box className="no-print" sx={{ mb: 2, textAlign: "right" }}>
        <Button variant="contained" onClick={handlePrint}>
          Print Invoice
        </Button>
      </Box>

      <Paper
        sx={{
          width: "210mm",
          minHeight: "297mm",
          mx: "auto",
          p: 2,
          boxSizing: "border-box",
        }}
      >
        {/* Company + Title */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
          <Box>
            <Typography variant="h6">{header.companyName}</Typography>
            <Typography variant="body2">{header.companyAddress}</Typography>
            {header.companyGstin && (
              <Typography variant="body2">
                GSTIN: {header.companyGstin}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="h6" sx={{ textTransform: "uppercase" }}>
              GST Stock Transfer Invoice
            </Typography>
            <Typography variant="body2">
              Transfer No: {header.voucherNumber}
            </Typography>
            <Typography variant="body2">
              Date: {formatDate(header.voucherDate)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* From / To */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1, border: "1px solid #000", p: 1 }}>
            <Typography variant="subtitle2">Dispatch From (Branch)</Typography>
            <Typography variant="body2" fontWeight="bold">
              {header.fromBranchName}
            </Typography>
            <Typography variant="body2">{header.fromBranchAddress}</Typography>
            {header.fromGstin && (
              <Typography variant="body2">
                GSTIN: {header.fromGstin}
              </Typography>
            )}
            {header.fromState && (
              <Typography variant="body2">
                State: {header.fromState} ({header.fromStateCode})
              </Typography>
            )}
            <Typography variant="body2">
              Branch Code: {header.fromBranchCode}
            </Typography>
          </Box>

          <Box sx={{ flex: 1, border: "1px solid #000", p: 1 }}>
            <Typography variant="subtitle2">Ship To (Branch)</Typography>
            <Typography variant="body2" fontWeight="bold">
              {header.toBranchName}
            </Typography>
            <Typography variant="body2">{header.toBranchAddress}</Typography>
            {header.toGstin && (
              <Typography variant="body2">GSTIN: {header.toGstin}</Typography>
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

        {/* Transport details */}
        <Box sx={{ display: "flex", gap: 2, mb: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2">
              <strong>Place of Supply:</strong> {header.placeOfSupply}
            </Typography>
            <Typography variant="body2">
              <strong>Transport Mode:</strong> {header.transportMode}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2">
              <strong>Vehicle No:</strong> {header.vehicleNo}
            </Typography>
          </Box>
        </Box>

        {/* Items table */}
        <Table size="small" sx={{ mt: 1 }} aria-label="gst-invoice-items">
          <TableHead>
            <TableRow>
              <TableCell>Sl. No.</TableCell>
              <TableCell>Description of Goods</TableCell>
              <TableCell>HSN/SAC</TableCell>
              <TableCell align="right">Qty</TableCell>
              <TableCell>UOM</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Taxable Value</TableCell>
              <TableCell align="right">CGST %</TableCell>
              <TableCell align="right">CGST Amt</TableCell>
              <TableCell align="right">SGST %</TableCell>
              <TableCell align="right">SGST Amt</TableCell>
              <TableCell align="right">IGST %</TableCell>
              <TableCell align="right">IGST Amt</TableCell>
              <TableCell align="right">Line Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {details && details.length > 0 ? (
              details.map((line, index) => (
                <TableRow key={line.id || index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{line.itemName}</TableCell>
                  <TableCell>{line.hsnCode || line.hsn}</TableCell>
                  <TableCell align="right">{line.qty}</TableCell>
                  <TableCell>{line.uom}</TableCell>
                  <TableCell align="right">
                    {Number(line.rate || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    {Number(
                      line.taxableValue ??
                        line.taxableAmount ??
                        line.amount ??
                        0
                    ).toFixed(2)}
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
                    {Number(line.igstRate || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    {Number(line.igstAmount || 0).toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    {Number(
                      line.lineTotal ||
                        (line.taxableValue ??
                          line.taxableAmount ??
                          line.amount ??
                          0) +
                          (line.cgstAmount || 0) +
                          (line.sgstAmount || 0) +
                          (line.igstAmount || 0)
                    ).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={14}>No items</TableCell>
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
                <strong>{totals.totalTaxable.toFixed(2)}</strong>
              </TableCell>
              <TableCell />
              <TableCell align="right">
                <strong>{totals.totalCgst.toFixed(2)}</strong>
              </TableCell>
              <TableCell />
              <TableCell align="right">
                <strong>{totals.totalSgst.toFixed(2)}</strong>
              </TableCell>
              <TableCell />
              <TableCell align="right">
                <strong>{totals.totalIgst.toFixed(2)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{totals.grandTotal.toFixed(2)}</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        {/* Summary row */}
        <Box sx={{ display: "flex", mt: 2 }}>
          <Box sx={{ flex: 2, pr: 2 }}>
            <Typography variant="body2">
              <strong>Amount in words:</strong>{" "}
              Rs. {totals.grandTotal.toFixed(2)} only
              {/* (you can plug a number-to-words here later) */}
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
                Goods are transferred from one branch to another for stock
                purposes only. No sale is involved in this transaction.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ flex: 1, textAlign: "right" }}>
            <Typography variant="body2" sx={{ mt: 6 }}>
              For {header.companyName}
            </Typography>
            <Box sx={{ height: "40px" }} />
            <Typography variant="body2">Authorised Signatory</Typography>
          </Box>
        </Box>

        <Box
          sx={{
            mt: 2,
            textAlign: "center",
            fontSize: "0.7rem",
          }}
        >
          This is a system generated document. No signature is required.
        </Box>
      </Paper>
    </Box>
  );
};

export default StockTransferOutInvoice;
