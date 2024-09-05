import React from "react";
import { Button } from "@mui/material";
import jsPDF from "jspdf";

const InvoiceGenerator = ({ template, salesEntry }) => {
  const handlePrint = async () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageHeight = doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.getWidth();
    let startX = 10;
    let startY = 20;
    let lineHeight = 10;
    let halfLineHeight = 5;
    let currentPage = 1;
    const marginX = 10;
    const marginY = 10;

    let qtyColx = 85;
    let priceColx = 110;
    let taxRateColx = 130;
         let sgstColx = 150;
     let cgstColx = 170;
    let totalAmountColx = 190;
    
    

    // Function to add page number
    const addPageNumber = () => {
      doc.setFontSize(10);
      doc.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 15, {
        align: "center",
      });
      currentPage++;
    };

    // Function to print headers
    const printHeaders = () => {
      // Add Company Name (Centralized)
      doc.setFontSize(14);
      const companyName = template.companyName || "Company Name";
      const textWidth = doc.getTextWidth(companyName);
      const centerX = (pageWidth - textWidth) / 2;
      doc.text(companyName, centerX, startY);
      startY += lineHeight;

      // Split company address by new line and print each line separately
      const companyAddress = template.companyAddress || "Address Line 1";
      const addressLines = companyAddress.split("\n");
      addressLines.forEach((line) => {
        doc.text(line, centerX, startY);
        startY += lineHeight;
      });

      if (template.companyContact) {
        doc.text(`Contact: ${template.companyContact}`, centerX, startY);
        startY += lineHeight;
      }

      if (template.companyGST) {
        doc.text(`GST Number: ${template.companyGST}`, centerX, startY);
        startY += lineHeight;
      }

      // Draw a line after company details
      let lineXStart = startX;
      let lineXEnd = pageWidth - startX;
      doc.setLineWidth(0.5);
      startY += 5;
      doc.line(lineXStart, startY, lineXEnd, startY);
      startY += lineHeight;

      if (currentPage === 1) {
        doc.setFontSize(12);
        doc.text(`Customer: ${salesEntry.customer.name}`, startX, startY);
        startY += lineHeight; // Move to the next line
        doc.text(`Address: ${salesEntry.customer.address}`, startX, startY);
        startY += lineHeight; // Move to the next line
        doc.text(`GST: ${salesEntry.customer.gst}`, startX, startY);
        startY += lineHeight; // Move to the next line
      }

      // Add Table Header (including SGST and CGST)
      doc.setFontSize(10);
      doc.text("Item", startX, startY);
      doc.text("Quantity", qtyColx, startY, { align: "right" });
      doc.text("Price", priceColx, startY, { align: "right" });
      doc.text("Tax Rate", taxRateColx, startY, { align: "right" });
      doc.text("SGST", sgstColx, startY, { align: "right" });
      doc.text("CGST", cgstColx, startY, { align: "right" });
      doc.text("Total", totalAmountColx, startY, { align: "right" });
      startY += halfLineHeight;
      doc.line(lineXStart, startY, lineXEnd, startY);
      startY += lineHeight;
    };

    // Draw border and first page header
    doc.setLineWidth(0.5);
    doc.rect(
      marginX,
      marginY,
      pageWidth - marginX * 2,
      pageHeight - marginY * 2
    );

    printHeaders();
    addPageNumber();

    // Function to check if a new page is needed
    const checkNewPage = () => {
      if (startY >= pageHeight - 20) {
        doc.addPage();
        doc.rect(
          marginX,
          marginY,
          pageWidth - marginX * 2,
          pageHeight - marginY * 2
        );
        startY = 40;
        printHeaders();
        addPageNumber();
      }
    };

    // Initialize tax object to accumulate tax amounts by tax rate
    let taxSums = {};
    let totalSGST = 0;
    let totalCGST = 0;
    let totalTax = 0; // To store the total tax across all items

    // Add Items, calculate tax, and display tax rate, SGST, CGST
    salesEntry.items.forEach((item) => {
      checkNewPage(); // Check if new page is required before printing the item

      // Calculate tax amount for the item
      const taxRate = item.taxRate || 0;
      const taxAmount = (item.amount * taxRate) / 100;
      const sgstAmount = taxAmount / 2; // Split tax into SGST
      const cgstAmount = taxAmount / 2; // Split tax into CGST

      // Print item details (right-align amount fields)
      doc.text(item.itemName, startX, startY);
      doc.text(item.qty.toString(), qtyColx, startY);
      doc.text(item.standardPrice.toFixed(2), priceColx, startY, {
        align: "right",
      });
      doc.text(`${taxRate}%`, taxRateColx, startY, { align: "right" });
      doc.text(sgstAmount.toFixed(2), sgstColx, startY, { align: "right" });
      doc.text(cgstAmount.toFixed(2), cgstColx, startY, { align: "right" });
      doc.text(item.amount.toFixed(2), totalAmountColx, startY, {
        align: "right",
      });

      // Accumulate tax amount by tax rate
      if (taxRate > 0) {
        if (taxSums[taxRate]) {
          taxSums[taxRate] += taxAmount;
        } else {
          taxSums[taxRate] = taxAmount;
        }
        totalSGST += sgstAmount; // Add to the total SGST
        totalCGST += cgstAmount; // Add to the total CGST
        totalTax += taxAmount; // Add to the total tax
      }

      startY += lineHeight;
    });

    // ** Check space before printing totals **
    const requiredSpaceForTotals = 60; // Minimum space required for the totals section
    if (startY >= pageHeight - requiredSpaceForTotals) {
      doc.addPage();
      doc.rect(
        marginX,
        marginY,
        pageWidth - marginX * 2,
        pageHeight - marginY * 2
      );
      startY = 40; // Reset Y position for the next page
    }

    // Print the sum of taxes for each tax rate above the grand total
    Object.keys(taxSums).forEach((taxRate) => {
      startY += lineHeight;
      doc.setFontSize(12);
      doc.text(`${taxRate}% Tax`, 10, startY);
      doc.text(taxSums[taxRate].toFixed(2), 60, startY, { align: "right" });
    });

    // Print Total SGST, CGST, and Tax
    startY += lineHeight;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Total SGST", 10, startY);
    doc.text(totalSGST.toFixed(2), 60, startY, { align: "right" });

    startY += lineHeight;
    doc.text("Total CGST", 10, startY);
    doc.text(totalCGST.toFixed(2), 60, startY, { align: "right" });

    startY += lineHeight;
    doc.text("Total Tax", 10, startY);
    doc.text(totalTax.toFixed(2), 60, startY, { align: "right" });

    // Print Grand Total with increased font size and bold
    startY += lineHeight;
    doc.setFontSize(16); // Increase font size for the grand total
    doc.setFont("helvetica", "bold"); // Set font to bold
    doc.text("Grand Total", 120, startY);
    const grandTotal = salesEntry.items.reduce(
      (total, item) => total + item.amount,
      0
    );
    doc.text(grandTotal.toFixed(2), totalAmountColx, startY, {
      align: "right",
    });

    // Save or Open the PDF
    doc.save("invoice.pdf");
  };

  return (
    <div>
      <Button variant="contained" color="secondary" onClick={handlePrint}>
        Print Invoice
      </Button>
    </div>
  );
};

export default InvoiceGenerator;
