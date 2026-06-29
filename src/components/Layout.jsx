import React from 'react';
import { Box, Container, CssBaseline } from '@mui/material';

const Layout = ({ children }) => {
  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
      <CssBaseline />
      <Box
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          pt: 3,
          pb: 4,
          px: { xs: 2, md: 4 },
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {children}
      </Box>
    </Container>
  );
};

export default Layout;
