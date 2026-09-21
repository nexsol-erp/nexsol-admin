import React, { useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Alert, CircularProgress, Divider,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";

/**
 * Daily shop-wise cash summary and cash-to-bank reconciliation - backlog #51/#52.
 * Purely a rendering of whatever line items the tenant has configured under
 * Cash Summary Line Items; no category names are hardcoded here.
 */
export default function DailyCashSummaryReport() {
  const tenancyId = localStorage.getItem("tenancyId");
  const headers = { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` };

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  const fmt = (n) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = (line) => (line.sign === "SUBTRACT" ? "-" : "+");
  const signed = (line) => sign(line) + fmt(line.amount);
  const remarkCell = (text) => <TableCell sx={{ color: "text.secondary" }}>{text || ""}</TableCell>;

  // Entry heading: the expense head (a line can map several) and payee; FINAL lines span
  // branches, so they also lead with the branch.
  const entryLabel = (line, e, showBranch) =>
    [showBranch ? e.branchCode : null, e.expenseTypeName || line.label, e.payee]
      .filter(Boolean).join(" - ");

  // One line item. Expense lines list every entry on its own row with its remark; several
  // entries under one line get a group total, a single entry stands alone.
  const renderLine = (line, showBranch = false) => {
    const entries = line.entries || [];
    if (entries.length === 0) {
      return (
        <TableRow key={line.lineItemId}>
          <TableCell>{line.label}</TableCell>
          <TableCell align="right">{signed(line)}</TableCell>
          {remarkCell("")}
        </TableRow>
      );
    }
    if (entries.length === 1) {
      const e = entries[0];
      return (
        <TableRow key={line.lineItemId}>
          <TableCell>{entryLabel(line, e, showBranch)}</TableCell>
          <TableCell align="right">{sign(line) + fmt(e.amount)}</TableCell>
          {remarkCell(e.remarks)}
        </TableRow>
      );
    }
    return [
      <TableRow key={line.lineItemId}>
        <TableCell colSpan={3} sx={{ fontWeight: 600 }}>{line.label}</TableCell>
      </TableRow>,
      ...entries.map((e, i) => (
        <TableRow key={`${line.lineItemId}-${i}`}>
          <TableCell sx={{ pl: 4 }}>{entryLabel(line, e, showBranch)}</TableCell>
          <TableCell align="right">{sign(line) + fmt(e.amount)}</TableCell>
          {remarkCell(e.remarks)}
        </TableRow>
      )),
      <TableRow key={`${line.lineItemId}-total`} sx={{ "& td": { fontWeight: 600, borderTop: "1px solid #bdbdbd" } }}>
        <TableCell sx={{ pl: 4 }}>Total {line.label}</TableCell>
        <TableCell align="right">{signed(line)}</TableCell>
        <TableCell />
      </TableRow>,
    ];
  };

  const handleRun = async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${tenancyId}/cash-summary/report?date=${date}`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not generate the report.");
      }
      setReport(await res.json());
    } catch (e) {
      setError(e.message);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!date) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/${tenancyId}/cash-summary/report/excel?date=${date}`, { headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Report generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cash-summary-${date}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Daily Cash Summary</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Shop-wise expected cash-to-bank and the final reconciliation, built from the categories
        configured under Cash Summary Line Items.
      </Typography>

      <Box display="flex" gap={2} alignItems="center" mb={2}>
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={handleRun} disabled={loading}>
          {loading ? <CircularProgress size={22} /> : "Run Report"}
        </Button>
        <Button variant="outlined" startIcon={downloading ? undefined : <DownloadIcon />}
                onClick={handleDownload} disabled={downloading || !report}>
          {downloading ? <CircularProgress size={22} /> : "Download Excel"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <>
          {report.shops.map((shop) => (
            <Paper key={shop.branchCode} sx={{ mb: 3 }}>
              <Table size="small">
                <TableHead sx={{ bgcolor: "#1976d2" }}>
                  <TableRow>
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>{shop.branchCode}</TableCell>
                    <TableCell />
                    <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shop.lines.map((line) => renderLine(line))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Expected Cash to Bank</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(shop.expectedCashToBank)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          ))}

          <Divider sx={{ my: 2 }} />

          <Paper sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: "#1976d2" }}>
                <TableRow>
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Final Reconciliation</TableCell>
                  <TableCell />
                  <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Sum of Shop Totals</TableCell>
                  <TableCell align="right">{fmt(report.sumOfShopTotals)}</TableCell>
                  <TableCell />
                </TableRow>
                {report.finalLines.map((line) => renderLine(line, true))}
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Final Expected Cash to Bank</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(report.finalExpectedCashToBank)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
