import React from "react";
import {
  Box, Typography, Container, Grid, Button, Chip, Paper, Stack,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PaidIcon from "@mui/icons-material/Paid";
import CampaignIcon from "@mui/icons-material/Campaign";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SchoolIcon from "@mui/icons-material/School";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LanguageIcon from "@mui/icons-material/Language";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

const lightTheme = createTheme({ palette: { mode: "light" } });

const CORE_FEATURES = [
  "Cloud-based architecture", "Offline POS Billing", "Multi-Branch Management",
  "Supermarket ERP", "Bakery ERP", "Production Management", "Inventory Management",
  "Purchase & Sales", "Accounting Integration", "Barcode Support",
  "AI-Powered Reports & Analytics", "Mobile Ready", "Secure Multi-Tenant Architecture",
  "GST/VAT Ready", "Tally Integration",
];

const WHO_CAN_PARTNER = [
  "ERP Implementation Companies", "POS Solution Providers", "Software Companies",
  "IT Service Providers", "System Integrators", "Managed Service Providers (MSPs)",
  "Business Consultants", "Accounting & Finance Consultants",
  "Digital Transformation Consultants", "Retail Technology Consultants",
];

const BENEFITS = [
  {
    icon: MonetizationOnIcon,
    title: "Attractive Recurring Commission",
    desc: "Earn recurring monthly commissions for every active customer you bring — the more customers you acquire, the more your recurring income grows.",
    color: "#10b981", bg: "#f0fdf4",
  },
  {
    icon: PaidIcon,
    title: "Multiple Revenue Opportunities",
    desc: "Generate income from Software Subscription, Implementation, Training, Customization, Data Migration, Annual Support, Consulting & Customer Success Services.",
    color: "#f59e0b", bg: "#fffbeb",
  },
  {
    icon: CampaignIcon,
    title: "Complete Sales Enablement",
    desc: "Demo Environment, Product Presentations, Marketing Brochures, Pricing Guide, Competitive Comparison, Proposal & Email Templates.",
    color: "#3b82f6", bg: "#eff6ff",
  },
  {
    icon: SupportAgentIcon,
    title: "Technical Support",
    desc: "Our team works with you on product demonstrations, customer meetings, implementation, training, and troubleshooting. You never sell alone.",
    color: "#8b5cf6", bg: "#f5f3ff",
  },
  {
    icon: SchoolIcon,
    title: "Free Partner Training",
    desc: "Comprehensive training covering product features, sales process, demonstrations, installation, configuration, onboarding & best practices.",
    color: "#ef4444", bg: "#fff5f5",
  },
];

const JOURNEY_STEPS = [
  "Apply Online", "Meet Our Team", "Receive Product Training",
  "Access Demo Environment", "Start Selling", "Earn Recurring Revenue",
];

const INDUSTRIES = [
  { emoji: "🏪", label: "Supermarkets" },
  { emoji: "🥖", label: "Bakeries" },
  { emoji: "🛒", label: "Retail Stores" },
  { emoji: "🏭", label: "Manufacturing Units" },
  { emoji: "📦", label: "Wholesale Distribution" },
  { emoji: "🍽", label: "Restaurants" },
  { emoji: "☕", label: "Cafés" },
  { emoji: "🛍", label: "Department Stores" },
  { emoji: "🏬", label: "Multi-Branch Retail Chains" },
];

const SectionHeader = ({ chip, title, subtitle, dark }) => (
  <Box sx={{ textAlign: "center", mb: { xs: 5, md: 7 } }}>
    <Chip
      label={chip}
      size="small"
      sx={{
        bgcolor: dark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.1)",
        color: dark ? "#93c5fd" : "#1e40af",
        border: `1px solid ${dark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.25)"}`,
        fontWeight: 700, letterSpacing: "1px", mb: 2, fontSize: 11,
      }}
    />
    <Typography
      variant="h2"
      sx={{
        fontWeight: 800, fontSize: { xs: "1.8rem", md: "2.4rem" },
        color: dark ? "#ffffff" : "#0f172a", mb: 1.5, letterSpacing: "-0.5px",
      }}
    >
      {title}
    </Typography>
    {subtitle && (
      <Typography
        sx={{
          fontSize: { xs: 15, md: 16.5 },
          color: dark ? "rgba(255,255,255,0.65)" : "#64748b",
          maxWidth: 640, mx: "auto", lineHeight: 1.7,
        }}
      >
        {subtitle}
      </Typography>
    )}
  </Box>
);

