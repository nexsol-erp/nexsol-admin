import React, { useEffect, useState } from "react";
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, Chip, Alert, CircularProgress,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteIcon from "@mui/icons-material/Delete";

const BASE = (path) => `/api/${localStorage.getItem("tenancyId")}${path}`;
const AUTH = () => ({ Authorization: `Bearer ${localStorage.getItem("jwtToken")}`, "Content-Type": "application/json" });

export default function FranchiseUsersPage() {
  const [franchises, setFranchises]   = useState([]);
  const [selectedId, setSelectedId]   = useState("");
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");

  // Create dialog
  const [open, setOpen]               = useState(false);
  const [username, setUsername]       = useState("");
  const [password, setPassword]       = useState("");
  const [role, setRole]               = useState("user");
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");

  // Revoke
  const [revoking, setRevoking]       = useState(null);

  useEffect(() => {
    fetch(BASE("/franchise"), { headers: AUTH() })
      .then((r) => r.json())
      .then((d) => {
        const list = d.franchises ?? d ?? [];
        setFranchises(Array.isArray(list) ? list : []);
      })
      .catch(() => setError("Failed to load franchises"));
  }, []);

  useEffect(() => {
    if (!selectedId) { setUsers([]); return; }
    setLoading(true);
    setError("");
    fetch(BASE(`/franchise/${selectedId}/users`), { headers: AUTH() })
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const openCreate = () => {
    setUsername(""); setPassword(""); setRole("user"); setSaveError(""); setOpen(true);
  };

  const handleCreate = async () => {
    if (!username.trim() || !password.trim()) { setSaveError("Username and password are required"); return; }
    setSaving(true); setSaveError("");
    try {
      const r = await fetch(BASE(`/franchise/${selectedId}/users`), {
        method: "POST",
        headers: AUTH(),
        body: JSON.stringify({ username: username.trim(), password, role }),
      });
      const d = await r.json();
      if (!r.ok) { setSaveError(d.message || "Failed to create user"); return; }
      setOpen(false);
      const r2 = await fetch(BASE(`/franchise/${selectedId}/users`), { headers: AUTH() });
      const updated = await r2.json();
      setUsers(Array.isArray(updated) ? updated : []);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm("Revoke this user's access to the franchise?")) return;
    setRevoking(userId);
    try {
      await fetch(BASE(`/franchise/${selectedId}/users/${userId}`), { method: "DELETE", headers: AUTH() });
      setUsers((prev) => prev.filter((u) => u.userId !== userId));
    } finally {
      setRevoking(null);
    }
  };

  const selectedFranchise = franchises.find((f) => String(f.id) === String(selectedId));

  return (
    <Box p={3}>
      <Typography variant="h5" fontWeight="bold" mb={2}>Franchise Users</Typography>

      {/* Franchise selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl fullWidth size="small">
          <InputLabel>Select Franchise</InputLabel>
          <Select
            value={selectedId}
            label="Select Franchise"
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {franchises.map((f) => (
              <MenuItem key={f.id} value={String(f.id)}>
                {f.franchiseCode} — {f.franchiseName}
                {f.status && <Chip label={f.status} size="small" sx={{ ml: 1 }} />}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {selectedId && (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              Users — {selectedFranchise?.franchiseName ?? selectedId}
            </Typography>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={openCreate}
              size="small"
            >
              Add User
            </Button>
          </Box>

          {loading ? (
            <CircularProgress size={28} />
          ) : (
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#1976d2" }}>
                    {["Username", "Role", "Granted By", "Granted At", ""].map((h) => (
                      <TableCell key={h} sx={{ color: "#fff", fontWeight: "bold" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: "#888" }}>
                        No users yet. Click "Add User" to create one.
                      </TableCell>
                    </TableRow>
                  ) : users.map((u) => (
                    <TableRow key={u.userId} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{u.username ?? u.userId}</TableCell>
                      <TableCell><Chip label={u.role} size="small" color="primary" variant="outlined" /></TableCell>
                      <TableCell>{u.grantedBy ?? "—"}</TableCell>
                      <TableCell>{u.grantedAt ? new Date(u.grantedAt).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          disabled={revoking === u.userId}
                          onClick={() => handleRevoke(u.userId)}
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Create user dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Franchise User</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <TextField
            label="Username" size="small" value={username}
            onChange={(e) => setUsername(e.target.value)} fullWidth autoFocus
          />
          <TextField
            label="Password" size="small" type="password" value={password}
            onChange={(e) => setPassword(e.target.value)} fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={role} label="Role" onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="manager">Manager</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} variant="contained" disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
