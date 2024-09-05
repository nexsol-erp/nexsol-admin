import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Grid,
  Typography,
  Container,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material"; // Import MUI Icons for delete and edit

const CreateItemMaster = () => {
  const [formData, setFormData] = useState({
    itemName: "",
    unitName: "",
    standardPrice: "",
    barcode: "",
    itemCode: "",
    taxRate: "",
    hsnCode: "",
    unitId: "",
  });

  const [errorMessage, setErrorMessage] = useState(null); // State to store error message
  const [items, setItems] = useState([]); // State to store the list of items
  const [editingItemId, setEditingItemId] = useState(null); // State to track the currently editing item

  // Fetch the list of items from the backend when the component loads
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    try {
      const response = await fetch(`/api/${tenancyId}/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setItems(data); // Set the list of items
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    // Determine if this is a create or update operation
    if (editingItemId) {
      // Update existing item (PUT request)
      try {
        const response = await fetch(
          `/api/${tenancyId}/items/${editingItemId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(formData),
          }
        );

        if (response.ok) {
          alert("Item updated successfully");
          setErrorMessage(null); // Clear any existing error message
          setEditingItemId(null); // Clear the editing state after successful update
          setFormData({
            itemName: "",
            unitName: "",
            standardPrice: "",
            barcode: "",
            itemCode: "",
            taxRate: "",
            hsnCode: "",
            unitId: "",
          });
          fetchItems(); // Refresh the list of items after updating
        } else {
          // Extract error message from the response
          const errorData = await response.json();
          setErrorMessage(errorData.errorMessage || "Failed to update item.");
        }
      } catch (error) {
        console.error("Error updating item:", error);
        setErrorMessage("An error occurred while updating the item.");
      }
    } else {
      // Create a new item (POST request)
      try {
        const response = await fetch(`/api/${tenancyId}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          alert("New Item created");
          setErrorMessage(null); // Clear any existing error message
          setFormData({
            itemName: "",
            unitName: "",
            standardPrice: "",
            barcode: "",
            itemCode: "",
            taxRate: "",
            hsnCode: "",
            unitId: "",
          });
          fetchItems(); // Refresh the list of items after creating a new one
        } else {
          // Extract error message from the response
          const errorData = await response.json();
          setErrorMessage(
            errorData.errorMessage || "Failed to create new item."
          );
        }
      } catch (error) {
        console.error("Error creating new Item:", error);
        setErrorMessage("An error occurred while creating the item.");
      }
    }
  };

  const handleDelete = async (itemId) => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    try {
      const response = await fetch(`/api/${tenancyId}/items/${itemId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert("Item deleted");
        fetchItems(); // Refresh the list of items after deletion
      } else {
        alert("Failed to delete item.");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("An error occurred while deleting the item.");
    }
  };

  const handleEdit = (item) => {
    // Prepopulate form data for editing and set the item ID
    setFormData({
      itemName: item.itemName,
      unitName: item.unitName,
      standardPrice: item.standardPrice,
      barcode: item.barcode,
      itemCode: item.itemCode,
      taxRate: item.taxRate,
      hsnCode: item.hsnCode,
      unitId: item.unitId,
    });
    setEditingItemId(item.id); // Set the editing item ID
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" align="center" gutterBottom>
        {editingItemId ? "Edit Item" : "Create Item Master"}
      </Typography>

      {/* Display error message if there is one */}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Item Name"
              name="itemName"
              value={formData.itemName}
              onChange={handleChange}
              required
            />
          </Grid>

          {/* Unit Name Combo Box */}
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="unit-name-label">Unit Name</InputLabel>
              <Select
                labelId="unit-name-label"
                name="unitName"
                value={formData.unitName}
                onChange={handleChange}
                required
              >
                <MenuItem value="NOS">NOS</MenuItem>
                <MenuItem value="LTR">LTR</MenuItem>
                <MenuItem value="KGS">KGS</MenuItem>
                <MenuItem value="PACKET">PACKET</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Standard Price"
              name="standardPrice"
              type="number"
              value={formData.standardPrice}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Barcode"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Item Code"
              name="itemCode"
              value={formData.itemCode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Tax Rate"
              name="taxRate"
              type="number"
              value={formData.taxRate}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="HSN Code"
              name="hsnCode"
              value={formData.hsnCode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              {editingItemId ? "Update Item" : "Submit"}
            </Button>
          </Grid>
        </Grid>
      </form>

      <Typography variant="h5" align="center" gutterBottom sx={{ mt: 5 }}>
        List of Items
      </Typography>

      {/* Table to list all the items */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item Name</TableCell>
              <TableCell>Unit Name</TableCell>
              <TableCell>Standard Price</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.itemName}</TableCell>
                <TableCell>{item.unitName}</TableCell>
                <TableCell>{item.standardPrice}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleEdit(item)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(item.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};

export default CreateItemMaster;
