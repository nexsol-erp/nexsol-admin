import React, { useState } from 'react';
import { TextField, Button, Typography, CircularProgress, List, ListItem, ListItemText, Paper, Container } from '@mui/material';
import { useMediaQuery } from '@mui/material'; // Import useMediaQuery for responsiveness

const DocumentList = () => {
  const [voucher, setVoucher] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Detect if the screen is small (mobile)
  const isMobile = useMediaQuery('(max-width:600px)');

  const fetchDocuments = async () => {
    if (!voucher) {
      setError('Voucher is required');
      return;
    }

    setError('');
    setLoading(true);

    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');

    try {
      const response = await fetch(`/api/${tenancyId}/document/search/${voucher}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`, // Pass JWT Token in the header
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();

      // Set the returned documents directly
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (filename) => {
    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');

    try {
      const response = await fetch(`/api/${tenancyId}/document/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`, // Pass JWT Token in the header
          'Content-Type': 'application/json',   // Set content type to JSON
        },
        body: JSON.stringify({ filename }),      // Send filename in the body
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      // Create a blob from the response data and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename); // Set the filename for download
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document');
    }
  };

  return (
    <Container maxWidth="md" style={isMobile ? { padding: '10px' } : { padding: '20px' }}>
      <Paper elevation={3} style={{ padding: isMobile ? '10px' : '20px', marginTop: isMobile ? '10px' : '20px' }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
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
          style={{ fontSize: isMobile ? '14px' : '16px' }} // Adjust font size for mobile
        />

        {/* Button to trigger the API call */}
        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={fetchDocuments}
          style={{ marginTop: isMobile ? '10px' : '20px', fontSize: isMobile ? '14px' : '16px' }} // Adjust margin and font size
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
            <Typography variant={isMobile ? 'h6' : 'h6'} gutterBottom>
              Documents:
            </Typography>
            <List>
              {documents.map((doc, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={<span dangerouslySetInnerHTML={{ __html: doc.snippet }} />}  // Display snippet (contains bold tags)
                    secondary={
                      doc.filePath ? (
                        <Button
                          variant="contained"
                          color="primary"
                          size={isMobile ? 'small' : 'medium'}
                          onClick={() => downloadDocument(doc.filePath)}
                        >
                          Download Document
                        </Button>
                      ) : (
                        <span>No document available</span>  // Fallback if filePath is null
                      )
                    }
                    style={{ fontSize: isMobile ? '12px' : '14px' }} // Adjust font size for mobile
                  />
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