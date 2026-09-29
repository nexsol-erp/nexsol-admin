// Tally Integration: settings, the desktop connectors that talk to Tally, and ledger mapping.
// Everything is stored on the server; the Tally Connector app on the customer's PC reads it.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, MenuItem, Paper, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tabs, TextField, Tooltip, Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import {
  CATEGORY_LABELS, CONNECTOR_DOWNLOAD, TALLY_GROUPS, addConnector, getConnectors, getLedgerMap, getMasters,
  getSettings, newPairingCode, refreshMasters, renameConnector, revokeConnector, saveLedgerMap, saveSettings,
} from "./tallyApi";

const GROUPINGS = [
  { value: "BILL", label: "One voucher per bill" },
  { value: "DAILY", label: "Daily summary" },
  { value: "MONTHLY", label: "Monthly summary" },
];

const defaultGrouping = (cat) => (cat === "SALES" || cat === "SALES_RECEIPT" ? "DAILY" : "BILL");

function Section({ title, children, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={600}>{title}</Typography>
      {hint && <Typography variant="body2" color="text.secondary" mb={1.5}>{hint}</Typography>}
      {!hint && <Box mb={1.5} />}
      {children}
    </Paper>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsTab({ info, reload }) {
  const [s, setS] = useState(info.settings);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => setS(info.settings), [info]);

  const set = (k) => (e) => setS((p) => ({ ...p, [k]: e.target.value }));
  const setNum = (k) => (e) => setS((p) => ({ ...p, [k]: e.target.value === "" ? "" : Number(e.target.value) }));
  const setBool = (k) => (e) => setS((p) => ({ ...p, [k]: e.target.checked }));

  const categories = s.source === "ITEM" ? info.itemCategories : info.glCategories;
  const branches = info.branches || [];
  const selectedCats = s.categories && s.categories.length ? s.categories : categories;
  const selectedBranches = s.branches && s.branches.length ? s.branches : branches;

  const toggleIn = (key, all, value) => (e) => {
    setS((p) => {
      const cur = p[key] && p[key].length ? p[key] : all;
      const next = e.target.checked ? [...new Set([...cur, value])] : cur.filter((x) => x !== value);
      return { ...p, [key]: next.length === all.length ? [] : next };
    });
  };

  const setGrouping = (cat) => (e) => setS((p) => ({ ...p, grouping: { ...(p.grouping || {}), [cat]: e.target.value } }));
  const setBranchGrouping = (b) => (e) => setS((p) => {
    const next = { ...(p.branchSalesGrouping || {}) };
    if (e.target.value === "") delete next[b];
    else next[b] = e.target.value;
    return { ...p, branchSalesGrouping: next };
  });
  const setVchType = (cat) => (e) => setS((p) => ({ ...p, voucherTypeNames: { ...(p.voucherTypeNames || {}), [cat]: e.target.value } }));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const body = { ...s, endDate: s.endDate || null, startDate: s.startDate || null };
    const r = await saveSettings(body);
    setSaving(false);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setMsg({ severity: "success", text: "Saved. The connector picks it up on its next check-in (within a minute)." });
    reload();
  };

  const shapeWarning = info.settings.source !== s.source
    || info.settings.startDate !== s.startDate
    || JSON.stringify(info.settings.grouping || {}) !== JSON.stringify(s.grouping || {})
    || JSON.stringify(info.settings.branchSalesGrouping || {}) !== JSON.stringify(s.branchSalesGrouping || {});

  return (
    <Box>
      {info.problems?.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>Before syncing can start: {info.problems.join(" ")}</Alert>
      )}

      <Section title="Sync">
        <FormControlLabel control={<Switch checked={!!s.enabled} onChange={setBool("enabled")} />}
          label={s.enabled ? "On: vouchers are sent to Tally on the schedule below" : "Off: nothing is sent"} />
      </Section>

      <Section title="Tally connection" hint="As the PC running the Tally Connector sees Tally. Usually localhost and port 9000.">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={5}><TextField fullWidth size="small" label="Tally host or IP" value={s.tallyHost || ""} onChange={set("tallyHost")} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" type="number" label="Port" value={s.tallyPort} onChange={setNum("tallyPort")} /></Grid>
          <Grid item xs={12} sm={5}>
            <Autocomplete freeSolo options={info.tallyCompanies || []} value={s.tallyCompany || ""}
              onInputChange={(e, v) => { if (e) setS((p) => ({ ...p, tallyCompany: v })); }}
              renderInput={(params) => <TextField {...params} size="small" label="Tally company"
                helperText={info.tallyCompanies?.length ? "Companies open in Tally at the last check" : "Blank = the company open in Tally"} />} />
          </Grid>
        </Grid>
      </Section>

      <Section title="Schedule">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth size="small" label="Frequency" value={s.frequency} onChange={set("frequency")}>
              <MenuItem value="INTERVAL">Every few minutes</MenuItem>
              <MenuItem value="DAILY">Once a day</MenuItem>
            </TextField>
          </Grid>
          {s.frequency === "DAILY" ? (
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="time" label="At" InputLabelProps={{ shrink: true }} value={s.dailyAt} onChange={set("dailyAt")} /></Grid>
          ) : (
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="number" label="Every (minutes)" value={s.intervalMinutes} onChange={setNum("intervalMinutes")} /></Grid>
          )}
          <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="number" label="Vouchers per batch" value={s.batchSize} onChange={setNum("batchSize")} /></Grid>
        </Grid>
      </Section>

      <Section title="What to send">
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} sm={4}>
            <TextField select fullWidth size="small" label="Source" value={s.source} onChange={set("source")}
              helperText={s.source === "ITEM" ? "Sales and purchase bills with items, quantity and GST" : "Ledger vouchers from the books (needs accounting on)"}>
              <MenuItem value="GL">GL vouchers</MenuItem>
              <MenuItem value="ITEM">Item invoices</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="Start date" InputLabelProps={{ shrink: true }} value={s.startDate || ""} onChange={set("startDate")} helperText="Nothing earlier is sent" /></Grid>
          <Grid item xs={6} sm={3}><TextField fullWidth size="small" type="date" label="End date (optional)" InputLabelProps={{ shrink: true }} value={s.endDate || ""} onChange={set("endDate")} /></Grid>
          <Grid item xs={6} sm={2}><TextField fullWidth size="small" type="number" label="Re-check days" value={s.rescanDays} onChange={setNum("rescanDays")} helperText="Late or edited bills" /></Grid>
        </Grid>
        {shapeWarning && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Changing the source, start date or grouping re-checks everything from the start date: vouchers already sent the old way are cancelled in Tally and sent again the new way.
          </Alert>
        )}

        <Typography variant="body2" fontWeight={600} mb={1}>Voucher types</Typography>
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>Send</TableCell><TableCell>Our vouchers</TableCell><TableCell>Grouping</TableCell><TableCell>Tally voucher type</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c}>
                  <TableCell padding="checkbox"><Checkbox checked={selectedCats.includes(c)} onChange={toggleIn("categories", categories, c)} /></TableCell>
                  <TableCell>{CATEGORY_LABELS[c] || c}</TableCell>
                  <TableCell>
                    <TextField select size="small" value={(s.grouping || {})[c] || defaultGrouping(c)} onChange={setGrouping(c)} sx={{ minWidth: 190 }}>
                      {GROUPINGS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField size="small" placeholder="Default" value={(s.voucherTypeNames || {})[c] || ""} onChange={setVchType(c)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="body2" fontWeight={600} mb={1}>Branches and POS sales grouping</Typography>
        <Typography variant="body2" color="text.secondary" mb={1}>
          POS sales{s.source === "GL" ? " and POS receipts" : ""} can be grouped differently per branch. Blank uses the Sales grouping above.
        </Typography>
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Send</TableCell><TableCell>Branch</TableCell><TableCell>POS sales</TableCell></TableRow></TableHead>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b}>
                  <TableCell padding="checkbox"><Checkbox checked={selectedBranches.includes(b)} onChange={toggleIn("branches", branches, b)} /></TableCell>
                  <TableCell>{b}</TableCell>
                  <TableCell>
                    <TextField select size="small" value={(s.branchSalesGrouping || {})[b] || ""} onChange={setBranchGrouping(b)} sx={{ minWidth: 190 }}
                      SelectProps={{ displayEmpty: true }}>
                      <MenuItem value=""><em>Same as Sales</em></MenuItem>
                      {GROUPINGS.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
                    </TextField>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControlLabel control={<Checkbox checked={!!s.waitForPeriodClose} onChange={setBool("waitForPeriodClose")} />}
              label="Send daily and monthly summaries once the day or month is over" />
            <FormControlLabel control={<Checkbox checked={!!s.resendEdits} onChange={setBool("resendEdits")} />}
              label="Send vouchers edited after syncing again (updates Tally)" />
            <FormControlLabel control={<Checkbox checked={!!s.useOurVoucherNumbers} onChange={setBool("useOurVoucherNumbers")} />}
              label="Use our voucher numbers in Tally" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select fullWidth size="small" label="Cancelled or deleted here" value={s.cancelledAction} onChange={set("cancelledAction")} sx={{ mb: 2 }}>
              <MenuItem value="CANCEL">Cancel the voucher in Tally</MenuItem>
              <MenuItem value="DELETE">Delete the voucher in Tally</MenuItem>
              <MenuItem value="IGNORE">Leave Tally as it is</MenuItem>
            </TextField>
            <TextField fullWidth size="small" label="Narration" value={s.narrationTemplate || ""} onChange={set("narrationTemplate")}
              helperText="{narration} {number} {branch} {date} {count}" />
          </Grid>
        </Grid>
      </Section>

      <Section title="Ledgers and masters">
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <FormControlLabel control={<Checkbox checked={!!s.autoCreateMasters} onChange={setBool("autoCreateMasters")} />}
              label="Create missing ledgers, items, units and cost centres in Tally" />
            <FormControlLabel control={<Checkbox checked={!!s.partyLedgers} onChange={setBool("partyLedgers")} />}
              label="Each customer and supplier gets their own ledger" />
            <FormControlLabel control={<Checkbox checked={!!s.costCentres} onChange={setBool("costCentres")} />}
              label="Branch as cost centre on income and expense lines" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Stack spacing={2}>
              <TextField size="small" label="Walk-in / POS summary party" value={s.cashPartyLedger || ""} onChange={set("cashPartyLedger")} />
              <TextField size="small" label="Round-off ledger" value={s.roundOffLedger || ""} onChange={set("roundOffLedger")} />
              {s.costCentres && <TextField size="small" label="Cost category" value={s.costCategory || ""} onChange={set("costCategory")} />}
            </Stack>
          </Grid>
        </Grid>
      </Section>

      {s.source === "ITEM" && (
        <Section title="Item invoices" hint="Ledger names used on sales and purchase invoices. Tax ledgers use {tax} (CGST, SGST, IGST, CESS) and {rate}.">
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Sales ledger" value={s.salesLedger || ""} onChange={set("salesLedger")} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Purchase ledger" value={s.purchaseLedger || ""} onChange={set("purchaseLedger")} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Output tax ledgers" value={s.outputTaxLedgerPattern || ""} onChange={set("outputTaxLedgerPattern")} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth size="small" label="Input tax ledgers" value={s.inputTaxLedgerPattern || ""} onChange={set("inputTaxLedgerPattern")} /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Our GST state code" placeholder="e.g. 32" value={s.companyStateCode || ""} onChange={set("companyStateCode")} helperText="Other states get IGST" /></Grid>
            <Grid item xs={6} sm={3}><TextField fullWidth size="small" label="Default unit" value={s.defaultUnit || ""} onChange={set("defaultUnit")} /></Grid>
            <Grid item xs={12} sm={6}>
              <FormControlLabel control={<Checkbox checked={!!s.includeStockItems} onChange={setBool("includeStockItems")} />}
                label="Send items and quantities (invoice view)" />
            </Grid>
          </Grid>
        </Section>
      )}

      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <Button variant="contained" onClick={save} disabled={saving}>Save settings</Button>
    </Box>
  );
}

