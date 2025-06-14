import React, { useState } from "react";
import { Button, TextField, Typography, Box, Paper } from "@mui/material";

const ReprocessVoucherForm = () => {
  const [jsonInput, setJsonInput] = useState("");
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/vouchers/reprocess`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: jsonInput,
      });

      const text = await res.text();

      if (res.ok) {
        setResponse(text);
        setError(null);
      } else {
        setError(text);
        setResponse(null);
      }
    } catch (err) {
      setError("Network error: " + err.message);
      setResponse(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", mt: 5 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>
          Reprocess Voucher JSON
        </Typography>
        <TextField
          label="Raw JSON"
          multiline
          rows={10}
          fullWidth
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          variant="outlined"
          margin="normal"
        />
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Send to Server
        </Button>
        {response && (
          <Typography variant="body1" color="success.main" mt={2}>
            {response}
          </Typography>
        )}
        {error && (
          <Typography variant="body1" color="error.main" mt={2}>
            {error}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default ReprocessVoucherForm;
