import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, TextField, Typography,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, CircularProgress, Autocomplete,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function BranchInventoryReport() {
  const [branchList, setBranchList]     = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [txnDate, setTxnDate]           = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows]                 = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token     = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranchList(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0].branchCode);
      })
      .catch(() => setBranchList([]));
  }, []);

  const fetchReport = async () => {
    if (!selectedBranch || !txnDate) return;
    setLoading(true);
    setError(null);
    const tenancyId = localStorage.getItem("tenancyId");
    const token     = localStorage.getItem("jwtToken");
    try {
      const res = await fetch(
        `/api/${tenancyId}/inventory/branch-inventory?branchCode=${encodeURIComponent(selectedBranch)}&txnDate=${txnDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || "Failed to fetch report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const totalQtyIn  = rows.reduce((s, r) => s + (Number(r.qtyIn)  || 0), 0);
  const totalQtyOut = rows.reduce((s, r) => s + (Number(r.qtyOut) || 0), 0);
  const totalNet    = totalQtyIn - totalQtyOut;

  const handleExport = () => {
    const sheetRows = rows.map((r, i) => ({
      "#":             i + 1,
      "Voucher Date":  r.voucherDate ? String(r.voucherDate).slice(0, 19).replace("T", " ") : "",
      "Voucher No":    r.voucherNumber || "",
      "Type":          r.voucherType   || "",
      "Item Name":     r.itemName      || "",
      "Barcode":       r.barcode       || "",
      "Batch":         r.batchCode     || "",
      "Description":   r.description   || "",
      "Qty In":        Number(r.qtyIn)  || 0,
      "Qty Out":       Number(r.qtyOut) || 0,
      "Net":           (Number(r.qtyIn) || 0) - (Number(r.qtyOut) || 0),
    }));
    sheetRows.push({
      "#": "", "Voucher Date": "", "Voucher No": "", "Type": "",
      "Item Name": "TOTAL", "Barcode": "", "Batch": "", "Description": "",
      "Qty In": totalQtyIn, "Qty Out": totalQtyOut, "Net": totalNet,
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branch Inventory");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `BranchInventory_${selectedBranch}_${txnDate}.xlsx`);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight={700}>
        Branch Inventory Report
      </Typography>

      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end", mb: 2 }}>
        <Autocomplete
          options={branchList}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.branchCode}) ${opt.branchName || opt.branchCode}`
          }
          value={branchList.find((b) => b.branchCode === selectedBranch) || null}
          onChange={(_, v) => setSelectedBranch(v?.branchCode || "")}
          renderInput={(params) => (
            <TextField {...params} label="Branch" variant="outlined" size="small" sx={{ width: 260 }} />
          )}
        />
        <TextField
          label="Date"
          type="date"
          size="small"
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="contained"
          onClick={fetchReport}
          disabled={loading || !selectedBranch || !txnDate}
        >
          {loading ? <CircularProgress size={20} /> : "Generate"}
        </Button>
        <Button
          variant="outlined"
          onClick={handleExport}
          disabled={rows.length === 0}
        >
          Export Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      {rows.length > 0 && (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "#1565c0" }}>
              <TableRow>
                {["#", "Voucher Date", "Voucher No", "Type", "Item Name", "Barcode", "Batch", "Description", "Qty In", "Qty Out", "Net"].map((h) => (
                  <TableCell key={h} sx={{ color: "#fff", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => {
                const qtyIn  = Number(r.qtyIn)  || 0;
                const qtyOut = Number(r.qtyOut) || 0;
                const net    = qtyIn - qtyOut;
                const dateStr = r.voucherDate
                  ? String(r.voucherDate).slice(0, 19).replace("T", " ")
                  : "";
                return (
                  <TableRow key={i} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{dateStr}</TableCell>
                    <TableCell>{r.voucherNumber || ""}</TableCell>
                    <TableCell>{r.voucherType   || ""}</TableCell>
                    <TableCell>{r.itemName      || ""}</TableCell>
                    <TableCell>{r.barcode       || ""}</TableCell>
                    <TableCell>{r.batchCode     || ""}</TableCell>
                    <TableCell>{r.description   || ""}</TableCell>
                    <TableCell align="right">{qtyIn  > 0 ? qtyIn.toFixed(2)  : ""}</TableCell>
                    <TableCell align="right">{qtyOut > 0 ? qtyOut.toFixed(2) : ""}</TableCell>
                    <TableCell align="right" sx={{ color: net < 0 ? "error.main" : "inherit" }}>
                      {net.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow sx={{ bgcolor: "#e3f2fd" }}>
                <TableCell colSpan={8} align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{totalQtyIn.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{totalQtyOut.toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: totalNet < 0 ? "error.main" : "inherit" }}>
                  {totalNet.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && rows.length === 0 && !error && (
        <Typography color="text.secondary" sx={{ mt: 3, textAlign: "center" }}>
          Select a branch and date, then click Generate.
        </Typography>
      )}
    </Box>
  );
}
