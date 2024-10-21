import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
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
import { useWebSocket } from "./WebSocketContext"; 
import AddItemDialog from "./AddItemDialog"; // Import AddItemDialog component
import { getItems, saveSalesTransaction } from "../services/apiservice";

const PurchaseEntryForm = () => {
  const { data } = useWebSocket(); 
  const [supplierName, setSupplierName] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInvNo, setSupplierInvNo] = useState("");
  const [supplierInvDate, setSupplierInvDate] = useState("");
  const [items, setItems] = useState([]);
  const [filteredItemList, setFilteredItemList] = useState([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemList, setItemList] = useState([]);
  
  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await getItems();
      setItemList(response.data);
      setFilteredItemList(response.data);
    } catch (error) {
      console.error("Error fetching salesDetails:", error);
    }
  };

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");

        const response = await fetch(`/api/${tenancyId}/suppliers`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
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
  }, []);

  const handleAddItem = (newItem) => {
    setItems([...items, newItem]);
    setItemDialogOpen(false);
  };

  const handleDeleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () =>
    items.reduce((total, item) => total + (item.totalAmount || 0), 0).toFixed(2);

  const handlePartialSave = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const payload = {
      supplierName,
      voucherNumber: supplierInvNo,
      voucherDate: supplierInvDate,
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
      alert("An error occurred during partial save.");
    }
  };

  const handleFinalSave = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const payload = {
      supplierName,
      supplierVoucherNumber: supplierInvNo,
      supplierVoucherDate: supplierInvDate,
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
      alert("An error occurred during final save.");
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
            value={supplierName}
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
          value={supplierInvNo}
          onChange={(e) => setSupplierInvNo(e.target.value)}
        />
        <TextField
          label="Voucher Date"
          type="date"
          fullWidth
          margin="normal"
          InputLabelProps={{ shrink: true }}
          value={supplierInvDate}
          onChange={(e) => setSupplierInvDate(e.target.value)}
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
                  <TableCell>{(parseFloat(item.rateBeforeTax) || 0).toFixed(2)}</TableCell>
                  <TableCell>{(item.rateIncludingTax || 0).toFixed(2)}</TableCell>
                  <TableCell>{(item.quantity || 0).toFixed(2)}</TableCell>
                  <TableCell>{(item.taxRate || 0).toFixed(2)}%</TableCell>
                  <TableCell>{(item.totalAmount || 0).toFixed(2)}</TableCell>
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

      <AddItemDialog
        open={itemDialogOpen}
        onClose={() => setItemDialogOpen(false)}
        onAddItem={handleAddItem}
        itemList={itemList}
      />
    </Box>
  );
};

export default PurchaseEntryForm;
