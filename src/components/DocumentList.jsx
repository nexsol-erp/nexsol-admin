import React, { useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Container,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
} from '@mui/material';
import { useMediaQuery } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

const DocumentList = () => {
  const [voucher, setVoucher] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(null);
  const [processMessage, setProcessMessage] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [docContents, setDocContents] = useState({});
  const [loadingContent, setLoadingContent] = useState(null);

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
      setExpandedRow(null);
      setDocContents({});
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = async (index, filePath) => {
    if (expandedRow === index) {
      setExpandedRow(null);
      return;
    }

    setExpandedRow(index);

    if (docContents[index]) return; // already fetched

    setLoadingContent(index);
    try {
      const response = await fetch(`/api/${tenancyId}/document/download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwtToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: filePath }),
      });

      if (!response.ok) throw new Error('Failed to fetch content');

      const text = await response.text();
      let formatted = text;
      try {
        formatted = JSON.stringify(JSON.parse(text), null, 2);
      } catch {}

      setDocContents(prev => ({ ...prev, [index]: formatted }));
    } catch (err) {
      setDocContents(prev => ({ ...prev, [index]: `Error: ${err.message}` }));
    } finally {
      setLoadingContent(null);
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
          onKeyDown={(e) => e.key === 'Enter' && fetchDocuments()}
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
          <Typography color={processMessage.startsWith('✔') ? 'success.main' : 'error'} sx={{ mt: 2 }}>
            {processMessage}
          </Typography>
        )}

        {documents.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              Matching Documents ({documents.length})
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    <TableCell width={40} />
                    <TableCell><strong>Voucher No.</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>File</strong></TableCell>
                    <TableCell align="center"><strong>Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc, index) => {
                    const fileName = doc.filePath ? doc.filePath.split(/[\\/]/).pop() : '';
                    const isExpanded = expandedRow === index;
                    return (
                      <React.Fragment key={index}>
                        <TableRow hover>
                          <TableCell>
                            <IconButton size="small" onClick={() => toggleRow(index, doc.filePath)}>
                              {isExpanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{doc.voucherNumber || '—'}</TableCell>
                          <TableCell>{doc.voucherType || '—'}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{fileName}</TableCell>
                          <TableCell align="center">
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              onClick={() => reprocessDocument(doc.filePath)}
                              disabled={processing === doc.filePath}
                            >
                              {processing === doc.filePath ? 'Processing...' : 'Reprocess'}
                            </Button>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={5} sx={{ py: 0, border: 0 }}>
                            <Collapse in={isExpanded} unmountOnExit>
                              <Box sx={{ py: 1, px: 2 }}>
                                {loadingContent === index ? (
                                  <CircularProgress size={20} />
                                ) : (
                                  <Box
                                    component="pre"
                                    sx={{
                                      m: 0,
                                      p: 1.5,
                                      backgroundColor: 'grey.900',
                                      color: 'grey.100',
                                      borderRadius: 1,
                                      fontSize: '0.75rem',
                                      overflowX: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-all',
                                      maxHeight: 400,
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {docContents[index] || ''}
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default DocumentList;
