import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Alert, Chip, Table, TableHead,
  TableRow, TableCell, TableBody, CircularProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SettingsIcon from "@mui/icons-material/Settings";

function api(path, method = "GET") {
  const tenantId = localStorage.getItem("tenancyId");
  const token    = localStorage.getItem("jwtToken");
  return fetch(`/api/${tenantId}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
}

export default function AccountingSetup() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const loadAccounts = async () => {
    try {
      const res = await api("/ledger-accounts");
      if (res.ok) setAccounts(await res.json());
    } catch { /* silent */ }
  };

  useEffect(() => { loadAccounts(); }, []);

  const handleInitialise = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await api("/accounting-setup/initialise", "POST");
      const text = await res.text();
      if (res.ok) {
        setMsg({ type: "success", text: text || "Chart of accounts initialised successfully." });
        await loadAccounts();
      } else {
        setMsg({ type: "error", text: text || "Initialisation failed." });
      }
    } catch (e) {
      setMsg({ type: "error", text: "Request failed: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  const isInitialised = accounts.length > 0;

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>Accounting Setup</Typography>

      <Paper sx={{ p: 3, mb: 3, maxWidth: 600 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <SettingsIcon color="primary" />
          <Typography variant="h6">Initialise Chart of Accounts</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" mb={2}>
          Seeds the standard chart of accounts for this tenant — AR (1100), AP (2100),
          Sales Revenue (4000), Purchase (5200), GST accounts (2200–2202, 5100–5102),
          and voucher types. Safe to run multiple times; existing accounts are not overwritten.
        </Typography>

        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Chip
            label={isInitialised ? `${accounts.length} accounts configured` : "Not initialised"}
            color={isInitialised ? "success" : "warning"}
            icon={isInitialised ? <CheckCircleIcon /> : undefined}
          />
        </Box>

        {msg && (
          <Alert severity={msg.type} sx={{ mb: 2 }} onClose={() => setMsg(null)}>
            {msg.text}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleInitialise}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <SettingsIcon />}
        >
          {loading ? "Initialising…" : "Initialise Chart of Accounts"}
        </Button>
      </Paper>

      {accounts.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Current Chart of Accounts ({accounts.length})</Typography>
          <Table size="small">
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                {["Code", "Account Name", "Type", "Group", "Cash", "Bank"].map((h) => (
                  <TableCell key={h} sx={{ color: "white" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell><b>{a.accountCode}</b></TableCell>
                  <TableCell>{a.accountName}</TableCell>
                  <TableCell><Chip label={a.accountType} size="small" /></TableCell>
                  <TableCell>{a.groupName || "—"}</TableCell>
                  <TableCell>{a.isCash ? "✓" : ""}</TableCell>
                  <TableCell>{a.isBank ? "✓" : ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
