// Languages: the optional multi-language module's admin screen. Settings (tenant, company,
// branch), item name translations and branch names in the second language. Nothing here
// changes printing until an admin turns the module on.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell,
  TableHead, TableRow, Tabs, TextField, Typography,
} from "@mui/material";
import { useBranch } from "../components/BranchContext";
import {
  deleteSettings, getBranchTranslations, getSettings, listItems, saveBranchTranslation, saveItems, saveSettings,
} from "./multiLanguageApi";
import { clearPrintPackCache } from "./printPack";

const RTL = ["ar", "fa", "ur", "he"];
const dirOf = (lang) => (RTL.includes((lang || "").split("-")[0]) ? "rtl" : "ltr");
const tri = (v) => (v === true ? "yes" : v === false ? "no" : "");
const fromTri = (v) => (v === "yes" ? true : v === "no" ? false : null);
const blank = (v) => (v == null || v === "" ? null : v);

function SettingsPanel({ overview, reload }) {
  const { branches = [] } = useBranch();
  const [scope, setScope] = useState("TENANT");
  const [key, setKey] = useState("");
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);
  const levels = overview?.levels || {};
  const levelKey = scope === "TENANT" ? "TENANT:*" : `${scope}:${key}`;

  useEffect(() => {
    const s = levels[levelKey] || {};
    setForm({
      enabled: tri(s.enabled), language: s.language || "", invoiceLanguage: s.invoiceLanguage || "",
      country: s.country || "", translationRequired: tri(s.translationRequired), defaultUiLanguage: s.defaultUiLanguage || "",
    });
  }, [levelKey, overview]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setMsg(null);
    const body = {
      enabled: fromTri(form.enabled), language: blank(form.language), invoiceLanguage: blank(form.invoiceLanguage),
      country: blank(form.country), translationRequired: fromTri(form.translationRequired), defaultUiLanguage: blank(form.defaultUiLanguage),
    };
    const r = await saveSettings(scope, scope === "TENANT" ? null : key, body);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    clearPrintPackCache();
    setMsg({ severity: "success", text: "Saved. Open screens pick it up within a minute (or on reload); the desktop POS on its next branch load." });
    reload();
  };

  const remove = async () => {
    const r = await deleteSettings(scope, scope === "TENANT" ? null : key);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    clearPrintPackCache();
    setMsg({ severity: "success", text: "This level now takes its settings from the level above." });
    reload();
  };

  const t = overview?.tenant || {};
  return (
    <Box>
      <Alert severity={t.enabled ? "info" : "success"} sx={{ mb: 2 }}>
        {t.enabled
          ? (t.language
            ? `On for the tenant: ${t.invoiceLanguage || "BILINGUAL"}, second language ${t.language}.`
            : "On for the tenant, but no second language is chosen, so invoices still print in English.")
          : "Off for the tenant: every screen prints in English as before. Companies or branches can still turn it on."}
      </Alert>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
        <TextField select size="small" label="Level" value={scope} onChange={(e) => { setScope(e.target.value); setKey(""); }} sx={{ minWidth: 160 }}>
          <MenuItem value="TENANT">Whole tenant</MenuItem>
          <MenuItem value="COMPANY">Company</MenuItem>
          <MenuItem value="BRANCH">Branch</MenuItem>
        </TextField>
        {scope === "COMPANY" && <TextField size="small" label="Company id" value={key} onChange={(e) => setKey(e.target.value.trim())} />}
        {scope === "BRANCH" && (
          <TextField select size="small" label="Branch" value={key} onChange={(e) => setKey(e.target.value)} sx={{ minWidth: 200 }}>
            {branches.map((b) => <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode} · {b.branchName}</MenuItem>)}
          </TextField>
        )}
      </Stack>
      {(scope === "TENANT" || key) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Blank means "same as the level above". Branch settings win over company, company over tenant.
          </Typography>
          <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2}>
            <TextField select size="small" label="Multi-language" value={form.enabled || ""} onChange={set("enabled")}>
              <MenuItem value="">(same as above)</MenuItem><MenuItem value="yes">On</MenuItem><MenuItem value="no">Off</MenuItem>
            </TextField>
            <TextField size="small" label="Second language (e.g. ar, hi, ml)" value={form.language || ""} onChange={set("language")} />
            <TextField select size="small" label="Printed invoices" value={form.invoiceLanguage || ""} onChange={set("invoiceLanguage")}>
              <MenuItem value="">(same as above; second language and English when on)</MenuItem>
              <MenuItem value="ENGLISH_ONLY">English only</MenuItem>
              <MenuItem value="BILINGUAL">Second language and English</MenuItem>
              <MenuItem value="LOCAL_ONLY">Second language only</MenuItem>
            </TextField>
            <TextField size="small" label="Country rules (e.g. SA), optional" value={form.country || ""} onChange={set("country")}
              helperText="Its language rules then apply: Saudi Arabia requires Arabic." />
            <TextField select size="small" label="Translations required" value={form.translationRequired || ""} onChange={set("translationRequired")}>
              <MenuItem value="">(same as above)</MenuItem><MenuItem value="yes">Yes, list missing ones</MenuItem><MenuItem value="no">No</MenuItem>
            </TextField>
            <TextField size="small" label="Default screen language, optional" value={form.defaultUiLanguage || ""} onChange={set("defaultUiLanguage")}
              helperText="For users who haven't picked one at login." />
          </Box>
          <Stack direction="row" spacing={1} mt={2}>
            <Button variant="contained" onClick={save}>Save</Button>
            {levels[levelKey] && <Button color="error" onClick={remove}>Remove this level</Button>}
          </Stack>
        </Paper>
      )}
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }}>{msg.text}</Alert>}
      {Object.keys(levels).length > 0 && (
        <Table size="small">
          <TableHead><TableRow><TableCell>Level</TableCell><TableCell>Settings</TableCell></TableRow></TableHead>
          <TableBody>
            {Object.entries(levels).map(([k, v]) => (
              <TableRow key={k}>
                <TableCell>{k === "TENANT:*" ? "Whole tenant" : k.replace(":", " ")}</TableCell>
                <TableCell>{Object.entries(v).map(([f, x]) => <Chip key={f} size="small" sx={{ mr: 0.5, mb: 0.5 }} label={`${f}: ${x}`} />)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}

function ItemsPanel({ defaultLanguage }) {
  const [language, setLanguage] = useState(defaultLanguage || "ar");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [edits, setEdits] = useState({});
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    if (!language) return;
    const r = await listItems(language, { search, missingOnly, page });
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    setData(r.data);
    setEdits({});
  }, [language, search, missingOnly, page]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setMsg(null);
    const r = await saveItems(language, edits);
    if (!r.ok) return setMsg({ severity: "error", text: r.message });
    const errs = Object.entries(r.data.errors || {});
    setMsg({ severity: errs.length ? "warning" : "success",
      text: `Saved ${r.data.saved}, removed ${r.data.removed}.${errs.length ? ` Not saved: ${errs.map(([k, v]) => `${k} (${v})`).join(", ")}` : ""}` });
    clearPrintPackCache();
    load();
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / 50)) : 1;
  const changed = Object.keys(edits).length;
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Invoices print only the names saved here, never a machine translation. Items without one print in English.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2} alignItems={{ sm: "center" }}>
        <TextField size="small" label="Language" value={language} onChange={(e) => { setLanguage(e.target.value.trim()); setPage(0); }} sx={{ width: 110 }} />
        <TextField size="small" label="Search item name or code" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        <FormControlLabel control={<Checkbox checked={missingOnly} onChange={(e) => { setMissingOnly(e.target.checked); setPage(0); }} />} label="Only missing" />
        {data && <Chip color={data.missing ? "warning" : "success"} label={`${data.missing} item${data.missing === 1 ? "" : "s"} without a ${language} name`} />}
      </Stack>
      {msg && <Alert severity={msg.severity} sx={{ mb: 2 }}>{msg.text}</Alert>}
      <Table size="small">
        <TableHead><TableRow><TableCell>Item</TableCell><TableCell>Code</TableCell><TableCell>Name in {language}</TableCell></TableRow></TableHead>
        <TableBody>
          {(data?.rows || []).map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.itemName}</TableCell>
              <TableCell>{r.itemCode}</TableCell>
              <TableCell sx={{ minWidth: 220 }}>
                <TextField size="small" fullWidth value={edits[r.id] ?? r.translated ?? ""}
                  inputProps={{ dir: dirOf(language), lang: language }}
                  onChange={(e) => setEdits((x) => ({ ...x, [r.id]: e.target.value }))} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Stack direction="row" spacing={1} mt={2} alignItems="center">
        <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
        <Typography variant="body2">Page {page + 1} of {pages}</Typography>
        <Button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        <Box flex={1} />
        <Button variant="contained" disabled={!changed} onClick={save}>Save {changed || ""} change{changed === 1 ? "" : "s"}</Button>
      </Stack>
    </Box>
  );
}

