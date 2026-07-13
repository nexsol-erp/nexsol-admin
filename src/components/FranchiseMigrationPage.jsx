import React, { useState } from "react";
import {
  Box, Typography, Paper, Button, Alert, CircularProgress,
  Divider, Chip, Stack, List, ListItem, ListItemText,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";
import {
  PlayArrow as RunIcon,
  CheckCircle as OkIcon,
  Error as ErrIcon,
  Warning as WarnIcon,
  BuildCircle as MigrateIcon,
} from "@mui/icons-material";

const API = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token     = localStorage.getItem("jwtToken");
  return {
    base:    `/api/${tenancyId}/franchise-migration`,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json",
               "X-User-Id": localStorage.getItem("userId") || "system" },
  };
};

function ResultCard({ result }) {
  if (!result) return null;

  const isError = result.error != null;
  const errors  = result.errors || [];

  return (
    <Box mt={2}>
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={1}>
        {Object.entries(result)
          .filter(([k]) => k !== "errors" && k !== "error")
          .map(([k, v]) => (
            <Chip
              key={k}
              label={`${k.replace(/([A-Z])/g, " $1").trim()}: ${v}`}
              size="small"
              color={k === "failed" && v > 0 ? "error" : k === "minted" || k === "accessRowsGranted" ? "success" : "default"}
              variant="outlined"
            />
          ))}
      </Stack>

      {isError && (
        <Alert severity="error" sx={{ mb: 1 }}>{result.error}</Alert>
      )}

      {errors.length > 0 && (
        <Box>
          <Typography variant="caption" color="error" fontWeight={700}>
            {errors.length} error(s):
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: "auto", bgcolor: "#1e1e1e", borderRadius: 1, mt: 0.5 }}>
            {errors.map((e, i) => (
              <ListItem key={i} sx={{ py: 0 }}>
                <ListItemText
                  primary={e}
                  primaryTypographyProps={{ fontSize: 11, color: "#f44336", fontFamily: "monospace" }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}

function MigrationCard({ title, description, endpoint, buttonLabel, onRun }) {
  const [running, setRunning] = useState(false);
  const [result,  setResult]  = useState(null);
  const [status,  setStatus]  = useState(null); // "success" | "error"

  const run = async () => {
    setRunning(true);
    setResult(null);
    setStatus(null);
    const { base, headers } = API();
    try {
      const res = await fetch(`${base}/${endpoint}`, { method: "POST", headers });
      const data = await res.json();
      setResult(data);
      setStatus(res.ok && !data.error ? "success" : "error");
    } catch (e) {
      setResult({ error: e.message });
      setStatus("error");
    } finally {
      setRunning(false);
    }
    if (onRun) onRun();
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box flex={1}>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>{description}</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1} flexShrink={0}>
          {status === "success" && <OkIcon color="success" />}
          {status === "error"   && <ErrIcon color="error" />}
          <Button
            variant="contained"
            size="small"
            startIcon={running ? <CircularProgress size={14} color="inherit" /> : <RunIcon />}
            onClick={run}
            disabled={running}
          >
            {running ? "Running…" : buttonLabel}
          </Button>
        </Box>
      </Box>

      <ResultCard result={result} />
    </Paper>
  );
}

export default function FranchiseMigrationPage() {
  return (
    <Box sx={{ p: 2, maxWidth: 900 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <MigrateIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Franchise Migration Utility</Typography>
      </Box>
      <Alert severity="warning" sx={{ mb: 3 }}>
        These are one-time migration scripts. They are idempotent — safe to run multiple times.
        Run them once after deploying the new franchise architecture.
      </Alert>

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 1 — Global Branch Identity
      </Typography>
      <MigrationCard
        title="Mint Global Branch IDs"
        description={
          "For every active franchise, assigns a globally unique UUID to each branch in nexsoldb " +
          "(global_branch_registry), creates franchise_branch_link rows in the central DB, and " +
          "back-fills global_branch_id into each franchise tenant's branch_mst table. " +
          "Skips branches already processed."
        }
        endpoint="global-branch-ids"
        buttonLabel="Run Migration"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 2 — Multi-Tenant Login Access
      </Typography>
      <MigrationCard
        title="Create User Tenant Access Rows"
        description={
          "For every active franchise whose admin_email is set in franchise_tenant_mapping, " +
          "looks up the user in nexsoldb and inserts a user_tenant_access row so the admin can " +
          "log in and select their franchise tenant. Existing rows are skipped (ON CONFLICT DO NOTHING)."
        }
        endpoint="user-tenant-access"
        buttonLabel="Run Migration"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 3 — Migrate Existing Users to Franchise DBs
      </Typography>
      <MigrationCard
        title="Migrate Franchise Users"
        description={
          "Finds all users in this tenant's DB who are mapped (via user_branch_map) to franchise " +
          "branch codes, then copies them — user record, role assignments, and branch mappings — " +
          "into the corresponding franchise DB. Also grants user_tenant_access in nexsoldb so each " +
          "user can select the franchise tenant at login. Run Step 1 first so branch links exist."
        }
        endpoint="migrate-users"
        buttonLabel="Migrate Users"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 4 — POS Login Fix (User Branch Map)
      </Typography>
      <MigrationCard
        title="Create User Branch Mappings"
        description={
          "For every active franchise DB, inserts a user_branch_map row for each user × branch " +
          "combination. Required for POS (Electron) login — without this, users cannot log in to " +
          "the franchise from the POS application. Safe to re-run on any franchise."
        }
        endpoint="user-branch-map"
        buttonLabel="Fix User Branch Map"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 5 — Stock Transfer Schema Fix
      </Typography>
      <MigrationCard
        title="Add Franchise Sync Columns to stock_trans_out_hdr"
        description={
          "Adds the V028 franchise-sync columns (franchise_id, is_franchise_transfer, sync_status, " +
          "sync_event_id, sync_blocked_reason, target_franchise_tenant_id) to stock_trans_out_hdr " +
          "in every active franchise DB. Fixes the 'column franchise_id does not exist' error. " +
          "Uses ADD COLUMN IF NOT EXISTS — safe to re-run."
        }
        endpoint="stock-trans-columns"
        buttonLabel="Fix Schema"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 6 — Inventory Migration
      </Typography>
      <MigrationCard
        title="Migrate Inventory to Franchise DBs"
        description={
          "Reads item_batch_mst and pos_machine_mst from this tenant's database for every branch " +
          "registered in franchise_branch_link, then inserts those rows into each franchise " +
          "tenant's own tables. Uses ON CONFLICT (id) DO NOTHING — safe to re-run. " +
          "Run Step 1 (global branch IDs) before this step so branch links exist."
        }
        endpoint="inventory"
        buttonLabel="Migrate Inventory"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 7 — Stock Transfer Migration
      </Typography>
      <MigrationCard
        title="Migrate Stock Transfers to Franchise DBs"
        description={
          "Copies stock_trans_out_hdr, stock_trans_out_dtl, stock_trans_in_hdr, and " +
          "stock_trans_in_dtl from this tenant's database into each franchise DB, " +
          "matched by branch codes in franchise_branch_link. " +
          "Run Step 5 (stock-trans-columns) before this to ensure V028 columns exist. " +
          "ON CONFLICT (id) DO NOTHING — safe to re-run."
        }
        endpoint="stock-transfers"
        buttonLabel="Migrate Stock Transfers"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Step 8 — Sales Migration
      </Typography>
      <MigrationCard
        title="Migrate Sales to Franchise DBs"
        description={
          "Copies sales_trans_hdr, sales_dtl, and sales_receipts_dtl from this tenant's " +
          "database into each franchise DB, matched by branch codes in franchise_branch_link. " +
          "ON CONFLICT (id) DO NOTHING — safe to re-run."
        }
        endpoint="sales"
        buttonLabel="Migrate Sales"
      />

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" color="text.secondary" mb={1} textTransform="uppercase" letterSpacing={1}>
        Reference — What Each Script Does
      </Typography>
      <TableContainer component={Paper} sx={{ "& th": { bgcolor: "#1976d2", color: "#fff", fontWeight: 700, fontSize: 12 } }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Script</TableCell>
              <TableCell>Table(s) Modified</TableCell>
              <TableCell>Idempotent?</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>global-branch-ids</TableCell>
              <TableCell>global_branch_registry (nexsoldb), franchise_branch_link (central), branch_mst (franchise DBs)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>user-tenant-access</TableCell>
              <TableCell>user_tenant_access (nexsoldb)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>migrate-users</TableCell>
              <TableCell>users, users_roles, user_branch_map (franchise DB) + user_tenant_access (nexsoldb)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>user-branch-map</TableCell>
              <TableCell>user_branch_map (each franchise DB)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>stock-trans-columns</TableCell>
              <TableCell>stock_trans_out_hdr — ADD COLUMN (each franchise DB)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>inventory</TableCell>
              <TableCell>item_batch_mst, pos_machine_mst (each franchise DB)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>stock-transfers</TableCell>
              <TableCell>stock_trans_out_hdr, stock_trans_out_dtl, stock_trans_in_hdr, stock_trans_in_dtl (each franchise DB)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
            <TableRow>
              <TableCell>sales</TableCell>
              <TableCell>sales_trans_hdr, sales_dtl, sales_receipts_dtl (each franchise DB)</TableCell>
              <TableCell><Chip label="Yes" color="success" size="small" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
