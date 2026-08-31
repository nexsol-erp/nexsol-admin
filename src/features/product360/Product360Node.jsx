import React from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Chip, Typography, alpha, useTheme } from "@mui/material";
import {
  Inventory2, Storefront, TrendingUp, PaidOutlined, LocalShipping, Category,
  Factory, Science, AutoAwesome, Assignment, WarningAmber, ShoppingCart, SwapHoriz, Layers,
} from "@mui/icons-material";

/**
 * How a Product 360 node looks.
 *
 * Supplied to the shared renderer as a prop rather than living inside it. The package draws
 * no nodes of its own precisely so this can be MUI, use the admin's theme, and show ERP
 * things — severity, metrics, evidence — without any of that reaching the standalone
 * mind-map app.
 *
 * Severity is never carried by colour alone: every node states its condition in words as
 * well, so the map is readable without colour vision and in a screenshot printed in mono.
 */

const ICONS = {
  PRODUCT: Inventory2,
  CATEGORY: Category,
  BRANCH_STOCK: Storefront,
  BRANCH_GROUP: Layers,
  SALES: TrendingUp,
  PROFIT: PaidOutlined,
  COST: PaidOutlined,
  VENDOR: LocalShipping,
  PURCHASE: ShoppingCart,
  STOCK_TRANSFER: SwapHoriz,
  PRODUCTION: Factory,
  INGREDIENT: Science,
  AI_INSIGHT: AutoAwesome,
  WORKFLOW_TASK: Assignment,
  DATA_WARNING: WarningAmber,
};

/** Words, not just a colour. */
const SEVERITY_LABEL = {
  CRITICAL: "Critical",
  WARNING: "Attention",
  INFO: "Info",
  OK: "OK",
  UNKNOWN: "Unknown",
};

export const severityColor = (theme, severity) => {
  switch (severity) {
    case "CRITICAL":
      return theme.palette.error.main;
    case "WARNING":
      return theme.palette.warning.main;
    case "INFO":
      return theme.palette.info.main;
    case "OK":
      return theme.palette.success.main;
    default:
      return theme.palette.text.disabled;
  }
};

function Product360NodeComponent({ data, selected }) {
  const theme = useTheme();
  const node = data.payload;
  const severity = node.severity || "UNKNOWN";
  const accent = severityColor(theme, severity);
  const Icon = ICONS[node.type] || Inventory2;
  const isRoot = node.type === "PRODUCT";
  const isDark = theme.palette.mode === "dark";

  // At most two metrics on the face of a node. The rest live in the detail panel: a node
  // dense enough to need reading is a node nobody reads.
  const shown = (node.metrics || []).slice(0, 2);

  return (
    <Box
      data-testid={`p360-node-${node.id}`}
      data-severity={severity}
      sx={{
        width: isRoot ? 250 : 216,
        px: 1.75,
        py: 1.25,
        borderRadius: 2.5,
        cursor: "pointer",
        position: "relative",
        color: theme.palette.text.primary,
        backgroundColor: isDark ? alpha(accent, 0.16) : alpha(accent, 0.08),
        border: `1.5px solid ${alpha(accent, selected ? 0.95 : 0.4)}`,
        boxShadow: selected
          ? `0 0 0 3px ${alpha(accent, 0.28)}`
          : `0 3px 12px ${alpha("#000", isDark ? 0.4 : 0.08)}`,
        transition: "box-shadow 160ms ease, border-color 160ms ease",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4, width: 7, height: 7 }} />

      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
            width: 26,
            height: 26,
            borderRadius: 1.5,
            color: accent,
            backgroundColor: alpha(accent, isDark ? 0.28 : 0.16),
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontWeight: isRoot ? 700 : 600,
              fontSize: isRoot ? "0.9rem" : "0.82rem",
              lineHeight: 1.3,
              wordBreak: "break-word",
            }}
          >
            {node.label}
          </Typography>
          {node.subtitle ? (
            <Typography sx={{ fontSize: "0.7rem", color: "text.secondary", mt: 0.25 }}>
              {node.subtitle}
            </Typography>
          ) : null}
        </Box>
      </Box>

      {shown.length > 0 ? (
        <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
          {shown.map((metric) => (
            <Chip
              key={metric.key}
              size="small"
              // formatted only. The server owns currency, scale and grouping; recomputing
              // any of it here is how a map starts disagreeing with its own reports.
              label={metric.formatted}
              sx={{
                height: 20,
                fontSize: "0.68rem",
                fontWeight: 600,
                bgcolor: alpha(accent, isDark ? 0.22 : 0.12),
                color: "text.primary",
              }}
            />
          ))}
        </Box>
      ) : null}

      {severity !== "OK" && severity !== "UNKNOWN" ? (
        <Typography
          sx={{ mt: 0.5, fontSize: "0.65rem", fontWeight: 700, color: accent, letterSpacing: "0.3px" }}
        >
          {SEVERITY_LABEL[severity]}
        </Typography>
      ) : null}

      <Handle type="source" position={Position.Right} style={{ opacity: 0.4, width: 7, height: 7 }} />
    </Box>
  );
}

export const Product360NodeView = React.memo(Product360NodeComponent);
