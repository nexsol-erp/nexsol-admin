import React from "react";
import { Box } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import LandingNavbar from "./LandingNavbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import IndustriesSection from "./IndustriesSection";
import WhyChooseSection from "./WhyChooseSection";
import CTASection from "./CTASection";
import LandingFooter from "./LandingFooter";

// Always force light mode for the public landing page,
// regardless of the admin app's dark theme setting.
const lightTheme = createTheme({ palette: { mode: "light" } });

const LandingPage = () => (
  <ThemeProvider theme={lightTheme}>
    <CssBaseline />
    <Box sx={{ overflowX: "hidden", bgcolor: "#ffffff" }}>
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <IndustriesSection />
      <WhyChooseSection />
      <CTASection />
      <LandingFooter />
    </Box>
  </ThemeProvider>
);

export default LandingPage;
