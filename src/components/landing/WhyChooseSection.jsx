import React from "react";
import {
  Box, Typography, Container, Grid, Chip, Paper,
} from "@mui/material";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import BoltIcon from "@mui/icons-material/Bolt";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import LockIcon from "@mui/icons-material/Lock";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import FlagIcon from "@mui/icons-material/Flag";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";

const REASONS = [
  {
    icon: TouchAppIcon,
    title: "Easy to Use",
    desc: "Intuitive interface designed for store staff — minimal training required.",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    icon: BoltIcon,
    title: "Fast Setup",
    desc: "Create your company, branches, users, and items and start billing in one day.",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  {
    icon: AttachMoneyIcon,
    title: "Affordable Subscription",
    desc: "Flat monthly pricing — no hidden charges, no per-user fees for small teams.",
    color: "#10b981",
    bg: "#f0fdf4",
  },
  {
    icon: LockIcon,
    title: "Secure Cloud System",
    desc: "JWT-secured login, role-based access, and encrypted data storage.",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    icon: TrendingUpIcon,
    title: "Grows with Your Business",
    desc: "Add branches, users, and items anytime — the platform scales with you.",
    color: "#ef4444",
    bg: "#fff5f5",
  },
  {
    icon: FlagIcon,
    title: "Made for Indian Retail",
    desc: "Designed for Indian business workflows, naming conventions, and operations.",
    color: "#f97316",
    bg: "#fff7ed",
  },
  {
    icon: ReceiptLongIcon,
    title: "GST & Tax Ready",
    desc: "Built-in GST support, tax categories, HSN codes, and tax summary reports.",
    color: "#06b6d4",
    bg: "#f0f9ff",
  },
  {
    icon: DeviceHubIcon,
    title: "Multi-Branch Ready",
    desc: "One login, multiple branches — centralized control with local autonomy.",
    color: "#0ea5e9",
    bg: "#e0f2fe",
  },
];

// ── Stats strip ───────────────────────────────────────────────────────────────
const STATS = [
  { value: "500+", label: "Businesses" },
  { value: "50K+", label: "Daily Bills" },
  { value: "6+", label: "Industries" },
  { value: "99.9%", label: "Uptime" },
];

const WhyChooseSection = () => (
  <Box
    id="why-choose"
    sx={{
      py: { xs: 8, md: 12 },
      background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
      position: "relative",
      overflow: "hidden",
    }}
  >
    {/* Background decoration */}
    <Box
      sx={{
        position: "absolute", inset: 0,
        backgroundImage:
          "radial-gradient(circle at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 50%), " +
          "radial-gradient(circle at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 45%)",
        pointerEvents: "none",
      }}
    />

    <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
        <Chip
          label="WHY TRADELINK247"
          size="small"
          sx={{
            bgcolor: "rgba(59,130,246,0.2)",
            color: "#93c5fd",
            border: "1px solid rgba(59,130,246,0.3)",
            fontWeight: 700, letterSpacing: "1px", mb: 2, fontSize: 11,
          }}
        />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800, fontSize: { xs: "1.9rem", md: "2.6rem" },
            color: "#ffffff", mb: 1.5, letterSpacing: "-0.5px",
          }}
        >
          Why 500+ Businesses Choose Us
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 15, md: 17 }, color: "rgba(255,255,255,0.65)",
            maxWidth: 560, mx: "auto", lineHeight: 1.7,
          }}
        >
          We built Tradelink247 with one goal — to give every retail and trading
          business a powerful ERP without enterprise complexity.
        </Typography>
      </Box>

      {/* Stats strip */}
      <Grid container spacing={2} sx={{ mb: 7 }}>
        {STATS.map((s) => (
          <Grid item xs={6} md={3} key={s.label}>
            <Paper
              elevation={0}
              sx={{
                textAlign: "center", py: 3, px: 2,
                borderRadius: "16px",
                bgcolor: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(10px)",
              }}
            >
              <Typography
                sx={{
                  fontSize: { xs: "1.8rem", md: "2.4rem" },
                  fontWeight: 800, color: "#60a5fa",
                  lineHeight: 1.1, mb: 0.5,
                }}
              >
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                {s.label}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Reasons grid */}
      <Grid container spacing={2.5}>
        {REASONS.map((r) => {
          const Icon = r.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={r.title}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: "16px",
                  bgcolor: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  height: "100%",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.09)",
                    border: `1px solid ${r.color}50`,
                    transform: "translateY(-4px)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 46, height: 46, borderRadius: "12px",
                    bgcolor: r.bg, display: "flex",
                    alignItems: "center", justifyContent: "center", mb: 1.8,
                  }}
                >
                  <Icon sx={{ color: r.color, fontSize: 24 }} />
                </Box>
                <Typography
                  sx={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", mb: 0.8 }}
                >
                  {r.title}
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {r.desc}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  </Box>
);

export default WhyChooseSection;
