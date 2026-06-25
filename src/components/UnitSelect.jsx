import React from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useUnits } from "./UnitContext";

/**
 * Autocomplete unit selector backed by unit_mst via UnitContext.
 * UnitProvider must be mounted above this component in the tree (done in App.js).
 *
 * Props:
 *   value       – current unit string
 *   onChange    – (newValue: string) => void
 *   label       – field label (default "Unit")
 *   size        – "small" | "medium" (default "small")
 *   disabled    – bool
 *   sx          – MUI sx prop
 *   placeholder – placeholder text
 */
export default function UnitSelect({
  value = "",
  onChange,
  label = "Unit",
  size = "small",
  disabled = false,
  sx,
  placeholder,
}) {
  const units = useUnits();

  return (
    <Autocomplete
      options={units}
      value={value || null}
      onChange={(_, v) => onChange(typeof v === "string" ? v : (v || ""))}
      onInputChange={(_, v, reason) => {
        // freeSolo: propagate typed text so the parent state stays in sync
        if (reason === "input") onChange(v);
      }}
      freeSolo
      size={size}
      disabled={disabled}
      sx={sx}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size={size}
          placeholder={placeholder}
        />
      )}
    />
  );
}
