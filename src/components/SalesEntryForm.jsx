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
import { getItems, saveSalesTransaction } from "../services/apiservice";
import { useTranslation } from "react-i18next"; // Import useTranslation hook

const SalesEntryForm = () => {
  const { t } = useTranslation(); // Initialize translation hook

  const [savedSalesEntry, setSavedSalesEntry] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const { data } = useWebSocket();
  const [customer, setCustomer] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerGST, setCustomerGST] = useState("");
  const [salesDetails, setItems] = useState([]);
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
      console.error("Error fetching salesDetails:", error);
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

    setItems([...salesDetails, newItem]);
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
    setItems(salesDetails.filter((_, i) => i !== index));
  };

  const calculateGrandTotal = () =>
    salesDetails.reduce((total, item) => total + item.amount, 0).toFixed(2);

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
    let branchCode = localStorage.getItem("branchCode");
    if (!branchCode) {
      branchCode = "WEB"; // Set default branch code to 'WEB'
      localStorage.setItem("branchCode", branchCode); // Save it to local storage
    }
    const salesEntry = {
      customer: {
        name: customer,
        address: customerAddress,
        gst: customerGST,
      },
      branch_code: branchCode,
      voucher_date: new Date().toISOString(),
      salesDetails,
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
        alert(t("salesEntrySuccess"));

        const responseData = await response.json();
        const salesEntryWithInvoice = {
          ...salesEntry,
          invoiceNumber: responseData.invoiceNumber,
          invoiceDate: responseData.invoiceDate,
          items: responseData.items,
        };

        setSavedSalesEntry(salesEntryWithInvoice); // Save the entry data
        setShowInvoice(true); // Show InvoiceGenerator after saving

        setCustomer("");
        setCustomerAddress("");
        setCustomerGST("");
        setItems([]);
      } else {
        alert(t("salesEntryFailure"));
      }
    } catch (error) {
      console.error("Error saving sales entry:", error);
      alert(t("salesEntryError"));
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoice(false); // Close the popup
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 800 }}>
        <Typography variant="h4" gutterBottom>
          {t("salesEntry")}
        </Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>{t("customer")}</InputLabel>
          <Select value={customer} onChange={handleCustomerChange}>
            {customers.map((cust) => (
              <MenuItem key={cust.id} value={cust.name}>
                {cust.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label={t("customerAddress")}
          fullWidth
          margin="normal"
          value={customerAddress}
          disabled
        />
        <TextField
          label={t("customerGST")}
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
          {t("createCustomer")}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => setItemDialogOpen(true)}
          sx={{ mb: 3 }}
        >
          {t("addItem")}
        </Button>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t("itemName")}</TableCell>
                <TableCell>{t("barcode")}</TableCell>
                <TableCell>{t("standardPrice")}</TableCell>
                <TableCell>{t("taxRate")}</TableCell>
                <TableCell>{t("quantity")}</TableCell>
                <TableCell>{t("totalAmount")}</TableCell>
                <TableCell>{t("actions")}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {salesDetails.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.barcode}</TableCell>
                  <TableCell>{item.standardPrice.toFixed(2)}</TableCell>
                  <TableCell>{item.taxRate}</TableCell>
                  <TableCell>{item.qty}</TableCell>
                  <TableCell>{(item.amount || 0).toFixed(2)}</TableCell>
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
                  {t("grandTotal")}
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
            {t("save")}
          </Button>
          {savedSalesEntry && <InvoiceGenerator salesEntry={savedSalesEntry} />}
        </Box>
      </Paper>

      <Dialog open={itemDialogOpen} onClose={() => setItemDialogOpen(false)}>
        <DialogTitle>{t("addItem")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t("barcode")}
            fullWidth
            margin="normal"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleBarcodeKeyPress}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>{t("itemName")}</InputLabel>
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
            label={t("standardPrice")}
            fullWidth
            margin="normal"
            value={standardPrice}
            disabled
          />
          <TextField
            label={t("taxRate")}
            fullWidth
            margin="normal"
            value={taxRate}
            disabled
          />
          <TextField
            label={t("quantity")}
            type="number"
            fullWidth
            margin="normal"
            value={qty}
            onChange={(e) => handleQuantityChange(e.target.value)}
          />
          <TextField
            label={t("totalAmount")}
            fullWidth
            margin="normal"
            value={amount}
            disabled
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setItemDialogOpen(false)} color="primary">
            {t("cancel")}
          </Button>
          <Button onClick={handleAddItem} color="primary">
            {t("addItem")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={newCustomerDialogOpen}
        onClose={() => setNewCustomerDialogOpen(false)}
      >
        <DialogTitle>{t("createCustomer")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t("customerName")}
            fullWidth
            margin="normal"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
          />
          <TextField
            label={t("customerAddress")}
            fullWidth
            margin="normal"
            value={newCustomerAddress}
            onChange={(e) => setNewCustomerAddress(e.target.value)}
          />
          <TextField
            label={t("customerGST")}
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
            {t("cancel")}
          </Button>
          <Button onClick={handleNewCustomerSubmit} color="primary">
            {t("createCustomer")}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SalesEntryForm;
