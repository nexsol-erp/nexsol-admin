import React from "react";
import {
  Box, Typography, Container, Chip, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RemoveCircleOutlineRoundedIcon from "@mui/icons-material/RemoveCircleOutlineRounded";
import { COMPARISON_ROWS } from "./pricingPlans";

const COLUMNS = [
  { key: "trial", label: "Trial" },
  { key: "starter", label: "Starter" },
  { key: "silver", label: "Silver" },
  { key: "gold", label: "Gold" },
];

const Cell = ({ value }) => {
  if (value === true) return <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 20 }} />;
  if (value === false) return <RemoveCircleOutlineRoundedIcon sx={{ color: "#cbd5e1", fontSize: 20 }} />;
  return <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{value}</Typography>;
};

const ComparisonTable = () => (
  <Box id="compare" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#ffffff" }}>
    <Container maxWidth="lg">
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
        <Chip
          label="COMPARE PLANS"
          size="small"
          sx={{
            bgcolor: "#dbeafe", color: "#1d4ed8",
            fontWeight: 700, letterSpacing: "1px", mb: 2, fontSize: 11,
          }}
        />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800, fontSize: { xs: "1.9rem", md: "2.4rem" },
            color: "#0f172a", mb: 1.5, letterSpacing: "-0.5px",
          }}
        >
          Find the Right Plan for Your Business
        </Typography>
        <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: "#64748b" }}>
          A detailed feature-by-feature breakdown across every plan.
        </Typography>
      </Box>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: "18px", border: "1px solid #e2e8f0", overflowX: "auto" }}
      >
        <Table sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: 13.5, color: "#0f172a", bgcolor: "#f8fafc" }}>
                Feature
              </TableCell>
              {COLUMNS.map((c) => (
                <TableCell
                  key={c.key}
                  align="center"
                  sx={{
                    fontWeight: 700, fontSize: 13.5,
                    color: c.key === "silver" ? "#1d4ed8" : "#0f172a",
                    bgcolor: c.key === "silver" ? "#eff6ff" : "#f8fafc",
                  }}
                >
                  {c.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {COMPARISON_ROWS.map((row) => (
              <TableRow key={row.feature} hover>
                <TableCell sx={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                  {row.feature}
                </TableCell>
                {COLUMNS.map((c) => (
                  <TableCell
                    key={c.key}
                    align="center"
                    sx={{ bgcolor: c.key === "silver" ? "#f8fbff" : "transparent" }}
                  >
                    <Cell value={row[c.key]} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  </Box>
);

export default ComparisonTable;
