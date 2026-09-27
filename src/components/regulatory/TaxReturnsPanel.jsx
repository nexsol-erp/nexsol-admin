// TaxReturnsPanel.jsx
// Periodic tax returns (HMRC Making Tax Digital for VAT): the periods the tax authority expects,
// a return proposed from the ERP's sales and purchases to check and file, the filing history,
// and what the authority says is owed and paid. Filing is a legal declaration for the business.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import {
  checkClientInfo, formatDateTime, listConfigs, listProviders, statusColor, submitTaxReturn, taxLiabilities,
  taxObligations, taxPayments, taxReturnDraft, taxReturnHistory,
} from "./regulatoryApi";

const money = (v) => (v === null || v === undefined ? "" : Number(v).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}));

const isoDaysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

const TaxReturnsPanel = () => {
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState("");
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([listProviders(), listConfigs()]);
      const taxProviders = (p.ok ? p.data : []).filter((x) => x.capabilities?.includes("TAX_RETURN"));
      const configured = taxProviders.filter((x) => (c.ok ? c.data : []).some((k) => k.providerCode === x.providerCode));
      setProviders(configured.map((x) => ({ ...x, config: c.data.find((k) => k.providerCode === x.providerCode) })));
      if (configured.length) setProvider(configured[0].providerCode);
      setError(!p.ok ? p.message : !c.ok ? c.message : "");
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    setConfig(providers.find((x) => x.providerCode === provider)?.config || null);
  }, [provider, providers]);

  if (loading) return <CircularProgress size={24} />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!providers.length) {
    return (
      <Alert severity="info">
        No tax return provider is set up. Set up HMRC Making Tax Digital for VAT under Provider setup and connect to HMRC.
      </Alert>
    );
  }

  return (
    <Box>
      {providers.length > 1 && (
        <TextField select size="small" label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)}
          sx={{ mb: 2, minWidth: 320 }}>
          {providers.map((p) => <MenuItem key={p.providerCode} value={p.providerCode}>{p.displayName}</MenuItem>)}
        </TextField>
      )}
      {config && !config.enabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>This provider is not enabled; enable it in Provider setup before filing.</Alert>
      )}
      <Obligations provider={provider} sandbox={config?.environment === "SANDBOX"} />
      <History provider={provider} />
      <Account provider={provider} />
    </Box>
  );
};

