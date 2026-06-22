import React, { useState, useEffect } from "react";
import {
  Box, Typography, TextField, MenuItem, Button, Paper, Table, TableHead,
  TableRow, TableCell, TableBody, Alert, Chip, Divider, Tabs, Tab,
} from "@mui/material";
import { getLedgerAccounts, runDayEnd, runMonthEnd, runYearEnd, getPeriodCloseHistory } from "./accountingApi";

export default function PeriodClosing() {
  const [tab, setTab]           = useState(0);
  const [accounts, setAccounts] = useState([]);
  const [date, setDate]         = useState(new Date().toISOString().split("T")[0]);
  const [reAccount, setReAccount] = useState("");
  const [result, setResult]     = useState(null);
  const [history, setHistory]   = useState([]);
  const [msg, setMsg]           = useState(null);

  useEffect(() => {
    getLedgerAccounts().then((d) => {
      const equityAccounts = (Array.isArray(d) ? d : []).filter((a) => a.accountType === "EQUITY");
      setAccounts(equityAccounts);
    });
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const data = await getPeriodCloseHistory();
    setHistory(Array.isArray(data) ? data : []);
  };

  const handle = async (fn) => {
    try {
      const res = await fn();
      setResult(res);
      setMsg({ type: "success", text: res.message });
      loadHistory();
    } catch (e) {
      setMsg({ type: "error", text: "Operation failed: " + (e.message || "") });
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Period Closing</Typography>
      {msg && <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Day End" />
        <Tab label="Month End" />
        <Tab label="Year End" />
        <Tab label="History" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 3, maxWidth: 500 }}>
          <Typography variant="subtitle1" gutterBottom>Day End Closing</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Marks the selected date as day-end closed. Idempotent — running twice on the same date is blocked.
          </Typography>
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth sx={{ mb: 2 }} />
          <Button variant="contained" color="primary" onClick={() => handle(() => runDayEnd(date))}>
            Run Day End
          </Button>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 3, maxWidth: 500 }}>
          <Typography variant="subtitle1" gutterBottom>Month End Closing</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Marks the selected period-end date as month-end closed.
          </Typography>
          <TextField label="Period End Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth sx={{ mb: 2 }} />
          <Button variant="contained" color="warning" onClick={() => handle(() => runMonthEnd(date))}>
            Run Month End
          </Button>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 3, maxWidth: 600 }}>
          <Typography variant="subtitle1" gutterBottom>Year End Closing</Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Posts a closing journal that zeroes out all Income and Expense accounts and transfers the net profit to Retained Earnings. Cannot be reversed.
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField label="FY End Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField select label="Retained Earnings Account" value={reAccount} onChange={(e) => setReAccount(e.target.value)}>
              {accounts.map((a) => <MenuItem key={a.id} value={a.id}>{a.accountName}</MenuItem>)}
            </TextField>
            <Button variant="contained" color="error" disabled={!reAccount}
              onClick={() => handle(() => runYearEnd(date, reAccount))}>
              Run Year End Closing
            </Button>
          </Box>
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Close History</Typography>
          <Table size="small">
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Type", "Period Date", "Entries", "Status", "Closed By", "Closed At", "Notes"].map((h) => (
                  <TableCell key={h} sx={{ color: "white" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((h, i) => (
                <TableRow key={i} hover>
                  <TableCell><Chip size="small" label={h.closeType} color={h.closeType === "YEAR_END" ? "error" : h.closeType === "MONTH_END" ? "warning" : "info"} /></TableCell>
                  <TableCell>{h.periodDate}</TableCell>
                  <TableCell>{h.entriesPosted}</TableCell>
                  <TableCell><Chip size="small" label={h.status} color="success" /></TableCell>
                  <TableCell>{h.closedBy}</TableCell>
                  <TableCell>{h.closedAt ? new Date(h.closedAt).toLocaleString() : ""}</TableCell>
                  <TableCell>{h.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {result && (
        <Box mt={2}>
          <Chip label={`${result.closeType} — ${result.periodDate} — ${result.entriesPosted} entries`} color="success" />
          {result.voucherNumber && <Chip label={`Voucher: ${result.voucherNumber}`} sx={{ ml: 1 }} />}
        </Box>
      )}
    </Box>
  );
}
