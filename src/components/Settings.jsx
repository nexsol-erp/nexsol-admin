import React from 'react';
import { Typography } from '@mui/material';
import Layout from './Layout';

const Settings = () => {
  return (
    <Layout>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1">
        This is the Settings page.
      </Typography>
    </Layout>
  );
};

export default Settings;
