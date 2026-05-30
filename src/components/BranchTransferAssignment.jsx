import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Button,
  Stack,
  CircularProgress,
  Alert,
} from "@mui/material";

const BranchTransferAssignmentPage = () => {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [assigned, setAssigned] = useState([]);
  const [originalAssigned, setOriginalAssigned] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingUserBranches, setLoadingUserBranches] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const token = localStorage.getItem("jwtToken") || "";
  const tenancyId = localStorage.getItem("tenancyId") || "";

  useEffect(() => {
    if (!tenancyId || !token) return;
    const fetchBranches = async () => {
      try {
        setLoadingBranches(true);
        const response = await fetch(`/api/${tenancyId}/branches`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Failed to fetch branches");

        const data = await response.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        setBranches(list);
      } catch (e) {
        console.error(e);
        setError("Failed to load branches");
      } finally {
        setLoadingBranches(false);
      }
    };
    fetchBranches();
  }, [tenancyId, token]);

  useEffect(() => {
    if (!tenancyId || !token) return;
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch(`/api/${tenancyId}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) throw new Error("Failed to fetch users");

        const data = await response.json();
        const list = Array.isArray(data) ? data : data.users || data.data || [];
        const normalized = list
          .filter((u) => u && u.username != null)
          .map((u) => ({ ...u, username: String(u.username) }));
        setUsers(normalized);
      } catch (e) {
        console.error(e);
        setError("Failed to load users");
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [tenancyId, token]);

  useEffect(() => {
    if (!selectedUserId || !tenancyId || !token) return;
    const fetchUserBranches = async () => {
      try {
        setLoadingUserBranches(true);
        const response = await fetch(
          `/api/${tenancyId}/admin/users/${encodeURIComponent(selectedUserId)}/transfer-branches`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch user transfer branches");
        }

        const data = await response.json();
        let codes = [];
        if (Array.isArray(data)) {
          if (data.length > 0 && typeof data[0] === "string") {
            codes = data;
          } else {
            codes = data.map((b) => b.branchCode);
          }
        } else if (Array.isArray(data.branches)) {
          if (data.branches.length > 0 && typeof data.branches[0] === "string") {
            codes = data.branches;
          } else {
            codes = data.branches.map((b) => b.branchCode);
          }
        }

        setAssigned(codes);
        setOriginalAssigned(codes);
        setError("");
        setSuccessMsg("");
      } catch (e) {
        console.error(e);
        setError("Failed to load user stock transfer branches");
      } finally {
        setLoadingUserBranches(false);
      }
    };
    fetchUserBranches();
  }, [selectedUserId, tenancyId, token]);

  const handleBranchesChange = (event) => {
    const value = event.target.value;
    setAssigned(typeof value === "string" ? value.split(",") : value);
  };

  const handleSave = async () => {
    if (!selectedUserId || !tenancyId || !token) return;
    try {
      setSaving(true);
      setError("");
      setSuccessMsg("");
      const response = await fetch(
        `/api/${tenancyId}/admin/users/${encodeURIComponent(selectedUserId)}/transfer-branches`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ branches: assigned }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to save user stock transfer branches");
      }

      setOriginalAssigned(assigned);
      setSuccessMsg("Stock transfer branches updated.");
    } catch (e) {
      console.error(e);
      setError("Failed to save user stock transfer branches");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setAssigned(originalAssigned);
    setError("");
    setSuccessMsg("");
  };

  const isDirty =
    assigned.length !== originalAssigned.length ||
    [...assigned].sort().join(",") !== [...originalAssigned].sort().join(",");

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 720, padding: 3 }} elevation={3}>
        <Typography variant="h4" gutterBottom>
          Stock Transfer Destination Branches
        </Typography>
        <Typography variant="body2" gutterBottom>
          Select which branches the chosen user is allowed to transfer stock to.
        </Typography>

        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {successMsg && <Alert severity="success">{successMsg}</Alert>}

          <FormControl fullWidth>
            <InputLabel>Select User</InputLabel>
            <Select
              value={selectedUserId}
              label="Select User"
              onChange={(e) => {
                setSelectedUserId(String(e.target.value));
                setAssigned([]);
                setOriginalAssigned([]);
                setError("");
                setSuccessMsg("");
              }}
            >
              {loadingUsers ? (
                <MenuItem disabled>
                  <CircularProgress size={18} /> Loading users...
                </MenuItem>
              ) : (
                users.map((u) => (
                  <MenuItem key={u.username} value={u.username}>
                    {u.username}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <FormControl
            fullWidth
            disabled={!selectedUserId || loadingBranches || loadingUserBranches}
          >
            <InputLabel>Transfer Destination Branches</InputLabel>
            <Select
              multiple
              value={assigned}
              onChange={handleBranchesChange}
              input={<OutlinedInput label="Transfer Destination Branches" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((code) => (
                    <Chip key={code} label={code} />
                  ))}
                </Box>
              )}
            >
              {loadingBranches ? (
                <MenuItem disabled>
                  <CircularProgress size={18} /> Loading branches...
                </MenuItem>
              ) : (
                branches.map((b) => (
                  <MenuItem key={b.branchCode} value={b.branchCode}>
                    {b.branchCode}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <Box mt={2} display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={!selectedUserId || !isDirty || saving}
            >
              {saving ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Save"}
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              disabled={!isDirty}
              onClick={handleReset}
            >
              Reset
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default BranchTransferAssignmentPage;
