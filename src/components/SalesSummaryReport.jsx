
 import React, { useState, useEffect } from "react";
 import {
   Table,
   TableHead,
   TableBody,
   TableRow,
   TableCell,
   Button,
   CircularProgress,
   Container,
   Paper,
   Typography,
   Pagination,
 } from "@mui/material";
 import axios from "axios";
 import InvoiceGenerator from "./InvoiceGenerator"; // Assuming InvoiceGenerator generates the PDF

 const SalesSummaryReport = () => {
   const [salesSummary, setSalesSummary] = useState([]);
   const [selectedSalesEntry, setSelectedSalesEntry] = useState(null);
   const [isLoading, setIsLoading] = useState(false);
   const [loadingSummary, setLoadingSummary] = useState(true);
   const [currentPage, setCurrentPage] = useState(0); // Current page
   const [totalPages, setTotalPages] = useState(1); // Total pages
     const pageSize = 10; // Number of items per page
     const [invoiceDetails, setInvoiceDetails] = useState(null);

   useEffect(() => {
     fetchSalesSummary(currentPage);
   }, [currentPage]);

   const fetchSalesSummary = (page) => {
     const tenancyId = localStorage.getItem("tenancyId");
     const token = localStorage.getItem("jwtToken");

     axios
       .get(`/api/${tenancyId}/sales/summary`, {
         headers: {
           Authorization: `Bearer ${token}`,
         },
         params: {
           page: page,
           size: pageSize,
         },
       })
       .then((response) => {
         if (response.data && response.data.content) {
           setSalesSummary(response.data.content);
           setTotalPages(response.data.totalPages); // Set total pages from response
         } else {
           console.error("Unexpected data format", response.data);
         }
         setLoadingSummary(false);
       })
       .catch((error) => {
         console.error("Error fetching sales summary:", error);
         setLoadingSummary(false);
       });
   };

   const handlePageChange = (event, page) => {
     setCurrentPage(page - 1); // Page number is zero-indexed in the backend
   };

   const handlePrint = (voucherNumber, voucherDate) => {
     setIsLoading(true);
     const tenancyId = localStorage.getItem("tenancyId");
     const token = localStorage.getItem("jwtToken");

     axios
       .get(`/api/${tenancyId}/sales/invoices/${voucherNumber}`, {
         headers: {
           Authorization: `Bearer ${token}`,
         },
         params: {
           voucherDate: voucherDate,
         },
       })
       .then((response) => {
         setInvoiceDetails(response.data);
         setSelectedSalesEntry(response.data);
         setIsLoading(false);
       })
       .then(() => {
         // After setting the invoice details, trigger the PDF generation
         if (invoiceDetails) {
           InvoiceGenerator({ salesEntry: invoiceDetails });
         }
       })
       .catch((error) => {
         console.error("Error fetching invoice details:", error);
         setIsLoading(false);
       });
   };

   return (
     <Container maxWidth="lg" sx={{ marginTop: 4 }}>
       <Paper elevation={3} sx={{ padding: 2 }}>
         <Typography variant="h4" gutterBottom>
           Sales Summary Report
         </Typography>

         {loadingSummary ? (
           <div style={{ display: "flex", justifyContent: "center" }}>
             <CircularProgress />
           </div>
         ) : (
           <>
             <Table>
               <TableHead>
                 <TableRow>
                   <TableCell>Customer Name</TableCell>
                   <TableCell>Voucher Number</TableCell>
                   <TableCell>Voucher Date</TableCell>
                   <TableCell>Total Amount</TableCell>
                   <TableCell>Action</TableCell>
                   <TableCell>
                     
                     {invoiceDetails && (
                       <InvoiceGenerator salesEntry={invoiceDetails} />
                     )}
                   </TableCell>
                 </TableRow>
               </TableHead>
               <TableBody>
                 {Array.isArray(salesSummary) && salesSummary.length > 0 ? (
                   salesSummary.map((sale, index) => (
                     <TableRow key={index}>
                       <TableCell>{sale.customerName}</TableCell>
                       <TableCell>{sale.voucherNumber}</TableCell>
                       <TableCell>
                         {new Date(sale.voucherDate).toLocaleDateString()}
                       </TableCell>
                       <TableCell>{sale.totalAmount}</TableCell>
                       <TableCell>
                         <Button
                           variant="contained"
                           color="primary"
                           onClick={() =>
                             handlePrint(sale.voucherNumber, sale.voucherDate)
                           }
                           disabled={isLoading}
                         >
                           {isLoading ? (
                             <CircularProgress size={24} color="inherit" />
                           ) : (
                             "Generate Invoice"
                           )}
                         </Button>
                       </TableCell>
                     </TableRow>
                   ))
                 ) : (
                   <TableRow>
                     <TableCell colSpan={5} align="center">
                       No sales summary available
                     </TableCell>
                   </TableRow>
                 )}
               </TableBody>
             </Table>

             {/* Pagination Controls */}
             <Pagination
               count={totalPages}
               page={currentPage + 1}
               onChange={handlePageChange}
               sx={{ display: "flex", justifyContent: "center", marginTop: 2 }}
             />
           </>
         )}
       </Paper>
     </Container>
   );
 };

 export default SalesSummaryReport;
