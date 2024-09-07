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
  CircularProgress,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material"; // Import MUI Icons for delete and edit
import { useTranslation } from "react-i18next"; // Import the useTranslation hook for translations

const CreateItemMaster = () => {
  const { t } = useTranslation();  
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

  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [editingItemId, setEditingItemId] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    setLoading(true);
    try {
      const response = await fetch(`/api/${tenancyId}/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.itemName || !formData.unitName) {
      setErrorMessage(t("requiredFields")); // Translate the error message
      return false;
    }
    if (formData.standardPrice && formData.standardPrice <= 0) {
      setErrorMessage(t("positivePrice")); // Translate the error message
      return false;
    }
    if (formData.taxRate && formData.taxRate < 0) {
      setErrorMessage(t("positiveTaxRate")); // Translate the error message
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    setLoading(true);
    if (editingItemId) {
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
          alert(t("updateItemSuccess")); // Translate success message
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
          setEditingItemId(null);
          fetchItems();
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.errorMessage || t("updateFailed"));
        }
      } catch (error) {
        console.error("Error updating item:", error);
        setErrorMessage(t("updateFailed"));
      } finally {
        setLoading(false);
      }
    } else {
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
          alert(t("createItemSuccess"));
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
          fetchItems();
        } else {
          const errorData = await response.json();
          setErrorMessage(errorData.errorMessage || t("createFailed"));
        }
      } catch (error) {
        console.error("Error creating new Item:", error);
        setErrorMessage(t("createFailed"));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" align="center" gutterBottom>
        {editingItemId ? t("editItem") : t("createItem")}
      </Typography>

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
              label={t("itemName")}
              name="itemName"
              value={formData.itemName}
              onChange={handleChange}
              required
            />
          </Grid>

          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="unit-name-label">{t("unitName")}</InputLabel>
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
              label={t("standardPrice")}
              name="standardPrice"
              type="number"
              value={formData.standardPrice}
              onChange={handleChange}
              inputProps={{ min: "0" }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("barcode")}
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("itemCode")}
              name="itemCode"
              value={formData.itemCode}
              onChange={handleChange}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("taxRate")}
              name="taxRate"
              type="number"
              value={formData.taxRate}
              onChange={handleChange}
              inputProps={{ min: "0" }}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label={t("hsnCode")}
              name="hsnCode"
              value={formData.hsnCode}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              {editingItemId ? t("updateItem") : t("submit")}
            </Button>
          </Grid>
        </Grid>
      </form>

      <Typography variant="h5" align="center" gutterBottom sx={{ mt: 5 }}>
        {t("listOfItems")}
      </Typography>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("itemName")}</TableCell>
                <TableCell>{t("unitName")}</TableCell>
                <TableCell>{t("standardPrice")}</TableCell>
                <TableCell>{t("actions")}</TableCell>
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
      )}
    </Container>
  );
};

export default CreateItemMaster;
