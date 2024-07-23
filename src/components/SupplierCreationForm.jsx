import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";

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
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/suppliers`, {
        method: "POST",
        headers: {
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
    </Box>
  );
};

export default SupplierCreationForm;
