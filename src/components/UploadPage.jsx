import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  LinearProgress,
  Alert,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

const UploadPage = () => {
  const [branch, setBranch] = useState("");
  const [fileType, setFileType] = useState("");
  const [branches, setBranches] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(""); // State for the first message
  const [message2, setMessage2] = useState(""); // State for the second message
  const [error, setError] = useState(false); // State to differentiate between success and error messages

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleBranchChange = (event) => {
    setBranch(event.target.value);
  };

  const handleFileTypeChange = (event) => {
    setFileType(event.target.value);
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile || !branch || !fileType) return;

    setUploading(true);
    setMessage(""); // Clear any previous messages
    setMessage2(""); // Clear any previous second messages
    setError(false); // Reset error state

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("branch", branch);
    formData.append("fileType", fileType);

    try {
      const response = await fetch(`/api/${tenancyId}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      // Parse the JSON response
      const responseData = await response.json();

      if (responseData.success) {
        setMessage(responseData.message); // Set first message
        setMessage2(responseData.message2); // Set second message if any
      } else {
        setMessage(responseData.message || "An error occurred during upload.");
        setMessage2(responseData.message2 || "");
        setError(true); // Set error state
      }

      setUploading(false); // Stop the loading state after processing
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("An error occurred during file upload.");
      setError(true); // Set error state
      setUploading(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: 600, margin: "auto", marginTop: 8 }}
      >
        <Typography variant="h4" gutterBottom>
          Upload File
        </Typography>
        <Typography variant="body1" gutterBottom>
          Select a file to upload to the selected branch.
        </Typography>

        {message && (
          <Alert severity={error ? "error" : "success"} sx={{ mt: 2 }}>
            {message}
          </Alert>
        )}

        {message2 && (
          <Alert
            severity={error ? "error" : "info"} // Using "info" as a neutral tone for the second message
            sx={{ mt: 2 }}
          >
            {message2}
          </Alert>
        )}

        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="branch-label">Branch Code</InputLabel>
          <Select
            labelId="branch-label"
            value={branch}
            onChange={handleBranchChange}
          >
            {branches.map((branch) => (
              <MenuItem key={branch.id} value={branch.branchCode}>
                {branch.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth sx={{ mt: 3 }}>
          <InputLabel id="file-type-label">File Type</InputLabel>
          <Select
            labelId="file-type-label"
            value={fileType}
            onChange={handleFileTypeChange}
          >
            <MenuItem value="ITEM_MASTER">ITEM_MASTER</MenuItem>
            <MenuItem value="OPENING_STOCK">OPENING_STOCK</MenuItem>
            <MenuItem value="SUPPLIER_MST">SUPPLIER_MST</MenuItem>
            <MenuItem value="INI">INI</MenuItem>
          </Select>
        </FormControl>
        <TextField
          type="file"
          fullWidth
          onChange={handleFileChange}
          sx={{ mt: 3 }}
        />
        {uploading && (
          <LinearProgress
            sx={{ mt: 2 }}
            variant="determinate"
            value={progress}
          />
        )}
        <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={handleUpload}
            disabled={!branch || !fileType || !selectedFile || uploading}
          >
            Upload
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default UploadPage;
