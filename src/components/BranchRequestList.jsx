import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Stack,
} from '@mui/material';

const BranchRequestList = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const [requests, setRequests] = useState([]);

  const fetchNotForwarded = async () => {
    try {
      const response = await fetch(`/api/${tenancyId}/branch-requests/not-forwarded`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
      });
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const handleApprove = async (id) => {
    try {
      const requestToApprove = requests.find(req => req.id === id);
      const updatedRequest = {
        ...requestToApprove,
        approveStatus: 1,
        forwardStatus: 1,
      };

      const response = await fetch(`/api/${tenancyId}/branch-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRequest),
      });

      if (response.ok) {
        fetchNotForwarded();
      } else {
        console.error('Failed to approve');
      }
    } catch (error) {
      console.error('Approval error:', error);
    }
  };

  useEffect(() => {
    fetchNotForwarded();
  }, []);

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Pending Branch Requests</Typography>
        <Button variant="outlined" onClick={fetchNotForwarded}>
          Refresh
        </Button>
      </Stack>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Branch Code</TableCell>
              
              <TableCell>Message Type</TableCell>
              <TableCell>Request Message</TableCell>
              <TableCell>Approve</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.sourceBranchCode}</TableCell>
                
                <TableCell>{row.messageType}</TableCell>
                <TableCell>{row.requestMessage}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleApprove(row.id)}
                  >
                    Approve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No pending requests
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default BranchRequestList;
