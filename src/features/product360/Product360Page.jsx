import React, { useCallback, useMemo, useState } from "react";
import {
  Box, Paper, Typography, TextField, Autocomplete, Skeleton, Alert, Chip,
  Button, Divider, Stack, IconButton, Tooltip,
} from "@mui/material";
import { Refresh, RestartAlt } from "@mui/icons-material";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@mui/material/styles";
import { MindMapRenderer, LIGHT_THEME, DARK_THEME } from "@tradelink247/mindmap-renderer";
// React Flow v12's stylesheet is imported here, inside the lazily-loaded Product 360
// chunk, rather than by the package or by index.css. The app also ships reactflow v11 for
// the BPMN designer and their class names overlap, so this must not become global.
import "@xyflow/react/dist/style.css";

import { useProduct360, useProductSearch } from "./useProduct360";
import { Product360NodeView, severityColor } from "./Product360Node";
import NodeDetailDrawer from "./NodeDetailDrawer";
import BranchTable from "./BranchTable";
import { parseReturnContext } from "./navigationRegistry";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/**
 * Product 360.
 *
 * Read-only by construction: the canvas runs in the renderer's `readonly` mode, so there is
 * no path by which a node or edge could be created, deleted or reconnected. Moving nodes
 * stays available because that is layout, not data.
 *
 * Nothing on this page computes a business figure. Every number rendered is the server's
 * `formatted` string; the moment the browser starts doing arithmetic, the map can disagree
 * with the reports it links to, and then nobody trusts either.
 */
