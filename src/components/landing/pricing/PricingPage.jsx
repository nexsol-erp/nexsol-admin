import React from "react";
import { Box } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import LandingNavbar from "../LandingNavbar";
import LandingFooter from "../LandingFooter";
import PricingHero from "./PricingHero";
import PricingCards from "./PricingCards";
import ComparisonTable from "./ComparisonTable";
import PricingWhyChoose from "./PricingWhyChoose";
import PerfectForSection from "./PerfectForSection";
import PricingFAQ from "./PricingFAQ";
import PricingCTA from "./PricingCTA";

// Always force light mode for the public pricing page,
// regardless of the admin app's dark theme setting.
const lightTheme = createTheme({ palette: { mode: "light" } });

const PricingPage = () => (
  <ThemeProvider theme={lightTheme}>
    <CssBaseline />
    <Box sx={{ overflowX: "hidden", bgcolor: "#ffffff" }}>
      <LandingNavbar />
      <PricingHero />
      <PricingCards />
      <ComparisonTable />
      <PricingWhyChoose />
      <PerfectForSection />
      <PricingFAQ />
      <PricingCTA />
      <LandingFooter />
    </Box>
  </ThemeProvider>
);

export default PricingPage;
