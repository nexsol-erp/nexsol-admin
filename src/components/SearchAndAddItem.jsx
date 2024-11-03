import React, { useState, useEffect } from 'react';
import {
  Box, TextField, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Typography, CircularProgress
} from '@mui/material';
import axios from 'axios';
import { Autocomplete } from '@mui/material';

const SearchAndAddItem = () => {
  const [itemCode, setItemCode] = useState(''); // Stores input for item code or barcode
  const [itemList, setItemList] = useState([]); // List of items fetched from API
  const [selectedItem, setSelectedItem] = useState(null); // Selected item from dropdown
  const [cartItems, setCartItems] = useState([]); // Items added to cart
  const [loading, setLoading] = useState(false); // Loading state for item search
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch items list on component load
    const fetchItems = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/items'); // Adjust this URL to your items endpoint
        setItemList(response.data);
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handleItemSelection = (event, newItem) => {
    setSelectedItem(newItem);
    setItemCode(newItem ? newItem.itemCode : '');
  };

  const addItemToTable = () => {
    if (selectedItem) {
      const newItem = {
        ...selectedItem,
        quantity: 1, // Default quantity
      };
      setCartItems([...cartItems, newItem]);
      setSelectedItem(null);
      setItemCode('');
    }
  };

  const handleQuantityChange = (index, newQuantity) => {
    const updatedCart = cartItems.map((item, i) =>
      i === index ? { ...item, quantity: newQuantity } : item
    );
    setCartItems(updatedCart);
  };

  return (
    <Box sx={{ padding: 3 }}>
      <Typography variant="h4" gutterBottom>Item Search & Add</Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 2 }}>
        <Autocomplete
          options={itemList}
          getOptionLabel={(option) => option.itemName || option.itemCode || ''}
          value={selectedItem}
          onInputChange={(event, newInputValue) => setItemCode(newInputValue)}
          onChange={handleItemSelection}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search Item by Name or Scan Barcode"
              variant="outlined"
              sx={{ width: '300px' }}
            />
          )}
        />
        <Button variant="contained" color="primary" onClick={addItemToTable} disabled={!selectedItem}>
          Add Item
        </Button>
      </Box>

      {error && <Typography color="error" sx={{ marginBottom: 2 }}>{error}</Typography>}

      {cartItems.length > 0 && (
        <TableContainer component={Paper} sx={{ marginTop: 3 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Standard Price</TableCell>
                <TableCell>Tax</TableCell>
                <TableCell>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cartItems.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.itemCode}</TableCell>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      sx={{ width: '60px' }}
                      inputProps={{ min: 1 }}
                    />
                  </TableCell>
                  <TableCell>{item.standardPrice}</TableCell>
                  <TableCell>{item.tax}%</TableCell>
                  <TableCell>{(item.standardPrice * item.quantity * (1 + item.tax / 100)).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default SearchAndAddItem;
