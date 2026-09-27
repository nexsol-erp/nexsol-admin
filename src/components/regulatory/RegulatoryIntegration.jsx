// RegulatoryIntegration.jsx
// E-Invoicing: connect the company to a tax authority provider (ZATCA, MyInvois, India IRP, HMRC
// MTD VAT, or the MOCK provider for testing), store its credentials, test the connection, follow
// what was submitted, and file periodic VAT returns. Backed by /api/{tenant}/regulatory on server-postgres.
import React, { useState } from "react";
import { Box, Paper, Tab, Tabs, Typography } from "@mui/material";
import ProviderSetup from "./ProviderSetup";
import SubmissionsPanel from "./SubmissionsPanel";
import TaxReturnsPanel from "./TaxReturnsPanel";

const RegulatoryIntegration = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5">E-Invoicing</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Connect to the tax authority, keep its credentials, and follow every invoice sent to it.
        </Typography>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tab label="Provider setup" />
          <Tab label="Submissions" />
          <Tab label="VAT returns" />
        </Tabs>
        {tab === 0 ? <ProviderSetup /> : tab === 1 ? <SubmissionsPanel /> : <TaxReturnsPanel />}
      </Paper>
    </Box>
  );
};

export default RegulatoryIntegration;