// ── Connectors ────────────────────────────────────────────────────────────────

function PairingDialog({ pairing, onClose }) {
  const [copied, setCopied] = useState(null);
  if (!pairing) return null;
  const server = window.location.origin;
  const copy = (text, which) => {
    navigator.clipboard?.writeText(text).then(() => setCopied(which)).catch(() => {});
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pair the Tally Connector</DialogTitle>
      <DialogContent>
        <Typography variant="body2" mb={2}>
          On the PC next to Tally, install the <a href={CONNECTOR_DOWNLOAD}>Tally Connector</a>, open it from the tray and enter these two values. The pairing key works once and expires in {pairing.expiresInMinutes} minutes.
        </Typography>
        {[["Server", server, "server"], ["Pairing key", pairing.pairingKey, "key"]].map(([label, value, which]) => (
          <Stack key={which} direction="row" spacing={1} alignItems="center" mb={1.5}>
            <TextField fullWidth size="small" label={label} value={value} InputProps={{ readOnly: true, sx: { fontFamily: "monospace" } }} />
            <Tooltip title={copied === which ? "Copied" : "Copy"}><Button onClick={() => copy(value, which)}><ContentCopyIcon fontSize="small" /></Button></Tooltip>
          </Stack>
        ))}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Done</Button></DialogActions>
    </Dialog>
  );
}

