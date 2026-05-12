import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Stack,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";
import { hasCache, loadAllItemsToCache, getItemsFromCache } from "./itemCache";
import axios from "axios";
import { useTranslation } from "react-i18next";

const PhysicalStockCorrection = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [rows, setRows] = useState([
    { id: Date.now(), selectedItem: null, batches: [], selectedBatch: "", systemQty: 0, actualQty: "", difference: 0 }
  ]);
  const [loading, setLoading] = useState(false);
  const [cacheStatus, setCacheStatus] = useState({ loaded: false, loading: false, loadedCount: 0, total: 0 });
  const [message, setMessage] = useState({ text: "", severity: "info" });

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`/api/${tenancyId}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };
    fetchInitialData();

    const initCache = async () => {
      const ok = await hasCache();
      if (ok) {
        const cached = await getItemsFromCache();
        setItems(cached || []);
        setCacheStatus((s) => ({ ...s, loaded: true }));
      } else {
        handleRefreshCache();
      }
    };
    initCache();
  }, [tenancyId, token, allowedBranches]);

  const handleRefreshCache = async () => {
    setCacheStatus((s) => ({ ...s, loading: true, loaded: false }));
    try {
      await loadAllItemsToCache({
        onProgress: ({ loaded, total }) => {
          setCacheStatus((s) => ({ ...s, loadedCount: loaded, total }));
        },
      });
      const cached = await getItemsFromCache();
      setItems(cached || []);
      setCacheStatus({ loaded: true, loading: false, loadedCount: 0, total: 0 });
    } catch (e) {
      setCacheStatus((s) => ({ ...s, loading: false }));
      console.error("Failed to load item cache", e);
    }
  };

  const handleItemChange = async (id, newItem) => {
    const itemId = newItem?.itemId || newItem?.item_id;
    setRows(prev => prev.map(row => 
      row.id === id ? { ...row, selectedItem: newItem, selectedBatch: "", systemQty: 0, actualQty: "", difference: 0, batches: [] } : row
    ));

    if (branch && itemId) {
      try {
        const res = await axios.get(`/api/${tenancyId}/inventory/item-batches`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { branchCode: branch, itemId },
        });
        setRows(prev => prev.map(row => 
          row.id === id ? { ...row, batches: res.data || [] } : row
        ));
      } catch (err) {
        console.error("Error fetching batches:", err);
      }
    }
  };

  const handleBatchChange = (id, batchNo) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const batchData = row.batches.find(b => b.batchNo === batchNo);
        const systemQty = batchData ? Number(batchData.currentStock || 0) : 0;
        const diff = row.actualQty !== "" ? Number(row.actualQty) - systemQty : 0;
        return { ...row, selectedBatch: batchNo, systemQty, difference: diff };
      }
      return row;
    }));
  };

  const handleActualQtyChange = (id, value) => {
    setRows(prev => prev.map(row => {
      if (row.id === id) {
        const diff = value !== "" ? Number(value) - row.systemQty : 0;
        return { ...row, actualQty: value, difference: diff };
      }
      return row;
    }));
  };

  const handleAddRow = () => {
    setRows([...rows, { id: Date.now(), selectedItem: null, batches: [], selectedBatch: "", systemQty: 0, actualQty: "", difference: 0 }]);
  };

  const handleRemoveRow = (id) => {
    if (rows.length > 1) setRows(rows.filter(row => row.id !== id));
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => branch && r.selectedItem && r.selectedBatch && r.actualQty !== "");
    if (validRows.length === 0) {
      setMessage({ text: t("Please fill at least one row completely"), severity: "warning" });
      return;
    }

    setLoading(true);
    try {
      const requests = validRows.map(row => {
        const payload = {
          branchCode: branch,
          itemId: row.selectedItem.itemId || row.selectedItem.item_id,
          batchNo: row.selectedBatch,
          systemQty: row.systemQty,
          physicalQty: Number(row.actualQty),
          differenceQty: row.difference,
        };
        return axios.post(`/api/${tenancyId}/inventory/stock-correction`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      });
      await Promise.all(requests);
      setMessage({ text: t("stockCorrectionSuccess"), severity: "success" });
      setRows([{ id: Date.now(), selectedItem: null, batches: [], selectedBatch: "", systemQty: 0, actualQty: "", difference: 0 }]);
    } catch (err) {
      setMessage({ text: t("stockCorrectionError"), severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: { xs: 0, sm: "240px" }, mt: 2 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>{t("Physical Stock Correction")}</Typography>
        {message.text && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "info" })}>{message.text}</Alert>}
        
        <FormControl sx={{ minWidth: 200, mb: 3 }}>
          <InputLabel>{t("Branch")}</InputLabel>
          <Select value={branch} onChange={(e) => setBranch(e.target.value)} label={t("Branch")}>
            {branches.map((b) => <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode}</MenuItem>)}
          </Select>
        </FormControl>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="35%">{t("Item Name")}</TableCell>
                <TableCell width="20%">{t("Batch")}</TableCell>
                <TableCell align="right">{t("System Qty")}</TableCell>
                <TableCell align="right">{t("Actual Qty")}</TableCell>
                <TableCell align="right">{t("Difference")}</TableCell>
                <TableCell align="center">{t("Action")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Autocomplete
                      options={items}
                      getOptionLabel={(o) => o.itemName || o.item_name || ""}
                      value={row.selectedItem}
                      onChange={(e, v) => handleItemChange(row.id, v)}
                      renderInput={(params) => <TextField {...params} size="small" placeholder={t("Select Item")} />}
                    />
                  </TableCell>
                  <TableCell>
                    <Select fullWidth size="small" value={row.selectedBatch} onChange={(e) => handleBatchChange(row.id, e.target.value)} disabled={!row.batches.length}>
                      {row.batches.map((b) => <MenuItem key={b.batchNo} value={b.batchNo}>{b.batchNo} ({b.currentStock})</MenuItem>)}
                    </Select>
                  </TableCell>
                  <TableCell align="right">{row.systemQty.toFixed(3)}</TableCell>
                  <TableCell align="right">
                    <TextField type="number" size="small" value={row.actualQty} onChange={(e) => handleActualQtyChange(row.id, e.target.value)} sx={{ width: 100 }} />
                  </TableCell>
                  <TableCell align="right">{row.difference.toFixed(3)}</TableCell>
                  <TableCell align="center">
                    <IconButton color="error" onClick={() => handleRemoveRow(row.id)} disabled={rows.length === 1}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2}>
            <Button startIcon={<AddIcon />} variant="outlined" onClick={handleAddRow}>
              {t("Add Row")}
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleRefreshCache} 
              disabled={cacheStatus.loading}
            >
              {cacheStatus.loading ? `${t("Loading")}... ${cacheStatus.loadedCount}` : t("Refresh Items")}
            </Button>
          </Stack>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : t("Save All Corrections")}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default PhysicalStockCorrection;