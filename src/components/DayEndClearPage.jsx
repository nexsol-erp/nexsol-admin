import React, { useEffect, useState } from "react";
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogContentText, DialogTitle, Divider,
  FormControl, InputLabel, MenuItem, Paper, Select, Typography,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import dayjs from "dayjs";

const DayEndClearPage = () => {
  const tenancyId = localStorage.getItem("tenancyId") || "";
  const token     = localStorage.getItem("jwtToken")  || "";
  const headers   = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [branches, setBranches]       = useState([]);
  const [branchCode, setBranchCode]   = useState("");
  const [date, setDate]               = useState(dayjs());
  const [checking, setChecking]       = useState(false);
  const [clearing, setClearing]       = useState(false);
  const [status, setStatus]           = useState(null);  // null | "found" | "not_found"
  const [message, setMessage]         = useState(null);  // { type, text }
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/${tenancyId}/branches`, { headers })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.branches ?? data?.data ?? []);
        setBranches(list);
      })
      .catch(() => {});
  }, []);

  const handleCheck = async () => {
    if (!branchCode || !date) return;
    setChecking(true);
    setStatus(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/${tenancyId}/day-end/details/${branchCode}/${date.format("YYYY-MM-DD")}`,
        { headers }
      );
      const data = await res.json();
      setStatus(Array.isArray(data) && data.length > 0 ? "found" : "not_found");
    } catch {
      setMessage({ type: "error", text: "Failed to check Day End status" });
    } finally {
      setChecking(false);
    }
  };

  const handleClear = async () => {
    setConfirmOpen(false);
    setClearing(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/${tenancyId}/day-end/details/${branchCode}/${date.format("YYYY-MM-DD")}`,
        { method: "DELETE", headers }
      );
      const data = await res.json();
      if (data.success) {
        setStatus("not_found");
        setMessage({ type: "success", text: data.message });
      } else {
        setMessage({ type: "error", text: data.message || "Clear failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to clear Day End" });
    } finally {
      setClearing(false);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Typography variant="h4" gutterBottom>Clear Day End</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Use this to reverse an accidentally submitted Day End. This removes the Day End record
        from the database so billing can resume on the POS (user must log out and back in).
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper elevation={2} sx={{ p: 3, maxWidth: 500 }}>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Branch</InputLabel>
          <Select
            value={branchCode}
            label="Branch"
            onChange={(e) => { setBranchCode(e.target.value); setStatus(null); }}
          >
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode}>
                {b.branchCode} {b.branchName ? `— ${b.branchName}` : ""}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            label="Day End Date"
            value={date}
            onChange={(d) => { setDate(d); setStatus(null); }}
            format="YYYY-MM-DD"
            slotProps={{ textField: { size: "small", fullWidth: true } }}
            sx={{ mb: 2 }}
          />
        </LocalizationProvider>

        <Button
          variant="outlined"
          onClick={handleCheck}
          disabled={!branchCode || !date || checking}
          fullWidth
          sx={{ mb: 2 }}
        >
          {checking ? <CircularProgress size={20} /> : "Check Status"}
        </Button>

        {status === "not_found" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            No Day End record found for <strong>{branchCode}</strong> on <strong>{date?.format("YYYY-MM-DD")}</strong>.
          </Alert>
        )}

        {status === "found" && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Alert severity="warning" sx={{ mb: 2 }}>
              Day End record exists for <strong>{branchCode}</strong> on <strong>{date?.format("YYYY-MM-DD")}</strong>.
            </Alert>
            <Button
              variant="contained"
              color="error"
              fullWidth
              disabled={clearing}
              onClick={() => setConfirmOpen(true)}
            >
              {clearing ? <CircularProgress size={20} color="inherit" /> : "Clear Day End"}
            </Button>
          </>
        )}
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Clear Day End</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the Day End record for <strong>{branchCode}</strong> on{" "}
            <strong>{date?.format("YYYY-MM-DD")}</strong>. The POS user must log out and back in
            for billing to resume. Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleClear} color="error" variant="contained">Clear</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DayEndClearPage;
