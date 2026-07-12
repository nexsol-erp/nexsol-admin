import React, { useState, useEffect } from "react";
import {
  Box, Typography, Button, Paper, Chip, CircularProgress, Alert,
} from "@mui/material";
import {
  Business as BusinessIcon,
  Store as FranchiseIcon,
  ChevronRight,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const decodeJwtPayload = (token) => {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=")));
  } catch { return null; }
};

const TenantSelectorPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [tenants, setTenants]   = useState([]);
  const [selecting, setSelecting] = useState(null); // tenantId currently being selected
  const [error, setError]       = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem("pendingTenants");
    if (raw) {
      try { setTenants(JSON.parse(raw)); } catch { setTenants([]); }
    }
  }, []);

  const handleSelect = async (tenantId) => {
    setSelecting(tenantId);
    setError(null);
    const partialToken = localStorage.getItem("partialToken");

    try {
      const res = await fetch("/api/auth/select-tenant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${partialToken}`,
        },
        body: JSON.stringify({ tenantId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || data.message || "Selection failed");
        return;
      }

      // Store final session
      localStorage.setItem("jwtToken",   data.token);
      localStorage.setItem("tenancyId",  data.tenancyId);
      localStorage.setItem("roles",      JSON.stringify(data.roles || []));
      localStorage.setItem("setupCompleted", data.setupCompleted !== false ? "true" : "false");

      const payload = decodeJwtPayload(data.token);
      localStorage.setItem("allowedBranches",
        JSON.stringify(payload?.branches || []));

      // Clean up temporary state
      localStorage.removeItem("partialToken");
      localStorage.removeItem("pendingTenants");

      onLogin?.(data.roles || []);

    } catch (e) {
      setError(e.message || "Network error");
    } finally {
      setSelecting(null);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh", width: "100vw",
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        p: 2,
      }}
    >
      {/* Glowing orbs */}
      {[
        { top: "8%",  left: "-6%",  size: 380, color: "rgba(59,130,246,0.18)" },
        { top: "55%", right: "-5%", size: 320, color: "rgba(139,92,246,0.15)" },
      ].map((o, i) => (
        <Box key={i} sx={{
          position: "absolute", borderRadius: "50%",
          width: o.size, height: o.size, bgcolor: o.color, filter: "blur(80px)",
          top: o.top, left: o.left, right: o.right, pointerEvents: "none",
        }} />
      ))}

      <Paper
        elevation={24}
        sx={{
          width: { xs: "92vw", sm: 480 },
          background: "linear-gradient(160deg, #0f172a 0%, #1e3a8a 100%)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "20px",
          overflow: "hidden",
          position: "relative", zIndex: 1,
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3.5, pt: 3.5, pb: 2.5, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: "10px",
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(59,130,246,0.45)",
            }}>
              <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>T</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#fff", lineHeight: 1.1 }}>
                Tradelink<span style={{ color: "#60a5fa" }}>247</span>
              </Typography>
              <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
                Cloud ERP & POS
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Body */}
        <Box sx={{ px: 3.5, py: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 22, color: "#fff", mb: 0.5 }}>
            Select Company
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", mb: 3 }}>
            You have access to multiple companies. Select one to continue.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: "10px" }}>{error}</Alert>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {tenants.map((t) => {
              const isFranchise = t.tenantType === "FRANCHISE";
              const isLoading   = selecting === t.tenantId;
              return (
                <Button
                  key={t.tenantId}
                  variant="outlined"
                  fullWidth
                  disabled={!!selecting}
                  onClick={() => handleSelect(t.tenantId)}
                  sx={{
                    justifyContent: "flex-start",
                    py: 1.8, px: 2.5,
                    borderRadius: "12px",
                    borderColor: "rgba(255,255,255,0.18)",
                    bgcolor: "rgba(255,255,255,0.05)",
                    color: "#fff",
                    textTransform: "none",
                    "&:hover": {
                      borderColor: "#3b82f6",
                      bgcolor: "rgba(59,130,246,0.12)",
                    },
                    "&.Mui-disabled": { opacity: 0.6 },
                  }}
                >
                  <Box sx={{ mr: 1.5, color: isFranchise ? "#a78bfa" : "#60a5fa" }}>
                    {isFranchise ? <FranchiseIcon /> : <BusinessIcon />}
                  </Box>
                  <Box sx={{ flex: 1, textAlign: "left" }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>
                      {t.tenantName || t.tenantId}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.8, mt: 0.4 }}>
                      <Chip
                        label={isFranchise ? "Franchise" : "Central"}
                        size="small"
                        sx={{
                          height: 18, fontSize: 10, fontWeight: 600,
                          bgcolor: isFranchise ? "rgba(167,139,250,0.2)" : "rgba(96,165,250,0.2)",
                          color: isFranchise ? "#a78bfa" : "#60a5fa",
                          border: "none",
                        }}
                      />
                      <Chip
                        label={t.role}
                        size="small"
                        sx={{
                          height: 18, fontSize: 10,
                          bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
                          border: "none",
                        }}
                      />
                    </Box>
                  </Box>
                  {isLoading
                    ? <CircularProgress size={18} sx={{ color: "#60a5fa" }} />
                    : <ChevronRight sx={{ color: "rgba(255,255,255,0.4)" }} />
                  }
                </Button>
              );
            })}
          </Box>

          <Typography sx={{ mt: 3, textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.35)" }}>
            Contact your administrator to request access to additional companies.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default TenantSelectorPage;
