import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const MenuMasterPage = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [menuName, setMenuName] = useState("");
  const [menuType, setMenuType] = useState("WEB");

  const [editDialog, setEditDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("WEB");

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchMenus = async () => {
    setFetchError("");
    try {
      const res = await fetch(`/api/${tenancyId}/menus/all`, { headers });
      if (!res.ok) throw new Error("Failed to fetch menus");
      const data = await res.json();
      setMenus(data);
    } catch (e) {
      setFetchError("Could not load menu items.");
    }
  };

  useEffect(() => {
    fetchMenus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!menuName.trim()) {
      setFormError("Menu name is required.");
      return;
    }
    setLoading(true);
    setFormError("");
    setFormSuccess("");
    try {
      const res = await fetch(`/api/${tenancyId}/menus/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({ menuName: menuName.trim(), menuType }),
      });
      if (!res.ok) throw new Error("Save failed");
      setFormSuccess("Menu item added.");
      setMenuName("");
      setMenuType("WEB");
      fetchMenus();
    } catch {
      setFormError("Failed to add menu item.");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (item) => {
    setEditItem(item);
    setEditName(item.menuName);
    setEditType(item.menuType);
    setEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/${tenancyId}/menus/update/${editItem.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ menuName: editName.trim(), menuType: editType }),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditDialog(false);
      fetchMenus();
    } catch {
      alert("Update failed.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this menu item?")) return;
    try {
      const res = await fetch(`/api/${tenancyId}/menus/delete/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Delete failed");
      fetchMenus();
    } catch {
      alert("Delete failed.");
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Menu Master
      </Typography>

      {/* Add form */}
      <Paper sx={{ p: 2, mb: 3 }} component="form" onSubmit={handleAdd}>
        <Typography variant="subtitle1" gutterBottom>
          Add Menu Item
        </Typography>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField
            label="Menu Name"
            value={menuName}
            onChange={(e) => setMenuName(e.target.value)}
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={menuType}
              label="Type"
              onChange={(e) => setMenuType(e.target.value)}
            >
              <MenuItem value="WEB">WEB</MenuItem>
              <MenuItem value="CLIENT">CLIENT</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={18} /> : "Add"}
          </Button>
        </Box>
        {formError && <Alert severity="error" sx={{ mt: 1 }}>{formError}</Alert>}
        {formSuccess && <Alert severity="success" sx={{ mt: 1 }}>{formSuccess}</Alert>}
      </Paper>

      {/* Menu list */}
      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Menu Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {menus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No menu items found.
                </TableCell>
              </TableRow>
            ) : (
              menus.map((item, idx) => (
                <TableRow key={item.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{item.menuName}</TableCell>
                  <TableCell>
                    <Chip
                      label={item.menuType}
                      size="small"
                      color={item.menuType === "WEB" ? "primary" : "secondary"}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Menu Item</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          <TextField
            label="Menu Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            size="small"
            fullWidth
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={editType}
              label="Type"
              onChange={(e) => setEditType(e.target.value)}
            >
              <MenuItem value="WEB">WEB</MenuItem>
              <MenuItem value="CLIENT">CLIENT</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdate}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MenuMasterPage;
