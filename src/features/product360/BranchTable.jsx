import React, { useMemo, useState } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Typography, Chip,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { severityColor } from "./Product360Node";
import { useTheme } from "@mui/material/styles";

/**
 * Every branch, as a table.
 *
 * This is not a secondary view. It is the accessible equivalent of the canvas and the only
 * complete one: the map draws at most twelve branches and groups the rest, so for a tenant
 * with fifty branches the table is where the full answer lives. It is reachable by keyboard
 * without touching the graph, and sortable, because "which branch is worst" is the question
 * people actually arrive with.
 */
export default function BranchTable({ nodes, onSelect }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [orderBy, setOrderBy] = useState("severity");
  const [direction, setDirection] = useState("asc");

  const SEVERITY_ORDER = { CRITICAL: 0, WARNING: 1, INFO: 2, OK: 3, UNKNOWN: 4 };

  const rows = useMemo(
    () =>
      (nodes || [])
        .filter((node) => node.type === "BRANCH_STOCK")
        .map((node) => ({
          id: node.id,
          branch: node.label,
          status: node.subtitle || "",
          severity: node.severity || "UNKNOWN",
          quantity: node.metrics?.[0]?.formatted ?? "—",
          quantityValue: node.metrics?.[0]?.value ?? null,
        })),
    [nodes]
  );

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let result;
      if (orderBy === "severity") {
        result = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      } else if (orderBy === "quantity") {
        // Sorts on the numeric value, never on the formatted string - "1,240" sorts before
        // "9" as text, which would put the largest branch at the bottom.
        result = (a.quantityValue ?? -Infinity) - (b.quantityValue ?? -Infinity);
      } else {
        result = String(a.branch).localeCompare(String(b.branch));
      }
      return direction === "asc" ? result : -result;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orderBy, direction]);

  const sort = (column) => {
    if (orderBy === column) {
      setDirection(direction === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(column);
      setDirection("asc");
    }
  };

  if (rows.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary", p: 2 }}>
        {t("No branch stock for this product in the selected period")}
      </Typography>
    );
  }

  return (
    <TableContainer sx={{ maxHeight: 320, overflowX: "auto" }}>
      <Table size="small" stickyHeader aria-label={t("Branch stock for this product")}>
        <TableHead>
          <TableRow>
            {[
              { id: "branch", label: t("Branch") },
              { id: "quantity", label: t("Quantity on hand"), align: "right" },
              { id: "severity", label: t("Status") },
            ].map((column) => (
              <TableCell
                key={column.id}
                align={column.align || "left"}
                sortDirection={orderBy === column.id ? direction : false}
                sx={{ bgcolor: "#1976d2", color: "#fff", fontWeight: 700 }}
              >
                <TableSortLabel
                  active={orderBy === column.id}
                  direction={orderBy === column.id ? direction : "asc"}
                  onClick={() => sort(column.id)}
                  sx={{
                    color: "#fff !important",
                    "& .MuiTableSortLabel-icon": { color: "#fff !important" },
                  }}
                >
                  {column.label}
                </TableSortLabel>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.id}
              hover
              tabIndex={0}
              onClick={() => onSelect && onSelect(row.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (onSelect) onSelect(row.id);
                }
              }}
              sx={{ cursor: onSelect ? "pointer" : "default" }}
            >
              <TableCell>{row.branch}</TableCell>
              <TableCell align="right">{row.quantity}</TableCell>
              <TableCell>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  {/* Colour plus a word, so the status survives mono printing and colour blindness. */}
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: severityColor(theme, row.severity),
                      flexShrink: 0,
                    }}
                  />
                  <Chip
                    size="small"
                    label={row.status || t(row.severity)}
                    sx={{ height: 20, fontSize: "0.68rem" }}
                  />
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
