import React, { useState } from "react";
import {
  Box, Typography, Container, Grid, Card, CardContent, Chip,
} from "@mui/material";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import InventoryIcon from "@mui/icons-material/Inventory";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BarChartIcon from "@mui/icons-material/BarChart";
import SecurityIcon from "@mui/icons-material/Security";
import CloudIcon from "@mui/icons-material/Cloud";

const FEATURES = [
  {
    icon: PointOfSaleIcon,
    title: "POS Billing",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #dbeafe, #eff6ff)",
    badge: "Core",
    points: [
      "Fast touch-screen billing",
      "Barcode & QR scanning",
      "Thermal printer support",
      "Multiple payment modes",
    ],
  },
  {
    icon: InventoryIcon,
    title: "Inventory Management",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #d1fae5, #f0fdf4)",
    badge: "Real-time",
    points: [
      "Real-time stock tracking",
      "Batch & item management",
      "Stock adjustment entries",
      "Low stock alerts",
    ],
  },
  {
    icon: ShoppingCartIcon,
    title: "Purchase Management",
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #fef3c7, #fffbeb)",
    badge: "Smart",
    points: [
      "Purchase entry & history",
      "Supplier management",
      "GST tax calculation",
      "Purchase reports",
    ],
  },
  {
    icon: SwapHorizIcon,
    title: "Stock Transfer",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #ede9fe, #f5f3ff)",
    badge: "Multi-branch",
    points: [
      "Branch-to-branch transfer",
      "Transfer IN / OUT tracking",
      "Discounted transfer rates",
      "Transfer printout",
    ],
  },
  {
    icon: AccountTreeIcon,
    title: "Multi-Branch Management",
    color: "#ef4444",
    gradient: "linear-gradient(135deg, #fee2e2, #fff5f5)",
    badge: "Centralized",
    points: [
      "Centralized control panel",
      "Branch-wise stock view",
      "Branch-wise reports",
      "User access by branch",
    ],
  },
  {
    icon: BarChartIcon,
    title: "Reports & Analytics",
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #cffafe, #f0f9ff)",
    badge: "Insight",
    points: [
      "Sales & purchase reports",
      "Stock movement reports",
      "Tax & GST reports",
      "Profit & loss insights",
    ],
  },
  {
    icon: SecurityIcon,
    title: "User Roles & Permissions",
    color: "#f97316",
    gradient: "linear-gradient(135deg, #ffedd5, #fff7ed)",
    badge: "Secure",
    points: [
      "Create unlimited users",
      "Assign custom roles",
      "Menu-level access control",
      "Secure business operations",
    ],
  },
  {
    icon: CloudIcon,
    title: "Cloud Access",
    color: "#0ea5e9",
    gradient: "linear-gradient(135deg, #e0f2fe, #f0f9ff)",
    badge: "Always On",
    points: [
      "Access from anywhere",
      "Secure encrypted login",
      "Automatic updates",
      "Scalable for growth",
    ],
  },
];

const FeatureCard = ({ feature }) => {
  const [hovered, setHovered] = useState(false);
  const Icon = feature.icon;

  return (
    <Card
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      elevation={hovered ? 12 : 2}
      sx={{
        height: "100%",
        borderRadius: "18px",
        border: `1px solid ${hovered ? feature.color + "40" : "#e2e8f0"}`,
        transition: "all 0.3s ease",
        transform: hovered ? "translateY(-6px)" : "none",
        cursor: "default",
        overflow: "visible",
        position: "relative",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Icon + Badge row */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box
            sx={{
              width: 52, height: 52,
              borderRadius: "14px",
              background: feature.gradient,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: hovered ? `0 8px 20px ${feature.color}30` : "none",
              transition: "box-shadow 0.3s",
            }}
          >
            <Icon sx={{ color: feature.color, fontSize: 26 }} />
          </Box>
          <Chip
            label={feature.badge}
            size="small"
            sx={{
              bgcolor: feature.color + "15",
              color: feature.color,
              fontWeight: 700,
              fontSize: 10,
              height: 22,
              border: `1px solid ${feature.color}30`,
            }}
          />
        </Box>

        <Typography
          variant="h6"
          sx={{ fontWeight: 700, fontSize: 17, color: "#1e293b", mb: 1.5 }}
        >
          {feature.title}
        </Typography>

        <Box component="ul" sx={{ m: 0, pl: 0, listStyle: "none" }}>
          {feature.points.map((point) => (
            <Box
              key={point}
              component="li"
              sx={{
                display: "flex", alignItems: "center", gap: 1,
                mb: 0.8,
              }}
            >
              <Box
                sx={{
                  width: 6, height: 6, borderRadius: "50%",
                  bgcolor: feature.color, flexShrink: 0,
                  mt: "1px",
                }}
              />
              <Typography sx={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5 }}>
                {point}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>

      {/* Bottom accent bar */}
      <Box
        sx={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 3, borderRadius: "0 0 18px 18px",
          background: hovered ? feature.color : "transparent",
          transition: "background 0.3s",
        }}
      />
    </Card>
  );
};

const FeaturesSection = () => (
  <Box id="features" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#f8fafc" }}>
    <Container maxWidth="xl">
      {/* Section header */}
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 8 } }}>
        <Chip
          label="FEATURES"
          size="small"
          sx={{
            bgcolor: "#dbeafe", color: "#1d4ed8",
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
          Everything Your Business Needs
        </Typography>
        <Typography
          sx={{
            fontSize: { xs: 15, md: 17 }, color: "#64748b",
            maxWidth: 600, mx: "auto", lineHeight: 1.7,
          }}
        >
          Tradelink247 combines every essential business tool into one powerful cloud platform —
          no integrations, no complexity.
        </Typography>
      </Box>

      {/* Feature cards grid */}
      <Grid container spacing={3}>
        {FEATURES.map((feature) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={feature.title}>
            <FeatureCard feature={feature} />
          </Grid>
        ))}
      </Grid>
    </Container>
  </Box>
);

export default FeaturesSection;
