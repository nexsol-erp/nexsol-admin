import React from "react";
import {
  Box, Typography, Container, Grid, Link, Divider,
  IconButton, Stack,
} from "@mui/material";
import FacebookIcon from "@mui/icons-material/Facebook";
import TwitterIcon from "@mui/icons-material/Twitter";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import InstagramIcon from "@mui/icons-material/Instagram";
import YouTubeIcon from "@mui/icons-material/YouTube";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import { useNavigate } from "react-router-dom";

const PRODUCT_LINKS = [
  { label: "POS Billing", href: "#features" },
  { label: "Inventory Management", href: "#features" },
  { label: "Purchase Management", href: "#features" },
  { label: "Stock Transfer", href: "#features" },
  { label: "Multi-Branch", href: "#features" },
  { label: "Reports & Analytics", href: "#features" },
];

const COMPANY_LINKS = [
  { label: "About Us", href: "#" },
  { label: "Pricing", href: "#pricing" },
  { label: "Demo", href: "#contact" },
  { label: "Blog", href: "#" },
  { label: "Careers", href: "#" },
];

const SUPPORT_LINKS = [
  { label: "Help Center", href: "#" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms-and-conditions" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Contact Support", href: "#contact" },
];

const SOCIAL_ICONS = [
  { Icon: FacebookIcon, label: "Facebook", color: "#1877f2" },
  { Icon: TwitterIcon, label: "Twitter", color: "#1da1f2" },
  { Icon: LinkedInIcon, label: "LinkedIn", color: "#0a66c2" },
  { Icon: InstagramIcon, label: "Instagram", color: "#e1306c" },
  { Icon: YouTubeIcon, label: "YouTube", color: "#ff0000" },
];

const ContactItem = ({ icon: Icon, children }) => (
  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.2, mb: 1.5 }}>
    <Icon sx={{ color: "#60a5fa", fontSize: 17, mt: "2px", flexShrink: 0 }} />
    <Typography sx={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.55 }}>
      {children}
    </Typography>
  </Box>
);

const FooterLink = ({ href, label }) => {
  const navigate = useNavigate();
  const isAnchor = href.startsWith("#");

  const handleClick = (e) => {
    e.preventDefault();
    if (isAnchor) {
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate(href);
    }
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      underline="none"
      sx={{
        display: "block",
        color: "rgba(255,255,255,0.55)",
        fontSize: 13.5,
        mb: 1,
        transition: "color 0.2s",
        "&:hover": { color: "#60a5fa" },
      }}
    >
      {label}
    </Link>
  );
};

const LandingFooter = () => {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <Box
      id="contact"
      component="footer"
      sx={{ bgcolor: "#0f172a", pt: { xs: 8, md: 10 }, pb: 4 }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4} sx={{ mb: 6 }}>
          {/* Brand column */}
          <Grid item xs={12} md={4}>
            {/* Logo */}
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Box
                sx={{
                  width: 38, height: 38, borderRadius: "10px",
                  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  mr: 1.5,
                }}
              >
                <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>T</Typography>
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 22, color: "#ffffff", letterSpacing: "-0.5px" }}>
                Tradelink<span style={{ color: "#3b82f6" }}>247</span>
              </Typography>
            </Box>

            <Typography
              sx={{
                fontSize: 14, color: "rgba(255,255,255,0.55)",
                lineHeight: 1.75, mb: 3, maxWidth: 320,
              }}
            >
              Complete cloud ERP and POS solution for retail, supermarkets, bakeries,
              trading businesses, and multi-branch operations across India.
            </Typography>

            {/* Contact info */}
            <ContactItem icon={EmailIcon}>admin@tradelink247.com</ContactItem>
            <ContactItem icon={PhoneIcon}>+91 9995620056</ContactItem>
            <ContactItem icon={LocationOnIcon}>
              Kerala, India — serving businesses nationwide
            </ContactItem>

            {/* Social icons */}
            <Stack direction="row" spacing={0.5} sx={{ mt: 2 }}>
              {SOCIAL_ICONS.map(({ Icon, label, color }) => (
                <IconButton
                  key={label}
                  size="small"
                  aria-label={label}
                  sx={{
                    color: "rgba(255,255,255,0.4)",
                    "&:hover": { color, bgcolor: `${color}18` },
                    transition: "all 0.2s",
                  }}
                >
                  <Icon fontSize="small" />
                </IconButton>
              ))}
            </Stack>
          </Grid>

          {/* Links columns */}
          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                fontWeight: 700, fontSize: 12, color: "#94a3b8",
                letterSpacing: "1px", textTransform: "uppercase", mb: 2,
              }}
            >
              Product
            </Typography>
            {PRODUCT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                fontWeight: 700, fontSize: 12, color: "#94a3b8",
                letterSpacing: "1px", textTransform: "uppercase", mb: 2,
              }}
            >
              Company
            </Typography>
            {COMPANY_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
          </Grid>

          <Grid item xs={6} sm={4} md={2}>
            <Typography
              sx={{
                fontWeight: 700, fontSize: 12, color: "#94a3b8",
                letterSpacing: "1px", textTransform: "uppercase", mb: 2,
              }}
            >
              Support
            </Typography>
            {SUPPORT_LINKS.map((l) => <FooterLink key={l.label} {...l} />)}
          </Grid>

          {/* Demo / contact form */}
          <Grid item xs={12} sm={6} md={2}>
            <Typography
              sx={{
                fontWeight: 700, fontSize: 12, color: "#94a3b8",
                letterSpacing: "1px", textTransform: "uppercase", mb: 2,
              }}
            >
              Quick Links
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[
                { label: "🚀 Start Free Trial", action: () => scrollTo("pricing") },
                { label: "📅 Book a Demo", action: () => scrollTo("contact") },
                { label: "🔑 Login to App", action: () => window.location.href = "/login" },
              ].map((btn) => (
                <Box
                  key={btn.label}
                  onClick={btn.action}
                  sx={{
                    fontSize: 13.5,
                    color: "#60a5fa",
                    cursor: "pointer",
                    "&:hover": { color: "#93c5fd" },
                    transition: "color 0.2s",
                  }}
                >
                  {btn.label}
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", mb: 3 }} />

        {/* Bottom bar */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "center", sm: "center" },
            gap: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>
            © {new Date().getFullYear()} Tradelink247. All rights reserved.
          </Typography>
          <Box sx={{ display: "flex", gap: 3 }}>
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms-and-conditions" },
              { label: "Refund", href: "/refund-policy" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                underline="none"
                sx={{ fontSize: 13, color: "rgba(255,255,255,0.35)", "&:hover": { color: "#60a5fa" } }}
              >
                {l.label}
              </Link>
            ))}
          </Box>
          <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>
            Made with ❤️ for Indian businesses
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default LandingFooter;
