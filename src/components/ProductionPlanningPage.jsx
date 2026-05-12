import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  IconButton,
  Alert,
  CircularProgress,
  Stack,
  Divider,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as GenerateIcon,
  Summarize as SummarizeIcon,
  Download as DownloadIcon,
  TableChart as ExcelIcon,
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const emptyProductionRow = () => ({
  key: Date.now() + Math.random(),
  itemName: "",
  barCode: "",
  qty: "",
  taxRate: "",
  standardPrice: "",
  amount: "",
  batch: "",
  unit: "",
  expiry: "",
  itemId: "",
});

const ProductionPlanningPage = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const branchCode = localStorage.getItem("branchCode") || "";

  const [allItems, setAllItems] = useState([]);
  const [productionRows, setProductionRows] = useState([emptyProductionRow()]);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [rawMaterialDetails, setRawMaterialDetails] = useState([]);
  const [rawMaterialSummary, setRawMaterialSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState({ text: "", severity: "info" });
  const [savedVoucherNumber, setSavedVoucherNumber] = useState("");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/items`, { headers });
        if (res.ok) {
          const data = await res.json();
          setAllItems(Array.isArray(data) ? data : data.data || []);
        }
      } catch (e) {
        console.error("Error fetching items", e);
      }
    };
    fetchItems();
  }, [tenancyId]);

  const handleRowChange = (rowKey, field, value) => {
    setProductionRows(prev => prev.map(row => {
      if (row.key !== rowKey) return row;
      const updated = { ...row, [field]: value };
      if (field === "qty" || field === "standardPrice") {
        const q = parseFloat(updated.qty) || 0;
        const p = parseFloat(updated.standardPrice) || 0;
        updated.amount = (q * p).toFixed(2);
      }
      return updated;
    }));
  };

  const handleItemSelect = (rowKey, item) => {
    if (!item) return;
    setProductionRows(prev => prev.map(row => {
      if (row.key !== rowKey) return row;
      return {
        ...row,
        itemName: item.itemName || "",
        barCode: item.barcode || "",
        taxRate: item.taxRate ?? "",
        standardPrice: item.standardPrice ?? "",
        unit: item.unitName || "",
        itemId: item.itemId || item.id || "",
      };
    }));
  };

  const addRow = () => setProductionRows(prev => [...prev, emptyProductionRow()]);
  const deleteRow = (key) => setProductionRows(prev => prev.filter(r => r.key !== key));

  const generateRawMaterials = useCallback(async () => {
    const validRows = productionRows.filter(r => r.itemName.trim() && parseFloat(r.qty) > 0);
    if (validRows.length === 0) {
      setMessage({ text: "Add production items with quantity first", severity: "warning" });
      return;
    }

    setGenerating(true);
    setRawMaterialDetails([]);
    setRawMaterialSummary([]);

    try {
      const payload = validRows.map(r => ({ itemName: r.itemName, qty: parseFloat(r.qty) }));
      const res = await fetch(`/api/${tenancyId}/production-generate-raw-materials`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setRawMaterialDetails(data);
        buildSummary(data);
      } else {
        setMessage({ text: "Failed to generate raw materials", severity: "error" });
      }
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setGenerating(false);
    }
  }, [productionRows, tenancyId, token]);

  const buildSummary = (details) => {
    const map = {};
    details.forEach(row => {
      const name = row.itemName;
      if (!map[name]) map[name] = { itemName: name, itemId: row.itemId || "", barcode: row.barcode || "", standardPrice: row.standardPrice || 0, qty: 0 };
      map[name].qty += parseFloat(row.qty) || 0;
    });
    setRawMaterialSummary(Object.values(map));
  };

  const handleSummarise = () => buildSummary(rawMaterialDetails);

  const exportSummaryToCSV = () => {
    if (rawMaterialSummary.length === 0) return;
    const header = "Item Name,Qty\n";
    const rows = rawMaterialSummary.map(r => `${r.itemName},${r.qty.toFixed(4)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raw_material_summary_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    const itemRows = productionRows
      .filter(r => r.itemName.trim())
      .map(r => ({
        "Item Name": r.itemName,
        "Barcode": r.barCode,
        "Qty": parseFloat(r.qty) || 0,
        "Tax Rate": parseFloat(r.taxRate) || 0,
        "Std Price": parseFloat(r.standardPrice) || 0,
        "Amount": parseFloat(r.amount) || 0,
        "Batch": r.batch,
        "Unit": r.unit,
        "Expiry": r.expiry,
      }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemRows), "Production Items");

    if (rawMaterialSummary.length > 0) {
      const rmRows = rawMaterialSummary.map(r => ({
        "Item Name": r.itemName,
        "Total Qty": r.qty.toFixed(4),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rmRows), "Raw Material Summary");
    }

    if (rawMaterialDetails.length > 0) {
      const detailRows = rawMaterialDetails.map(r => ({
        "Item Name": r.itemName,
        "Qty": typeof r.qty === "number" ? r.qty.toFixed(4) : r.qty,
        "Unit": r.unit,
        "Std Price": r.standardPrice,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Raw Material Details");
    }

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `production_planning_${voucherDate}.xlsx`);
  };

  const handleSave = async () => {
    const validRows = productionRows.filter(r => r.itemName.trim());
    if (validRows.length === 0) {
      setMessage({ text: "Add at least one production item", severity: "warning" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", severity: "info" });

    const payload = {
      voucherDate: `${voucherDate}T00:00:00`,
      voucherNumber: "PLAN-" + Date.now(),
      branchCode,
      items: validRows.map(r => ({
        itemName: r.itemName,
        itemId: r.itemId,
        barCode: r.barCode,
        qty: parseFloat(r.qty) || 0,
        taxRate: parseFloat(r.taxRate) || 0,
        unit: r.unit,
        standardPrice: parseFloat(r.standardPrice) || 0,
        amount: parseFloat(r.amount) || 0,
        batch: r.batch,
        expiry: r.expiry,
      })),
      rawMaterials: rawMaterialSummary.map(r => ({
        itemName: r.itemName,
        itemId: r.itemId || "",
        qty: r.qty,
        standardPrice: r.standardPrice || 0,
        amount: 0,
        barCode: r.barcode || "",
        batch: "",
        expiry: "",
        taxRate: 0,
      })),
    };

    try {
      const res = await fetch(`/api/${tenancyId}/production-planning`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        const vn = data.voucherNumber || "";
        setSavedVoucherNumber(vn);
        setMessage({ text: `Planning saved! Planning ID: ${vn}`, severity: "success" });
        setProductionRows([emptyProductionRow()]);
        setRawMaterialDetails([]);
        setRawMaterialSummary([]);
      } else {
        setMessage({ text: "Failed to save production planning", severity: "error" });
      }
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const totalQty = productionRows.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const totalAmount = productionRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Production Planning
      </Typography>

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "info" })}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            label="Planning Date"
            type="date"
            size="small"
            value={voucherDate}
            onChange={(e) => setVoucherDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 180 }}
          />
        </Stack>
      </Paper>

      {/* Production Items Table */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold">Production Items</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow} variant="outlined">
            Add Row
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "primary.dark" }}>
                {["Item Name", "Barcode", "Qty", "Tax Rate", "Std Price", "Amount", "Batch", "Unit", "Expiry", ""].map(h => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: "bold", py: 1 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {productionRows.map(row => (
                <TableRow key={row.key} hover>
                  <TableCell sx={{ minWidth: 200, p: 0.5 }}>
                    <Autocomplete
                      options={allItems}
                      getOptionLabel={(o) => o.itemName || ""}
                      value={allItems.find(i => i.itemName === row.itemName) || null}
                      onChange={(_, val) => handleItemSelect(row.key, val)}
                      renderInput={(params) => <TextField {...params} size="small" placeholder="Item" />}
                      freeSolo
                      onInputChange={(_, val) => handleRowChange(row.key, "itemName", val)}
                    />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" value={row.barCode} onChange={e => handleRowChange(row.key, "barCode", e.target.value)} sx={{ width: 100 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" type="number" value={row.qty} onChange={e => handleRowChange(row.key, "qty", e.target.value)} sx={{ width: 80 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" type="number" value={row.taxRate} onChange={e => handleRowChange(row.key, "taxRate", e.target.value)} sx={{ width: 70 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" type="number" value={row.standardPrice} onChange={e => handleRowChange(row.key, "standardPrice", e.target.value)} sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" value={row.amount} InputProps={{ readOnly: true }} sx={{ width: 90 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" value={row.batch} onChange={e => handleRowChange(row.key, "batch", e.target.value)} sx={{ width: 80 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" value={row.unit} onChange={e => handleRowChange(row.key, "unit", e.target.value)} sx={{ width: 70 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" type="date" value={row.expiry} onChange={e => handleRowChange(row.key, "expiry", e.target.value)} sx={{ width: 130 }} InputLabelProps={{ shrink: true }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <IconButton size="small" color="error" onClick={() => deleteRow(row.key)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ p: 1.5, display: "flex", justifyContent: "flex-end", gap: 3 }}>
          <Typography variant="body2">Total Qty: <b>{totalQty.toFixed(2)}</b></Typography>
          <Typography variant="body2">Total Amount: <b>{totalAmount.toFixed(2)}</b></Typography>
        </Box>
      </Paper>

      {/* Action Buttons */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="info"
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <GenerateIcon />}
          onClick={generateRawMaterials}
          disabled={generating}
        >
          Generate Raw Material List
        </Button>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<SummarizeIcon />}
          onClick={handleSummarise}
          disabled={rawMaterialDetails.length === 0}
        >
          Summarise
        </Button>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={exportSummaryToCSV}
          disabled={rawMaterialSummary.length === 0}
        >
          Export Summary
        </Button>
        <Button
          variant="outlined"
          color="success"
          startIcon={<ExcelIcon />}
          onClick={exportToExcel}
          disabled={productionRows.every(r => !r.itemName.trim())}
        >
          Export Excel
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={loading}
        >
          Save
        </Button>
      </Stack>

      {/* Raw Material Details */}
      {rawMaterialDetails.length > 0 && (
        <Paper sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 1.5 }}>
            Raw Material Details
          </Typography>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "secondary.dark" }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Item Name</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Qty</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Unit</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Std Price</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rawMaterialDetails.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell>{typeof row.qty === "number" ? row.qty.toFixed(4) : row.qty}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.standardPrice}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Raw Material Summary */}
      {rawMaterialSummary.length > 0 && (
        <Paper>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ p: 1.5 }}>
            Summary
          </Typography>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "success.dark" }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Item Name</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Total Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rawMaterialSummary.map((row, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{row.itemName}</TableCell>
                    <TableCell>{row.qty.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
};

export default ProductionPlanningPage;
