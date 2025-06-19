import React, { useState, useEffect, useCallback } from "react";
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
  Tooltip,
  Button,
} from "@mui/material";

import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const ItemSearchPage = () => {
  const navigate = useNavigate();

  const handleItemSelect = useCallback((item) => {
    navigate("/item-category-linking", { state: { selectedItem: item } });
  }, [navigate]);

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

      const data = await response.json();
      setItems(data.content || []);
      setTotalItems(data.totalElements || 0);
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
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
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
    const response = await fetch(
      `/api/${tenancyId}/items-search?query=${searchQuery}&page=0&size=10000&sort=${sortField},${sortOrder}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch items for Excel export");
      return;
    }

    const data = await response.json();
    const itemsToExport = data.content || [];

    const worksheetData = itemsToExport.map((item) => ({
      "Item Name": item.itemName,
      "Unit Name": item.unitName,
      "Standard Price": item.standardPrice,
      "Item Code": item.itemCode,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const fileData = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(fileData, "Item_List.xlsx");
  } catch (error) {
    console.error("Error exporting to Excel:", error);
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
<Button
  variant="outlined"
  onClick={handleExportToExcel}
  sx={{ mb: 2 }}
>
  Export to Excel
</Button>

      {loading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell
                  onClick={() => handleSort("itemName")}
                  style={{ cursor: "pointer" }}
                >
                  Item Name {sortField === "itemName" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell
                  onClick={() => handleSort("unitName")}
                  style={{ cursor: "pointer" }}
                >
                  Unit Name {sortField === "unitName" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell
                  onClick={() => handleSort("standardPrice")}
                  style={{ cursor: "pointer" }}
                >
                  Standard Price {sortField === "standardPrice" && (sortOrder === "asc" ? "↑" : "↓")}
                </TableCell>
                <TableCell>Item Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length > 0 ? (
                items.map((item) => (
                  <Tooltip key={item.id} title="Click to link category" arrow>
                    <TableRow
                      hover
                      style={{ cursor: "pointer" }}
                      onClick={() => handleItemSelect(item)}
                    >
                      <TableCell>{item.itemName}</TableCell>
                      <TableCell>{item.unitName}</TableCell>
                      <TableCell>{item.standardPrice}</TableCell>
                      <TableCell>{item.itemCode}</TableCell>
                    </TableRow>
                  </Tooltip>
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
        count={totalItems}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Container>
  );
};

export default ItemSearchPage;
