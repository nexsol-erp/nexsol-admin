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
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
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
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";
import EditIcon from "@mui/icons-material/Edit";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SearchIcon from "@mui/icons-material/Search";
import { getItems } from "../services/apiservice";
import InvoiceReaderDialog from "./InvoiceReaderDialog";
import UnitSelect from "./UnitSelect";
import { useBranch } from "./BranchContext";

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
    ${td(r.unit || "")}${td((r.conversionFactor ?? 1).toString(), "right")}
    ${td(r.inventoryUnit || "")}${td((r.quantity || 0).toFixed(2), "right")}
    ${td((r.inventoryQty ?? r.quantity ?? 0).toFixed(2), "right")}
    ${td(r.rateIncludingTax.toFixed(2), "right")}
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
        ${th("Purch. Unit")}${th("Conv.", "right")}${th("Inv. Unit")}
        ${th("Purch. Qty", "right")}${th("Inv. Qty", "right")}
        ${th("Rate incl.", "right")}${th("Rate excl.", "right")}
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

function calcRowFromTotal(row) {
  const total = toFloat(row.totalAmount);
  const tax = toFloat(row.taxRate);
  const qty = toFloat(row.quantity, 1);
  const rateIncl = qty > 0 ? total / qty : 0;
  return {
    ...row,
    rateIncludingTax: rateIncl,
    rateBeforeTax: tax > 0 ? (rateIncl * 100) / (100 + tax) : rateIncl,
  };
}

