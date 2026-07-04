import React, { useState, useCallback, useEffect } from "react";
import {
  Box, Paper, Typography, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Accordion, AccordionSummary, AccordionDetails,
  Alert, Chip, TextField, Divider,
} from "@mui/material";
import {
  ExpandMore as ExpandIcon,
  Search as SearchIcon,
  FileDownload as ExportIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const API = () => {
  const tid = localStorage.getItem("tenancyId");
  const tok = localStorage.getItem("jwtToken");
  return { base: `/api/${tid}`, headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" } };
};

const fmtDT = (v) => {
  if (!v) return "";
  try { return new Date(v).toLocaleString(); } catch { return String(v); }
};
const round2 = (v) => Math.round((v || 0) * 100) / 100;

const StatusChip = ({ status }) => {
  const colorMap = { PENDING_APPROVAL: "warning", APPROVED: "info", APPLIED: "success", REJECTED: "error", DRAFT: "default" };
  return <Chip label={status} size="small" color={colorMap[status] || "default"} />;
};

export default function PurchaseCorrectionHistoryPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const headerBg = isDark ? "#1e2a3a" : "#e3f2fd";

  const [searchParams] = useSearchParams();

  const [searchInput, setSearchInput]   = useState(searchParams.get("purchaseId") || "");
  const [resolvedId, setResolvedId]     = useState(searchParams.get("purchaseId") || "");
  const [searchResults, setSearchResults] = useState([]); // multiple matches
  const [history, setHistory]           = useState([]);
  const [loading, setLoading]           = useState(false);
  const [err, setErr]                   = useState("");
  const [purchaseSummary, setPurchaseSummary] = useState(null);

  // UUID pattern (8-4-4-4-12 or plain 32-char hex)
  const looksLikeId = (s) => /^[0-9a-f-]{32,36}$/i.test(s.trim());

  const loadById = useCallback(async (pid) => {
    if (!pid?.trim()) return;
    const { base, headers } = API();
    setLoading(true);
    setErr("");
    setSearchResults([]);
    setResolvedId(pid);
    try {
      const [histRes, purchRes] = await Promise.all([
        fetch(`${base}/purchases/${pid}/corrections/history`, { headers }),
        fetch(`${base}/purchase/${pid}`, { headers }),
      ]);
      const hist = await histRes.json();
      setHistory(Array.isArray(hist) ? hist : []);
      if (purchRes.ok) setPurchaseSummary(await purchRes.json());
      else setPurchaseSummary(null);
    } catch (e) {
      setErr("Failed to load history: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchInput.trim();
    if (!q) return;
    // If it already looks like a UUID, load directly
    if (looksLikeId(q)) { loadById(q); return; }

    const { base, headers } = API();
    setLoading(true);
    setErr("");
    setHistory([]);
    setPurchaseSummary(null);
    setSearchResults([]);
    try {
      const res = await fetch(`${base}/purchase-search?q=${encodeURIComponent(q)}`, { headers });
      const data = await res.json();
      const results = Array.isArray(data) ? data : [];
      if (results.length === 0) {
        setErr("No purchases found matching: " + q);
      } else if (results.length === 1) {
        loadById(results[0].id);
      } else {
        setSearchResults(results); // show picker
      }
    } catch (e) {
      setErr("Search failed: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [searchInput, loadById]);

  // Auto-load if purchaseId provided via query param (it's a UUID)
  useEffect(() => {
    const pid = searchParams.get("purchaseId");
    if (pid) loadById(pid);
  }, []);

  const handleExport = () => {
    if (!history.length) return;
    const rows = [];
    history.forEach((r) => {
      (r.changes || []).forEach((c) => {
        rows.push({
          "Correction No":   r.correctionNo,
          "Status":          r.status,
          "Reason":          r.correctionReason,
          "Requested By":    r.requestedBy,
          "Requested At":    fmtDT(r.requestedAt),
          "Approved By":     r.approvedBy || "",
          "Approved At":     fmtDT(r.approvedAt),
          "Rejected By":     r.rejectedBy || "",
          "Rejected At":     fmtDT(r.rejectedAt),
          "Rejection Reason":r.rejectionReason || "",
          "Applied By":      r.appliedBy || "",
          "Applied At":      fmtDT(r.appliedAt),
          "Entity":          c.entityName,
          "Line No":         c.lineNo || "",
          "Field":           c.fieldName,
          "Old Value":       c.oldValue || "",
          "New Value":       c.newValue || "",
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Correction History");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `correction_history_${resolvedId}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box p={2}>
      <Typography variant="h6" fontWeight={700} mb={2}>Purchase Correction History</Typography>

      {/* Search */}
      <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={1} alignItems="center">
          <TextField
            label="Voucher No / Supplier Invoice No / Supplier Name"
            size="small"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            sx={{ width: 360 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          />
          <Button variant="contained" startIcon={<SearchIcon />}
            onClick={handleSearch} disabled={loading || !searchInput.trim()}>
            {loading ? "Searching…" : "Search"}
          </Button>
          {history.length > 0 && (
            <Button variant="outlined" startIcon={<ExportIcon />} onClick={handleExport}>
              Export Excel
            </Button>
          )}
        </Box>

        {/* Multiple match picker */}
        {searchResults.length > 1 && (
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Multiple purchases found — select one:
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Voucher No</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell>Inv No</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>{p.voucherNumber}</TableCell>
                      <TableCell>{p.voucherDate ? String(p.voucherDate).slice(0, 10) : ""}</TableCell>
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell>{p.supplierVoucherNumber}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => loadById(p.id)}>Load</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Purchase summary strip */}
        {purchaseSummary && (
          <Box mt={1.5} display="flex" gap={3} flexWrap="wrap">
            {[
              ["Voucher No",  purchaseSummary.voucherNumber],
              ["Supplier",    purchaseSummary.supplierName],
              ["Branch",      purchaseSummary.branchCode],
              ["Inv No",      purchaseSummary.supplierVoucherNumber],
            ].map(([l, v]) => (
              <Box key={l}>
                <Typography variant="caption" color="text.secondary">{l}</Typography>
                <Typography variant="body2" fontWeight={600}>{v || "—"}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* History list */}
      {loading && <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>}

      {!loading && history.length === 0 && resolvedId && searchResults.length === 0 && (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">No corrections found for this purchase.</Typography>
        </Paper>
      )}

      {history.map((r) => (
        <Accordion key={r.correctionId} sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap" width="100%">
              <Typography fontWeight={700} sx={{ minWidth: 160 }}>{r.correctionNo}</Typography>
              <StatusChip status={r.status} />
              <Typography variant="body2" color="text.secondary">
                Requested by {r.requestedBy} on {fmtDT(r.requestedAt)}
              </Typography>
              {r.status === "REJECTED" && (
                <Chip label="Rejected" color="error" size="small" />
              )}
              {r.status === "APPLIED" && (
                <Typography variant="body2" color="text.secondary">
                  · Applied by {r.appliedBy} on {fmtDT(r.appliedAt)}
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {/* Reason */}
              <Alert severity="info" sx={{ mb: 2 }}>
                <b>Reason:</b> {r.correctionReason}
              </Alert>

              {/* Approval/rejection trail */}
              {(r.approvedBy || r.rejectedBy) && (
                <Box mb={2} display="flex" gap={3} flexWrap="wrap">
                  {r.approvedBy && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Approved By</Typography>
                      <Typography variant="body2" fontWeight={600}>{r.approvedBy}</Typography>
                      <Typography variant="caption" color="text.secondary">{fmtDT(r.approvedAt)}</Typography>
                    </Box>
                  )}
                  {r.rejectedBy && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Rejected By</Typography>
                      <Typography variant="body2" fontWeight={600} color="error.main">{r.rejectedBy}</Typography>
                      <Typography variant="caption" color="text.secondary">{fmtDT(r.rejectedAt)}</Typography>
                      <Typography variant="body2" color="error.main" mt={0.5}>
                        Reason: {r.rejectionReason}
                      </Typography>
                    </Box>
                  )}
                  {r.appliedBy && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Applied By</Typography>
                      <Typography variant="body2" fontWeight={600} color="success.main">{r.appliedBy}</Typography>
                      <Typography variant="caption" color="text.secondary">{fmtDT(r.appliedAt)}</Typography>
                    </Box>
                  )}
                </Box>
              )}

              {/* Field changes */}
              {(r.changes || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>
                    Field Changes ({r.changes.length})
                  </Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
                          <TableCell>Entity</TableCell>
                          <TableCell>Line</TableCell>
                          <TableCell>Field</TableCell>
                          <TableCell>Old Value</TableCell>
                          <TableCell>New Value</TableCell>
                          <TableCell>Type</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {r.changes.map((c, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Chip label={c.entityName} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{c.lineNo || "—"}</TableCell>
                            <TableCell><b>{c.fieldName}</b></TableCell>
                            <TableCell sx={{ color: "error.main" }}>{c.oldValue || "—"}</TableCell>
                            <TableCell sx={{ color: "success.main", fontWeight: 600 }}>
                              {c.newValue || "—"}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">{c.dataType}</Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Stock impact */}
              {(r.stockImpacts || []).length > 0 && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Stock Adjustments</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ "& th": { bgcolor: headerBg, fontWeight: 700 } }}>
                          <TableCell>Item</TableCell>
                          <TableCell>Batch</TableCell>
                          <TableCell>Original Qty</TableCell>
                          <TableCell>Corrected Qty</TableCell>
                          <TableCell>Difference</TableCell>
                          <TableCell>Adj Ref</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {r.stockImpacts.map((si, i) => (
                          <TableRow key={i}>
                            <TableCell>{si.itemName}</TableCell>
                            <TableCell>{si.batchCode}</TableCell>
                            <TableCell>{si.originalQty}</TableCell>
                            <TableCell>{si.correctedQty}</TableCell>
                            <TableCell
                              sx={{ color: si.differenceQty < 0 ? "error.main" : "success.main", fontWeight: 600 }}>
                              {si.differenceQty > 0 ? `+${si.differenceQty}` : si.differenceQty}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {si.adjRef ? si.adjRef.slice(-8) : "—"}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}

              {/* Financial impact */}
              {r.financialImpact && (
                <>
                  <Typography variant="subtitle2" fontWeight={700} mb={0.5}>Financial Impact</Typography>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    {[
                      ["Original Total",     r.financialImpact.originalTotal],
                      ["Corrected Total",    r.financialImpact.correctedTotal],
                      ["Difference",         r.financialImpact.differenceAmount],
                      ["Tax Difference",     r.financialImpact.taxDifference],
                      ["Payable Difference", r.financialImpact.payableDifference],
                    ].map(([l, v]) => (
                      <Paper key={l} variant="outlined" sx={{ p: 1.5, minWidth: 130 }}>
                        <Typography variant="caption" color="text.secondary">{l}</Typography>
                        <Typography fontWeight={700}
                          color={v < 0 ? "error.main" : v > 0 ? "success.main" : "text.primary"}>
                          {v !== undefined ? round2(v).toLocaleString() : "—"}
                        </Typography>
                      </Paper>
                    ))}
                    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 130 }}>
                      <Typography variant="caption" color="text.secondary">Accounting</Typography>
                      <Chip label={r.financialImpact.accountingStatus || "—"} size="small" sx={{ mt: 0.5 }} />
                    </Paper>
                  </Box>
                </>
              )}

              <Divider sx={{ mt: 2 }} />
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
