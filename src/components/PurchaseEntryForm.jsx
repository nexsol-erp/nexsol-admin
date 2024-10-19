import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useWebSocket } from "./WebSocketContext"; // Adjust the import path as needed

const PurchaseEntryForm = () => {
  const { data } = useWebSocket(); // Use WebSocket context to get the data
  const [supplierName, setSupplierName] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [voucherNumber, setVoucherNumber] = useState("");
  const [voucherDate, setVoucherDate] = useState("");
  const [items, setItems] = useState([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemList, setItemList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [rateBeforeTax, setRateBeforeTax] = useState("");
  const [rateIncludingTax, setRateIncludingTax] = useState("");
  const [quantity, setQuantity] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  useEffect(() => {
    if (data.items) {
      setItemList(data.items);
    }
  }, [data.items]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
  
        const response = await fetch(`/api/${tenancyId}/suppliers`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Add the JWT token here
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch suppliers");
        }
  
        const data = await response.json();
        setSuppliers(data);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };
  
    fetchSuppliers();
  }, []); // The empty dependency array ensures this runs once when the component mounts
  
  const calculateTotalAmount = (rate, qty, tax) => {
    const parsedRate = parseFloat(rate) || 0;
    const parsedQty = parseFloat(qty) || 0;
    const parsedTax = parseFloat(tax) || 0;

    const baseAmount = parsedRate * parsedQty;
    const taxAmount = (baseAmount * parsedTax) / 100;
    return (baseAmount + taxAmount).toFixed(2);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        itemName: selectedItem,
        rateBeforeTax: parseFloat(rateBeforeTax),
        rateIncludingTax: parseFloat(rateIncludingTax),
        quantity: parseFloat(quantity),
        taxRate: parseFloat(taxRate),
        totalAmount: parseFloat(totalAmount),
      },
    ]);
    setItemDialogOpen(false);
    setSelectedItem(null);
    setRateBeforeTax("");
    setRateIncludingTax("");
    setQuantity("");
    setTaxRate("");
    setTotalAmount("");
  };

  const handleRateBeforeTaxChange = (value) => {
    const parsedRate = parseFloat(value) || 0;
    const parsedTax = parseFloat(taxRate) || 0;

    const rateWithTax = (parsedRate * (1 + parsedTax / 100)).toFixed(2);
    setRateBeforeTax(value);
    setRateIncludingTax(rateWithTax);
    setTotalAmount(calculateTotalAmount(value, quantity, taxRate));
  };

  const handleRateIncludingTaxChange = (value) => {
    const parsedRate = parseFloat(value) || 0;
    const parsedTax = parseFloat(taxRate) || 0;

    const rateWithoutTax = (parsedRate / (1 + parsedTax / 100)).toFixed(2);
    setRateIncludingTax(value);
    setRateBeforeTax(rateWithoutTax);
    setTotalAmount(calculateTotalAmount(rateWithoutTax, quantity, taxRate));
  };

  const handleInputChange = (setter, value, calculationField) => {
    setter(value);
    if (calculationField === "totalAmount") {
      setTotalAmount(calculateTotalAmount(rateBeforeTax, quantity, taxRate));
    }
  };

  const handleDeleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () =>
    items.reduce((total, item) => total + item.totalAmount, 0).toFixed(2);

  const calculateTaxByRate = () => {
    const taxByRate = items.reduce((acc, item) => {
      const baseAmount = item.rateBeforeTax * item.quantity;
      const taxAmount = (baseAmount * item.taxRate) / 100;
      if (!acc[item.taxRate]) {
        acc[item.taxRate] = 0;
      }
      acc[item.taxRate] += taxAmount;
      return acc;
    }, {});

    return Object.entries(taxByRate).map(([rate, amount]) => ({
      rate,
      amount: amount.toFixed(2),
    }));
  };

  const handlePartialSave = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const payload = {
      supplierName,
      voucherNumber,
      voucherDate,
      items,
    };

    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/partial-save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert("Partial save successful!");
      } else {
        alert("Partial save failed!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during partial save. Please try again later.");
    }
  };

  const handleFinalSave = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const payload = {
      supplierName,
      voucherNumber,
      voucherDate,
      items,
    };

    try {
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/final-save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        alert("Final save successful!");
      } else {
        alert("Final save failed!");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred during final save. Please try again later.");
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 800 }}>
        <Typography variant="h4" gutterBottom>
          Purchase Entry
        </Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>Supplier</InputLabel>
          <Select
            value={supplier}
            onChange={(e) => setSupplierName(e.target.value)}
          >
            {suppliers.map((supplier) => (
              <MenuItem key={supplier.id} value={supplier.supplierName}>
                {supplier.supplierName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Supplier Voucher Number"
          fullWidth
          margin="normal"
          value={voucherNumber}
          onChange={(e) => setVoucherNumber(e.target.value)}
        />
        <TextField
          label="Voucher Date"
          type="date"
          fullWidth
          margin="normal"
          InputLabelProps={{ shrink: true }}
          value={voucherDate}
          onChange={(e) => setVoucherDate(e.target.value)}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => setItemDialogOpen(true)}
          sx={{ mb: 3 }}
        >
          Add Item
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Name</TableCell>
                <TableCell>Rate before tax</TableCell>
                <TableCell>Rate including Tax</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Tax Rate</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.rateBeforeTax.toFixed(2)}</TableCell>
                  <TableCell>{item.rateIncludingTax.toFixed(2)}</TableCell>
                  <TableCell>{item.quantity.toFixed(2)}</TableCell>
                  <TableCell>{item.taxRate.toFixed(2)}%</TableCell>
                  <TableCell>{item.totalAmount.toFixed(2)}</TableCell>
                  <TableCell>
                    <IconButton
                      onClick={() => handleDeleteItem(index)}
                      color="secondary"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                  Grand Total
                </TableCell>
                <TableCell sx={{ fontWeight: "bold" }}>
                  {calculateGrandTotal()}
                </TableCell>
              </TableRow>
              {calculateTaxByRate().map((tax) => (
                <TableRow key={tax.rate}>
                  <TableCell colSpan={5} sx={{ fontWeight: "bold" }}>
                    Total Tax at {tax.rate}%
                  </TableCell>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    {tax.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Box mt={2} display="flex" justifyContent="space-between">
          <Button
            variant="contained"
            color="primary"
            onClick={handlePartialSave}
          >
            Partial Save
          </Button>
          <Button variant="contained" color="primary" onClick={handleFinalSave}>
            Final Save
          </Button>
        </Box>
      </Paper>

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)}>
        <DialogTitle>Add Item</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Item Name</InputLabel>
            <Select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
            >
              {itemList.map((item) => (
                <MenuItem key={item.item_id} value={item.item_name}>
                  {item.item_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Rate before tax"
            type="number"
            fullWidth
            margin="normal"
            value={rateBeforeTax}
            onChange={(e) => handleRateBeforeTaxChange(e.target.value)}
          />
          <TextField
            label="Rate including Tax"
            type="number"
            fullWidth
            margin="normal"
            value={rateIncludingTax}
            onChange={(e) => handleRateIncludingTaxChange(e.target.value)}
          />
          <TextField
            label="Quantity"
            type="number"
            fullWidth
            margin="normal"
            value={quantity}
            onChange={(e) =>
              handleInputChange(setQuantity, e.target.value, "totalAmount")
            }
          />
          <TextField
            label="Tax Rate"
            type="number"
            fullWidth
            margin="normal"
            value={taxRate}
            onChange={(e) =>
              handleInputChange(setTaxRate, e.target.value, "totalAmount")
            }
          />
          <TextField
            label="Total Amount"
            type="number"
            fullWidth
            margin="normal"
            value={totalAmount}
            disabled
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAddItem} color="primary">
            Add Item
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PurchaseEntryForm;
