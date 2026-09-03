import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { checkQuantity, firstQuantityError } from "../utils/quantityCheck";
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
  Chip,
} from "@mui/material";
import { Delete as DeleteIcon, Add as AddIcon } from "@mui/icons-material";

/**
 * Wastage entry - backlog #46 / #48.
 *
 * Records what was thrown away, why, and what it cost. The reason is the point: the
 * alternative this replaces is a residual (opening + receipts - closing - expected
 * consumption) that mixes wastage with over-pouring, theft, miscounts and recipe error.
 *
 * Two things about this screen are deliberate and easy to "fix" wrongly:
 *
 * - The cost column is read-only. The server resolves it from item_mst.purchase_rate and
 *   overwrites whatever is posted, so an editable field here would be a lie. It is shown
 *   because the person recording a write-off should see what it is worth.
 *
 * - Save and Submit are separate. A draft can be incomplete, so a branch can record what it
 *   has mid-shift; submit runs the full validation and locks the voucher. The server
 *   allocates the voucher number only on submit, so repeated saves do not burn numbers.
 */

const emptyRow = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  selectedItem: null,
  qty: "",
  batch: "",
  reasonCode: "",
  description: "",
});

const WastageEntry = () => {
  const { t } = useTranslation();

  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [voucherDate, setVoucherDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reasonCode, setReasonCode] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [reasons, setReasons] = useState([]);
  const [items, setItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [voucher, setVoucher] = useState(null);
  const [message, setMessage] = useState({ text: "", severity: "info" });
  const [itemQuery, setItemQuery] = useState("");
  const [itemLoading, setItemLoading] = useState(false);
  const [itemError, setItemError] = useState("");

  /**
   * One id per voucher being entered, held for the whole of that voucher's life and only
   * regenerated once it has been submitted and the form cleared.
   *
   * It has to be stable across attempts or it does nothing. If a submit times out on a flaky
   * branch connection and the user presses Submit again, a freshly generated id would miss
   * the server's duplicate check and post a second write-off for the same event - the exact
   * outcome the id exists to prevent. Reading it back off the response is not an option
   * either: WastageResponse deliberately does not echo it.
   */
  const txnIdRef = useRef(null);
  const nextTxnId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  /**
   * The reason list is served rather than hardcoded. Three copies of these codes - the CHECK
   * constraint, the Java enum and a React array - is two too many, and the copy furthest from
   * the database is the one that drifts.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [branchRes, reasonRes] = await Promise.all([
          axios.get(`/api/${tenancyId}/branches`, auth),
          axios.get(`/api/${tenancyId}/wastage/reasons`, auth),
        ]);
        if (cancelled) return;

        const list = Array.isArray(branchRes.data)
          ? branchRes.data
          : branchRes.data?.branches || branchRes.data?.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranches(filtered);
        // A branch user has exactly one branch; preselect it rather than making them choose
        // from a list of one.
        if (filtered.length === 1) setBranch(filtered[0].branchCode);

        setReasons(Array.isArray(reasonRes.data) ? reasonRes.data : []);
      } catch (err) {
        if (!cancelled) {
          setMessage({
            text: t("Could not load branches and reasons. Reload the page to try again."),
            severity: "error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenancyId, auth, allowedBranches, t]);

  /**
   * Items are searched on the server as the user types, rather than loaded wholesale into a
   * localStorage cache.
   *
   * The first version used the shared POS item cache. It shipped with an empty picker,
   * because that cache is a single localStorage key holding the entire catalogue - thousands
   * of items - and every way it can fail (quota exceeded, never populated, cleared) surfaced
   * here as a silent empty list with no error and no way to retry.
   *
   * /items/search pages on the server, so the picker cannot be defeated by catalogue size and
   * always reflects the current catalogue. A failure is shown rather than swallowed.
   */
  useEffect(() => {
    const q = itemQuery.trim();
    const timer = setTimeout(async () => {
      setItemLoading(true);
      setItemError("");
      try {
        const res = await axios.get(`/api/${tenancyId}/items/search`, {
          ...auth,
          params: { q, page: 0, size: 25 },
        });
        setItems(res.data?.content || []);
      } catch (err) {
        setItems([]);
        setItemError(t("Could not search items."));
      } finally {
        setItemLoading(false);
      }
    }, 300); // debounce: one request per pause, not per keystroke
    return () => clearTimeout(timer);
  }, [itemQuery, tenancyId, auth, t]);

  const selectedReason = useMemo(
    () => reasons.find((r) => r.code === reasonCode),
    [reasons, reasonCode]
  );
  const remarksRequired = Boolean(selectedReason?.requires_remarks);

  const setRow = (key, patch) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (key) =>
    setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((r) => r.key !== key)));

  const rateOf = (row) =>
    Number(row.selectedItem?.purchaseRate ?? row.selectedItem?.purchase_rate ?? 0) || 0;

  const amountOf = (row) => {
    const q = Number(row.qty);
    return Number.isFinite(q) && q > 0 ? q * rateOf(row) : 0;
  };

  const filledRows = rows.filter((r) => r.selectedItem && String(r.qty).trim() !== "");

  const totals = useMemo(() => {
    const qty = filledRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const value = filledRows.reduce((s, r) => s + amountOf(r), 0);
    return { qty, value };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const money = (n) =>
    (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const reset = () => {
    setRows([emptyRow()]);
    setReasonCode("");
    setRemarks("");
    setVoucher(null);
    // The next voucher is a different event and must not reuse the submitted one's id, or
    // the server would return the voucher just recorded instead of creating a new one.
    txnIdRef.current = null;
  };

  const submit = useCallback(
    async (isSubmit) => {
      setMessage({ text: "", severity: "info" });

      if (!branch) {
        setMessage({ text: t("Select a branch"), severity: "warning" });
        return;
      }

      if (isSubmit) {
        if (!reasonCode) {
          setMessage({ text: t("Select a reason"), severity: "warning" });
          return;
        }
        if (remarksRequired && !remarks.trim()) {
          setMessage({ text: t("Remarks are required when the reason is OTHER"), severity: "warning" });
          return;
        }
        if (filledRows.length === 0) {
          setMessage({ text: t("Add at least one item line"), severity: "warning" });
          return;
        }
        // Same helper the stock screens use, so a scanned barcode is caught here rather than
        // by ck_wastage_dtl_qty_sane after the whole form has been filled in.
        const bad = firstQuantityError(filledRows, (r) => r.qty);
        if (bad) {
          setMessage({ text: `${t("Line")} ${bad.index + 1}: ${bad.error}`, severity: "error" });
          return;
        }
      }

      if (!txnIdRef.current) txnIdRef.current = `${branch}-${nextTxnId()}`;

      const payload = {
        id: voucher?.id || null,
        branch_code: branch,
        voucher_date: voucherDate,
        reason_code: reasonCode || null,
        remarks: remarks || null,
        submit: isSubmit,
        // Stable for this voucher, so a retry after a timeout returns the original rather
        // than posting a second write-off for the same event.
        client_txn_id: txnIdRef.current,
        lines: filledRows.map((r) => ({
          item_id: r.selectedItem?.itemId || r.selectedItem?.item_id,
          item_code: r.selectedItem?.itemCode || r.selectedItem?.item_code,
          item_name: r.selectedItem?.itemName || r.selectedItem?.item_name,
          barcode: r.selectedItem?.barcode,
          unit: r.selectedItem?.unitName || r.selectedItem?.unit_name,
          qty: Number(r.qty),
          batch: r.batch || null,
          reason_code: r.reasonCode || null,
          description: r.description || null,
        })),
      };

      setSaving(true);
      try {
        const res = await axios.post(`/api/${tenancyId}/wastage`, payload, auth);
        setVoucher(res.data);
        if (isSubmit) {
          setMessage({
            text: `${t("Wastage recorded")} — ${res.data.voucher_number} (${res.data.status})`,
            severity: "success",
          });
          reset();
        } else {
          setMessage({ text: t("Draft saved"), severity: "success" });
        }
      } catch (err) {
        // The server names the offending line and says why; showing its message is more use
        // than a generic failure notice.
        const detail = err?.response?.data?.error;
        setMessage({ text: detail || t("Could not save. Try again."), severity: "error" });
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branch, voucherDate, reasonCode, remarks, rows, voucher, tenancyId, auth, t]
  );

  const headCell = { color: "#fff", fontWeight: 700 };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>
        {t("Wastage Entry")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("Record what was thrown away and why. Values are at cost.")}
      </Typography>

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "info" })}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <FormControl sx={{ minWidth: 160 }} size="small">
            <InputLabel>{t("Branch")}</InputLabel>
            <Select value={branch} label={t("Branch")} onChange={(e) => setBranch(e.target.value)}>
              {branches.map((b) => (
                // Branch code alone - every branch shares one branch_name, so the name
                // distinguishes nothing and only adds width.
                <MenuItem key={b.branchCode} value={b.branchCode}>
                  {b.branchCode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label={t("Date")}
            value={voucherDate}
            onChange={(e) => setVoucherDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            // Wastage is a same-shift record; the server enforces the same limit.
            inputProps={{ max: new Date().toISOString().slice(0, 10) }}
            sx={{ minWidth: 170 }}
          />

          <FormControl sx={{ minWidth: 210 }} size="small">
            <InputLabel>{t("Reason")}</InputLabel>
            <Select value={reasonCode} label={t("Reason")} onChange={(e) => setReasonCode(e.target.value)}>
              {reasons.map((r) => (
                <MenuItem key={r.code} value={r.code}>
                  {r.code.replace(/_/g, " ")}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            fullWidth
            label={remarksRequired ? `${t("Remarks")} *` : t("Remarks")}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            required={remarksRequired}
            helperText={remarksRequired ? t("Required when the reason is OTHER") : " "}
          />
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={{ ...headCell, width: "30%" }}>{t("Item")}</TableCell>
              <TableCell sx={{ ...headCell, width: 110 }} align="right">{t("Quantity")}</TableCell>
              <TableCell sx={{ ...headCell, width: 80 }}>{t("Unit")}</TableCell>
              <TableCell sx={{ ...headCell, width: 110 }} align="right">{t("Cost")}</TableCell>
              <TableCell sx={{ ...headCell, width: 120 }} align="right">{t("Value")}</TableCell>
              <TableCell sx={{ ...headCell, width: 120 }}>{t("Batch")}</TableCell>
              <TableCell sx={{ ...headCell, width: 170 }}>{t("Reason (optional)")}</TableCell>
              <TableCell sx={{ ...headCell, width: 56 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => {
              const q = String(row.qty).trim() === "" ? null : checkQuantity(row.qty);
              return (
                <TableRow key={row.key}>
                  <TableCell>
                    <Autocomplete
                      size="small"
                      options={items}
                      value={row.selectedItem}
                      loading={itemLoading}
                      onChange={(_, v) => setRow(row.key, { selectedItem: v })}
                      onInputChange={(_, v, why) => {
                        // Only a typed query drives a search. "reset" fires when a value is
                        // picked, and re-searching on it would replace the option list with
                        // results for the item just chosen.
                        if (why === "input") setItemQuery(v);
                      }}
                      // The server has already filtered; filtering again on the client would
                      // hide results whose match is in a field the label does not show.
                      filterOptions={(x) => x}
                      noOptionsText={
                        itemError || (itemQuery ? t("No items match") : t("Type to search items"))
                      }
                      getOptionLabel={(o) =>
                        o ? `${o.itemName || ""}${o.itemCode ? ` (${o.itemCode})` : ""}` : ""
                      }
                      isOptionEqualToValue={(o, v) => o.itemId === v?.itemId}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder={t("Search item")}
                          error={Boolean(itemError)}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {itemLoading ? <CircularProgress size={16} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </TableCell>

                  <TableCell align="right">
                    <TextField
                      size="small"
                      value={row.qty}
                      onChange={(e) => setRow(row.key, { qty: e.target.value })}
                      error={Boolean(q && !q.ok)}
                      helperText={q && !q.ok ? q.error : " "}
                      inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>

                  <TableCell>
                    {row.selectedItem?.unitName || row.selectedItem?.unit_name || "—"}
                  </TableCell>

                  {/* Read-only: the server resolves cost and overwrites anything sent. */}
                  <TableCell align="right">{rateOf(row) ? money(rateOf(row)) : "—"}</TableCell>
                  <TableCell align="right">{amountOf(row) ? money(amountOf(row)) : "—"}</TableCell>

                  <TableCell>
                    <TextField
                      size="small"
                      value={row.batch}
                      onChange={(e) => setRow(row.key, { batch: e.target.value })}
                      sx={{ width: 110 }}
                    />
                  </TableCell>

                  <TableCell>
                    <FormControl size="small" sx={{ width: 160 }}>
                      <Select
                        displayEmpty
                        value={row.reasonCode}
                        onChange={(e) => setRow(row.key, { reasonCode: e.target.value })}
                      >
                        {/* One event can spoil some items and merely damage others; forcing
                            two vouchers for that would misrepresent one event as two. */}
                        <MenuItem value="">
                          <em>{t("Same as voucher")}</em>
                        </MenuItem>
                        {reasons.map((r) => (
                          <MenuItem key={r.code} value={r.code}>
                            {r.code.replace(/_/g, " ")}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>

                  <TableCell>
                    <IconButton size="small" onClick={() => removeRow(row.key)} aria-label={t("Remove line")}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} sx={{ mb: 2 }}>
        <Button startIcon={<AddIcon />} onClick={addRow} size="small">
          {t("Add line")}
        </Button>

        <Box sx={{ flexGrow: 1 }} />

        <Chip label={`${t("Total quantity")}: ${totals.qty}`} />
        <Chip color="primary" label={`${t("Total value")}: ${money(totals.value)}`} />
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center">
        <Button variant="outlined" onClick={() => submit(false)} disabled={saving || !branch}>
          {t("Save draft")}
        </Button>
        <Button variant="contained" onClick={() => submit(true)} disabled={saving || !branch}>
          {saving ? <CircularProgress size={22} /> : t("Submit")}
        </Button>
        {voucher?.voucher_number && (
          <Typography variant="body2" color="text.secondary">
            {voucher.voucher_number} — {voucher.status}
          </Typography>
        )}
        {itemError && (
          <Typography variant="body2" color="error">
            {itemError}
          </Typography>
        )}
      </Stack>
    </Box>
  );
};

export default WastageEntry;
