import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
} from "@mui/material";

const CategoryTypeMaster = () => {
  const [categoryType, setCategoryType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [fetchError, setFetchError] = useState("");

  const fetchCategories = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/categories`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
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
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const formData = {
      categoryType: categoryType,
    };

    try {
      const tenancyId = localStorage.getItem("tenancyId");
         const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/categories/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(true);
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
          <TextField
            label="Category Type"
            fullWidth
            margin="normal"
            value={categoryType}
            onChange={(e) => setCategoryType(e.target.value)}
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
        <Box mt={4}>
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
            <List>
              {categories.map((category) => (
                <ListItem key={category.id}>
                  <ListItemText primary={category.categoryType} />
                </ListItem>
              ))}
            </List>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default CategoryTypeMaster;
