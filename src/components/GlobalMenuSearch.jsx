import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  Box, InputBase, Popper, Paper, List, ListItemButton, ListItemText,
  Typography, ClickAwayListener, Chip, Divider,
} from "@mui/material";
import { Search as SearchIcon, Close, History } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { flattenMenu } from "../menuCatalog";
import { useMenuAccess } from "./MenuAccessContext";

// ============================================================================
// GLOBAL MENU SEARCH - the AWS-console style search that lives in the top bar.
// Only menus the signed-in user is permitted to open are listed, so every
// result is navigable.
// ============================================================================

const RECENTS_KEY = "recentMenuPaths";
const MAX_RECENTS = 6;
const MAX_RESULTS = 12;

const readRecents = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

export const rememberRecentMenu = (link) => {
  try {
    const next = [link, ...readRecents().filter((p) => p !== link)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable - recents are a convenience only */
  }
};

/** Ranks a leaf against the query; returns -1 when it does not match. */
const score = (leaf, q, translatedLabel) => {
  const label = translatedLabel.toLowerCase();
  const section = leaf.section.toLowerCase();
  if (label.startsWith(q)) return 0;
  const wordStart = label.split(/[\s/&-]+/).some((w) => w.startsWith(q));
  if (wordStart) return 1;
  if (label.includes(q)) return 2;
  if (section.includes(q)) return 3;
  if (leaf.link.toLowerCase().includes(q)) return 4;
  return -1;
};

const GlobalMenuSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isEntryAllowed } = useMenuAccess();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const anchorRef = useRef(null);
  const inputRef = useRef(null);

  // Every leaf the user is actually permitted to open.
  const permitted = useMemo(
    () =>
      flattenMenu()
        .filter((leaf) => leaf.link)
        .filter((leaf) => isEntryAllowed(leaf.menuKey, leaf.roles, leaf.parentRoles))
        .map((leaf) => ({ ...leaf, text: t(leaf.label) })),
    [isEntryAllowed, t]
  );

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) {
      const recents = readRecents();
      return recents
        .map((link) => permitted.find((leaf) => leaf.link === link))
        .filter(Boolean)
        .map((leaf) => ({ ...leaf, recent: true }));
    }
    return permitted
      .map((leaf) => ({ leaf, rank: score(leaf, q, leaf.text) }))
      .filter(({ rank }) => rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.leaf.text.localeCompare(b.leaf.text))
      .slice(0, MAX_RESULTS)
      .map(({ leaf }) => leaf);
  }, [q, permitted]);

  useEffect(() => setHighlight(0), [q]);

  const go = useCallback(
    (leaf) => {
      if (!leaf) return;
      rememberRecentMenu(leaf.link);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      navigate(leaf.link);
    },
    [navigate]
  );

  // Ctrl/Cmd+K from anywhere focuses the search, like the AWS console.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (results.length ? (h + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (results.length ? (h - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showEmpty = open && q && results.length === 0;

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ flexGrow: 1, maxWidth: 640, mx: { xs: 1, sm: 2 } }}>
        <Box
          ref={anchorRef}
          onClick={() => { setOpen(true); inputRef.current?.focus(); }}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            height: 36,
            borderRadius: "8px",
            bgcolor: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.14)",
            transition: "background-color .15s ease, border-color .15s ease",
            cursor: "text",
            "&:hover": { bgcolor: "rgba(255,255,255,0.12)" },
            "&:focus-within": {
              bgcolor: "rgba(255,255,255,0.14)",
              borderColor: "#ffe3a3",
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 18, color: "rgba(255,227,163,0.75)", flexShrink: 0 }} />
          <InputBase
            inputRef={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={t("Search menus, reports, settings…")}
            sx={{
              flexGrow: 1,
              fontSize: 13.5,
              color: "#fff",
              "& input::placeholder": { color: "rgba(255,255,255,0.5)", opacity: 1 },
            }}
          />
          {query ? (
            <Close
              onClick={(e) => { e.stopPropagation(); setQuery(""); inputRef.current?.focus(); }}
              sx={{ fontSize: 17, color: "rgba(255,255,255,0.55)", cursor: "pointer", "&:hover": { color: "#fff" } }}
            />
          ) : (
            <Chip
              label="Ctrl K"
              size="small"
              sx={{
                display: { xs: "none", md: "flex" },
                height: 20,
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: "0.3px",
                color: "rgba(255,255,255,0.6)",
                bgcolor: "rgba(255,255,255,0.10)",
                "& .MuiChip-label": { px: 0.9 },
              }}
            />
          )}
        </Box>

        <Popper
          open={open && (results.length > 0 || !!showEmpty)}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          style={{ zIndex: 1400, width: anchorRef.current?.offsetWidth }}
          modifiers={[{ name: "offset", options: { offset: [0, 6] } }]}
        >
          <Paper
            elevation={8}
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              maxHeight: 420,
              overflowY: "auto",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {showEmpty ? (
              <Box sx={{ px: 2, py: 2.5, textAlign: "center" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t("No menu you have access to matches")} &ldquo;{query}&rdquo;
                </Typography>
              </Box>
            ) : (
              <>
                {!q && (
                  <>
                    <Box sx={{ px: 1.75, pt: 1.25, pb: 0.5, display: "flex", alignItems: "center", gap: 0.75 }}>
                      <History sx={{ fontSize: 14, color: "text.secondary" }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", color: "text.secondary" }}>
                        {t("RECENTLY VISITED")}
                      </Typography>
                    </Box>
                    <Divider />
                  </>
                )}
                <List disablePadding>
                  {results.map((leaf, idx) => {
                    const SectionIcon = leaf.sectionIcon;
                    return (
                      <ListItemButton
                        key={leaf.link}
                        selected={idx === highlight}
                        onMouseEnter={() => setHighlight(idx)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(leaf)}
                        sx={{
                          py: 0.85,
                          px: 1.75,
                          gap: 1.25,
                          "&.Mui-selected": { bgcolor: "action.hover" },
                          "&.Mui-selected:hover": { bgcolor: "action.hover" },
                        }}
                      >
                        <Box
                          sx={{
                            width: 26, height: 26, borderRadius: "6px", flexShrink: 0,
                            bgcolor: leaf.sectionColor,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          {SectionIcon && <SectionIcon sx={{ fontSize: 15, color: "#fff" }} />}
                        </Box>
                        <ListItemText
                          primary={leaf.text}
                          secondary={t(leaf.section)}
                          primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600, color: "text.primary" }}
                          secondaryTypographyProps={{ fontSize: 11, color: "text.secondary" }}
                        />
                        <Typography sx={{ fontSize: 10.5, color: "text.disabled", flexShrink: 0 }}>
                          {leaf.link}
                        </Typography>
                      </ListItemButton>
                    );
                  })}
                </List>
              </>
            )}
          </Paper>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default GlobalMenuSearch;
