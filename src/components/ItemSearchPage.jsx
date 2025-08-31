import React, { useState, useEffect } from "react";
import {
  TextField,
  Container,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  CircularProgress,
  Button,
} from "@mui/material";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ItemSearchPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [sortOrder, setSortOrder] = useState("asc");
  const [sortField, setSortField] = useState("itemName");

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, page, rowsPerPage, sortOrder, sortField]);

  const fetchItems = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    setLoading(true);
    try {
      const res = await fetch(
        `/api/${tenancyId}/items-search?query=${encodeURIComponent(
          searchQuery
        )}&page=${page}&size=${rowsPerPage}&sort=${sortField},${sortOrder}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        console.error("Error: ", res.statusText);
        setItems([]);
        setTotalItems(0);
        return;
      }

      const data = await res.json();
      setItems(data.content || []);
      setTotalItems(data.totalElements || 0);
    } catch (err) {
      console.error("Error fetching items:", err);
      setItems([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0);
  };

  const handleChangePage = (_e, newPage) => setPage(newPage);

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
  };

  const handleExportToExcel = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    try {
      const res = await fetch(
        `/api/${tenancyId}/items-search?query=${encodeURIComponent(
          searchQuery
        )}&page=0&size=10000&sort=${sortField},${sortOrder}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        console.error("Failed to fetch items for Excel export");
        return;
      }
      const data = await res.json();
      const itemsToExport = data.content || [];

      const worksheetData = itemsToExport.map((item) => ({
        "Item Name": item.itemName,
        "Unit Name": item.unitName,
        "Unit ID": item.unitId,
        "Item Code": item.itemCode,
        "Item ID": item.itemId,
        "HSN Code": item.hsnCode,
        Barcode: item.barcode,
        "Standard Price": item.standardPrice,
        "Purchase Rate": item.purchaseRate,
        "Tax Rate": item.taxRate,
        "Cess Rate": item.cessRate,
      }));

      const ws = XLSX.utils.json_to_sheet(worksheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Items");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const fileData = new Blob([buf], { type: "application/octet-stream" });
      saveAs(fileData, "Item_List.xlsx");
    } catch (err) {
      console.error("Error exporting to Excel:", err);
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" align="center" gutterBottom>
        Item Search
      </Typography>

      <TextField
        fullWidth
        label="Search Items"
        placeholder="Type to search by name or code"
        value={searchQuery}
        onChange={handleSearchChange}
        variant="outlined"
        sx={{ mb: 3 }}
      />

      <Button variant="outlined" onClick={handleExportToExcel} sx={{ mb: 2 }}>
        Export to Excel
      </Button>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell onClick={() => handleSort("itemName")} sx={{ cursor: "pointer" }}>
                  Item Name
                </TableCell>
                <TableCell>Unit Name</TableCell>
                <TableCell>Unit ID</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item ID</TableCell>
                <TableCell>HSN Code</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>Standard Price</TableCell>
                <TableCell>Purchase Rate</TableCell>
                <TableCell>Tax Rate</TableCell>
                <TableCell>Cess Rate</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <TableRow hover key={item.itemId || item.id || idx}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.unitId}</TableCell>
                    <TableCell>{item.itemCode}</TableCell>
                    <TableCell>{item.itemId}</TableCell>
                    <TableCell>{item.hsnCode}</TableCell>
                    <TableCell>{item.barcode}</TableCell>
                    <TableCell>{item.standardPrice}</TableCell>
                    <TableCell>{item.purchaseRate}</TableCell>
                    <TableCell>{item.taxRate}</TableCell>
                    <TableCell>{item.cessRate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} align="center">
                    No items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        component="div"
        count={totalItems}
        page={page}
        onPageChange={(_e, np) => setPage(np)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Container>
  );
};

export default ItemSearchPage;