export default function PurchaseEntryForm() {
  const barcodeRef = useRef(null);
  const qtyRef = useRef(null);
  const rateRef = useRef(null);
  const totalRef = useRef(null);
  const pendingQtyRef = useRef("1");

  const [supplierName, setSupplierName] = useState("");
  const [supplierId, setSupplierId]     = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [supplierInvDate, setSupplierInvDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const [itemList, setItemList] = useState([]);
  const [rows, setRows] = useState([]);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [pendingQty, setPendingQty] = useState("1");
  const [pendingItem, setPendingItem] = useState(null);
  const [pendingRate, setPendingRate] = useState(0);
  const [pendingTotal, setPendingTotal] = useState("");
  const [pendingUnit, setPendingUnit] = useState("");
  const [pendingConvFactor, setPendingConvFactor] = useState("1");
  const [nameValue, setNameValue] = useState(null);

  const [billTotal, setBillTotal] = useState("");

  const [drafts, setDrafts] = useState(readDrafts);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [recallOpen, setRecallOpen] = useState(false);

  const [printAfterSave, setPrintAfterSave] = useState(false);

  const [snack, setSnack] = useState({ open: false, msg: "", severity: "success" });
  const notify = (msg, severity = "success") => setSnack({ open: true, msg, severity });

  const [fieldErrors, setFieldErrors] = useState({ supplier: false, supplierInvNo: false });

  const { branch: selectedBranch, setBranch: setSelectedBranch, branches } = useBranch();

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
    const token = localStorage.getItem("jwtToken");
    const tenancyId = localStorage.getItem("tenancyId");
    const hdr = { Authorization: `Bearer ${token}` };

    getItems()
      .then((r) => setItemList(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    fetch(`/api/${tenancyId}/suppliers`, { headers: hdr })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => {});

    setTimeout(() => barcodeRef.current?.focus(), 150);
  }, []);

  useEffect(() => { pendingQtyRef.current = pendingQty; }, [pendingQty]);

  const fetchLastRate = useCallback(async (itemId) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const res = await fetch(
        `/api/${tenancyId}/purchase-last-rate?itemId=${encodeURIComponent(itemId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const rate = await res.json();
        const r = typeof rate === "number" ? rate : 0;
        setPendingRate(r);
        const q = toFloat(pendingQtyRef.current, 1);
        setPendingTotal(r > 0 && q > 0 ? (r * q).toFixed(2) : "");
        return;
      }
    } catch {}
    setPendingRate(0);
    setPendingTotal("");
  }, []);

  const focusQty = useCallback(() => {
    setPendingQty("1");
    setTimeout(() => {
      const input = qtyRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 60);
  }, []);

  const focusRate = useCallback(() => {
    setTimeout(() => {
      const input = rateRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 60);
  }, []);

  const focusTotal = useCallback(() => {
    setTimeout(() => {
      const input = totalRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 60);
  }, []);

  const addItem = useCallback((item, qtyOverride, rateOverride, unitOverride, convFactorOverride) => {
    if (!item) return;
    const qty = toFloat(qtyOverride ?? pendingQty, 1);
    const rate = rateOverride !== undefined ? toFloat(rateOverride) : toFloat(item.purchaseRate || item.standardPrice);
    const tax = toFloat(item.taxRate);
    const id = String(item.item_id ?? item.itemId ?? item.itemName);
    const unit = unitOverride !== undefined ? unitOverride : (pendingUnit || item.unitName || "");
    const conv = toFloat(convFactorOverride ?? pendingConvFactor, 1) || 1;
    const inventoryUnit = item.unitName || "";

    setRows((prev) => {
      const idx = prev.findIndex((r) => r._id === id);
      if (idx >= 0) {
        const existing = prev[idx];
        const existingConv = toFloat(existing.conversionFactor, 1) || 1;
        return prev.map((r, i) =>
          i === idx ? calcRow({ ...r, quantity: r.quantity + qty, inventoryQty: (r.inventoryQty || 0) + qty * existingConv }) : r
        );
      }
      return [
        calcRow({
          _key: crypto.randomUUID(),
          _id: id,
          itemName: item.itemName || "",
          barcode: item.barcode || "",
          standardPrice: toFloat(item.standardPrice),
          unit,
          conversionFactor: conv,
          inventoryUnit,
          inventoryQty: qty * conv,
          rateIncludingTax: rate,
          taxRate: tax,
          quantity: qty,
        }),
        ...prev,
      ];
    });
  }, [pendingQty, pendingUnit, pendingConvFactor]);

  const commitPending = useCallback(() => {
    if (!pendingItem) { barcodeRef.current?.focus(); return; }
    addItem(pendingItem, pendingQty, pendingRate, pendingUnit, pendingConvFactor);
    notify(`Added: ${pendingItem.itemName}`);
    setPendingItem(null);
    setPendingRate(0);
    setPendingQty("1");
    setPendingTotal("");
    setPendingUnit("");
    setPendingConvFactor("1");
    barcodeRef.current?.focus();
  }, [pendingItem, pendingQty, pendingRate, pendingUnit, pendingConvFactor, addItem]);

  const addBlankRow = () => {
    setRows((prev) => [
      {
        _key: crypto.randomUUID(),
        _id: crypto.randomUUID(),
        itemName: "",
        barcode: "",
        standardPrice: null,
        unit: "",
        conversionFactor: 1,
        inventoryUnit: "",
        inventoryQty: 0,
        rateIncludingTax: 0,
        rateBeforeTax: 0,
        taxRate: 0,
        quantity: 1,
        totalAmount: 0,
      },
      ...prev,
    ]);
  };

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
      setBarcodeInput("");
      return;
    }
    setPendingItem(found);
    setPendingRate(0);
    setPendingTotal("");
    setPendingUnit(found.unitName || "");
    setPendingConvFactor("1");
    setBarcodeInput("");
    focusQty();
    fetchLastRate(String(found.item_id ?? found.itemId));
  };

  const handleNameSelect = (_, item) => {
    if (!item) return;
    setPendingItem(item);
    setPendingRate(0);
    setPendingTotal("");
    setPendingUnit(item.unitName || "");
    setPendingConvFactor("1");
    setNameValue(null);
    focusQty();
    fetchLastRate(String(item.item_id ?? item.itemId));
  };

  const changeRowItem = (key, selected) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        if (!selected) return r;
        if (typeof selected === "string") return { ...r, itemName: selected };
        return calcRow({
          ...r,
          _id: String(selected.item_id ?? selected.itemId ?? selected.itemName),
          itemName: selected.itemName || "",
          barcode: selected.barcode || "",
          standardPrice: toFloat(selected.standardPrice),
          inventoryUnit: selected.unitName || "",
          taxRate: toFloat(selected.taxRate),
        });
      })
    );
  };

  const updateRow = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r._key !== key) return r;
        const updated = { ...r, [field]: field === "unit" || field === "inventoryUnit" ? value : toFloat(value) };
        if (field === "totalAmount") return calcRowFromTotal(updated);
        const next = calcRow(updated);
        // Auto-recalc inventory qty when purchase qty or conversion factor changes
        if (field === "quantity" || field === "conversionFactor") {
          const pQty = toFloat(next.quantity, 0);
          const conv = toFloat(next.conversionFactor, 1) || 1;
          next.inventoryQty = pQty * conv;
        }
        return next;
      })
    );
  };

  const deleteRow = (key) =>
    setRows((prev) => prev.filter((r) => r._key !== key));

  const grandTotal = rows.reduce((s, r) => s + r.totalAmount, 0);
  const roundOff = billTotal !== "" ? toFloat(billTotal) - grandTotal : 0;

  const buildPayload = (variant) => ({
    supplierName,
    supplierId,
    branchCode: localStorage.getItem("branchCode") || "",
    roundOff,
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
            standardPrice: it.standardPrice ?? null,
            unit: it.unit || it.unitName || "",
            conversionFactor: it.conversionFactor ?? 1,
            inventoryUnit: it.inventoryUnit || it.unitName || "",
            inventoryQty: it.inventoryQty ?? it.quantity ?? 0,
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

    // Mandatory field validation
    const errs = {
      supplier: !supplierName.trim(),
      supplierInvNo: !supplierInvNo.trim(),
    };
    if (!selectedBranch) {
      notify("Please select a branch before saving", "error");
      return;
    }
    if (errs.supplier || errs.supplierInvNo) {
      setFieldErrors(errs);
      notify(
        errs.supplier ? "Supplier is required" : "Supplier Invoice No is required",
        "error"
      );
      return;
    }
    setFieldErrors({ supplier: false, supplierInvNo: false });

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
          setSupplierName(""); setSupplierId("");
          setSupplierInvNo("");
          setBillTotal("");
          setFieldErrors({ supplier: false, supplierInvNo: false });
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
        setSupplierName(""); setSupplierId("");
        setSupplierInvNo("");
        setBillTotal("");
        setFieldErrors({ supplier: false, supplierInvNo: false });
      } else {
        notify("Save failed", "error");
      }
    } catch {
      notify("Network error", "error");
    }
  };

  return (
    <Box sx={{
      flexGrow: 1, p: 2, mt: 1,
      "& input[type=number]": { MozAppearance: "textfield" },
      "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button": {
        WebkitAppearance: "none", margin: 0,
      },
    }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="h5" fontWeight="bold" color="primary">
            Purchase Entry
          </Typography>
          {editingId && (
            <Chip label="Editing existing purchase" color="warning" size="small" onDelete={() => {
              setEditingId(null); setRows([]); setSupplierName(""); setSupplierId(""); setSupplierInvNo("");
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
          <Grid item xs={12} sm={3}>
            <FormControl size="small" fullWidth required>
              <InputLabel>Branch</InputLabel>
              <Select
                value={selectedBranch}
                label="Branch"
                onChange={(e) => setSelectedBranch(e.target.value)}
              >
                {branches.map((b) => (
                  <MenuItem key={b.branchCode} value={b.branchCode}>
                    {b.branchCode}{b.branchName ? ` — ${b.branchName}` : ""}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(o) =>
                typeof o === "string" ? o : (o.supplierName ?? "")
              }
              freeSolo
              value={supplierName}
              onChange={(_, v) => {
                if (v && typeof v === "object") {
                  setSupplierName(v.supplierName || "");
                  setSupplierId(v.id || "");
                } else {
                  setSupplierId("");
                }
              }}
              onInputChange={(_, v) => {
                setSupplierName(v);
                if (fieldErrors.supplier) setFieldErrors((f) => ({ ...f, supplier: false }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Supplier"
                  size="small"
                  fullWidth
                  required
                  error={fieldErrors.supplier}
                  helperText={fieldErrors.supplier ? "Supplier is required" : ""}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="Supplier Invoice No"
              size="small"
              fullWidth
              required
              error={fieldErrors.supplierInvNo}
              helperText={fieldErrors.supplierInvNo ? "Required" : ""}
              value={supplierInvNo}
              onChange={(e) => {
                setSupplierInvNo(e.target.value);
                if (fieldErrors.supplierInvNo)
                  setFieldErrors((f) => ({ ...f, supplierInvNo: false }));
              }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
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
            inputRef={qtyRef}
            label="Qty"
            size="small"
            type="number"
            sx={{ width: 90 }}
            value={pendingQty}
            onChange={(e) => {
              const val = e.target.value;
              setPendingQty(val);
              const r = toFloat(pendingRate);
              const q = toFloat(val, 1);
              if (r > 0 && q > 0) setPendingTotal((r * q).toFixed(2));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusRate(); } }}
            onFocus={(e) => e.target.select()}
            inputProps={{ min: 0.01, step: 1, style: { textAlign: "right" } }}
          />
          <TextField
            inputRef={rateRef}
            label="Rate incl. Tax"
            size="small"
            type="number"
            sx={{ width: 130 }}
            value={pendingRate}
            onChange={(e) => {
              const val = e.target.value;
              setPendingRate(val);
              const r = toFloat(val);
              const q = toFloat(pendingQty, 1);
              if (r >= 0 && q > 0) setPendingTotal((r * q).toFixed(2));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusTotal(); } }}
            onFocus={(e) => e.target.select()}
            disabled={!pendingItem}
            inputProps={{ min: 0, step: 0.01, style: { textAlign: "right" } }}
          />
          <TextField
            inputRef={totalRef}
            label="Total"
            size="small"
            type="number"
            sx={{ width: 110 }}
            value={pendingTotal}
            onChange={(e) => {
              const val = e.target.value;
              setPendingTotal(val);
              const t = toFloat(val);
              const q = toFloat(pendingQty, 1);
              if (t > 0 && q > 0) setPendingRate(+(t / q).toFixed(4));
            }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitPending(); } }}
            onFocus={(e) => e.target.select()}
            disabled={!pendingItem}
            inputProps={{ min: 0, style: { textAlign: "right", fontWeight: 600 } }}
          />
          <UnitSelect
            label="Purch. Unit"
            value={pendingUnit}
            onChange={setPendingUnit}
            disabled={!pendingItem}
            sx={{ width: 110 }}
            placeholder="e.g. Box"
          />
          <TextField
            label="Conv. Factor"
            size="small"
            type="number"
            sx={{ width: 100 }}
            value={pendingConvFactor}
            onChange={(e) => setPendingConvFactor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitPending(); } }}
            disabled={!pendingItem}
            inputProps={{ min: 1, step: 1, style: { textAlign: "right" } }}
          />
          {pendingItem ? (
            <Stack spacing={0} alignItems="flex-start">
              <Chip
                label={`→ ${pendingItem.itemName}`}
                color="primary"
                size="small"
                onDelete={() => { setPendingItem(null); setPendingUnit(""); setPendingConvFactor("1"); barcodeRef.current?.focus(); }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                {pendingItem.unitName ? `Inv. unit: ${pendingItem.unitName}` : ""}
                {pendingItem.standardPrice != null ? `  ·  Std: ${toFloat(pendingItem.standardPrice).toFixed(2)}` : ""}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
              scan or select an item
            </Typography>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          Scan / select item → <b>Qty</b> [Enter] → <b>Rate incl. Tax</b> [Enter] → <b>Total</b> [Enter] → row added · editing Total back-calculates Rate
        </Typography>
      </Paper>

      {/* ── Items table ── */}
      <Paper sx={{ mb: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addBlankRow}
          >
            Add Row
          </Button>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 36 }} />   {/* # */}
              <col style={{ minWidth: 180, width: "30%" }} />  {/* Item */}
              <col style={{ width: 90 }} />   {/* Qty */}
              <col style={{ width: 110 }} />  {/* Rate incl. Tax */}
              <col style={{ width: 110 }} />  {/* Total */}
              <col style={{ width: 72 }} />   {/* Tax % */}
              <col style={{ width: 96 }} />   {/* Purch. Unit */}
              <col style={{ width: 72 }} />   {/* Conv. */}
              <col style={{ width: 90 }} />   {/* Inv. Qty */}
              <col style={{ width: 40 }} />   {/* Delete */}
            </colgroup>
            <TableHead>
              <TableRow sx={{ bgcolor: "action.selected" }}>
                <TableCell sx={{ fontWeight: "bold" }}>#</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Item</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Qty</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Rate incl. Tax</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Total</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Tax %</TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>Purch. Unit</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Conv.</TableCell>
                <TableCell sx={{ fontWeight: "bold", textAlign: "right" }}>Inv. Qty</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No items yet — scan a barcode or search by name above
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, idx) => (
                <TableRow key={row._key} hover>
                  {/* # */}
                  <TableCell sx={{ verticalAlign: "top", pt: 1 }}>{idx + 1}</TableCell>

                  {/* Item — barcode + std price shown as sub-text */}
                  <TableCell sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <Autocomplete
                      options={itemList}
                      getOptionLabel={(o) =>
                        typeof o === "string" ? o : (o.itemName ?? "")
                      }
                      value={
                        itemList.find(
                          (it) => String(it.item_id ?? it.itemId) === row._id
                        ) || row.itemName
                      }
                      onChange={(_, val) => changeRowItem(row._key, val)}
                      freeSolo
                      size="small"
                      filterOptions={(opts, { inputValue }) => {
                        if (!inputValue) return opts.slice(0, 25);
                        const q = inputValue.toLowerCase();
                        return opts
                          .filter(
                            (o) =>
                              o.itemName?.toLowerCase().includes(q) ||
                              o.barcode?.toLowerCase().includes(q)
                          )
                          .slice(0, 40);
                      }}
                      isOptionEqualToValue={(o, v) =>
                        typeof v === "string"
                          ? o.itemName === v
                          : String(o.item_id ?? o.itemId) === String(v?.item_id ?? v?.itemId)
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          sx={{ "& .MuiInputBase-root": { fontSize: "0.85rem" } }}
                        />
                      )}
                    />
                    {(row.barcode || row.standardPrice != null) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, lineHeight: 1.3 }}>
                        {row.barcode ? row.barcode : ""}
                        {row.barcode && row.standardPrice != null ? " · " : ""}
                        {row.standardPrice != null ? `Std: ${toFloat(row.standardPrice).toFixed(2)}` : ""}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Qty — inv qty shown as sub-text */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateRow(row._key, "quantity", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: "100%" }}
                    />
                    {row.inventoryUnit && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "right", mt: 0.25, lineHeight: 1.3 }}>
                        {(row.inventoryQty ?? row.quantity ?? 0).toFixed(2)} {row.inventoryUnit}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Rate incl. Tax — rate excl. shown as sub-text */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.rateIncludingTax}
                      onChange={(e) => updateRow(row._key, "rateIncludingTax", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: "100%" }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "right", mt: 0.25, lineHeight: 1.3 }}>
                      Excl: {row.rateBeforeTax.toFixed(2)}
                    </Typography>
                  </TableCell>

                  {/* Total */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.totalAmount}
                      onChange={(e) => updateRow(row._key, "totalAmount", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px", fontWeight: 600 }, min: 0 }}
                      sx={{ width: "100%" }}
                    />
                  </TableCell>

                  {/* Tax % */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.taxRate}
                      onChange={(e) => updateRow(row._key, "taxRate", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 0 }}
                      sx={{ width: "100%" }}
                    />
                  </TableCell>

                  {/* Purch. Unit */}
                  <TableCell sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <UnitSelect
                      value={row.unit || ""}
                      onChange={(v) => updateRow(row._key, "unit", v)}
                      sx={{ width: "100%" }}
                    />
                  </TableCell>

                  {/* Conv. Factor */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={row.conversionFactor ?? 1}
                      onChange={(e) => updateRow(row._key, "conversionFactor", e.target.value)}
                      onFocus={(e) => e.target.select()}
                      inputProps={{ style: { textAlign: "right", padding: "2px 6px" }, min: 1 }}
                      sx={{ width: "100%" }}
                    />
                  </TableCell>

                  {/* Inv. Qty */}
                  <TableCell align="right" sx={{ verticalAlign: "top", pt: 0.5 }}>
                    <Tooltip title="Inv. Qty = Purch. Qty × Conv. Factor" placement="top">
                      <TextField
                        size="small"
                        type="number"
                        value={row.inventoryQty ?? row.quantity ?? 0}
                        onChange={(e) => updateRow(row._key, "inventoryQty", e.target.value)}
                        onFocus={(e) => e.target.select()}
                        inputProps={{ style: { textAlign: "right", padding: "2px 6px", fontWeight: 600, color: "#1565c0" }, min: 0 }}
                        sx={{ width: "100%" }}
                      />
                    </Tooltip>
                  </TableCell>

                  {/* Delete */}
                  <TableCell sx={{ verticalAlign: "top", pt: 0.5 }}>
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
                  <TableCell colSpan={4} align="right">
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
                  <TableCell colSpan={5} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ── Bill Total / Round Off ── */}
      {rows.length > 0 && (
        <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
          <Stack alignItems="flex-end" spacing={1}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, textAlign: "right" }}>
                Items Total
              </Typography>
              <Typography fontWeight={600} sx={{ minWidth: 120, textAlign: "right", fontFamily: "monospace" }}>
                {grandTotal.toFixed(2)}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, textAlign: "right" }}>
                Bill Total
              </Typography>
              <TextField
                size="small"
                type="number"
                placeholder={grandTotal.toFixed(2)}
                value={billTotal}
                onChange={(e) => setBillTotal(e.target.value)}
                onFocus={(e) => e.target.select()}
                inputProps={{ style: { textAlign: "right", fontFamily: "monospace" }, min: 0 }}
                sx={{ width: 120 }}
              />
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 110, textAlign: "right" }}>
                Round Off
              </Typography>
              <Typography
                fontWeight={600}
                sx={{
                  minWidth: 120, textAlign: "right", fontFamily: "monospace",
                  color: roundOff > 0 ? "success.main" : roundOff < 0 ? "error.main" : "text.secondary",
                }}
              >
                {roundOff.toFixed(2)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      )}

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
        initialSupplierName={supplierName}
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
