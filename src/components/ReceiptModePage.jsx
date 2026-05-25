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
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const ReceiptModePage = () => {
  const [modes, setModes] = useState([]);
  const [newMode, setNewMode] = useState("");
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

  const handleAdd = async () => {
    setError(""); setSuccess("");
    if (!newMode.trim()) { setError("Enter a receipt mode name."); return; }
    try {
      const res = await fetch(`/api/${tenancyId}/receipt-modes`, {
        method: "POST",
        headers,
        body: JSON.stringify({ receiptMode: newMode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to add receipt mode."); return; }
      setSuccess(`"${data.receiptMode}" added successfully.`);
      setNewMode("");
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
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 500 }}>
        <Typography variant="h5" gutterBottom>Receipt Mode Setup</Typography>
        {error   && <Alert severity="error"   sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        <Box sx={{ display: "flex", gap: 2, alignItems: "center", mt: 1 }}>
          <TextField
            label="New Receipt Mode"
            size="small"
            value={newMode}
            onChange={(e) => setNewMode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            sx={{ flex: 1 }}
          />
          <Button variant="contained" onClick={handleAdd}>Add</Button>
        </Box>
      </Paper>

      <Paper elevation={3} sx={{ padding: 4, maxWidth: 500, mt: 4 }}>
        <Typography variant="h6" gutterBottom>Existing Receipt Modes</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Receipt Mode</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {modes.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.receiptMode}</TableCell>
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
                <TableCell colSpan={3} align="center" sx={{ color: "text.secondary" }}>
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
