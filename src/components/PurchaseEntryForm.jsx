import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";
import EditIcon from "@mui/icons-material/Edit";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SearchIcon from "@mui/icons-material/Search";
import { getItems } from "../services/apiservice";
import InvoiceReaderDialog from "./InvoiceReaderDialog";

function fmtDate(dt) {
  if (!dt) return "";
  return new Date(dt).toLocaleDateString();
}

const DRAFT_KEY = "purchase_drafts";

function printBill(bill) {
  const grand = bill.rows.reduce((s, r) => s + r.totalAmount, 0);
  const th = (t, align = "left") =>
    `<th style="border:1px solid #ccc;padding:5px 8px;text-align:${align};background:#f0f0f0;">${t}</th>`;
  const td = (v, align = "left") =>
    `<td style="border:1px solid #ccc;padding:4px 8px;text-align:${align};">${v}</td>`;

  const rows = bill.rows.map((r, i) => `<tr>
    ${td(i + 1, "center")}${td(r.itemName)}${td(r.barcode || "")}
    ${td(r.quantity.toFixed(2), "right")}${td(r.rateIncludingTax.toFixed(2), "right")}
    ${td(r.rateBeforeTax.toFixed(2), "right")}${td(r.taxRate.toFixed(2) + "%", "right")}
    ${td(`<b>${r.totalAmount.toFixed(2)}</b>`, "right")}
  </tr>`).join("");

  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8"/>
    <title>${bill.type === "partial" ? "Purchase Draft" : "Purchase Invoice"}</title>
    <style>
      @page { size: A4; margin: 15mm; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
      table { width: 100%; border-collapse: collapse; }
      h2 { text-align: center; margin: 0 0 6px; font-size: 16px; letter-spacing: 1px; }
      .meta td { padding: 2px 6px; border: none; }
      .draft-note { margin-top: 10px; font-size: 11px; color: #888; }
    </style>
  </head><body>
    <h2>${bill.type === "partial" ? "PURCHASE DRAFT" : "PURCHASE INVOICE"}</h2>
    <hr/>
    <table class="meta" style="margin-bottom:10px;">
      <tr>
        <td><b>Supplier:</b> ${bill.supplierName || "—"}</td>
        <td style="text-align:right;"><b>Inv No:</b> ${bill.supplierInvNo || "—"}</td>
      </tr>
      <tr>
        <td></td>
        <td style="text-align:right;"><b>Date:</b> ${bill.supplierInvDate || "—"}</td>
      </tr>
    </table>
    <table>
      <thead><tr>
        ${th("#", "center")}${th("Item")}${th("Barcode")}
        ${th("Qty", "right")}${th("Rate incl.", "right")}${th("Rate excl.", "right")}
        ${th("Tax%", "right")}${th("Total", "right")}
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="7" style="border:1px solid #ccc;padding:5px 8px;text-align:right;font-weight:bold;">Grand Total</td>
        <td style="border:1px solid #ccc;padding:5px 8px;text-align:right;font-weight:bold;font-size:14px;">${grand.toFixed(2)}</td>
      </tr></tfoot>
    </table>
    ${bill.type === "partial" ? '<p class="draft-note">* This is a draft — not a final invoice.</p>' : ""}
  </body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onload = () => { win.print(); win.onafterprint = () => win.close(); };
}

function readDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); } catch { return []; }
}
function writeDrafts(drafts) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function toFloat(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function calcRow(row) {
  const rate = toFloat(row.rateIncludingTax);
  const tax = toFloat(row.taxRate);
  const qty = toFloat(row.quantity, 1);
  return {
    ...row,
    rateBeforeTax: tax > 0 ? (rate * 100) / (100 + tax) : rate,
    totalAmount: rate * qty,
  };
}

export default function PurchaseEntryForm() {
  const barcodeRef = useRef(null);

  const [supplierName, setSupplierName] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [supplierInvDate, setSupplierInvDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const [itemList, setItemList] = useState([]);
  const [rows, setRows] = useState([]);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [pendingQty, setPendingQty] = useState("1");
  const [nameValue, setNameValue] = useState(null);

  const [drafts, setDrafts] = useState(readDrafts);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [recallOpen, setRecallOpen] = useState(false);

  const [printAfterSave, setPrintAfterSave] = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const notify = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  const selectedBranch = localStorage.getItem("branchCode") || "";

  // Edit mode
  const [editingId, setEditingId] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [loadFromDate, setLoadFromDate] = useState(
    () => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [loadToDate, setLoadToDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [purchaseList, setPurchaseList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    getItems()
      .then((r) => setItemList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    const token = localStorage.getItem("jwtToken");
    const tenancyId = localStorage.getItem("tenancyId");
    fetch(`/api/${tenancyId}/suppliers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => {});

    setTimeout(() => barcodeRef.current?.focus(), 150);
  }, []);

  const addItem = useCallback((item, qtyOverride) => {
    if (!item) return;
    const qty = toFloat(qtyOverride ?? pendingQty, 1);
    const rate = toFloat(item.purchaseRate || item.standardPrice);
    const tax = toFloat(item.taxRate);
    const id = String(item.item_id ?? item.itemId ?? item.itemName);

    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === id);
      if (idx >= 0) {
        return prev.map((r, i) =>
          i === idx ? calcRow({ ...r, quantity: r.quantity + qty }) : r
        );
      }
      return [
        ...prev,
        calcRow({
          _key: crypto.randomUUID(),
          _id: id,
          itemName: item.itemName || "",
          barcode: item.barcode || "",
          rateIncludingTax: rate,
          taxRate: tax,
          quantity: qty,
        }),
      ];
    });
  }, [pendingQty]);

  const handleBarcodeKey = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const found = itemList.find(
      (i) => i.barcode === code || i.itemCode === code
    );
    if (!found) {
      notify(`Barcode not found: ${code}`, "warning");
    } else {
      addItem(found);
      notify(`Added: ${found.itemName}`);
    }
    setBarcodeInput("");
    setPendingQty("1");
    barcodeRef.current?.focus();
  };

  const handleNameSelect = (_, item) => {
    if (!item) return;
    addItem(item);
    notify(`Added: ${item.itemName}`);
    setNameValue(null);
    setPendingQty("1");
    barcodeRef.current?.focus();
  };

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) =>
        r._key !== key ? r : calcRow({ ...r, [field]: toFloat(value) })
      )
    );
  };

  const deleteRow = (key) =>
    setRows((prev) => prev.filter((r) => r._key !== key));

  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);

  const buildPayload = (variant) => ({
    supplierName,
    branchCode: localStorage.getItem("branchCode") || "",
    ...(variant === "final"
      ? {
          supplierVoucherNumber: supplierInvNo,
          supplierVoucherDate: supplierInvDate ? `${supplierInvDate}T00:00:00` : null,
        }
      : {
          voucherNumber: supplierInvNo,
          voucherDate: supplierInvDate ? `${supplierInvDate}T00:00:00` : null,
        }),
    items: rows.map(({ _key, _id, ...rest }) => rest),
  });

  const saveDraft = () => {
    if (!rows.length && !supplierName) return;
    const draft = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      supplierName,
      supplierInvNo,
      supplierInvDate,
      rows,
    };
    const next = [draft, ...drafts].slice(0, 50);
    setDrafts(next);
    writeDrafts(next);
  };

  const recallDraft = (draft) => {
    setSupplierName(draft.supplierName || "");
    setSupplierInvNo(draft.supplierInvNo || "");
    setSupplierInvDate(draft.supplierInvDate || new Date().toISOString().split("T")[0]);
    setRows(draft.rows || []);
    setActiveDraftId(draft.id);
    setRecallOpen(false);
    notify("Draft loaded");
  };

  const deleteDraft = (id) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    writeDrafts(next);
  };

  const searchPurchases = () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    setLoadingList(true);
    setPurchaseList([]);
    fetch(
      `/api/${tenancyId}/purchase-list?branch=${encodeURIComponent(selectedBranch)}&fromDate=${loadFromDate}&toDate=${loadToDate}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => r.json())
      .then((d) => setPurchaseList(Array.isArray(d) ? d : []))
      .catch(() => setPurchaseList([]))
      .finally(() => setLoadingList(false));
  };

  const loadPurchaseForEdit = (p) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/purchase/${p.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setEditingId(data.id);
        setSupplierName(data.supplierName || "");
        setSupplierInvNo(data.supplierVoucherNumber || "");
        setSupplierInvDate(
          data.supplierVoucherDate
            ? new Date(data.supplierVoucherDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0]
        );
        setRows(
          (data.items || []).map((it) => ({
            _key: crypto.randomUUID(),
            _id: it.itemName,
            itemName: it.itemName || "",
            barcode: it.barcode || "",
            rateIncludingTax: it.rateIncludingTax || 0,
            rateBeforeTax: it.rateBeforeTax || 0,
            taxRate: it.taxRate || 0,
            quantity: it.quantity || 0,
            totalAmount: it.totalAmount || 0,
          }))
        );
        setLoadOpen(false);
        notify(`Loaded: ${data.voucherNumber}`);
      })
      .catch(() => notify("Failed to load purchase", "error"));
  };

  const handleSave = async (variant) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    // Update existing purchase
    if (editingId) {
      try {
        const res = await fetch(`/api/${tenancyId}/purchase/${editingId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload("final")),
        });
        const data = res.ok ? await res.json() : null;
        if (res.ok) {
          notify("Purchase updated successfully");
          if (printAfterSave) printBill({ type: "final", supplierName, supplierInvNo, supplierInvDate, rows });
          setEditingId(null);
          setRows([]);
          setSupplierName("");
          setSupplierInvNo("");
        } else if (res.status === 409) {
          notify(data?.error || "GRN already done — cannot edit", "error");
        } else {
          notify("Update failed", "error");
        }
      } catch {
        notify("Network error", "error");
      }
      return;
    }

    // New purchase
    const endpoint = variant === "final" ? "final-save" : "partial-save";
    try {
      const res = await fetch(`/api/${tenancyId}/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload(variant)),
      });
      if (res.ok) {
        notify(`${variant === "final" ? "Final" : "Partial"} save successful`);
        if (printAfterSave) {
          printBill({ type: variant, supplierName, supplierInvNo, supplierInvDate, rows });
        }
        if (variant === "partial") {
          saveDraft();
        } else if (activeDraftId) {
          const next = drafts.filter((d) => d.id !== activeDraftId);
          setDrafts(next);
          writeDrafts(next);
        }
        setActiveDraftId(null);
        setRows([]);
        setSupplierName("");
        setSupplierInvNo("");
      } else {
        notify("Save failed", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 2, ml: "240px", mt: 1 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5" fontWeight="bold" color="primary">
            Purchase Entry
          </Typography>
          {selectedBranch ? (
            <Chip label={`Branch: ${selectedBranch}`} color="primary" variant="outlined" size="small" />
          ) : (
            <Chip label="No branch selected" color="warning" variant="outlined" size="small" />
          )}
          {editingId && (
            <Chip label="Editing existing purchase" color="warning" size="small" onDelete={() => {
              setEditingId(null); setRows([]); setSupplierName(""); setSupplierInvNo("");
            }} />
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            color="secondary"
            startIcon={<DocumentScannerIcon />}
            onClick={() => setScanOpen(true)}
          >
            Scan Invoice
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<EditIcon />}
            onClick={() => { setLoadOpen(true); setPurchaseList([]); }}
          >
            Load for Edit
          </Button>
          <Tooltip title={drafts.length ? `${drafts.length} saved draft(s)` : "No saved drafts"}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderOpenIcon />}
                onClick={() => setRecallOpen(true)}
                disabled={!drafts.length}
              >
                Recall Draft {drafts.length > 0 && `(${drafts.length})`}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── Header fields ── */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(o) =>
                typeof o === "string" ? o : (o.supplierName ?? "")
              }
              freeSolo
              value={supplierName}
              onInputChange={(_, v) => setSupplierName(v)}
              renderInput={(params) => (
                <TextField {...params} label="Supplier" size="small" fullWidth />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Supplier Invoice No"
              size="small"
              fullWidth
              value={supplierInvNo}
              onChange={(e) => setSupplierInvNo(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Invoice Date"
              type="date"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={supplierInvDate}
              onChange={(e) => setSupplierInvDate(e.target.value)}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* ── Item entry bar ── */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            inputRef={barcodeRef}
            label="Barcode / Scan"
            size="small"
            sx={{ width: 220 }}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={handleBarcodeKey}
            placeholder="Scan or type + Enter"
            autoComplete="off"
            inputProps={{ style: { fontFamily: "monospace" } }}
          />
          <Typography color="text.secondary" sx={{ fontSize: 12 }}>or</Typography>
          <Autocomplete
            options={itemList}
            getOptionLabel={(o) => o.itemName ?? ""}
            value={nameValue}
            onChange={handleNameSelect}
            sx={{ width: 280 }}
            filterOptions={(opts, { inputValue }) => {
              if (!inputValue) return opts.slice(0, 30);
              const q = inputValue.toLowerCase();
              return opts
                .filter(
                  (o) =>
                    o.itemName?.toLowerCase().includes(q) ||
                    o.itemCode?.toLowerCase().includes(q)
                )
                .slice(0, 50);
            }}
            isOptionEqualToValue={(o, v) =>
              String(o.item_id ?? o.itemId) === String(v?.item_id ?? v?.itemId)
            }
            renderInput={(params) => (
              <TextField {...params} label="Search by name" size="small" />
            )}
          />
          <TextField
            label="Qty"
            size="small"
            type="number"
            sx={{ width: 80 }}
            value={pendingQty}
            onChange={(e) => setPendingQty(e.target.value)}
            inputProps={{ min: 0.01, step: 1, style: { textAlign: "right" } }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          Scan barcode → added instantly · scanning the same barcode again increments quantity
        </Typography>
      </Paper>

      {/* ── Items table ── */}
      <Paper sx={{ mb: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "action.selected" }}>
                <TableCell sx={{ fontWeight: "bold", width: 36 }}>#</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Item</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Barcode</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Rate incl. Tax</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Rate excl. Tax</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Tax %</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Total</TableCell>
                <TableCell sx={{ width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No items yet — scan a barcode or search by name above
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, idx) => (
                <TableRow key={row._key} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 500, minWidth: 180 }}>
                    {row.itemName}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {row.barcode}
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={row.rateIncludingTax}
                      onChange={(e) =>
                        updateRow(row._key, "rateIncludingTax", e.target.value)
                      }
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: "text.secondary", minWidth: 90 }}>
                    {row.rateBeforeTax.toFixed(2)}
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(row._key, "quantity", e.target.value)
                      }
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: 80 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      size="small"
                      type="number"
                      value={row.taxRate}
                      onChange={(e) =>
                        updateRow(row._key, "taxRate", e.target.value)
                      }
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: 70 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, minWidth: 90 }}>
                    {row.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteRow(row._key)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {rows.length > 0 && (
                <TableRow sx={{ bgcolor: "action.selected" }}>
                  <TableCell colSpan={7} align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                      <Chip label={`${rows.length} item${rows.length !== 1 ? "s" : ""}`} size="small" />
                      <Typography fontWeight="bold">Grand Total</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold" fontSize={15}>
                      {grandTotal.toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Save buttons ── */}
      <Stack direction="row" spacing={2} alignItems="center">
        {!editingId && (
          <Button variant="outlined" onClick={() => handleSave("partial")}>
            Partial Save
          </Button>
        )}
        <Button
          variant="contained"
          color={editingId ? "warning" : "primary"}
          onClick={() => handleSave("final")}
          disabled={rows.length === 0}
        >
          {editingId ? "Update Purchase" : "Final Save"}
        </Button>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={printAfterSave}
              onChange={(e) => setPrintAfterSave(e.target.checked)}
            />
          }
          label="Print after save"
          sx={{ ml: 1, userSelect: "none" }}
        />
      </Stack>


      {/* ── Invoice Reader dialog ── */}
      <InvoiceReaderDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        itemList={itemList}
        onApply={({ supplierName: sn, supplierInvNo: inv, supplierInvDate: dt, items }) => {
          if (sn) setSupplierName(sn);
          if (inv) setSupplierInvNo(inv);
          if (dt) setSupplierInvDate(dt);
          if (items && items.length) {
            setRows((prev) => {
              const merged = [...prev];
              for (const it of items) {
                const idx = merged.findIndex((r) => r._id === it._id);
                if (idx >= 0) {
                  merged[idx] = calcRow({ ...merged[idx], quantity: merged[idx].quantity + it.quantity });
                } else {
                  merged.push(calcRow(it));
                }
              }
              return merged;
            });
            notify(`${items.length} item(s) loaded from invoice`, "success");
          }
        }}
      />

      {/* ── Load for Edit dialog ── */}
      <Dialog open={loadOpen} onClose={() => setLoadOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Load Purchase for Edit</DialogTitle>
        <DialogContent dividers>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              label="From Date" type="date" size="small"
              value={loadFromDate} onChange={(e) => setLoadFromDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To Date" type="date" size="small"
              value={loadToDate} onChange={(e) => setLoadToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained" size="small"
              startIcon={loadingList ? null : <SearchIcon />}
              onClick={searchPurchases} disabled={loadingList}
            >
              {loadingList ? "Searching…" : "Search"}
            </Button>
          </Stack>
          {purchaseList.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Voucher No</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="right">Items</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchaseList.map((p) => (
                    <TableRow
                      key={p.id}
                      hover={!p.grnDone}
                      onClick={() => !p.grnDone && loadPurchaseForEdit(p)}
                      sx={{
                        cursor: p.grnDone ? "not-allowed" : "pointer",
                        opacity: p.grnDone ? 0.45 : 1,
                      }}
                    >
                      <TableCell>{p.voucherNumber}</TableCell>
                      <TableCell>{fmtDate(p.voucherDate)}</TableCell>
                      <TableCell>{p.supplierName}</TableCell>
                      <TableCell align="right">{String(p.itemCount)}</TableCell>
                      <TableCell>
                        {p.grnDone
                          ? <Chip label="GRN Done" size="small" color="success" />
                          : <Chip label="Editable" size="small" color="primary" variant="outlined" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── Recall dialog ── */}
      <Dialog open={recallOpen} onClose={() => setRecallOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Recall Saved Draft</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {drafts.length === 0 ? (
            <Typography sx={{ p: 3 }} color="text.secondary">No drafts saved yet.</Typography>
          ) : (
            <List dense disablePadding>
              {drafts.map((d) => (
                <ListItem
                  key={d.id}
                  disablePadding
                  secondaryAction={
                    <IconButton size="small" color="error" onClick={() => deleteDraft(d.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => recallDraft(d)}>
                    <ListItemText
                      primary={d.supplierName || "(No supplier)"}
                      secondary={
                        `${d.supplierInvNo ? `Inv: ${d.supplierInvNo} · ` : ""}` +
                        `${d.rows?.length ?? 0} item(s) · ` +
                        new Date(d.savedAt).toLocaleString()
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRecallOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
