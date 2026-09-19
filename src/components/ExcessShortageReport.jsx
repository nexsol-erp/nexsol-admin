import React, { useState } from "react";
import {
  Box, Typography, Button, Paper, Table, TableHead, TableRow, TableCell,
  TableBody, TableContainer, TextField, Alert, CircularProgress, Chip,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const STATUS = {
  EXCESS:      { label: "Excess",      color: "success" },
  SHORTAGE:    { label: "Shortage",    color: "error" },
  TALLY:       { label: "Tally",       color: "default" },
  NOT_ENTERED: { label: "Not entered", color: "warning" },
};

/**
 * Excess / Shortage: per branch, the cash counted and entered at Day End beside the cash
 * receipts recorded in sales for the day, with the difference.
 * Difference = collected - expected: positive is an excess, negative a shortage.
 */
export default function ExcessShortageReport() {
  const tenancyId = localStorage.getItem("tenancyId");
  const headers = { Authorization: `Bearer ${localStorage.getItem("jwtToken")}` };

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fmt = (n) => Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const branchLabel = (r) => (r.branchName ? `${r.branchCode} - ${r.branchName}` : r.branchCode);
  const diffColor = (n) => (Number(n) > 0 ? "success.dark" : Number(n) < 0 ? "error.main" : "text.primary");
  const signedFmt = (n) => (Number(n) > 0 ? "+" : "") + fmt(n);

  const handleRun = async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/${tenancyId}/reports/excess-shortage?date=${date}`, { headers });
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

  const handleExport = () => {
    const rows = report.rows.map((r) => ({
      Branch: branchLabel(r),
      "Day End Collected": Number(r.dayEndCollected),
      "Expected Cash (Sales)": Number(r.expectedCash),
      Difference: Number(r.difference),
      Status: STATUS[r.status]?.label ?? r.status,
    }));
    rows.push({
      Branch: "Total",
      "Day End Collected": Number(report.totalDayEndCollected),
      "Expected Cash (Sales)": Number(report.totalExpectedCash),
      Difference: Number(report.totalDifference),
      Status: "",
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Excess Shortage");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), `excess-shortage-${date}.xlsx`);
  };

  const headCell = { color: "#fff", fontWeight: 700 };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Excess / Shortage Report</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Cash counted at Day End by each branch, beside the cash receipts recorded in sales for the
        day (net of cash returns). Difference = Collected − Expected: a positive figure is an
        excess, a negative one is a shortage.
      </Typography>

      <Box display="flex" gap={2} alignItems="center" mb={2}>
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                   InputLabelProps={{ shrink: true }} />
        <Button variant="contained" onClick={handleRun} disabled={loading || !date}>
          {loading ? <CircularProgress size={22} /> : "Run Report"}
        </Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}
                disabled={!report || report.rows.length === 0}>
          Export to Excel
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && report.rows.length === 0 && (
        <Alert severity="info">No sales or Day End entries found for {report.date}.</Alert>
      )}

      {report && report.rows.length > 0 && (
        <TableContainer component={Paper} sx={{ maxWidth: 900 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1976d2" }}>
              <TableRow>
                <TableCell sx={headCell}>Branch</TableCell>
                <TableCell align="right" sx={headCell}>Day End Collected</TableCell>
                <TableCell align="right" sx={headCell}>Expected Cash (Sales)</TableCell>
                <TableCell align="right" sx={headCell}>Difference</TableCell>
                <TableCell align="center" sx={headCell}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.rows.map((r) => (
                <TableRow key={r.branchCode}>
                  <TableCell>{branchLabel(r)}</TableCell>
                  <TableCell align="right">{r.status === "NOT_ENTERED" ? "—" : fmt(r.dayEndCollected)}</TableCell>
                  <TableCell align="right">{fmt(r.expectedCash)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, color: diffColor(r.difference) }}>
                    {signedFmt(r.difference)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={STATUS[r.status]?.label ?? r.status}
                          color={STATUS[r.status]?.color ?? "default"} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ "& td": { fontWeight: 700, borderTop: "2px solid #1976d2" } }}>
                <TableCell>Total</TableCell>
                <TableCell align="right">{fmt(report.totalDayEndCollected)}</TableCell>
                <TableCell align="right">{fmt(report.totalExpectedCash)}</TableCell>
                <TableCell align="right" sx={{ color: diffColor(report.totalDifference) }}>
                  {signedFmt(report.totalDifference)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
