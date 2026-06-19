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
  TableHead,
  TableRow,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { useWebSocket } from "./WebSocketContext"; // Adjust the import path as needed

const SchemePage = () => {
  const { data } = useWebSocket();
  const [schemes, setSchemes] = useState([]);
  const [schemeName, setSchemeName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [schemeType, setSchemeType] = useState("");
  const [offerType, setOfferType] = useState("");
  const [itemName, setItemName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [requiredCategoryQty, setRequiredCategoryQty] = useState("");
  const [offerQty, setOfferQty] = useState("");
  const [totalEligibilityAmount, setTotalEligibilityAmount] = useState("");
  const [eligibilityAmount, setEligibilityAmount] = useState("");
  const [eligibilityItemName, setEligibilityItemName] = useState("");
  const [eligibilityQty, setEligibilityQty] = useState("");
  const [offerItem, setOfferItem] = useState("");
  const [offerDiscountPercent, setOfferDiscountPercent] = useState("");
  const [cashBackAmount, setCashBackAmount] = useState("");
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  // State for ITEMWISE_DISCOUNT scheme — list of { itemName, discountPercent }
  const [discountItems, setDiscountItems] = useState([{ itemName: "", discountPercent: "" }]);

  const fetchSchemes = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    try {
      const response = await fetch(`/api/${tenancyId}/scheme`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch schemes.");
      }
      const data = await response.json();
      if (!data) {
        throw new Error("No data returned from server.");
      }
      setSchemes(Array.isArray(data) ? data : []);
    } catch (error) {
      setError("An error occurred while fetching schemes.");
      console.error("Fetch Schemes Error:", error);
    }
  };

  useEffect(() => {
    fetchSchemes();
    fetchItems();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const res = await fetch(`/api/${tenancyId}/categoriesNames`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchCategories error:", err);
    }
  };

  const fetchItems = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const res = await fetch(`/api/${tenancyId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch items");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("fetchItems error:", err);
    }
  };


  const handleCreateScheme = async () => {
    setError("");

    if (schemeType === "ITEMWISE_DISCOUNT") {
      const validItems = discountItems.filter(
        (d) => d.itemName && Number(d.discountPercent) > 0
      );
      if (!validItems.length) {
        setError("Please add at least one item with a discount percentage.");
        return;
      }
    }

    const newScheme = {
      schemeName,
      startDate,
      endDate,
      schemeType,
      offerType: schemeType === "ITEMWISE_DISCOUNT" ? "" : offerType,
      itemName,
      categoryName,
      requiredCategoryQty: requiredCategoryQty || 0,
      offerQty: offerQty || 0,
      totalEligibilityAmount: totalEligibilityAmount || 0,
      eligibilityAmount: eligibilityAmount || 0,
      eligibilityItemName,
      eligibilityQty: eligibilityQty || 0,
      offerItem,
      offerDiscountPercent: offerDiscountPercent || 0,
      cashBackAmount: cashBackAmount || 0,
      discountItems:
        schemeType === "ITEMWISE_DISCOUNT"
          ? discountItems
              .filter((d) => d.itemName && Number(d.discountPercent) > 0)
              .map((d) => ({ itemName: d.itemName, discountPercent: Number(d.discountPercent) }))
          : [],
    };
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch(`/api/${tenancyId}/scheme`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newScheme),
      });
       if (response.ok) {
         alert("Scheme saved successfully!");
       } else {
         alert("Failed to save scheme.");
       }
      const data = await response.json();
     
      fetchSchemes();
      setSchemeName("");
      setStartDate("");
      setEndDate("");
      setSchemeType("");
      setOfferType("");
      setItemName("");
      setCategoryName("");
      setRequiredCategoryQty("");
      setOfferQty("");
      setTotalEligibilityAmount("");
      setEligibilityAmount("");
      setEligibilityItemName("");
      setEligibilityQty("");
      setOfferItem("");
      setOfferDiscountPercent("");
      setCashBackAmount("");
      setDiscountItems([{ itemName: "", discountPercent: "" }]);
    } catch (error) {
      setError("An error occurred while creating the scheme.");
      console.error("Create Scheme Error:", error);
    }
  };

  const handleDeleteScheme = async (schemeName) => {
    if (!window.confirm(`Delete scheme "${schemeName}"?`)) return;
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");
    try {
      const response = await fetch(
        `/api/${tenancyId}/scheme/${encodeURIComponent(schemeName)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        fetchSchemes();
      } else {
        setError(`Failed to delete scheme (${response.status}).`);
      }
    } catch (err) {
      setError("An error occurred while deleting the scheme.");
      console.error("Delete Scheme Error:", err);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 600 }}>
        <Typography variant="h4" gutterBottom>
          Create Scheme
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <form noValidate autoComplete="off">
          <TextField
            label="Scheme Name"
            fullWidth
            margin="normal"
            value={schemeName}
            onChange={(e) => setSchemeName(e.target.value)}
          />
          <TextField
            label="Start Date"
            type="date"
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextField
            label="End Date"
            type="date"
            fullWidth
            margin="normal"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Scheme Type</InputLabel>
            <Select
              value={schemeType}
              onChange={(e) => setSchemeType(e.target.value)}
            >
              <MenuItem value="Category wise total amount">
                Category wise total amount
              </MenuItem>
              <MenuItem value="Category wise total qty">
                Category wise total qty
              </MenuItem>
              <MenuItem value="Item wise total amount">
                Item wise total amount
              </MenuItem>
              <MenuItem value="Item wise total qty">
                Item wise total qty
              </MenuItem>
              <MenuItem value="Total Invoice Amount">
                Total Invoice Amount
              </MenuItem>
              <MenuItem value="ITEMWISE_DISCOUNT">
                Itemwise Discount
              </MenuItem>
            </Select>
          </FormControl>
          {schemeType === "Category wise total qty" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Category Name</InputLabel>
                <Select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.categoryName}>
                      {category.categoryName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Required Category Qty"
                type="number"
                fullWidth
                margin="normal"
                value={requiredCategoryQty}
                onChange={(e) => setRequiredCategoryQty(e.target.value)}
              />
            </>
          )}
          {schemeType === "Category wise total amount" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Category Name</InputLabel>
                <Select
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                >
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.categoryName}>
                      {category.categoryName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Total Eligibility Amount"
                type="number"
                fullWidth
                margin="normal"
                value={totalEligibilityAmount}
                onChange={(e) => setTotalEligibilityAmount(e.target.value)}
              />
            </>
          )}
          {schemeType === "Item wise total amount" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Eligibility Item Name</InputLabel>
                <Select
                  value={eligibilityItemName}
                  onChange={(e) => setEligibilityItemName(e.target.value)}
                >
                  {items.map((item) => (
                    <MenuItem key={item.itemId} value={item.itemName}>
                      {item.itemName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Eligibility Amount"
                type="number"
                fullWidth
                margin="normal"
                value={eligibilityAmount}
                onChange={(e) => setEligibilityAmount(e.target.value)}
              />
            </>
          )}
          {schemeType === "Item wise total qty" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Eligibility Item Name</InputLabel>
                <Select
                  value={eligibilityItemName}
                  onChange={(e) => setEligibilityItemName(e.target.value)}
                >
                  {items.map((item) => (
                    <MenuItem key={item.itemId} value={item.itemName}>
                      {item.itemName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Eligibility Qty"
                type="number"
                fullWidth
                margin="normal"
                value={eligibilityQty}
                onChange={(e) => setEligibilityQty(e.target.value)}
              />
            </>
          )}
          {schemeType === "Total Invoice Amount" && (
            <TextField
              label="Eligibility Amount"
              type="number"
              fullWidth
              margin="normal"
              value={eligibilityAmount}
              onChange={(e) => setEligibilityAmount(e.target.value)}
            />
          )}
          {/* ITEMWISE_DISCOUNT — dynamic per-item discount table */}
          {schemeType === "ITEMWISE_DISCOUNT" && (
            <Box sx={{ mt: 2, mb: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Item Discount Percentages
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell>Discount %</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {discountItems.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <FormControl fullWidth size="small">
                          <Select
                            value={row.itemName}
                            displayEmpty
                            onChange={(e) =>
                              setDiscountItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, itemName: e.target.value } : r
                                )
                              )
                            }
                          >
                            <MenuItem value=""><em>Select item</em></MenuItem>
                            {items.map((item) => (
                              <MenuItem key={item.itemId} value={item.itemName}>
                                {item.itemName}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={row.discountPercent}
                          inputProps={{ min: 0, max: 100 }}
                          onChange={(e) =>
                            setDiscountItems((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, discountPercent: e.target.value } : r
                              )
                            )
                          }
                          placeholder="%"
                          sx={{ width: 90 }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          color="error"
                          size="small"
                          onClick={() =>
                            setDiscountItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          disabled={discountItems.length === 1}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() =>
                  setDiscountItems((prev) => [...prev, { itemName: "", discountPercent: "" }])
                }
                sx={{ mt: 1 }}
              >
                Add Item
              </Button>
            </Box>
          )}

          {/* Offer Type — not shown for ITEMWISE_DISCOUNT */}
          {schemeType !== "ITEMWISE_DISCOUNT" && (
          <FormControl fullWidth margin="normal">
            <InputLabel>Offer Type</InputLabel>
            <Select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
            >
              <MenuItem value="Free Qty">Free Qty</MenuItem>
              <MenuItem value="Item Discount Percent">
                Item Discount Percent
              </MenuItem>
              <MenuItem value="Cash Back">Cash Back</MenuItem>
            </Select>
          </FormControl>
          )}
          {schemeType !== "ITEMWISE_DISCOUNT" && offerType === "Free Qty" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Offer Item Name</InputLabel>
                <Select
                  value={offerItem}
                  onChange={(e) => setOfferItem(e.target.value)}
                >
                  {items.map((item) => (
                    <MenuItem key={item.itemId} value={item.itemName}>
                      {item.itemName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Offer Qty"
                type="number"
                fullWidth
                margin="normal"
                value={offerQty}
                onChange={(e) => setOfferQty(e.target.value)}
              />
            </>
          )}
          {schemeType !== "ITEMWISE_DISCOUNT" && offerType === "Item Discount Percent" && (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Offer Item</InputLabel>
                <Select
                  value={offerItem}
                  onChange={(e) => setOfferItem(e.target.value)}
                >
                  {items.map((item) => (
                    <MenuItem key={item.itemId} value={item.itemName}>
                      {item.itemName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Offer Discount Percent"
                type="number"
                fullWidth
                margin="normal"
                value={offerDiscountPercent}
                onChange={(e) => setOfferDiscountPercent(e.target.value)}
              />
            </>
          )}
          {schemeType !== "ITEMWISE_DISCOUNT" && offerType === "Cash Back" && (
            <TextField
              label="Cash Back Amount"
              type="number"
              fullWidth
              margin="normal"
              value={cashBackAmount}
              onChange={(e) => setCashBackAmount(e.target.value)}
            />
          )}
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateScheme}
            sx={{ mt: 2 }}
          >
            Create Scheme
          </Button>
        </form>
      </Paper>
      <Paper elevation={3} sx={{ padding: 4, maxWidth: 1500, marginTop: 4 }}>
        <Typography variant="h4" gutterBottom>
          Existing Schemes
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Scheme Name</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Scheme Type</TableCell>
              <TableCell>Offer Type</TableCell>
              <TableCell>Category Name</TableCell>
              <TableCell>Required Category Qty</TableCell>
              <TableCell>Category Eligibility Amount</TableCell>
              <TableCell>Invoice Eligibility Amount</TableCell>
              <TableCell>Eligibility Item Name</TableCell>
              <TableCell>Eligibility Qty</TableCell>
              <TableCell>Offer Item Name</TableCell>
              <TableCell>Offer Qty</TableCell>
              <TableCell>Offer Discount Percent</TableCell>
              <TableCell>Cash Back Amount</TableCell>
              <TableCell>Discount Items</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {schemes.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.schemeName}</TableCell>
                <TableCell>{row.startDate}</TableCell>
                <TableCell>{row.endDate}</TableCell>
                <TableCell>{row.schemeType}</TableCell>
                <TableCell>{row.offerType}</TableCell>
                <TableCell>{row.categoryName}</TableCell>
                <TableCell>{row.requiredCategoryQty}</TableCell>
                <TableCell>{row.totalEligibilityAmount}</TableCell>
                <TableCell>{row.eligibilityAmount}</TableCell>
                <TableCell>{row.eligibilityItemName}</TableCell>
                <TableCell>{row.eligibilityQty}</TableCell>
                <TableCell>{row.offerItem}</TableCell>
                <TableCell>{row.offerQty}</TableCell>
                <TableCell>{row.offerDiscountPercent}</TableCell>
                <TableCell>{row.cashBackAmount}</TableCell>
                <TableCell>
                  {Array.isArray(row.discountItems) && row.discountItems.length > 0
                    ? row.discountItems.map((d, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          {d.itemName}: {d.discountPercent}%
                        </div>
                      ))
                    : "—"}
                </TableCell>
                <TableCell>
                  <IconButton
                    color="error"
                    size="small"
                    onClick={() => handleDeleteScheme(row.schemeName)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default SchemePage;
