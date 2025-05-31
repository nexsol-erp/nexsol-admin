import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const StatementOfAccount = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [entries, setEntries] = useState([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const token = localStorage.getItem("jwtToken");
  const tenancyId = localStorage.getItem("tenancyId");

  useEffect(() => {
    fetch(`/api/${tenancyId}/account-heads`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setAccounts(data.map((a) => a.accountName)));
  }, []);

  const loadStatement = () => {
    if (!selectedAccount || !fromDate || !toDate) return;
    fetch(
      `/api/${tenancyId}/statement-of-account?accountName=${encodeURIComponent(
        selectedAccount
      )}&fromDate=${fromDate}&toDate=${toDate}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((res) => res.json())
      .then((data) => {
        setOpeningBalance(data.openingBalance || 0);
        setEntries(data.entries || []);
      });
  };

  const exportToExcel = () => {
    if (!entries.length) return;

    const rows = [];

    // Opening balance row
    rows.push({
      Date: "",
      "Voucher No": "",
      Description: "Opening Balance",
      Debit: "",
      Credit: "",
      Balance: openingBalance.toFixed(2),
    });

    let balance = openingBalance;

    entries.forEach((entry) => {
      balance += (entry.debitAmount || 0) - (entry.creditAmount || 0);
      rows.push({
        Date: new Date(entry.voucherDate).toLocaleDateString(),
        "Voucher No": entry.voucherNumber,
        Description: entry.description,
        Debit: entry.debitAmount || "",
        Credit: entry.creditAmount || "",
        Balance: balance.toFixed(2),
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Statement");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const fileName = `${selectedAccount}_Statement.xlsx`;
    const data = new Blob([excelBuffer], {
      type: "application/octet-stream",
    });
    saveAs(data, fileName);
  };

  const computedEntries = entries.reduce((acc, entry) => {
    const prevBalance = acc.length ? acc[acc.length - 1].balance : openingBalance;
    const balance =
      prevBalance + (entry.debitAmount || 0) - (entry.creditAmount || 0);
    acc.push({ ...entry, balance });
    return acc;
  }, []);

  return (
    <Box p={3}>
      <Typography variant="h5">Statement of Account</Typography>
      <Box display="flex" gap={2} my={2} flexWrap="wrap">
        <TextField
          select
          label="Select Account"
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
          fullWidth
        >
          {accounts.map((name, idx) => (
            <MenuItem key={idx} value={name}>
              {name}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <Button variant="contained" onClick={loadStatement}>
          Load
        </Button>
        <Button variant="outlined" onClick={exportToExcel}>
          Export Excel
        </Button>
      </Box>

      {entries.length > 0 && (
        <>
          <Typography sx={{ mt: 2, mb: 1 }}>
            Opening Balance: ₹ {openingBalance.toFixed(2)}
          </Typography>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher No</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {computedEntries.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{new Date(row.voucherDate).toLocaleDateString()}</TableCell>
                  <TableCell>{row.voucherNumber}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell align="right">{row.debitAmount || "-"}</TableCell>
                  <TableCell align="right">{row.creditAmount || "-"}</TableCell>
                  <TableCell align="right">{row.balance.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
};

export default StatementOfAccount;
