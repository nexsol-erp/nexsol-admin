import React, { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";

function fmtDate(dt) {
  if (!dt) return "";
  return new Date(Array.isArray(dt) ? toBackendDate(dt) : dt).toLocaleDateString();
}

function toBackendDate(dt) {
  if (!dt) return null;
  if (Array.isArray(dt)) {
    const [y, mo, d, h = 0, mi = 0, s = 0] = dt;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}.000`;
  }
  const date = new Date(dt);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().replace("Z", "");
}

const GoodsReceiptForm = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const branchCode = localStorage.getItem("branchCode") || "";

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(monthAgo);
  const [toDate, setToDate] = useState(today);

  const [branches, setBranches] = useState([]);
  const [receivingBranch, setReceivingBranch] = useState(branchCode);

  const [purchaseList, setPurchaseList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  useEffect(() => {
    fetch(`/api/${tenancyId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        setBranches(list);
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    if (!branchCode) {
      setSnack({ open: true, msg: "Please select a branch from the sidebar first", severity: "warning" });
      return;
    }
    setLoadingList(true);
    setSelectedPurchase(null);
    setItems([]);
    fetch(
      `/api/${tenancyId}/grn/purchase-list?branch=${encodeURIComponent(branchCode)}&fromDate=${fromDate}&toDate=${toDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((data) => setPurchaseList(Array.isArray(data) ? data : []))
      .catch(() => setPurchaseList([]))
      .finally(() => setLoadingList(false));
  };

  const handleSelectPurchase = (purchase) => {
    setSelectedPurchase(purchase);
    setLoadingItems(true);
    setItems([]);
    fetch(`/api/${tenancyId}/grn/purchase/${purchase.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false));
  };

  const handleQtyChange = (idx, val) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              receivedQty: parseFloat(val) || 0,
              amount: (parseFloat(val) || 0) * (it.standardPrice || 0),
            }
          : it
      )
    );
  };

  const handleSave = () => {
    if (!selectedPurchase) return;
    if (!receivingBranch) {
      setSnack({ open: true, msg: "Please select a receiving branch", severity: "error" });
      return;
    }
    const hasItems = items.some((it) => it.receivedQty > 0);
    if (!hasItems) {
      setSnack({ open: true, msg: "No items with received quantity > 0", severity: "warning" });
      return;
    }
    setSaving(true);
    const voucherNumber = `GRN-${Date.now()}`;
    const payload = {
      purchaseHdrId: selectedPurchase.id,
      branchCode: receivingBranch,
      voucherNumber,
      voucherDate: new Date().toISOString().replace("Z", ""),
      supplierName: selectedPurchase.supplierName,
      supplierId: selectedPurchase.supplierId || "",
      supplierVoucherNumber: selectedPurchase.supplierVoucherNumber || "",
      supplierVoucherDate: toBackendDate(selectedPurchase.voucherDate),
      userId: localStorage.getItem("userId") || "",
      companyMstId: tenancyId,
      remarks: "",
      items: items
        .filter((it) => it.receivedQty > 0)
        .map((it) => ({
          purchaseDtlId: it.purchaseDtlId,
          itemId: it.itemId,
          itemName: it.itemName,
          barcode: it.barcode || "",
          unit: it.unit || "",
          batch: it.batch || "",
          taxRate: it.taxRate || 0,
          orderedQty: it.orderedQty,
          receivedQty: it.receivedQty,
          purchaseRate: it.purchaseRate || 0,
          standardPrice: it.standardPrice || 0,
          amount: it.amount || 0,
        })),
    };

    fetch(`/api/${tenancyId}/grn/save`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setSnack({ open: true, msg: `GRN saved: ${data.voucherNumber}`, severity: "success" });
          setSelectedPurchase(null);
          setItems([]);
          setPurchaseList([]);
        } else {
          setSnack({ open: true, msg: data.error || "Save failed", severity: "error" });
        }
      })
      .catch(() => setSnack({ open: true, msg: "Save failed", severity: "error" }))
      .finally(() => setSaving(false));
  };

  const grandTotal = items.reduce((s, it) => s + (it.amount || 0), 0);

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">
          Goods Receipt Note (GRN)
        </Typography>
        {branchCode ? (
          <Chip label={`Branch: ${branchCode}`} color="primary" variant="outlined" size="small" />
        ) : (
          <Chip label="No branch selected" color="warning" variant="outlined" size="small" />
        )}
      </Stack>

      {/* Search Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <Button
              variant="contained"
              startIcon={loadingList ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              onClick={handleSearch}
              disabled={loadingList}
              fullWidth
            >
              Search Purchases
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Purchase List */}
      {purchaseList.length > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Select a Purchase Entry
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Voucher No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Supplier Inv No</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {purchaseList.map((p) => (
                  <TableRow
                    key={p.id}
                    hover={!p.grnDone}
                    onClick={() => !p.grnDone && handleSelectPurchase(p)}
                    selected={selectedPurchase?.id === p.id}
                    sx={{
                      cursor: p.grnDone ? "not-allowed" : "pointer",
                      opacity: p.grnDone ? 0.45 : 1,
                      ...(selectedPurchase?.id === p.id && {
                        backgroundColor: "action.selected",
                      }),
                    }}
                  >
                    <TableCell>{p.voucherNumber}</TableCell>
                    <TableCell>{fmtDate(p.voucherDate)}</TableCell>
                    <TableCell>{p.supplierName}</TableCell>
                    <TableCell>{p.supplierVoucherNumber}</TableCell>
                    <TableCell align="right">{String(p.itemCount)}</TableCell>
                    <TableCell>
                      {p.grnDone && (
                        <Chip label="GRN Done" size="small" color="success" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {purchaseList.length === 0 && !loadingList && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No purchases found. Use the search above to find purchase entries.
        </Typography>
      )}

      {/* Items Table */}
      {selectedPurchase && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom fontWeight={600}>
            Items — {selectedPurchase.voucherNumber} ({selectedPurchase.supplierName})
          </Typography>

          {loadingItems ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Item</TableCell>
                      <TableCell>Barcode</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell align="right">Ordered Qty</TableCell>
                      <TableCell align="right" sx={{ minWidth: 120 }}>
                        Received Qty
                      </TableCell>
                      <TableCell align="right">Rate</TableCell>
                      <TableCell align="right">Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((it, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>{it.itemName}</TableCell>
                        <TableCell>{it.barcode}</TableCell>
                        <TableCell>{it.unit}</TableCell>
                        <TableCell align="right">{it.orderedQty}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={it.receivedQty}
                            onChange={(e) => handleQtyChange(idx, e.target.value)}
                            inputProps={{ min: 0, style: { textAlign: "right", width: 80 } }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {(it.standardPrice || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          {(it.amount || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={7} align="right">
                        <Typography fontWeight={700}>Grand Total</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700}>{grandTotal.toFixed(2)}</Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Receiving Branch + Save */}
              <Box sx={{ mt: 2, display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Receiving Branch</InputLabel>
                  <Select
                    value={receivingBranch}
                    label="Receiving Branch"
                    onChange={(e) => setReceivingBranch(e.target.value)}
                  >
                    {branches.map((b) => (
                      <MenuItem key={b.branchCode} value={b.branchCode}>
                        {b.branchCode}{b.branchName ? ` - ${b.branchName}` : ""}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Button
                  variant="contained"
                  color="success"
                  startIcon={
                    saving ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <CheckCircleIcon />
                    )
                  }
                  onClick={handleSave}
                  disabled={saving}
                  sx={{ minWidth: 140 }}
                >
                  Save GRN
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default GoodsReceiptForm;
