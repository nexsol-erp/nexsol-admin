import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Weight-Count (Bridge Count): vehicles that stood on the weighbridge against vouchers saved.
 *
 * The weighbridge PC reports every visit to the bridge (empty before and after, with its highest
 * stable weight and a photo), whether or not a voucher is saved. Visits at or above the gate weight
 * count as vehicles; each is paired with a weighing or tare voucher saved near that time, and one
 * left without a voucher was weighed with no voucher. The gap per day is vehicles on the bridge
 * minus vouchers saved. The window and gate weight are set here (wb_settings, V087).
 */
const fmt = (v) => (v ? dayjs(v).format("DD-MM-YYYY HH:mm:ss") : "-");

const WeighBridgeEngageReport = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(dayjs().startOf("day").format("YYYY-MM-DDTHH:mm"));
  const [toDate, setToDate] = useState(dayjs().add(1, "day").startOf("day").format("YYYY-MM-DDTHH:mm"));
  const [report, setReport] = useState(null);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ matchBeforeMin: "", matchAfterMin: "", gateKg: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);
  const [photo, setPhoto] = useState(null);

  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        setBranches(data.branches || []);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [tenancyId, token]);

  const applySettings = (s) => {
    setSettings(s);
    setForm({ matchBeforeMin: String(s.matchBeforeMin), matchAfterMin: String(s.matchAfterMin), gateKg: String(s.gateKg) });
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/weighbridge/bridge-count/settings`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) applySettings(await res.json());
      } catch (e) {
        // the report still works with the server's defaults
      }
    })();
  }, [tenancyId, token]);

  const saveSettings = async () => {
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      const res = await fetch(`/api/${tenancyId}/weighbridge/bridge-count/settings`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          matchBeforeMin: Number(form.matchBeforeMin),
          matchAfterMin: Number(form.matchAfterMin),
          gateKg: Number(form.gateKg),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      applySettings(data);
      setSettingsMsg({ severity: "success", text: "Saved. Click Show to count again with these settings." });
    } catch (e) {
      setSettingsMsg({ severity: "error", text: e.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const settingsDirty =
    settings &&
    (form.matchBeforeMin !== String(settings.matchBeforeMin) ||
      form.matchAfterMin !== String(settings.matchAfterMin) ||
      form.gateKg !== String(settings.gateKg));

  const openPhoto = async (e) => {
    setPhoto({ event: e, url: null, error: "" });
    try {
      const q = new URLSearchParams({ branch, dateTime: e.dateTime });
      const res = await fetch(`/api/${tenancyId}/weighbridge/engage/photo?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("No photo for this vehicle");
      const url = URL.createObjectURL(await res.blob());
      setPhoto((p) => (p && p.event === e ? { ...p, url } : p));
    } catch (err) {
      setPhoto((p) => (p && p.event === e ? { ...p, error: err.message } : p));
    }
  };

  const closePhoto = () => {
    if (photo?.url) URL.revokeObjectURL(photo.url);
    setPhoto(null);
  };

  const load = async () => {
    if (!branch) {
      setError("Choose a branch");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const q = new URLSearchParams({ branch, from: fromDate, to: toDate });
      const res = await fetch(`/api/${tenancyId}/weighbridge/bridge-count?${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setReport(data);
    } catch (e) {
      setReport(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setDay = (offset) => {
    const d = dayjs().add(offset, "day").startOf("day");
    setFromDate(d.format("YYYY-MM-DDTHH:mm"));
    setToDate(d.add(1, "day").format("YYYY-MM-DDTHH:mm"));
  };

  const events = useMemo(
    () => (report?.events || []).filter((e) => !onlyMissing || !e.voucherNumber),
    [report, onlyMissing]
  );

  const exportExcel = () => {
    if (!report) return;
    const wb = XLSX.utils.book_new();
    const days = [...report.days, report.total].map((d) => ({
      Date: d.date,
      "Vehicles on bridge": d.onBridge,
      "Weighing vouchers": d.weighings,
      "Tare vouchers": d.tares,
      Gap: d.gap,
      "Without a voucher": d.noVoucher,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(days), "By day");
    const rows = report.events.map((e) => ({
      Time: fmt(e.dateTime),
      "Weight (kg)": e.weight,
      Voucher: e.voucherNumber || "NO VOUCHER",
      Type: e.kind || "",
      Vehicle: e.vehicleNumber || "",
      Photo: e.photo ? "Yes" : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Vehicles");
    const blob = new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" });
    saveAs(blob, `Bridge-count-${branch}-${dayjs(fromDate).format("YYYY-MM-DD")}.xlsx`);
  };

  const total = report?.total;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Weight-Count: vehicles on the bridge vs vouchers
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The weighbridge PC reports every vehicle that stands on the bridge, even when no voucher is saved: the bridge
        was empty before it came on and after it left, and its weight is at least the gate weight below. A vehicle
        with no weighing or tare voucher near its time is shown as "No voucher".
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          Settings for every branch
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center" }}>
          <TextField
            size="small"
            type="number"
            label="Voucher up to (min) before"
            value={form.matchBeforeMin}
            onChange={(e) => setForm({ ...form, matchBeforeMin: e.target.value })}
            inputProps={{ min: 0, max: 60 }}
            sx={{ width: 210 }}
            disabled={!settings}
          />
          <TextField
            size="small"
            type="number"
            label="Voucher up to (min) after"
            value={form.matchAfterMin}
            onChange={(e) => setForm({ ...form, matchAfterMin: e.target.value })}
            inputProps={{ min: 1, max: 120 }}
            sx={{ width: 210 }}
            disabled={!settings}
          />
          <TextField
            size="small"
            type="number"
            label="Gate weight (kg)"
            value={form.gateKg}
            onChange={(e) => setForm({ ...form, gateKg: e.target.value })}
            inputProps={{ min: 0, max: 100000 }}
            sx={{ width: 160 }}
            disabled={!settings}
          />
          <Button variant="outlined" onClick={saveSettings} disabled={!settings || !settings.installed || !settingsDirty || savingSettings}>
            {savingSettings ? "Saving…" : "Save settings"}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          A vehicle is paired with a voucher saved within these minutes of the time it stood on the bridge. Lighter
          visits than the gate weight (people, bikes) are not counted.
        </Typography>
        {settings && !settings.installed && (
          <Alert severity="info" sx={{ mt: 1 }}>
            Using the defaults (5 min before, 10 min after, 200 kg). Run the V087 migration on the server to change them.
          </Alert>
        )}
        {settingsMsg && <Alert severity={settingsMsg.severity} sx={{ mt: 1 }}>{settingsMsg.text}</Alert>}
      </Paper>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 2 }}>
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel id="bc-branch">Branch</InputLabel>
          <Select labelId="bc-branch" label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => (
              <MenuItem key={b.id} value={b.branchCode}>
                {b.branchCode}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="datetime-local"
          label="From"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label="To"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button size="small" onClick={() => setDay(0)}>Today</Button>
        <Button size="small" onClick={() => setDay(-1)}>Yesterday</Button>
        <Button variant="contained" onClick={load} disabled={busy}>
          {busy ? "Loading…" : "Show"}
        </Button>
        <Button variant="outlined" onClick={exportExcel} disabled={!report}>
          Export to Excel
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {total && (
        <Alert severity={total.noVoucher > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
          {total.onBridge} vehicle(s) on the bridge, {total.vouchers} voucher(s) saved
          {total.noVoucher > 0 ? `: ${total.noVoucher} vehicle(s) with no voucher.` : ": every vehicle has a voucher."}
        </Alert>
      )}

      {report && (
        <TableContainer component={Paper} sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell align="right">Vehicles on bridge</TableCell>
                <TableCell align="right">Weighing vouchers</TableCell>
                <TableCell align="right">Tare vouchers</TableCell>
                <TableCell align="right">Gap</TableCell>
                <TableCell align="right">Without a voucher</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.days.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    Nothing in this period.
                  </TableCell>
                </TableRow>
              )}
              {[...report.days, ...(report.days.length > 1 ? [report.total] : [])].map((d) => (
                <TableRow key={d.date}>
                  <TableCell sx={{ fontWeight: d.date === "Total" ? 700 : 400 }}>
                    {d.date === "Total" ? "Total" : dayjs(d.date).format("DD-MM-YYYY")}
                  </TableCell>
                  <TableCell align="right">{d.onBridge}</TableCell>
                  <TableCell align="right">{d.weighings}</TableCell>
                  <TableCell align="right">{d.tares}</TableCell>
                  <TableCell align="right" sx={{ color: d.gap > 0 ? "error.main" : undefined, fontWeight: d.gap > 0 ? 700 : 400 }}>
                    {d.gap}
                  </TableCell>
                  <TableCell align="right" sx={{ color: d.noVoucher > 0 ? "error.main" : undefined, fontWeight: d.noVoucher > 0 ? 700 : 400 }}>
                    {d.noVoucher}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {report && (
        <>
          <FormControlLabel
            control={<Switch checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />}
            label="Only vehicles with no voucher"
          />
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Time on bridge</TableCell>
                  <TableCell align="right">Weight (kg)</TableCell>
                  <TableCell>Voucher</TableCell>
                  <TableCell>Vehicle</TableCell>
                  <TableCell>Photo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      {onlyMissing ? "Every vehicle has a voucher." : "No vehicles in this period."}
                    </TableCell>
                  </TableRow>
                )}
                {events.map((e) => (
                  <TableRow
                    key={e.dateTime}
                    sx={
                      e.voucherNumber
                        ? undefined
                        : {
                            // a light tint of the theme's red, so the text stays readable in dark and light mode
                            bgcolor: (theme) => alpha(theme.palette.error.main, theme.palette.mode === "dark" ? 0.18 : 0.1),
                            "& td:first-of-type": { boxShadow: (theme) => `inset 4px 0 0 ${theme.palette.error.main}` },
                          }
                    }
                  >
                    <TableCell>{fmt(e.dateTime)}</TableCell>
                    <TableCell align="right">{e.weight}</TableCell>
                    <TableCell>
                      {e.voucherNumber ? (
                        `${e.voucherNumber}${e.kind === "Tare" ? " (tare)" : ""}`
                      ) : (
                        <Chip size="small" color="error" label="No voucher" />
                      )}
                    </TableCell>
                    <TableCell>{e.vehicleNumber || ""}</TableCell>
                    <TableCell>
                      {e.photo ? (
                        <Button size="small" onClick={() => openPhoto(e)}>
                          View
                        </Button>
                      ) : (
                        ""
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Dialog open={!!photo} onClose={closePhoto} maxWidth="md" fullWidth>
        <DialogTitle>
          {photo && `${fmt(photo.event.dateTime)} · ${photo.event.weight} kg · `}
          {photo && (photo.event.voucherNumber ? `Voucher ${photo.event.voucherNumber}` : "No voucher")}
        </DialogTitle>
        <DialogContent sx={{ display: "flex", justifyContent: "center", minHeight: 200, alignItems: "center" }}>
          {photo?.error && <Alert severity="warning">{photo.error}</Alert>}
          {photo && !photo.error && !photo.url && <CircularProgress />}
          {photo?.url && <img src={photo.url} alt="Vehicle on the bridge" style={{ maxWidth: "100%", maxHeight: "70vh" }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePhoto}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WeighBridgeEngageReport;
