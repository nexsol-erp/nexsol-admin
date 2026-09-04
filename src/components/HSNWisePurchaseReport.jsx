import React, { useState, useEffect } from 'react';
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, TextField, Button,
  FormControl, InputLabel, Select, MenuItem, Alert, Checkbox, FormControlLabel,
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

  /**
   * Which date the range filters on.
   *
   * VOUCHER is when the purchase was entered in the ERP. SUPPLIER_INVOICE is the date on the
   * supplier's own invoice, which is the basis a GST return is filed on. They are not
   * interchangeable: on this tenant 9,202 of 10,729 purchases carry different dates, and for
   * August 2026 the two bases differ by about 17 lakh.
   */
  const [dateBasis, setDateBasis] = useState('VOUCHER');
  const [excluded, setExcluded] = useState(0);

  /**
   * Whether unfinalised purchases count.
   *
   * A draft is one somebody started and has not finalised. They used to be included in this
   * report with nothing saying so, which for a return is the wrong way round: a figure that
   * quietly contains work in progress. Off by default, and the heading says which.
   */
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [loadedIncludeDrafts, setLoadedIncludeDrafts] = useState(false);

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);

    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');

    try {
      const response = await fetch(
        `/api/${tenancyId}/reports/purchase/hsn?fromDate=${fromDate}&toDate=${toDate}`
        + `&dateBasis=${dateBasis}&includeDrafts=${includeDrafts}`, {
          headers: {
            Authorization: `Bearer ${jwtToken}`,
            'Content-Type': 'application/json',
          },
        });
      if (!response.ok) throw new Error('Failed to fetch report data');

      const data = await response.json();
      // The endpoint returns { rows, dateBasis, excludedMissingSupplierDate }. The array
      // fallback keeps this working against an older server that still returns a bare list.
      setReportData(Array.isArray(data) ? data : (data.rows || []));
      setExcluded(Array.isArray(data) ? 0 : (data.excludedMissingSupplierDate || 0));
      setLoadedIncludeDrafts(
        Array.isArray(data) || data.includeDrafts === undefined ? includeDrafts : data.includeDrafts
      );
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
    const basisTag = dateBasis === 'SUPPLIER_INVOICE' ? 'SupplierInvoiceDate' : 'VoucherDate';
    const draftTag = loadedIncludeDrafts ? '_WithDrafts' : '';
    saveAs(blob, `HSN_Purchase_Report_${basisTag}${draftTag}_${fromDate}_to_${toDate}.xlsx`);
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
      <FormControl sx={{ marginRight: 2, minWidth: 220 }}>
        <InputLabel id="hsn-date-basis-label">Date Basis</InputLabel>
        <Select
          labelId="hsn-date-basis-label"
          label="Date Basis"
          value={dateBasis}
          onChange={(e) => setDateBasis(e.target.value)}
        >
          <MenuItem value="VOUCHER">Voucher Date</MenuItem>
          <MenuItem value="SUPPLIER_INVOICE">Supplier Invoice Date</MenuItem>
        </Select>
      </FormControl>
      <FormControlLabel
        sx={{ marginRight: 2 }}
        control={
          <Checkbox
            checked={includeDrafts}
            onChange={(e) => setIncludeDrafts(e.target.checked)}
          />
        }
        label="Include drafts"
      />
      <Button variant="contained" color="primary" onClick={fetchReportData} sx={{ mr: 2 }}>
        Fetch Report
      </Button>
      <Button variant="contained" color="secondary" onClick={handleExportToExcel}>
        Export to Excel
      </Button>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Drafts change the total, so the figure says whether it contains any. */}
      {reportData.length > 0 && (
        <Alert severity="info" sx={{ marginTop: 2 }}>
          {fromDate} to {toDate} by{' '}
          {dateBasis === 'SUPPLIER_INVOICE' ? 'supplier invoice date' : 'voucher date'},{' '}
          {loadedIncludeDrafts ? 'including drafts' : 'finalised purchases only'}.
        </Alert>
      )}

      {/* Said plainly rather than left as a quietly smaller total. A purchase with no
          supplier invoice date cannot be placed on that basis, and falling back to the
          voucher date would produce a figure that is neither basis. */}
      {excluded > 0 && dateBasis === 'SUPPLIER_INVOICE' && (
        <Alert severity="warning" sx={{ marginTop: 2 }}>
          {excluded} purchase{excluded === 1 ? '' : 's'} in this range {excluded === 1 ? 'has' : 'have'} no
          supplier invoice date and {excluded === 1 ? 'is' : 'are'} not included. Switch to Voucher Date to see
          {excluded === 1 ? ' it' : ' them'}.
        </Alert>
      )}

      {reportData.length > 0 && (
        <TableContainer component={Paper} sx={{ marginTop: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Branch Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>HSN Code</TableCell>
                <TableCell>Unit Name</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell align="right">Tax Rate (%)</TableCell>
                <TableCell align="right">Purchase Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.branchCode}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell>{row.hsnCode}</TableCell>
                  <TableCell>{row.unitName}</TableCell>
                  <TableCell align="right">{row.quantity}</TableCell>
                  <TableCell align="right">{row.taxRate}</TableCell>
                  <TableCell align="right">{row.purchaseRate}</TableCell>
                  <TableCell align="right">{parseFloat(row.amount).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              {/* Summary Row for Total Amount */}
              <TableRow>
                <TableCell colSpan={7} sx={{ fontWeight: 'bold' }}>Total</TableCell>
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
