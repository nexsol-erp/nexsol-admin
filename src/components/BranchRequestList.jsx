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
  Autocomplete,
  TextField,
} from '@mui/material';

const BranchRequestList = () => {
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  const [requests, setRequests] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(null);

  const [pendingMessages, setPendingMessages] = useState([]);
const [selectedKafkaBranch, setSelectedKafkaBranch] = useState(null);

const fetchKafkaMessages = async () => {
  if (!selectedKafkaBranch) {
    alert('Please select a branch to view messages');
    return;
  }

  try {
    const response = await fetch(`/api/${tenancyId}/pending-messages/${selectedKafkaBranch.branchCode}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setPendingMessages(data);
    } else {
      alert('Failed to fetch messages');
    }
  } catch (error) {
    console.error('Error fetching Kafka messages:', error);
  }
};

  const fetchNotForwarded = async () => {
    try {
      const response = await fetch(`/api/${tenancyId}/branch-requests/not-forwarded`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

useEffect(() => {
    // Fetch branches from the backend API
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
        const response = await fetch(`/api/${tenancyId}/branches`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        const data = await response.json();
        setBranches(data.branches);
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };

    fetchBranches();
  }, []);

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

  const handleReject = async (id) => {
    try {
      const requestToApprove = requests.find(req => req.id === id);
      const updatedRequest = {
        ...requestToApprove,
        approveStatus: 1,
        forwardStatus: 1,
      };

      const response = await fetch(`/api/${tenancyId}/branch-requests`, {
        method: 'DELETE',
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

  const handleSendFetchMessage = async () => {
    if (!selectedBranch) {
      alert('Please select a branch');
      return;
    }
  
    try {
      const token = localStorage.getItem("jwtToken");
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/fetchpending`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedBranch.branchCode), // Send raw string in JSON format
      });
  
      if (response.ok) {
        alert(`Fetch command sent to ${selectedBranch.branchCode}`);
      } else {
        alert('Failed to send fetch command');
      }
    } catch (error) {
      console.error('Fetch command error:', error);
    }
  };

  useEffect(() => {
    fetchNotForwarded();
    
  }, []);

  return (
    <Box
  sx={{
    p: 3,
    maxWidth: '100vw',
    maxHeight: '100vh',
    overflow: 'auto',
     
  }}
>

     
     <Typography variant="h5" gutterBottom>
        Fetch Data Request to branch
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" mb={3}>
        <Autocomplete
          options={branches}
          getOptionLabel={(option) =>  option.branchCode}
          value={selectedBranch}
          onChange={(e, newValue) => setSelectedBranch(newValue)}
          sx={{ width: 300 }}
          renderInput={(params) => <TextField {...params} label="Select Branch" />}
        />
        <Button variant="contained" color="secondary" onClick={handleSendFetchMessage}>
          Send Fetch Command
        </Button>
      
      </Stack>

      <Typography variant="h5" gutterBottom>
        Branch Requests Pending for approval
      </Typography>
      <Button variant="outlined" onClick={fetchNotForwarded}>
          Refresh
        </Button>
        <TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>

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
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => handleReject(row.id)}
                  >
                    Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  No pending requests
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

<Typography variant="h5" gutterBottom mt={4}>
  Pending Messages to Branch
</Typography>

<Stack direction="row" spacing={2} alignItems="center" mb={2}>
  <Autocomplete
    options={branches}
    getOptionLabel={(option) => option.branchCode}
    value={selectedKafkaBranch}
    onChange={(e, newValue) => setSelectedKafkaBranch(newValue)}
    sx={{ width: 300 }}
    renderInput={(params) => <TextField {...params} label="Select Branch" />}
  />
  <Button variant="contained" onClick={fetchKafkaMessages}>
    Load Messages
  </Button>
</Stack>

<TableContainer component={Paper} sx={{ maxWidth: '100%', overflowX: 'auto' }}>

  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Message</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {pendingMessages.map((msg, index) => (
        <TableRow key={index}>
          <TableCell>{msg}</TableCell>
        </TableRow>
      ))}
      {pendingMessages.length === 0 && (
        <TableRow>
          <TableCell colSpan={1} align="center">
            No pending messages
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
