import React, { useState, useEffect } from "react";
import {
  Box,
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
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const BillSeriesReport = () => {
  const [fromDate, setFromDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [billSeriesData, setBillSeriesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("BillSeriesData.xlsx");

  const fetchBillSeriesData = async () => {
    if (fromDate) {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
        const response = await fetch(
          `/api/${tenancyId}/billseriesdata?fromDate=${fromDate}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        if (data && Array.isArray(data)) {
          setBillSeriesData(data); // Update state with the fetched data
        } else {
          setBillSeriesData([]); // Fallback to an empty array if data is missing
        }
      } catch (error) {
        console.error("Error fetching bill series data:", error);
        setBillSeriesData([]); // Set empty array on error
      }
    }
  };

  useEffect(() => {
    fetchBillSeriesData();
  }, [fromDate]);

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(billSeriesData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bill Series Data");
    XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  const totalBills = billSeriesData.reduce(
    (total, item) => total + (item.maxVoucher - item.minVoucher + 1),
    0
  );

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={handleFromDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1, mr: 2 }}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={fetchBillSeriesData}
        sx={{ mb: 3 }}
      >
        Fetch Bill Series Data
      </Button>

      <Button
        variant="contained"
        color="secondary"
        onClick={handleClickOpen}
        sx={{ mb: 3, ml: 2 }}
      >
        Export to Excel
      </Button>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please enter the file name for the Excel file.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            type="text"
            fullWidth
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
          <Button onClick={handleExport} color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>

      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Branch Code</TableCell>
              <TableCell>Month</TableCell>
              <TableCell>Voucher Type</TableCell>
              <TableCell>Min Voucher</TableCell>
              <TableCell>Max Voucher</TableCell>
              <TableCell>Total Bills</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {billSeriesData.length > 0 ? (
              billSeriesData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.branchCode}</TableCell>
                  <TableCell>{row.month}</TableCell>
                  <TableCell>{row.voucherType}</TableCell>
                  <TableCell>{row.minVoucher}</TableCell>
                  <TableCell>{row.maxVoucher}</TableCell>
                  <TableCell>{row.maxVoucher - row.minVoucher + 1}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No Data Available
                </TableCell>
              </TableRow>
            )}
            {billSeriesData.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                  Total Bills
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>{totalBills}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BillSeriesReport;
