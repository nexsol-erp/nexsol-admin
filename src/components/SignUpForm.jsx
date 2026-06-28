import React, { useState } from "react";
import {
  Box, Button, TextField, Typography, InputAdornment, Alert, IconButton,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LockIcon from "@mui/icons-material/Lock";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const SignUpForm = ({ onSignUp, onClose, onLogin }) => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState({
    general: "", username: "", email: "",
    mobileNumber: "", password: "", confirmPassword: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    const mobileRegex = /^[0-9]+$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^\S{6,}$/;
    const usernameRegex = /^\S+$/;

    const newError = {
      general: "", username: "", email: "",
      mobileNumber: "", password: "", confirmPassword: "",
    };
    let hasError = false;

    if (!username) {
      newError.username = "Username is required."; hasError = true;
    } else if (!usernameRegex.test(username)) {
      newError.username = "Username cannot contain spaces."; hasError = true;
    }

    if (!email) {
      newError.email = "Email is required."; hasError = true;
    } else if (!emailRegex.test(email)) {
      newError.email = "Enter a valid email address."; hasError = true;
    }

    if (!mobileNumber) {
      newError.mobileNumber = "Mobile number is required."; hasError = true;
    } else if (!mobileRegex.test(mobileNumber)) {
      newError.mobileNumber = "Digits only, no spaces or dashes."; hasError = true;
    }

    if (!passwordRegex.test(password)) {
      newError.password = "At least 6 characters, no spaces."; hasError = true;
    }

    if (password !== confirmPassword) {
      newError.confirmPassword = "Passwords do not match."; hasError = true;
    }

    setError(newError);
    if (hasError) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, mobileNumber, password }),
      });
      const data = await response.json();
      if (data.success) {
        // Auto-login with the same credentials so user goes straight into the wizard
        try {
          const loginRes = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });
          const loginData = await loginRes.json();
          if (loginData.success) {
            localStorage.setItem("jwtToken", loginData.token);
            localStorage.setItem("tenancyId", loginData.tenancyId);
            localStorage.setItem("roles", JSON.stringify(loginData.roles || []));
            localStorage.setItem("setupCompleted", loginData.setupCompleted === false ? "false" : "true");
            try {
              const parts = loginData.token.split(".");
              const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
              localStorage.setItem("allowedBranches", JSON.stringify(payload.branches || []));
            } catch { /* non-fatal */ }
            onLogin?.(loginData.roles || []);
            return; // app state update triggers navigation — no need to close modal
          }
        } catch { /* auto-login failed — fall through to manual login */ }
        // Signup succeeded but auto-login failed; close modal and let user log in manually
        onSignUp?.();
      } else {
        setError(prev => ({ ...prev, general: data.message || "Signup failed. Please try again." }));
      }
    } catch {
      setError(prev => ({ ...prev, general: "Network error. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldSx = {
    mb: 0.5,
    "& .MuiOutlinedInput-root": {
      backgroundColor: "#f4f6fb",
      borderRadius: "10px",
      "& fieldset": { borderColor: "#dde3f0" },
      "&:hover fieldset": { borderColor: "#7986cb" },
      "&.Mui-focused fieldset": { borderColor: "#3f51b5", borderWidth: 2 },
    },
    "& .MuiInputLabel-root": { color: "#6b7280", fontSize: "0.875rem" },
    "& .MuiInputLabel-root.Mui-focused": { color: "#3f51b5" },
    "& input": { color: "#111827", fontSize: "0.9rem" },
    "& .MuiInputAdornment-root svg": { color: "#9ca3af", fontSize: "1.1rem" },
    "&:focus-within .MuiInputAdornment-root svg": { color: "#3f51b5" },
  };

  return (
    <Box>
      {/* ── Gradient header ───────────────────────────────────────── */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #141a2e 0%, #1a3a6c 55%, #2d5be3 100%)",
          px: 3, pt: 3, pb: 3.5,
          position: "relative",
          textAlign: "center",
        }}
      >
        {onClose && (
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              position: "absolute", top: 10, right: 10,
              color: "rgba(255,255,255,0.7)",
              "&:hover": { color: "#fff", bgcolor: "rgba(255,255,255,0.15)" },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}

        {/* Icon badge */}
        <Box
          sx={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #ffe3a3 0%, #ffb347 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            mx: "auto", mb: 1.5,
            boxShadow: "0 4px 16px rgba(255,179,71,0.45)",
          }}
        >
          <RocketLaunchIcon sx={{ color: "#141a2e", fontSize: 28 }} />
        </Box>

        <Typography variant="h5" sx={{ color: "#fff", fontWeight: 700, letterSpacing: "0.3px" }}>
          Create Your Account
        </Typography>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)", mt: 0.5, fontSize: "0.82rem" }}>
          Your ERP workspace will be ready in minutes
        </Typography>
      </Box>

      {/* ── Form body ─────────────────────────────────────────────── */}
      <Box sx={{ px: 3, pt: 2.5, pb: 2 }}>
        {error.general && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: "8px", fontSize: "0.82rem" }}>
            {error.general}
          </Alert>
        )}

        <form onSubmit={handleSubmit} autoComplete="off">
          <TextField
            label="Username" fullWidth size="small" sx={fieldSx}
            value={username} onChange={e => setUsername(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PersonIcon /></InputAdornment>,
            }}
          />
          {error.username && <Typography sx={{ color: "#e53e3e", fontSize: "0.75rem", mb: 0.5, ml: 0.5 }}>{error.username}</Typography>}

          <TextField
            label="Email" type="email" fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}
            value={email} onChange={e => setEmail(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><EmailIcon /></InputAdornment>,
            }}
          />
          {error.email && <Typography sx={{ color: "#e53e3e", fontSize: "0.75rem", mb: 0.5, ml: 0.5 }}>{error.email}</Typography>}

          <TextField
            label="Mobile Number" type="tel" fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}
            value={mobileNumber} onChange={e => setMobileNumber(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><PhoneIcon /></InputAdornment>,
            }}
          />
          {error.mobileNumber && <Typography sx={{ color: "#e53e3e", fontSize: "0.75rem", mb: 0.5, ml: 0.5 }}>{error.mobileNumber}</Typography>}

          <TextField
            label="Password" type={showPassword ? "text" : "password"} fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}
            value={password} onChange={e => setPassword(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword(v => !v)} sx={{ color: "#9ca3af" }}>
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {error.password && <Typography sx={{ color: "#e53e3e", fontSize: "0.75rem", mb: 0.5, ml: 0.5 }}>{error.password}</Typography>}

          <TextField
            label="Confirm Password" type={showConfirm ? "text" : "password"} fullWidth size="small" sx={{ ...fieldSx, mt: 1.5 }}
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowConfirm(v => !v)} sx={{ color: "#9ca3af" }}>
                    {showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {error.confirmPassword && <Typography sx={{ color: "#e53e3e", fontSize: "0.75rem", mb: 0.5, ml: 0.5 }}>{error.confirmPassword}</Typography>}

          <Button
            type="submit" fullWidth disabled={submitting}
            sx={{
              mt: 2.5, py: 1.25,
              background: submitting
                ? "#9ca3af"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: "#fff",
              textTransform: "none",
              letterSpacing: "0.3px",
              boxShadow: "0 4px 14px rgba(102,126,234,0.45)",
              "&:hover:not(:disabled)": {
                background: "linear-gradient(135deg, #5a6fd6 0%, #6a3f96 100%)",
                boxShadow: "0 6px 20px rgba(102,126,234,0.55)",
                transform: "translateY(-1px)",
              },
              "&:active": { transform: "translateY(0)" },
              transition: "all 0.2s ease",
            }}
          >
            {submitting ? "Creating account…" : "Get Started →"}
          </Button>
        </form>

        <Typography
          variant="caption"
          sx={{ color: "#9ca3af", display: "block", textAlign: "center", mt: 2, lineHeight: 1.5 }}
        >
          By signing up you agree to our Terms of Service and Privacy Policy
        </Typography>
      </Box>
    </Box>
  );
};

export default SignUpForm;
