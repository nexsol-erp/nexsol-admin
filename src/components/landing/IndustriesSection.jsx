import React from "react";
import {
  Box, Typography, Container, Grid, Card, CardContent, Chip,
} from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import BakeryDiningIcon from "@mui/icons-material/BakeryDining";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";

const INDUSTRIES = [
  {
    icon: StorefrontIcon,
    label: "Supermarkets",
    desc: "Handle thousands of SKUs, fast checkout, barcode scanning, and real-time stock.",
    gradient: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
    emoji: "🛒",
  },
  {
    icon: BakeryDiningIcon,
    label: "Bakeries",
    desc: "Daily production billing, ingredient tracking, and fast counter sales.",
    gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)",
    emoji: "🥐",
  },
  {
    icon: LocalMallIcon,
    label: "Retail Shops",
    desc: "Complete POS, purchase management, and customer billing in one screen.",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
    emoji: "🏪",
  },
  {
    icon: LocalShippingIcon,
    label: "Wholesale Trading",
    desc: "Bulk billing, supplier tracking, GST invoices, and warehouse stock control.",
    gradient: "linear-gradient(135deg, #065f46 0%, #10b981 100%)",
    emoji: "🚛",
  },
  {
    icon: WarehouseIcon,
    label: "Distribution Businesses",
    desc: "Stock transfers, route-wise delivery, and multi-location inventory tracking.",
    gradient: "linear-gradient(135deg, #be185d 0%, #ec4899 100%)",
    emoji: "📦",
  },
  {
    icon: AccountBalanceIcon,
    label: "Multi-Branch Stores",
    desc: "Centralized dashboard with branch-wise P&L, stock, and user access control.",
    gradient: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)",
    emoji: "🏬",
  },
];

const IndustryCard = ({ industry }) => {
  const Icon = industry.icon;
  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: "18px",
        overflow: "hidden",
        border: "1px solid #e2e8f0",
        transition: "transform 0.3s, box-shadow 0.3s",
        "&:hover": {
          transform: "translateY(-8px)",
          boxShadow: "0 20px 48px rgba(0,0,0,0.14)",
        },
      }}
    >
      {/* Coloured top banner */}
      <Box
        sx={{
          background: industry.gradient,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <Typography sx={{ fontSize: 42, lineHeight: 1 }}>{industry.emoji}</Typography>
        <Box
          sx={{
            position: "absolute", bottom: -22, left: "50%",
            transform: "translateX(-50%)",
            width: 44, height: 44, borderRadius: "12px",
            background: industry.gradient,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            border: "3px solid #fff",
          }}
        >
          <Icon sx={{ color: "#fff", fontSize: 22 }} />
        </Box>
      </Box>

      <CardContent sx={{ pt: 4, pb: 3, px: 2.5, textAlign: "center" }}>
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, fontSize: 16, color: "#1e293b", mb: 1 }}
        >
          {industry.label}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.65 }}>
          {industry.desc}
        </Typography>
      </CardContent>
    </Card>
  );
};

const IndustriesSection = () => (
  <Box
    id="industries"
    sx={{
      py: { xs: 8, md: 12 },
      background: "linear-gradient(180deg, #ffffff 0%, #f0f9ff 100%)",
    }}
  >
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
        <Chip
          label="INDUSTRIES"
          size="small"
          sx={{
            bgcolor: "#d1fae5", color: "#065f46",
            fontWeight: 700, letterSpacing: "1px", mb: 2, fontSize: 11,
          }}
        />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800, fontSize: { xs: "1.9rem", md: "2.6rem" },
            color: "#0f172a", mb: 1.5, letterSpacing: "-0.5px",
          }}
        >
          Built for Your Industry
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 15, md: 17 }, color: "#64748b",
            maxWidth: 560, mx: "auto", lineHeight: 1.7,
          }}
        >
          Whether you run a corner store or a chain of supermarkets,
          Tradelink247 is designed to fit your business perfectly.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {INDUSTRIES.map((ind) => (
          <Grid item xs={12} sm={6} md={4} key={ind.label}>
            <IndustryCard industry={ind} />
          </Grid>
        ))}
      </Grid>
    </Container>
  </Box>
);

export default IndustriesSection;
