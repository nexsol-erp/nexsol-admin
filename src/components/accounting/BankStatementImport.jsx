import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, Chip, CircularProgress, IconButton,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  getLedgerAccounts, importBankStatement, getBankStatementImports, deleteBankStatementImport,
} from "./accountingApi";

/**
 * Upload an ICICI/Axis statement PDF and see whether it was accepted - backlog #33/#36.
 *
 * Deliberately minimal: counterparty resolution (#37) and the daily Excel report (#38) are
 * separate tickets. This exists to drive the parser end-to-end, not to be the final screen.
 */
const money = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 }));

export default function BankStatementImport() {
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [imports, setImports] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts((Array.isArray(d) ? d : []).filter((a) => a.bank)));
  }, []);

  const loadImports = useCallback(() => {
    if (!accountId) { setImports([]); return; }
    getBankStatementImports(accountId).then((d) => setImports(Array.isArray(d) ? d : []));
  }, [accountId]);

  useEffect(() => { loadImports(); }, [loadImports]);

  const handleUpload = async () => {
    if (!accountId || !file) return;
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const res = await importBankStatement(accountId, file);
      setResult(res);
      setFile(null);
      loadImports();
    } catch (e) {
      setError(e.message || "Import failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imp) => {
    if (!window.confirm(`Delete this import (${imp.sourceFilename}, ${imp.rowCount} row(s))? This cannot be undone.`)) return;
    setDeletingId(imp.id);
    setError("");
    try {
      await deleteBankStatementImport(imp.id, accountId);
      loadImports();
    } catch (e) {
      setError(e.message || "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const headCell = { color: "#fff", fontWeight: 700 };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Bank Statement Import</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload an ICICI or Axis statement PDF. The account's configured bank decides which parser runs.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            select label="Bank Account" value={accountId}
            onChange={(e) => { setAccountId(e.target.value); setResult(null); setError(""); }}
            sx={{ width: 280 }}
          >
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>
                {a.accountName}{a.bankName ? ` (${a.bankName})` : " — no bank configured"}
              </MenuItem>
            ))}
          </TextField>

          <Button variant="outlined" component="label" disabled={!accountId}>
            {file ? file.name : "Choose PDF"}
            <input type="file" accept="application/pdf" hidden
                   onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </Button>

          <Button variant="contained" onClick={handleUpload} disabled={!accountId || !file || uploading}>
            {uploading ? <CircularProgress size={22} /> : "Upload"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      {result && (
        <Alert severity={result.status === "IMPORTED" ? "success" : "warning"} sx={{ mb: 2 }}>
          {result.alreadyImported && <strong>Already imported. </strong>}
          {result.status === "IMPORTED"
            ? `Imported ${result.rowCount} row(s), ${result.periodFrom} to ${result.periodTo}.`
            : `Rejected: ${result.failureReason}`}
        </Alert>
      )}

      <Paper sx={{ p: 1 }}>
        <Typography variant="subtitle2" sx={{ p: 1 }}>Recent imports for this account</Typography>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              <TableCell sx={headCell}>File</TableCell>
              <TableCell sx={headCell}>Period</TableCell>
              <TableCell sx={headCell} align="right">Rows</TableCell>
              <TableCell sx={headCell} align="right">Opening</TableCell>
              <TableCell sx={headCell} align="right">Closing</TableCell>
              <TableCell sx={headCell}>Status</TableCell>
              <TableCell sx={headCell}>Imported</TableCell>
              <TableCell sx={{ ...headCell, width: 48 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {imports.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 3, color: "text.secondary" }}>
                No imports yet for this account.
              </TableCell></TableRow>
            )}
            {imports.map((i) => (
              <TableRow key={i.id} hover>
                <TableCell>{i.sourceFilename}</TableCell>
                <TableCell>{i.periodFrom} – {i.periodTo}</TableCell>
                <TableCell align="right">{i.rowCount}</TableCell>
                <TableCell align="right">{money(i.openingBalance)}</TableCell>
                <TableCell align="right">{money(i.closingBalance)}</TableCell>
                <TableCell>
                  <Chip size="small" label={i.status}
                        color={i.status === "IMPORTED" ? "success" : "error"} />
                </TableCell>
                <TableCell>{(i.importedAt || "").replace("T", " ").slice(0, 16)}</TableCell>
                <TableCell>
                  <IconButton size="small" color="error" disabled={deletingId === i.id}
                              onClick={() => handleDelete(i)} aria-label="Delete import">
                    {deletingId === i.id ? <CircularProgress size={18} /> : <DeleteOutlineIcon fontSize="small" />}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
