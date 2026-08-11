import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  TextField,
  Checkbox,
  Button,
  Stack,
  Typography,
} from "@mui/material";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const uncheckedIcon = <CheckBoxOutlineBlankIcon fontSize="small" />;
const checkedIcon = <CheckBoxIcon fontSize="small" />;

/**
 * Reusable searchable branch multi-select with Select All / Clear All.
 * No prior component like this existed in the admin app (BranchProfitReport /
 * BranchStockDiffReport both use single-branch pickers) — built fresh here,
 * reusing only the branch-list fetch pattern from those two.
 *
 * Props:
 *  - value: string[] of selected branch codes
 *  - onChange: (string[]) => void
 *  - label: field label (default "Branches")
 *  - required: shows an error state when value is empty
 */
export default function BranchMultiSelect({ value, onChange, label = "Branches", required = false }) {
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
        const res = await fetch(`/api/${tenancyId}/branches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.branches || data.data || [];
        // /branches also returns franchise partner branches (for the stock-transfer
        // destination picker) — not real local branches a POS terminal ever runs
        // under, and their codes can collide with local ones (e.g. same code reused
        // across tenants), which broke "Select All" here with a duplicate-key error.
        // De-dupe by code too, as a safety net beyond just excluding franchise rows.
        const seen = new Set();
        const localOnly = list.filter((b) => {
          if (b.isFranchiseBranch) return false;
          if (seen.has(b.branchCode)) return false;
          seen.add(b.branchCode);
          return true;
        });
        setBranches(localOnly);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  const options = useMemo(
    () => branches.map((b) => ({ code: b.branchCode, label: `${b.branchCode} - ${b.branchName}` })),
    [branches]
  );

  const selectedOptions = options.filter((o) => value.includes(o.code));

  const selectAll = () => onChange(options.map((o) => o.code));
  const clearAll = () => onChange([]);

  return (
    <Stack spacing={0.5} sx={{ minWidth: 280 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color={required && value.length === 0 ? "error" : "text.secondary"}>
          {label}{required ? " *" : ""}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={selectAll} disabled={options.length === 0}>Select All</Button>
          <Button size="small" onClick={clearAll} disabled={value.length === 0}>Clear All</Button>
        </Stack>
      </Stack>
      <Autocomplete
        multiple
        size="small"
        options={options}
        value={selectedOptions}
        onChange={(_, newValue) => onChange(newValue.map((o) => o.code))}
        disableCloseOnSelect
        getOptionLabel={(o) => o.label}
        isOptionEqualToValue={(o, v) => o.code === v.code}
        renderOption={(props, option, { selected }) => (
          <li {...props} key={option.code}>
            <Checkbox icon={uncheckedIcon} checkedIcon={checkedIcon} checked={selected} sx={{ mr: 1 }} />
            {option.label}
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length ? "" : "Search branches..."}
            error={required && value.length === 0}
            helperText={required && value.length === 0 ? "At least one branch must be selected" : ""}
          />
        )}
      />
    </Stack>
  );
}
