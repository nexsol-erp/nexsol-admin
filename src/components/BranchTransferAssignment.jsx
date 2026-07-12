import React, { useState, useEffect, useMemo } from "react";
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
  Divider,
  ListSubheader,
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

  // ── Fetch branches ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenancyId || !token) return;
    setLoadingBranches(true);
    fetch(`/api/${tenancyId}/branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject("Failed to fetch branches"))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => setError("Failed to load branches"))
      .finally(() => setLoadingBranches(false));
  }, [tenancyId, token]);

  // ── Fetch users ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tenancyId || !token) return;
    setLoadingUsers(true);
    fetch(`/api/${tenancyId}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject("Failed to fetch users"))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.users || data.data || [];
        setUsers(
          list.filter((u) => u && u.username != null)
              .map((u) => ({ ...u, username: String(u.username) }))
        );
      })
      .catch(() => setError("Failed to load users"))
      .finally(() => setLoadingUsers(false));
  }, [tenancyId, token]);

  // ── Fetch assigned branches for selected user ──────────────────────────────
  useEffect(() => {
    if (!selectedUserId || !tenancyId || !token) return;
    setLoadingUserBranches(true);
    fetch(`/api/${tenancyId}/admin/users/${encodeURIComponent(selectedUserId)}/transfer-branches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        let codes = [];
        if (Array.isArray(data)) {
          codes = typeof data[0] === "string" ? data : data.map((b) => b.branchCode);
        } else if (Array.isArray(data.branches)) {
          codes = typeof data.branches[0] === "string"
            ? data.branches
            : data.branches.map((b) => b.branchCode);
        }
        setAssigned(codes);
        setOriginalAssigned(codes);
        setError("");
        setSuccessMsg("");
      })
      .catch(() => setError("Failed to load user transfer branches"))
      .finally(() => setLoadingUserBranches(false));
  }, [selectedUserId, tenancyId, token]);

  // ── Branch helpers ─────────────────────────────────────────────────────────
  const branchMap = useMemo(() => {
    const m = {};
    for (const b of branches) { m[String(b.branchCode)] = b; }
    return m;
  }, [branches]);

  const branchLabel = (code) => {
    const b = branchMap[code];
    if (!b) return code;
    const name   = b.branchName ? ` - ${b.branchName}` : "";
    const suffix = b.isCentralBranch ? " [HQ]" : "";
    return `${code}${name}${suffix}`;
  };

  // Separate own branches from central (HQ) branches for grouped display
  const ownBranches     = useMemo(() => branches.filter((b) => !b.isCentralBranch), [branches]);
  const centralBranches = useMemo(() => branches.filter((b) =>  b.isCentralBranch), [branches]);

  // ── Save / reset ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedUserId || !tenancyId || !token) return;
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const r = await fetch(
        `/api/${tenancyId}/admin/users/${encodeURIComponent(selectedUserId)}/transfer-branches`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ branches: assigned }),
        }
      );
      if (!r.ok) throw new Error();
      setOriginalAssigned(assigned);
      setSuccessMsg("Transfer branches updated successfully.");
    } catch {
      setError("Failed to save transfer branches.");
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper sx={{ width: "100%", maxWidth: 720, padding: 3 }} elevation={3}>
        <Typography variant="h4" gutterBottom>
          Stock Transfer Destination Branches
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Assign which branches this user is allowed to transfer stock to.
          Branches marked <strong>[HQ]</strong> are master-tenant branches.
        </Typography>

        <Stack spacing={2} mt={1}>
          {error      && <Alert severity="error">{error}</Alert>}
          {successMsg && <Alert severity="success">{successMsg}</Alert>}

          {/* User selector */}
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
                <MenuItem disabled><CircularProgress size={18} sx={{ mr: 1 }} /> Loading users…</MenuItem>
              ) : (
                users.map((u) => (
                  <MenuItem key={u.username} value={u.username}>{u.username}</MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          {/* Branch multi-select */}
          <FormControl fullWidth disabled={!selectedUserId || loadingBranches || loadingUserBranches}>
            <InputLabel>Transfer Destination Branches</InputLabel>
            <Select
              multiple
              value={assigned}
              onChange={(e) => {
                const v = e.target.value;
                setAssigned(typeof v === "string" ? v.split(",") : v);
              }}
              input={<OutlinedInput label="Transfer Destination Branches" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((code) => {
                    const b = branchMap[code];
                    const isHQ = b?.isCentralBranch;
                    return (
                      <Chip
                        key={code}
                        label={branchLabel(code)}
                        size="small"
                        color={isHQ ? "primary" : "default"}
                        variant={isHQ ? "filled" : "outlined"}
                      />
                    );
                  })}
                </Box>
              )}
            >
              {loadingBranches ? (
                <MenuItem disabled><CircularProgress size={18} sx={{ mr: 1 }} /> Loading…</MenuItem>
              ) : (
                [
                  /* Own branches */
                  ownBranches.length > 0 && (
                    <ListSubheader key="_own_hdr" sx={{ bgcolor: "#f5f5f5", fontWeight: 700 }}>
                      Own Branches
                    </ListSubheader>
                  ),
                  ...ownBranches.map((b) => (
                    <MenuItem key={b.branchCode} value={b.branchCode}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span style={{ fontWeight: 500 }}>{b.branchCode}</span>
                        {b.branchName && (
                          <span style={{ color: "#555", fontSize: 13 }}>- {b.branchName}</span>
                        )}
                      </Box>
                    </MenuItem>
                  )),

                  /* Central / HQ branches */
                  centralBranches.length > 0 && (
                    <ListSubheader key="_hq_hdr" sx={{ bgcolor: "#e3f2fd", fontWeight: 700, color: "#1565c0" }}>
                      Master Tenant Branches (HQ)
                    </ListSubheader>
                  ),
                  ...centralBranches.map((b) => (
                    <MenuItem key={b.branchCode} value={b.branchCode}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <span style={{ fontWeight: 500, color: "#1565c0" }}>{b.branchCode}</span>
                        {b.branchName && (
                          <span style={{ color: "#555", fontSize: 13 }}>- {b.branchName}</span>
                        )}
                        <Chip label="HQ" size="small" color="primary" sx={{ ml: "auto", height: 18, fontSize: 10 }} />
                      </Box>
                    </MenuItem>
                  )),
                ].filter(Boolean)
              )}
            </Select>
          </FormControl>

          <Box display="flex" gap={2} mt={1}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleSave}
              disabled={!selectedUserId || !isDirty || saving}
            >
              {saving ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Save"}
            </Button>
            <Button variant="outlined" color="secondary" disabled={!isDirty} onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};

export default BranchTransferAssignmentPage;
