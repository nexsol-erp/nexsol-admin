import React, { useState, useCallback, useMemo } from "react";
import {
  Box, Paper, Typography, TextField, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, Chip, Divider, Switch, FormControlLabel, IconButton, Tooltip,
  Collapse,
} from "@mui/material";
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as PreviewIcon,
  Send as SubmitIcon,
  History as HistoryIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@mui/material/styles";

const API = () => {
  const tid = localStorage.getItem("tenancyId");
  const tok = localStorage.getItem("jwtToken");
  return { base: `/api/${tid}`, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" } };
};

const fmtDate = (v) => {
  if (!v) return "";
  return typeof v === "string" ? v.slice(0, 10) : String(v).slice(0, 10);
};

const round2 = (v) => Math.round((v || 0) * 100) / 100;

export default function PurchaseCorrectionPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === "dark";
  const headerBg = isDark ? "#1e2a3a" : "#e3f2fd";

  const userId = localStorage.getItem("userId") || "unknown";
  const roles  = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("roles") || "[]"); } catch { return []; }
  }, []);
  const isAdmin = roles.includes("admin") || roles.includes("system-admin");

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchVoucher, setSearchVoucher] = useState("");
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [purchases, setPurchases] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");

  // ── Loaded purchase state ─────────────────────────────────────────────────
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editHdr, setEditHdr]     = useState({});
  const [editLines, setEditLines] = useState([]);
  const [reason, setReason]       = useState("");
  const [requireApproval, setRequireApproval] = useState(!isAdmin);

  // ── Preview state ─────────────────────────────────────────────────────────
  const [preview, setPreview]         = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewing, setPreviewing]   = useState(false);
  const [previewErr, setPreviewErr]   = useState("");

  // ── Submit state ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // ── UI helpers ────────────────────────────────────────────────────────────
  const [showLines, setShowLines] = useState(true);

  // ─────────────────────────────────────────────────────────────────────────
  // Search purchases
  // ─────────────────────────────────────────────────────────────────────────
  const searchPurchases = useCallback(async () => {
    const { base, headers } = API();
    setSearching(true);
    setSearchErr("");
    try {
      const branchCode = localStorage.getItem("branchCode") || "";
      const res = await fetch(
        `${base}/purchase-list?branch=${branchCode}&fromDate=${fromDate}&toDate=${toDate}`,
        { headers }
      );
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      // Filter by voucher number if typed
      const filtered = searchVoucher.trim()
        ? list.filter((p) =>
            (p.voucherNumber || "").toLowerCase().includes(searchVoucher.trim().toLowerCase()) ||
            (p.supplierVoucherNumber || "").toLowerCase().includes(searchVoucher.trim().toLowerCase()) ||
            (p.supplierName || "").toLowerCase().includes(searchVoucher.trim().toLowerCase())
          )
        : list;
      setPurchases(filtered);
    } catch (e) {
      setSearchErr("Search failed: " + e.message);
    } finally {
      setSearching(false);
    }
  }, [fromDate, toDate, searchVoucher]);

  // ─────────────────────────────────────────────────────────────────────────
  // Load purchase for editing
  // ─────────────────────────────────────────────────────────────────────────
  const loadPurchase = useCallback(async (purchaseId) => {
    const { base, headers } = API();
    setLoading(true);
    try {
      const res = await fetch(`${base}/purchase/${purchaseId}`, { headers });
      const data = await res.json();
      setPurchase(data);
      setEditHdr({
        supplierId: data.supplierId || "",
        supplierName: data.supplierName || "",
        supplierVoucherNumber: data.supplierVoucherNumber || "",
        supplierVoucherDate: fmtDate(data.supplierVoucherDate),
      });
      setEditLines(
        (data.items || []).map((item) => ({
          purchaseDtlId: item.purchaseDtlId,
          grnDtlId: item.grnDtlId || null,
          itemId: item.itemId,
          itemName: item.itemName,
          batch: item.batch || "",
          quantity: item.orderedQty || item.quantity,
          inventoryQty: item.receivedQty || item.inventoryQty || item.quantity,
          purchaseRate: item.purchaseRate ?? item.rateBeforeTax,
          standardPrice: item.standardPrice || item.rateIncludingTax,
          taxRate: item.taxRate,
          amount: item.totalAmount || item.amount,
        }))
      );
      setPreview(null);
      setSubmitResult(null);
      setReason("");
    } catch (e) {
      setSearchErr("Failed to load purchase: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Preview
  // ─────────────────────────────────────────────────────────────────────────
  const handlePreview = useCallback(async () => {
    if (!purchase) return;
    if (!reason.trim()) {
      setPreviewErr("Please enter a correction reason before previewing.");
      return;
    }
    const { base, headers } = API();
    setPreviewing(true);
    setPreviewErr("");
    try {
      const payload = buildPayload(false);
      const res = await fetch(
        `${base}/purchases/${purchase.id}/corrections/preview`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setPreview(data);
      setPreviewOpen(true);
    } catch (e) {
      setPreviewErr("Preview failed: " + e.message);
    } finally {
      setPreviewing(false);
    }
  }, [purchase, editHdr, editLines, reason, requireApproval]);

  // ─────────────────────────────────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!purchase) return;
    if (!reason.trim()) {
      setPreviewErr("Correction reason is mandatory.");
      return;
    }
    const { base, headers } = API();
    setSubmitting(true);
    setPreviewErr("");
    try {
      const payload = buildPayload(requireApproval);
      const res = await fetch(
        `${base}/purchases/${purchase.id}/corrections/submit`,
        { method: "POST", headers, body: JSON.stringify(payload) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      setSubmitResult(data);
      setPreviewOpen(false);
    } catch (e) {
      setPreviewErr("Submit failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  }, [purchase, editHdr, editLines, reason, requireApproval]);

  const buildPayload = (withApproval) => ({
    purchaseHdrId: purchase.id,
    correctionReason: reason,
    requestedBy: userId,
    requiresApproval: withApproval,
    supplierId: editHdr.supplierId !== (purchase.supplierId || "") ? editHdr.supplierId : undefined,
    supplierName: editHdr.supplierName !== (purchase.supplierName || "") ? editHdr.supplierName : undefined,
    supplierVoucherNumber:
      editHdr.supplierVoucherNumber !== (purchase.supplierVoucherNumber || "")
        ? editHdr.supplierVoucherNumber
        : undefined,
    supplierVoucherDate:
      editHdr.supplierVoucherDate !== fmtDate(purchase.supplierVoucherDate)
        ? editHdr.supplierVoucherDate
        : undefined,
    lineChanges: editLines.map((l) => ({
      purchaseDtlId: l.purchaseDtlId,
      grnDtlId:      l.grnDtlId,
      itemId:        l.itemId,
      itemName:      l.itemName,
      batch:         l.batch,
      quantity:      l.quantity,
      inventoryQty:  l.inventoryQty,
      purchaseRate:  l.purchaseRate,
      standardPrice: l.standardPrice,
      taxRate:       l.taxRate,
      amount:        l.amount,
    })),
  });

  const updateLine = (idx, field, value) => {
    setEditLines((prev) => {
      const next = [...prev];
      const ln = { ...next[idx], [field]: value };
      // Auto-recalculate amount
      if (["quantity", "purchaseRate", "taxRate"].includes(field)) {
        const qty  = field === "quantity"    ? parseFloat(value) || 0 : (ln.quantity || 0);
        const rate = field === "purchaseRate" ? parseFloat(value) || 0 : (ln.purchaseRate || 0);
        const tax  = field === "taxRate"      ? parseFloat(value) || 0 : (ln.taxRate || 0);
        ln.standardPrice = round2(rate * (1 + tax / 100));
        ln.amount        = round2(qty * ln.standardPrice);
        ln.inventoryQty  = qty; // default 1:1; user can override
      }
      next[idx] = ln;
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (submitResult) {
    return (
      <Box p={3}>
        <Alert
          severity={submitResult.status === "APPLIED" ? "success" : "info"}
          action={
            <Button size="small" onClick={() => { setSubmitResult(null); setPurchase(null); }}>
              New Correction
            </Button>
          }
        >
          <Typography fontWeight={600}>{submitResult.message}</Typography>
          <Typography variant="body2">Correction No: {submitResult.correctionNo}</Typography>
          <Typography variant="body2">Status: {submitResult.status}</Typography>
          <Typography variant="body2">Changes: {submitResult.changeCount}</Typography>
        </Alert>
        <Box mt={2} display="flex" gap={1}>
          <Button variant="outlined" onClick={() => navigate(`/purchase-correction-history?purchaseId=${purchase?.id}`)}>
            View History
          </Button>
          {submitResult.status === "PENDING_APPROVAL" && (
            <Button variant="outlined" color="warning" onClick={() => navigate("/purchase-correction-approval")}>
              Go to Approval Queue
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Typography variant="h6" fontWeight={700} mb={2}>Purchase / GRN Correction</Typography>

      {/* ── Search Panel ──────────────────────────────────────────────────── */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" mb={1} fontWeight={600}>Search Purchase</Typography>
        <Box display="flex" gap={1} flexWrap="wrap" alignItems="center">
          <TextField
            label="Voucher / Invoice No / Supplier"
            size="small"
            value={searchVoucher}
            onChange={(e) => setSearchVoucher(e.target.value)}
            sx={{ width: 260 }}
          />
          <TextField type="date" label="From" size="small" InputLabelProps={{ shrink: true }}
            value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <TextField type="date" label="To" size="small" InputLabelProps={{ shrink: true }}
            value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Button variant="contained" startIcon={<SearchIcon />}
            onClick={searchPurchases} disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </Box>

        {searchErr && <Alert severity="error" sx={{ mt: 1 }}>{searchErr}</Alert>}

        {purchases.length > 0 && (
          <TableContainer sx={{ mt: 2, maxHeight: 220 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700, fontSize: "0.75rem" } }}>
                  <TableCell>Voucher No</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Inv No</TableCell>
                  <TableCell>GRN</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.voucherNumber}</TableCell>
                    <TableCell>{fmtDate(p.voucherDate)}</TableCell>
                    <TableCell>{p.supplierName}</TableCell>
                    <TableCell>{p.supplierVoucherNumber}</TableCell>
                    <TableCell>
                      <Chip label={p.grnDone ? "Done" : "Pending"} size="small"
                        color={p.grnDone ? "success" : "default"} />
                    </TableCell>
                    <TableCell>
                      <Button size="small" variant="outlined" startIcon={<EditIcon />}
                        onClick={() => loadPurchase(p.id)}>
                        Correct
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>}

      {/* ── Purchase editor ───────────────────────────────────────────────── */}
      {purchase && !loading && (
        <Paper elevation={2} sx={{ p: 2 }}>
          {/* Header info */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              Correcting: {purchase.voucherNumber}
            </Typography>
            <Box display="flex" gap={1}>
              <Tooltip title="View correction history">
                <IconButton size="small"
                  onClick={() => navigate(`/purchase-correction-history?purchaseId=${purchase.id}`)}>
                  <HistoryIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Header fields */}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>HEADER FIELDS</Typography>
          <Box display="flex" gap={1.5} flexWrap="wrap" mt={1} mb={2}>
            <TextField label="Supplier Name" size="small" value={editHdr.supplierName}
              onChange={(e) => setEditHdr({ ...editHdr, supplierName: e.target.value })} sx={{ width: 220 }} />
            <TextField label="Supplier ID" size="small" value={editHdr.supplierId}
              onChange={(e) => setEditHdr({ ...editHdr, supplierId: e.target.value })} sx={{ width: 160 }} />
            <TextField label="Supplier Invoice No" size="small" value={editHdr.supplierVoucherNumber}
              onChange={(e) => setEditHdr({ ...editHdr, supplierVoucherNumber: e.target.value })} sx={{ width: 200 }} />
            <TextField label="Supplier Invoice Date" type="date" size="small"
              InputLabelProps={{ shrink: true }} value={editHdr.supplierVoucherDate}
              onChange={(e) => setEditHdr({ ...editHdr, supplierVoucherDate: e.target.value })} sx={{ width: 180 }} />
          </Box>

          {/* Item lines */}
          <Box display="flex" alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              ITEM LINES ({editLines.length})
            </Typography>
            <IconButton size="small" onClick={() => setShowLines((s) => !s)} sx={{ ml: 0.5 }}>
              {showLines ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
            </IconButton>
          </Box>

          <Collapse in={showLines}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700, fontSize: "0.72rem" } }}>
                    <TableCell>#</TableCell>
                    <TableCell>Item</TableCell>
                    <TableCell>Batch</TableCell>
                    <TableCell>Qty (Purchase)</TableCell>
                    <TableCell>Qty (Stock)</TableCell>
                    <TableCell>Rate (Excl. Tax)</TableCell>
                    <TableCell>Tax %</TableCell>
                    <TableCell>Rate (Incl. Tax)</TableCell>
                    <TableCell>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {editLines.map((ln, idx) => (
                    <TableRow key={ln.purchaseDtlId || idx}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{ln.itemName}</Typography>
                        <Typography variant="caption" color="text.secondary">{ln.itemId?.slice(-6)}</Typography>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={ln.batch}
                          onChange={(e) => updateLine(idx, "batch", e.target.value)}
                          sx={{ width: 80 }} inputProps={{ style: { padding: "4px 6px" } }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={ln.quantity}
                          onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                          sx={{ width: 80 }} inputProps={{ style: { padding: "4px 6px" } }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={ln.inventoryQty}
                          onChange={(e) => updateLine(idx, "inventoryQty", parseFloat(e.target.value) || 0)}
                          sx={{ width: 80 }} inputProps={{ style: { padding: "4px 6px" } }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={ln.purchaseRate}
                          onChange={(e) => updateLine(idx, "purchaseRate", e.target.value)}
                          sx={{ width: 90 }} inputProps={{ style: { padding: "4px 6px" } }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="number" value={ln.taxRate}
                          onChange={(e) => updateLine(idx, "taxRate", e.target.value)}
                          sx={{ width: 60 }} inputProps={{ style: { padding: "4px 6px" } }} />
                      </TableCell>
                      <TableCell sx={{ color: "text.secondary" }}>
                        {round2(ln.standardPrice)}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {round2(ln.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>

          {/* Reason + controls */}
          <Box mt={2} display="flex" gap={2} flexWrap="wrap" alignItems="flex-start">
            <TextField
              label="Correction Reason *"
              multiline
              rows={2}
              size="small"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              sx={{ flex: 1, minWidth: 280 }}
              helperText="Mandatory — explain why this correction is needed"
              error={!reason.trim()}
            />
            <Box display="flex" flexDirection="column" gap={1}>
              {!isAdmin && (
                <FormControlLabel
                  control={
                    <Switch checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)} size="small" />
                  }
                  label={<Typography variant="body2">Requires Approval</Typography>}
                />
              )}
              <Box display="flex" gap={1}>
                <Button variant="outlined" startIcon={<PreviewIcon />}
                  onClick={handlePreview} disabled={previewing || !reason.trim()}>
                  {previewing ? <CircularProgress size={16} /> : "Preview Changes"}
                </Button>
                <Button variant="contained" color="warning" startIcon={<SubmitIcon />}
                  onClick={handleSubmit} disabled={submitting || !reason.trim()}>
                  {submitting ? <CircularProgress size={16} /> : (
                    requireApproval ? "Submit for Approval" : "Apply Correction"
                  )}
                </Button>
              </Box>
            </Box>
          </Box>

          {previewErr && <Alert severity="error" sx={{ mt: 1 }}>{previewErr}</Alert>}
        </Paper>
      )}

      {/* ── Preview Dialog ────────────────────────────────────────────────── */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>Correction Preview</DialogTitle>
        <DialogContent dividers>
          {preview && (
            <Box>
              <Typography variant="body2" mb={1}>
                <b>{preview.changeCount}</b> field(s) will change on purchase{" "}
                <b>{preview.voucherNumber}</b>.
              </Typography>

              {/* Changes table */}
              {(preview.changes || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" mt={1} mb={0.5} fontWeight={700}>Field Changes</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
                          <TableCell>Entity</TableCell>
                          <TableCell>Line</TableCell>
                          <TableCell>Field</TableCell>
                          <TableCell>Old Value</TableCell>
                          <TableCell>New Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.changes.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell>{c.entityName}</TableCell>
                            <TableCell>{c.lineNo || "—"}</TableCell>
                            <TableCell>{c.fieldName}</TableCell>
                            <TableCell sx={{ color: "error.main" }}>{c.oldValue}</TableCell>
                            <TableCell sx={{ color: "success.main", fontWeight: 600 }}>{c.newValue}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Stock impact */}
              {(preview.stockImpact || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" mt={2} mb={0.5} fontWeight={700}>Stock Impact</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
                          <TableCell>Item</TableCell>
                          <TableCell>Batch</TableCell>
                          <TableCell>Original Qty</TableCell>
                          <TableCell>Corrected Qty</TableCell>
                          <TableCell>Difference</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.stockImpact.map((si, i) => (
                          <TableRow key={i}>
                            <TableCell>{si.itemName}</TableCell>
                            <TableCell>{si.batchCode}</TableCell>
                            <TableCell>{si.originalQty}</TableCell>
                            <TableCell>{si.correctedQty}</TableCell>
                            <TableCell sx={{ color: si.differenceQty < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                              {si.differenceQty > 0 ? `+${si.differenceQty}` : si.differenceQty}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Financial impact */}
              {preview.financialImpact && (
                <>
                  <Typography variant="subtitle2" mt={2} mb={0.5} fontWeight={700}>Financial Impact</Typography>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    {[
                      ["Original Total", preview.financialImpact.originalTotal],
                      ["Corrected Total", preview.financialImpact.correctedTotal],
                      ["Difference", preview.financialImpact.differenceAmount],
                      ["Tax Difference", preview.financialImpact.taxDifference],
                      ["Payable Difference", preview.financialImpact.payableDifference],
                    ].map(([label, val]) => (
                      <Paper key={label} variant="outlined" sx={{ p: 1.5, minWidth: 140 }}>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography fontWeight={700}
                          color={val < 0 ? "error.main" : val > 0 ? "success.main" : "text.primary"}>
                          {val !== undefined ? round2(val).toLocaleString() : "—"}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <CircularProgress size={18} /> : (
              requireApproval ? "Submit for Approval" : "Apply Correction"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
