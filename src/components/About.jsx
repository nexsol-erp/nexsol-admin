import React from 'react';
import { Typography } from '@mui/material';
import Layout from './Layout';

const About = () => {
  return (
    <Layout>
      <Typography variant="h4" gutterBottom>
        About
      </Typography>
      <Typography variant="body1">
        This is the About page.
      </Typography>
    </Layout>
  );
};

export default About;
