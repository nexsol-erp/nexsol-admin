import React from "react";
import { Box, Typography, Button, Container, Chip, Stack } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import { useNavigate } from "react-router-dom";

const PricingHero = () => {
  const navigate = useNavigate();

  const scrollToContact = () => {
    const el = document.getElementById("contact");
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else navigate("/", { state: { scrollTo: "contact" } });
  };

  return (
    <Box
      id="pricing-hero"
      sx={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
        pt: { xs: 14, md: 16 },
        pb: { xs: 8, md: 10 },
        position: "relative",
        overflow: "hidden",
      }}
    >
      {[
        { top: "8%", left: "-8%", size: 380, color: "rgba(59,130,246,0.18)" },
        { top: "55%", right: "-6%", size: 320, color: "rgba(16,185,129,0.14)" },
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

      <Container maxWidth="md" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <Chip
          label="PRICING"
          size="small"
          sx={{
            bgcolor: "rgba(59,130,246,0.2)", color: "#93c5fd",
            border: "1px solid rgba(59,130,246,0.35)",
            fontWeight: 700, letterSpacing: "1px", mb: 3, fontSize: 11,
          }}
        />

        <Typography
          variant="h1"
          sx={{
            fontWeight: 800,
            fontSize: { xs: "2.1rem", sm: "2.8rem", md: "3.2rem" },
            color: "#ffffff",
            lineHeight: 1.2,
            mb: 2.5,
            letterSpacing: "-1px",
          }}
        >
          Simple Pricing.{" "}
          <Box
            component="span"
            sx={{
              background: "linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Powerful ERP.
          </Box>{" "}
          No Hidden Charges.
        </Typography>

        <Typography
          sx={{
            fontSize: { xs: 15, md: 18 },
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1.75,
            mb: 5,
            maxWidth: 560,
            mx: "auto",
          }}
        >
          Start free for 30 days. No credit card required. Upgrade anytime.
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardRoundedIcon />}
            onClick={() => navigate("/signup")}
            sx={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff", fontWeight: 700, fontSize: 15,
              borderRadius: "12px", px: 4, py: 1.5,
              boxShadow: "0 8px 24px rgba(16,185,129,0.45)",
              textTransform: "none",
              "&:hover": { opacity: 0.92, boxShadow: "0 10px 28px rgba(16,185,129,0.55)" },
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
              borderRadius: "12px", px: 4, py: 1.5,
              textTransform: "none",
              "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            Book Live Demo
          </Button>
        </Stack>
      </Container>
    </Box>
  );
};

export default PricingHero;
