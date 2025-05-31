import React, { useEffect, useState } from "react";
import { TextField, Button, MenuItem, Box, Typography } from "@mui/material";

const ManageAccountHeads = () => {
  const [missingAccounts, setMissingAccounts] = useState([]);
  const [parentOptions, setParentOptions] = useState([]);
  const [formValues, setFormValues] = useState({});
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");
  useEffect(() => {
    fetch(`/api/${tenancyId}/missing-account-heads`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then(setMissingAccounts);
  
    fetch(`/api/${tenancyId}/account-heads`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched parentOptions:", data);  // 🔍 DEBUG
        setParentOptions(data);
      });
  }, []);
  

  const handleChange = (index, field, value) => {
    setFormValues({
      ...formValues,
      [index]: {
        ...formValues[index],
        [field]: value
      }
    });
  };

  const handleSubmit = (index) => {
    const data = {
        accountName: missingAccounts[index],
        accountId: formValues[index]?.accountId || "",
        isGroup: formValues[index]?.isGroup || "No",
        parentId: formValues[index]?.parentId || null // This will now be accountId of parent
      };
      

      console.log("POST data:", data);
      console.log("Auth token:", token);
      
      fetch(`/api/${tenancyId}/account-heads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(() => {
          const newList = [...missingAccounts];
          newList.splice(index, 1);
          setMissingAccounts(newList);
        })
        .catch((err) => {
          console.error("Save failed:", err);
        });
      
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Missing Account Heads
      </Typography>
      {missingAccounts.map((account, index) => (
        <Box key={index} mb={2} border={1} p={2} borderRadius={2}>
          <Typography variant="subtitle1">{account}</Typography>
          <TextField
  label="Account ID"
  fullWidth
  margin="dense"
  value={formValues[index]?.accountId || ""}
  InputProps={{ readOnly: true }}
/>

          <TextField
            label="Is Group"
            select
            fullWidth
            margin="dense"
            value={formValues[index]?.isGroup || "No"}
            onChange={(e) => handleChange(index, "isGroup", e.target.value)}
          >
            <MenuItem value="Yes">Yes</MenuItem>
            <MenuItem value="No">No</MenuItem>
          </TextField>
          <TextField
  label="Parent Account"
  select
  fullWidth
  margin="dense"
  value={formValues[index]?.parentId || ""}
  onChange={(e) => handleChange(index, "parentId", e.target.value)} // use value as string
>
  {parentOptions.map((option) => (
    <MenuItem key={option.id} value={option.accountId}>
      {option.accountName}
    </MenuItem>
  ))}
</TextField>



          <Button variant="contained" onClick={() => handleSubmit(index)}>
            Save
          </Button>
        </Box>
      ))}
    </Box>
  );
};

export default ManageAccountHeads;
