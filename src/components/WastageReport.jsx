import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
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
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Chip,
  Collapse,
  IconButton,
  TablePagination,
} from "@mui/material";
import {
  KeyboardArrowDown as DownIcon,
  KeyboardArrowRight as RightIcon,
} from "@mui/icons-material";

/**
 * Consolidated wastage across branches - backlog #46 / #48.
 *
 * Separate from the entry window on purpose: a branch records its own wastage and must not
 * see another branch's, so this is a different menu with its own role grant and it calls
 * /wastage/all rather than the branch-scoped /wastage.
 *
 * Wastage by reason, by branch, by item and over time is worth having on its own, before any
 * of it reaches the juice cost report (#32) or the COFT objective (#41).
 */

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];

const WastageReport = () => {
  const { t } = useTranslation();

  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    (async () => {
      try {
        const [b, r] = await Promise.all([
          axios.get(`/api/${tenancyId}/branches`, auth),
          axios.get(`/api/${tenancyId}/wastage/reasons`, auth),
        ]);
        const list = Array.isArray(b.data) ? b.data : b.data?.branches || b.data?.data || [];
        setBranches(list);
        setReasons(Array.isArray(r.data) ? r.data : []);
      } catch {
        setError(t("Could not load filters."));
      }
    })();
  }, [tenancyId, auth, t]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`/api/${tenancyId}/wastage/all`, {
        ...auth,
        params: {
          branchCode: branch || undefined,
          status: status || undefined,
          reason: reason || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          page,
          size,
        },
      });
      setRows(res.data?.content || []);
      setTotal(res.data?.total || 0);
    } catch (err) {
      setError(err?.response?.data?.error || t("Could not load wastage."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenancyId, auth, branch, status, reason, fromDate, toDate, page, size, t]);

  useEffect(() => {
    load();
  }, [load]);

  const money = (n) =>
    (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /**
   * Totals cover the page in view, not the whole filtered set - the endpoint pages rather
   * than aggregating. Labelled as such rather than presented as a grand total, because a
   * figure that silently means something narrower than it says is worse than no figure.
   */
  const pageTotals = useMemo(
    () => ({
      qty: rows.reduce((s, r) => s + (Number(r.total_qty) || 0), 0),
      value: rows.reduce((s, r) => s + (Number(r.total_value) || 0), 0),
    }),
    [rows]
  );

  const statusColor = (s) =>
    s === "APPROVED" ? "success" : s === "REJECTED" ? "error" : s === "SUBMITTED" ? "warning" : "default";

  const headCell = { color: "#fff", fontWeight: 700 };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {t("Wastage Report")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("All branches. Values are at cost.")}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{t("Branch")}</InputLabel>
            <Select value={branch} label={t("Branch")} onChange={(e) => { setPage(0); setBranch(e.target.value); }}>
              <MenuItem value="">
                <em>{t("All branches")}</em>
              </MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>{t("Reason")}</InputLabel>
            <Select value={reason} label={t("Reason")} onChange={(e) => { setPage(0); setReason(e.target.value); }}>
              <MenuItem value="">
                <em>{t("All reasons")}</em>
              </MenuItem>
              {reasons.map((r) => (
                <MenuItem key={r.code} value={r.code}>
                  {r.code.replace(/_/g, " ")}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>{t("Status")}</InputLabel>
            <Select value={status} label={t("Status")} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
              <MenuItem value="">
                <em>{t("All")}</em>
              </MenuItem>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small" type="date" label={t("From")} value={fromDate}
            onChange={(e) => { setPage(0); setFromDate(e.target.value); }}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }}
          />
          <TextField
            size="small" type="date" label={t("To")} value={toDate}
            onChange={(e) => { setPage(0); setToDate(e.target.value); }}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: 160 }}
          />

          <Button variant="contained" onClick={load} disabled={loading}>
            {loading ? <CircularProgress size={22} /> : t("Refresh")}
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ ...headCell, width: 48 }} />
              <TableCell sx={headCell}>{t("Voucher")}</TableCell>
              <TableCell sx={headCell}>{t("Date")}</TableCell>
              <TableCell sx={headCell}>{t("Branch")}</TableCell>
              <TableCell sx={headCell}>{t("Reason")}</TableCell>
              <TableCell sx={headCell} align="right">{t("Quantity")}</TableCell>
              <TableCell sx={headCell} align="right">{t("Value")}</TableCell>
              <TableCell sx={headCell}>{t("Status")}</TableCell>
              <TableCell sx={headCell}>{t("Recorded by")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                  {t("No wastage recorded for these filters.")}
                </TableCell>
              </TableRow>
            )}

            {rows.map((r) => {
              const open = Boolean(expanded[r.id]);
              return (
                <React.Fragment key={r.id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => setExpanded((p) => ({ ...p, [r.id]: !p[r.id] }))}
                        aria-label={open ? t("Hide lines") : t("Show lines")}
                      >
                        {open ? <DownIcon fontSize="small" /> : <RightIcon fontSize="small" />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{r.voucher_number || <em>{t("draft")}</em>}</TableCell>
                    <TableCell>{(r.voucher_date || "").slice(0, 10)}</TableCell>
                    <TableCell>{r.branch_code}</TableCell>
                    <TableCell>{(r.reason_code || "").replace(/_/g, " ")}</TableCell>
                    <TableCell align="right">{r.total_qty}</TableCell>
                    <TableCell align="right">{money(r.total_value)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={statusColor(r.status)} />
                    </TableCell>
                    <TableCell>{r.recorded_by_username || r.recorded_by || "—"}</TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell colSpan={9} sx={{ py: 0, borderBottom: open ? undefined : "none" }}>
                      <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ my: 1, ml: 6 }}>
                          {r.remarks && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {r.remarks}
                            </Typography>
                          )}
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ bgcolor: "#1976d2" }}>
                                <TableCell sx={headCell}>{t("Item")}</TableCell>
                                <TableCell sx={headCell} align="right">{t("Quantity")}</TableCell>
                                <TableCell sx={headCell}>{t("Unit")}</TableCell>
                                <TableCell sx={headCell} align="right">{t("Cost")}</TableCell>
                                <TableCell sx={headCell} align="right">{t("Value")}</TableCell>
                                <TableCell sx={headCell}>{t("Batch")}</TableCell>
                                <TableCell sx={headCell}>{t("Reason")}</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {(r.lines || []).map((l, i) => (
                                <TableRow key={`${r.id}-${i}`}>
                                  <TableCell>
                                    {l.item_name} {l.item_code ? `(${l.item_code})` : ""}
                                  </TableCell>
                                  <TableCell align="right">{l.qty}</TableCell>
                                  <TableCell>{l.unit || "—"}</TableCell>
                                  <TableCell align="right">{money(l.rate)}</TableCell>
                                  <TableCell align="right">
                                    {money((Number(l.qty) || 0) * (Number(l.rate) || 0))}
                                  </TableCell>
                                  <TableCell>{l.batch || "—"}</TableCell>
                                  <TableCell>
                                    {(l.reason_code || r.reason_code || "").replace(/_/g, " ")}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mt: 2 }}>
        <Chip label={`${t("This page")}: ${rows.length} ${t("vouchers")}`} />
        <Chip label={`${t("Quantity")}: ${pageTotals.qty}`} />
        <Chip color="primary" label={`${t("Value")}: ${money(pageTotals.value)}`} />
        <Box sx={{ flexGrow: 1 }} />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={size}
          onRowsPerPageChange={(e) => {
            setSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </Stack>
    </Box>
  );
};

export default WastageReport;
