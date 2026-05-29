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
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const PROTECTED_ROLES = ["admin", "user", "manager", "franchiseeuser", "cgn", "WB", "system-admin"];

const RoleManagementPage = () => {
  const [roles, setRoles] = useState([]);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });

  const token = () => localStorage.getItem("jwtToken");

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await fetch("/api/roles", {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error("Failed to load roles");
      setRoles(await res.json());
    } catch (e) {
      showSnack(e.message, "error");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const name = newRoleName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNewRoleName("");
      fetchRoles();
      showSnack(`Role "${name}" created`, "success");
    } catch (e) {
      showSnack(e.message, "error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/roles/${deleteTarget.roleid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchRoles();
      showSnack(`Role "${deleteTarget.name}" deleted`, "success");
    } catch (e) {
      showSnack(e.message, "error");
    }
  };

  const showSnack = (msg, severity) => setSnack({ open: true, msg, severity });

  return (
    <Box sx={{ p: 3, ml: "240px", mt: 2, maxWidth: 700 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Role Management
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Roles are stored in the common database and shared across all tenants.
      </Typography>

      {/* Create form */}
      <Paper sx={{ p: 2.5, mb: 3 }} elevation={2}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Create Role
        </Typography>
        <Box component="form" onSubmit={handleCreate} sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
          <TextField
            label="Role Name"
            size="small"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="e.g. supervisor"
            sx={{ flex: 1 }}
            required
          />
          <Button type="submit" variant="contained" disabled={creating || !newRoleName.trim()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </Box>
      </Paper>

      {/* Roles list */}
      <Paper elevation={2}>
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Roles ({roles.length})
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Role Name</TableCell>
                <TableCell>Role ID</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 3 }}>
                    No roles found
                  </TableCell>
                </TableRow>
              ) : (
                roles.map((role, idx) => {
                  const isProtected = PROTECTED_ROLES.includes(role.name);
                  return (
                    <TableRow key={role.roleid} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        {role.name}
                        {isProtected && (
                          <Chip label="system" size="small" sx={{ ml: 1, fontSize: 10 }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: "text.secondary" }}>{role.roleid}</TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          disabled={isProtected}
                          title={isProtected ? "System roles cannot be deleted" : "Delete role"}
                          onClick={() => setDeleteTarget(role)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs">
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete role <strong>{deleteTarget?.name}</strong>? This will remove it from all role-menu assignments.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default RoleManagementPage;
