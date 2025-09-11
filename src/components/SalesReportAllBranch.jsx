import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const SalesReportAllBranch = () => {
  const [salesData, setSalesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("SalesReport.xlsx");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchSalesData = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const queryParams = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      const response = await fetch(
        `/api/${tenancyId}/reports/sales-report/pivot?${queryParams}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      setSalesData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching sales report:", error);
    }
  };

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(salesData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);
    setOpen(false);
  };

  // Exclude non-branch columns (now also excluding "category")
  const branchColumns =
    salesData.length > 0
      ? Object.keys(salesData[0])
          .filter(
            (key) => key !== "itemName" && key !== "category" && key !== "standardPrice"
          )
          .sort((a, b) => a.localeCompare(b))
      : [];

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
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
        <Button variant="contained" color="primary" onClick={fetchSalesData}>
          Fetch Sales Report
        </Button>
        <Button variant="contained" color="secondary" onClick={handleClickOpen}>
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

      <TableContainer component={Paper} sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell>Category</TableCell>
              <TableCell align="right">Standard Price</TableCell>
              {branchColumns.map((branch) => (
                <TableCell key={branch} align="right">
                  {branch}
                </TableCell>
              ))}
              <TableCell align="right">Total Sales</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {salesData.map((row, index) => {
              const total = branchColumns.reduce(
                (sum, branch) => sum + (parseFloat(row[branch]) || 0),
                0
              );
              return (
                <TableRow key={index}>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{row.category ?? "-"}</TableCell>
                  <TableCell align="right">
                    {Number(row.standardPrice ?? 0).toFixed(2)}
                  </TableCell>
                  {branchColumns.map((branch) => (
                    <TableCell key={branch} align="right">
                      {Number(row[branch] ?? 0).toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell align="right">{Number(total).toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SalesReportAllBranch;
