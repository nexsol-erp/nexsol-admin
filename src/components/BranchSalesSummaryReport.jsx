import React, { useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const BranchSalesSummaryReport = () => {
  const [salesData, setSalesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("BranchSalesSummary.xlsx");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSalesData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const queryParams = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      const response = await fetch(
        `/api/${tenancyId}/reports/sales-report/branch-summary?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSalesData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching branch sales summary report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const exportRows = salesData.map((row) => ({
      branch_code: row.branchCode || "",
      sum: Number(row.sum ?? 0),
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Branch Sales Summary");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);
    setOpen(false);
  };

  // Last row from the API is the grand total (blank branchCode)
  const branchRows = salesData.filter((row) => row.branchCode);
  const totalRow = salesData.find((row) => !row.branchCode);

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Branch Sales Summary Report
      </Typography>
      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center" }}>
        <TextField
          type="date"
          label="Start Date"
          InputLabelProps={{ shrink: true }}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <TextField
          type="date"
          label="End Date"
          InputLabelProps={{ shrink: true }}
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={fetchSalesData}
          disabled={!startDate || !endDate || loading}
        >
          {loading ? "Loading..." : "Fetch Report"}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleClickOpen}
          disabled={salesData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>Enter file name for the Excel file:</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            fullWidth
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleExport}>Export</Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ mt: 2, maxWidth: 400 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ color: "#fff", fontWeight: "bold" }}>
                branch_code
              </TableCell>
              <TableCell align="right" sx={{ color: "#fff", fontWeight: "bold" }}>
                sum
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branchRows.map((row) => (
              <TableRow key={row.branchCode}>
                <TableCell>{row.branchCode}</TableCell>
                <TableCell align="right">
                  {Number(row.sum ?? 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {totalRow && (
              <TableRow sx={{ "& td": { fontWeight: "bold", borderTop: "2px solid #1976d2" } }}>
                <TableCell></TableCell>
                <TableCell align="right">
                  {Number(totalRow.sum ?? 0).toFixed(2)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BranchSalesSummaryReport;