function BranchNamesPanel({ defaultLanguage }) {
  const { branches = [] } = useBranch();
  const [branch, setBranch] = useState("");
  const [language, setLanguage] = useState(defaultLanguage || "ar");
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!branch || !language) return;
    getBranchTranslations(branch).then((r) => {
      const t = (r.ok && Array.isArray(r.data) ? r.data : []).find((x) => x.languageCode === language) || {};
      setForm({ name: t.name || "", buildingName: t.buildingName || "", street: t.street || "", district: t.district || "", city: t.city || "" });
    });
  }, [branch, language]);

  const save = async () => {
    const r = await saveBranchTranslation(branch, language, form);
    setMsg(r.ok ? { severity: "success", text: "Saved." } : { severity: "error", text: r.message });
    if (r.ok) clearPrintPackCache();
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const inputProps = { dir: dirOf(language), lang: language };

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
        <TextField select size="small" label="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} sx={{ minWidth: 220 }}>
          {branches.map((b) => <MenuItem key={b.branchCode} value={b.branchCode}>{b.branchCode} · {b.branchName}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Language" value={language} onChange={(e) => setLanguage(e.target.value.trim())} sx={{ width: 110 }} />
      </Stack>
      {branch && (
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={2} maxWidth={720}>
          <TextField size="small" label="Name printed on receipts" value={form.name || ""} onChange={set("name")} inputProps={inputProps} />
          <TextField size="small" label="Building" value={form.buildingName || ""} onChange={set("buildingName")} inputProps={inputProps} />
          <TextField size="small" label="Street" value={form.street || ""} onChange={set("street")} inputProps={inputProps} />
          <TextField size="small" label="District" value={form.district || ""} onChange={set("district")} inputProps={inputProps} />
          <TextField size="small" label="City" value={form.city || ""} onChange={set("city")} inputProps={inputProps} />
          <Box><Button variant="contained" onClick={save}>Save</Button></Box>
        </Box>
      )}
      {msg && <Alert severity={msg.severity} sx={{ mt: 2 }}>{msg.text}</Alert>}
    </Box>
  );
}

export default function LanguagesPage() {
  const [tab, setTab] = useState(0);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const r = await getSettings();
    if (!r.ok) return setError(r.message);
    setError("");
    setOverview(r.data);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const language = useMemo(() => overview?.tenant?.language || "ar", [overview]);

  return (
    <Box p={{ xs: 1, sm: 3 }}>
      <Typography variant="h5" mb={1}>Languages</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Print invoices and receipts in a second language (for example Arabic) alongside English. Optional: while it is off,
        everything prints in English exactly as before.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {overview && !overview.installed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Multi-language isn't installed for this tenant yet: the V074 migration has to run on its database first. Until then
          everything prints in English.
        </Alert>
      )}
      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" sx={{ mb: 2 }}>
          <Tab label="Settings" />
          <Tab label="Item names" />
          <Tab label="Branch names" />
        </Tabs>
        {tab === 0 && <SettingsPanel overview={overview} reload={reload} />}
        {tab === 1 && <ItemsPanel defaultLanguage={language} />}
        {tab === 2 && <BranchNamesPanel defaultLanguage={language} />}
      </Paper>
    </Box>
  );
}
