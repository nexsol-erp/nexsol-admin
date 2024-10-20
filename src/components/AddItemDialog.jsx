import React, { useState } from "react";
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
} from "@mui/material";

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
      quantity: parseFloat(qty) || 0, // Ensure quantity is passed
      totalAmount: parseFloat(amount) || 0, // Ensure total amount is passed
    };

    onAddItem(newItem); // Pass newItem to the parent component
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
        <FormControl fullWidth margin="normal">
          <InputLabel>Item Name</InputLabel>
          <Select
            value={selectedItem?.itemName || ""}
            onChange={(e) => handleItemSelect(itemList.find(item => item.itemName === e.target.value))}
          >
            {itemList.map((item) => (
              <MenuItem key={item.item_id} value={item.itemName}>
                {item.itemName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Quantity"
          type="number"
          fullWidth
          margin="normal"
          value={qty}
          onChange={(e) => handleQuantityChange(e.target.value)} // Call handleQuantityChange when quantity is entered
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
