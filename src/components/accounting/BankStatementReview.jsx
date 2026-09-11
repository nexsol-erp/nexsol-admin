import React, { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, Checkbox, CircularProgress, Autocomplete,
} from "@mui/material";
import {
  getLedgerAccounts, getUnresolvedStatements, resolveCounterpartyManually, resolveCounterparties,
  getKnownCounterparties, TXN_CATEGORIES,
} from "./accountingApi";

/**
 * Backlog #37's "a review screen should let a correction optionally become a new rule" -
 * everything here is UNRESOLVED (never a guessed name), one row at a time.
 */
const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

const emptyDraft = (narration) => ({
  counterparty: "", txnCategory: "", saveAsRule: false,
  pattern: (narration || "").split("/").find((p) => p.length > 3) || narration || "",
  matchType: "CONTAINS",
});

export default function BankStatementReview() {
  const [accounts, setAccounts] = useState([]);
  const [counterpartyOptions, setCounterpartyOptions] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts((Array.isArray(d) ? d : []).filter((a) => a.bank)));
    getKnownCounterparties().then((d) => setCounterpartyOptions(Array.isArray(d) ? d : []));
  }, []);

  const load = useCallback(() => {
    if (!accountId) { setRows([]); return; }
    getUnresolvedStatements(accountId).then((d) => {
      const list = Array.isArray(d) ? d : [];
      setRows(list);
      setDrafts(Object.fromEntries(list.map((r) => [r.id, emptyDraft(r.description)])));
    });
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const setDraft = (id, patch) => setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const handleResolveAll = async () => {
    setResolving(true);
    setError("");
    try {
      await resolveCounterparties();
      load();
    } catch (e) {
      setError(e.message || "Resolution failed.");
    } finally {
      setResolving(false);
    }
  };

  const handleSave = async (row) => {
    const draft = drafts[row.id];
    if (!draft.counterparty && !draft.txnCategory) {
      setError("Set a counterparty, a category, or both.");
      return;
    }
    if (draft.saveAsRule && !draft.pattern) {
      setError("A pattern is required to save this as a rule.");
      return;
    }
    setSavingId(row.id);
    setError("");
    try {
      const res = await resolveCounterpartyManually(row.id, draft);
      if (res?.error) throw new Error(res.error);
      setRows((rs) => rs.filter((r) => r.id !== row.id));
    } catch (e) {
      setError(e.message || "Save failed.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Bank Statement Review</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lines counterparty resolution couldn't place. Correct one at a time, and optionally save
        the correction as a rule so future imports resolve it automatically.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField select label="Bank Account" value={accountId}
                     onChange={(e) => setAccountId(e.target.value)} sx={{ width: 280 }}>
            {accounts.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={handleResolveAll} disabled={resolving}>
            {resolving ? <CircularProgress size={22} /> : "Re-run Resolution"}
          </Button>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}

      <Paper sx={{ p: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#1976d2" }}>
              {["Date", "Narration", "Debit", "Credit", "Counterparty", "Category", "Save as rule", ""].map((h) => (
                <TableCell key={h} sx={{ color: "#fff", fontWeight: 700 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                {accountId ? "Nothing unresolved for this account." : "Choose an account."}
              </TableCell></TableRow>
            )}
            {rows.map((r) => {
              const d = drafts[r.id] || emptyDraft(r.description);
              return (
                <TableRow key={r.id} hover>
                  <TableCell>{r.statementDate}</TableCell>
                  <TableCell sx={{ maxWidth: 260, fontSize: 12 }}>{r.description}</TableCell>
                  <TableCell align="right">{r.debitAmount > 0 ? money(r.debitAmount) : ""}</TableCell>
                  <TableCell align="right">{r.creditAmount > 0 ? money(r.creditAmount) : ""}</TableCell>
                  <TableCell>
                    <Autocomplete
                      freeSolo size="small" sx={{ width: 170 }}
                      options={counterpartyOptions}
                      value={d.counterparty}
                      onInputChange={(_, v) => setDraft(r.id, { counterparty: v })}
                      renderInput={(params) => <TextField {...params} />}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField select size="small" value={d.txnCategory} sx={{ width: 150 }}
                               onChange={(e) => setDraft(r.id, { txnCategory: e.target.value })}>
                      <MenuItem value=""><em>None</em></MenuItem>
                      {TXN_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <Checkbox size="small" checked={d.saveAsRule}
                                onChange={(e) => setDraft(r.id, { saveAsRule: e.target.checked })} />
                      {d.saveAsRule && (
                        <TextField size="small" value={d.pattern} placeholder="pattern"
                                   onChange={(e) => setDraft(r.id, { pattern: e.target.value })} sx={{ width: 140 }} />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Button size="small" variant="contained" disabled={savingId === r.id}
                            onClick={() => handleSave(r)}>
                      {savingId === r.id ? <CircularProgress size={16} /> : "Save"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
