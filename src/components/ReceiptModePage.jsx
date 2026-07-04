import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Alert,
  IconButton,
  Chip,
  Autocomplete,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const ReceiptModePage = () => {
  const [modes, setModes] = useState([]);
  const [newMode, setNewMode] = useState("");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountOptions, setAccountOptions] = useState([]);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountLoading, setAccountLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchModes = async () => {
    try {
      const res = await fetch(`/api/${tenancyId}/receipt-modes`, { headers });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setModes(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load receipt modes.");
    }
  };

  useEffect(() => { fetchModes(); }, []);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      if (accountSearch.length < 1) { setAccountOptions([]); return; }
      setAccountLoading(true);
      try {
        const res = await fetch(
          `/api/${tenancyId}/ledger-accounts?search=${encodeURIComponent(accountSearch)}&accountType=ASSET`,
          { headers }
        );
        const data = await res.json();
        setAccountOptions(Array.isArray(data) ? data : []);
      } catch {
        setAccountOptions([]);
      } finally {
        setAccountLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [accountSearch]);

  const handleAdd = async () => {
    setError(""); setSuccess("");
    if (!newMode.trim()) { setError("Enter a receipt mode name."); return; }
    if (!selectedAccount) { setError("Select a GL account for this receipt mode."); return; }
    try {
      const res = await fetch(`/api/${tenancyId}/receipt-modes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          receiptMode: newMode.trim(),
          glAccountCode: selectedAccount.accountCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to add receipt mode."); return; }
      setSuccess(`"${data.receiptMode}" added — GL account: ${selectedAccount.accountCode} ${selectedAccount.accountName}`);
      setNewMode("");
      setSelectedAccount(null);
      setAccountSearch("");
      fetchModes();
    } catch {
      setError("An error occurred.");
    }
  };

  const handleDelete = async (id, modeName) => {
    if (!window.confirm(`Delete receipt mode "${modeName}"?`)) return;
    setError(""); setSuccess("");
    try {
      const res = await fetch(`/api/${tenancyId}/receipt-modes/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) { setError("Failed to delete."); return; }
      setSuccess(`"${modeName}" deleted.`);
      fetchModes();
    } catch {
      setError("An error occurred.");
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 620 }}>
        <Typography variant="h5" gutterBottom>Receipt Mode Setup</Typography>
        {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Receipt Mode Name"
            size="small"
            value={newMode}
            onChange={(e) => setNewMode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            fullWidth
          />

          <Autocomplete
            size="small"
            options={accountOptions}
            value={selectedAccount}
            onChange={(_, val) => setSelectedAccount(val)}
            inputValue={accountSearch}
            onInputChange={(_, val) => setAccountSearch(val)}
            getOptionLabel={(opt) => `${opt.accountCode} — ${opt.accountName}`}
            isOptionEqualToValue={(opt, val) => opt.accountCode === val?.accountCode}
            loading={accountLoading}
            noOptionsText={accountSearch.length < 1 ? "Type to search accounts…" : "No accounts found"}
            renderInput={(params) => (
              <TextField
                {...params}
                label="GL Account (search by code or name)"
                placeholder="e.g. Cash in Hand, 1001"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {accountLoading ? <CircularProgress color="inherit" size={16} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            fullWidth
          />

          <Button variant="contained" onClick={handleAdd} sx={{ alignSelf: "flex-start" }}>
            Add Receipt Mode
          </Button>
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ padding: 4, maxWidth: 620, mt: 4 }}>
        <Typography variant="h6" gutterBottom>Existing Receipt Modes</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Receipt Mode</TableCell>
              <TableCell>GL Account Code</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {modes.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.receiptMode}</TableCell>
                <TableCell>{m.glAccountCode || <span style={{ color: "#999" }}>—</span>}</TableCell>
                <TableCell>
                  <Chip
                    label={m.status || "ACTIVE"}
                    color={m.status === "ACTIVE" ? "success" : "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton color="error" size="small" onClick={() => handleDelete(m.id, m.receiptMode)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {modes.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: "text.secondary" }}>
                  No receipt modes configured
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ReceiptModePage;
