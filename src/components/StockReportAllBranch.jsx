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

const StockReportAllBranch = () => {
  const [stockData, setStockData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("StockReport.xlsx");

  const fetchStockData = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/reports/stock-by-branch`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setStockData(data);
    } catch (error) {
      console.error("Error fetching stock report:", error);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(stockData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Report");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);
    setOpen(false);
  };

  // Determine branch columns dynamically (excluding itemName and Total)
  const branchColumns = stockData.length > 0
    ? Object.keys(stockData[0])
        .filter((key) => key !== "itemName")
        .sort((a, b) => a.localeCompare(b))
    : [];

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Button variant="contained" color="primary" onClick={fetchStockData}>
          Fetch Stock Report
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
              {branchColumns.map((branch) => (
                <TableCell key={branch} align="right">{branch}</TableCell>
              ))}
              <TableCell align="right">Total Stock</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stockData.map((row, index) => {
              const total = branchColumns.reduce((sum, branch) => sum + (parseFloat(row[branch]) || 0), 0);
              return (
                <TableRow key={index}>
                  <TableCell>{row.itemName}</TableCell>
                  {branchColumns.map((branch) => (
                    <TableCell key={branch} align="right">
                      {row[branch] !== undefined ? row[branch].toFixed(2) : "0.00"}
                    </TableCell>
                  ))}
                  <TableCell align="right">{total.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StockReportAllBranch;
