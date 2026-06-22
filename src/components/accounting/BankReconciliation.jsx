import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Table, TableHead,
  TableRow, TableCell, TableBody, Paper, Chip, Alert, Tabs, Tab, Divider,
} from "@mui/material";
import {
  getLedgerAccounts, getBankStatements, getUnmatchedStatements,
  getUnmatchedGlEntries, matchReconciliation, unmatchReconciliation,
  getBankReconciliationSummary, createBankStatement,
} from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

export default function BankReconciliation() {
  const [tab, setTab]           = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");
  const [stmtLines, setStmtLines] = useState([]);
  const [glLines, setGlLines]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [selectedStmt, setSelectedStmt] = useState(null);
  const [selectedGl, setSelectedGl]     = useState(null);
  const [msg, setMsg]           = useState(null);
  const [newStmt, setNewStmt]   = useState({ description: "", debitAmount: "", creditAmount: "", referenceNumber: "", statementDate: "" });

  useEffect(() => {
    getLedgerAccounts().then((d) => setAccounts((Array.isArray(d) ? d : []).filter((a) => a.isBank)));
  }, []);

  const load = async () => {
    if (!accountId || !from || !to) return;
    const [stmts, gls, sum] = await Promise.all([
      getUnmatchedStatements(accountId, from, to),
      getUnmatchedGlEntries(accountId, from, to),
      getBankReconciliationSummary(accountId, to),
    ]);
    setStmtLines(Array.isArray(stmts) ? stmts : []);
    setGlLines(Array.isArray(gls) ? gls : []);
    setSummary(sum);
  };

  const handleMatch = async () => {
    if (!selectedStmt || !selectedGl) return;
    try {
      await matchReconciliation({ bankStatementId: selectedStmt, ledgerTransactionId: selectedGl, notes: "" });
      setMsg({ type: "success", text: "Matched successfully." });
      setSelectedStmt(null); setSelectedGl(null);
      load();
    } catch { setMsg({ type: "error", text: "Match failed." }); }
  };

  const handleUnmatch = async (stmtId) => {
    await unmatchReconciliation(stmtId);
    setMsg({ type: "success", text: "Unmatched." });
    load();
  };

  const handleAddStmt = async () => {
    if (!accountId || !newStmt.statementDate) return;
    try {
      await createBankStatement({ ledgerAccountId: accountId, ...newStmt, debitAmount: Number(newStmt.debitAmount || 0), creditAmount: Number(newStmt.creditAmount || 0) });
      setMsg({ type: "success", text: "Statement line added." });
      setNewStmt({ description: "", debitAmount: "", creditAmount: "", referenceNumber: "", statementDate: "" });
      load();
    } catch { setMsg({ type: "error", text: "Failed to add statement line." }); }
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Bank Reconciliation</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="flex-end">
          <TextField select label="Bank Account" value={accountId} onChange={(e) => setAccountId(e.target.value)} sx={{ width: 260 }}>
            {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>)}
          </TextField>
          <TextField label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} InputLabelProps={{ shrink: true }} />
          <Button variant="contained" onClick={load}>Load</Button>
        </Box>
        {summary && (
          <Box display="flex" gap={2} mt={2} flexWrap="wrap">
            <Chip label={`GL Balance: ₹ ${fmt(summary.glClosingBalance)}`} color="primary" />
            <Chip label={`Statement Balance: ₹ ${fmt(summary.statementBalance)}`} color="info" />
            <Chip label={`Difference: ₹ ${fmt(summary.difference)}`} color={summary.difference == 0 ? "success" : "error"} />
            <Chip label={`Unmatched GL: ${summary.unmatchedGlCount}`} color="warning" variant="outlined" />
            <Chip label={`Unmatched Stmt: ${summary.unmatchedStatementCount}`} color="warning" variant="outlined" />
          </Box>
        )}
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Match" />
        <Tab label="Add Statement Line" />
        <Tab label="All Statements" />
      </Tabs>

      {tab === 0 && (
        <Box display="flex" gap={2}>
          <Paper sx={{ flex: 1, p: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Unmatched Bank Statement Lines</Typography>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell /><TableCell>Date</TableCell><TableCell>Description</TableCell>
                <TableCell align="right">Debit</TableCell><TableCell align="right">Credit</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {stmtLines.map((s) => (
                  <TableRow key={s.id} hover selected={selectedStmt === s.id} onClick={() => setSelectedStmt(s.id)} sx={{ cursor: "pointer" }}>
                    <TableCell><Chip size="small" label={selectedStmt === s.id ? "✓" : ""} color="primary" variant={selectedStmt === s.id ? "filled" : "outlined"} /></TableCell>
                    <TableCell>{s.statementDate}</TableCell>
                    <TableCell>{s.description}</TableCell>
                    <TableCell align="right">{s.debitAmount > 0 ? fmt(s.debitAmount) : ""}</TableCell>
                    <TableCell align="right">{s.creditAmount > 0 ? fmt(s.creditAmount) : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Box display="flex" flexDirection="column" justifyContent="center" gap={1}>
            <Button variant="contained" onClick={handleMatch} disabled={!selectedStmt || !selectedGl}>Match ↔</Button>
          </Box>

          <Paper sx={{ flex: 1, p: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Unmatched GL Entries</Typography>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell /><TableCell>Date</TableCell><TableCell>Voucher</TableCell>
                <TableCell>DR/CR</TableCell><TableCell align="right">Amount</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {glLines.map((g) => (
                  <TableRow key={g.id} hover selected={selectedGl === g.id} onClick={() => setSelectedGl(g.id)} sx={{ cursor: "pointer" }}>
                    <TableCell><Chip size="small" label={selectedGl === g.id ? "✓" : ""} color="primary" variant={selectedGl === g.id ? "filled" : "outlined"} /></TableCell>
                    <TableCell>{g.voucherDate}</TableCell>
                    <TableCell>{g.voucherNumber}</TableCell>
                    <TableCell><Chip size="small" label={g.drCr} color={g.drCr === "DR" ? "success" : "error"} /></TableCell>
                    <TableCell align="right">{fmt(g.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Box>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Add Bank Statement Line</Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            <TextField label="Date" type="date" value={newStmt.statementDate} onChange={(e) => setNewStmt({ ...newStmt, statementDate: e.target.value })} InputLabelProps={{ shrink: true }} />
            <TextField label="Description" value={newStmt.description} onChange={(e) => setNewStmt({ ...newStmt, description: e.target.value })} sx={{ flexGrow: 1 }} />
            <TextField label="Debit (OUT)" type="number" value={newStmt.debitAmount} onChange={(e) => setNewStmt({ ...newStmt, debitAmount: e.target.value })} sx={{ width: 140 }} />
            <TextField label="Credit (IN)" type="number" value={newStmt.creditAmount} onChange={(e) => setNewStmt({ ...newStmt, creditAmount: e.target.value })} sx={{ width: 140 }} />
            <TextField label="Reference" value={newStmt.referenceNumber} onChange={(e) => setNewStmt({ ...newStmt, referenceNumber: e.target.value })} sx={{ width: 160 }} />
            <Button variant="contained" onClick={handleAddStmt}>Add</Button>
          </Box>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 1 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Date", "Description", "Debit", "Credit", "Ref", "Reconciled", "Action"].map((h) => (
                  <TableCell key={h} sx={{ color: "white" }} align={["Debit", "Credit"].includes(h) ? "right" : "left"}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {stmtLines.map((s) => (
                <TableRow key={s.id} hover>
                  <TableCell>{s.statementDate}</TableCell>
                  <TableCell>{s.description}</TableCell>
                  <TableCell align="right">{s.debitAmount > 0 ? fmt(s.debitAmount) : ""}</TableCell>
                  <TableCell align="right">{s.creditAmount > 0 ? fmt(s.creditAmount) : ""}</TableCell>
                  <TableCell>{s.referenceNumber}</TableCell>
                  <TableCell><Chip size="small" label={s.reconciled ? "Yes" : "No"} color={s.reconciled ? "success" : "default"} /></TableCell>
                  <TableCell>{s.reconciled && <Button size="small" color="error" onClick={() => handleUnmatch(s.id)}>Unmatch</Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
