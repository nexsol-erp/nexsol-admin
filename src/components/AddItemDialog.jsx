import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

const AddItemDialog = ({ open, onClose, onAddItem, itemList }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemName, setItemName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [standardPrice, setStandardPrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [qty, setQuantity] = useState("");
  const [amount, setTotalAmount] = useState("");

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setItemName(item.itemName);
    setBarcode(item.barcode);
    setStandardPrice(item.standardPrice);
    setTaxRate(item.taxRate);
    setTotalAmount(calculateTotalAmount(item.standardPrice, qty));
  };

  const calculateTotalAmount = (price, qty) => {
    const parsedPrice = parseFloat(price) || 0;
    const parsedQty = parseFloat(qty) || 0;
    return (parsedPrice * parsedQty).toFixed(2);
  };

  const handleQuantityChange = (value) => {
    setQuantity(value);
    setTotalAmount(calculateTotalAmount(standardPrice, value));
  };

  const handleAddItem = () => {
    const newItem = {
      itemName,
      barcode,
      standardPrice: parseFloat(standardPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      qty: parseFloat(qty) || 0,
      amount: parseFloat(amount) || 0,
    };

    onAddItem(newItem);
    resetFields();
  };

  const resetFields = () => {
    setSelectedItem(null);
    setItemName("");
    setBarcode("");
    setStandardPrice("");
    setTaxRate("");
    setQuantity("");
    setTotalAmount("");
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Add Item</DialogTitle>
      <DialogContent>
        <TextField
          label="Barcode"
          fullWidth
          margin="normal"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={(event) => {
            if (event.key === "Enter") {
              const fetchedItem = itemList.find((item) => item.barcode === barcode);
              if (fetchedItem) {
                handleItemSelect(fetchedItem);
              } else {
                alert("Item not found");
              }
            }
          }}
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Item Name</InputLabel>
          <Select
            value={selectedItem?.itemName || ""}
            onChange={(e) =>
              handleItemSelect(itemList.find(item => item.itemName === e.target.value))
            }
          >
            {itemList.map((item) => (
              <MenuItem key={item.item_id} value={item.itemName}>
                {item.itemName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Standard Price"
          fullWidth
          margin="normal"
          value={standardPrice}
          disabled
        />
        <TextField
          label="Tax Rate"
          fullWidth
          margin="normal"
          value={taxRate}
          disabled
        />
        <TextField
          label="Quantity"
          type="number"
          fullWidth
          margin="normal"
          value={qty}
          onChange={(e) => handleQuantityChange(e.target.value)}
        />
        <TextField
          label="Total Amount"
          fullWidth
          margin="normal"
          value={amount}
          disabled
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleAddItem} color="primary">
          Add Item
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddItemDialog;
