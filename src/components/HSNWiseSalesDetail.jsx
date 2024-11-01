import React, { useState, useEffect } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const HSNSalesDetail = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [salesData, setSalesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("HSNSalesData.xlsx");

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchSalesData = async () => {
    if (branch && fromDate && toDate) {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
        const response = await fetch(
          `/api/${tenancyId}/sales/salesdatahsnwise?branch=${branch}&fromDate=${fromDate}&toDate=${toDate}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        const data = await response.json();
        setSalesData(data.data);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      }
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleBranchChange = (event) => setBranch(event.target.value);
  const handleFromDateChange = (event) => setFromDate(event.target.value);
  const handleToDateChange = (event) => setToDate(event.target.value);

  const handleClickOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(salesData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Data");
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
      fileName
    );
    setOpen(false);
  };

  const totalAmount = salesData.reduce((total, item) => total + parseFloat(item.amount), 0);

  return (
    <Box sx={{ padding: 3 }}>
      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select labelId="branch-label" value={branch} onChange={handleBranchChange}>
          {branches.map((branch) => (
            <MenuItem key={branch.id} value={branch.branchCode}>
              {branch.branchCode}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField type="date" label="From Date" value={fromDate} onChange={handleFromDateChange} InputLabelProps={{ shrink: true }} sx={{ flex: 1, mr: 2 }} />
        <TextField type="date" label="To Date" value={toDate} onChange={handleToDateChange} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
      </Box>

      <Button variant="contained" color="primary" onClick={fetchSalesData} sx={{ mb: 3 }}>
        Fetch Sales Data
      </Button>
      <Button variant="contained" color="secondary" onClick={handleClickOpen} sx={{ mb: 3, ml: 2 }}>
        Export to Excel
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>Please enter the file name for the Excel file.</DialogContentText>
          <TextField autoFocus margin="dense" label="File Name" type="text" fullWidth value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">Cancel</Button>
          <Button onClick={handleExport} color="primary">Export</Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Branch Code</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell>HSN Code</TableCell>
              <TableCell>Unit Name</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Tax Rate (%)</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {salesData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.branch_code}</TableCell>
                <TableCell>{row.item_name}</TableCell>
                <TableCell>{row.hsn_code}</TableCell>
                <TableCell>{row.unit_name}</TableCell>
                <TableCell align="right">{row.quantity}</TableCell>
                <TableCell align="right">{parseFloat(row.tax_rate).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(row.rate).toFixed(2)}</TableCell>
                <TableCell align="right">{parseFloat(row.amount).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={7} sx={{ fontWeight: "bold" }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: "bold" }}>{totalAmount.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default HSNSalesDetail;