const Obligations = ({ provider, sandbox }) => {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("O");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState(null);
  const [preparing, setPreparing] = useState(null);

  const load = useCallback(async () => {
    if (!provider) return;
    setLoading(true);
    const params = status === "O" ? { status } : { status, from: isoDaysAgo(365), to: new Date().toISOString().slice(0, 10) };
    const r = await taxObligations(provider, params);
    setRows(r.ok ? r.data : []);
    setError(r.ok ? "" : r.message);
    setLoading(false);
  }, [provider, status]);

  useEffect(() => {
    load();
  }, [load]);

  const runCheck = async () => {
    setChecks(null);
    const r = await checkClientInfo(provider);
    setChecks(r.ok ? r.data : [r.message]);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={1}>
        <Typography variant="h6">VAT periods</Typography>
        <TextField select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="O">Open</MenuItem>
          <MenuItem value="F">Filed, last 12 months</MenuItem>
        </TextField>
        <Button onClick={load} disabled={loading}>Refresh</Button>
        {sandbox && <Button onClick={runCheck}>Check fraud headers</Button>}
        {loading && <CircularProgress size={20} />}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {checks && (
        <Alert severity={checks.some((c) => /^error|INVALID_HEADERS/.test(c)) ? "warning" : "info"} sx={{ mb: 1 }}
          onClose={() => setChecks(null)}>
          {checks.map((c, i) => <div key={i}>{c}</div>)}
        </Alert>
      )}
      {rows && rows.length === 0 && !error && <Alert severity="info">No {status === "O" ? "open" : "filed"} VAT periods.</Alert>}
      {rows && rows.length > 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Period</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>Due</TableCell>
              <TableCell>Status</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((o) => (
              <TableRow key={o.periodKey}>
                <TableCell sx={{ fontFamily: "monospace" }}>{o.periodKey}</TableCell>
                <TableCell>{o.start}</TableCell>
                <TableCell>{o.end}</TableCell>
                <TableCell>{o.due}</TableCell>
                <TableCell>
                  {o.status === "F"
                    ? <Chip size="small" color="success" label={`Filed ${o.received || ""}`} />
                    : <Chip size="small" color="warning" label="Open" />}
                </TableCell>
                <TableCell align="right">
                  {o.status !== "F" && <Button size="small" variant="contained" onClick={() => setPreparing(o)}>Prepare return</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {preparing && (
        <ReturnDialog provider={provider} obligation={preparing}
          onClose={(filed) => { setPreparing(null); if (filed) load(); }} />
      )}
    </Box>
  );
};

const ReturnDialog = ({ provider, obligation, onClose }) => {
  const [draft, setDraft] = useState(null);
  const [values, setValues] = useState({});
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState(null);

  useEffect(() => {
    (async () => {
      const r = await taxReturnDraft(provider, { periodKey: obligation.periodKey, from: obligation.start, to: obligation.end });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setDraft(r.data);
      const v = {};
      Object.entries(r.data.values || {}).forEach(([k, n]) => { v[k] = n === null ? "" : String(n); });
      setValues(v);
    })();
  }, [provider, obligation]);

  // Boxes 3 and 5 as the server will work them out, so the person sees what is filed.
  const shown = useMemo(() => {
    const n = (k) => Number(values[k] || 0);
    const total = Math.round((n("vatDueSales") + n("vatDueAcquisitions")) * 100) / 100;
    return { ...values, totalVatDue: total.toFixed(2),
      netVatDue: Math.abs(Math.round((total - n("vatReclaimedCurrPeriod")) * 100) / 100).toFixed(2) };
  }, [values]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    const boxes = {};
    (draft.boxes || []).filter((b) => !b.calculated).forEach((b) => { boxes[b.key] = values[b.key] === "" ? null : values[b.key]; });
    const r = await submitTaxReturn(provider, {
      periodKey: obligation.periodKey, periodStart: obligation.start, periodEnd: obligation.end, boxes,
      declarationAccepted: declared,
    });
    setSubmitting(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setOutcome(r.data);
  };

  const filed = outcome && ["ACCEPTED", "CLEARED", "REPORTED"].includes(outcome.status);

  return (
    <Dialog open onClose={() => onClose(filed)} maxWidth="md" fullWidth>
      <DialogTitle>VAT return {obligation.periodKey}: {obligation.start} to {obligation.end}</DialogTitle>
      <DialogContent>
        {!draft && !error && <CircularProgress size={24} />}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {outcome && (
          <Alert severity={filed ? "success" : "error"} sx={{ mb: 2 }}>
            <div>{outcome.message}</div>
            {Object.entries(outcome.receipt || {}).map(([k, v]) => <div key={k}><b>{k}</b>: {v}</div>)}
            {(outcome.errors || []).map((e, i) => <div key={i}>{e.code} {e.field || ""}: {e.message}</div>)}
          </Alert>
        )}
        {draft && (
          <>
            {(draft.totals?.notes || []).map((n, i) => <Alert key={i} severity="info" sx={{ mb: 1 }}>{n}</Alert>)}
            {draft.previousAttempts?.length > 0 && (
              <Alert severity="warning" sx={{ mb: 1 }}>
                Earlier attempts for this period: {draft.previousAttempts.map((a) => `${a.status} ${formatDateTime(a.createdAt)}`).join(", ")}
              </Alert>
            )}
            <Table size="small">
              <TableBody>
                {draft.boxes.map((b) => (
                  <TableRow key={b.key}>
                    <TableCell sx={{ width: 60, fontWeight: 600 }}>Box {b.number}</TableCell>
                    <TableCell>{b.label}</TableCell>
                    <TableCell sx={{ width: 200 }}>
                      <TextField size="small" fullWidth value={shown[b.key] ?? ""} disabled={b.calculated || filed}
                        onChange={(e) => setValues((v) => ({ ...v, [b.key]: e.target.value }))}
                        inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
                        helperText={b.wholeUnits ? "Whole pounds" : ""} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {draft.declaration && !filed && (
              <FormControlLabel sx={{ mt: 2, alignItems: "flex-start" }}
                control={<Checkbox checked={declared} onChange={(e) => setDeclared(e.target.checked)} />}
                label={draft.declaration} />
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(filed)}>{filed ? "Close" : "Cancel"}</Button>
        {!filed && (
          <Button variant="contained" onClick={submit}
            disabled={!draft || submitting || (draft.declaration && !declared)}>
            {submitting ? "Submitting..." : "Submit to HMRC"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const History = ({ provider }) => {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!provider) return;
    (async () => {
      const r = await taxReturnHistory(provider);
      setRows(r.ok ? r.data : []);
    })();
  }, [provider]);

  if (!rows.length) return null;
  return (
    <Box mt={4}>
      <Typography variant="h6" mb={1}>Filing history</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Period</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>When</TableCell>
            <TableCell>By</TableCell>
            <TableCell>Receipt</TableCell>
            <TableCell align="right">Box 5</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell sx={{ fontFamily: "monospace" }}>{s.sourceId}</TableCell>
              <TableCell><Chip size="small" color={statusColor(s.status)} label={s.status} /></TableCell>
              <TableCell>{formatDateTime(s.createdAt)}</TableCell>
              <TableCell>{s.createdBy}</TableCell>
              <TableCell>{s.externalSubmissionId || s.lastError || ""}</TableCell>
              <TableCell align="right">{money(s.totalAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

const Account = ({ provider }) => {
  const [from, setFrom] = useState(isoDaysAgo(364));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [liabilities, setLiabilities] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    const [l, p] = await Promise.all([taxLiabilities(provider, { from, to }), taxPayments(provider, { from, to })]);
    setLiabilities(l.ok ? l.data : []);
    setPayments(p.ok ? p.data : []);
    setError(!l.ok ? l.message : !p.ok ? p.message : "");
  };

  return (
    <Box mt={4}>
      <Stack direction="row" spacing={2} alignItems="center" mb={1}>
        <Typography variant="h6">Liabilities and payments</Typography>
        <TextField size="small" type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)}
          InputLabelProps={{ shrink: true }} />
        <TextField size="small" type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)}
          InputLabelProps={{ shrink: true }} />
        <Button onClick={load}>Show</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {liabilities && (
        <Table size="small" sx={{ mb: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Liability</TableCell>
              <TableCell>Period</TableCell>
              <TableCell>Due</TableCell>
              <TableCell align="right">Original</TableCell>
              <TableCell align="right">Outstanding</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {liabilities.length === 0 && <TableRow><TableCell colSpan={5}>None in this range.</TableCell></TableRow>}
            {liabilities.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.type}</TableCell>
                <TableCell>{l.periodFrom} to {l.periodTo}</TableCell>
                <TableCell>{l.due}</TableCell>
                <TableCell align="right">{money(l.originalAmount)}</TableCell>
                <TableCell align="right">{money(l.outstandingAmount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {payments && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Payment received</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.length === 0 && <TableRow><TableCell colSpan={2}>None in this range.</TableCell></TableRow>}
            {payments.map((p, i) => (
              <TableRow key={i}>
                <TableCell>{p.received}</TableCell>
                <TableCell align="right">{money(p.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
};

export default TaxReturnsPanel;
