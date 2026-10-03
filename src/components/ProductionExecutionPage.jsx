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
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as GenerateIcon,
  Summarize as SummarizeIcon,
  TableChart as ExcelIcon,
} from "@mui/icons-material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const emptyRow = () => ({
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

const ProductionExecutionPage = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const branchCode = localStorage.getItem("branchCode") || "";

  const [allItems, setAllItems] = useState([]);
  const [planningVouchers, setPlanningVouchers] = useState([]);
  const [selectedPlanningVoucher, setSelectedPlanningVoucher] = useState(null);
  const [productionRows, setProductionRows] = useState([emptyRow()]);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split("T")[0]);
  const [rawMaterialDetails, setRawMaterialDetails] = useState([]);
  const [rawMaterialSummary, setRawMaterialSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState({ text: "", severity: "info" });
  // "plan" = execute a saved planning voucher; "direct" = enter what was produced, raw
  // materials are worked out from the BOM on the server and a plan is created behind the scenes.
  const [mode, setMode] = useState("plan");
  const [problems, setProblems] = useState([]);

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
    const fetchPlanningVouchers = async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/production-planning/vouchers`, { headers });
        if (res.ok) setPlanningVouchers(await res.json());
      } catch (e) {
        console.error("Error fetching planning vouchers", e);
      }
    };
    fetchItems();
    fetchPlanningVouchers();
  }, [tenancyId]);

  const handlePlanningVoucherSelect = useCallback(async (voucher) => {
    setSelectedPlanningVoucher(voucher);
    setRawMaterialDetails([]);
    setRawMaterialSummary([]);
    if (!voucher) { setProductionRows([emptyRow()]); return; }
    try {
      const res = await fetch(`/api/${tenancyId}/production-planning/${encodeURIComponent(voucher)}/items`, { headers });
      if (res.ok) {
        const items = await res.json();
        if (items.length > 0) {
          setProductionRows(items.map(it => ({
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
          })));
        } else {
          setProductionRows([emptyRow()]);
        }
      }
    } catch (e) {
      console.error("Error loading planning items", e);
    }
  }, [tenancyId, token]);

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

  const addRow = () => setProductionRows(prev => [...prev, emptyRow()]);
  const deleteRow = (key) => setProductionRows(prev => prev.filter(r => r.key !== key));

  const buildSummary = (details) => {
    const map = {};
    details.forEach(row => {
      const name = row.itemName;
      if (!map[name]) map[name] = { itemName: name, itemId: row.itemId || "", barcode: row.barcode || "", standardPrice: row.standardPrice || 0, qty: 0 };
      map[name].qty += parseFloat(row.qty) || 0;
    });
    setRawMaterialSummary(Object.values(map));
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

  const handleSummarise = () => buildSummary(rawMaterialDetails);

  const handleModeChange = (_, val) => {
    if (!val || val === mode) return;
    setMode(val);
    setSelectedPlanningVoucher(null);
    setProductionRows([emptyRow()]);
    setRawMaterialDetails([]);
    setRawMaterialSummary([]);
    setProblems([]);
    setMessage({ text: "", severity: "info" });
  };

  const directPayload = (rows) => ({
    voucherDate: `${voucherDate}T00:00:00`,
    branchCode,
    items: rows.map(r => ({
      itemName: r.itemName,
      itemId: r.itemId,
      qty: parseFloat(r.qty) || 0,
      standardPrice: parseFloat(r.standardPrice) || 0,
      batch: r.batch,
      expiry: r.expiry,
    })),
  });

  const previewDirect = async () => {
    const validRows = productionRows.filter(r => r.itemName.trim());
    if (validRows.length === 0) {
      setMessage({ text: "Add the finished items produced, with quantity", severity: "warning" });
      return;
    }
    setGenerating(true);
    setProblems([]);
    try {
      const res = await fetch(`/api/${tenancyId}/production-execution/direct/preview`, {
        method: "POST",
        headers,
        body: JSON.stringify(directPayload(validRows)),
      });
      if (!res.ok) {
        setMessage({ text: "Failed to work out raw materials", severity: "error" });
        return;
      }
      const data = await res.json();
      const raws = (data.rawMaterials || []).map(r => ({ ...r, barcode: r.barCode }));
      setRawMaterialDetails([]);
      setRawMaterialSummary(raws);
      setProblems(data.problems || []);
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setGenerating(false);
    }
  };

  const saveDirect = async () => {
    const validRows = productionRows.filter(r => r.itemName.trim());
    if (validRows.length === 0) {
      setMessage({ text: "Add the finished items produced, with quantity", severity: "warning" });
      return;
    }
    setLoading(true);
    setProblems([]);
    setMessage({ text: "", severity: "info" });
    try {
      const res = await fetch(`/api/${tenancyId}/production-execution/direct`, {
        method: "POST",
        headers,
        body: JSON.stringify(directPayload(validRows)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblems(data.problems || []);
        setMessage({ text: data.problems?.length ? "Nothing was saved. Fix the items below and try again." : (data.message || "Failed to save direct production"), severity: "error" });
        return;
      }
      if (data.warning) {
        setMessage({ text: `Production saved (Voucher: ${data.voucherNumber}), but: ${data.warning}`, severity: "warning" });
      } else {
        setMessage({ text: `Production saved! Voucher: ${data.voucherNumber} (plan ${data.planningVoucherNumber}). Finished goods added and ${data.rawMaterials?.length || 0} raw material(s) consumed from stock.`, severity: "success" });
      }
      setProductionRows([emptyRow()]);
      setRawMaterialDetails([]);
      setRawMaterialSummary([]);
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setLoading(false);
    }
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
    saveAs(new Blob([buf], { type: "application/octet-stream" }), `production_execution_${voucherDate}.xlsx`);
  };

  const handleSave = async () => {
    if (mode === "direct") return saveDirect();
    const validRows = productionRows.filter(r => r.itemName.trim());
    if (validRows.length === 0) {
      setMessage({ text: "Add at least one production item", severity: "warning" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", severity: "info" });

    // Always (re)compute raw materials from the current rows right before saving,
    // instead of relying on a separately-clicked "Generate" step — avoids saving
    // a stale/empty raw-material list if Generate was skipped or hadn't resolved yet.
    let rawMaterialsForSave = rawMaterialSummary;
    const genRows = validRows.filter(r => parseFloat(r.qty) > 0);
    if (genRows.length > 0) {
      try {
        const genRes = await fetch(`/api/${tenancyId}/production-generate-raw-materials`, {
          method: "POST",
          headers,
          body: JSON.stringify(genRows.map(r => ({ itemName: r.itemName, qty: parseFloat(r.qty) }))),
        });
        if (genRes.ok) {
          const details = await genRes.json();
          const map = {};
          details.forEach(row => {
            const name = row.itemName;
            if (!map[name]) map[name] = { itemName: name, itemId: row.itemId || "", barcode: row.barcode || "", standardPrice: row.standardPrice || 0, qty: 0 };
            map[name].qty += parseFloat(row.qty) || 0;
          });
          rawMaterialsForSave = Object.values(map);
          setRawMaterialDetails(details);
          setRawMaterialSummary(rawMaterialsForSave);
        }
      } catch (e) {
        console.error("Error generating raw materials before save", e);
      }
    }

    if (rawMaterialsForSave.length === 0) {
      const proceed = window.confirm(
        "No raw materials will be consumed for this production (no Bill of Materials found for the entered item(s), or items were typed as free text instead of selected from the list). Finished goods stock will still increase. Continue anyway?"
      );
      if (!proceed) {
        setLoading(false);
        return;
      }
    }

    const payload = {
      voucherDate: `${voucherDate}T00:00:00`,
      voucherNumber: "EXEC-" + Date.now(),
      branchCode,
      planningVoucherNumber: selectedPlanningVoucher || "",
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
      rawMaterials: rawMaterialsForSave.map(r => ({
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
      const res = await fetch(`/api/${tenancyId}/production-execution`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.warning) {
          setMessage({ text: `Execution saved (Voucher: ${data.voucherNumber}), but stock was NOT updated for: ${data.skippedItems?.join(", ") || ""}. Re-select these items from the item list (not free text) in Production Def / Execution and re-run.`, severity: "warning" });
        } else {
          setMessage({ text: `Execution saved! Voucher: ${data.voucherNumber}. Stock updated in inventory.`, severity: "success" });
        }
        setProductionRows([emptyRow()]);
        setRawMaterialDetails([]);
        setRawMaterialSummary([]);
        setSelectedPlanningVoucher(null);
      } else {
        setMessage({ text: "Failed to save production execution", severity: "error" });
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
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight="bold">
          Production Execution
        </Typography>
        <Box
          sx={{
            px: 2.5,
            py: 0.75,
            borderRadius: 2,
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography variant="caption" sx={{ opacity: 0.85, letterSpacing: 0.5, textTransform: "uppercase" }}>
            Branch
          </Typography>
          <Typography variant="h6" fontWeight="bold" sx={{ letterSpacing: 1 }}>
            {branchCode || "—"}
          </Typography>
        </Box>
      </Stack>

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "info" })}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
          <ToggleButtonGroup value={mode} exclusive size="small" color="primary" onChange={handleModeChange}>
            <ToggleButton value="plan">From plan</ToggleButton>
            <ToggleButton value="direct">Direct production</ToggleButton>
          </ToggleButtonGroup>
          {mode === "plan" && (
            <Autocomplete
              options={planningVouchers}
              getOptionLabel={(o) => o}
              value={selectedPlanningVoucher}
              onChange={(_, val) => handlePlanningVoucherSelect(val)}
              renderInput={(params) => <TextField {...params} label="Planning Voucher No." size="small" />}
              sx={{ width: { xs: "100%", sm: 260 } }}
            />
          )}
          <TextField
            label="Execution Date"
            type="date"
            size="small"
            value={voucherDate}
            onChange={(e) => setVoucherDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: { xs: "100%", sm: 180 } }}
          />
        </Stack>
        {mode === "direct" && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Enter the finished goods you produced. Raw materials are worked out from each item's Bill of Materials,
            consumed from stock, and a planning voucher is created automatically. Items without a Bill of Materials can't be saved here.
          </Typography>
        )}
      </Paper>

      {problems.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <b>These items can't be produced directly:</b>
          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </Alert>
      )}

      {/* Production Items Table */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold">Production Items (Finished Goods)</Typography>
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
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
        <Button
          variant="contained"
          color="info"
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <GenerateIcon />}
          onClick={mode === "direct" ? previewDirect : generateRawMaterials}
          disabled={generating}
        >
          {mode === "direct" ? "Calculate Raw Materials" : "Generate Raw Material List"}
        </Button>
        {mode === "plan" && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<SummarizeIcon />}
            onClick={handleSummarise}
            disabled={rawMaterialDetails.length === 0}
          >
            Summarise Raw Material List
          </Button>
        )}
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
          Save & Update Stock
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
                <TableRow sx={{ backgroundColor: "warning.dark" }}>
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
            Summary (will be consumed from stock)
          </Typography>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "error.dark" }}>
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

export default ProductionExecutionPage;
