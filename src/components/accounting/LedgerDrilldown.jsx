import React, { useEffect, useState } from "react";
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, TableFooter,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton,
  CircularProgress, Link, useMediaQuery, useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { getLedgerStatement, getVoucherDetail } from "./accountingApi";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const amt = (n) => (Number(n) > 0 ? fmt(n) : "");
/** Positive = Dr balance, negative = Cr balance. */
const drCr = (n) => `${fmt(Math.abs(Number(n || 0)))} ${Number(n || 0) < 0 ? "Cr" : "Dr"}`;

const SOURCE_LABEL = {
  SALES: "Sales bill", SALES_RECEIPT: "Sales receipt", PURCHASE: "Purchase bill",
  RECEIPT: "Receipt", PAYMENT: "Payment", SHOP_EXPENSE: "Shop expense",
  BRANCH_EXPENSE: "Branch expense", WASTAGE: "Wastage", INTER_BRANCH: "Inter-branch",
  YEAR_END: "Year end", BANK_STATEMENT_ADJUSTMENT: "Bank adjustment",
};

const headCell = { color: "white", whiteSpace: "nowrap" };
/** Secondary columns drop off on phones so the amounts stay on screen. */
const wide = { display: { xs: "none", sm: "table-cell" } };

function DialogHeader({ title, subtitle, onClose }) {
  return (
    <DialogTitle sx={{ pr: 6 }}>
      <Typography variant="h6" component="div">{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      <IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
        <CloseIcon />
      </IconButton>
    </DialogTitle>
  );
}

/**
 * Trial Balance / Balance Sheet drill-down, step 1: every ledger entry of one account for the
 * report's date range and branch, with a running balance. Clicking an entry opens its voucher.
 * openingBalance (Dr positive) overrides the GL opening when the report takes its opening from
 * elsewhere, e.g. the Balance Sheet's financial-year opening balances.
 */
export function AccountLedgerDialog({ account, from, to, branchCode, openingBalance, onClose, onOpenVoucher }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!account) return;
    let alive = true;
    setResult(null);
    setError("");
    getLedgerStatement(account.ledgerAccountId, from, to, branchCode)
      .then((d) => {
        if (!alive) return;
        if (!d || !Array.isArray(d.lines)) { setError("Could not load the ledger."); return; }
        if (openingBalance == null) { setResult(d); return; }
        // Re-run the balance from the report's own opening, in 1/10000 units to avoid float drift.
        let bal = Math.round(Number(openingBalance) * 10000);
        const lines = d.lines.map((l) => {
          bal += Math.round(Number(l.debit || 0) * 10000) - Math.round(Number(l.credit || 0) * 10000);
          return { ...l, balance: bal / 10000 };
        });
        setResult({ ...d, openingBalance: Number(openingBalance), lines, closingBalance: bal / 10000 });
      })
      .catch(() => { if (alive) setError("Could not load the ledger."); });
    return () => { alive = false; };
  }, [account, from, to, branchCode, openingBalance]);

  const lines = result?.lines || [];
  const totalDr = lines.reduce((s, l) => s + Math.round(Number(l.debit || 0) * 10000), 0) / 10000;
  const totalCr = lines.reduce((s, l) => s + Math.round(Number(l.credit || 0) * 10000), 0) / 10000;

  return (
    <Dialog open={!!account} onClose={onClose} maxWidth="lg" fullWidth fullScreen={fullScreen}>
      <DialogHeader
        title={account ? `${account.accountName} (${account.accountCode})` : ""}
        subtitle={`${from} to ${to}${branchCode ? ` · Branch ${branchCode}` : " · All branches"}`}
        onClose={onClose}
      />
      <DialogContent dividers>
        {error && <Typography color="error">{error}</Typography>}
        {!result && !error && <Box textAlign="center" py={4}><CircularProgress /></Box>}
        {result && (
          <>
            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
              <Chip label={`Opening: ${drCr(result.openingBalance)}`} color="info" />
              <Chip label={`Closing: ${drCr(result.closingBalance)}`} color="primary" />
              <Chip label={`${lines.length} entries`} variant="outlined" />
            </Box>
            {lines.length === 0 ? (
              <Typography color="text.secondary">No entries in this period.</Typography>
            ) : (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" component={Paper}>
                  <TableHead sx={{ bgcolor: "primary.dark" }}>
                    <TableRow>
                      <TableCell sx={headCell}>Date</TableCell>
                      <TableCell sx={headCell}>Voucher No</TableCell>
                      <TableCell sx={{ ...headCell, ...wide }}>Source</TableCell>
                      <TableCell sx={{ ...headCell, ...wide }}>Narration</TableCell>
                      <TableCell align="right" sx={headCell}>Debit</TableCell>
                      <TableCell align="right" sx={headCell}>Credit</TableCell>
                      <TableCell align="right" sx={headCell}>Balance</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {lines.map((l, i) => (
                      <TableRow
                        key={i}
                        hover
                        onClick={() => l.voucherHeaderId && onOpenVoucher(l.voucherHeaderId)}
                        sx={{ cursor: l.voucherHeaderId ? "pointer" : "default" }}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{l.voucherDate}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          {l.voucherHeaderId ? <Link component="button" underline="hover">{l.voucherNumber}</Link> : l.voucherNumber}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap", ...wide }}>{SOURCE_LABEL[l.sourceModule] || l.sourceModule || l.voucherTypeCode}</TableCell>
                        <TableCell sx={wide}>{l.description}</TableCell>
                        <TableCell align="right">{amt(l.debit)}</TableCell>
                        <TableCell align="right">{amt(l.credit)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{drCr(l.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow sx={{ bgcolor: "action.hover" }}>
                      <TableCell colSpan={4} sx={wide}><b>Total for period</b></TableCell>
                      <TableCell colSpan={2} sx={{ display: { xs: "table-cell", sm: "none" } }}><b>Total</b></TableCell>
                      <TableCell align="right"><b>{fmt(totalDr)}</b></TableCell>
                      <TableCell align="right"><b>{fmt(totalCr)}</b></TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}><b>{drCr(result.closingBalance)}</b></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Trial Balance drill-down, step 2: one voucher with all its debit/credit legs and, for sales
 * and purchases, the bill it was posted from. Clicking a leg's account opens that account's ledger.
 */
export function VoucherDialog({ voucherHeaderId, onClose, onOpenAccount }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [v, setV] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!voucherHeaderId) return;
    let alive = true;
    setV(null);
    setError("");
    getVoucherDetail(voucherHeaderId)
      .then((d) => { if (alive) setV(d); })
      .catch((e) => { if (alive) setError(e.message || "Could not load the voucher."); });
    return () => { alive = false; };
  }, [voucherHeaderId]);

  const bill = v?.sourceBill;
  const billWanted = v && ["SALES", "SALES_RECEIPT", "PURCHASE"].includes(v.sourceModule);

  return (
    <Dialog open={!!voucherHeaderId} onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen}>
      <DialogHeader
        title={v ? `Voucher ${v.voucherNumber}` : "Voucher"}
        subtitle={v ? `${v.voucherDate} · ${v.voucherTypeCode} · Branch ${v.branchCode}` : ""}
        onClose={onClose}
      />
      <DialogContent dividers>
        {error && <Typography color="error">{error}</Typography>}
        {!v && !error && <Box textAlign="center" py={4}><CircularProgress /></Box>}
        {v && (
          <>
            <Box display="flex" gap={1} mb={1} flexWrap="wrap" alignItems="center">
              {v.status && <Chip size="small" label={v.status} color={v.status === "POSTED" ? "success" : "default"} />}
              {v.sourceModule && <Chip size="small" variant="outlined" label={SOURCE_LABEL[v.sourceModule] || v.sourceModule} />}
              {v.reversalOf && <Chip size="small" color="warning" label="Reversal" />}
            </Box>
            {v.narration && <Typography variant="body2" mb={2}>{v.narration}</Typography>}

            <Box sx={{ overflowX: "auto" }} mb={3}>
              <Table size="small" component={Paper}>
                <TableHead sx={{ bgcolor: "primary.dark" }}>
                  <TableRow>
                    <TableCell sx={headCell}>Account</TableCell>
                    <TableCell sx={{ ...headCell, ...wide }}>Description</TableCell>
                    <TableCell align="right" sx={headCell}>Debit</TableCell>
                    <TableCell align="right" sx={headCell}>Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(v.lines || []).map((l, i) => (
                    <TableRow key={i} hover>
                      <TableCell>
                        <Link
                          component="button"
                          underline="hover"
                          textAlign="left"
                          onClick={() => onOpenAccount({ ledgerAccountId: l.ledgerAccountId, accountCode: l.accountCode, accountName: l.accountName })}
                        >
                          {l.accountCode} · {l.accountName}
                        </Link>
                      </TableCell>
                      <TableCell sx={wide}>{l.description}</TableCell>
                      <TableCell align="right">{amt(l.debit)}</TableCell>
                      <TableCell align="right">{amt(l.credit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell colSpan={2} sx={wide}><b>Total</b></TableCell>
                    <TableCell sx={{ display: { xs: "table-cell", sm: "none" } }}><b>Total</b></TableCell>
                    <TableCell align="right"><b>{fmt(v.totalDebit)}</b></TableCell>
                    <TableCell align="right"><b>{fmt(v.totalCredit)}</b></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Box>

            {bill && (
              <>
                <Typography variant="subtitle1" fontWeight={600}>
                  {bill.billType === "PURCHASE" ? "Purchase bill" : "Sales bill"} {bill.voucherNumber}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={1}>
                  {bill.voucherDate} · {bill.partyName || (bill.billType === "PURCHASE" ? "No supplier" : "Walk-in")} · Branch {bill.branchCode}
                  {bill.extraRef ? (bill.billType === "PURCHASE" ? ` · Supplier inv. ${bill.extraRef}` : ` · ${bill.extraRef}`) : ""}
                </Typography>
                <Box sx={{ overflowX: "auto" }}>
                  <Table size="small" component={Paper}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell align="right">Qty</TableCell>
                        <TableCell align="right">Rate</TableCell>
                        <TableCell align="right">Tax %</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bill.lines.map((l, i) => (
                        <TableRow key={i}>
                          <TableCell>{l.itemName}</TableCell>
                          <TableCell align="right">{Number(l.qty || 0)}</TableCell>
                          <TableCell align="right">{fmt(l.rate)}</TableCell>
                          <TableCell align="right">{Number(l.taxRate || 0)}</TableCell>
                          <TableCell align="right">{fmt(l.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4}><b>Bill total</b></TableCell>
                        <TableCell align="right"><b>{fmt(bill.total)}</b></TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </Box>
              </>
            )}
            {billWanted && !bill && (
              <Typography variant="body2" color="text.secondary">
                The bill {v.sourceVoucherNumber || v.referenceNumber} was not found.
              </Typography>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
