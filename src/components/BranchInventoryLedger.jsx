import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Button, Collapse, CircularProgress, IconButton,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, Autocomplete, Chip,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon   from "@mui/icons-material/KeyboardArrowUp";
import FileDownloadIcon       from "@mui/icons-material/FileDownload";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ── Detail sub-table shown when a summary row is expanded ────────────────────
function TransactionDetail({ transactions }) {
  const totalIn  = transactions.reduce((s, t) => s + (Number(t.qtyIn)  || 0), 0);
  const totalOut = transactions.reduce((s, t) => s + (Number(t.qtyOut) || 0), 0);

  return (
    <Box sx={{ m: "4px 16px 12px 64px" }}>
      <Table size="small" sx={{ border: "1px solid", borderColor: "divider" }}>
        <TableHead sx={{ bgcolor: "success.dark" }}>
          <TableRow>
            {["Date / Time", "Voucher No", "Type", "Batch", "Description", "Qty In", "Qty Out"].map((h) => (
              <TableCell key={h} sx={{ fontWeight: 700, fontSize: 11, py: 0.5, color: "success.contrastText" }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((t, i) => {
            const dateStr = t.voucherDate
              ? String(t.voucherDate).slice(0, 19).replace("T", " ")
              : "";
            const qIn  = Number(t.qtyIn)  || 0;
            const qOut = Number(t.qtyOut) || 0;
            return (
              <TableRow key={i} hover>
                <TableCell sx={{ fontSize: 11, whiteSpace: "nowrap", color: "text.primary" }}>{dateStr}</TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.primary" }}>{t.voucherNumber || ""}</TableCell>
                <TableCell sx={{ fontSize: 11 }}>
                  {t.voucherType
                    ? <Chip label={t.voucherType} size="small" sx={{ fontSize: 10, height: 18 }} />
                    : ""}
                </TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.primary" }}>{t.batchCode   || ""}</TableCell>
                <TableCell sx={{ fontSize: 11, color: "text.primary" }}>{t.description || ""}</TableCell>
                <TableCell align="right" sx={{ fontSize: 11, color: qIn  > 0 ? "success.main" : "text.disabled" }}>
                  {qIn  > 0 ? qIn.toFixed(2)  : "—"}
                </TableCell>
                <TableCell align="right" sx={{ fontSize: 11, color: qOut > 0 ? "error.main" : "text.disabled" }}>
                  {qOut > 0 ? qOut.toFixed(2) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Detail total */}
          <TableRow sx={{ bgcolor: "action.selected" }}>
            <TableCell colSpan={5} align="right" sx={{ fontWeight: 700, fontSize: 11, color: "text.primary" }}>Sub-total</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: "success.main" }}>
              {totalIn  > 0 ? totalIn.toFixed(2)  : "—"}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11, color: "error.main" }}>
              {totalOut > 0 ? totalOut.toFixed(2) : "—"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

// ── One collapsible row in the master table ───────────────────────────────────
function SummaryRow({ item, expanded, onToggle }) {
  const closing = item.openingStock + item.totalQtyIn - item.totalQtyOut;
  return (
    <>
      <TableRow
        hover
        onClick={onToggle}
        sx={{
          cursor: "pointer",
          bgcolor: expanded ? "primary.dark" : "inherit",
          "& td": { fontWeight: expanded ? 700 : 400, color: expanded ? "primary.contrastText" : "text.primary" },
        }}
      >
        <TableCell sx={{ width: 40, py: 0.5 }}>
          <IconButton size="small" sx={{ p: 0.5, color: "inherit" }}>
            {expanded ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ py: 0.5 }}>{item.itemName}</TableCell>
        <TableCell sx={{ py: 0.5 }}>{item.barcode || ""}</TableCell>
        <TableCell align="right" sx={{ py: 0.5, color: expanded ? "primary.contrastText" : "text.secondary" }}>
          {item.openingStock !== 0 ? item.openingStock.toFixed(2) : "—"}
        </TableCell>
        <TableCell align="right" sx={{ py: 0.5, color: expanded ? "primary.contrastText" : "success.main" }}>
          {item.totalQtyIn > 0 ? item.totalQtyIn.toFixed(2) : "—"}
        </TableCell>
        <TableCell align="right" sx={{ py: 0.5, color: expanded ? "primary.contrastText" : "error.main" }}>
          {item.totalQtyOut > 0 ? item.totalQtyOut.toFixed(2) : "—"}
        </TableCell>
        <TableCell
          align="right"
          sx={{
            py: 0.5,
            fontWeight: 700,
            color: expanded
              ? "primary.contrastText"
              : closing < 0 ? "error.main" : closing > 0 ? "success.main" : "text.secondary",
          }}
        >
          {closing.toFixed(2)}
        </TableCell>
        <TableCell align="center" sx={{ py: 0.5 }}>
          <Chip label={item.transactions.length} size="small" color="default" sx={{ height: 18, fontSize: 10 }} />
        </TableCell>
      </TableRow>

      {/* Collapsible detail */}
      <TableRow sx={{ "& td": { p: 0 } }}>
        <TableCell colSpan={8}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <TransactionDetail transactions={item.transactions} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ── Main report page ──────────────────────────────────────────────────────────
export default function BranchInventoryLedger() {
  const [branchList,     setBranchList]     = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [txnDate,        setTxnDate]        = useState(() => new Date().toISOString().slice(0, 10));
  const [rawRows,        setRawRows]        = useState([]);
  const [openingMap,     setOpeningMap]     = useState({}); // itemId → openingStock
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [expandedItem,   setExpandedItem]   = useState(null);

  // Allowed branches from JWT
  const allowedBranches = useMemo(() => {
    try {
      const list = JSON.parse(localStorage.getItem("allowedBranches") || "[]");
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }, []);

  // Load branch list
  useEffect(() => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token     = localStorage.getItem("jwtToken");
    fetch(`/api/${tenancyId}/branches`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        const filtered = allowedBranches.length
          ? list.filter((b) => allowedBranches.includes(b.branchCode))
          : list;
        setBranchList(filtered);
        if (filtered.length === 1) setSelectedBranch(filtered[0].branchCode);
      })
      .catch(() => {});
  }, []);

  // Fetch transactions + opening stock for the branch + date
  const fetchReport = async () => {
    if (!selectedBranch || !txnDate) return;
    setLoading(true);
    setError(null);
    setExpandedItem(null);
    setOpeningMap({});
    const tenancyId = localStorage.getItem("tenancyId");
    const token     = localStorage.getItem("jwtToken");
    const authHdr   = { Authorization: `Bearer ${token}` };
    try {
      const [txnRes, openRes] = await Promise.all([
        fetch(
          `/api/${tenancyId}/inventory/branch-inventory?branchCode=${encodeURIComponent(selectedBranch)}&txnDate=${txnDate}`,
          { headers: authHdr }
        ),
        fetch(
          `/api/${tenancyId}/inventory/branch-opening-stock?branchCode=${encodeURIComponent(selectedBranch)}&beforeDate=${txnDate}`,
          { headers: authHdr }
        ),
      ]);

      if (!txnRes.ok) throw new Error(`Server error: ${txnRes.status}`);
      const txns    = await txnRes.json();
      const opening = openRes.ok ? await openRes.json() : [];

      const map = {};
      for (const row of opening) {
        map[row.itemId] = Number(row.openingStock) || 0;
      }
      setOpeningMap(map);
      setRawRows(txns);
    } catch (e) {
      setError(e.message || "Failed to fetch data");
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by item → summary rows, attach opening stock
  const summaryRows = useMemo(() => {
    const map = new Map();
    for (const t of rawRows) {
      const key = t.itemId || t.itemName || "UNKNOWN";
      if (!map.has(key)) {
        map.set(key, {
          itemId:       t.itemId || key,
          itemName:     t.itemName || t.itemId || key,
          barcode:      t.barcode || "",
          openingStock: openingMap[t.itemId] ?? 0,
          totalQtyIn:   0,
          totalQtyOut:  0,
          transactions: [],
        });
      }
      const entry = map.get(key);
      entry.totalQtyIn  += Number(t.qtyIn)  || 0;
      entry.totalQtyOut += Number(t.qtyOut) || 0;
      entry.transactions.push(t);
    }
    return [...map.values()].sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [rawRows, openingMap]);

  // Grand totals
  const grandOpening = summaryRows.reduce((s, r) => s + r.openingStock,  0);
  const grandIn      = summaryRows.reduce((s, r) => s + r.totalQtyIn,    0);
  const grandOut     = summaryRows.reduce((s, r) => s + r.totalQtyOut,   0);
  const grandClosing = grandOpening + grandIn - grandOut;

  // Excel export — summary sheet + detail sheet
  const handleExport = () => {
    const summarySheet = summaryRows.map((r) => ({
      "Item Name":     r.itemName,
      "Barcode":       r.barcode,
      "Opening Stock": r.openingStock,
      "Qty In":        r.totalQtyIn,
      "Qty Out":       r.totalQtyOut,
      "Closing Stock": r.openingStock + r.totalQtyIn - r.totalQtyOut,
      "Txn Count":     r.transactions.length,
    }));
    summarySheet.push({
      "Item Name":     "TOTAL",
      "Barcode":       "",
      "Opening Stock": grandOpening,
      "Qty In":        grandIn,
      "Qty Out":       grandOut,
      "Closing Stock": grandClosing,
      "Txn Count":     "",
    });

    const detailSheet = rawRows.map((t) => ({
      "Item Name":   t.itemName    || "",
      "Barcode":     t.barcode     || "",
      "Date/Time":   t.voucherDate ? String(t.voucherDate).slice(0, 19).replace("T", " ") : "",
      "Voucher No":  t.voucherNumber || "",
      "Type":        t.voucherType   || "",
      "Batch":       t.batchCode     || "",
      "Description": t.description   || "",
      "Qty In":      Number(t.qtyIn)  || 0,
      "Qty Out":     Number(t.qtyOut) || 0,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheet), "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailSheet),  "Transactions");
    saveAs(
      new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/octet-stream" }),
      `BranchInventoryLedger_${selectedBranch}_${txnDate}.xlsx`
    );
  };

  const toggle = (itemId) => setExpandedItem((prev) => (prev === itemId ? null : itemId));

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Branch Inventory Ledger
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Item-wise summary for a branch and date — click any row to see individual transactions.
      </Typography>

      {/* Filter bar */}
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-end", mb: 3 }}>
        <Autocomplete
          options={branchList}
          getOptionLabel={(opt) =>
            typeof opt === "string" ? opt : `(${opt.branchCode}) ${opt.branchName || opt.branchCode}`
          }
          value={branchList.find((b) => b.branchCode === selectedBranch) || null}
          onChange={(_, v) => setSelectedBranch(v?.branchCode || "")}
          renderInput={(params) => (
            <TextField {...params} label="Branch" size="small" sx={{ width: 260 }} />
          )}
        />
        <TextField
          label="Date"
          type="date"
          size="small"
          value={txnDate}
          onChange={(e) => setTxnDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button
          variant="contained"
          onClick={fetchReport}
          disabled={loading || !selectedBranch || !txnDate}
          sx={{ height: 40 }}
        >
          {loading ? <CircularProgress size={20} color="inherit" /> : "Generate"}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileDownloadIcon />}
          onClick={handleExport}
          disabled={summaryRows.length === 0}
          sx={{ height: 40 }}
        >
          Export Excel
        </Button>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
      )}

      {/* Master table */}
      {summaryRows.length > 0 && (
        <TableContainer component={Paper} elevation={2}>
          <Table size="small">
            <TableHead sx={{ bgcolor: "primary.dark" }}>
              <TableRow>
                <TableCell sx={{ color: "primary.contrastText", width: 40 }} />
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }}>Item Name</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }}>Barcode</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }} align="right">Opening</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }} align="right">Qty In</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }} align="right">Qty Out</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }} align="right">Closing</TableCell>
                <TableCell sx={{ color: "primary.contrastText", fontWeight: 700 }} align="center">Txns</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summaryRows.map((item) => (
                <SummaryRow
                  key={item.itemId}
                  item={item}
                  expanded={expandedItem === item.itemId}
                  onToggle={() => toggle(item.itemId)}
                />
              ))}

              {/* Grand total row */}
              <TableRow sx={{ bgcolor: "action.selected" }}>
                <TableCell />
                <TableCell colSpan={2} sx={{ fontWeight: 700, color: "text.primary" }}>
                  Grand Total — {summaryRows.length} item{summaryRows.length !== 1 ? "s" : ""}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "text.secondary" }}>
                  {grandOpening !== 0 ? grandOpening.toFixed(2) : "—"}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>
                  {grandIn  > 0 ? grandIn.toFixed(2)  : "—"}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                  {grandOut > 0 ? grandOut.toFixed(2) : "—"}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: grandClosing < 0 ? "error.main" : "success.main" }}>
                  {grandClosing.toFixed(2)}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: "text.primary" }}>{rawRows.length}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && summaryRows.length === 0 && !error && (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
          Select a branch and date, then click Generate.
        </Typography>
      )}
    </Box>
  );
}
