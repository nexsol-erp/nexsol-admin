import React from "react";
import { Box, Typography, Container, Grid, Chip } from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ShieldIcon from "@mui/icons-material/Shield";

const REASONS = [
  {
    icon: CloudIcon,
    title: "Cloud ERP",
    desc: "Access your business from anywhere — no servers to manage.",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    icon: WifiOffIcon,
    title: "Offline POS",
    desc: "Billing never stops, even without an internet connection.",
    color: "#f59e0b",
    bg: "#fffbeb",
  },
  {
    icon: AutoAwesomeIcon,
    title: "AI Powered",
    desc: "AI-driven reports, forecasts, and business insights built in.",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    icon: AccountTreeIcon,
    title: "Multi Branch",
    desc: "Centralized control across unlimited branches and teams.",
    color: "#10b981",
    bg: "#f0fdf4",
  },
  {
    icon: SyncAltIcon,
    title: "Tally Integration",
    desc: "Sync seamlessly with your existing Tally accounting setup.",
    color: "#06b6d4",
    bg: "#f0f9ff",
  },
  {
    icon: ShieldIcon,
    title: "Secure",
    desc: "Role-based access, encrypted data, and daily automated backups.",
    color: "#ef4444",
    bg: "#fff5f5",
  },
];

const PricingWhyChoose = () => (
  <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: "#f8fafc" }}>
    <Container maxWidth="xl">
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
        <Chip
          label="WHY TRADELINK247"
          size="small"
          sx={{
            bgcolor: "#d1fae5", color: "#065f46",
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
          Why Choose TradeLink247
        </Typography>
      </Box>

      <Grid container spacing={2.5}>
        {REASONS.map((r) => {
          const Icon = r.icon;
          return (
            <Grid item xs={12} sm={6} md={4} key={r.title}>
              <Box
                sx={{
                  p: 3,
                  height: "100%",
                  borderRadius: "18px",
                  bgcolor: "#fff",
                  border: "1px solid #e2e8f0",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    transform: "translateY(-6px)",
                    boxShadow: `0 16px 40px ${r.color}22`,
                    borderColor: `${r.color}55`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 50, height: 50, borderRadius: "14px",
                    bgcolor: r.bg, display: "flex",
                    alignItems: "center", justifyContent: "center", mb: 2,
                  }}
                >
                  <Icon sx={{ color: r.color, fontSize: 26 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#0f172a", mb: 0.8 }}>
                  {r.title}
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.6 }}>
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

export default PricingWhyChoose;
