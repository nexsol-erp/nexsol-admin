import React from "react";
import {
  Box, Typography, Button, Container, Grid, Chip, Stack,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { useNavigate } from "react-router-dom";

// ── Inline dashboard mockup (no external images needed) ──────────────────────
const DashboardMockup = () => (
  <Box
    sx={{
      borderRadius: "20px",
      overflow: "hidden",
      boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
      border: "1px solid rgba(255,255,255,0.12)",
      bgcolor: "#0f172a",
      userSelect: "none",
    }}
  >
    {/* Title bar */}
    <Box sx={{ bgcolor: "#1e293b", px: 2, py: 1, display: "flex", alignItems: "center", gap: 0.8 }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <Box key={c} sx={{ width: 11, height: 11, borderRadius: "50%", bgcolor: c }} />
      ))}
      <Typography sx={{ color: "#64748b", fontSize: 11, ml: 1, fontFamily: "monospace" }}>
        Tradelink247 — Dashboard
      </Typography>
    </Box>

    <Box sx={{ p: 2 }}>
      {/* Stat cards row */}
      <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
        {[
          { label: "Today Sales", value: "₹1,24,380", color: "#3b82f6", delta: "+12%" },
          { label: "Stock Items", value: "3,847", color: "#10b981", delta: "+4%" },
          { label: "Purchases", value: "₹48,200", color: "#f59e0b", delta: "+7%" },
          { label: "Branches", value: "6 Active", color: "#8b5cf6", delta: "Live" },
        ].map((s) => (
          <Grid item xs={6} key={s.label}>
            <Box
              sx={{
                bgcolor: "#1e293b", borderRadius: "10px", p: 1.2,
                borderLeft: `3px solid ${s.color}`,
              }}
            >
              <Typography sx={{ color: "#94a3b8", fontSize: 9.5, mb: 0.3 }}>{s.label}</Typography>
              <Typography sx={{ color: "#f1f5f9", fontSize: 13, fontWeight: 700 }}>{s.value}</Typography>
              <Typography sx={{ color: s.color, fontSize: 9, fontWeight: 600 }}>{s.delta}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Chart area */}
      <Box sx={{ bgcolor: "#1e293b", borderRadius: "10px", p: 1.5, mb: 1.5 }}>
        <Typography sx={{ color: "#94a3b8", fontSize: 10, mb: 1 }}>Sales — Last 7 Days</Typography>
        <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.8, height: 60 }}>
          {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: `${h}%`,
                borderRadius: "4px 4px 0 0",
                background: i === 5
                  ? "linear-gradient(180deg, #3b82f6, #1e40af)"
                  : "linear-gradient(180deg, #334155, #1e293b)",
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Table-like rows */}
      <Box sx={{ bgcolor: "#1e293b", borderRadius: "10px", p: 1.2 }}>
        <Typography sx={{ color: "#94a3b8", fontSize: 10, mb: 1 }}>Recent Bills</Typography>
        {[
          { bill: "BILL-00412", item: "Grocery Items", amt: "₹2,340", tag: "Paid", tc: "#10b981" },
          { bill: "BILL-00411", item: "Bakery Pack", amt: "₹580", tag: "Paid", tc: "#10b981" },
          { bill: "BILL-00410", item: "Stationery", amt: "₹1,200", tag: "Pending", tc: "#f59e0b" },
        ].map((r) => (
          <Box
            key={r.bill}
            sx={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              py: 0.5, borderBottom: "1px solid #0f172a",
            }}
          >
            <Box>
              <Typography sx={{ color: "#e2e8f0", fontSize: 9.5, fontWeight: 600 }}>{r.bill}</Typography>
              <Typography sx={{ color: "#64748b", fontSize: 8.5 }}>{r.item}</Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ color: "#f1f5f9", fontSize: 9.5, fontWeight: 700 }}>{r.amt}</Typography>
              <Typography sx={{ color: r.tc, fontSize: 8 }}>{r.tag}</Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  </Box>
);

// ── Trusted-by badge strip ────────────────────────────────────────────────────
const TRUST_ITEMS = [
  "Supermarkets", "Bakeries", "Wholesale", "Retail Chains", "Distribution",
];

