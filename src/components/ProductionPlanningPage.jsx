import React, { useState, useEffect, useCallback } from "react";
import UnitSelect from "./UnitSelect";
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
  Chip,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as GenerateIcon,
  Summarize as SummarizeIcon,
  Download as DownloadIcon,
  TableChart as ExcelIcon,
  Search as SearchIcon,
  NoteAdd as NoteAddIcon,
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

  // Load an existing planning (e.g. one created by Excel import) by date range, then
  // generate/save its raw materials, instead of only ever creating a brand new planning.
  const todayStr = new Date().toISOString().split("T")[0];
  const [fetchFromDate, setFetchFromDate] = useState(todayStr);
  const [fetchToDate, setFetchToDate] = useState(todayStr);
  const [fetchingPlannings, setFetchingPlannings] = useState(false);
  const [fetchedPlannings, setFetchedPlannings] = useState([]); // [{voucherNumber, voucherDate, items:[...]}]
  const [loadedVoucherNumber, setLoadedVoucherNumber] = useState("");

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

  const fetchPlanningsByDate = useCallback(async () => {
    if (!fetchFromDate || !fetchToDate) return;
    setFetchingPlannings(true);
    setFetchedPlannings([]);
    try {
      const params = new URLSearchParams({
        branchCode,
        fromDate: fetchFromDate,
        toDate: fetchToDate,
      });
      const res = await fetch(`/api/${tenancyId}/production-planning?${params.toString()}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const byVoucher = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        if (!r.voucherNumber) return;
        if (!byVoucher[r.voucherNumber]) {
          byVoucher[r.voucherNumber] = { voucherNumber: r.voucherNumber, voucherDate: r.voucherDate, items: [] };
        }
        byVoucher[r.voucherNumber].items.push(r);
      });
      const list = Object.values(byVoucher).sort((a, b) => (a.voucherDate < b.voucherDate ? 1 : -1));
      setFetchedPlannings(list);
      if (list.length === 0) {
        setMessage({ text: "No plannings found for this date range / branch.", severity: "info" });
      }
    } catch (e) {
      setMessage({ text: "Failed to fetch plannings: " + e.message, severity: "error" });
    } finally {
      setFetchingPlannings(false);
    }
  }, [fetchFromDate, fetchToDate, branchCode, tenancyId, token]);

  const loadPlanning = (plan) => {
    setLoadedVoucherNumber(plan.voucherNumber);
    setVoucherDate((plan.voucherDate || "").split("T")[0] || todayStr);
    setProductionRows(
      plan.items.map((it) => ({
        key: it.id,
        itemName: it.itemName || "",
        barCode: it.barCode || "",
        qty: it.qty ?? "",
        taxRate: it.taxRate ?? "",
        standardPrice: it.standardPrice ?? "",
        amount: it.amount ?? "",
        batch: it.batch || "",
        unit: it.unit || "",
        expiry: it.expiry || "",
        itemId: it.itemId || "",
      }))
    );
    setRawMaterialDetails([]);
    setRawMaterialSummary([]);
    setMessage({ text: "", severity: "info" });
  };

  const startNewPlanning = () => {
    setLoadedVoucherNumber("");
    setSavedVoucherNumber("");
    setProductionRows([emptyProductionRow()]);
    setRawMaterialDetails([]);
    setRawMaterialSummary([]);
    setVoucherDate(todayStr);
    setMessage({ text: "", severity: "info" });
  };

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

  const handleSaveRawMaterialsToExisting = async () => {
    if (rawMaterialSummary.length === 0) {
      setMessage({ text: "Generate the raw material list first", severity: "warning" });
      return;
    }
    setLoading(true);
    setMessage({ text: "", severity: "info" });
    try {
      const payload = rawMaterialSummary.map(r => ({
        itemName: r.itemName,
        itemId: r.itemId || "",
        qty: r.qty,
        standardPrice: r.standardPrice || 0,
        amount: 0,
        barCode: r.barcode || "",
        batch: "",
        expiry: "",
        taxRate: 0,
      }));
      const res = await fetch(
        `/api/${tenancyId}/production-planning/${encodeURIComponent(loadedVoucherNumber)}/raw-materials`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      if (res.ok) {
        setMessage({ text: `Raw materials saved for planning ${loadedVoucherNumber}.`, severity: "success" });
      } else {
        setMessage({ text: "Failed to save raw materials", severity: "error" });
      }
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (loadedVoucherNumber) {
      return handleSaveRawMaterialsToExisting();
    }

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

      {loadedVoucherNumber && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Editing raw materials for an existing planning. Row edits here only affect the raw
          material calculation below — they do not change the saved planning items. Click
          "Generate Raw Material List" then "Save Raw Materials" to attach the breakdown to
          planning <b>{loadedVoucherNumber}</b>.
        </Alert>
      )}

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
            disabled={!!loadedVoucherNumber}
          />
          {loadedVoucherNumber && (
            <>
              <Chip color="primary" label={`Editing planning: ${loadedVoucherNumber}`} />
              <Button size="small" startIcon={<NoteAddIcon />} onClick={startNewPlanning}>
                New Planning
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {/* Load Existing Planning */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1.5 }}>
          Load Existing Planning
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <TextField
            label="From Date"
            type="date"
            size="small"
            value={fetchFromDate}
            onChange={(e) => setFetchFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 180 }}
          />
          <TextField
            label="To Date"
            type="date"
            size="small"
            value={fetchToDate}
            onChange={(e) => setFetchToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 180 }}
          />
          <Button
            variant="outlined"
            startIcon={fetchingPlannings ? <CircularProgress size={16} /> : <SearchIcon />}
            onClick={fetchPlanningsByDate}
            disabled={fetchingPlannings}
          >
            Fetch Plannings
          </Button>
        </Stack>

        {fetchedPlannings.length > 0 && (
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "primary.dark" }}>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Voucher Number</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Date</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}>Items</TableCell>
                  <TableCell sx={{ color: "white", fontWeight: "bold" }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fetchedPlannings.map((plan) => (
                  <TableRow key={plan.voucherNumber} hover selected={plan.voucherNumber === loadedVoucherNumber}>
                    <TableCell>{plan.voucherNumber}</TableCell>
                    <TableCell>{(plan.voucherDate || "").split("T")[0]}</TableCell>
                    <TableCell>{plan.items.length}</TableCell>
                    <TableCell>
                      <Button size="small" variant="contained" onClick={() => loadPlanning(plan)}>
                        Load
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
                    <UnitSelect value={row.unit} onChange={v => handleRowChange(row.key, "unit", v)} sx={{ width: 100 }} />
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
          disabled={loading || (loadedVoucherNumber && rawMaterialSummary.length === 0)}
        >
          {loadedVoucherNumber ? "Save Raw Materials" : "Save"}
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
