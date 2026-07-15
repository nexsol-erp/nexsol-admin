import React from "react";
import { Box, Typography, Container, Button, Stack, Paper } from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useNavigate } from "react-router-dom";

const PricingCTA = () => {
  const navigate = useNavigate();

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: "#ffffff" }}>
      <Container maxWidth="lg">
        <Paper
          elevation={0}
          sx={{
            borderRadius: "24px",
            overflow: "hidden",
            textAlign: "center",
            py: { xs: 6, md: 8 },
            px: { xs: 3, md: 6 },
            background: "linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #3b82f6 100%)",
            position: "relative",
          }}
        >
          {[
            { top: "-60px", right: "-40px", size: 200, color: "rgba(139,92,246,0.25)" },
            { bottom: "-50px", left: "-40px", size: 180, color: "rgba(16,185,129,0.2)" },
          ].map((o, i) => (
            <Box
              key={i}
              sx={{
                position: "absolute", width: o.size, height: o.size, borderRadius: "50%",
                bgcolor: o.color, filter: "blur(50px)",
                top: o.top, right: o.right, bottom: o.bottom, left: o.left,
                pointerEvents: "none",
              }}
            />
          ))}

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800, fontSize: { xs: "1.8rem", md: "2.5rem" },
                color: "#fff", mb: 2, letterSpacing: "-0.5px",
              }}
            >
              Ready to Transform Your Business?
            </Typography>
            <Typography sx={{ fontSize: { xs: 14, md: 16 }, color: "rgba(255,255,255,0.75)", mb: 4 }}>
              Start your free 30-day trial today.
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
                  "&:hover": { opacity: 0.92 },
                }}
              >
                Start Free Trial
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate("/partner")}
                sx={{
                  borderColor: "rgba(255,255,255,0.45)",
                  color: "#fff", fontWeight: 600, fontSize: 15,
                  borderRadius: "12px", px: 4, py: 1.5,
                  textTransform: "none",
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                Contact Sales
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default PricingCTA;
