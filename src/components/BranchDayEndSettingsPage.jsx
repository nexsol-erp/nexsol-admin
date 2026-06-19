import React, { useEffect, useState } from "react";
import {
  Alert, Box, CircularProgress, Divider, Paper,
  Switch, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography,
} from "@mui/material";

const BranchDayEndSettingsPage = () => {
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(null); // branchCode being saved
  const [message, setMessage]     = useState(null); // { type, text }

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/${tenancyId}/branches`, { headers });
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
      setBranches(list);
    } catch {
      setMessage({ type: "error", text: "Failed to load branches" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBranches(); }, []);

  const handleToggle = async (branch, checked) => {
    const branchCode = branch.branchCode;
    setSaving(branchCode);
    setMessage(null);
    try {
      const res = await fetch(`/api/${tenancyId}/branches/${branchCode}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...branch, dayEndRequired: checked }),
      });
      const data = await res.json();
      if (data.success || res.ok) {
        setBranches((prev) =>
          prev.map((b) => b.branchCode === branchCode ? { ...b, dayEndRequired: checked } : b)
        );
        setMessage({
          type: "success",
          text: `Day End requirement ${checked ? "enabled" : "disabled"} for ${branchCode}`,
        });
      } else {
        setMessage({ type: "error", text: data.message || "Update failed" });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Error: " + e.message });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h4" gutterBottom>Branch Day End Settings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        When <strong>Day End Required</strong> is enabled for a branch, the POS will block billing
        on the next day until Day End is completed for the previous day.
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper elevation={2}>
        <Divider />
        {loading ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "#f5f5f5" }}>
                  <TableCell><strong>Branch Code</strong></TableCell>
                  <TableCell><strong>Branch Name</strong></TableCell>
                  <TableCell align="center"><strong>Day End Required</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {branches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center" sx={{ py: 4, color: "#999" }}>
                      No branches found
                    </TableCell>
                  </TableRow>
                ) : (
                  branches.map((b) => (
                    <TableRow key={b.branchCode} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{b.branchCode}</TableCell>
                      <TableCell>{b.branchName || <em style={{ color: "#bbb" }}>—</em>}</TableCell>
                      <TableCell align="center">
                        {saving === b.branchCode ? (
                          <CircularProgress size={20} />
                        ) : (
                          <Switch
                            checked={!!b.dayEndRequired}
                            onChange={(e) => handleToggle(b, e.target.checked)}
                            color="primary"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
};

export default BranchDayEndSettingsPage;
