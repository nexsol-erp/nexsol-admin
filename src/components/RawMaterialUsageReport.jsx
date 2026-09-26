// RawMaterialUsageReport.jsx
// Which finished products use a raw material, and how much of it each one needs.
import React, { useEffect, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
});

const fmt = (v) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 });

const RawMaterialUsageReport = () => {
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selected, setSelected] = useState(null);
  const [produceQty, setProduceQty] = useState("");
  const [rows, setRows] = useState([]);
  const [shownFor, setShownFor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const res = await fetch(`/api/${tenancyId}/production-where-used/raw-materials`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setRawMaterials(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error loading raw materials:", e);
        setError("Could not load the raw material list.");
      }
    };
    load();
  }, []);

  const qtyEntered = produceQty !== "" && Number(produceQty) > 0;

  const fetchReport = async () => {
    if (!selected) {
      setError("Select a raw material.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const params = new URLSearchParams({ itemName: selected.itemName });
      if (selected.itemId) params.set("itemId", selected.itemId);
      if (qtyEntered) params.set("produceQty", produceQty);
      const res = await fetch(`/api/${tenancyId}/production-where-used?${params.toString()}`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
      setShownFor({ name: selected.itemName, produceQty: qtyEntered ? Number(produceQty) : null });
    } catch (e) {
      console.error("Error loading report:", e);
      setError("Could not load the report.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const withQty = shownFor && shownFor.produceQty !== null;
    const sheetRows = rows.map((r) => {
      const row = {
        "Finished Product": r.productName,
        Branch: r.branchCode || "",
        "Batch Qty": r.batchQty,
        "Product Unit": r.productUnit || "",
        "Raw Material": r.rawMaterialName,
        "Raw Material Qty per Batch": r.qtyPerBatch,
        "Raw Material Unit": r.rawMaterialUnit || "",
      };
      if (withQty) row[`Raw Material Qty for ${shownFor.produceQty}`] = r.qtyForProduceQty;
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Raw Material Usage");
    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const safeName = (shownFor ? shownFor.name : "RawMaterial").replace(/[^\w-]+/g, "_");
    saveAs(new Blob([wbout], { type: "application/octet-stream" }), `RawMaterialUsage_${safeName}.xlsx`);
  };

  const withQty = shownFor && shownFor.produceQty !== null;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Raw Material Usage Report
        </Typography>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center" mb={2}>
          <Autocomplete
            sx={{ minWidth: 320 }}
            options={rawMaterials}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            getOptionLabel={(o) => (o.unit ? `${o.itemName} (${o.unit})` : o.itemName || "")}
            isOptionEqualToValue={(a, b) => a.itemName === b.itemName}
            renderInput={(params) => <TextField {...params} label="Raw Material" size="small" />}
          />
          <TextField
            size="small"
            type="number"
            label="Finished Qty (optional)"
            helperText="Qty of each product to produce"
            value={produceQty}
            onChange={(e) => setProduceQty(e.target.value)}
            inputProps={{ min: 0, step: "any" }}
          />
          <Button variant="contained" onClick={fetchReport} disabled={loading}>
            {loading ? <CircularProgress size={22} /> : "Show"}
          </Button>
          <Button variant="outlined" onClick={exportToExcel} disabled={rows.length === 0}>
            Export to Excel
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {shownFor && (
          <Typography variant="body2" color="text.secondary" mb={1}>
            {rows.length} finished product{rows.length === 1 ? "" : "s"} use {shownFor.name}.
          </Typography>
        )}

        <TableContainer sx={{ maxHeight: 560 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Finished Product</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell align="right">Batch Qty</TableCell>
                <TableCell align="right">Raw Material Qty per Batch</TableCell>
                {withQty && (
                  <TableCell align="right">Raw Material Qty for {fmt(shownFor.produceQty)}</TableCell>
                )}
                <TableCell>Unit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={`${r.productName}-${i}`} hover>
                  <TableCell>{r.productName}</TableCell>
                  <TableCell>{r.branchCode}</TableCell>
                  <TableCell align="right">
                    {fmt(r.batchQty)} {r.productUnit || ""}
                  </TableCell>
                  <TableCell align="right">{fmt(r.qtyPerBatch)}</TableCell>
                  {withQty && <TableCell align="right">{fmt(r.qtyForProduceQty)}</TableCell>}
                  <TableCell>{r.rawMaterialUnit}</TableCell>
                </TableRow>
              ))}
              {shownFor && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={withQty ? 6 : 5} align="center">
                    No finished product uses this raw material.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default RawMaterialUsageReport;
