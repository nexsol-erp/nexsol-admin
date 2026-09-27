// EwayBillsPanel.jsx
// India e-way bills: pick a sale, enter how the goods travel, and generate the e-way bill on the
// NIC portal. Issued bills can get a new vehicle (Part-B) or be cancelled within 24 hours. Nothing
// here runs on sale save; each bill is made on request.
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import {
  cancelSubmission, createTransportDocument, findSales, formatDateTime, listConfigs, listProviders,
  listSubmissions, statusColor, SUCCESS_STATUSES, updateTransport,
} from "./regulatoryApi";
import { SubmissionDialog } from "./SubmissionsPanel";

const MODES = [
  ["ROAD", "Road"],
  ["RAIL", "Rail"],
  ["AIR", "Air"],
  ["SHIP", "Ship"],
];

const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const money = (v) => (v === null || v === undefined ? "" : Number(v).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}));

const EMPTY_TRANSPORT = {
  mode: "ROAD", distanceKm: "", vehicleNumber: "", vehicleType: "REGULAR", transporterId: "", transporterName: "",
  documentNumber: "", documentDate: "",
  toAddress: "", toPlace: "", toPincode: "", toState: "",
  fromPlace: "", fromPincode: "", fromState: "",
};

const EwayBillsPanel = () => {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([listProviders(), listConfigs()]);
      const configs = c.ok ? c.data : [];
      const found = (p.ok ? p.data : [])
        .filter((x) => x.capabilities?.includes("TRANSPORT_DOCUMENT"))
        .find((x) => configs.some((k) => k.providerCode === x.providerCode && k.enabled));
      setProvider(found || null);
      setError(!p.ok ? p.message : !c.ok ? c.message : "");
      setLoading(false);
    })();
  }, []);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!provider) {
    return (
      <Alert severity="info">
        No e-way bill provider is enabled. Set up India e-way bill (NIC) under Provider setup and enable it.
      </Alert>
    );
  }

  return (
    <Box>
      <NewEwayBill provider={provider} onCreated={() => setReload((n) => n + 1)} />
      <IssuedEwayBills provider={provider} reload={reload} />
    </Box>
  );
};

// ---- pick a sale and generate ----

