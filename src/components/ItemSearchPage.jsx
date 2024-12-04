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
} from "@mui/material";

const ItemSearchPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [sortOrder, setSortOrder] = useState("asc"); // Sorting order
  const [sortField, setSortField] = useState("itemName"); // Field to sort by

  useEffect(() => {
    fetchItems();
  }, [searchQuery, page, rowsPerPage, sortOrder, sortField]);

  const fetchItems = async () => {
    const tenancyId = localStorage.getItem("tenancyId");
    const token = localStorage.getItem("jwtToken");

    setLoading(true);
    try {
      const response = await fetch(
        `/api/${tenancyId}/items-search?query=${searchQuery}&page=${page}&size=${rowsPerPage}&sort=${sortField},${sortOrder}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Error fetching items:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPage(0); // Reset to the first page when a new search is performed
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset to the first page
  };

  const handleSort = (field) => {
    const isAsc = sortField === field && sortOrder === "asc";
    setSortOrder(isAsc ? "desc" : "asc");
    setSortField(field);
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

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell onClick={() => handleSort("itemName")}>
                  Item Name
                </TableCell>
                <TableCell onClick={() => handleSort("unitName")}>
                  Unit Name
                </TableCell>
                <TableCell onClick={() => handleSort("standardPrice")}>
                  Standard Price
                </TableCell>
                <TableCell>Item Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.itemName}</TableCell>
                  <TableCell>{item.unitName}</TableCell>
                  <TableCell>{item.standardPrice}</TableCell>
                  <TableCell>{item.itemCode}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        component="div"
        count={items.length} // Total number of items
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Container>
  );
};

export default ItemSearchPage;
