import React, { useEffect, useState } from "react";
import {
  Box, Button, TextField, Typography, Paper, CircularProgress,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Alert, Divider, IconButton, Stack,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AddIcon from "@mui/icons-material/Add";

// Web Admin ▸ POS Address Configuration — lets the user add/remove/edit/reorder
// the address lines printed under the shop name on the POS receipt for a
// branch, instead of the old fixed branchBuildingAddress/branchAddress1/
// branchState/branchCountry columns that buildReceiptHtml (pos-electron
// POSPage.jsx) used to concatenate blindly — which could print the same line
// twice if two of those columns held identical text. Only the POS receipt
// reads this; other print builders (stock transfer, KOT, invoices, etc.)
// still use the original BranchMst columns and are unaffected.
const PosAddressConfigPage = () => {
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]       = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected, setSelected]       = useState(null); // branchCode string
  const [lines, setLines]             = useState([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState(null); // {type, text}

  const fetchBranches = async () => {
    setLoadingList(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.branches || data.data || [];
      setBranches(list);
    } catch {
      setMessage({ type: "error", text: "Failed to load branches" });
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const selectBranch = async (branch) => {
    setSelected(branch.branchCode);
    setMessage(null);
    setLoadingLines(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/branches/${branch.branchCode}/pos-address-lines`, { headers });
      const data = await res.json();
      const existing = (Array.isArray(data) ? data : []).map((l) => l.lineText);
      // First-time setup: seed from the branch's existing fixed address fields
      // (deduplicated) so the admin isn't starting from a blank slate.
      if (existing.length) {
        setLines(existing);
      } else {
        const seed = [
          branch.branchBuildingAddress,
          branch.branchAddress1,
          branch.branchState,
          branch.branchCountry,
        ].filter(Boolean);
        setLines([...new Set(seed)]);
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load address lines" });
      setLines([]);
    } finally {
      setLoadingLines(false);
    }
  };

  const updateLine = (idx, text) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? text : l)));
  };

  const removeLine = (idx) => {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLine = () => {
    setLines((prev) => [...prev, ""]);
  };

  const moveLine = (idx, dir) => {
    setLines((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/${tenancyId}/branches/${selected}/pos-address-lines`, {
        method: "PUT", headers,
        body: JSON.stringify({ lines: lines.map((l) => l.trim()).filter(Boolean) }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const saved = await res.json();
      setLines(saved.map((l) => l.lineText));
      setMessage({ type: "success", text: `Address lines saved for "${selected}"` });
    } catch (e) {
      setMessage({ type: "error", text: "Error: " + e.message });
    } finally {
      setSaving(false);
    }
  };

  const branchName = branches.find((b) => b.branchCode === selected)?.branchName || selected;

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h4" gutterBottom>POS Address Configuration</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Controls the address lines printed under the shop name on the POS receipt for a branch.
        Add, remove, reorder, or edit lines freely — this does not change the branch's other address fields.
      </Typography>

      <Grid container spacing={3}>
        {/* ── Branch list ── */}
        <Grid item xs={12} md={4}>
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Select Branch</Typography>
            {loadingList ? (
              <Box sx={{ textAlign: "center", py: 3 }}><CircularProgress size={28} /></Box>
            ) : (
              <TableContainer sx={{ maxHeight: 520 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Code</strong></TableCell>
                      <TableCell><strong>Name</strong></TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow
                        key={b.branchCode}
                        selected={selected === b.branchCode}
                        hover sx={{ cursor: "pointer" }}
                        onClick={() => selectBranch(b)}
                      >
                        <TableCell>{b.branchCode}</TableCell>
                        <TableCell>{b.branchName || <em style={{ color: "#999" }}>—</em>}</TableCell>
                        <TableCell align="right">
                          <EditIcon fontSize="small" sx={{ color: selected === b.branchCode ? "primary.main" : "#bbb" }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Grid>

        {/* ── Editor ── */}
        <Grid item xs={12} md={8}>
          <Paper elevation={2} sx={{ p: 3 }}>
            {!selected ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                Select a branch from the list to edit its POS receipt address lines
              </Typography>
            ) : loadingLines ? (
              <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={28} /></Box>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  Edit — <strong>{branchName}</strong>
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {message && (
                  <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
                    {message.text}
                  </Alert>
                )}

                <Stack spacing={1.5}>
                  {lines.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No address lines yet — click "Add Line" below.
                    </Typography>
                  )}
                  {lines.map((line, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TextField
                        size="small" fullWidth
                        label={`Line ${idx + 1}`}
                        value={line}
                        onChange={(e) => updateLine(idx, e.target.value)}
                        inputProps={{ maxLength: 200 }}
                      />
                      <IconButton size="small" disabled={idx === 0} onClick={() => moveLine(idx, -1)}>
                        <ArrowUpwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" disabled={idx === lines.length - 1} onClick={() => moveLine(idx, 1)}>
                        <ArrowDownwardIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => removeLine(idx)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>

                <Button startIcon={<AddIcon />} onClick={addLine} sx={{ mt: 2 }}>
                  Add Line
                </Button>

                {/* ── Preview, matching how buildReceiptHtml renders these lines ── */}
                <Box sx={{ mt: 3, p: 2, background: "#fafafa", border: "1px dashed #ccc", textAlign: "center" }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                    Receipt Preview
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>{branchName}</Typography>
                  {lines.filter((l) => l.trim()).map((l, i) => (
                    <Typography key={i} variant="caption" display="block">{l}</Typography>
                  ))}
                </Box>

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained" color="primary"
                    onClick={handleSave} disabled={saving}
                    sx={{ minWidth: 140 }}
                  >
                    {saving ? <CircularProgress size={22} color="inherit" /> : "Save Changes"}
                  </Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PosAddressConfigPage;
