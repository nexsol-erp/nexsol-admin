import React, { useState } from "react";
import {
  Box, Typography, Container, Grid, Button, TextField,
  Paper, Chip, Snackbar, Alert,
} from "@mui/material";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

const CHECKLIST = [
  "Create your company in minutes",
  "Add branches and users instantly",
  "Set up items with barcode support",
  "Start billing from day one",
  "No credit card required",
  "Free onboarding support",
];

const CTASection = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [snackOpen, setSnackOpen] = useState(false);

  const handleQuickStart = (e) => {
    e.preventDefault();
    if (email.trim()) {
      navigate(`/signup?email=${encodeURIComponent(email.trim())}`);
    } else {
      navigate("/signup");
    }
  };

  return (
    <Box
      id="pricing"
      sx={{
        py: { xs: 8, md: 12 },
        bgcolor: "#f8fafc",
      }}
    >
      <Container maxWidth="lg">
        {/* Main CTA card */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: "24px",
            overflow: "hidden",
            background: "linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #3b82f6 100%)",
            position: "relative",
          }}
        >
          {/* Decorative orbs */}
          {[
            { top: "-60px", right: "-60px", size: 220, color: "rgba(139,92,246,0.25)" },
            { bottom: "-40px", left: "-40px", size: 180, color: "rgba(16,185,129,0.18)" },
          ].map((o, i) => (
            <Box
              key={i}
              sx={{
                position: "absolute",
                width: o.size, height: o.size, borderRadius: "50%",
                bgcolor: o.color, filter: "blur(50px)",
                top: o.top, right: o.right, bottom: o.bottom, left: o.left,
                pointerEvents: "none",
              }}
            />
          ))}

          <Grid container sx={{ position: "relative", zIndex: 1 }}>
            {/* Left — headline */}
            <Grid
              item xs={12} md={6}
              sx={{ p: { xs: 4, md: 6 }, display: "flex", flexDirection: "column", justifyContent: "center" }}
            >
              <Chip
                label="START TODAY — IT'S FREE"
                size="small"
                sx={{
                  bgcolor: "rgba(52,211,153,0.2)",
                  color: "#6ee7b7",
                  border: "1px solid rgba(52,211,153,0.3)",
                  fontWeight: 700, letterSpacing: "0.8px",
                  fontSize: 10, mb: 3, alignSelf: "flex-start",
                }}
              />
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: "1.8rem", md: "2.4rem" },
                  color: "#ffffff",
                  mb: 2, lineHeight: 1.22, letterSpacing: "-0.5px",
                }}
              >
                Start managing your business better today
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 14, md: 16 },
                  color: "rgba(255,255,255,0.7)",
                  lineHeight: 1.7, mb: 4,
                }}
              >
                Sign up now and create your company, branches, users, roles, items,
                and start billing quickly — all within a single session.
              </Typography>

              {/* Checklist */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {CHECKLIST.map((item) => (
                  <Box key={item} sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                    <CheckCircleIcon sx={{ color: "#34d399", fontSize: 18 }} />
                    <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
                      {item}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            {/* Right — form panel */}
            <Grid
              item xs={12} md={6}
              sx={{
                bgcolor: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(10px)",
                borderLeft: { md: "1px solid rgba(255,255,255,0.1)" },
                p: { xs: 4, md: 6 },
                display: "flex", flexDirection: "column", justifyContent: "center",
              }}
            >
              <Typography
                sx={{ fontWeight: 700, fontSize: 20, color: "#fff", mb: 0.8 }}
              >
                Create your free account
              </Typography>
              <Typography sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13.5, mb: 3 }}>
                No credit card · No commitment · Cancel anytime
              </Typography>

              <Box component="form" onSubmit={handleQuickStart} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField
                  placeholder="Enter your email address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "rgba(255,255,255,0.1)",
                      borderRadius: "10px",
                      color: "#fff",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                      "&:hover fieldset": { borderColor: "rgba(255,255,255,0.4)" },
                      "&.Mui-focused fieldset": { borderColor: "#60a5fa" },
                    },
                    "& input::placeholder": { color: "rgba(255,255,255,0.45)", opacity: 1 },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  endIcon={<ArrowForwardRoundedIcon />}
                  sx={{
                    bgcolor: "#ffffff", color: "#1e40af",
                    fontWeight: 700, fontSize: 15,
                    borderRadius: "10px", py: 1.4,
                    textTransform: "none",
                    "&:hover": { bgcolor: "#f1f5f9" },
                    boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
                  }}
                >
                  Sign Up Now — It's Free
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,0.15)" }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>or</Typography>
                  <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,0.15)" }} />
                </Box>

                <Button
                  variant="outlined"
                  size="large"
                  fullWidth
                  startIcon={<CalendarMonthIcon />}
                  onClick={() => {
                    const el = document.getElementById("contact");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  sx={{
                    borderColor: "rgba(255,255,255,0.35)",
                    color: "#fff",
                    fontWeight: 600, fontSize: 14,
                    borderRadius: "10px", py: 1.2,
                    textTransform: "none",
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.07)" },
                  }}
                >
                  Request a Demo
                </Button>
              </Box>

              <Typography sx={{ mt: 3, color: "rgba(255,255,255,0.4)", fontSize: 11.5, textAlign: "center" }}>
                By signing up you agree to our Terms of Service and Privacy Policy.
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Container>

      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>
          Thanks! Redirecting you to sign up…
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default CTASection;