export default function Product360Page() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { productId } = useParams();
  const [searchParams] = useSearchParams();

  const tenancyId = localStorage.getItem("tenancyId");

  // Coming back from a report restores the product and the window it was opened with.
  const returned = useMemo(
    () => parseReturnContext(searchParams.get("returnTo")),
    [searchParams]
  );

  const [fromDate, setFromDate] = useState(returned?.fromDate || daysAgo(29));
  const [toDate, setToDate] = useState(returned?.toDate || today());
  const [selectedId, setSelectedId] = useState(null);
  const [layout, setLayout] = useState({});

  const { graph, status, error, reload } = useProduct360({
    tenancyId,
    productId,
    fromDate,
    toDate,
  });

  const { results, searching, search } = useProductSearch(tenancyId);

  const selectedNode = useMemo(
    () => (graph?.nodes || []).find((node) => node.id === selectedId) || null,
    [graph, selectedId]
  );

  // Radial-ish placement: the product at the centre, everything else around it. Saved
  // positions win, so a layout a user arranged survives a refresh.
  const rendererNodes = useMemo(() => {
    const nodes = graph?.nodes || [];
    const others = nodes.filter((node) => node.type !== "PRODUCT");
    return nodes.map((node) => {
      const saved = layout[node.id];
      if (saved) return { id: node.id, x: saved.x, y: saved.y, data: node, width: 216, height: 92 };

      if (node.type === "PRODUCT") {
        return { id: node.id, x: 0, y: 0, data: node, zIndex: 2, width: 250, height: 96 };
      }
      const index = others.indexOf(node);
      const angle = (index / Math.max(others.length, 1)) * Math.PI * 2;
      return {
        id: node.id,
        x: Math.round(Math.cos(angle) * 420),
        y: Math.round(Math.sin(angle) * 300),
        data: node,
        width: 216,
        height: 92,
      };
    });
  }, [graph, layout]);

  const rendererEdges = useMemo(
    () =>
      (graph?.edges || []).map((edge) => ({
        id: `${edge.source}->${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        shape: "bezier",
      })),
    [graph]
  );

  const rendererTheme = useMemo(
    () => (theme.palette.mode === "dark" ? DARK_THEME : LIGHT_THEME),
    [theme.palette.mode]
  );

  const accentOf = useCallback((node) => severityColor(theme, node?.severity), [theme]);

  const handleMove = useCallback((moves) => {
    setLayout((current) => {
      const next = { ...current };
      moves.forEach((move) => {
        next[move.id] = { x: move.x, y: move.y };
      });
      return next;
    });
  }, []);

  // ------------------------------------------------------------------ states

  if (!productId) {
    return (
      <Box sx={{ p: 3, maxWidth: 720, mx: "auto" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
          {t("Product 360")}
        </Typography>
        <ProductSelector
          t={t}
          results={results}
          searching={searching}
          onSearch={search}
          onPick={(item) => navigate(`/product-360/${encodeURIComponent(item.item_id)}`)}
        />
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 2 }}>
          {t("Search for a product to see where it is stocked, how it sells and what it costs.")}
        </Typography>
      </Box>
    );
  }

  if (status === "denied") {
    return <Alert severity="error" sx={{ m: 3 }}>{t("You do not have access to this product.")}</Alert>;
  }
  if (status === "notFound") {
    return <Alert severity="warning" sx={{ m: 3 }}>{t("Product not found.")}</Alert>;
  }
  if (status === "error") {
    return (
      <Box sx={{ m: 3 }}>
        <Alert severity="error" action={<Button onClick={reload}>{t("Retry")}</Button>}>
          {error || t("The product view could not be loaded.")}
        </Alert>
      </Box>
    );
  }

  const loading = status === "loading" || status === "idle";

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, maxWidth: 1600, mx: "auto" }}>
      <Paper elevation={0} sx={{ p: 2, mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <Skeleton width={280} height={32} />
            ) : (
              <>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {graph?.product?.name}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {graph?.product?.code}
                  {graph?.product?.category ? ` · ${graph.product.category}` : ""}
                  {graph?.product?.baseUom ? ` · ${graph.product.baseUom}` : ""}
                </Typography>
              </>
            )}
          </Box>

          <TextField
            type="date"
            size="small"
            label={t("From")}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            type="date"
            size="small"
            label={t("To")}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Tooltip title={t("Refresh")}>
            <IconButton onClick={reload} size="small"><Refresh /></IconButton>
          </Tooltip>
          <Tooltip title={t("Reset layout")}>
            <span>
              <IconButton onClick={() => setLayout({})} size="small" disabled={!Object.keys(layout).length}>
                <RestartAlt />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {!loading && graph ? (
          <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            {/* Freshness and basis are stated in the header, not hidden in a tooltip: they
                change how much weight the reader should put on everything below. */}
            <Chip
              size="small"
              label={`${t("Data through")}: ${new Date(graph.dataThrough).toLocaleString()}`}
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
            <Chip
              size="small"
              label={`${t("Period basis")}: ${t(graph.period.basis)}`}
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
            <Chip
              size="small"
              label={`${graph.scope.branchCodes.length} ${t("branches")}`}
              sx={{ height: 22, fontSize: "0.7rem" }}
            />
          </Box>
        ) : null}
      </Paper>

      {!loading &&
        (graph?.warnings || [])
          .filter((warning) => warning.severity !== "INFO")
          .map((warning, index) => (
            <Alert
              key={`${warning.code}-${index}`}
              severity={warning.severity === "CRITICAL" ? "error" : "warning"}
              sx={{ mb: 1.5 }}
            >
              {warning.message}
            </Alert>
          ))}

      <KpiSummary loading={loading} metrics={graph?.summary?.metrics} t={t} theme={theme} />

      <Paper
        elevation={0}
        sx={{
          height: 520,
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
          display: "flex",
        }}
      >
        {loading ? (
          <Skeleton variant="rectangular" width="100%" height="100%" />
        ) : (
          <MindMapRenderer
            nodes={rendererNodes}
            edges={rendererEdges}
            nodeComponent={Product360NodeView}
            theme={rendererTheme}
            mode="readonly"
            accentOf={accentOf}
            selectedNodeIds={selectedId ? [selectedId] : []}
            onNodeClick={setSelectedId}
            onNodesMove={handleMove}
            maxNodes={200}
            data-testid="product360-canvas"
          />
        )}
      </Paper>

      <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {t("All branches")}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {t("The map shows the most important branches. This table shows every one.")}
          </Typography>
        </Box>
        <Divider sx={{ mt: 1 }} />
        {loading ? (
          <Skeleton variant="rectangular" height={160} />
        ) : (
          <BranchTable nodes={graph?.nodes} onSelect={setSelectedId} />
        )}
      </Paper>

      <NodeDetailDrawer
        node={selectedNode}
        open={Boolean(selectedNode)}
        onClose={() => setSelectedId(null)}
        warnings={graph?.warnings}
      />
    </Box>
  );
}

function ProductSelector({ t, results, searching, onSearch, onPick }) {
  return (
    <Autocomplete
      options={results}
      loading={searching}
      filterOptions={(options) => options}   // the server already filtered
      getOptionLabel={(option) => `${option.item_code || ""} ${option.item_name || ""}`.trim()}
      onInputChange={(_event, value) => onSearch(value)}
      onChange={(_event, value) => value && onPick(value)}
      renderInput={(params) => (
        <TextField {...params} label={t("Search for a product")} size="small" autoFocus />
      )}
    />
  );
}

function KpiSummary({ loading, metrics, t, theme }) {
  if (loading) {
    return (
      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" width={180} height={72} />
        ))}
      </Box>
    );
  }
  if (!metrics?.length) return null;

  return (
    <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
      {metrics.map((metric) => {
        const unavailable = metric.value === null || metric.value === undefined;
        return (
          <Paper
            key={metric.key}
            elevation={0}
            sx={{
              px: 2,
              py: 1.25,
              minWidth: 170,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {t(metric.label)}
            </Typography>
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "1.15rem",
                // An unavailable figure is greyed and spelled out, never shown as a number.
                color: unavailable ? "text.disabled" : "text.primary",
              }}
            >
              {metric.formatted}
            </Typography>
            {metric.baseline ? (
              <Typography
                variant="caption"
                sx={{
                  color:
                    metric.baseline.direction === "DOWN"
                      ? theme.palette.error.main
                      : metric.baseline.direction === "UP"
                        ? theme.palette.success.main
                        : "text.secondary",
                }}
              >
                {metric.baseline.direction === "DOWN" ? "▼" : metric.baseline.direction === "UP" ? "▲" : "—"}{" "}
                {metric.baseline.formatted}
                {metric.baseline.deltaPct !== null && metric.baseline.deltaPct !== undefined
                  ? ` (${metric.baseline.deltaPct}%)`
                  : ""}
              </Typography>
            ) : null}
          </Paper>
        );
      })}
    </Box>
  );
}
