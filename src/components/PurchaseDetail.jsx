import React, { useState, useEffect, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/** Both date columns are timestamps; the report only ever means the day. */
const shortDate = (value) => (value ? String(value).slice(0, 10) : "");

const money = (value) => {
  const number = parseFloat(value);
  return Number.isNaN(number)
    ? ""
    : number.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

const PurchaseDetail = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));

  /**
   * Which date the range filters on.
   *
   * VOUCHER is the date the purchase was entered here — what this report has always used,
   * while showing only the supplier invoice number and date, so nothing on the screen said
   * which date the range meant. SUPPLIER_INVOICE is the date on the supplier's own invoice,
   * which is the basis a GST return is filed on. They are not interchangeable: most purchases
   * on a live tenant carry different dates in the two fields.
   */
  const [dateBasis, setDateBasis] = useState("VOUCHER");
  const [excluded, setExcluded] = useState(0);
  /** The basis the rows on screen were actually drawn on, not the one in the selector. */
  const [loadedBasis, setLoadedBasis] = useState("VOUCHER");

  /**
   * Whether unfinalised purchases count.
   *
   * A draft is one somebody started and has not finalised. They used to be included with
   * nothing marking them, so the total mixed committed purchases with unfinished ones. Off by
   * default; when it is on, every row shows its status so the two can be told apart.
   */
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [loadedIncludeDrafts, setLoadedIncludeDrafts] = useState(false);

  const [purchaseData, setPurchaseData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("PurchasesData.xlsx");
  const [error, setError] = useState("");

  const allowedBranches = useMemo(() => {
    try {
      const raw = localStorage.getItem("allowedBranches");
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }, []);

  const fetchBranches = async () => {
    try {
      setError("");
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");

      const response = await fetch(`/api/${tenancyId}/branches`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to fetch branches");

      const data = await response.json();

      // Normalize: support {branches:[...]} or {data:[...]} or [...]
      const list = Array.isArray(data) ? data : data.branches || data.data || [];

      // ✅ Filter branches by allowedBranches list
      const filtered = allowedBranches.length
        ? list.filter((b) => allowedBranches.includes(b.branchCode))
        : [];

      setBranches(filtered);

      // ✅ Auto-select if only one branch allowed
      if (!branch && filtered.length === 1) {
        setBranch(filtered[0].branchCode);
      }

      // ✅ If current selection is not allowed anymore, clear it
      if (branch && !filtered.some((b) => b.branchCode === branch)) {
        setBranch("");
      }
    } catch (e) {
      console.error("Error fetching branches:", e);
      setError("Failed to load branches.");
      setBranches([]);
      setBranch("");
    }
  };

  const fetchPurchaseData = async () => {
    if (!branch || !fromDate || !toDate) {
      setError("Choose a branch and a date range first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(
        `/api/${tenancyId}/purchasedata?branch=${encodeURIComponent(branch)}` +
          `&fromDate=${fromDate}&toDate=${toDate}&dateBasis=${dateBasis}` +
          `&includeDrafts=${includeDrafts}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) throw new Error("Failed to fetch purchase data");

      const data = await response.json();
      setPurchaseData(Array.isArray(data.data) ? data.data : []);
      // An older server answers without these two. Reading the requested basis back keeps the
      // heading honest against a server that has not been updated yet.
      setLoadedBasis(data.dateBasis || dateBasis);
      setLoadedIncludeDrafts(
        data.includeDrafts === undefined ? includeDrafts : data.includeDrafts
      );
      setExcluded(data.excludedMissingSupplierDate || 0);
    } catch (e) {
      console.error("Error fetching purchase data:", e);
      setError("Failed to load purchase data.");
      setPurchaseData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(purchaseData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Purchase Data");
    saveAs(
      new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
        type: "application/octet-stream",
      }),
      fileName
    );
    setOpen(false);
  };

  /**
   * The basis belongs in the filename. Two exports of the same range on different bases are
   * otherwise indistinguishable once downloaded, and these are the files that get attached to
   * a return.
   */
  const openExport = () => {
    const basisTag =
      loadedBasis === "SUPPLIER_INVOICE" ? "SupplierInvoiceDate" : "VoucherDate";
    const draftTag = loadedIncludeDrafts ? "_WithDrafts" : "";
    setFileName(
      `Purchases_${branch}_${basisTag}${draftTag}_${fromDate}_to_${toDate}.xlsx`
    );
    setOpen(true);
  };

  const totalAmount = Array.isArray(purchaseData)
    ? purchaseData.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0)
    : 0;

  const basisLabel =
    loadedBasis === "SUPPLIER_INVOICE" ? "Supplier Invoice Date" : "Voucher Date";

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Purchase Report
      </Typography>
      {/* Which date the range means, said on the screen rather than left in the query. */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {purchaseData.length > 0
          ? `${purchaseData.length} line${
              purchaseData.length === 1 ? "" : "s"
            } from ${fromDate} to ${toDate}, by ${basisLabel}, ${
              loadedIncludeDrafts ? "including drafts" : "finalised purchases only"
            }.`
          : "Choose a branch, a date range and which date the range should filter on."}
      </Typography>

      {/* One row of filters, in the order they are decided: where, which date, what range. */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="branch-label">Branch</InputLabel>
            <Select
              labelId="branch-label"
              label="Branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.branchCode}>
                  {b.branchCode}
                  {b.branchName ? ` - ${b.branchName}` : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="date-basis-label">Date Basis</InputLabel>
            <Select
              labelId="date-basis-label"
              label="Date Basis"
              value={dateBasis}
              onChange={(e) => setDateBasis(e.target.value)}
            >
              <MenuItem value="VOUCHER">Voucher Date</MenuItem>
              <MenuItem value="SUPPLIER_INVOICE">Supplier Invoice Date</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Checkbox
                size="small"
                checked={includeDrafts}
                onChange={(e) => setIncludeDrafts(e.target.checked)}
              />
            }
            label="Include drafts"
          />

          <TextField
            size="small"
            type="date"
            label="From Date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />

          <Box sx={{ flexGrow: 1 }} />

          <Button variant="contained" onClick={fetchPurchaseData} disabled={loading}>
            {loading ? "Loading…" : "Fetch"}
          </Button>
          <Button
            variant="outlined"
            onClick={openExport}
            disabled={purchaseData.length === 0}
          >
            Export to Excel
          </Button>
        </Stack>
      </Paper>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Said plainly rather than left as a quietly smaller total. A purchase with no supplier
          invoice date cannot be placed on that basis, and falling back to the voucher date
          would produce a figure that is neither. */}
      {excluded > 0 && loadedBasis === "SUPPLIER_INVOICE" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {excluded} purchase{excluded === 1 ? "" : "s"} in this range{" "}
          {excluded === 1 ? "has" : "have"} no supplier invoice date and{" "}
          {excluded === 1 ? "is" : "are"} not included. Switch to Voucher Date to see
          {excluded === 1 ? " it" : " them"}.
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ width: "100%", maxHeight: "60vh" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: "#1976d2", color: "#fff" } }}>
              {/* Ours first: it is the document a reader can find again in any other screen. */}
              <TableCell>Voucher No</TableCell>
              <TableCell>Voucher Date</TableCell>
              <TableCell>Supplier Name</TableCell>
              <TableCell>Supplier Invoice No</TableCell>
              <TableCell>Supplier Invoice Date</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell align="right">Quantity</TableCell>
              <TableCell align="right">Rate</TableCell>
              <TableCell align="right">Amount</TableCell>
              {/* Only when drafts are included: a column of "FINAL" against every row is
                  noise, and its absence is itself the statement that none are drafts. */}
              {loadedIncludeDrafts && <TableCell>Status</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {purchaseData.map((row, index) => (
              <TableRow key={index} hover>
                <TableCell sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                  {row.voucher_number}
                </TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {shortDate(row.voucher_date)}
                </TableCell>
                <TableCell>{row.supplier_name}</TableCell>
                <TableCell>{row.supplier_voucher_number}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap" }}>
                  {shortDate(row.supplier_voucher_date)}
                </TableCell>
                <TableCell>{row.item_name}</TableCell>
                <TableCell align="right">{row.qty}</TableCell>
                <TableCell align="right">{money(row.purchase_rate)}</TableCell>
                <TableCell align="right">{money(row.amount)}</TableCell>
                {loadedIncludeDrafts && (
                  <TableCell>
                    {row.status === "FINAL" ? (
                      "Final"
                    ) : (
                      <Chip size="small" color="warning" label={row.status || "DRAFT"} />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {purchaseData.length > 0 && (
              <TableRow>
                <TableCell colSpan={8} sx={{ fontWeight: "bold" }}>
                  Total ({basisLabel}
                  {loadedIncludeDrafts ? ", drafts included" : ""})
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: "bold" }}>
                  {money(totalAmount)}
                </TableCell>
                {loadedIncludeDrafts && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Export to Excel</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Please enter the file name for the Excel file.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="File Name"
            type="text"
            fullWidth
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleExport} color="primary">
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseDetail;
