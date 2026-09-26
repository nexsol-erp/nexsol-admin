import React, { useCallback, useEffect, useState } from "react";
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("jwtToken")}`,
  "Content-Type": "application/json",
});

const SUPPLIER_FIELDS = [
  { name: "supplierName", label: "Supplier Name", required: true },
  { name: "supplierAddress", label: "Supplier Address" },
  { name: "supplierGst", label: "Supplier GST" },
  { name: "supplierState", label: "Supplier State" },
  { name: "supplierPhone", label: "Supplier Phone" },
];

const SupplierCreationForm = () => {
  const [supplier, setSupplier] = useState({
    id: "",
    
    supplierName: "",
    supplierAddress: "",
    supplierGst: "",
    supplierState: "",
    supplierPhone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [suppliers, setSuppliers] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadSuppliers = useCallback(async () => {
    setListLoading(true);
    setListError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/suppliers`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setSuppliers(
        (Array.isArray(data) ? data : []).sort((a, b) =>
          (a.supplierName || "").localeCompare(b.supplierName || "")
        )
      );
    } catch (err) {
      console.error("Error loading suppliers:", err);
      setListError("Could not load suppliers.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const handleEditSave = async () => {
    if (!editing.supplierName || !editing.supplierName.trim()) {
      setEditError("Supplier name is required.");
      return;
    }
    setEditSaving(true);
    setEditError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(
        `/api/${tenancyId}/suppliers/${encodeURIComponent(editing.id)}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify(editing),
        }
      );
      if (response.ok) {
        setEditing(null);
        loadSuppliers();
      } else {
        const data = await response.json().catch(() => ({}));
        setEditError(data.message || "Could not save the supplier.");
      }
    } catch (err) {
      console.error("Error updating supplier:", err);
      setEditError("Could not save the supplier. Please try again later.");
    } finally {
      setEditSaving(false);
    }
  };

  const term = search.trim().toLowerCase();
  const visibleSuppliers = term
    ? suppliers.filter((s) =>
        [s.supplierName, s.supplierGst, s.supplierPhone].some((v) =>
          (v || "").toLowerCase().includes(term)
        )
      )
    : suppliers;

  const handleChange = (e) => {
    setSupplier({
      ...supplier,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/suppliers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(supplier),
      });

      if (response.ok) {
        setSuccess(true);
        setSupplier({
          id: "",

          supplierName: "",
          supplierAddress: "",
          supplierGst: "",
          supplierState: "",
          supplierPhone: "",
        });
        loadSuppliers();
      } else {
        const data = await response.json();
        setError(data.message || "An error occurred.");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 3,
        ml: "240px",
        mt: 2,
      }}
    >
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600 }}>
        <Typography variant="h4" gutterBottom>
          Create Supplier
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Supplier created successfully!
          </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Supplier Name"
            fullWidth
            margin="normal"
            name="supplierName"
            value={supplier.supplierName}
            onChange={handleChange}
            required
          />
          <TextField
            label="Supplier Address"
            fullWidth
            margin="normal"
            name="supplierAddress"
            value={supplier.supplierAddress}
            onChange={handleChange}
          />
          <TextField
            label="Supplier GST"
            fullWidth
            margin="normal"
            name="supplierGst"
            value={supplier.supplierGst}
            onChange={handleChange}
          />
          <TextField
            label="Supplier State"
            fullWidth
            margin="normal"
            name="supplierState"
            value={supplier.supplierState}
            onChange={handleChange}
          />
          <TextField
            label="Supplier Phone"
            fullWidth
            margin="normal"
            name="supplierPhone"
            value={supplier.supplierPhone}
            onChange={handleChange}
          />
          <Box mt={2} display="flex" justifyContent="center">
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Create Supplier"}
            </Button>
          </Box>
        </form>
      </Paper>

      <Paper elevation={3} sx={{ padding: 4, mt: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} gap={2}>
          <Typography variant="h5">Suppliers ({visibleSuppliers.length})</Typography>
          <TextField
            size="small"
            placeholder="Search name, GST or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Box>
        {listError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {listError}
          </Alert>
        )}
        {listLoading ? (
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ maxHeight: 520 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Supplier Name</TableCell>
                  <TableCell>GST</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleSuppliers.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.supplierName}</TableCell>
                    <TableCell>{s.supplierGst}</TableCell>
                    <TableCell>{s.supplierState}</TableCell>
                    <TableCell>{s.supplierPhone}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setEditError("");
                          setEditing({ ...s });
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {visibleSuppliers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No suppliers found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={!!editing} onClose={() => !editSaving && setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Supplier</DialogTitle>
        <DialogContent>
          {editError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {editError}
            </Alert>
          )}
          {editing &&
            SUPPLIER_FIELDS.map((f) => (
              <TextField
                key={f.name}
                label={f.label}
                fullWidth
                margin="normal"
                required={f.required}
                value={editing[f.name] || ""}
                onChange={(e) => setEditing({ ...editing, [f.name]: e.target.value })}
              />
            ))}
          <Typography variant="caption" color="text.secondary">
            Past purchases keep the name they were saved with.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={editSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleEditSave} disabled={editSaving}>
            {editSaving ? <CircularProgress size={24} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupplierCreationForm;
