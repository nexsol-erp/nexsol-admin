import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';

export default function ProfileCard() {
  const theme = useTheme();

  return (
    <Card sx={{ display: 'flex', width: 210, position: "fixed" }}>
    <CardMedia
        component="img"
        sx={{ width: 100, height: 100}}
        image="https://mui.com/static/images/cards/live-from-space.jpg"
        alt="Profile Photo"
      />
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        <CardContent sx={{ flex: '1 0 auto' }}>
          <Typography component="div" variant="h6">
            Zexor
          </Typography>
          <Typography variant="p" color="text.secondary" component="div">
            Mac Miller
          </Typography>
        </CardContent>
      </Box>
      
    </Card>
  );
}