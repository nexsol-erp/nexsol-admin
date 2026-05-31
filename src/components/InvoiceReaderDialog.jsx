import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

// ── fuzzy match helpers ──────────────────────────────────────────────────────

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchScore(needle, candidate) {
  const n = normalize(needle);
  const c = normalize(candidate);
  if (c === n) return 1.0;
  if (c.includes(n) || n.includes(c)) return 0.85;

  const nWords = n.split(" ").filter(Boolean);
  const cWords = c.split(" ").filter(Boolean);
  let shared = 0;
  for (const w of nWords) {
    if (cWords.some((cw) => cw.startsWith(w) || w.startsWith(cw))) shared++;
  }
  return shared / Math.max(nWords.length, 1);
}

function findBestMatch(extractedName, itemList) {
  if (!itemList || !itemList.length) return null;
  let best = null;
  let bestScore = 0;
  for (const item of itemList) {
    const score = matchScore(extractedName, item.itemName || "");
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return bestScore >= 0.45 ? { item: best, score: bestScore } : null;
}

// ── sub-components ───────────────────────────────────────────────────────────

function DropZone({ onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      alert("Please upload a PDF, JPG, or PNG file.");
      return;
    }
    onFile(file);
  };

  return (
    <Box
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files[0]);
      }}
      sx={{
        border: `2px dashed`,
        borderColor: dragging ? "primary.main" : "divider",
        borderRadius: 2,
        p: 4,
        textAlign: "center",
        cursor: "pointer",
        bgcolor: dragging ? "action.hover" : "background.paper",
        transition: "all 0.2s",
        "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
      }}
    >
      <input
        ref={inputRef}
        type="file"
        hidden
        accept=".pdf,image/jpeg,image/png,image/webp"
        onChange={(e) => handle(e.target.files[0])}
      />
      <CloudUploadIcon sx={{ fontSize: 48, color: "primary.main", mb: 1 }} />
      <Typography variant="body1" fontWeight={500}>
        Drop invoice here or click to browse
      </Typography>
      <Typography variant="caption" color="text.secondary">
        PDF, JPG, PNG — max 12 MB
      </Typography>
    </Box>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export default function InvoiceReaderDialog({ open, onClose, onApply, itemList = [], initialSupplierName = "" }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // object URL for images
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState(null); // raw result from API

  // editable header fields
  const [supplierName, setSupplierName] = useState("");
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [supplierInvDate, setSupplierInvDate] = useState("");

  // editable item rows: [{...extracted, matchedItem, matchScore, _key}]
  const [rows, setRows] = useState([]);

  const reset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setScanning(false);
    setError("");
    setExtracted(null);
    setSupplierName("");
    setSupplierInvNo("");
    setSupplierInvDate("");
    setRows([]);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (f) => {
    setFile(f);
    setExtracted(null);
    setError("");
    setRows([]);
    if (f.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleScan = async () => {
    if (!file) return;
    setScanning(true);
    setError("");
    setExtracted(null);
    setRows([]);

    const tenancyId = localStorage.getItem("tenancyId");
    const formData = new FormData();
    formData.append("file", file);

    // Pass known supplier name so the backend can fetch few-shot examples
    const knownSupplier = (supplierName || initialSupplierName || "").trim();
    const qs = knownSupplier ? `?supplier_name=${encodeURIComponent(knownSupplier)}` : "";

    try {
      const res = await fetch(`/ai-service/${tenancyId}/read-invoice${qs}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().then((d) => d.detail || "").catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setExtracted(data);
      setSupplierName(data.supplierName || "");
      setSupplierInvNo(data.supplierInvNo || "");
      setSupplierInvDate(data.supplierInvDate || "");

      const enriched = (data.items || []).map((it) => {
        const match = findBestMatch(it.itemName, itemList);
        return {
          _key: crypto.randomUUID(),
          itemName: it.itemName,
          quantity: it.quantity || 1,
          rateIncludingTax: it.rateIncludingTax || 0,
          taxRate: it.taxRate || 0,
          totalAmount: it.totalAmount || 0,
          matchedItem: match ? match.item : null,
          matchScore: match ? match.score : 0,
        };
      });
      setRows(enriched);
    } catch (e) {
      setError(e.message || "Scan failed. Check service logs.");
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        const updated = { ...r, [field]: value };
        // Recalculate total if qty or rate changes
        if (field === "quantity" || field === "rateIncludingTax") {
          updated.totalAmount =
            parseFloat(updated.quantity || 0) * parseFloat(updated.rateIncludingTax || 0);
        }
        return updated;
      })
    );
  };

  const deleteRow = (key) => setRows((prev) => prev.filter((r) => r._key !== key));

  const handleApply = () => {
    const items = rows.map((r) => {
      const rate = parseFloat(r.rateIncludingTax) || 0;
      const tax = parseFloat(r.taxRate) || 0;
      const qty = parseFloat(r.quantity) || 1;
      const rateBeforeTax = tax > 0 ? (rate * 100) / (100 + tax) : rate;
      const matched = r.matchedItem;
      return {
        _key: crypto.randomUUID(),
        _id: matched
          ? String(matched.item_id ?? matched.itemId ?? matched.itemName)
          : r.itemName,
        itemName: matched ? matched.itemName : r.itemName,
        barcode: matched ? matched.barcode || "" : "",
        rateIncludingTax: rate,
        rateBeforeTax,
        taxRate: tax,
        quantity: qty,
        totalAmount: rate * qty,
      };
    });

    // Save this confirmed extraction as a few-shot example for future scans
    const tenancyId = localStorage.getItem("tenancyId");
    const correction = {
      supplierName,
      supplierInvNo,
      supplierInvDate,
      items: rows.map((r) => ({
        itemName: r.matchedItem ? r.matchedItem.itemName : r.itemName,
        quantity: parseFloat(r.quantity) || 1,
        rateIncludingTax: parseFloat(r.rateIncludingTax) || 0,
        taxRate: parseFloat(r.taxRate) || 0,
        totalAmount: parseFloat(r.totalAmount) || 0,
      })),
    };
    fetch(`/ai-service/${tenancyId}/invoice-correction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(correction),
    }).catch(() => {}); // fire-and-forget — don't block the user

    onApply({ supplierName, supplierInvNo, supplierInvDate, items });
    handleClose();
  };

  const unmatchedCount = rows.filter((r) => !r.matchedItem).length;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <AutoFixHighIcon color="primary" />
        AI Invoice Reader
      </DialogTitle>

      <DialogContent dividers>
        <Grid container spacing={2}>
          {/* Left panel — upload + preview */}
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              {!file ? (
                <DropZone onFile={handleFile} />
              ) : (
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                      {file.name}
                    </Typography>
                    <Tooltip title="Remove file">
                      <IconButton size="small" onClick={reset}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {(file.size / 1024).toFixed(0)} KB · {file.type}
                  </Typography>
                </Paper>
              )}

              {preview && (
                <Box
                  component="img"
                  src={preview}
                  alt="Invoice preview"
                  sx={{
                    width: "100%",
                    maxHeight: 320,
                    objectFit: "contain",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              )}

              {file && !preview && (
                <Paper variant="outlined" sx={{ p: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    PDF preview not available — click Scan to extract data
                  </Typography>
                </Paper>
              )}

              <Button
                variant="contained"
                startIcon={scanning ? <CircularProgress size={18} color="inherit" /> : <AutoFixHighIcon />}
                onClick={handleScan}
                disabled={!file || scanning}
                fullWidth
              >
                {scanning ? "Scanning…" : "Scan Invoice"}
              </Button>

              {error && (
                <Alert severity="error" sx={{ fontSize: 12 }}>
                  {error}
                </Alert>
              )}
            </Stack>
          </Grid>

          {/* Right panel — extracted data */}
          <Grid item xs={12} md={8}>
            {!extracted && !scanning && (
              <Box
                sx={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "text.secondary",
                  minHeight: 200,
                }}
              >
                <Typography>Upload an invoice and click Scan to extract data.</Typography>
              </Box>
            )}

            {scanning && (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, pt: 6 }}>
                <CircularProgress />
                <Typography color="text.secondary">Reading invoice with AI…</Typography>
              </Box>
            )}

            {extracted && (
              <Stack spacing={2}>
                {/* Header fields */}
                <Typography variant="subtitle2" color="text.secondary">
                  Invoice Header
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} sm={5}>
                    <TextField
                      label="Supplier"
                      size="small"
                      fullWidth
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      label="Invoice No"
                      size="small"
                      fullWidth
                      value={supplierInvNo}
                      onChange={(e) => setSupplierInvNo(e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="Invoice Date"
                      type="date"
                      size="small"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={supplierInvDate}
                      onChange={(e) => setSupplierInvDate(e.target.value)}
                    />
                  </Grid>
                </Grid>

                <Divider />

                {/* Item match summary */}
                {rows.length > 0 && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2" color="text.secondary">
                      Items ({rows.length})
                    </Typography>
                    {unmatchedCount > 0 ? (
                      <Chip
                        icon={<WarningAmberIcon />}
                        label={`${unmatchedCount} unmatched — verify item names`}
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<CheckCircleOutlineIcon />}
                        label="All items matched"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                )}

                {/* Items table */}
                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340, overflow: "auto" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ "& th": { fontWeight: "bold", bgcolor: "action.selected" } }}>
                        <TableCell sx={{ minWidth: 180 }}>Item (extracted → matched)</TableCell>
                        <TableCell align="right" sx={{ width: 70 }}>Qty</TableCell>
                        <TableCell align="right" sx={{ width: 100 }}>Rate incl.</TableCell>
                        <TableCell align="right" sx={{ width: 70 }}>Tax %</TableCell>
                        <TableCell align="right" sx={{ width: 90 }}>Total</TableCell>
                        <TableCell sx={{ width: 36 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row._key} hover>
                          <TableCell>
                            <Stack spacing={0.3}>
                              <Typography variant="caption" color="text.secondary">
                                {row.itemName}
                              </Typography>
                              {row.matchedItem ? (
                                <Chip
                                  label={row.matchedItem.itemName}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 11, maxWidth: 220 }}
                                />
                              ) : (
                                <Chip
                                  label="No match — will add as-is"
                                  size="small"
                                  color="warning"
                                  variant="outlined"
                                  sx={{ height: 18, fontSize: 11 }}
                                />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={row.quantity}
                              onChange={(e) => updateRow(row._key, "quantity", e.target.value)}
                              inputProps={{ style: { textAlign: "right", padding: "2px 4px" }, min: 0 }}
                              sx={{ width: 65 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={row.rateIncludingTax}
                              onChange={(e) => updateRow(row._key, "rateIncludingTax", e.target.value)}
                              inputProps={{ style: { textAlign: "right", padding: "2px 4px" }, min: 0 }}
                              sx={{ width: 88 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <TextField
                              size="small"
                              type="number"
                              value={row.taxRate}
                              onChange={(e) => updateRow(row._key, "taxRate", e.target.value)}
                              inputProps={{ style: { textAlign: "right", padding: "2px 4px" }, min: 0 }}
                              sx={{ width: 60 }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {parseFloat(row.totalAmount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <IconButton size="small" color="error" onClick={() => deleteRow(row._key)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      {rows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 3, color: "text.secondary" }}>
                            No items extracted
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {unmatchedCount > 0 && (
                  <Alert severity="warning" sx={{ fontSize: 12 }}>
                    Items shown as "No match" will be added with the extracted name. Make sure to verify them before saving.
                  </Alert>
                )}
              </Stack>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleApply}
          disabled={!extracted || rows.length === 0}
          startIcon={<AutoFixHighIcon />}
        >
          Apply to Purchase Form
        </Button>
      </DialogActions>
    </Dialog>
  );
}
