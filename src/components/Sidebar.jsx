import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Switch,
  Drawer,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Typography,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
} from "@mui/material";
import {
  ExitToApp,
  ExpandLess,
  ExpandMore,
  ModeNightRounded,
  Refresh,
  LockReset,
} from "@mui/icons-material";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBranch } from "./BranchContext";
import { useMenuAccess } from "./MenuAccessContext";
import { MENU_TREE } from "../menuCatalog";
import { rememberRecentMenu } from "./GlobalMenuSearch";

const DRAWER_WIDTH = 240;

const C = {
  bg: "#1a2038",
  headerBg: "#141a2e",
  activeBg: "rgba(255,227,163,0.10)",
  activeBorder: "#ffe3a3",
  hover: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.85)",
  textMuted: "rgba(255,255,255,0.35)",
  textActive: "#ffe3a3",
  icon: "rgba(255,227,163,0.60)",
  divider: "rgba(255,255,255,0.07)",
  subLine: "rgba(255,227,163,0.18)",
};

const Sidebar = ({ mode, setMode, roles = [], mobileOpen, setMobileOpen }) => {
  const { t } = useTranslation();
  const location = useLocation();

  const { branch: selectedBranch, setBranch: setSelectedBranch, branches } = useBranch();

  // Menu permissions are shared with the top-bar search via MenuAccessContext.
  const { loading: menuLoading, isSystemAdmin, usingAssignments, isMenuAllowed, refresh: refreshMenus } =
    useMenuAccess();

  const [openMenus, setOpenMenus] = useState({});

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
  };

  const handleLogout = () => {
    localStorage.removeItem("jwtToken");
    localStorage.removeItem("partialToken");
    localStorage.removeItem("roles");
    localStorage.removeItem("tenancyId");
    localStorage.removeItem("branchCode");
    localStorage.removeItem("allowedBranches");
    localStorage.removeItem("pendingTenants");
    localStorage.removeItem("setupCompleted");
    window.location.href = "/login";
  };

  const handleRefresh = () => {
    localStorage.removeItem("items");
    localStorage.removeItem("categories");
    refreshMenus();
  };

  // ── Change password dialog ──────────────────────────────────────────────
  const [pwOpen, setPwOpen]             = useState(false);
  const [pwCurrent, setPwCurrent]       = useState("");
  const [pwNew, setPwNew]               = useState("");
  const [pwConfirm, setPwConfirm]       = useState("");
  const [pwLoading, setPwLoading]       = useState(false);
  const [pwError, setPwError]           = useState("");
  const [pwSuccess, setPwSuccess]       = useState("");

  const openPwDialog = () => {
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
    setPwError(""); setPwSuccess("");
    setPwOpen(true);
  };

  const handleChangePassword = async () => {
    if (pwNew !== pwConfirm) { setPwError("New passwords do not match"); return; }
    if (pwNew.length < 4)    { setPwError("New password must be at least 4 characters"); return; }
    setPwLoading(true);
    setPwError("");
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token     = localStorage.getItem("jwtToken");
      const res = await fetch(`/api/${tenancyId}/change-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (data.success) {
        setPwSuccess("Password changed successfully. Please log in again.");
        setTimeout(() => { localStorage.removeItem("jwtToken"); window.location.reload(); }, 2000);
      } else {
        setPwError(data.message || "Failed to change password");
      }
    } catch {
      setPwError("Network error. Please try again.");
    } finally {
      setPwLoading(false);
    }
  };

  const toggleMenu = (idx) =>
    setOpenMenus((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const handleNavClick = (link) => {
    rememberRecentMenu(link);
    setMobileOpen(false);
  };

  const isActive = (link) => !!link && location.pathname === link;

  // Menu tree comes from the shared catalog (src/menuCatalog.js) so the
  // sidebar, the top-bar search and the menu map can never drift apart.
  const menuItems = useMemo(
    () =>
      MENU_TREE.map((item) => ({
        ...item,
        label: t(item.label),
        submenu: item.submenu?.map((sub) => ({ ...sub, label: t(sub.label) })),
      })),
    [t]
  );

  // Auto-open submenus that contain the active route
  useEffect(() => {
    menuItems.forEach((item, idx) => {
      if (item.hasSubmenu && item.submenu?.some((s) => s.link === location.pathname)) {
        setOpenMenus((prev) => ({ ...prev, [idx]: true }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const itemButtonSx = (link) => ({
    px: 2,
    py: 0.85,
    minHeight: 40,
    borderLeft: isActive(link) ? `3px solid ${C.activeBorder}` : "3px solid transparent",
    bgcolor: isActive(link) ? C.activeBg : "transparent",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
    "& .MuiListItemIcon-root": {
      color: isActive(link) ? C.textActive : C.icon,
      minWidth: 36,
      transition: "color 0.15s ease",
    },
    "& .MuiListItemText-primary": {
      fontSize: 13.5,
      fontWeight: isActive(link) ? 600 : 400,
      color: isActive(link) ? C.textActive : C.text,
      lineHeight: 1.4,
    },
    "&:hover": {
      bgcolor: isActive(link) ? C.activeBg : C.hover,
      "& .MuiListItemIcon-root": { color: C.textActive },
      "& .MuiListItemText-primary": { color: C.textActive },
    },
  });

  const parentButtonSx = (isOpen, hasActive) => ({
    px: 2,
    py: 0.85,
    minHeight: 40,
    borderLeft: hasActive ? `3px solid ${C.activeBorder}` : "3px solid transparent",
    bgcolor: hasActive ? C.activeBg : "transparent",
    transition: "background-color 0.15s ease",
    "& .MuiListItemIcon-root": {
      color: hasActive ? C.textActive : C.icon,
      minWidth: 36,
    },
    "& .MuiListItemText-primary": {
      fontSize: 13.5,
      fontWeight: hasActive || isOpen ? 600 : 400,
      color: hasActive || isOpen ? C.textActive : C.text,
    },
    "&:hover": {
      bgcolor: hasActive ? C.activeBg : C.hover,
      "& .MuiListItemIcon-root": { color: C.textActive },
      "& .MuiListItemText-primary": { color: C.textActive },
    },
  });

  const subItemButtonSx = (link) => ({
    pl: "44px",
    py: 0.65,
    minHeight: 34,
    bgcolor: isActive(link) ? C.activeBg : "transparent",
    "& .MuiListItemText-primary": {
      fontSize: 12.5,
      fontWeight: isActive(link) ? 600 : 400,
      color: isActive(link) ? C.textActive : "rgba(255,255,255,0.65)",
    },
    "&:hover": {
      bgcolor: C.hover,
      "& .MuiListItemText-primary": { color: C.textActive },
    },
    transition: "background-color 0.15s ease",
  });

  const drawerContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: C.bg }}>

      {/* ── Brand header ───────────────────────────────────────────── */}
      <Box
        sx={{
          px: 2,
          pt: 2.5,
          pb: 2,
          bgcolor: C.headerBg,
          borderBottom: `1px solid ${C.divider}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ffe3a3 0%, #f5a623 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1a2038", lineHeight: 1 }}>
              T
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: C.textActive, lineHeight: 1.2 }}>
              TradeLink 247
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: C.textMuted, letterSpacing: "0.5px" }}>
              Business Suite
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Branch selector ────────────────────────────────────────── */}
      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          borderBottom: `1px solid ${C.divider}`,
          flexShrink: 0,
        }}
      >
        <FormControl fullWidth size="small">
          <Select
            value={selectedBranch}
            onChange={handleBranchChange}
            displayEmpty
            renderValue={(v) =>
              v ? (
                <Typography sx={{ fontSize: 12.5, color: C.textActive }}>{v}</Typography>
              ) : (
                <Typography sx={{ fontSize: 12.5, color: C.textMuted }}>
                  {t("Select Branch")}
                </Typography>
              )
            }
            sx={{
              bgcolor: "rgba(255,255,255,0.05)",
              borderRadius: "8px",
              color: C.textActive,
              fontSize: 12.5,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.12)" },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,227,163,0.4)" },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: C.activeBorder },
              "& .MuiSvgIcon-root": { color: C.textMuted },
            }}
          >
            {branches.map((b) => (
              <MenuItem key={b.branchCode} value={b.branchCode} sx={{ fontSize: 13 }}>
                {t(b.branchCode)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          size="small"
          startIcon={<Refresh sx={{ fontSize: "14px !important" }} />}
          onClick={handleRefresh}
          sx={{
            mt: 1,
            width: "100%",
            fontSize: 11.5,
            color: C.textMuted,
            bgcolor: "rgba(255,255,255,0.04)",
            borderRadius: "8px",
            py: 0.5,
            textTransform: "none",
            letterSpacing: "0.2px",
            border: `1px solid ${C.divider}`,
            "&:hover": { bgcolor: C.hover, color: C.text, borderColor: "rgba(255,255,255,0.15)" },
          }}
        >
          {menuLoading ? t("Refreshing…") : t("Refresh Cache")}
        </Button>
      </Box>

      {/* ── Scrollable menu ────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          pt: 0.5,
          pb: 1,
          "&::-webkit-scrollbar": { width: 3 },
          "&::-webkit-scrollbar-track": { bgcolor: "transparent" },
          "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(255,255,255,0.12)", borderRadius: 4 },
        }}
      >
        <List disablePadding>
          {menuItems.map((item, idx) => {
            // When role-menu assignments are active, they are the sole visibility source.
            // Fall back to hardcoded role arrays only when no assignments are configured.
            if (!isSystemAdmin && !usingAssignments && !item.roles.some((r) => roles.includes(r))) return null;

            if (item.hasSubmenu) {
              const isOpen = !!openMenus[idx];
              const hasActive = item.submenu?.some((s) => isActive(s.link));
              const visibleSubs = item.submenu.filter((s) =>
                isMenuAllowed(s.menuKey, s.roles)
              );
              if (visibleSubs.length === 0) return null;

              return (
                <React.Fragment key={idx}>
                  <ListItemButton
                    onClick={() => toggleMenu(idx)}
                    sx={parentButtonSx(isOpen, hasActive)}
                  >
                    <ListItemIcon>{item.icon ? <item.icon fontSize="small" /> : null}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isOpen ? (
                      <ExpandLess sx={{ fontSize: 16, color: C.textMuted }} />
                    ) : (
                      <ExpandMore sx={{ fontSize: 16, color: C.textMuted }} />
                    )}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <Box
                      sx={{
                        ml: "35px",
                        borderLeft: `1px solid ${C.subLine}`,
                      }}
                    >
                      {visibleSubs.map((sub, sIdx) => (
                        <ListItemButton
                          key={sIdx}
                          component={Link}
                          to={sub.link}
                          onClick={() => handleNavClick(sub.link)}
                          sx={subItemButtonSx(sub.link)}
                        >
                          <ListItemText primary={sub.label} />
                        </ListItemButton>
                      ))}
                    </Box>
                  </Collapse>
                </React.Fragment>
              );
            }

            if (!isMenuAllowed(item.menuKey, item.roles)) return null;
            return (
              <ListItemButton
                key={idx}
                component={Link}
                to={item.link}
                onClick={() => handleNavClick(item.link)}
                sx={itemButtonSx(item.link)}
              >
                <ListItemIcon>{item.icon ? <item.icon fontSize="small" /> : null}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            );
          })}
        </List>
      </Box>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${C.divider}`,
          px: 1,
          pt: 0.75,
          pb: 1,
        }}
      >
        {/* Dark mode toggle */}
        <ListItemButton
          onClick={() => setMode(mode === "light" ? "dark" : "light")}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            mb: 0.5,
            "& .MuiListItemText-primary": { fontSize: 13, color: C.textMuted },
            "&:hover": { bgcolor: C.hover, "& .MuiListItemText-primary": { color: C.text } },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <ModeNightRounded sx={{ fontSize: 18, color: C.icon }} />
          </ListItemIcon>
          <ListItemText primary={t("Dark Mode")} />
          <Switch
            size="small"
            checked={mode === "dark"}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: C.activeBorder },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                bgcolor: "rgba(255,227,163,0.4)",
              },
            }}
          />
        </ListItemButton>

        {/* Change Password */}
        <ListItemButton
          onClick={openPwDialog}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            mb: 0.5,
            "& .MuiListItemText-primary": { fontSize: 13, color: C.textMuted },
            "&:hover": { bgcolor: C.hover, "& .MuiListItemText-primary": { color: C.text } },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <LockReset sx={{ fontSize: 18, color: C.icon }} />
          </ListItemIcon>
          <ListItemText primary={t("Change Password")} />
        </ListItemButton>

        {/* Logout */}
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: "8px",
            px: 1.5,
            py: 0.6,
            "& .MuiListItemText-primary": { fontSize: 13, color: "rgba(255,100,100,0.75)" },
            "&:hover": {
              bgcolor: "rgba(255,80,80,0.08)",
              "& .MuiListItemText-primary": { color: "#ff6b6b" },
              "& .MuiListItemIcon-root": { color: "#ff6b6b" },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 34 }}>
            <ExitToApp sx={{ fontSize: 18, color: "rgba(255,100,100,0.6)" }} />
          </ListItemIcon>
          <ListItemText primary={t("Logout")} />
        </ListItemButton>
      </Box>
    </Box>
  );

  /* ── Change Password Dialog ─────────────────────────────────────────── */
  const pwDialog = (
    <Dialog open={pwOpen} onClose={() => !pwLoading && setPwOpen(false)} maxWidth="xs" fullWidth>
      <DialogTitle>Change Password</DialogTitle>
      <DialogContent>
        {pwError   && <Alert severity="error"   sx={{ mb: 1.5 }}>{pwError}</Alert>}
        {pwSuccess && <Alert severity="success" sx={{ mb: 1.5 }}>{pwSuccess}</Alert>}
        <TextField
          label="Current Password" type="password" fullWidth margin="dense"
          value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
        <TextField
          label="New Password" type="password" fullWidth margin="dense"
          value={pwNew} onChange={(e) => setPwNew(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
        <TextField
          label="Confirm New Password" type="password" fullWidth margin="dense"
          value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)}
          disabled={pwLoading || !!pwSuccess}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPwOpen(false)} disabled={pwLoading}>Cancel</Button>
        <Button
          onClick={handleChangePassword}
          variant="contained"
          disabled={pwLoading || !!pwSuccess || !pwCurrent || !pwNew || !pwConfirm}
        >
          {pwLoading ? "Saving…" : "Change Password"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ display: "flex" }}>
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", sm: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: "none", bgcolor: C.bg },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", sm: "block" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            border: "none",
            bgcolor: C.bg,
            boxShadow: "4px 0 24px rgba(0,0,0,0.35)",
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {pwDialog}
    </Box>
  );
};

export default Sidebar;
