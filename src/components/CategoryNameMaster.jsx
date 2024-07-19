import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const CategoryNameMaster = () => {
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState("");
  const [categoryTypes, setCategoryTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [fetchError, setFetchError] = useState("");

  const fetchCategoryTypes = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/categories`);
      if (!response.ok) {
        throw new Error("Failed to fetch category types");
      }
      const data = await response.json();
      setCategoryTypes(data);
    } catch (error) {
      console.error("Error fetching category types:", error);
    }
  };

  const fetchCategories = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/categoriesNames`);
      if (!response.ok) {
        throw new Error("Failed to fetch categories");
      }
      const data = await response.json();
      if (data.length === 0) {
        setFetchError("No categories found.");
      } else {
        setCategories(data);
        setFetchError("");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      setFetchError("An error occurred while fetching categories.");
    }
  };

  useEffect(() => {
    fetchCategoryTypes();
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = {
      categoryName: categoryName,
      categoryType: categoryType,
    };

    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/categoriesNames/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
        setCategoryName("");
        setCategoryType("");
        fetchCategories(); // Refresh the categories list
      } else {
        setError(data.message || "An error occurred.");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const response = await fetch(`/api/${tenancyId}/categoriesNames/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchCategories(); // Refresh the categories list
      } else {
        setError("Failed to delete category.");
      }
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred. Please try again later.");
    }
  };

  return (
    <Box
      sx={{
        flexGrow: 1,
        p: 3,
        ml: "240px",
        mt: 2,
      }}
    >
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 400 }}>
        <Typography variant="h4" gutterBottom>
          Create Category
        </Typography>
        {error && (
          <Typography color="error" variant="body1" gutterBottom>
            {error}
          </Typography>
        )}
        {success && (
          <Typography color="primary" variant="body1" gutterBottom>
            Category created successfully!
          </Typography>
        )}
        <form onSubmit={handleSubmit}>
          <FormControl fullWidth margin="normal">
            <InputLabel id="category-type-label">Category Type</InputLabel>
            <Select
              labelId="category-type-label"
              value={categoryType}
              onChange={(e) => setCategoryType(e.target.value)}
              required
            >
              {categoryTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.categoryType}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Category Name"
            fullWidth
            margin="normal"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
          />
          <Box mt={2} display="flex" justifyContent="center">
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Create Category"}
            </Button>
          </Box>
        </form>
      </Paper>

      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600, mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Existing Categories
        </Typography>
        {fetchError && <Alert severity="error">{fetchError}</Alert>}
        <Box
          sx={{
            maxHeight: 200, // Set the maximum height for the list
            overflowY: "auto", // Enable vertical scrolling
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Category Name</TableCell>
                  <TableCell>Category Type</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>{category.categoryName}</TableCell>
                    <TableCell>{category.categoryType}</TableCell>
                    <TableCell>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        onClick={() => handleDelete(category.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Paper>
    </Box>
  );
};

export default CategoryNameMaster;
