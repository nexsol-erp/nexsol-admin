import React, { useEffect, useState } from "react";
import {
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Typography,
    Alert,
    List,
    ListItem,
    ListItemText,
} from "@mui/material";
import { useLocation } from "react-router-dom";

const ItemCategoryMapping = () => {
    const location = useLocation();
    const preselectedItem = location.state?.selectedItem || null;

    const [categories, setCategories] = useState([]);
    const [selectedItem, setSelectedItem] = useState(preselectedItem?.id || "");
    const [selectedCategory, setSelectedCategory] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");
    const [mappings, setMappings] = useState([]);

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    const fetchCategories = async () => {
        try {
            const res = await fetch(`/api/${tenancyId}/categoriesNames`, {
                headers: authHeaders,
            });
            const data = await res.json();
            setCategories(data || []);
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };


    const fetchMappings = async () => {
        if (!preselectedItem?.id) return;

        try {
            const res = await fetch(`/api/${tenancyId}/item-category-map/by-item/${preselectedItem.id}`, {
                headers: authHeaders,
            });
            const data = await res.json();
            setMappings(data || []);
        } catch (err) {
            console.error("Error fetching mappings:", err);
        }
    };

    useEffect(() => {
        fetchCategories();
        fetchMappings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);

        try {
            const res = await fetch(`/api/${tenancyId}/item-category-map`, {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({
                    itemId: selectedItem,
                    categoryId: selectedCategory,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to map item to category");
            }

            setSuccess(true);
            if (!preselectedItem) setSelectedItem("");
            setSelectedCategory("");
            fetchMappings();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };


    const handleDelete = async (mapId) => {
        if (!window.confirm("Are you sure you want to delete this mapping?")) return;

        try {
            const res = await fetch(`/api/${tenancyId}/item-category-map/${mapId}`, {
                method: "DELETE",
                headers: authHeaders,
            });

            if (!res.ok && res.status !== 204) {
                throw new Error("Failed to delete mapping.");
            }

            // Refresh the list
            fetchMappings();
        } catch (err) {
            console.error("Error deleting mapping:", err);
            setError("Failed to delete mapping.");
        }
    };


    return (
        <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
            <Paper elevation={3} sx={{ padding: 4, maxWidth: 500 }}>
                <Typography variant="h4" gutterBottom>
                    Map Item to Category
                </Typography>

                {error && <Alert severity="error">{error}</Alert>}
                {success && <Alert severity="success">Mapping created successfully!</Alert>}

                <form onSubmit={handleSubmit}>
                    {/* Display selected item */}
                    {preselectedItem ? (
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1">
                                <strong>Item:</strong> {preselectedItem.itemName}
                            </Typography>
                        </Box>
                    ) : (
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Item</InputLabel>
                            <Select
                                value={selectedItem}
                                onChange={(e) => setSelectedItem(e.target.value)}
                                required
                            >
                                {/* You may fetch and populate items if not coming from previous page */}
                                <MenuItem value="">Select Item</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    <FormControl fullWidth margin="normal">
                        <InputLabel>Category</InputLabel>
                        <Select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            required
                        >
                            {categories.map((cat) => (
                                <MenuItem key={cat.id} value={cat.id}>
                                    {cat.categoryName}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Box mt={2} display="flex" justifyContent="center">
                        <Button type="submit" variant="contained" color="primary" disabled={loading}>
                            {loading ? <CircularProgress size={24} /> : "Save Mapping"}
                        </Button>
                    </Box>
                </form>

                <Box mt={4}>
                    <Typography variant="h6" gutterBottom>
                        Existing Mappings
                    </Typography>
                    <Box sx={{ maxHeight: 200, overflowY: "auto" }}>
                        <List>
                            {mappings.map((map, index) => (
                                <ListItem
                                    key={map.id || index}
                                    secondaryAction={
                                        <Button
                                            variant="outlined"
                                            color="error"
                                            size="small"
                                            onClick={() => handleDelete(map.id)}
                                        >
                                            Delete
                                        </Button>
                                    }
                                >
                                    <ListItemText
                                        primary={`Item: ${map.itemName} → Category: ${map.categoryName}`}
                                    />
                                </ListItem>
                            ))}
                        </List>

                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default ItemCategoryMapping;
