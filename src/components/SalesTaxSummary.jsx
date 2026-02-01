import React, { useState, useEffect, useMemo } from "react";
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
} from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/en";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/**
 * Tax-wise Sales Summary
 * Groups salesData by tax_rate and shows totals.
 */
const SalesTaxSummary = () => {
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState([]);
  const [fromDate, setFromDate] = useState(
    dayjs().subtract(30, "day").format("YYYY-MM-DD")
  );
  const [toDate, setToDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [salesData, setSalesData] = useState([]);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("SalesTaxSummary.xlsx");
  const [error, setError] = useState("");

  // ✅ Read allowed branches (stored during login from JWT claims)
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

  const fetchSalesData = async () => {
    if (branch && fromDate && toDate) {
      try {
        setError("");
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");

        const response = await fetch(
          `/api/${tenancyId}/sales/salesdata?branch=${encodeURIComponent(
            branch
          )}&fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(
            toDate
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) throw new Error("Failed to fetch sales data");

        const data = await response.json();
        setSalesData(data.data || []);
      } catch (err) {
        console.error("Error fetching sales data:", err);
        setError("Failed to fetch sales data.");
        setSalesData([]);
      }
    } else {
      setError("Please select branch and date range.");
    }
  };

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // Grouping logic (tax-wise)
  // -----------------------------
  const groupedData = useMemo(() => {
  const taxMap = new Map();

  (salesData || []).forEach((row) => {
    const taxRate = Number(row.tax_rate ?? 0);
    const itemName = row.item_name || "UNKNOWN";

    const qty = Number(row.qty ?? 0);
    const amount = Number(row.amount ?? 0);

    if (!taxMap.has(taxRate)) {
      taxMap.set(taxRate, {
        tax_rate: taxRate,
        items: new Map(),
        subtotal_qty: 0,
        subtotal_amount: 0,
      });
    }

    const taxGroup = taxMap.get(taxRate);

    if (!taxGroup.items.has(itemName)) {
      taxGroup.items.set(itemName, {
        item_name: itemName,
        qty: 0,
        amount: 0,
        lines: 0,
      });
    }

    const item = taxGroup.items.get(itemName);
    item.qty += qty;
    item.amount += amount;
    item.lines += 1;

    taxGroup.subtotal_qty += qty;
    taxGroup.subtotal_amount += amount;
  });

  return Array.from(taxMap.values())
    .sort((a, b) => a.tax_rate - b.tax_rate)
    .map((g) => ({
      ...g,
      items: Array.from(g.items.values()).sort((a, b) =>
        a.item_name.localeCompare(b.item_name)
      ),
    }));
}, [salesData]);


const grandTotal = groupedData.reduce(
  (acc, g) => {
    acc.qty += g.subtotal_qty;
    acc.amount += g.subtotal_amount;
    return acc;
  },
  { qty: 0, amount: 0 }
);

  // -----------------------------
  // Export grouped data
  // -----------------------------
  const handleExport = () => {
  // Build rows with REAL numbers (not strings)
  const exportRows = [];

  groupedData.forEach((g) => {
    g.items.forEach((item) => {
      exportRows.push({
        tax_rate: g.tax_rate,          // number
        item_name: item.item_name,     // string
        lines: item.lines,             // number
        total_qty: item.qty,           // number ✅
        total_amount: item.amount,     // number ✅
      });
    });

    // Subtotal row (keep numeric columns numeric; text in tax_rate)
    exportRows.push({
      tax_rate: `${g.tax_rate}% SUBTOTAL`, // string label
      item_name: "",
      lines: null,
      total_qty: g.subtotal_qty,          // number ✅
      total_amount: g.subtotal_amount,    // number ✅
    });
  });

  // Grand total row
  exportRows.push({
    tax_rate: "GRAND TOTAL",
    item_name: "",
    lines: null,
    total_qty: grandTotal.qty,        // number ✅
    total_amount: grandTotal.amount,  // number ✅
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // ✅ Apply number formats (optional but nice)
  // D = total_qty, E = total_amount (because columns are: A tax_rate, B item_name, C lines, D total_qty, E total_amount)
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const qtyCell = XLSX.utils.encode_cell({ r, c: 3 });    // D
    const amtCell = XLSX.utils.encode_cell({ r, c: 4 });    // E
    if (worksheet[qtyCell] && typeof worksheet[qtyCell].v === "number") worksheet[qtyCell].z = "0.000";
    if (worksheet[amtCell] && typeof worksheet[amtCell].v === "number") worksheet[amtCell].z = "0.00";
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tax Summary");

  const excelBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  saveAs(new Blob([excelBytes], { type: "application/octet-stream" }), fileName);
  setOpen(false);
};

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      {allowedBranches.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No allowed branches found in login claims. Please login again or check
          branch assignments.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControl fullWidth margin="normal" sx={{ mb: 3 }}>
        <InputLabel id="branch-label">Branch</InputLabel>
        <Select
          labelId="branch-label"
          label="Branch"
          value={branch}
          onChange={(e) => setBranch(e.target.value)}
          disabled={branches.length === 0}
        >
          {branches.map((b) => (
            <MenuItem key={b.branchCode} value={b.branchCode}>
              {b.branchCode}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <TextField
          type="date"
          label="From Date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1, mr: 2 }}
        />
        <TextField
          type="date"
          label="To Date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ flex: 1 }}
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={fetchSalesData}
        sx={{ mb: 3 }}
        disabled={!branch}
      >
        Fetch Sales Data
      </Button>

      <Button
        variant="contained"
        color="secondary"
        onClick={() => setOpen(true)}
        sx={{ mb: 3, ml: 2 }}
        
      >
        Export to Excel
      </Button>

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

      <TableContainer component={Paper} sx={{ width: "100%", mt: 2 }}>
        <Table>
        <TableHead>
  <TableRow>
    <TableCell>Tax %</TableCell>
    <TableCell>Item Name</TableCell>
    <TableCell align="right">Lines</TableCell>
    <TableCell align="right">Total Qty</TableCell>
    <TableCell align="right">Total Amount</TableCell>
  </TableRow>
</TableHead>

          <TableBody>
  {groupedData.map((taxGroup) => (
    <React.Fragment key={taxGroup.tax_rate}>
      {/* Item rows */}
      {taxGroup.items.map((item, idx) => (
        <TableRow key={idx}>
          <TableCell>{taxGroup.tax_rate.toFixed(2)}%</TableCell>
          <TableCell>{item.item_name}</TableCell>
          <TableCell align="right">{item.lines}</TableCell>
          <TableCell align="right">{item.qty.toFixed(3)}</TableCell>
          <TableCell align="right">{item.amount.toFixed(2)}</TableCell>
        </TableRow>
      ))}

      {/* Subtotal row per tax % */}
      <TableRow sx={{ backgroundColor: "#0b0101" }}>
        <TableCell colSpan={3} sx={{ fontWeight: "bold" }}>
          {taxGroup.tax_rate.toFixed(2)}% Subtotal
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {taxGroup.subtotal_qty.toFixed(3)}
        </TableCell>
        <TableCell align="right" sx={{ fontWeight: "bold" }}>
          {taxGroup.subtotal_amount.toFixed(2)}
        </TableCell>
      </TableRow>
    </React.Fragment>
  ))}

  {/* Grand total */}
  <TableRow>
    <TableCell colSpan={3} sx={{ fontWeight: "bold" }}>
      Grand Total
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: "bold" }}>
      {grandTotal.qty.toFixed(3)}
    </TableCell>
    <TableCell align="right" sx={{ fontWeight: "bold" }}>
      {grandTotal.amount.toFixed(2)}
    </TableCell>
  </TableRow>
</TableBody>

        </Table>
      </TableContainer>
    </Box>
  );
};

export default SalesTaxSummary;
