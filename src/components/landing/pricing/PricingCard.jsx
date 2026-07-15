import React from "react";
import { Box, Typography, Button, Paper, Chip } from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import { useNavigate } from "react-router-dom";

const PricingCard = ({ plan }) => {
  const navigate = useNavigate();
  const highlighted = !!plan.highlighted;

  return (
    <Paper
      elevation={0}
      sx={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: "20px",
        p: 3.5,
        pt: highlighted ? 4.5 : 3.5,
        border: highlighted ? "2px solid #3b82f6" : "1px solid #e2e8f0",
        background: highlighted
          ? "linear-gradient(180deg, #eff6ff 0%, #ffffff 40%)"
          : "#ffffff",
        boxShadow: highlighted
          ? "0 24px 60px rgba(59,130,246,0.22)"
          : "0 4px 18px rgba(15,23,42,0.06)",
        transform: highlighted ? { md: "scale(1.05)" } : "none",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        zIndex: highlighted ? 2 : 1,
        "&:hover": {
          transform: highlighted ? { md: "scale(1.07) translateY(-4px)" } : "translateY(-6px)",
          boxShadow: highlighted
            ? "0 28px 70px rgba(59,130,246,0.3)"
            : "0 16px 40px rgba(15,23,42,0.12)",
        },
      }}
    >
      {highlighted && (
        <Chip
          label="MOST POPULAR"
          size="small"
          sx={{
            position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)",
            bgcolor: "#3b82f6", color: "#fff", fontWeight: 700,
            fontSize: 10.5, letterSpacing: "0.6px", px: 1,
            boxShadow: "0 6px 16px rgba(59,130,246,0.5)",
          }}
        />
      )}

      <Typography sx={{ fontWeight: 800, fontSize: 13, letterSpacing: "1px", color: "#3b82f6", mb: 1 }}>
        {plan.name}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: 30, md: 34 }, color: "#0f172a", letterSpacing: "-1px" }}>
          {plan.price}
        </Typography>
        {plan.period && (
          <Typography sx={{ fontSize: 14, color: "#64748b", fontWeight: 500 }}>
            /{plan.period}
          </Typography>
        )}
      </Box>

      <Typography sx={{ fontSize: 13, color: "#64748b", mb: 3 }}>
        {plan.suitableFor}
      </Typography>

      <Button
        fullWidth
        variant={highlighted ? "contained" : "outlined"}
        onClick={() => navigate(plan.ctaRoute || "/signup")}
        sx={{
          borderRadius: "10px", py: 1.3, fontWeight: 700, fontSize: 14.5,
          textTransform: "none", mb: 3,
          ...(highlighted
            ? {
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                boxShadow: "0 8px 20px rgba(16,185,129,0.4)",
                "&:hover": { opacity: 0.92 },
              }
            : {
                borderColor: "#cbd5e1", color: "#1e293b",
                "&:hover": { borderColor: "#3b82f6", bgcolor: "rgba(59,130,246,0.05)" },
              }),
        }}
      >
        {plan.cta}
      </Button>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
        {plan.features.map((f) => (
          <Box key={f} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
            <CheckCircleRoundedIcon sx={{ color: "#10b981", fontSize: 17, mt: "1px", flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13.5, color: "#334155", lineHeight: 1.5 }}>{f}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
};

export default PricingCard;
