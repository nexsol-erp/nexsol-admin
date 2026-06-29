import React from "react";
import { Box } from "@mui/material";
import LandingNavbar from "./LandingNavbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import IndustriesSection from "./IndustriesSection";
import WhyChooseSection from "./WhyChooseSection";
import CTASection from "./CTASection";
import LandingFooter from "./LandingFooter";

const LandingPage = () => (
  <Box sx={{ overflowX: "hidden" }}>
    <LandingNavbar />
    <HeroSection />
    <FeaturesSection />
    <IndustriesSection />
    <WhyChooseSection />
    <CTASection />
    <LandingFooter />
  </Box>
);

export default LandingPage;
