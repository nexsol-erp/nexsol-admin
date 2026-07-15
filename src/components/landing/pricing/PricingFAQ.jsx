import React from "react";
import {
  Box, Typography, Container, Chip, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";

const FAQS = [
  {
    q: "Is there a free trial?",
    a: "Yes. Every new business gets a full 30-day free trial with complete access to the ERP — no credit card required.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. All plans are month-to-month with no long-term lock-in. You can cancel anytime from your account settings.",
  },
  {
    q: "Can I upgrade later?",
    a: "Absolutely. You can upgrade from Starter to Silver, Gold, or Enterprise at any time as your business grows — your data carries over automatically.",
  },
  {
    q: "Do you provide training?",
    a: "Yes. Gold and Enterprise plans include free onboarding and training. Starter and Silver customers get guided setup documentation and email support.",
  },
  {
    q: "Is data secure?",
    a: "Yes. TradeLink247 uses encrypted cloud storage, JWT-secured logins, role-based access control, and automated daily backups.",
  },
  {
    q: "Can I migrate from Tally?",
    a: "Yes. TradeLink247 offers built-in Tally integration and migration assistance to help you move your ledgers and masters without disruption.",
  },
  {
    q: "Do you support offline billing?",
    a: "Yes. Our Offline POS mode lets you continue billing during internet outages, automatically syncing data once connectivity is restored.",
  },
];

const PricingFAQ = () => (
  <Box id="faq" sx={{ py: { xs: 8, md: 12 }, bgcolor: "#f8fafc" }}>
    <Container maxWidth="md">
      <Box sx={{ textAlign: "center", mb: { xs: 5, md: 6 } }}>
        <Chip
          label="FAQ"
          size="small"
          sx={{
            bgcolor: "#dbeafe", color: "#1d4ed8",
            fontWeight: 700, letterSpacing: "1px", mb: 2, fontSize: 11,
          }}
        />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800, fontSize: { xs: "1.9rem", md: "2.4rem" },
            color: "#0f172a", letterSpacing: "-0.5px",
          }}
        >
          Frequently Asked Questions
        </Typography>
      </Box>

      {FAQS.map((f) => (
        <Accordion
          key={f.q}
          elevation={0}
          sx={{
            mb: 1.5, borderRadius: "14px !important", border: "1px solid #e2e8f0",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{f.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography sx={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{f.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Container>
  </Box>
);

export default PricingFAQ;
