import React, { useState, useEffect } from 'react';
import { TextField, Button, Typography, CircularProgress, List, ListItem, ListItemText, Paper, Container } from '@mui/material';
import axios from 'axios';

const DocumentList = () => {
  // State for Voucher and Document Data
  const [voucher, setVoucher] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

 

   

  const fetchDocuments = async () => {
    if (!voucher) {
      setError('Voucher is required');
      return;
    }

    setError('');
    setLoading(true);

    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem("tenancyId");

    try {
      const response = await fetch(`/api/${tenancyId}/${voucher}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}` // Pass JWT Token in the header
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} style={{ padding: '20px', marginTop: '20px' }}>
        <Typography variant="h5" gutterBottom>
          Document List
        </Typography>

        {/* Voucher Input Field */}
        <TextField
          label="Voucher"
          variant="outlined"
          fullWidth
          value={voucher}
          onChange={(e) => setVoucher(e.target.value)}
          placeholder="Enter Voucher"
          margin="normal"
        />

        {/* Button to trigger the API call */}
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={fetchDocuments}
          style={{ marginTop: '20px' }}
        >
          Fetch Documents
        </Button>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <CircularProgress />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Typography variant="body1" color="error" style={{ marginTop: '20px' }}>
            {error}
          </Typography>
        )}

        {/* Document List Display */}
        {documents.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <Typography variant="h6" gutterBottom>
              Documents:
            </Typography>
            <List>
              {documents.map((doc, index) => (
                <ListItem key={index}>
                  <ListItemText primary={doc.name} secondary={doc.description} />
                </ListItem>
              ))}
            </List>
          </div>
        )}
      </Paper>
    </Container>
  );
};

export default DocumentList;