const PartnerPage = () => {
  const navigate = useNavigate();

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ overflowX: "hidden", bgcolor: "#ffffff" }}>
        <LandingNavbar />

        {/* Hero */}
        <Box
          sx={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #1d4ed8 100%)",
            pt: { xs: 14, md: 16 }, pb: { xs: 8, md: 10 },
            position: "relative", overflow: "hidden",
          }}
        >
          {[
            { top: "10%", left: "-8%", size: 380, color: "rgba(59,130,246,0.18)" },
            { top: "50%", right: "-5%", size: 320, color: "rgba(139,92,246,0.14)" },
          ].map((o, i) => (
            <Box
              key={i}
              sx={{
                position: "absolute", borderRadius: "50%",
                width: o.size, height: o.size, bgcolor: o.color, filter: "blur(80px)",
                top: o.top, left: o.left, right: o.right, pointerEvents: "none",
              }}
            />
          ))}
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <Chip
              label="TRADELINK247 PARTNER PROGRAM"
              size="small"
              sx={{
                bgcolor: "rgba(52,211,153,0.2)", color: "#6ee7b7",
                border: "1px solid rgba(52,211,153,0.3)",
                fontWeight: 700, letterSpacing: "0.8px", fontSize: 11, mb: 3,
              }}
            />
            <Typography
              variant="h1"
              sx={{
                fontWeight: 800, fontSize: { xs: "2rem", sm: "2.6rem", md: "3.2rem" },
                color: "#ffffff", lineHeight: 1.18, mb: 2.5, letterSpacing: "-1px",
              }}
            >
              Become a{" "}
              <Box
                component="span"
                sx={{
                  background: "linear-gradient(90deg, #60a5fa, #a78bfa, #34d399)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}
              >
                TradeLink247 Partner
              </Box>
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 15, md: 17 }, color: "rgba(255,255,255,0.75)",
                lineHeight: 1.75, mb: 1, maxWidth: 720, mx: "auto",
              }}
            >
              Grow your business with a modern cloud ERP. Earn recurring revenue,
              expand your service portfolio, and help businesses transform.
            </Typography>
            <Typography sx={{ fontSize: { xs: 14, md: 15 }, color: "rgba(255,255,255,0.6)", mb: 4, maxWidth: 680, mx: "auto" }}>
              Whether you're an ERP consultant, software company, POS dealer, IT service
              provider, or business consultant — join our global partner network and start
              selling a powerful ERP trusted by retail, supermarket, bakery, wholesale, and
              manufacturing businesses.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
              <Button
                variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />}
                onClick={() => navigate("/partner/apply")}
                sx={{
                  background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
                  color: "#fff", fontWeight: 700, fontSize: 15, borderRadius: "12px",
                  px: 3.5, py: 1.5, textTransform: "none",
                  boxShadow: "0 8px 24px rgba(59,130,246,0.5)",
                  "&:hover": { opacity: 0.92 },
                }}
              >
                Become a Partner
              </Button>
              <Button
                variant="outlined" size="large" startIcon={<CalendarMonthIcon />}
                onClick={() => {
                  const el = document.getElementById("partner-apply");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
                sx={{
                  borderColor: "rgba(255,255,255,0.45)", color: "#fff",
                  fontWeight: 600, fontSize: 15, borderRadius: "12px",
                  px: 3.5, py: 1.5, textTransform: "none",
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                }}
              >
                Schedule a Demo
              </Button>
            </Stack>
          </Container>
        </Box>

        {/* Why partner — core features */}
        <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "#ffffff" }}>
          <Container maxWidth="lg">
            <SectionHeader
              chip="WHY PARTNER WITH US"
              title="A Modern Cloud ERP, Built to Sell"
              subtitle="Unlike traditional ERP systems that are expensive and difficult to implement, TradeLink247 is fast to deploy and easy for your customers to adopt."
            />
            <Grid container spacing={1.5}>
              {CORE_FEATURES.map((f) => (
                <Grid item xs={12} sm={6} md={4} key={f}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, p: 1.2 }}>
                    <CheckCircleIcon sx={{ color: "#10b981", fontSize: 20, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 14.5, color: "#334155" }}>{f}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Who can partner */}
        <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "#f8fafc" }}>
          <Container maxWidth="lg">
            <SectionHeader
              chip="WHO CAN BECOME A PARTNER"
              title="We Welcome Companies & Professionals Worldwide"
              subtitle="No prior experience with TradeLink247 is required. We provide complete training and onboarding."
            />
            <Stack direction="row" flexWrap="wrap" gap={1.2} justifyContent="center">
              {WHO_CAN_PARTNER.map((w) => (
                <Chip
                  key={w}
                  label={w}
                  sx={{
                    bgcolor: "#ffffff", color: "#1e40af", fontWeight: 600, fontSize: 13,
                    border: "1px solid #dbeafe", py: 2.4, px: 0.5,
                  }}
                />
              ))}
            </Stack>
          </Container>
        </Box>

        {/* Benefits */}
        <Box
          sx={{
            py: { xs: 8, md: 12 },
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
            position: "relative", overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute", inset: 0,
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 50%), " +
                "radial-gradient(circle at 80% 20%, rgba(139,92,246,0.12) 0%, transparent 45%)",
              pointerEvents: "none",
            }}
          />
          <Container maxWidth="lg" sx={{ position: "relative", zIndex: 1 }}>
            <SectionHeader chip="PARTNER BENEFITS" title="Everything You Need to Start Selling" dark />
            <Grid container spacing={2.5}>
              {BENEFITS.map((b) => {
                const Icon = b.icon;
                return (
                  <Grid item xs={12} sm={6} md={4} key={b.title}>
                    <Box
                      sx={{
                        p: 3, borderRadius: "16px", height: "100%",
                        bgcolor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        transition: "all 0.25s ease",
                        "&:hover": {
                          bgcolor: "rgba(255,255,255,0.09)",
                          border: `1px solid ${b.color}50`,
                          transform: "translateY(-4px)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 48, height: 48, borderRadius: "12px", bgcolor: b.bg,
                          display: "flex", alignItems: "center", justifyContent: "center", mb: 2,
                        }}
                      >
                        <Icon sx={{ color: b.color, fontSize: 26 }} />
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#f1f5f9", mb: 1 }}>
                        {b.title}
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65 }}>
                        {b.desc}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          </Container>
        </Box>

        {/* Industries */}
        <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "#ffffff" }}>
          <Container maxWidth="lg">
            <SectionHeader chip="INDUSTRIES WE SERVE" title="Sell Into Businesses That Need You" />
            <Grid container spacing={2}>
              {INDUSTRIES.map((ind) => (
                <Grid item xs={6} sm={4} md={3} key={ind.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      textAlign: "center", py: 3, px: 1.5, borderRadius: "14px",
                      border: "1px solid #e2e8f0", height: "100%",
                      transition: "all 0.2s",
                      "&:hover": { borderColor: "#3b82f6", transform: "translateY(-3px)" },
                    }}
                  >
                    <Typography sx={{ fontSize: 32, mb: 1 }}>{ind.emoji}</Typography>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>
                      {ind.label}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* Partner journey */}
        <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: "#f8fafc" }}>
          <Container maxWidth="lg">
            <SectionHeader chip="HOW IT WORKS" title="Your Partner Journey" subtitle="From application to earning recurring revenue in six simple steps." />
            <Grid container spacing={2}>
              {JOURNEY_STEPS.map((step, i) => (
                <Grid item xs={6} sm={4} md={2} key={step}>
                  <Box sx={{ textAlign: "center" }}>
                    <Box
                      sx={{
                        width: 52, height: 52, borderRadius: "50%", mx: "auto", mb: 1.5,
                        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 6px 16px rgba(59,130,246,0.35)",
                      }}
                    >
                      <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{i + 1}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "#334155" }}>{step}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        {/* CTA / Apply */}
        <Box id="partner-apply" sx={{ py: { xs: 8, md: 10 }, bgcolor: "#f8fafc" }}>
          <Container maxWidth="lg">
            <Paper
              elevation={0}
              sx={{
                borderRadius: "24px", overflow: "hidden", p: { xs: 4, md: 7 },
                textAlign: "center",
                background: "linear-gradient(135deg, #0f172a 0%, #1e40af 60%, #3b82f6 100%)",
              }}
            >
              <Typography sx={{ fontWeight: 800, fontSize: { xs: "1.7rem", md: "2.2rem" }, color: "#fff", mb: 1.5 }}>
                Ready to Grow Together?
              </Typography>
              <Typography sx={{ fontSize: 15, color: "rgba(255,255,255,0.75)", maxWidth: 620, mx: "auto", mb: 4 }}>
                Join a global network of partners delivering modern ERP solutions to businesses
                worldwide. TradeLink247 provides the technology, training, and support to help you succeed.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" sx={{ mb: 4 }}>
                <Button
                  variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => navigate("/partner/apply")}
                  sx={{
                    bgcolor: "#fff", color: "#1e40af", fontWeight: 700, fontSize: 15,
                    borderRadius: "12px", px: 4, py: 1.5, textTransform: "none",
                    "&:hover": { bgcolor: "#f1f5f9" },
                  }}
                >
                  Apply Now
                </Button>
                <Button
                  variant="outlined" size="large" startIcon={<CalendarMonthIcon />}
                  onClick={() => {
                    const el = document.getElementById("contact");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  sx={{
                    borderColor: "rgba(255,255,255,0.45)", color: "#fff",
                    fontWeight: 600, fontSize: 15, borderRadius: "12px", px: 4, py: 1.5,
                    textTransform: "none",
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                  }}
                >
                  Request a Live Demo
                </Button>
              </Stack>
              <Stack
                direction={{ xs: "column", sm: "row" }} spacing={{ xs: 1.5, sm: 4 }}
                justifyContent="center" alignItems="center"
                sx={{ pt: 3, borderTop: "1px solid rgba(255,255,255,0.15)" }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <LanguageIcon sx={{ color: "#93c5fd", fontSize: 18 }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>tradelink247.com</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <EmailIcon sx={{ color: "#93c5fd", fontSize: 18 }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>admin@tradelink247.com</Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <PhoneIcon sx={{ color: "#93c5fd", fontSize: 18 }} />
                  <Typography sx={{ color: "rgba(255,255,255,0.8)", fontSize: 13.5 }}>+91 9995620056</Typography>
                </Box>
              </Stack>
            </Paper>
          </Container>
        </Box>

        <LandingFooter />
      </Box>
    </ThemeProvider>
  );
};

export default PartnerPage;
