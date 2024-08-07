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
import axios from "axios";

const StockMovementReport = () => {
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [stockData, setStockData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("StockMovementReport.xlsx");

  const fetchStockData = async () => {
    try {
      const branchCode = localStorage.getItem("branchCode");
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await axios.get(
        `/api/${tenancyId}/${branchCode}/stock-data`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          params: {
            openingDate: fromDate,
            closingDate: toDate,
          },
        }
      );
      const data = response.data;

      // Process data to accumulate closing stock
      const processedData = data.map((item) => {
        let accumulatedClosingStock = item.openingStock;

        const transactions = item.transactions.map((transaction) => {
          accumulatedClosingStock +=
            transaction.inwardQty - transaction.outwardQty;
          return {
            ...transaction,
            closingQty: accumulatedClosingStock,
          };
        });

        return {
          ...item,
          closingStock: accumulatedClosingStock,
          transactions,
        };
      });

      setStockData(processedData);
    } catch (error) {
      console.error("Error fetching stock data:", error);
    }
  };

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
  };

  const handleToDateChange = (event) => {
    setToDate(event.target.value);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(stockData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Data");
    XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
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
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={handleToDateChange}
          InputLabelProps={{
            shrink: true,
          }}
          sx={{ flex: 1 }}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={fetchStockData}
        sx={{ mb: 3 }}
      >
        Fetch Stock Data
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
              <TableCell>Item Name</TableCell>
              <TableCell align="right">Opening Stock</TableCell>
              <TableCell align="right">Closing Stock</TableCell>
              <TableCell>Transactions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stockData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.itemName}</TableCell>
                <TableCell align="right">{row.openingStock}</TableCell>
                <TableCell align="right">{row.closingStock}</TableCell>
                <TableCell>
                  {row.transactions.length > 0 ? (
                    <Table size="small" sx={{ width: "100%" }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right">Inward Qty</TableCell>
                          <TableCell align="right">Outward Qty</TableCell>
                          <TableCell align="right">Closing Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {row.transactions.map((transaction, tIndex) => (
                          <TableRow key={tIndex}>
                            <TableCell>
                              {dayjs(transaction.transactionDate).format(
                                "DD-MM-YYYY"
                              )}
                            </TableCell>
                            <TableCell>{transaction.description}</TableCell>
                            <TableCell align="right">
                              {transaction.inwardQty}
                            </TableCell>
                            <TableCell align="right">
                              {transaction.outwardQty}
                            </TableCell>
                            <TableCell align="right">
                              {transaction.closingQty}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No Transactions
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default StockMovementReport;