const NewEwayBill = ({ provider, onCreated }) => {
  const [search, setSearch] = useState({ invoiceNumber: "", from: isoDaysAgo(7), to: isoDaysAgo(0) });
  const [sales, setSales] = useState(null);
  const [searching, setSearching] = useState(false);
  const [sale, setSale] = useState(null);
  const [transport, setTransport] = useState(EMPTY_TRANSPORT);
  const [elsewhere, setElsewhere] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const find = async () => {
    setSearching(true);
    const r = await findSales(search);
    setSearching(false);
    setSales(r.ok ? r.data : []);
    setNotice(r.ok ? null : { severity: "error", text: r.message });
  };

  const setS = (field) => (e) => setSearch((s) => ({ ...s, [field]: e.target.value }));
  const setT = (field) => (e) => setTransport((t) => ({ ...t, [field]: e.target.value }));

  const generate = async () => {
    setBusy(true);
    const body = elsewhere ? transport : {
      ...transport, toAddress: "", toPlace: "", toPincode: "", toState: "", fromPlace: "", fromPincode: "", fromState: "",
    };
    const r = await createTransportDocument(provider.providerCode, sale.id, body);
    setBusy(false);
    const out = r.data;
    if (out?.errors?.length) {
      setNotice({ severity: "error", text: out.errors.map((e) => e.message).join(" ") });
    } else if (!r.ok) {
      setNotice({ severity: "error", text: r.message });
    } else if (out?.duplicate && SUCCESS_STATUSES.includes(out.submission?.status)) {
      setNotice({ severity: "info", text: `This sale already has e-way bill ${out.submission.externalReference || ""}. Cancel it first to make a new one.` });
    } else {
      const s = out?.submission;
      const ok = s && SUCCESS_STATUSES.includes(s.status);
      setNotice(ok
        ? { severity: "success", text: `E-way bill ${s.externalReference} generated for ${sale.invoiceNumber}.` }
        : { severity: "warning", text: `The e-way bill is ${s?.status || "not generated"}. ${s?.lastError || ""}` });
      if (ok) {
        setSale(null);
        setTransport(EMPTY_TRANSPORT);
        setElsewhere(false);
      }
      onCreated();
    }
  };

  return (
    <Box mb={4}>
      <Typography variant="h6" mb={1}>New e-way bill</Typography>
      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}

      {!sale ? (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} mb={2}>
            <TextField size="small" label="Invoice number" value={search.invoiceNumber} onChange={setS("invoiceNumber")} />
            <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={search.from} onChange={setS("from")} />
            <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={search.to} onChange={setS("to")} />
            <Button variant="contained" onClick={find} disabled={searching}>Find sales</Button>
          </Stack>
          {searching && <CircularProgress size={24} />}
          {sales && !searching && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>{s.invoiceNumber}</TableCell>
                    <TableCell>{formatDateTime(s.invoiceDate)}</TableCell>
                    <TableCell>{s.customerName || "-"}</TableCell>
                    <TableCell>{s.customerGstin || "Unregistered"}</TableCell>
                    <TableCell align="right">{money(s.amount)}</TableCell>
                    <TableCell><Button size="small" onClick={() => { setSale(s); setNotice(null); }}>Select</Button></TableCell>
                  </TableRow>
                ))}
                {sales.length === 0 && <TableRow><TableCell colSpan={6}>No sales match.</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setSale(null)}>Change</Button>}>
            {sale.invoiceNumber} to {sale.customerName || "customer"}, {money(sale.amount)}
          </Alert>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={4}>
              <TextField select fullWidth size="small" label="Mode" value={transport.mode} onChange={setT("mode")}>
                {MODES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="number" label="Distance (km)" value={transport.distanceKm}
                onChange={setT("distanceKm")} helperText="0 lets the portal work it out" />
            </Grid>
            {transport.mode === "ROAD" ? (
              <>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="Vehicle number" value={transport.vehicleNumber}
                    onChange={setT("vehicleNumber")} placeholder="KA01AB1234" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField select fullWidth size="small" label="Vehicle type" value={transport.vehicleType} onChange={setT("vehicleType")}>
                    <MenuItem value="REGULAR">Regular</MenuItem>
                    <MenuItem value="ODC">Over-dimensional cargo</MenuItem>
                  </TextField>
                </Grid>
              </>
            ) : null}
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Transporter GSTIN / ID" value={transport.transporterId} onChange={setT("transporterId")} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Transporter name" value={transport.transporterName} onChange={setT("transporterName")} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label={transport.mode === "ROAD" ? "LR number" : "RR / airway bill / bill of lading"}
                value={transport.documentNumber} onChange={setT("documentNumber")} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" type="date" label="Document date" InputLabelProps={{ shrink: true }}
                value={transport.documentDate} onChange={setT("documentDate")} />
            </Grid>
          </Grid>

          <Button size="small" sx={{ mt: 1 }} onClick={() => setElsewhere((v) => !v)}>
            {elsewhere ? "Use the billing and seller addresses" : "Goods go to or leave from another address"}
          </Button>
          <Collapse in={elsewhere}>
            <Grid container spacing={1.5} mt={0.5}>
              <Grid item xs={12}><Typography variant="subtitle2">Ship to</Typography></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Address" value={transport.toAddress} onChange={setT("toAddress")} /></Grid>
              <Grid item xs={12} sm={2}><TextField fullWidth size="small" label="Place" value={transport.toPlace} onChange={setT("toPlace")} /></Grid>
              <Grid item xs={6} sm={2}><TextField fullWidth size="small" label="PIN" value={transport.toPincode} onChange={setT("toPincode")} /></Grid>
              <Grid item xs={6} sm={2}><TextField fullWidth size="small" label="State" value={transport.toState} onChange={setT("toState")} /></Grid>
              <Grid item xs={12}><Typography variant="subtitle2">Dispatch from</Typography></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Place" value={transport.fromPlace} onChange={setT("fromPlace")} /></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="PIN" value={transport.fromPincode} onChange={setT("fromPincode")} /></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="State" value={transport.fromState} onChange={setT("fromState")} /></Grid>
            </Grid>
          </Collapse>

          <Box mt={2}>
            <Button variant="contained" onClick={generate} disabled={busy}>
              {busy ? "Generating..." : "Generate e-way bill"}
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

// ---- issued bills ----

const IssuedEwayBills = ({ provider, reload }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [vehicleFor, setVehicleFor] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await listSubmissions({ provider: provider.providerCode, page: 0, size: 50 });
    setRows(r.ok ? r.data.items : []);
    setError(r.ok ? "" : r.message);
    setLoading(false);
  }, [provider]);

  useEffect(() => {
    load();
  }, [load, reload]);

  const cancel = async (s) => {
    const reason = window.prompt(`Why cancel e-way bill ${s.externalReference}?`);
    if (!reason || !reason.trim()) return;
    const r = await cancelSubmission(s.id, reason.trim());
    setNotice(r.ok ? { severity: "success", text: `E-way bill ${s.externalReference} cancelled.` } : { severity: "error", text: r.message });
    load();
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={1}>
        <Typography variant="h6">E-way bills</Typography>
        <Box flexGrow={1} />
        <Button onClick={load}>Refresh</Button>
      </Stack>
      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? <CircularProgress size={24} /> : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Invoice</TableCell>
              <TableCell>E-way bill</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Problem</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((s) => {
              const live = SUCCESS_STATUSES.includes(s.status);
              return (
                <TableRow key={s.id} hover>
                  <TableCell sx={{ cursor: "pointer" }} onClick={() => setOpenId(s.id)}>{s.invoiceNumber || s.sourceId}</TableCell>
                  <TableCell>{s.externalReference || "-"}</TableCell>
                  <TableCell><Chip size="small" color={statusColor(s.status)} label={s.status} /></TableCell>
                  <TableCell>{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell sx={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.lastError || ""}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" onClick={() => setOpenId(s.id)}>Details</Button>
                    {live && <Button size="small" onClick={() => setVehicleFor(s)}>Update vehicle</Button>}
                    {live && <Button size="small" color="error" onClick={() => cancel(s)}>Cancel</Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={6}>No e-way bills yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      )}
      {openId && <SubmissionDialog id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
      {vehicleFor && (
        <VehicleDialog bill={vehicleFor} onClose={() => setVehicleFor(null)}
          onDone={(text) => { setVehicleFor(null); setNotice({ severity: "success", text }); load(); }} />
      )}
    </Box>
  );
};

const REASONS = [
  ["1", "Vehicle broke down"],
  ["2", "Transshipment"],
  ["3", "Others"],
  ["4", "First time"],
];

const VehicleDialog = ({ bill, onClose, onDone }) => {
  const [t, setT] = useState({
    mode: "ROAD", vehicleNumber: "", fromPlace: "", fromState: "", reasonCode: "1", reasonRemark: "",
    documentNumber: "", documentDate: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field) => (e) => setT((x) => ({ ...x, [field]: e.target.value }));

  const save = async () => {
    setBusy(true);
    const r = await updateTransport(bill.id, t);
    setBusy(false);
    if (r.ok) onDone(`Vehicle ${t.vehicleNumber || ""} added to e-way bill ${bill.externalReference}.`);
    else setError(r.message);
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Update vehicle for {bill.externalReference}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Mode" value={t.mode} onChange={set("mode")}>
              {MODES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Vehicle number" value={t.vehicleNumber} onChange={set("vehicleNumber")} placeholder="KA01AB1234" />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Leaving from (place)" value={t.fromPlace} onChange={set("fromPlace")} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="State" value={t.fromState} onChange={set("fromState")} />
          </Grid>
          <Grid item xs={6}>
            <TextField select fullWidth size="small" label="Reason" value={t.reasonCode} onChange={set("reasonCode")}>
              {REASONS.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Remark" value={t.reasonRemark} onChange={set("reasonRemark")} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" label="Transport document number" value={t.documentNumber} onChange={set("documentNumber")} />
          </Grid>
          <Grid item xs={6}>
            <TextField fullWidth size="small" type="date" label="Document date" InputLabelProps={{ shrink: true }}
              value={t.documentDate} onChange={set("documentDate")} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{busy ? "Saving..." : "Update vehicle"}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EwayBillsPanel;
