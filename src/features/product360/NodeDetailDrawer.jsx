import React from "react";
import {
  Drawer, Box, Typography, IconButton, Divider, Button, Table, TableBody,
  TableCell, TableRow, Chip, Tooltip, Alert,
} from "@mui/material";
import { Close, OpenInNew, TrendingDown, TrendingUp, TrendingFlat } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMenuAccess } from "../../components/MenuAccessContext";
import { resolveTarget, reasonLabel } from "./navigationRegistry";
import { severityColor } from "./Product360Node";
import { useTheme } from "@mui/material/styles";

/**
 * The exact values behind a node.
 *
 * The map shows shape and severity; this shows the numbers. Nobody should have to read a
 * precise figure off a node label, and every figure here is the server's `formatted` string
 * rather than anything computed in the browser.
 *
 * Read-only throughout. An AI insight and a workflow task can be opened but never actioned:
 * the task page owns completion, and Product 360 deliberately has no complete, approve or
 * reassign control anywhere on it.
 */
export default function NodeDetailDrawer({ node, open, onClose, warnings }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { isEntryAllowed } = useMenuAccess();

  if (!node) return null;

  const accent = severityColor(theme, node.severity);
  const isInsight = node.type === "AI_INSIGHT";
  const isTask = node.type === "WORKFLOW_TASK";

  const relevantWarnings = (warnings || []).filter(
    (warning) =>
      !warning.branchCodes?.length ||
      warning.branchCodes.includes(node.metadata?.branchCode)
  );

  const directionIcon = (direction) => {
    if (direction === "UP") return <TrendingUp fontSize="inherit" />;
    if (direction === "DOWN") return <TrendingDown fontSize="inherit" />;
    return <TrendingFlat fontSize="inherit" />;
  };

  const go = (target) => {
    const resolved = resolveTarget(target, isEntryAllowed);
    if (!resolved.ok) return;
    navigate(`${resolved.link}${resolved.search}`);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 0 } }}
    >
      <Box sx={{ px: 2.5, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
              {node.label}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Chip size="small" label={t(node.type)} sx={{ height: 20, fontSize: "0.68rem" }} />
              {node.severity && node.severity !== "OK" ? (
                <Chip
                  size="small"
                  label={t(node.severity)}
                  sx={{ height: 20, fontSize: "0.68rem", bgcolor: accent, color: "#fff", fontWeight: 700 }}
                />
              ) : null}
            </Box>
            {node.subtitle ? (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
                {node.subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton onClick={onClose} size="small" aria-label={t("Close")}>
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Box sx={{ p: 2.5, overflowY: "auto" }}>
        {(isInsight || isTask) && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {isInsight
              ? t("AI-generated. Verify against the evidence before acting on it.")
              : t("Open this task on the Tasks page to act on it. It cannot be completed here.")}
          </Alert>
        )}

        {relevantWarnings.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {relevantWarnings.map((warning, index) => (
              <Alert
                key={`${warning.code}-${index}`}
                severity={warning.severity === "CRITICAL" ? "error" : "warning"}
                sx={{ mb: 1 }}
              >
                {warning.message}
              </Alert>
            ))}
          </Box>
        )}

        {node.metrics?.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              {t("Figures")}
            </Typography>
            <Table size="small" sx={{ mb: 2 }}>
              <TableBody>
                {node.metrics.map((metric) => (
                  <TableRow key={metric.key}>
                    <TableCell sx={{ border: 0, pl: 0, color: "text.secondary" }}>
                      {t(metric.label)}
                    </TableCell>
                    <TableCell align="right" sx={{ border: 0, pr: 0, fontWeight: 700 }}>
                      {/* The server's string, verbatim. */}
                      {metric.formatted}
                      {metric.baseline ? (
                        <Typography
                          component="div"
                          sx={{
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: "text.secondary",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: 0.5,
                          }}
                        >
                          {directionIcon(metric.baseline.direction)}
                          {metric.baseline.formatted}
                          {metric.baseline.deltaPct !== null &&
                          metric.baseline.deltaPct !== undefined
                            ? ` (${metric.baseline.deltaPct}%)`
                            : ""}
                        </Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}

        {node.metadata?.costSource ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              {t("Cost source")}
            </Typography>
            <Chip
              size="small"
              label={t(node.metadata.costSource)}
              color={node.metadata.costSource === "NOT_FOUND" ? "error" : "default"}
            />
            {node.metadata.costSource === "NOT_FOUND" ? (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                {t(
                  "No manual, purchase, transfer or production cost was found. Profit is unavailable and must not be read as zero."
                )}
              </Typography>
            ) : null}
          </Box>
        ) : null}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          {t("Open the report")}
        </Typography>

        {(node.navigationTargets || []).length === 0 ? (
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {t("No linked report for this node")}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {node.navigationTargets.map((target, index) => {
              // Permission is re-checked here, at click time, against the same role-menu data
              // the sidebar uses. Product 360 must never be a way to reach a report the user
              // could not otherwise open.
              const resolved = resolveTarget(target, isEntryAllowed);
              const button = (
                <Button
                  key={`${target.routeKey}-${index}`}
                  variant="outlined"
                  size="small"
                  startIcon={<OpenInNew />}
                  disabled={!resolved.ok}
                  onClick={() => go(target)}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  {t(target.routeKey)}
                </Button>
              );
              return resolved.ok ? (
                button
              ) : (
                <Tooltip key={`${target.routeKey}-${index}`} title={t(reasonLabel(resolved.reason))}>
                  {/* A disabled button needs a wrapper for the tooltip to fire at all. */}
                  <span>{button}</span>
                </Tooltip>
              );
            })}
          </Box>
        )}

        {(node.evidence || []).length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t("Source")}: {node.evidence.map((item) => item.sourceService).filter(Boolean).join(", ")}
            </Typography>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
