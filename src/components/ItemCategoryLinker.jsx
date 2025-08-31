import React, { useEffect, useState } from "react";
import { Box, Typography, Autocomplete, TextField, Button } from "@mui/material";

const ItemCategoryLinker = ({ itemId: propItemId }) => {
  const [itemId, setItemId] = useState(propItemId || "");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const tenancyId = localStorage.getItem("tenancyId");
  const token = localStorage.getItem("jwtToken");

  useEffect(() => {
    // load categories once
    (async () => {
      try {
        const res = await fetch(`/api/${tenancyId}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to load categories", e);
      }
    })();
  }, [tenancyId, token]);

  const linkCategory = async () => {
    if (!itemId || !selectedCategory) return;
    try {
      const res = await fetch(`/api/${tenancyId}/items/${encodeURIComponent(itemId)}/link-category`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selectedCategory.id || selectedCategory.categoryId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Link failed");
      }
      alert("Category linked successfully.");
    } catch (e) {
      console.error(e);
      alert(`Failed: ${e.message || e}`);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>Item Category Linking</Typography>

      <TextField
        label="Item ID"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        sx={{ mb: 2, width: 300 }}
      />

      <Autocomplete
        options={categories}
        getOptionLabel={(opt) =>
          typeof opt === "string" ? opt : `${opt.categoryName || opt.name} (${opt.categoryId || opt.id})`
        }
        value={selectedCategory}
        onChange={(_e, val) => setSelectedCategory(val)}
        renderInput={(params) => <TextField {...params} label="Select Category" sx={{ width: 400 }} />}
        sx={{ mb: 2 }}
      />

      <Button variant="contained" onClick={linkCategory} disabled={!itemId || !selectedCategory}>
        Link Category
      </Button>
    </Box>
  );
};

export default ItemCategoryLinker;