const fmtTime = (t) => (t ? new Date(t).toLocaleString() : "never");

function ConnectorsTab() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState(null);
  const [name, setName] = useState("");
  const [pairing, setPairing] = useState(null);

  const load = useCallback(async () => {
    const r = await getConnectors();
    if (r.ok) setRows(r.data);
    else setMsg({ severity: "error", text: r.message });
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const r = await addConnector(name || "Tally connector");
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setName("");
    setPairing(r.data);
    load();
  };
  const repair = async (id) => {
    if (!window.confirm("Make a new pairing key? The connector stops working until it is paired again.")) return;
    const r = await newPairingCode(id);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setPairing(r.data);
    load();
  };
  const rename = async (row) => {
    const n = window.prompt("Connector name", row.name);
    if (!n) return;
    const r = await renameConnector(row.id, n);
    if (!r.ok) setMsg({ severity: "error", text: r.message });
    load();
  };
  const revoke = async (row) => {
    if (!window.confirm(`Remove "${row.name}"? It stops syncing at once.`)) return;
    const r = await revokeConnector(row.id);
    if (!r.ok) setMsg({ severity: "error", text: r.message });
    load();
  };

  const active = rows.filter((r) => !r.revoked_at);
  return (
    <Box>
      <Section title="Add a connector" hint="The Tally Connector is a small tray app for the PC that runs Tally, or any PC on the same network. It fetches vouchers from here and posts them to Tally.">
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField size="small" label="Name, e.g. Accounts PC" value={name} onChange={(e) => setName(e.target.value)} sx={{ minWidth: 260 }} />
          <Button variant="contained" onClick={add}>Add and get pairing key</Button>
          <Button href={CONNECTOR_DOWNLOAD}>Download the connector</Button>
        </Stack>
      </Section>
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Paper variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell><TableCell>State</TableCell><TableCell>Tally</TableCell>
                <TableCell>PC</TableCell><TableCell>Last seen</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {active.length === 0 && <TableRow><TableCell colSpan={6}>No connectors yet.</TableCell></TableRow>}
              {active.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>
                    {r.paired
                      ? <Chip size="small" color={r.online ? "success" : "default"} label={r.online ? "Online" : "Offline"} />
                      : <Chip size="small" color="warning" label={r.awaiting_pairing ? "Waiting to pair" : "Pairing key expired"} />}
                  </TableCell>
                  <TableCell>
                    {r.tally_reachable == null ? "–"
                      : r.tally_reachable ? <Chip size="small" color="success" variant="outlined" label="Reachable" />
                        : <Tooltip title={r.tally?.tallyError || ""}><Chip size="small" color="error" variant="outlined" label="Not reachable" /></Tooltip>}
                  </TableCell>
                  <TableCell>{r.machine_name || "–"}{r.version ? ` · v${r.version}` : ""}</TableCell>
                  <TableCell>{fmtTime(r.last_seen_at)}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => rename(r)}>Rename</Button>
                    <Button size="small" onClick={() => repair(r.id)}>New key</Button>
                    <Button size="small" color="error" onClick={() => revoke(r)}>Remove</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <PairingDialog pairing={pairing} onClose={() => setPairing(null)} />
    </Box>
  );
}

