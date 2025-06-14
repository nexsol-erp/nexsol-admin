import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper,
  Container,
  Box,
} from '@mui/material';
import { useMediaQuery } from '@mui/material';

const DocumentList = () => {
  const [voucher, setVoucher] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [processMessage, setProcessMessage] = useState('');

  const isMobile = useMediaQuery('(max-width:600px)');
  const jwtToken = localStorage.getItem('jwtToken');
  const tenancyId = localStorage.getItem('tenancyId');

  const fetchDocuments = async () => {
    if (!voucher) {
      setError('Voucher is required');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/${tenancyId}/document/search/${voucher}`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch documents');

      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (filename) => {
    try {
      const response = await fetch(`/api/${tenancyId}/document/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!response.ok) throw new Error('Failed to download document');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Failed to download document');
    }
  };

  const reprocessDocument = async (filename) => {
    setProcessing(filename);
    setProcessMessage('');

    try {
      const fileResponse = await fetch(`/api/${tenancyId}/document/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename }),
      });

      if (!fileResponse.ok) throw new Error('Failed to fetch file content');

      const fileText = await fileResponse.text();

      const res = await fetch(`/api/${tenancyId}/vouchers/reprocess`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: fileText,
      });

      const result = await res.text();

      if (res.ok) {
        setProcessMessage(`✔ Reprocessed: ${filename}`);
      } else {
        throw new Error(result);
      }
    } catch (err) {
      setProcessMessage(`❌ Error: ${err.message}`);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant={isMobile ? 'h6' : 'h5'} gutterBottom>
          Search and Reprocess Documents
        </Typography>

        <TextField
          label="Voucher"
          variant="outlined"
          fullWidth
          value={voucher}
          onChange={(e) => setVoucher(e.target.value)}
          placeholder="Enter Voucher Number"
          margin="normal"
        />

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={fetchDocuments}
          sx={{ mt: 2 }}
        >
          Fetch Documents
        </Button>

        {loading && (
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ mt: 3 }}>
            {error}
          </Typography>
        )}

        {processMessage && (
          <Typography color="secondary" sx={{ mt: 2 }}>
            {processMessage}
          </Typography>
        )}

        {documents.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Matching Documents:
            </Typography>
            <List>
              {documents.map((doc, index) => (
                <ListItem key={index} divider>
                  <ListItemText
                    primary={
                      <span
                        dangerouslySetInnerHTML={{ __html: doc.snippet }}
                      />
                    }
                    secondary={
                      <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          onClick={() => downloadDocument(doc.filePath)}
                        >
                          Download
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          onClick={() => reprocessDocument(doc.filePath)}
                          disabled={processing === doc.filePath}
                        >
                          {processing === doc.filePath ? 'Processing...' : 'Reprocess'}
                        </Button>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default DocumentList;
