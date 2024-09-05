import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import InvoiceGenerator from "./InvoiceGenerator";
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
import SearchIcon from "@mui/icons-material/Search";
import DeleteIcon from "@mui/icons-material/Delete";
import { useWebSocket } from "./WebSocketContext";
import { getItems, saveSalesTransaction } from "../services/apiservice"; // Ensure you import your API service

const SalesEntryForm = () => {

  const [savedSalesEntry, setSavedSalesEntry] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false); // To control InvoiceGenerator visibility
 


  const { data } = useWebSocket(); // Use WebSocket context to get the data
  const [customer, setCustomer] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGST, setCustomerGST] = useState("");
  const [items, setItems] = useState([]);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemList, setItemList] = useState([]);
  const [filteredItemList, setFilteredItemList] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemName, setItemName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [standardPrice, setStandardPrice] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [qty, setQuantity] = useState("");
  const [amount, setTotalAmount] = useState("");
  const [newCustomerDialogOpen, setNewCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerGST, setNewCustomerGST] = useState("");
 

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await getItems();
      setItemList(response.data);
      setFilteredItemList(response.data);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const token = localStorage.getItem("jwtToken");
        const tenancyId = localStorage.getItem("tenancyId");
        const response = await fetch(`/api/${tenancyId}/customers`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch customers");
        }
        const data = await response.json();
        setCustomers(data);
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };

    fetchCustomers();
  }, []);

  const handleCustomerChange = (event) => {
    const selectedCustomer = customers.find(
      (cust) => cust.name === event.target.value
    );
    setCustomer(event.target.value);
    setCustomerAddress(selectedCustomer?.address || "");
    setCustomerGST(selectedCustomer?.gst || "");
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

    setItems([...items, newItem]);
    setItemDialogOpen(false);
    setItemName("");
    setBarcode("");
    setStandardPrice("");
    setTaxRate("");
    setQuantity("");
    setTotalAmount("");
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

  const handleDeleteItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () =>
    items.reduce((total, item) => total + item.amount, 0).toFixed(2);

  const handleItemSearch = (value) => {
    setItemName(value);
    const filteredItems = itemList.filter((item) =>
      item.itemName.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredItemList(filteredItems);
  };

  const handleNewCustomerSubmit = async () => {
    const newCustomer = {
      name: newCustomerName,
      address: newCustomerAddress,
      gst: newCustomerGST,
    };

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch(`/api/${tenancyId}/customers`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newCustomer),
      });

      if (response.ok) {
        setCustomers([...customers, newCustomer]);
        setNewCustomerDialogOpen(false);
        setNewCustomerName("");
        setNewCustomerAddress("");
        setNewCustomerGST("");
      } else {
        alert("Failed to create new customer");
      }
    } catch (error) {
      console.error("Error creating new customer:", error);
      alert("An error occurred while creating new customer.");
    }
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
    setItemName(item.itemName);
    setBarcode(item.barcode);
    setStandardPrice(item.standardPrice);
    setTaxRate(item.taxRate);
    setTotalAmount(calculateTotalAmount(item.standardPrice, qty));
  };

  const handleBarcodeKeyPress = (event) => {
    if (event.key === "Enter") {
      const fetchedItem = itemList.find((item) => item.barcode === barcode);
      if (fetchedItem) {
        handleItemSelect(fetchedItem);
      } else {
        alert("Item not found");
      }
    }
  };

   
  const handleSave = async () => {
    const branchCode = localStorage.getItem("branchCode");
    const salesEntry = {
      customer: {
        name: customer,
        address: customerAddress,
        gst: customerGST,
      },
      branch_code: branchCode,
      voucher_date: new Date().toISOString(),
      items,
    };

    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch(`/api/${tenancyId}/sales`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(salesEntry),
      });

      if (response.ok) {
        alert("Sales entry saved successfully");

        const responseData = await response.json();
        const salesEntryWithInvoice = {
          ...salesEntry,
          invoiceNumber: responseData.voucher_number,
          invoiceDate: responseData.voucher_date,
        };
      
  
        setSavedSalesEntry(salesEntryWithInvoice); // Save the entry data

       
        setShowInvoice(true); // Show InvoiceGenerator after saving

        setCustomer("");
        setCustomerAddress("");
        setCustomerGST("");
        setItems([]);
      } else {
        alert("Failed to save sales entry");
      }
    } catch (error) {
      console.error("Error saving sales entry:", error);
      alert("An error occurred while saving sales entry.");
    }
  };

   const handleCloseInvoice = () => {
     setShowInvoice(false); // Close the popup
   };
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 800 }}>
        <Typography variant="h4" gutterBottom>
          Sales Entry
        </Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>Customer</InputLabel>
          <Select value={customer} onChange={handleCustomerChange}>
            {customers.map((cust) => (
              <MenuItem key={cust.id} value={cust.name}>
                {cust.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Customer Address"
          fullWidth
          margin="normal"
          value={customerAddress}
          disabled
        />
        <TextField
          label="Customer GST"
          fullWidth
          margin="normal"
          value={customerGST}
          disabled
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => setNewCustomerDialogOpen(true)}
          sx={{ mb: 3 }}
        >
          Create New Customer
        </Button>
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
                <TableCell>Barcode</TableCell>
                <TableCell>Standard Price</TableCell>
                <TableCell>Tax Rate</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.barcode}</TableCell>
                  <TableCell>{item.standardPrice.toFixed(2)}</TableCell>
                  <TableCell>{item.taxRate}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>{(item.amount || 0).toFixed(2)}</TableCell>{" "}
                  {/* Use fallback value */}
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
        {/* Box for Save and Print Invoice Buttons */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
          <Button variant="contained" color="primary" onClick={handleSave}>
            Save
          </Button>
          {savedSalesEntry && (
            <InvoiceGenerator
              salesEntry={savedSalesEntry}
            />
          )}
        </Box>
      </Paper>

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)}>
        <DialogTitle>Add Item</DialogTitle>
        <DialogContent>
          <TextField
            label="Barcode"
            fullWidth
            margin="normal"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleBarcodeKeyPress}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Item Name</InputLabel>
            <TextField
              value={itemName}
              onChange={(e) => handleItemSearch(e.target.value)}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={() => setItemDialogOpen(true)}>
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
            <Select
              value={selectedItem?.itemName || ""}
              onChange={(e) =>
                handleItemSelect(
                  filteredItemList.find(
                    (item) => item.itemName === e.target.value
                  )
                )
              }
            >
              {filteredItemList.map((item) => (
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
          <Button onClick={() => setItemDialogOpen(false)} color="primary">
            Cancel
          </Button>
          <Button onClick={handleAddItem} color="primary">
            Add Item
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={newCustomerDialogOpen}
        onClose={() => setNewCustomerDialogOpen(false)}
      >
        <DialogTitle>Create New Customer</DialogTitle>
        <DialogContent>
          <TextField
            label="Customer Name"
            fullWidth
            margin="normal"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
          <TextField
            label="Customer Address"
            fullWidth
            margin="normal"
            value={newCustomerAddress}
            onChange={(e) => setNewCustomerAddress(e.target.value)}
          />
          <TextField
            label="Customer GST"
            fullWidth
            margin="normal"
            value={newCustomerGST}
            onChange={(e) => setNewCustomerGST(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setNewCustomerDialogOpen(false)}
            color="primary"
          >
            Cancel
          </Button>
          <Button onClick={handleNewCustomerSubmit} color="primary">
            Create Customer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesEntryForm;
