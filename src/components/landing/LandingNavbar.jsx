import React, { useState } from "react";
import {
  AppBar, Toolbar, Typography, Button, Box, Container,
  IconButton, Drawer, List, ListItem, ListItemButton,
  ListItemText, Divider, useScrollTrigger,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { label: "Home", href: "home" },
  { label: "Features", href: "features" },
  { label: "Industries", href: "industries" },
  { label: "Pricing", href: "/pricing", isRoute: true },
  { label: "Partner", href: "/partner", isRoute: true },
  { label: "Contact", href: "contact" },
];

const LandingNavbar = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const scrolled = useScrollTrigger({ disableHysteresis: true, threshold: 60 });

  const scrollTo = (id) => {
    if (location.pathname === "/") {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate("/", { state: { scrollTo: id } });
    }
    setDrawerOpen(false);
  };

  const handleNavClick = (link) => {
    if (link.isRoute) {
      navigate(link.href);
      setDrawerOpen(false);
    } else {
      scrollTo(link.href);
    }
  };

  const logoColor = scrolled ? "#1e40af" : "#ffffff";
  const navTextColor = scrolled ? "#475569" : "rgba(255,255,255,0.92)";

  return (
    <>
      <AppBar
        position="fixed"
        elevation={scrolled ? 2 : 0}
        sx={{
          bgcolor: scrolled ? "rgba(255,255,255,0.97)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid #e2e8f0" : "none",
          transition: "all 0.35s ease",
        }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ py: { xs: 0.5, md: 1 } }}>
            {/* Logo */}
            <Box
              onClick={() => scrollTo("home")}
              sx={{ display: "flex", alignItems: "center", cursor: "pointer", flexGrow: 1 }}
            >
              <Box
                sx={{
                  width: 38, height: 38, borderRadius: "10px",
                  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  mr: 1.5, boxShadow: "0 4px 12px rgba(59,130,246,0.45)",
                }}
              >
                <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>T</Typography>
              </Box>
              <Typography
                sx={{
                  fontWeight: 800, fontSize: { xs: 18, md: 22 },
                  color: logoColor, letterSpacing: "-0.5px",
                  transition: "color 0.3s",
                }}
              >
                Tradelink<span style={{ color: "#3b82f6" }}>247</span>
              </Typography>
            </Box>

            {/* Desktop nav links */}
            <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5, mr: 2 }}>
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.label}
                  onClick={() => handleNavClick(link)}
                  sx={{
                    color: navTextColor, fontWeight: 500, fontSize: 14, px: 1.8,
                    textTransform: "none", transition: "color 0.2s",
                    "&:hover": { color: "#3b82f6", bgcolor: "transparent" },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Box>

            {/* Desktop CTA buttons */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => navigate("/login")}
                sx={{
                  borderColor: scrolled ? "#3b82f6" : "rgba(255,255,255,0.6)",
                  color: scrolled ? "#3b82f6" : "#fff",
                  fontWeight: 600, borderRadius: "9px", px: 2.5,
                  textTransform: "none", fontSize: 14,
                  "&:hover": { borderColor: "#3b82f6", bgcolor: "rgba(59,130,246,0.07)" },
                }}
              >
                Login
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate("/signup")}
                sx={{
                  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                  color: "#fff", fontWeight: 600, borderRadius: "9px", px: 2.5,
                  textTransform: "none", fontSize: 14,
                  boxShadow: "0 4px 14px rgba(59,130,246,0.4)",
                  "&:hover": { opacity: 0.9, boxShadow: "0 6px 18px rgba(59,130,246,0.5)" },
                }}
              >
                Sign Up
              </Button>
            </Box>

            {/* Mobile hamburger */}
            <IconButton
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { md: "none" }, color: scrolled ? "#1e293b" : "#fff" }}
            >
              <MenuIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 290 } }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: "#1e40af" }}>
              Tradelink<span style={{ color: "#3b82f6" }}>247</span>
            </Typography>
            <IconButton onClick={() => setDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <List disablePadding>
            {NAV_LINKS.map((link) => (
              <ListItem key={link.label} disablePadding>
                <ListItemButton onClick={() => handleNavClick(link)} sx={{ borderRadius: "8px" }}>
                  <ListItemText
                    primary={link.label}
                    primaryTypographyProps={{ fontWeight: 500, color: "#334155" }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button
              fullWidth variant="outlined"
              onClick={() => { navigate("/login"); setDrawerOpen(false); }}
              sx={{ borderRadius: "9px", textTransform: "none", fontWeight: 600, borderColor: "#3b82f6", color: "#3b82f6" }}
            >
              Login
            </Button>
            <Button
              fullWidth variant="contained"
              onClick={() => { navigate("/signup"); setDrawerOpen(false); }}
              sx={{
                borderRadius: "9px", textTransform: "none", fontWeight: 600,
                background: "linear-gradient(135deg, #1e40af, #3b82f6)",
              }}
            >
              Sign Up Free
            </Button>
          </Box>
        </Box>
      </Drawer>
    </>
  );
};

export default LandingNavbar;
