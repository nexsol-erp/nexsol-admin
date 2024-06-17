import React from 'react';
import { Box, Container, CssBaseline } from '@mui/material';

const Layout = ({ children }) => {
  return (
    <Container component="main" maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <CssBaseline />
      <Box
        sx={{
          bgcolor: 'background.paper',
          pt: 4,
          pb: 4,
          px: 4,
          borderRadius: 2,
          boxShadow: 1,
        }}
      >
        {children}
      </Box>
    </Container>
  );
};

export default Layout;
