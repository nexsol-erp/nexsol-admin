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

  
  const handleTaxRateChange = (value) => {
    setTaxRate(value);
    setTotalAmount(calculateTotalAmount(standardPrice, value));
  };
  const handleStandardPriceChange = (value) => {
    setStandardPrice(value);
    setTotalAmount(calculateTotalAmount(standardPrice, value));
  };

  const handleQuantityChange = (value) => {
    setQuantity(value);
    setTotalAmount(calculateTotalAmount(standardPrice, value));
  };
  const handleAddItem = () => {
    const rateIncludingTax = parseFloat(standardPrice) || 0;
  const taxRateValue = parseFloat(taxRate) || 0;
  const rateBeforeTax = rateIncludingTax / (1 + taxRateValue / 100);
    const newItem = {
      itemName,
      barcode,
      rateIncludingTax: parseFloat(standardPrice) || 0,
      taxRate: parseFloat(taxRate) || 0,
      quantity: parseFloat(qty) || 0, // Ensure quantity is passed
      totalAmount: parseFloat(amount) || 0, // Ensure total amount is passed
      rateBeforeTax: rateBeforeTax.toFixed(2) // Set rateBeforeTax with two decimal places 
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
          label="Standard Price"
          fullWidth
          margin="normal"
          value={standardPrice}
          onChange={(e) => handleStandardPriceChange(e.target.value)} // Call handleStandardPriceChange when quantity is entered
           
        />
        <TextField
          label="Tax Rate"
          fullWidth
          margin="normal"
          value={taxRate}
          onChange={(e) => handleTaxRateChange(e.target.value)} // Call handleStandardPriceChange when quantity is entered
        
        />
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
