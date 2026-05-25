import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import dayjs from "dayjs";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ItemTransferReport = () => {
  const [itemInput, setItemInput] = useState("");
  const [itemOptions, setItemOptions] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemSearchLoading, setItemSearchLoading] = useState(false);

  const [fromDate, setFromDate] = useState(dayjs().subtract(30, "day").format("YYYY-MM-DD"));
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const searchItems = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setItemOptions([]);
      return;
    }
    setItemSearchLoading(true);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const res = await axios.get(`/api/${tenancyId}/items-search`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { query, page: 0, size: 20 },
      });
      const items = Array.isArray(res.data)
        ? res.data
        : res.data?.content || res.data?.data || [];
      setItemOptions(items);
    } catch (e) {
      console.error("Item search failed:", e);
      setItemOptions([]);
    } finally {
      setItemSearchLoading(false);
    }
  }, []);

  const fetchReport = async () => {
    if (!selectedItem) return;
    setLoading(true);
    setError(null);
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const res = await axios.get(`/api/${tenancyId}/stock-transfers/out/by-item`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { itemId: selectedItem.itemId, fromDate, toDate },
      });
      setReportData(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch transfer report.");
    } finally {
      setLoading(false);
    }
  };

  const totalQty = reportData.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const totalAmount = reportData.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const handleExport = () => {
    const rows = reportData.map((r) => ({
      "Voucher No": r.voucherNumber ?? "",
      "Voucher Date": r.voucherDate ? dayjs(r.voucherDate).format("YYYY-MM-DD") : "",
      "From Branch": r.branchCode ?? "",
      "To Branch": r.toBranchCode ?? "",
      "Item Name": r.itemName ?? "",
      "Qty": parseFloat(r.qty) || 0,
      "Rate": parseFloat(r.rate) || 0,
      "Amount": parseFloat(r.amount) || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Item Transfers");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([buf], { type: "application/octet-stream" }),
      `Item_Transfer_${selectedItem?.itemName ?? "report"}_${fromDate}_${toDate}.xlsx`
    );
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>
        Item Transfer Report
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Autocomplete
          options={itemOptions}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.itemId ?? opt.itemCode ?? ""}) ${opt.itemName ?? ""}`
          }
          filterOptions={(x) => x}
          isOptionEqualToValue={(opt, val) => opt.itemId === val?.itemId}
          value={selectedItem}
          inputValue={itemInput}
          loading={itemSearchLoading}
          onInputChange={(_, newInput) => {
            setItemInput(newInput);
            searchItems(newInput);
          }}
          onChange={(_, newValue) => setSelectedItem(newValue)}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Item"
              variant="outlined"
              sx={{ width: "40ch" }}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {itemSearchLoading ? <CircularProgress size={18} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <Button
          variant="contained"
          color="primary"
          onClick={fetchReport}
          disabled={loading || !selectedItem}
        >
          {loading ? <CircularProgress size={24} /> : "Generate Report"}
        </Button>

        <Button
          variant="contained"
          color="secondary"
          onClick={handleExport}
          disabled={reportData.length === 0}
        >
          Export to Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {reportData.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Voucher No</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>From Branch</TableCell>
                <TableCell>To Branch</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell align="right">Rate</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reportData.map((row, idx) => (
                <TableRow key={idx} hover>
                  <TableCell>{row.voucherNumber}</TableCell>
                  <TableCell>
                    {row.voucherDate ? dayjs(row.voucherDate).format("YYYY-MM-DD") : ""}
                  </TableCell>
                  <TableCell>{row.branchCode}</TableCell>
                  <TableCell>{row.toBranchCode}</TableCell>
                  <TableCell>{row.itemName}</TableCell>
                  <TableCell align="right">{parseFloat(row.qty || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{parseFloat(row.rate || 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{parseFloat(row.amount || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                  Total
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  {totalQty.toFixed(2)}
                </TableCell>
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  {totalAmount.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ItemTransferReport;
