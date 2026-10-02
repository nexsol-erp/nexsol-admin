import React, { useEffect, useState } from "react";
import {
  Box, Button, Container, Typography, Grid, Paper, Tabs, Tab, Chip, Dialog, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CssBaseline,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useLocation, useNavigate } from "react-router-dom";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import SettingsInputComponentIcon from "@mui/icons-material/SettingsInputComponent";
import CurrencyRupeeIcon from "@mui/icons-material/CurrencyRupee";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import PrintIcon from "@mui/icons-material/Print";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HubIcon from "@mui/icons-material/Hub";
import StorageIcon from "@mui/icons-material/Storage";
import { WB, SIGNUP, LOGIN, WbNavbar, WbFooter } from "./WbChrome";
import {
  DOWNLOAD_URL, HERO_POINTS, FEATURES, COMPARISON, ROADMAP, SCREENSHOTS, SETUP_STEPS,
} from "./weighbridgeContent";

const lightTheme = createTheme({
  palette: { mode: "light", primary: { main: WB.navy } },
  typography: { fontFamily: "'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
});

const FEATURE_ICONS = {
  indicator: SettingsInputComponentIcon,
  charge: CurrencyRupeeIcon,
  offline: CloudOffIcon,
  print: PrintIcon,
  camera: PhotoCameraIcon,
  vehicle: LocalShippingIcon,
  control: AdminPanelSettingsIcon,
  reports: AssessmentIcon,
  updates: SystemUpdateAltIcon,
  branches: AccountTreeIcon,
  erp: HubIcon,
  data: StorageIcon,
};

const SectionTitle = ({ eyebrow, title, text, light = false }) => (
  <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto", mb: { xs: 4, md: 6 } }}>
    <Typography sx={{ color: light ? WB.green : WB.greenDark, fontWeight: 700, letterSpacing: "1.5px", fontSize: 13, textTransform: "uppercase", mb: 1 }}>
      {eyebrow}
    </Typography>
    <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 26, md: 36 }, color: light ? "#fff" : WB.ink, letterSpacing: "-0.5px", lineHeight: 1.2 }}>
      {title}
    </Typography>
    {text && (
      <Typography sx={{ mt: 1.5, color: light ? "rgba(255,255,255,0.75)" : WB.muted, fontSize: { xs: 15, md: 17 }, lineHeight: 1.6 }}>
        {text}
      </Typography>
    )}
  </Box>
);

