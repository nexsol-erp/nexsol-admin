import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
} from "@mui/material";

const PublishSchemePage = () => {
  const [schemes, setSchemes] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [message, setMessage] = useState({ text: "", severity: "" });

  const fetchSchemes = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    // No branchCode param — returns all schemes so admin can see every scheme
    const response = await fetch(`/api/${tenancyId}/scheme`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    setSchemes(Array.isArray(data) ? data : []);
  };

  const fetchBranches = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setBranches(Array.isArray(data.branches) ? data.branches : []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  useEffect(() => {
    fetchSchemes();
    fetchBranches();
  }, []);

  const handlePublishScheme = async () => {
    if (!selectedScheme || !selectedBranch) {
      setMessage({ text: "Please select both a scheme and a branch.", severity: "warning" });
      return;
    }
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/${tenancyId}/scheme/publish-scheme`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemeId: selectedScheme,
        branchId: selectedBranch,
      }),
    });

    if (response.ok) {
      setMessage({ text: `Scheme published to branch "${selectedBranch}" successfully!`, severity: "success" });
      fetchSchemes(); // Refresh to show updated branch list
    } else {
      setMessage({ text: "Failed to publish scheme.", severity: "error" });
    }
  };

  const handleDeleteScheme = async (schemeId) => {
    if (!window.confirm(`Delete scheme "${schemeId}"? This will remove it from all branches.`)) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const response = await fetch(`/api/${tenancyId}/scheme/${schemeId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      setMessage({ text: "Scheme deleted successfully.", severity: "success" });
      fetchSchemes();
    } else {
      setMessage({ text: "Failed to delete scheme.", severity: "error" });
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600 }}>
        <Typography variant="h4" gutterBottom>
          Publish Scheme to Branch
        </Typography>
        {message.text && (
          <Alert severity={message.severity || "info"} sx={{ mb: 2 }} onClose={() => setMessage({ text: "", severity: "" })}>
            {message.text}
          </Alert>
        )}
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Scheme</InputLabel>
          <Select
            value={selectedScheme}
            onChange={(e) => setSelectedScheme(e.target.value)}
          >
            {schemes.map((scheme) => (
              <MenuItem key={scheme.schemeName} value={scheme.schemeName}>
                {scheme.schemeName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Select Branch</InputLabel>
          <Select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((branch) => (
              <MenuItem key={branch.branchCode} value={branch.branchCode}>
                {branch.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          color="primary"
          onClick={handlePublishScheme}
          sx={{ mt: 2 }}
        >
          Publish Scheme
        </Button>
      </Paper>

      <Paper elevation={3} sx={{ padding: 4, maxWidth: 900, marginTop: 4 }}>
        <Typography variant="h4" gutterBottom>
          Existing Schemes
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Scheme Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Published Branches</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schemes.map((scheme) => (
              <TableRow key={scheme.schemeName}>
                <TableCell>{scheme.schemeName}</TableCell>
                <TableCell>{scheme.schemeType}</TableCell>
                <TableCell>{scheme.startDate}</TableCell>
                <TableCell>{scheme.endDate}</TableCell>
                <TableCell>
                  {Array.isArray(scheme.branches) && scheme.branches.length > 0 ? (
                    scheme.branches.map((b) => (
                      <Chip key={b} label={b} size="small" color="primary" variant="outlined" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))
                  ) : (
                    <span style={{ color: "#aaa", fontSize: 12 }}>Not published</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    onClick={() => handleDeleteScheme(scheme.schemeName)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default PublishSchemePage;
