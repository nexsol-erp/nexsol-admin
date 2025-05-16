import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const handleItemSelect = (item) => {
    navigate("/item-category-linking", { state: { selectedItem: item } });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]); // Holds the items to display
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [totalItems, setTotalItems] = useState(0); // Total number of items for pagination
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

      if (!response.ok) {
        console.error("Error: ", response.statusText);
        setItems([]);
        setTotalItems(0);
        return;
      }

      const data = await response.json(); // Parse JSON only if response is ok
      setItems(data.content); // Set the content array as items
      setTotalItems(data.totalElements); // Set the total number of items
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
      setTotalItems(0);
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
              <TableRow >
                <TableCell onClick={() => handleSort("itemName")} style={{ cursor: "pointer" }}>
                  Item Name {sortField === "itemName" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("unitName")} style={{ cursor: "pointer" }}>
                  Unit Name {sortField === "unitName" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell onClick={() => handleSort("standardPrice")} style={{ cursor: "pointer" }}>
                  Standard Price {sortField === "standardPrice" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell>Item Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}
                  hover
                  style={{ cursor: "pointer" }}
                  onClick={() => handleItemSelect(item)}
                  >
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell>{item.unitName}</TableCell>
                    <TableCell>{item.standardPrice}</TableCell>
                    <TableCell>{item.itemCode}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} align="center">
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
        count={totalItems} // Total number of items from the API response
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Container>
  );
};

export default ItemSearchPage;
