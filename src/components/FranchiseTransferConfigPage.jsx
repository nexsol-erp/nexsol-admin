import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Grid, Paper, Typography, Button, TextField, MenuItem,
  FormControl, InputLabel, Select, Switch, FormControlLabel,
  CircularProgress, Alert, Divider, Chip, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import { Save as SaveIcon, Refresh as RefreshIcon, Settings as SettingsIcon } from "@mui/icons-material";

const API = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  return {
    base:    `/api/${tenancyId}`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
};

const emptyConfig = {
  allowStockTransfer:    false,
  allowedSourceBranches: "",
  allowedTargetBranches: "",
  allowedItemCategories: "",
  transferPriceRule:     "COST_PRICE",
  customPricePct:        "",
  requiresApproval:      false,
  approverUserCode:       "",
  creditLimitCheck:      false,
  outstandingCheck:      false,
  maxTransferValue:      "",
  effectiveFrom:         "",
  effectiveTo:           "",
  notes:                 "",
};

const PRICE_RULES = [
  { value: "COST_PRICE", label: "Cost Price" },
  { value: "MRP",        label: "MRP" },
  { value: "CUSTOM",     label: "Custom %" },
];

const FIELD_SX = { "& .MuiInputBase-root": { fontSize: 13 } };

export default function FranchiseTransferConfigPage() {
  const [franchises,   setFranchises]   = useState([]);
  const [selectedFr,   setSelectedFr]   = useState("");
  const [config,       setConfig]       = useState(null);
  const [form,         setForm]         = useState(emptyConfig);
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [resyncing,    setResyncing]    = useState(false);
  const [msg,          setMsg]          = useState(null);

  const { base, headers } = API();

  // ── Load franchise list ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${base}/franchise`, { headers })
      .then((r) => r.json())
      .then((data) => setFranchises(Array.isArray(data) ? data : data.franchises || data.content || []))
      .catch((e) => console.error("Failed to load franchises:", e));
  }, []);

  // ── Load config when franchise selected ───────────────────────────────────
  const loadConfig = useCallback(async (franchiseId) => {
    if (!franchiseId) return;
    setLoading(true);
    setConfig(null);
    try {
      const res = await fetch(`${base}/franchise-transfer-config/${franchiseId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setForm({
          allowStockTransfer:    data.allowStockTransfer    ?? false,
          allowedSourceBranches: data.allowedSourceBranches ?? "",
          allowedTargetBranches: data.allowedTargetBranches ?? "",
          allowedItemCategories: data.allowedItemCategories ?? "",
          transferPriceRule:     data.transferPriceRule     ?? "COST_PRICE",
          customPricePct:        data.customPricePct        ?? "",
          requiresApproval:      data.requiresApproval      ?? false,
          approverUserCode:       data.approverUserCode       ?? "",
          creditLimitCheck:      data.creditLimitCheck      ?? false,
          outstandingCheck:      data.outstandingCheck      ?? false,
          maxTransferValue:      data.maxTransferValue      ?? "",
          effectiveFrom:         data.effectiveFrom         ?? "",
          effectiveTo:           data.effectiveTo           ?? "",
          notes:                 data.notes                 ?? "",
        });
      } else if (res.status === 204) {
        setConfig(null);
        setForm(emptyConfig);
      }
    } catch (e) {
      setMsg({ type: "error", text: "Failed to load config: " + e.message });
    } finally {
      setLoading(false);
    }
  }, [base]);

  const handleFranchiseChange = (e) => {
    const val = e.target.value;
    setSelectedFr(val);
    const fr = franchises.find((f) => f.id === val || String(f.id) === String(val));
    if (fr) loadConfig(fr.id);
  };

  const handleSave = async () => {
    const fr = franchises.find((f) => String(f.id) === String(selectedFr) || f.id === selectedFr);
    if (!fr) return;
    setSaving(true);
    setMsg(null);
    try {
      const userId = localStorage.getItem("userId") || "system";
      const body = {
        ...form,
        customPricePct:   form.customPricePct  ? Number(form.customPricePct)  : null,
        maxTransferValue: form.maxTransferValue ? Number(form.maxTransferValue) : null,
        effectiveFrom:    form.effectiveFrom || null,
        effectiveTo:      form.effectiveTo   || null,
        allowedSourceBranches: form.allowedSourceBranches || null,
        allowedTargetBranches: form.allowedTargetBranches || null,
        allowedItemCategories: form.allowedItemCategories || null,
        approverUserCode:       form.approverUserCode || null,
        notes:            form.notes || null,
      };
      const res = await fetch(`${base}/franchise-transfer-config/${fr.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }
      const saved = await res.json();
      setConfig(saved);
      setMsg({ type: "success", text: "Configuration saved successfully." });
    } catch (e) {
      setMsg({ type: "error", text: "Save failed: " + e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleResyncBranches = async () => {
    const fr = franchises.find((f) => String(f.id) === String(selectedFr) || f.id === selectedFr);
    if (!fr) return;
    setResyncing(true);
    setMsg(null);
    try {
      const res = await fetch(`${base}/franchise/${fr.id}/resync-branches`, {
        method: "POST",
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || res.statusText);
      }
      const data = await res.json();
      setMsg({
        type: "success",
        text: `Synced ${data.branchesSynced ?? 0} master branch(es) into this franchise's POS.`,
      });
    } catch (e) {
      setMsg({ type: "error", text: "Resync failed: " + e.message });
    } finally {
      setResyncing(false);
    }
  };

  const set = (field) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [field]: val }));
  };
  const setSwitch = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.checked }));

  const selectedFranchise = franchises.find((f) => String(f.id) === String(selectedFr) || f.id === selectedFr);

  return (
    <Box sx={{ p: 2 }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <SettingsIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Franchise Transfer Config
        </Typography>
      </Box>

      {/* ── Franchise selector ──────────────────────────────────────────── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5}>
            <FormControl fullWidth size="small">
              <InputLabel>Select Franchise</InputLabel>
              <Select
                value={selectedFr}
                label="Select Franchise"
                onChange={handleFranchiseChange}
              >
                {franchises.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.franchiseCode} - {f.franchiseName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {selectedFranchise && (
            <Grid item xs={12} sm={7}>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip size="small" label={selectedFranchise.franchiseType || "STANDARD"} color="primary" />
                <Chip size="small" label={selectedFranchise.status || "—"} color={selectedFranchise.status === "ACTIVE" ? "success" : "default"} />
                {selectedFranchise.city && <Chip size="small" label={selectedFranchise.city} variant="outlined" />}
              </Stack>
            </Grid>
          )}
        </Grid>
      </Paper>

      {loading && <CircularProgress size={28} sx={{ display: "block", mx: "auto", my: 2 }} />}

      {msg && (
        <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* ── Config form ─────────────────────────────────────────────────── */}
      {selectedFr && !loading && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Stock Transfer Settings
            {config && (
              <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                (last updated: {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "—"})
              </Typography>
            )}
          </Typography>

          {/* ── Enable / approval toggles ────────────────────────────────── */}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={<Switch checked={form.allowStockTransfer} onChange={setSwitch("allowStockTransfer")} color="success" />}
                label={<Typography fontSize={13}>Allow Stock Transfer</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={<Switch checked={form.requiresApproval} onChange={setSwitch("requiresApproval")} />}
                label={<Typography fontSize={13}>Requires Approval</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={<Switch checked={form.creditLimitCheck} onChange={setSwitch("creditLimitCheck")} />}
                label={<Typography fontSize={13}>Credit Limit Check</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={<Switch checked={form.outstandingCheck} onChange={setSwitch("outstandingCheck")} />}
                label={<Typography fontSize={13}>Outstanding Check</Typography>}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* ── Pricing ──────────────────────────────────────────────────── */}
          <Typography variant="subtitle2" mb={1} color="text.secondary">Pricing</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" sx={FIELD_SX}>
                <InputLabel>Transfer Price Rule</InputLabel>
                <Select value={form.transferPriceRule} label="Transfer Price Rule" onChange={set("transferPriceRule")}>
                  {PRICE_RULES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            {form.transferPriceRule === "CUSTOM" && (
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth size="small" label="Custom Price %" type="number"
                  inputProps={{ min: 0, max: 200, step: 0.01 }}
                  value={form.customPricePct}
                  onChange={set("customPricePct")}
                  sx={FIELD_SX}
                />
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Max Transfer Value (₹)" type="number"
                value={form.maxTransferValue}
                onChange={set("maxTransferValue")}
                sx={FIELD_SX}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* ── Approver + restrictions ───────────────────────────────────── */}
          <Typography variant="subtitle2" mb={1} color="text.secondary">Access & Restrictions</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Approver User Code"
                value={form.approverUserCode}
                onChange={set("approverUserCode")}
                disabled={!form.requiresApproval}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Allowed Source Branches (JSON array)"
                placeholder='["MAIN","HO"]'
                helperText="Master branches this franchise can RECEIVE stock from"
                value={form.allowedSourceBranches}
                onChange={set("allowedSourceBranches")}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Allowed Target Branches (JSON array)"
                placeholder='["MAIN","HO"]'
                helperText="Master branches this franchise can SEND stock to"
                value={form.allowedTargetBranches}
                onChange={set("allowedTargetBranches")}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth size="small" label="Allowed Item Categories (JSON array)"
                placeholder='["CAT-001","CAT-002"]'
                value={form.allowedItemCategories}
                onChange={set("allowedItemCategories")}
                sx={FIELD_SX}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* ── Branch sync ──────────────────────────────────────────────── */}
          <Typography variant="subtitle2" mb={1} color="text.secondary">Franchise POS Branch List</Typography>
          <Box display="flex" alignItems="center" gap={2}>
            <Button
              variant="outlined" size="small" startIcon={<RefreshIcon />}
              disabled={resyncing}
              onClick={handleResyncBranches}
            >
              {resyncing ? "Syncing…" : "Resync Master Branches to Franchise POS"}
            </Button>
            <Typography variant="caption" color="text.secondary">
              Pushes all current master branches into this franchise's stock-transfer
              "To Branch" dropdown. Run this if branches are missing there.
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* ── Validity + notes ──────────────────────────────────────────── */}
          <Typography variant="subtitle2" mb={1} color="text.secondary">Validity</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth size="small" type="date" label="Effective From"
                InputLabelProps={{ shrink: true }}
                value={form.effectiveFrom}
                onChange={set("effectiveFrom")}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth size="small" type="date" label="Effective To"
                InputLabelProps={{ shrink: true }}
                value={form.effectiveTo}
                onChange={set("effectiveTo")}
                sx={FIELD_SX}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Notes" multiline rows={2}
                value={form.notes}
                onChange={set("notes")}
                sx={FIELD_SX}
              />
            </Grid>
          </Grid>

          {/* ── Save button ───────────────────────────────────────────────── */}
          <Box display="flex" justifyContent="flex-end" mt={3} gap={1}>
            <Button
              variant="outlined" size="small" startIcon={<RefreshIcon />}
              onClick={() => selectedFranchise && loadConfig(selectedFranchise.id)}
            >
              Reload
            </Button>
            <Button
              variant="contained" size="small" startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Config"}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
