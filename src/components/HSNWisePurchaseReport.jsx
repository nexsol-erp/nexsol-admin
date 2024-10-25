import React, { useState, useEffect } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button,
} from '@mui/material';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const HSNWisePurchaseReport = () => {
  const currentDate = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(currentDate);
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');

    try {
      const response = await fetch(`/api/${tenancyId}/reports/purchase/hsn?fromDate=${fromDate}&toDate=${toDate}`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch report data');

      const data = await response.json();
      setReportData(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []); 

  const handleExportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HSN Purchase Report');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(blob, `HSN_Purchase_Report_${fromDate}_to_${toDate}.xlsx`);
  };

  // Calculate the total amount
  const totalAmount = reportData.reduce((total, row) => total + parseFloat(row.amount), 0).toFixed(2);

  return (
    <Box sx={{ padding: 3 }}>
      <TextField
        label="From Date"
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ marginRight: 2 }}
      />
      <TextField
        label="To Date"
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ marginRight: 2 }}
      />
      <Button variant="contained" color="primary" onClick={fetchReportData} sx={{ mr: 2 }}>
        Fetch Report
      </Button>
      <Button variant="contained" color="secondary" onClick={handleExportToExcel}>
        Export to Excel
      </Button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {reportData.length > 0 && (
        <TableContainer component={Paper} sx={{ marginTop: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>HSN Code</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Purchase Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.hsnCode}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell>
                  <TableCell align="right">{row.purchaseRate}</TableCell>
                  <TableCell align="right">{parseFloat(row.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {/* Summary Row for Total Amount */}
              <TableRow>
                <TableCell colSpan={3} sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{totalAmount}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default HSNWisePurchaseReport;