const HeroSection = () => {
  const navigate = useNavigate();

  const scrollToContact = () => {
    const el = document.getElementById("contact");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Box
      id="home"
      sx={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
        minHeight: "100vh",
        pt: { xs: 12, md: 14 },
        pb: { xs: 8, md: 12 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      {[
        { top: "10%", left: "-8%", size: 420, color: "rgba(59,130,246,0.18)" },
        { top: "60%", right: "-5%", size: 340, color: "rgba(139,92,246,0.14)" },
        { top: "30%", left: "40%", size: 260, color: "rgba(16,185,129,0.10)" },
      ].map((o, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute", borderRadius: "50%",
            width: o.size, height: o.size,
            bgcolor: o.color, filter: "blur(80px)",
            top: o.top, left: o.left, right: o.right,
            pointerEvents: "none",
          }}
        />
      ))}

      <Container maxWidth="xl" sx={{ position: "relative", zIndex: 1 }}>
        <Grid container spacing={6} alignItems="center">
          {/* Left — text */}
          <Grid item xs={12} md={6}>
            <Chip
              label="🚀  Now live — Cloud ERP for Indian Retail"
              size="small"
              sx={{
                bgcolor: "rgba(59,130,246,0.2)", color: "#93c5fd",
                border: "1px solid rgba(59,130,246,0.35)",
                fontWeight: 600, mb: 3, fontSize: 12, px: 0.5,
              }}
            />

            <Typography
              variant="h1"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2.2rem", sm: "2.8rem", md: "3.4rem" },
                color: "#ffffff",
                lineHeight: 1.18,
                mb: 2.5,
                letterSpacing: "-1px",
              }}
            >
              Run Your Retail Business{" "}
              <Box
                component="span"
                sx={{
                  background: "linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Smarter
              </Box>{" "}
              with Tradelink247 ERP
            </Typography>

            <Typography
              sx={{
                fontSize: { xs: 15, md: 17 },
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.75,
                mb: 4,
                maxWidth: 540,
              }}
            >
              Complete cloud ERP and POS solution for billing, inventory, purchase, stock
              transfer, reports, branches, and business growth — built for Indian retail.
            </Typography>

            {/* CTA buttons */}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 4 }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => navigate("/signup")}
                sx={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 15,
                  borderRadius: "12px", px: 3.5, py: 1.5,
                  boxShadow: "0 8px 24px rgba(59,130,246,0.5)",
                  textTransform: "none",
                  "&:hover": { opacity: 0.92, boxShadow: "0 10px 28px rgba(59,130,246,0.6)" },
                }}
              >
                Start Free Trial
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={scrollToContact}
                sx={{
                  borderColor: "rgba(255,255,255,0.45)",
                  color: "#fff", fontWeight: 600, fontSize: 15,
                  borderRadius: "12px", px: 3.5, py: 1.5,
                  textTransform: "none",
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                Book a Demo
              </Button>
            </Stack>

            {/* Quick trust checks */}
            <Stack direction="row" flexWrap="wrap" gap={2}>
              {[
                "No credit card required",
                "Setup in minutes",
                "GST-ready structure",
              ].map((t) => (
                <Box key={t} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                  <CheckCircleOutlineIcon sx={{ color: "#34d399", fontSize: 16 }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.72)", fontSize: 13 }}>{t}</Typography>
                </Box>
              ))}
            </Stack>
          </Grid>

          {/* Right — dashboard mockup */}
          <Grid item xs={12} md={6}>
            <Box sx={{ position: "relative" }}>
              <DashboardMockup />
              {/* Floating badge */}
              <Box
                sx={{
                  position: "absolute", bottom: -18, left: -18,
                  bgcolor: "#10b981", borderRadius: "14px",
                  px: 2, py: 1.2, boxShadow: "0 8px 20px rgba(16,185,129,0.45)",
                  display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1,
                }}
              >
                <Typography sx={{ color: "#fff", fontSize: 20, lineHeight: 1 }}>⚡</Typography>
                <Box>
                  <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
                    Fast Billing
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 10 }}>
                    Thermal print ready
                  </Typography>
                </Box>
              </Box>
              {/* Floating badge 2 */}
              <Box
                sx={{
                  position: "absolute", top: -16, right: -14,
                  bgcolor: "#7c3aed", borderRadius: "14px",
                  px: 2, py: 1.2, boxShadow: "0 8px 20px rgba(124,58,237,0.45)",
                  display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1,
                }}
              >
                <Typography sx={{ color: "#fff", fontSize: 20, lineHeight: 1 }}>🌐</Typography>
                <Box>
                  <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
                    Cloud Access
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 10 }}>
                    Anywhere, anytime
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Trusted by strip */}
        <Box
          sx={{
            mt: { xs: 6, md: 10 },
            pt: 4,
            borderTop: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Typography sx={{ color: "rgba(255,255,255,0.45)", fontSize: 12, mr: 1 }}>
            TRUSTED BY BUSINESSES IN:
          </Typography>
          {TRUST_ITEMS.map((t) => (
            <Chip
              key={t}
              label={t}
              size="small"
              sx={{
                bgcolor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.14)",
                fontSize: 11,
              }}
            />
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default HeroSection;
