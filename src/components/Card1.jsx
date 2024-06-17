import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import { AccountCircle, AttachMoney, Money, MoneyOffCsredRounded, Storage, UsbRounded } from '@mui/icons-material';
import { Stack } from '@mui/material';

export default function MediaControlCard() {
  const theme = useTheme();

  return (
    <Card sx={{ display: 'flex', width: 310, backgroundColor: "#21295c", color: "#fff6e0" }}>
    <Stack spacing={3}>
    <CardMedia sx={{marginLeft: 10}}>
    <img src="https://mui.com/static/images/avatar/2.jpg" alt="" width={100} height={100} style={{margin: 10}} />
    <img src="https://mui.com/static/images/avatar/3.jpg" alt="" width={100} height={100} style={{margin: 10}} />
    </CardMedia>
        
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>

        <CardContent sx={{ flex: '1 2 auto' }}>
        <Typography component="div" variant="h5">
            Top Users
          </Typography>
        <Typography variant="subtitle1" color="#ffedc2" component="div">
            John Doe & Samiaya Currin
          </Typography>
        </CardContent>
      </Box>
      </Stack>
    </Card>
  );
}