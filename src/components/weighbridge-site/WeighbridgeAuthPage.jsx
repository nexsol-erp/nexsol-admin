import React, { useEffect, useState } from "react";
import {
  Box, Button, Paper, TextField, Typography, Alert, InputAdornment, IconButton, Link, CssBaseline,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useNavigate } from "react-router-dom";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ScaleIcon from "@mui/icons-material/Scale";
import HubIcon from "@mui/icons-material/Hub";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SignUpForm from "../SignUpForm";
import { WB, BASE, WbLogo } from "./WbChrome";

const lightTheme = createTheme({ palette: { mode: "light", primary: { main: WB.navy } } });

function decodeJwtPayload(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

const PLANS = [
  {
    product: "WEIGHBRIDGE",
    icon: ScaleIcon,
    title: "Weighbridge only",
    tag: "Simple",
    text: "Just the weighbridge: the Windows app at the bridge and the weighbridge screens on the web.",
    points: ["Weighings, photos and reports online", "Rates and PCs managed from the web", "Add the ERP any time later"],
  },
  {
    product: "ERP",
    icon: HubIcon,
    title: "ERP + Weighbridge",
    tag: "Complete",
    text: "The full TradeLink247 ERP with the weighbridge built in.",
    points: ["Billing, POS, purchases and inventory", "Accounts, GST and reports", "Guided setup wizard after sign-up"],
  },
];

const Shell = ({ children, wide = false }) => {
  const navigate = useNavigate();
  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          background: `radial-gradient(900px 400px at 90% 0%, rgba(22,193,114,0.16), transparent 60%), linear-gradient(160deg, ${WB.navyDeep} 0%, ${WB.navy} 60%, #12407e 100%)`,
          display: "flex", flexDirection: "column", alignItems: "center",
          px: 2, py: { xs: 4, md: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: wide ? 820 : 440 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
            <WbLogo light onClick={() => navigate(BASE)} />
            <Button onClick={() => navigate(BASE)} startIcon={<ArrowBackIcon />} sx={{ color: "rgba(255,255,255,0.75)", textTransform: "none" }}>
              Back
            </Button>
          </Box>
          {children}
          <Typography sx={{ mt: 3, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
            © {new Date().getFullYear()} TradeLink247. All rights reserved.
          </Typography>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

const fieldSx = {
  "& .MuiOutlinedInput-root": { borderRadius: "10px", bgcolor: "#f5f8fd" },
};

const WeighbridgeLogin = ({ onLogin }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setError(data.message || "Wrong username or password.");
        return;
      }
      if (data.needsTenantSelection) {
        localStorage.setItem("partialToken", data.token);
        localStorage.setItem("pendingTenants", JSON.stringify(data.accessibleTenants || []));
        navigate("/tenant-select");
        return;
      }
      localStorage.setItem("jwtToken", data.token);
      localStorage.setItem("tenancyId", data.tenancyId);
      localStorage.setItem("roles", JSON.stringify(data.roles || []));
      localStorage.setItem("setupCompleted", data.setupCompleted !== false ? "true" : "false");
      const payload = decodeJwtPayload(data.token);
      localStorage.setItem("allowedBranches", JSON.stringify(Array.isArray(payload?.branches) ? payload.branches : []));
      onLogin?.(data.roles || []);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <Paper elevation={24} sx={{ borderRadius: "18px", p: { xs: 3, sm: 4 } }}>
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: 24, color: WB.ink }}>Sign in to Weighbridge</Typography>
        <Typography sx={{ color: WB.muted, fontSize: 14.5, mt: 0.5, mb: 3 }}>
          Use the same username and password as the weighbridge app.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>{error}</Alert>}
        <form onSubmit={submit}>
          <TextField
            label="Username" fullWidth autoFocus autoComplete="username" sx={{ ...fieldSx, mb: 2 }}
            value={username} onChange={(e) => setUsername(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon sx={{ color: WB.blue }} /></InputAdornment> }}
          />
          <TextField
            label="Password" type={show ? "text" : "password"} fullWidth autoComplete="current-password" sx={fieldSx}
            value={password} onChange={(e) => setPassword(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><LockIcon sx={{ color: WB.blue }} /></InputAdornment>,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton aria-label={show ? "Hide password" : "Show password"} size="small" onClick={() => setShow((v) => !v)}>
                    {show ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit" fullWidth disabled={busy}
            sx={{ mt: 3, py: 1.3, borderRadius: "10px", fontWeight: 800, fontSize: 16, textTransform: "none", bgcolor: WB.green, color: WB.navyDeep, "&:hover": { bgcolor: "#13ad66" } }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Paper>
      <Typography sx={{ mt: 3, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
        New to TradeLink247?{" "}
        <Link component="button" onClick={() => navigate(`${BASE}/signup`)} sx={{ color: WB.green, fontWeight: 700 }}>
          Create an account
        </Link>
      </Typography>
    </Shell>
  );
};

const WeighbridgeSignUp = ({ onLogin }) => {
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const plan = PLANS.find((p) => p.product === product);

  if (!plan) {
    return (
      <Shell wide>
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 32 }, color: "#fff", textAlign: "center" }}>
          What do you need?
        </Typography>
        <Typography sx={{ color: "rgba(255,255,255,0.7)", textAlign: "center", mt: 1, mb: 4 }}>
          Pick one to create your account. You can add the ERP later.
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2.5 }}>
          {PLANS.map((p) => {
            const Icon = p.icon;
            return (
              <Paper
                key={p.product}
                component="button"
                type="button"
                onClick={() => setProduct(p.product)}
                elevation={0}
                sx={{
                  textAlign: "left", p: 3, borderRadius: "16px", cursor: "pointer", font: "inherit",
                  border: "2px solid transparent", transition: "all 0.2s",
                  "&:hover, &:focus-visible": { borderColor: WB.green, transform: "translateY(-2px)", boxShadow: "0 16px 40px rgba(0,0,0,0.3)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Box sx={{ width: 48, height: 48, borderRadius: "12px", bgcolor: "rgba(29,95,191,0.09)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon sx={{ color: WB.blue, fontSize: 28 }} />
                  </Box>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: WB.greenDark, bgcolor: "rgba(22,193,114,0.12)", px: 1.2, py: 0.4, borderRadius: "20px" }}>{p.tag}</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, fontSize: 20, color: WB.ink }}>{p.title}</Typography>
                <Typography sx={{ color: WB.muted, fontSize: 14.5, mt: 0.8, mb: 2, lineHeight: 1.55 }}>{p.text}</Typography>
                {p.points.map((pt) => (
                  <Box key={pt} sx={{ display: "flex", gap: 1, alignItems: "center", fontSize: 14, color: WB.ink, mb: 0.8 }}>
                    <CheckCircleIcon sx={{ color: WB.green, fontSize: 18 }} /> {pt}
                  </Box>
                ))}
                <Typography sx={{ mt: 2, fontWeight: 700, color: WB.blue, fontSize: 15 }}>Choose {p.title} →</Typography>
              </Paper>
            );
          })}
        </Box>
        <Typography sx={{ mt: 3, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
          Already have an account?{" "}
          <Link component="button" onClick={() => navigate(`${BASE}/login`)} sx={{ color: WB.green, fontWeight: 700 }}>
            Sign in
          </Link>
        </Typography>
      </Shell>
    );
  }

  const weighbridgeOnly = plan.product === "WEIGHBRIDGE";
  return (
    <Shell>
      <Paper elevation={24} sx={{ borderRadius: "18px", overflow: "hidden" }}>
        <SignUpForm
          product={plan.product}
          askCompany
          heading={weighbridgeOnly ? "Create your weighbridge account" : "Create your ERP + Weighbridge account"}
          subheading={weighbridgeOnly
            ? "Next you'll download the app and set up the weighbridge PC"
            : "Next, the setup wizard walks you through your company"}
          submitLabel="Create account"
          onClose={() => setProduct(null)}
          onLogin={(roles) => onLogin?.(roles)}
          onSignUp={() => navigate(`${BASE}/login`)}
        />
      </Paper>
      <Typography sx={{ mt: 3, textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
        Wrong choice?{" "}
        <Link component="button" onClick={() => setProduct(null)} sx={{ color: WB.green, fontWeight: 700 }}>
          Go back
        </Link>
      </Typography>
    </Shell>
  );
};

const WeighbridgeAuthPage = ({ mode = "login", onLogin }) => {
  useEffect(() => {
    document.title = mode === "signup" ? "Sign up | TradeLink247 Weighbridge" : "Sign in | TradeLink247 Weighbridge";
  }, [mode]);
  return mode === "signup" ? <WeighbridgeSignUp onLogin={onLogin} /> : <WeighbridgeLogin onLogin={onLogin} />;
};

export default WeighbridgeAuthPage;
