import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper, Grid } from '@mui/material';

const SignupForm = () => {
  const [companyName, setCompanyName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [requestId, setRequestId] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleSendOtp = async () => {
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await response.json();
      if (response.ok) {
        setRequestId(data.requestId);
        setIsOtpSent(true);
        alert('OTP sent successfully');
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again later.');
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const response = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, otp }),
      });
      const data = await response.json();
      if (response.ok && data.verified) {
        setIsVerified(true);
        alert('OTP verified successfully');
      } else {
        alert('OTP verification failed');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again later.');
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 4,
        maxWidth: 400,
        margin: 'auto',
        marginTop: 8,
        backgroundColor: '#f0f0f0', // Change this to your desired background color
      }}
    >
      <Typography variant="h4" gutterBottom>Sign Up</Typography>
      {!isOtpSent && (
        <>
          <TextField
            label="Company Name"
            fullWidth
            margin="normal"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <TextField
            label="Username"
            fullWidth
            margin="normal"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Phone Number"
            fullWidth
            margin="normal"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <Grid item xs={12}>
            <Button onClick={handleSendOtp} variant="contained" color="primary">
              Send OTP
            </Button>
          </Grid>
        </>
          )}
           
      {isOtpSent && !isVerified && (
        <>
          <TextField
            label="OTP"
            fullWidth
            margin="normal"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <Grid item xs={12}>
            <Button onClick={handleVerifyOtp} variant="contained" color="primary">
              Verify OTP
            </Button>
          </Grid>
        </>
      )}
      {isVerified && (
        <>
          <TextField
            label="Email"
            fullWidth
            margin="normal"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
          />
          <TextField
            label="Confirm Password"
            type="password"
            fullWidth
            margin="normal"
          />
          <Grid item xs={12}>
            <Button variant="contained" color="primary">
              Sign Up
            </Button>
          </Grid>
        </>
      )}
    </Paper>
  );
};

export default SignupForm;
