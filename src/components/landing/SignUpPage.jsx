import React from "react";
import {
  Box, Typography, Paper, Link,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import SignUpForm from "../SignUpForm";

const SignUpPage = ({ onLogin }) => {
  const navigate = useNavigate();

  const handleLogin = (roles) => {
    if (onLogin) {
      onLogin(roles);
    } else {
      // Fallback: reload to trigger App.js auth detection
      window.location.href = "/";
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      {[
        { top: "5%", left: "-10%", size: 380, color: "rgba(59,130,246,0.18)" },
        { bottom: "5%", right: "-8%", size: 300, color: "rgba(139,92,246,0.15)" },
      ].map((o, i) => (
        <Box
          key={i}
          sx={{
            position: "absolute", borderRadius: "50%",
            width: o.size, height: o.size,
            bgcolor: o.color, filter: "blur(80px)",
            top: o.top, left: o.left, bottom: o.bottom, right: o.right,
            pointerEvents: "none",
          }}
        />
      ))}

      <Box sx={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480 }}>
        {/* Logo */}
        <Box
          onClick={() => navigate("/")}
          sx={{
            display: "flex", alignItems: "center", justifyContent: "center",
            mb: 4, cursor: "pointer", gap: 1.2,
          }}
        >
          <Box
            sx={{
              width: 40, height: 40, borderRadius: "11px",
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 14px rgba(59,130,246,0.5)",
            }}
          >
            <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>T</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: 24, color: "#fff", letterSpacing: "-0.5px" }}>
            Tradelink<span style={{ color: "#60a5fa" }}>247</span>
          </Typography>
        </Box>

        {/* Card wrapping the existing SignUpForm */}
        <Paper
          elevation={24}
          sx={{
            borderRadius: "20px",
            overflow: "hidden",
            bgcolor: "#fff",
          }}
        >
          <SignUpForm
            onLogin={handleLogin}
            onClose={() => navigate("/")}
            onSignUp={() => {}}
          />
        </Paper>

        <Typography
          sx={{
            mt: 3, textAlign: "center", fontSize: 13.5,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Already have an account?{" "}
          <Link
            component="button"
            onClick={() => navigate("/login")}
            underline="always"
            sx={{ color: "#93c5fd", fontWeight: 600, cursor: "pointer" }}
          >
            Log in here
          </Link>
        </Typography>

        <Typography
          sx={{
            mt: 1.5, textAlign: "center", fontSize: 12,
            color: "rgba(255,255,255,0.35)",
          }}
        >
          © {new Date().getFullYear()} Tradelink247. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
};

export default SignUpPage;
