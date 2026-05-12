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
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon, Save as SaveIcon } from "@mui/icons-material";

const emptyRow = () => ({
  key: Date.now() + Math.random(),
  itemName: "",
  barcode: "",
  qty: "",
  taxRate: "",
  standardPrice: "",
  amount: "",
  batch: "",
  unit: "",
  expiry: "",
  itemId: "",
});

const ProductionDefPage = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const branchCode = localStorage.getItem("branchCode") || "";

  const [productionItems, setProductionItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [selectedProductionItem, setSelectedProductionItem] = useState(null);
  const [productionQty, setProductionQty] = useState("");
  const [productionCost, setProductionCost] = useState("");
  const [rawMaterials, setRawMaterials] = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", severity: "info" });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  useEffect(() => {
    const fetchProductionItems = async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/production-items`, { headers });
        if (res.ok) setProductionItems(await res.json());
      } catch (e) {
        console.error("Error fetching production items", e);
      }
    };

    const fetchAllItems = async () => {
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

    fetchProductionItems();
    fetchAllItems();
  }, [tenancyId]);

  const handleProductionItemChange = useCallback(async (item) => {
    setSelectedProductionItem(item);
    if (!item) {
      setRawMaterials([emptyRow()]);
      setProductionQty("");
      setProductionCost("");
      return;
    }
    try {
      const encoded = encodeURIComponent(item.itemName);
      const [defRes, rmRes] = await Promise.all([
        fetch(`/api/${tenancyId}/production-def/${encoded}`, { headers }),
        fetch(`/api/${tenancyId}/production-def/${encoded}/raw-materials`, { headers }),
      ]);

      if (defRes.ok) {
        const def = await defRes.json();
        if (def && def.qty != null) setProductionQty(def.qty);
        if (def && def.rate != null) setProductionCost(def.rate);
      }

      if (rmRes.ok) {
        const data = await rmRes.json();
        setRawMaterials(data.length > 0
          ? data.map(rm => ({
              key: rm.id,
              itemName: rm.itemName || "",
              barcode: rm.barcode || "",
              qty: rm.qty ?? "",
              taxRate: rm.taxRate ?? "",
              standardPrice: rm.standardPrice ?? "",
              amount: rm.amount ?? "",
              batch: rm.batch || "",
              unit: rm.unit || "",
              expiry: rm.expiry || "",
              itemId: rm.itemId || "",
            }))
          : [emptyRow()]);
      }
    } catch (e) {
      console.error("Error fetching production definition", e);
      setRawMaterials([emptyRow()]);
    }
  }, [tenancyId, token]);

  const handleRowChange = (rowKey, field, value) => {
    setRawMaterials(prev => prev.map(row => {
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
    setRawMaterials(prev => prev.map(row => {
      if (row.key !== rowKey) return row;
      return {
        ...row,
        itemName: item.itemName || item.name || "",
        barcode: item.barcode || "",
        taxRate: item.taxRate ?? "",
        standardPrice: item.standardPrice ?? "",
        unit: item.unitName || item.unit || "",
        itemId: item.itemId || item.id || "",
      };
    }));
  };

  const addRow = () => setRawMaterials(prev => [...prev, emptyRow()]);

  const deleteRow = (rowKey) =>
    setRawMaterials(prev => prev.filter(row => row.key !== rowKey));

  const handleSave = async () => {
    if (!selectedProductionItem) {
      setMessage({ text: "Please select a production item", severity: "warning" });
      return;
    }
    if (!productionQty) {
      setMessage({ text: "Please enter production quantity", severity: "warning" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", severity: "info" });

    const payload = {
      itemName: selectedProductionItem.itemName,
      itemId: selectedProductionItem.itemId || selectedProductionItem.id,
      barcode: selectedProductionItem.barcode || "",
      taxRate: selectedProductionItem.taxRate || 0,
      unit: selectedProductionItem.unitName || "",
      itemCode: selectedProductionItem.itemCode || "",
      qty: parseFloat(productionQty) || 0,
      rate: parseFloat(productionCost) || 0,
      standardPrice: selectedProductionItem.standardPrice || 0,
      amount: 0,
      branchCode,
      rawMaterials: rawMaterials
        .filter(r => r.itemName.trim())
        .map(r => ({
          itemName: r.itemName,
          barcode: r.barcode,
          taxRate: parseFloat(r.taxRate) || 0,
          unit: r.unit,
          itemCode: r.itemCode || "",
          itemId: r.itemId || "",
          qty: parseFloat(r.qty) || 0,
          rate: 0,
          standardPrice: parseFloat(r.standardPrice) || 0,
          amount: parseFloat(r.amount) || 0,
        })),
    };

    try {
      const res = await fetch(`/api/${tenancyId}/production-def`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setMessage({ text: "Production definition saved successfully!", severity: "success" });
        setRawMaterials([emptyRow()]);
        setProductionQty("");
        setProductionCost("");
        setSelectedProductionItem(null);
      } else {
        setMessage({ text: "Failed to save production definition", severity: "error" });
      }
    } catch (e) {
      setMessage({ text: "Error: " + e.message, severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = rawMaterials.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold">
        Production Definition
      </Typography>

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "info" })}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Autocomplete
            options={productionItems}
            getOptionLabel={(o) => o.itemName || ""}
            value={selectedProductionItem}
            onChange={(_, val) => handleProductionItemChange(val)}
            renderInput={(params) => <TextField {...params} label="Production Item Name" size="small" />}
            sx={{ flex: 2 }}
            isOptionEqualToValue={(o, v) => o.itemId === v.itemId}
          />
          <TextField
            label="Production Qty"
            size="small"
            type="number"
            value={productionQty}
            onChange={(e) => setProductionQty(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Production Cost"
            size="small"
            type="number"
            value={productionCost}
            onChange={(e) => setProductionCost(e.target.value)}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Paper>

      <Paper>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.5 }}>
          <Typography variant="subtitle1" fontWeight="bold">Raw Materials</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={addRow} variant="outlined">
            Add Row
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: "primary.dark" }}>
                {["Item Name", "Barcode", "Qty", "Tax Rate", "Std Price", "Amount", "Unit", "Batch", "Expiry", ""].map(h => (
                  <TableCell key={h} sx={{ color: "white", fontWeight: "bold", py: 1 }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rawMaterials.map((row) => (
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
                    <TextField size="small" value={row.barcode} onChange={e => handleRowChange(row.key, "barcode", e.target.value)} sx={{ width: 100 }} />
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
                    <TextField size="small" value={row.unit} onChange={e => handleRowChange(row.key, "unit", e.target.value)} sx={{ width: 70 }} />
                  </TableCell>
                  <TableCell sx={{ p: 0.5 }}>
                    <TextField size="small" value={row.batch} onChange={e => handleRowChange(row.key, "batch", e.target.value)} sx={{ width: 80 }} />
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
        <Box sx={{ p: 1.5, display: "flex", justifyContent: "flex-end" }}>
          <Typography variant="body2" fontWeight="bold">
            Total Amount: {totalAmount.toFixed(2)}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={loading}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};

export default ProductionDefPage;
