import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Card,
  CardContent,
  LinearProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import Grid from "@mui/material/Unstable_Grid2";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from "chart.js";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import axios from "axios";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const URGENCY_COLOR = { critical: "error", high: "warning", medium: "info" };
const CONFIDENCE_COLOR = { high: "#4caf50", medium: "#ff9800", low: "#f44336" };

const StatCard = ({ title, value, sub, loading, highlight }) => (
  <Card sx={{ height: "100%" }}>
    <CardContent>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {title}
      </Typography>
      {loading ? (
        <CircularProgress size={24} />
      ) : (
        <>
          <Typography
            variant="h4"
            sx={{ color: highlight ? "#f44336" : "inherit", fontWeight: "bold" }}
          >
            {value}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {sub}
          </Typography>
        </>
      )}
    </CardContent>
  </Card>
);

const AIDashboardPage = () => {
  const tenancyId = localStorage.getItem("tenancyId");

  const [status, setStatus] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());
  const [loading, setLoading] = useState({
    status: false,
    train: false,
    forecast: false,
    recs: false,
  });
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, rec: null });
  const [horizon, setHorizon] = useState(7);

  const AI = `/ai-service/${tenancyId}`;

  const fetchStatus = useCallback(async () => {
    setLoading((l) => ({ ...l, status: true }));
    try {
      const res = await axios.get(`${AI}/status`);
      setStatus(res.data);
      setError(null);
    } catch {
      setError("AI service unreachable. Check that the service is running.");
    } finally {
      setLoading((l) => ({ ...l, status: false }));
    }
  }, [AI]);

  const fetchForecasts = useCallback(async () => {
    setLoading((l) => ({ ...l, forecast: true }));
    try {
      const res = await axios.get(`${AI}/forecast/summary?horizon=${horizon}`);
      setForecasts(res.data || []);
    } catch {
      setForecasts([]);
    } finally {
      setLoading((l) => ({ ...l, forecast: false }));
    }
  }, [AI, horizon]);

  const fetchRecommendations = useCallback(async () => {
    setLoading((l) => ({ ...l, recs: true }));
    try {
      const res = await axios.get(`${AI}/recommendations?horizon=${horizon}`);
      setRecommendations(res.data || []);
    } catch {
      setRecommendations([]);
    } finally {
      setLoading((l) => ({ ...l, recs: false }));
    }
  }, [AI, horizon]);

  const loadAll = useCallback(() => {
    fetchStatus();
    fetchForecasts();
    fetchRecommendations();
  }, [fetchStatus, fetchForecasts, fetchRecommendations]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh status while training
  useEffect(() => {
    if (!status?.training_in_progress) return;
    const id = setInterval(fetchStatus, 8000);
    return () => clearInterval(id);
  }, [status?.training_in_progress, fetchStatus]);

  const handleTrain = async () => {
    setLoading((l) => ({ ...l, train: true }));
    try {
      await axios.post(`${AI}/train`);
      setSnackbar({
        open: true,
        message: "Training started. Status will update automatically.",
        severity: "info",
      });
      setTimeout(fetchStatus, 3000);
    } catch {
      setSnackbar({ open: true, message: "Failed to start training.", severity: "error" });
    } finally {
      setLoading((l) => ({ ...l, train: false }));
    }
  };

  const handleApprove = (rec) => setConfirmDialog({ open: true, rec });

  const handleConfirmApprove = () => {
    const rec = confirmDialog.rec;
    const key = `${rec.item_id}-${rec.from_branch}-${rec.to_branch}`;
    setDismissed((prev) => new Set([...prev, key]));
    setConfirmDialog({ open: false, rec: null });
    setSnackbar({
      open: true,
      message: `Approved: Transfer ${rec.qty} × ${rec.item_name} from ${rec.from_branch} → ${rec.to_branch}. Create the voucher in POS.`,
      severity: "success",
    });
  };

  const handleDismiss = (rec) => {
    const key = `${rec.item_id}-${rec.from_branch}-${rec.to_branch}`;
    setDismissed((prev) => new Set([...prev, key]));
  };

  const visibleRecs = useMemo(
    () =>
      recommendations.filter(
        (r) => !dismissed.has(`${r.item_id}-${r.from_branch}-${r.to_branch}`)
      ),
    [recommendations, dismissed]
  );

  const chartData = useMemo(() => {
    if (!forecasts.length) return null;
    const totals = {};
    forecasts.forEach((f) => {
      if (!totals[f.item_id])
        totals[f.item_id] = { label: f.item_name || f.item_id, qty: 0 };
      totals[f.item_id].qty += f.total_forecast_qty || 0;
    });
    const sorted = Object.values(totals)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);
    return {
      labels: sorted.map((i) =>
        i.label.length > 22 ? i.label.slice(0, 22) + "…" : i.label
      ),
      datasets: [
        {
          label: `${horizon}-Day Forecast (Units)`,
          data: sorted.map((i) => Math.round(i.qty * 10) / 10),
          backgroundColor: "rgba(99, 132, 255, 0.75)",
          borderColor: "rgba(99, 132, 255, 1)",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [forecasts, horizon]);

  const criticalCount = visibleRecs.filter((r) => r.urgency === "critical").length;
  const highCount = visibleRecs.filter((r) => r.urgency === "high").length;
  const mediumCount = visibleRecs.filter((r) => r.urgency === "medium").length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <Typography variant="h5" sx={{ color: "#ffe3a3", fontWeight: "bold", flexGrow: 1 }}>
          AI Stock Intelligence
        </Typography>
        <Tooltip title="Refresh all data">
          <IconButton onClick={loadAll} sx={{ color: "#ffe3a3" }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Box sx={{ display: "flex", gap: 1 }}>
          {[7, 14, 30].map((h) => (
            <Button
              key={h}
              size="small"
              variant={horizon === h ? "contained" : "outlined"}
              onClick={() => setHorizon(h)}
              sx={{ minWidth: 50 }}
            >
              {h}d
            </Button>
          ))}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Model Status
              </Typography>
              {loading.status ? (
                <CircularProgress size={20} />
              ) : status ? (
                <>
                  <Typography variant="body2">
                    <b>Last trained:</b>{" "}
                    {status.trained_at
                      ? new Date(status.trained_at).toLocaleString()
                      : "Not yet trained"}
                  </Typography>
                  {status.mae != null && (
                    <Typography variant="body2">
                      MAE: {Number(status.mae).toFixed(3)} &nbsp;|&nbsp; MAPE:{" "}
                      {Number(status.mape).toFixed(1)}%
                    </Typography>
                  )}
                  {status.training_in_progress && (
                    <>
                      <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                        Training in progress…
                      </Typography>
                      <LinearProgress sx={{ mt: 1 }} />
                    </>
                  )}
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Service unavailable
                </Typography>
              )}
              <Button
                variant="contained"
                size="small"
                sx={{ mt: 1.5, backgroundColor: "#21295c" }}
                onClick={handleTrain}
                disabled={loading.train || status?.training_in_progress}
              >
                {loading.train || status?.training_in_progress ? "Training…" : "Retrain Model"}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} md={4}>
          <StatCard
            title="Forecast Coverage"
            value={loading.forecast ? "—" : forecasts.length}
            sub={`item-branch pairs with ${horizon}-day forecast`}
            loading={loading.forecast}
          />
        </Grid>

        <Grid xs={12} md={4}>
          <StatCard
            title="Transfer Recommendations"
            value={loading.recs ? "—" : visibleRecs.length}
            sub={`${criticalCount} critical · ${highCount} high · ${mediumCount} medium`}
            loading={loading.recs}
            highlight={criticalCount > 0}
          />
        </Grid>
      </Grid>

      {/* Forecast Chart */}
      {chartData && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Top 15 Items — {horizon}-Day Demand Forecast
          </Typography>
          <Box sx={{ height: 300 }}>
            <Bar
              data={chartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} units` } },
                },
                scales: {
                  x: { ticks: { maxRotation: 45, font: { size: 11 } } },
                  y: {
                    beginAtZero: true,
                    title: { display: true, text: "Units" },
                  },
                },
              }}
            />
          </Box>
        </Paper>
      )}

      {/* Recommendations Table */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1 }}>
          <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
            Transfer Recommendations
          </Typography>
          {loading.recs && <CircularProgress size={18} />}
          {dismissed.size > 0 && (
            <Button
              size="small"
              variant="text"
              onClick={() => {
                setDismissed(new Set());
                fetchRecommendations();
              }}
            >
              Reset ({dismissed.size} hidden)
            </Button>
          )}
        </Box>

        {visibleRecs.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              {recommendations.length === 0
                ? "No recommendations available. Train the model first, then check back."
                : "All recommendations have been handled."}
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: "bold", whiteSpace: "nowrap" } }}>
                  <TableCell>Urgency</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell>From Branch</TableCell>
                  <TableCell>To Branch</TableCell>
                  <TableCell align="right">Transfer Qty</TableCell>
                  <TableCell align="right">Current Stock</TableCell>
                  <TableCell align="right">{horizon}d Forecast</TableCell>
                  <TableCell align="right">Donor Surplus</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRecs.map((rec, i) => (
                  <TableRow
                    key={i}
                    sx={{
                      "&:hover": { backgroundColor: "action.hover" },
                      borderLeft:
                        rec.urgency === "critical"
                          ? "3px solid #f44336"
                          : rec.urgency === "high"
                          ? "3px solid #ff9800"
                          : "3px solid transparent",
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={rec.urgency}
                        color={URGENCY_COLOR[rec.urgency] || "default"}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ maxWidth: 180 }}>
                      <Tooltip title={rec.item_name}>
                        <Typography variant="body2" noWrap>
                          {rec.item_name}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{rec.from_branch}</TableCell>
                    <TableCell>{rec.to_branch}</TableCell>
                    <TableCell align="right">
                      <b>{rec.qty}</b>
                    </TableCell>
                    <TableCell align="right">{rec.to_current_stock}</TableCell>
                    <TableCell align="right">
                      {rec.to_forecast_7d != null ? Number(rec.to_forecast_7d).toFixed(1) : "—"}
                    </TableCell>
                    <TableCell align="right">{rec.from_surplus}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: CONFIDENCE_COLOR[rec.confidence], fontWeight: "bold" }}
                      >
                        {rec.confidence}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Tooltip title="Approve — create transfer in POS">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleApprove(rec)}
                        >
                          <CheckCircleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Dismiss">
                        <IconButton
                          size="small"
                          color="default"
                          onClick={() => handleDismiss(rec)}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Confirm Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, rec: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Stock Transfer</DialogTitle>
        <DialogContent>
          {confirmDialog.rec && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
              <Typography>
                <b>Item:</b> {confirmDialog.rec.item_name}
              </Typography>
              <Typography>
                <b>Quantity:</b> {confirmDialog.rec.qty}
              </Typography>
              <Typography>
                <b>From:</b> {confirmDialog.rec.from_branch}
              </Typography>
              <Typography>
                <b>To:</b> {confirmDialog.rec.to_branch}
              </Typography>
              <Typography>
                <b>Urgency:</b>{" "}
                <Chip
                  label={confirmDialog.rec.urgency}
                  color={URGENCY_COLOR[confirmDialog.rec.urgency]}
                  size="small"
                />
              </Typography>
              <Alert severity="info" sx={{ mt: 1 }}>
                Approving marks this recommendation as handled. Open the POS app to create the actual stock transfer voucher.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, rec: null })}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleConfirmApprove}>
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={7000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AIDashboardPage;
