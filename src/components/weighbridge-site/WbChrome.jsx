import React, { useState } from "react";
import {
  AppBar, Toolbar, Box, Button, Container, Typography, IconButton, Drawer,
  List, ListItemButton, ListItemText, Divider, useScrollTrigger,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import ScaleIcon from "@mui/icons-material/Scale";
import { useNavigate, useLocation } from "react-router-dom";

// Shared look for the public weighbridge pages: navy like the desktop app's header, with the
// indicator's green as the accent.
export const WB = {
  navy: "#0b2f5e",
  navyDeep: "#071d3b",
  blue: "#1d5fbf",
  green: "#16c172",
  greenDark: "#0e8f53",
  ink: "#0f172a",
  muted: "#475569",
  line: "#e2e8f0",
  soft: "#f4f7fb",
};

export const BASE = "/weighbridge-software";

const LINKS = [
  { label: "Features", id: "features" },
  { label: "Screenshots", id: "screenshots" },
  { label: "Compare", id: "compare" },
  { label: "Roadmap", id: "roadmap" },
];

export const WbLogo = ({ light = false, onClick }) => (
  <Box onClick={onClick} sx={{ display: "flex", alignItems: "center", gap: 1.2, cursor: onClick ? "pointer" : "default" }}>
    <Box
      sx={{
        width: 38, height: 38, borderRadius: "10px", flexShrink: 0,
        background: `linear-gradient(135deg, ${WB.navy} 0%, ${WB.blue} 100%)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(29,95,191,0.4)",
      }}
    >
      <ScaleIcon sx={{ color: WB.green, fontSize: 22 }} />
    </Box>
    <Box sx={{ lineHeight: 1 }}>
      <Typography sx={{ fontWeight: 800, fontSize: { xs: 16, md: 18 }, color: light ? "#fff" : WB.ink, letterSpacing: "-0.3px", lineHeight: 1.1 }}>
        TradeLink<span style={{ color: light ? "#7fb2ff" : WB.blue }}>247</span>
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 11, letterSpacing: "1.6px", color: light ? WB.green : WB.greenDark, textTransform: "uppercase" }}>
        Weighbridge
      </Typography>
    </Box>
  </Box>
);

export const WbNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 40 });
  const onLanding = location.pathname === BASE;
  const solid = scrolled || !onLanding;

  const go = (id) => {
    setOpen(false);
    if (onLanding) {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(BASE, { state: { scrollTo: id } });
    }
  };

  return (
    <>
      <AppBar
        position="fixed"
        elevation={solid ? 2 : 0}
        sx={{
          bgcolor: solid ? "rgba(255,255,255,0.97)" : "transparent",
          backdropFilter: solid ? "blur(14px)" : "none",
          borderBottom: solid ? `1px solid ${WB.line}` : "none",
          transition: "all 0.3s ease",
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1 }}>
            <Box sx={{ flexGrow: 1 }}>
              <WbLogo light={!solid} onClick={() => (onLanding ? go("top") : navigate(BASE))} />
            </Box>
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, mr: 1 }}>
              {LINKS.map((l) => (
                <Button
                  key={l.id}
                  onClick={() => go(l.id)}
                  sx={{ textTransform: "none", fontWeight: 500, color: solid ? WB.muted : "rgba(255,255,255,0.9)", "&:hover": { color: WB.green, bgcolor: "transparent" } }}
                >
                  {l.label}
                </Button>
              ))}
            </Box>
            <Button
              onClick={() => navigate(`${BASE}/login`)}
              variant="outlined"
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                textTransform: "none", fontWeight: 600, borderRadius: "9px",
                color: solid ? WB.navy : "#fff", borderColor: solid ? WB.navy : "rgba(255,255,255,0.6)",
              }}
            >
              Sign in
            </Button>
            <Button
              onClick={() => navigate(`${BASE}/signup`)}
              variant="contained"
              sx={{
                display: { xs: "none", sm: "inline-flex" },
                textTransform: "none", fontWeight: 700, borderRadius: "9px",
                bgcolor: WB.green, color: WB.navyDeep, boxShadow: "none",
                "&:hover": { bgcolor: "#13ad66", boxShadow: "none" },
              }}
            >
              Start free
            </Button>
            <IconButton aria-label="Open menu" onClick={() => setOpen(true)} sx={{ display: { md: "none" }, color: solid ? WB.ink : "#fff" }}>
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: 270, p: 2 } }}>
        <WbLogo />
        <Divider sx={{ my: 2 }} />
        <List disablePadding>
          {LINKS.map((l) => (
            <ListItemButton key={l.id} onClick={() => go(l.id)} sx={{ borderRadius: "8px" }}>
              <ListItemText primary={l.label} />
            </ListItemButton>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Button fullWidth variant="outlined" onClick={() => navigate(`${BASE}/login`)} sx={{ mb: 1.5, textTransform: "none", fontWeight: 600 }}>
          Sign in
        </Button>
        <Button fullWidth variant="contained" onClick={() => navigate(`${BASE}/signup`)} sx={{ textTransform: "none", fontWeight: 700, bgcolor: WB.green, color: WB.navyDeep, "&:hover": { bgcolor: "#13ad66" } }}>
          Start free
        </Button>
      </Drawer>
    </>
  );
};

export const WbFooter = () => {
  const navigate = useNavigate();
  return (
    <Box component="footer" sx={{ bgcolor: WB.navyDeep, color: "rgba(255,255,255,0.7)", py: 5 }}>
      <Container maxWidth="lg">
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "space-between", alignItems: "center" }}>
          <WbLogo light onClick={() => navigate(BASE)} />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, fontSize: 14 }}>
            {[
              ["TradeLink247 ERP", "/"],
              ["Pricing", "/pricing"],
              ["Privacy", "/privacy-policy"],
              ["Terms", "/terms-and-conditions"],
              ["Refunds", "/refund-policy"],
            ].map(([label, to]) => (
              <Box
                key={to}
                component="a"
                href={to}
                onClick={(e) => { e.preventDefault(); navigate(to); }}
                sx={{ color: "inherit", textDecoration: "none", "&:hover": { color: "#fff" } }}
              >
                {label}
              </Box>
            ))}
          </Box>
        </Box>
        <Typography sx={{ mt: 3, fontSize: 12.5, color: "rgba(255,255,255,0.45)" }}>
          © {new Date().getFullYear()} TradeLink247. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};