// ── Ledger mapping ────────────────────────────────────────────────────────────

function LedgerMapTab() {
  const [rows, setRows] = useState([]);
  const [masters, setMasters] = useState({ ledger: [], group: [] });
  const [dirty, setDirty] = useState({});
  const [filter, setFilter] = useState("");
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([getLedgerMap(), getMasters()]);
    if (a.ok) setRows(a.data); else setMsg({ severity: "error", text: a.message });
    if (b.ok) setMasters(b.data);
    setDirty({});
  }, []);
  useEffect(() => { load(); }, [load]);

  const ledgerOptions = useMemo(() => (masters.ledger || []).map((m) => m.name), [masters]);
  const groupOptions = useMemo(
    () => [...new Set([...(masters.group || []).map((m) => m.name), ...TALLY_GROUPS])].sort(),
    [masters],
  );

  const edit = (id, field, value) => {
    setRows((rs) => rs.map((r) => (r.ledgerAccountId === id ? { ...r, [field]: value } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  const save = async () => {
    const body = rows.filter((r) => dirty[r.ledgerAccountId])
      .map((r) => ({ ledgerAccountId: r.ledgerAccountId, tallyName: r.tallyName || "", tallyGroup: r.tallyGroup || "" }));
    const r = await saveLedgerMap(body);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setMsg({ severity: "success", text: `Saved ${r.data.saved} mapping(s). Vouchers sent from now on use them.` });
    load();
  };

  const pull = async () => {
    const r = await refreshMasters();
    setMsg(r.ok
      ? { severity: "info", text: "Asked the connector to read Tally's ledgers and groups on its next sync." }
      : { severity: "error", text: r.message });
  };

  const f = filter.trim().toLowerCase();
  const shown = rows.filter((r) => !f || `${r.code} ${r.name} ${r.tallyName || ""}`.toLowerCase().includes(f));
  const known = new Set(ledgerOptions.map((n) => n.toLowerCase()));

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Each of our ledgers goes to Tally under the same name, in the group shown in grey. Change either only where your Tally uses a different name or group. Customer and supplier control ledgers become each party's own ledger when that setting is on.
        {masters.pulledAt ? ` Tally's list was last read ${fmtTime(masters.pulledAt)}.` : " Tally's ledgers haven't been read yet."}
      </Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
        <TextField size="small" label="Search" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Button variant="contained" onClick={save} disabled={!Object.keys(dirty).length}>Save mapping</Button>
        <Button onClick={pull}>Read ledgers from Tally</Button>
      </Stack>
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      <Paper variant="outlined">
        <TableContainer sx={{ maxHeight: 600 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell><TableCell>Our ledger</TableCell>
                <TableCell sx={{ minWidth: 240 }}>Tally ledger</TableCell><TableCell sx={{ minWidth: 220 }}>Tally group</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((r) => {
                const tallyName = r.tallyName || r.name;
                return (
                  <TableRow key={r.ledgerAccountId}>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>
                      {r.name}
                      {r.partyControl && <Chip size="small" label="party" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>
                      <Autocomplete freeSolo size="small" options={ledgerOptions} value={r.tallyName || ""}
                        onInputChange={(e, v) => { if (e) edit(r.ledgerAccountId, "tallyName", v); }}
                        renderInput={(p) => <TextField {...p} placeholder={r.name}
                          helperText={ledgerOptions.length && !known.has(tallyName.toLowerCase()) ? "Not in Tally yet" : " "} />} />
                    </TableCell>
                    <TableCell>
                      <Autocomplete freeSolo size="small" options={groupOptions} value={r.tallyGroup || ""}
                        onInputChange={(e, v) => { if (e) edit(r.ledgerAccountId, "tallyGroup", v); }}
                        renderInput={(p) => <TextField {...p} placeholder={r.defaultTallyGroup} helperText=" " />} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TallyIntegrationPage() {
  const [tab, setTab] = useState(0);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const r = await getSettings();
    if (r.ok) { setInfo(r.data); setError(null); } else setError(r.message);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 3 }, maxWidth: { xs: "100vw", md: 1100 }, width: "100%", minWidth: 0, overflowX: "hidden" }}>
      <Typography variant="h5" mb={0.5}>Tally Integration</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Sends vouchers to TallyPrime through the Tally Connector app. See progress in Tally Sync Status.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {info && !info.installed && (
        <Alert severity="warning">Tally integration isn't set up on the server for this company yet (migration V076). Ask your administrator.</Alert>
      )}
      {info?.installed && (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
            <Tab label="Settings" />
            <Tab label="Connectors" />
            <Tab label="Ledger mapping" />
          </Tabs>
          {tab === 0 && <SettingsTab info={info} reload={load} />}
          {tab === 1 && <ConnectorsTab />}
          {tab === 2 && <LedgerMapTab />}
        </>
      )}
    </Box>
  );
}
