import React from "react";
import { Box, Container, Grid } from "@mui/material";
import PricingCard from "./PricingCard";
import { PLANS } from "./pricingPlans";

const PricingCards = () => (
  <Box id="plans" sx={{ py: { xs: 6, md: 10 }, bgcolor: "#f8fafc" }}>
    <Container maxWidth="xl">
      <Grid container spacing={3} alignItems="stretch">
        {PLANS.map((plan) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={plan.id}>
            <PricingCard plan={plan} />
          </Grid>
        ))}
      </Grid>
    </Container>
  </Box>
);

export default PricingCards;
