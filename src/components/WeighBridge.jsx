import React, { useState, useEffect } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Alert,
  Chip,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import ScaleIcon from "@mui/icons-material/Scale";
import ReplayIcon from "@mui/icons-material/Replay";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const fmtKg = (v) => (num(v) === null || Number.isNaN(num(v)) ? "-" : `${num(v).toLocaleString("en-IN")} kg`);
const fmtMoney = (v) => (Number(v) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v) => (v && dayjs(v).isValid() ? dayjs(v).format("DD MMM YYYY, HH:mm") : v || "-");
const isClosed = (row) => String(row.round_trip) === "1";

const RANGES = [
  { label: "Today", from: () => dayjs().startOf("day") },
  { label: "7 days", from: () => dayjs().subtract(7, "day") },
  { label: "30 days", from: () => dayjs().subtract(30, "day") },
];

const Stat = ({ label, value, hint }) => (
  <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "12px", minWidth: 0 }}>
    <Typography sx={{ fontSize: 12.5, color: "text.secondary", fontWeight: 600 }}>{label}</Typography>
    <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, mt: 0.25, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" }}>
      {value}
    </Typography>
    {hint && <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{hint}</Typography>}
  </Paper>
);

const WeighBridge = () => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down("md"));
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DDTHH:mm")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DDTHH:mm"));
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [weighbridgeData, setWeighbridgeData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("WeighbridgeData.xlsx");
  const [reopenRow, setReopenRow] = useState(null);
  const [reopenBusy, setReopenBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [withPhoto, setWithPhoto] = useState(new Set());
  const [photo, setPhoto] = useState(null); // { row, url, error }

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
      setBranches(data.branches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  // Branch is optional: leaving it on "All Branches" and typing a vehicle number
  // pulls that vehicle's weighings from every branch for the chosen period.
  const fetchWeighBridgeData = async (range) => {
    const from = range?.from ?? fromDate;
    const to = range?.to ?? toDate;
    if (from && to) {
      setLoading(true);
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
        const params = new URLSearchParams({ fromDate: from, toDate: to });
        if (branch) params.append("branch", branch);
        if (vehicleNumber.trim())
          params.append("vehicleNumber", vehicleNumber.trim());
        const response = await fetch(
          `/api/${tenancyId}/weighbridge?${params.toString()}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();
        const rows = Array.isArray(data.data) ? data.data : [];
        setWeighbridgeData(rows);
        loadPhotoFlags(rows);
      } catch (error) {
        console.error("Error fetching Wb data:", error);
        setMessage({ severity: "error", text: "Could not load weighings. Please try again." });
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }
  };

  const applyRange = (r) => {
    const from = r.from().format("YYYY-MM-DDTHH:mm");
    const to = dayjs().format("YYYY-MM-DDTHH:mm");
    setFromDate(from);
    setToDate(to);
    fetchWeighBridgeData({ from, to });
  };

  useEffect(() => {
    fetchBranches();
    fetchWeighBridgeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBranchChange = (event) => {
    setBranch(event.target.value);
  };

  const handleFromDateChange = (event) => {
    setFromDate(event.target.value);
  };

  const handleToDateChange = (event) => {
    setToDate(event.target.value);
  };

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  // Which weighings have a camera photo (taken by the weighbridge PC when it was saved).
  const loadPhotoFlags = async (rows) => {
    const ddIds = rows.map((r) => r.dd_id).filter(Boolean);
    if (!ddIds.length) { setWithPhoto(new Set()); return; }
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/weighbridge/photos/exists`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ddIds }),
      });
      const data = await res.json().catch(() => ({}));
      setWithPhoto(new Set(Array.isArray(data.ddIds) ? data.ddIds : []));
    } catch (_) {
      setWithPhoto(new Set());
    }
  };

  const openPhoto = async (row) => {
    setPhoto({ row, url: null, error: "" });
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(`/api/${tenancyId}/weighbridge/photo/${encodeURIComponent(row.dd_id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("No photo for this weighing");
      const url = URL.createObjectURL(await res.blob());
      setPhoto((p) => (p && p.row === row ? { ...p, url } : p));
    } catch (e) {
      setPhoto((p) => (p && p.row === row ? { ...p, error: e.message } : p));
    }
  };

  const closePhoto = () => {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  // Reopen a closed weighing so the weighbridge PC can take this vehicle's second weight
  // again, free, as its return. The PC picks it up within a minute.
  const reopenWeighing = async () => {
    const row = reopenRow;
    setReopenBusy(true);
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const res = await fetch(
        `/api/${tenancyId}/weighbridge/weights/${encodeURIComponent(row.id)}/reopen`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ severity: "error", text: data.error || `Failed (HTTP ${res.status})` });
        return;
      }
      setMessage({
        severity: "success",
        text: `Voucher ${row.voucher_number} of ${row.vehicle_number} is open again. The weighbridge PC at ${row.branch_code} will take its second weight free.`,
      });
      await fetchWeighBridgeData();
    } catch (error) {
      setMessage({ severity: "error", text: error.message });
    } finally {
      setReopenBusy(false);
      setReopenRow(null);
    }
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      weighbridgeData.map(({ id, dd_id, ...rest }) => rest)
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "WB Data");
    XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  const totalAmount = Array.isArray(weighbridgeData)
    ? weighbridgeData.reduce(
        (total, item) => total + (Number(item.amount) || 0),
        0
      )
    : 0;

  const openCount = weighbridgeData.filter((r) => !isClosed(r)).length;
  const photoCount = weighbridgeData.filter((r) => withPhoto.has(r.dd_id)).length;

  const statusCell = (row) =>
    isClosed(row) ? (
      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
        <Chip size="small" label="Closed" variant="outlined" />
        {row.id && (
          <Tooltip title="Let this vehicle take its second weight again, free">
            <Button size="small" startIcon={<ReplayIcon fontSize="small" />} onClick={() => setReopenRow(row)} sx={{ textTransform: "none", minWidth: 0 }}>
              Reopen
            </Button>
          </Tooltip>
        )}
      </Box>
    ) : (
      <Chip size="small" color="success" label="Open" />
    );

  const photoButton = (row) =>
    withPhoto.has(row.dd_id) ? (
      <Tooltip title="View photo">
        <IconButton size="small" aria-label="View photo" onClick={() => openPhoto(row)}>
          <PhotoCameraOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : null;

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2, md: 3 }, maxWidth: 1400, mx: "auto", width: "100%", boxSizing: "border-box" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: "10px", bgcolor: "primary.main", color: "primary.contrastText", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ScaleIcon />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 } }}>
            Weighbridge entries
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 14 }}>
            Every weighing saved at your weighbridges, with photos.
          </Typography>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: "12px", mb: 2 }}>
        <Box
          component="form"
          onSubmit={(e) => { e.preventDefault(); fetchWeighBridgeData(); }}
          sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1.1fr 1fr 1fr 1.2fr" } }}
        >
          <FormControl size="small" fullWidth>
            <InputLabel id="branch-label" shrink>Branch</InputLabel>
            <Select labelId="branch-label" label="Branch" value={branch} onChange={handleBranchChange} displayEmpty notched>
              <MenuItem value="">All branches</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.branchCode}>
                  {b.branchName ? `${b.branchName} (${b.branchCode})` : b.branchCode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField size="small" type="datetime-local" label="From" value={fromDate} onChange={handleFromDateChange} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField size="small" type="datetime-local" label="To" value={toDate} onChange={handleToDateChange} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField
            size="small"
            label="Vehicle number"
            placeholder="All vehicles"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Box sx={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", flex: { xs: "1 1 100%", sm: "1 1 auto" } }}>
              {RANGES.map((r) => (
                <Chip key={r.label} label={r.label} onClick={() => applyRange(r)} variant="outlined" clickable />
              ))}
            </Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              disabled={loading}
              sx={{ textTransform: "none", fontWeight: 700, flex: { xs: 1, sm: "0 0 auto" } }}
            >
              Show weighings
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={handleClickOpen}
              disabled={!weighbridgeData.length}
              sx={{ textTransform: "none", fontWeight: 600, flex: { xs: 1, sm: "0 0 auto" } }}
            >
              Excel
            </Button>
          </Box>
        </Box>
      </Paper>

      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Box sx={{ display: "grid", gap: 1.5, mb: 2, gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" } }}>
        <Stat label="Weighings" value={weighbridgeData.length.toLocaleString("en-IN")} />
        <Stat label="Amount" value={fmtMoney(totalAmount)} />
        <Stat label="Open" value={openCount} />
        <Stat label="With photo" value={photoCount} />
      </Box>

      {!weighbridgeData.length ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: "12px", textAlign: "center", color: "text.secondary" }}>
          {loading ? "Loading weighings…" : searched ? "No weighings for these filters. Try a longer date range or All branches." : "Pick a date range and tap Show weighings."}
        </Paper>
      ) : phone ? (
        <Box sx={{ display: "grid", gap: 1.25 }}>
          {weighbridgeData.map((row, index) => (
            <Paper key={row.id || index} variant="outlined" sx={{ p: 1.5, borderRadius: "12px" }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, letterSpacing: "0.3px" }}>{row.vehicle_number || "-"}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                    #{row.voucher_number} · {row.branch_code} · {fmtDate(row.voucher_date)}
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 16, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                  {fmtMoney(row.amount)}
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, mt: 1.25, fontSize: 13 }}>
                <Box><Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Weight</Typography><Typography sx={{ fontSize: 14, fontWeight: 700 }}>{fmtKg(row.lcd_number)}</Typography></Box>
                <Box><Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>First weight</Typography><Typography sx={{ fontSize: 14 }}>{fmtKg(row.first_weight)}</Typography></Box>
                <Box><Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>Wheels</Typography><Typography sx={{ fontSize: 14 }}>{row.wheel_type || "-"}</Typography></Box>
              </Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                {statusCell(row)}
                {photoButton(row)}
              </Box>
            </Paper>
          ))}
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: "12px", display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
            <span>Total ({weighbridgeData.length})</span>
            <span>{fmtMoney(totalAmount)}</span>
          </Paper>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "12px", maxHeight: "calc(100vh - 380px)", minHeight: 240 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Voucher</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Vehicle</TableCell>
                <TableCell>Wheels</TableCell>
                <TableCell align="right">Weight</TableCell>
                <TableCell align="right">First weight</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Photo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {weighbridgeData.map((row, index) => (
                <TableRow key={row.id || index} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{fmtDate(row.voucher_date)}</TableCell>
                  <TableCell>{row.voucher_number}</TableCell>
                  <TableCell>{row.branch_code}</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{row.vehicle_number}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{row.wheel_type}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmtKg(row.lcd_number)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{fmtKg(row.first_weight)}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(row.amount)}</TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{statusCell(row)}</TableCell>
                  <TableCell align="center">{photoButton(row)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={7} sx={{ fontWeight: 800 }}>Total ({weighbridgeData.length} weighings)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(totalAmount)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>File name for the Excel file.</DialogContentText>
          <TextField autoFocus margin="dense" label="File name" type="text" fullWidth value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleExport} variant="contained">Export</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!reopenRow} onClose={() => !reopenBusy && setReopenRow(null)}>
        <DialogTitle>Reopen this weighing?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {reopenRow &&
              `Voucher ${reopenRow.voucher_number} of ${reopenRow.vehicle_number} at ${reopenRow.branch_code} will be open again, so the vehicle's next weighing there is its second weight, free. Any other open weighing of this vehicle at that branch is closed.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReopenRow(null)} disabled={reopenBusy}>
            Cancel
          </Button>
          <Button onClick={reopenWeighing} disabled={reopenBusy} variant="contained">
            Reopen
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!photo} onClose={closePhoto} maxWidth="md" fullWidth fullScreen={phone}>
        <DialogTitle sx={{ fontSize: { xs: 16, sm: 20 } }}>
          {photo && `${photo.row.vehicle_number} · voucher ${photo.row.voucher_number} · ${fmtDate(photo.row.voucher_date)}`}
        </DialogTitle>
        <DialogContent>
          {photo?.url && <img src={photo.url} alt="Weighbridge camera" style={{ width: "100%" }} />}
          {photo?.error && <DialogContentText>{photo.error}</DialogContentText>}
          {photo && !photo.url && !photo.error && <DialogContentText>Loading photo…</DialogContentText>}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePhoto}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WeighBridge;
