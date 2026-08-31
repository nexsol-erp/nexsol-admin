import React, { useState, useMemo } from "react";
import {
  Box, Typography, TextField, InputAdornment, Chip, Paper, Grid,
} from "@mui/material";
import { Search as SearchIcon, Map } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { menuSections } from "../menuCatalog";
import { useMenuAccess } from "./MenuAccessContext";
import { rememberRecentMenu } from "./GlobalMenuSearch";

// ============================================================================
// MENU MAP - the full, browsable feature map. Day-to-day lookup now happens
// through the top-bar search; this page stays as the "see everything at once"
// view. Sections and items come from the shared catalog and are filtered to
// what the signed-in user is permitted to open.
// ============================================================================

const MenuMapPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isEntryAllowed } = useMenuAccess();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  // Only sections/items this user may actually open.
  const sections = useMemo(
    () =>
      menuSections()
        .map((sec) => ({
          ...sec,
          items: sec.items
            .filter((it) => it.link && isEntryAllowed(it.menuKey, it.roles, sec.parentRoles))
            .map((it) => ({ ...it, text: t(it.label) })),
        }))
        .filter((sec) => sec.items.length > 0),
    [isEntryAllowed, t]
  );

  const filtered = useMemo(() => {
    if (!q) return sections;
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) => it.text.toLowerCase().includes(q)),
      }))
      .filter((sec) => sec.title.toLowerCase().includes(q) || sec.items.length > 0);
  }, [q, sections]);

  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);
  const matchCount = q ? filtered.reduce((s, sec) => s + sec.items.length, 0) : null;

  const open = (link) => {
    rememberRecentMenu(link);
    navigate(link);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3, textAlign: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mb: 0.5 }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: 2,
              background: "linear-gradient(135deg, #1565C0 0%, #4A148C 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(21,101,192,0.4)",
            }}
          >
            <Map sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Typography variant="h4" fontWeight={800} sx={{ color: "text.primary", letterSpacing: "-0.5px" }}>
            Application Menu Map
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
          {totalItems} features across {sections.length} sections — click any item to navigate
        </Typography>
      </Box>

      {/* Search */}
      <Box sx={{ maxWidth: 540, mx: "auto", mb: 3.5 }}>
        <TextField
          fullWidth
          size="medium"
          placeholder="Search any feature…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#1565C0" }} />
              </InputAdornment>
            ),
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 3,
              fontSize: "1rem",
              bgcolor: "background.paper",
              color: "text.primary",
              boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
              "& fieldset": { borderColor: "divider" },
              "&:hover fieldset": { borderColor: "#1565C0" },
              "&.Mui-focused fieldset": { borderColor: "#1565C0", borderWidth: 2 },
            },
            "& .MuiInputBase-input": { color: "inherit" },
          }}
        />
        {matchCount !== null && (
          <Typography variant="caption" sx={{ mt: 0.75, display: "block", textAlign: "center", color: "text.secondary" }}>
            {matchCount === 0
              ? "No matches found"
              : `${matchCount} match${matchCount !== 1 ? "es" : ""} found`}
          </Typography>
        )}
      </Box>

      {/* Sections Grid */}
      {filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8, color: "#bbb" }}>
          <SearchIcon sx={{ fontSize: 52, mb: 1.5 }} />
          <Typography variant="h6" sx={{ color: "#aaa" }}>No features match &ldquo;{query}&rdquo;</Typography>
        </Box>
      ) : (
        <Grid container spacing={2.5}>
          {filtered.map((sec) => {
            const SectionIcon = sec.icon;
            return (
              <Grid item xs={12} sm={6} md={4} key={sec.key}>
                <Paper
                  elevation={0}
                  sx={{
                    height: "100%",
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      boxShadow: `0 8px 28px ${sec.color}30`,
                      transform: "translateY(-2px)",
                    },
                  }}
                >
                  {/* Solid coloured header */}
                  <Box
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      background: `linear-gradient(135deg, ${sec.color} 0%, ${sec.color}CC 100%)`,
                      display: "flex",
                      alignItems: "center",
                      gap: 1.25,
                    }}
                  >
                    <Box sx={{ color: "rgba(255,255,255,0.95)", display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {SectionIcon && <SectionIcon fontSize="small" />}
                    </Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{ color: "#fff", fontSize: "0.83rem", letterSpacing: "0.2px", flexGrow: 1 }}
                    >
                      {t(sec.title)}
                    </Typography>
                    <Box
                      sx={{
                        minWidth: 22, height: 22, borderRadius: "50%",
                        bgcolor: "rgba(255,255,255,0.25)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Typography sx={{ fontSize: "0.68rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                        {sec.items.length}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Items */}
                  <Box sx={{ p: 1.75, display: "flex", flexWrap: "wrap", gap: 0.8, bgcolor: "background.paper" }}>
                    {sec.items.map((item) => {
                      const isMatch = q && item.text.toLowerCase().includes(q);
                      return (
                        <Chip
                          key={item.link}
                          label={item.text}
                          size="small"
                          onClick={() => open(item.link)}
                          sx={{
                            fontSize: "0.74rem",
                            height: 27,
                            cursor: "pointer",
                            bgcolor: isMatch ? sec.color : "action.hover",
                            color: isMatch ? "#fff" : "text.primary",
                            border: `1.5px solid ${isMatch ? sec.color : "transparent"}`,
                            borderColor: isMatch ? sec.color : "divider",
                            fontWeight: isMatch ? 700 : 500,
                            transition: "all 0.15s ease",
                            "&:hover": {
                              bgcolor: sec.color,
                              color: "#fff",
                              borderColor: sec.color,
                              transform: "translateY(-1px)",
                              boxShadow: `0 4px 10px ${sec.color}50`,
                            },
                            "& .MuiChip-label": { px: 1.25 },
                          }}
                        />
                      );
                    })}
                  </Box>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default MenuMapPage;
