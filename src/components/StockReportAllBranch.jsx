import React, { useEffect, useState, useMemo } from "react";
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
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setStockData(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching stock report:", error);
      setStockData([]);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // Decide branch columns:
  // 1) Prefer stable order from backend: row.branchCodes (array)
  // 2) Fallback: infer from keys (exclude known fields)
  const branchColumns = useMemo(() => {
    if (!stockData?.length) return [];
    const first = stockData[0] || {};
    if (Array.isArray(first.branchCodes) && first.branchCodes.length > 0) {
      return first.branchCodes;
    }
    // Fallback: collect all keys except known non-branch fields
    const exclude = new Set(["itemId", "itemName", "category", "branchCodes"]);
    const keys = new Set();
    stockData.forEach((row) => {
      Object.keys(row || {}).forEach((k) => {
        if (!exclude.has(k)) keys.add(k);
      });
    });
    return Array.from(keys).sort((a, b) => a.localeCompare(b));
  }, [stockData]);

  const handleExport = () => {
    // Build a clean, ordered dataset for Excel
    const excelRows = stockData.map((row) => {
      const out = {
        "Item Name": row.itemName ?? "",
        Category: row.category ?? "",
      };
      let total = 0;
      branchColumns.forEach((b) => {
        const v = Number(row?.[b] ?? 0);
        out[b] = v;
        total += v;
      });
      out["Total Stock"] = total;
      return out;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Report");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer], { type: "application/octet-stream" }), fileName);
    setOpen(false);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Box sx={{ display: "flex", gap: 2, justifyContent: "space-between", mb: 3 }}>
        <Button variant="contained" color="primary" onClick={fetchStockData}>
          Fetch Stock Report
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleClickOpen}
          disabled={!stockData.length}
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
          <Button onClick={handleExport} disabled={!stockData.length}>
            Export
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ mt: 2, maxHeight: "70vh" }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell>Category</TableCell>
              {branchColumns.map((branch) => (
                <TableCell key={branch} align="right">
                  {branch}
                </TableCell>
              ))}
              <TableCell align="right">Total Stock</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stockData.map((row, index) => {
              let total = 0;
              const cells = branchColumns.map((branch) => {
                const n = Number(row?.[branch] ?? 0);
                total += n;
                return (
                  <TableCell key={branch} align="right">
                    {n.toFixed(2)}
                  </TableCell>
                );
              });
              return (
                <TableRow key={index}>
                  <TableCell>{row.itemName ?? ""}</TableCell>
                  <TableCell>{row.category ?? ""}</TableCell>
                  {cells}
                  <TableCell align="right">{total.toFixed(2)}</TableCell>
                </TableRow>
              );
            })}
            {!stockData.length && (
              <TableRow>
                <TableCell colSpan={2 + branchColumns.length + 1} align="center">
                  No data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StockReportAllBranch;
