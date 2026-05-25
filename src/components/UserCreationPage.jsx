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
} from "@mui/material";

const UserCreationPage = () => {
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [role, setRole] = useState("user");

  const availableRoles = ["admin", "user", "manager", "franchiseeuser", "cgn", "WB"];
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    fetchBranches();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = {
      username,
      userId,
      password,
      branchCode,
      role,
    };

    try {
        const token = localStorage.getItem("jwtToken");
       // const tenancyId = localStorage.getItem("tenancyId");
       const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/createbranchuser`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
  const data = await response.json();
      /*const response2 = await fetch(`/api/${tenancyId}/createbranchusertenancy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });*/

      //const data2 = await response2.json();
      if (data.success) {
        alert("User created successfully!");
        // Optionally redirect or perform other actions after successful user creation
      } else {
        alert(data.message || "Failed to create user.");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again later.");
    }
  };

  const handleBranchChange = (event) => {
    setBranchCode(event.target.value);
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
      <Paper
        sx={{ width: "100%", maxWidth: 600, padding: "20px" }}
        elevation={3}
      >
        <Typography variant="h4" gutterBottom>
          Create User
        </Typography>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            label="User ID"
            fullWidth
            margin="normal"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <FormControl fullWidth margin="normal" required>
            <InputLabel>Branch Name</InputLabel>
            <Select value={branchCode} onChange={handleBranchChange}>
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
    </Box>
  );
};

export default UserCreationPage;
