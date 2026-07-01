import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormGroup,
  FormControlLabel,
  Checkbox,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LockResetIcon from "@mui/icons-material/LockReset";

const UserCreationPage = () => {
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [role, setRole] = useState("");
  const [branches, setBranches] = useState([]);
  const [users, setUsers] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);

  // Edit roles dialog
  const [editUser, setEditUser] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password
  const [resetTarget, setResetTarget]   = useState(null);
  const [resetPw, setResetPw]           = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetSaving, setResetSaving]   = useState(false);
  const [resetError, setResetError]     = useState("");

  useEffect(() => {
    fetchBranches();
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const res = await fetch("/api/roles", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAvailableRoles(Array.isArray(data) ? data.map((r) => r.name) : []);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/users`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/createbranchuser`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username, userId, password, branchCode, role }),
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { success: false, message: text }; }
      if (data.success) {
        alert("User created successfully!");
        setUsername(""); setUserId(""); setPassword(""); setBranchCode(""); setRole("user");
        fetchUsers();
      } else {
        alert(data.message || "Failed to create user.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  const openEditDialog = (user) => {
    setEditUser(user);
    setEditRoles(user.roles || []);
  };

  const closeEditDialog = () => {
    setEditUser(null);
    setEditRoles([]);
  };

  const toggleRole = (r) => {
    setEditRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/users/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setDeleteTarget(null);
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetPw !== resetConfirm) { setResetError("Passwords do not match"); return; }
    if (resetPw.length < 4)       { setResetError("Password must be at least 4 characters"); return; }
    setResetSaving(true);
    setResetError("");
    try {
      const token     = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/users/${resetTarget.id}/reset-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: resetPw }),
      });
      const data = await res.json();
      if (data.success) {
        setResetTarget(null);
      } else {
        setResetError(data.message || "Failed to reset password");
      }
    } catch {
      setResetError("Network error. Please try again.");
    } finally {
      setResetSaving(false);
    }
  };

  const saveRoles = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/users/${editUser.id}/roles`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(editRoles),
      });
      const data = await res.json();
      if (data.success) {
        closeEditDialog();
        fetchUsers();
      } else {
        alert(data.message || "Failed to update roles.");
      }
    } catch (error) {
      console.error("Error updating roles:", error);
      alert("An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 600, padding: "20px" }} elevation={3}>
        <Typography variant="h4" gutterBottom>
          Create User
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField label="Username" fullWidth margin="normal" value={username}
            onChange={(e) => setUsername(e.target.value)} required />
          <TextField label="User ID" fullWidth margin="normal" value={userId}
            onChange={(e) => setUserId(e.target.value)} required />
          <TextField label="Password" type="password" fullWidth margin="normal" value={password}
            onChange={(e) => setPassword(e.target.value)} required />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Branch Name</InputLabel>
            <Select value={branchCode} onChange={(e) => setBranchCode(e.target.value)}>
              {branches.map((branch) => (
                <MenuItem key={branch.branchCode} value={branch.branchCode}>
                  {branch.branchCode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Role</InputLabel>
            <Select value={role} onChange={(e) => setRole(e.target.value)} label="Role">
              {availableRoles.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box mt={2}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Create User
            </Button>
          </Box>
        </form>
      </Paper>

      <Paper sx={{ mt: 4, p: 2 }} elevation={3}>
        <Typography variant="h6" gutterBottom>Users</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Username</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ color: "text.secondary" }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user, index) => (
                  <TableRow key={user.id || index} hover>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{user.email || "—"}</TableCell>
                    <TableCell>{user.phone || "—"}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {(user.roles || []).map((r) => (
                          <Chip key={r} label={r} size="small" variant="outlined" />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEditDialog(user)} title="Edit roles">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="warning" onClick={() => { setResetTarget(user); setResetPw(""); setResetConfirm(""); setResetError(""); }} title="Reset password">
                        <LockResetIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(user)} title="Delete user">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          Are you sure you want to delete <strong>{deleteTarget?.username}</strong>? This cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetTarget} onClose={() => !resetSaving && setResetTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Reset Password — {resetTarget?.username}</DialogTitle>
        <DialogContent>
          {resetError && <Box sx={{ mb: 1.5, color: "error.main", fontSize: 13 }}>{resetError}</Box>}
          <TextField
            label="New Password" type="password" fullWidth margin="dense"
            value={resetPw} onChange={(e) => setResetPw(e.target.value)}
            disabled={resetSaving}
          />
          <TextField
            label="Confirm New Password" type="password" fullWidth margin="dense"
            value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)}
            disabled={resetSaving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetTarget(null)} disabled={resetSaving}>Cancel</Button>
          <Button onClick={handleResetPassword} variant="contained" color="warning" disabled={resetSaving || !resetPw || !resetConfirm}>
            {resetSaving ? "Saving…" : "Reset Password"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Roles Dialog */}
      <Dialog open={!!editUser} onClose={closeEditDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Roles — {editUser?.username}</DialogTitle>
        <DialogContent>
          <FormGroup>
            {availableRoles.map((r) => (
              <FormControlLabel
                key={r}
                control={
                  <Checkbox
                    checked={editRoles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                }
                label={r}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={saving}>Cancel</Button>
          <Button onClick={saveRoles} variant="contained" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserCreationPage;