const Hero = () => {
  const navigate = useNavigate();
  return (
    <Box
      id="top"
      sx={{
        background: `radial-gradient(1200px 500px at 85% 10%, rgba(22,193,114,0.18), transparent 60%), linear-gradient(160deg, ${WB.navyDeep} 0%, ${WB.navy} 55%, #12407e 100%)`,
        color: "#fff",
        pt: { xs: 13, md: 17 },
        pb: { xs: 8, md: 12 },
        overflow: "hidden",
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
          <Grid item xs={12} md={5}>
            <Chip
              label="Weighbridge software for Windows + cloud"
              sx={{ bgcolor: "rgba(22,193,114,0.15)", color: WB.green, fontWeight: 700, mb: 2.5, border: "1px solid rgba(22,193,114,0.35)" }}
            />
            <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 34, sm: 42, md: 50 }, lineHeight: 1.08, letterSpacing: "-1px" }}>
              Every weighing, every site,{" "}
              <Box component="span" sx={{ color: WB.green }}>on one screen.</Box>
            </Typography>
            <Typography sx={{ mt: 2.5, fontSize: { xs: 16, md: 18 }, color: "rgba(255,255,255,0.78)", lineHeight: 1.6 }}>
              TradeLink247 Weighbridge reads your indicator, works out the charge, prints the voucher and
              uploads it with a photo. Manage rates, PCs and reports from the web.
            </Typography>
            <Box component="ul" sx={{ listStyle: "none", p: 0, m: 0, mt: 3 }}>
              {HERO_POINTS.map((p) => (
                <Box component="li" key={p} sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1.1, fontSize: 15.5 }}>
                  <CheckCircleIcon sx={{ color: WB.green, fontSize: 20 }} /> {p}
                </Box>
              ))}
            </Box>
            <Box sx={{ display: "flex", gap: 1.5, mt: 4, flexWrap: "wrap" }}>
              <Button
                size="large"
                onClick={() => navigate(SIGNUP)}
                sx={{ bgcolor: WB.green, color: WB.navyDeep, fontWeight: 800, textTransform: "none", borderRadius: "10px", px: 3.5, py: 1.3, fontSize: 16, "&:hover": { bgcolor: "#13ad66" } }}
              >
                Start free
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate(LOGIN)}
                sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "none", borderRadius: "10px", px: 3, py: 1.3, fontSize: 16, "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.06)" } }}
              >
                Sign in
              </Button>
            </Box>
            <Typography sx={{ mt: 2, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>
              Already signed up?{" "}
              <Box component="a" href={DOWNLOAD_URL} sx={{ color: WB.green, fontWeight: 600 }}>Download the Windows app</Box>
            </Typography>
          </Grid>
          <Grid item xs={12} md={7}>
            <Box
              component="img"
              src="/weighbridge-site/app-weighing.png"
              alt="TradeLink247 Weighbridge desktop app: weighing screen with live weight and previous weighings"
              sx={{
                width: "100%", display: "block", borderRadius: "14px",
                boxShadow: "0 30px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

const Features = () => (
  <Box id="features" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff", scrollMarginTop: 64 }}>
    <Container maxWidth="lg">
      <SectionTitle
        eyebrow="Features"
        title="Everything a weighbridge counter needs"
        text="A Windows app at the bridge, and a web dashboard for the owner. Both are included."
      />
      <Grid container spacing={2.5}>
        {FEATURES.map((f) => {
          const Icon = FEATURE_ICONS[f.key] || CheckCircleIcon;
          return (
            <Grid item xs={12} sm={6} md={4} key={f.key}>
              <Paper
                elevation={0}
                sx={{ p: 3, height: "100%", borderRadius: "14px", border: `1px solid ${WB.line}`, transition: "all 0.2s", "&:hover": { borderColor: WB.blue, boxShadow: "0 10px 30px rgba(15,23,42,0.08)" } }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: "11px", bgcolor: "rgba(29,95,191,0.08)", display: "flex", alignItems: "center", justifyContent: "center", mb: 2 }}>
                  <Icon sx={{ color: WB.blue }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: 17, color: WB.ink, mb: 1 }}>{f.title}</Typography>
                <Typography sx={{ color: WB.muted, fontSize: 14.5, lineHeight: 1.6 }}>{f.text}</Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Container>
  </Box>
);

const Screenshots = () => {
  const [tab, setTab] = useState("app");
  const [zoom, setZoom] = useState(null);
  const shots = SCREENSHOTS[tab];
  return (
    <Box id="screenshots" sx={{ py: { xs: 8, md: 12 }, bgcolor: WB.soft, scrollMarginTop: 64 }}>
      <Container maxWidth="lg">
        <SectionTitle eyebrow="Screenshots" title="See it before you install it" />
        <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ bgcolor: "#fff", borderRadius: "12px", border: `1px solid ${WB.line}`, minHeight: 0, "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 44, px: 3 } }}
          >
            <Tab value="app" label="Desktop app" />
            <Tab value="web" label="Web dashboard" />
          </Tabs>
        </Box>
        <Grid container spacing={3}>
          {shots.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.src}>
              <Paper elevation={0} sx={{ borderRadius: "14px", overflow: "hidden", border: `1px solid ${WB.line}`, height: "100%" }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setZoom(s)}
                  aria-label={`Enlarge ${s.title}`}
                  sx={{ p: 0, border: 0, display: "block", width: "100%", cursor: "zoom-in", bgcolor: "#e8edf5", aspectRatio: "16 / 10", overflow: "hidden" }}
                >
                  <Box component="img" src={s.src} alt={s.title} loading="lazy" sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left", display: "block" }} />
                </Box>
                <Box sx={{ p: 2.2 }}>
                  <Typography sx={{ fontWeight: 700, color: WB.ink }}>{s.title}</Typography>
                  <Typography sx={{ color: WB.muted, fontSize: 14, mt: 0.5, lineHeight: 1.55 }}>{s.caption}</Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
      <Dialog open={!!zoom} onClose={() => setZoom(null)} maxWidth="lg" fullWidth>
        {zoom && (
          <Box sx={{ position: "relative", bgcolor: "#0b1220" }}>
            <IconButton aria-label="Close" onClick={() => setZoom(null)} sx={{ position: "absolute", top: 8, right: 8, color: "#fff", bgcolor: "rgba(0,0,0,0.4)", "&:hover": { bgcolor: "rgba(0,0,0,0.6)" } }}>
              <CloseIcon />
            </IconButton>
            <Box component="img" src={zoom.src} alt={zoom.title} sx={{ width: "100%", display: "block" }} />
            <Typography sx={{ color: "rgba(255,255,255,0.8)", p: 2, fontSize: 14 }}>
              <b>{zoom.title}.</b> {zoom.caption}
            </Typography>
          </Box>
        )}
      </Dialog>
    </Box>
  );
};

const Mark = ({ value }) => {
  if (value === true) return <CheckCircleIcon sx={{ color: WB.green }} titleAccess="Yes" />;
  if (value === "roadmap") return <Chip size="small" icon={<ScheduleIcon />} label="Roadmap" sx={{ "& .MuiChip-label": { px: { xs: 0.6, sm: 1 } }, "& .MuiChip-icon": { display: { xs: "none", sm: "block" }, color: "#9a5b00" }, bgcolor: "#fff4e5", color: "#9a5b00", fontWeight: 600 }} />;
  if (value === "partial") return <Chip size="small" label="Some" sx={{ bgcolor: "#eef2f7", color: WB.muted, fontWeight: 600 }} />;
  return <RemoveCircleOutlineIcon sx={{ color: "#cbd5e1" }} titleAccess="No" />;
};

const Compare = () => (
  <Box id="compare" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#fff", scrollMarginTop: 64 }}>
    <Container maxWidth="md">
      <SectionTitle
        eyebrow="Compare"
        title="How we compare with international weighbridge software"
        text="Checked against what the leading international weighbridge packages commonly offer. Where we are behind, it is on our roadmap below."
      />
      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: "14px", border: `1px solid ${WB.line}` }}>
        <Table size="small" aria-label="Feature comparison" sx={{ "& td, & th": { px: { xs: 1, sm: 2 } } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: WB.soft }}>
              <TableCell sx={{ fontWeight: 700, py: 1.6 }}>Feature</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, color: WB.navy, width: { xs: 74, sm: 150 }, fontSize: { xs: 12, sm: 14 } }}>TradeLink247</TableCell>
              <TableCell align="center" sx={{ fontWeight: 700, color: WB.muted, width: { xs: 74, sm: 150 }, fontSize: { xs: 12, sm: 14 } }}>Typical international</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {COMPARISON.map((r) => (
              <TableRow key={r.feature} sx={{ "&:last-child td": { borderBottom: 0 } }}>
                <TableCell sx={{ py: 1.3, fontSize: { xs: 13.5, sm: 14.5 }, color: WB.ink }}>{r.feature}</TableCell>
                <TableCell align="center"><Mark value={r.ours} /></TableCell>
                <TableCell align="center"><Mark value={r.typical} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography sx={{ mt: 2, fontSize: 13, color: WB.muted }}>
        "Some" means the feature is an add-on, depends on the edition, or needs a separate server.
      </Typography>
    </Container>
  </Box>
);

const Roadmap = () => (
  <Box id="roadmap" sx={{ py: { xs: 8, md: 12 }, background: `linear-gradient(160deg, ${WB.navyDeep} 0%, ${WB.navy} 100%)`, scrollMarginTop: 64 }}>
    <Container maxWidth="lg">
      <SectionTitle
        light
        eyebrow="Roadmap"
        title="What we are building next"
        text="The features above that we don't have yet, in the order we plan to build them. Tell us what your site needs first."
      />
      <Grid container spacing={3}>
        {ROADMAP.map((col) => (
          <Grid item xs={12} md={4} key={col.stage}>
            <Typography sx={{ color: WB.green, fontWeight: 800, mb: 2, fontSize: 15, letterSpacing: "1px", textTransform: "uppercase" }}>{col.stage}</Typography>
            {col.items.map((it) => (
              <Paper key={it.title} elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: "12px", bgcolor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <Typography sx={{ color: "#fff", fontWeight: 700, mb: 0.6 }}>{it.title}</Typography>
                <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: 14, lineHeight: 1.55 }}>{it.text}</Typography>
              </Paper>
            ))}
          </Grid>
        ))}
      </Grid>
    </Container>
  </Box>
);

const GetStarted = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: WB.soft }}>
      <Container maxWidth="lg">
        <SectionTitle eyebrow="Get started" title="Weighing in four steps" />
        <Grid container spacing={2.5}>
          {SETUP_STEPS.map((s, i) => (
            <Grid item xs={12} sm={6} md={3} key={s.title}>
              <Paper elevation={0} sx={{ p: 3, height: "100%", borderRadius: "14px", border: `1px solid ${WB.line}` }}>
                <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: WB.navy, color: "#fff", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5 }}>{i + 1}</Box>
                <Typography sx={{ fontWeight: 700, color: WB.ink, mb: 0.7 }}>{s.title}</Typography>
                <Typography sx={{ color: WB.muted, fontSize: 14.5, lineHeight: 1.55 }}>{s.text}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Paper
          elevation={0}
          sx={{ mt: 5, p: { xs: 3, md: 5 }, borderRadius: "18px", textAlign: "center", background: `linear-gradient(135deg, ${WB.navy} 0%, ${WB.blue} 100%)`, color: "#fff" }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 24, md: 30 } }}>Need the full ERP too?</Typography>
          <Typography sx={{ mt: 1, color: "rgba(255,255,255,0.8)", maxWidth: 620, mx: "auto" }}>
            At sign-up, choose ERP + Weighbridge to get billing, inventory and accounts alongside the weighbridge.
            You can also start with the weighbridge and add the ERP later.
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", mt: 3, flexWrap: "wrap" }}>
            <Button onClick={() => navigate(SIGNUP)} sx={{ bgcolor: WB.green, color: WB.navyDeep, fontWeight: 800, textTransform: "none", borderRadius: "10px", px: 3.5, py: 1.2, "&:hover": { bgcolor: "#13ad66" } }}>
              Start free
            </Button>
            <Button href={DOWNLOAD_URL} startIcon={<DownloadIcon />} sx={{ color: "#fff", border: "1px solid rgba(255,255,255,0.5)", fontWeight: 600, textTransform: "none", borderRadius: "10px", px: 3, py: 1.2 }}>
              Download for Windows
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

const WeighbridgeLandingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Weighbridge Software | TradeLink247";
    const id = location.state?.scrollTo;
    if (id) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ overflowX: "hidden", bgcolor: "#fff" }}>
        <WbNavbar />
        <Hero />
        <Features />
        <Screenshots />
        <Compare />
        <Roadmap />
        <GetStarted />
        <WbFooter />
      </Box>
    </ThemeProvider>
  );
};

export default WeighbridgeLandingPage;
