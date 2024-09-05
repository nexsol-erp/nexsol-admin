import React, { useEffect, useState } from "react";
import { Button } from "@mui/material";
import jsPDF from "jspdf";

const InvoiceGenerator = ({ salesEntry }) => {
  const [template, setTemplate] = useState(null);
  const [logoBase64, setLogoBase64] = useState(null);

  useEffect(() => {
    // Fetch the active template (including logo) from the server
    const fetchTemplate = async () => {
      try {
        const tenancyId = localStorage.getItem("tenancyId");
        const token = localStorage.getItem("jwtToken");
        const response = await fetch(
          `/api/${tenancyId}/invoice-templates/active`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await response.json();
        setTemplate(data.template); // Set the template data
        setLogoBase64(data.logoBase64); // Set the logo base64 data
      } catch (error) {
        console.error("Error fetching template:", error);
      }
    };

    fetchTemplate();
  }, []);

  const handlePrint = async () => {
    if (!template) {
      alert("Loading template...");
      return;
    }

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

    // Use logo configuration from the template
    const logoStartX = template.logoStartX || 10; // Default to 10 if not provided
    const logoStartY = template.logoStartY || 10; // Default to 10 if not provided
    const logoWidth = template.logoWidth || 50; // Default width 50mm
    const logoHeight = template.logoHeight || 20; // Default height 20mm

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

      // Display logo if available, using the coordinates and size from the template
      if (logoBase64) {
        doc.addImage(
          `data:image/png;base64,${logoBase64}`,
          "PNG",
          logoStartX,
          logoStartY,
          logoWidth,
          logoHeight
        );
        // startY += logoHeight + 10; // If you want to adjust startY after logo
      }

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
   doc.line(lineXStart, startY, lineXEnd, startY);
   startY += lineHeight;
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

    // Function to check if a new page is needed
    const checkNewPage = (additionalSpace = 0) => {
      if (startY + additionalSpace >= pageHeight - marginY - 20) {
        doc.addPage();
        startY = marginY; // Reset Y position for the new page
        printHeaders(); // Re-print headers on the new page
        addPageNumber();
      }
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

    // Initialize tax object to accumulate tax amounts by tax rate
    let totalSGST = 0;
    let totalCGST = 0;
    let totalTax = 0; // To store the total tax across all items
    let grandTotal = 0;

    // Add Items, calculate tax, and display tax rate, SGST, CGST
    salesEntry.items.forEach((item) => {
      // Calculate tax amount for the item
      const taxRate = item.taxRate || 0;
      const itemTotal = item.amount || 0;
      const taxAmount = (itemTotal * taxRate) / 100;
      const sgstAmount = taxAmount / 2; // Split tax into SGST
      const cgstAmount = taxAmount / 2; // Split tax into CGST

      // Accumulate totals
      totalSGST += sgstAmount;
      totalCGST += cgstAmount;
      totalTax += taxAmount;
      grandTotal += itemTotal;

      // Check if a new page is needed before printing the item
      checkNewPage();

      // Print item details (right-align amount fields)
      doc.text(item.itemName, startX, startY);
      doc.text(item.qty.toString(), qtyColx, startY, { align: "right" });
      doc.text(item.standardPrice.toFixed(2), priceColx, startY, {
        align: "right",
      });
      doc.text(`${taxRate}%`, taxRateColx, startY, { align: "right" });
      doc.text(sgstAmount.toFixed(2), sgstColx, startY, { align: "right" });
      doc.text(cgstAmount.toFixed(2), cgstColx, startY, { align: "right" });
      doc.text(itemTotal.toFixed(2), totalAmountColx, startY, {
        align: "right",
      });

      startY += lineHeight;
    });

    // ** Check space before printing totals **
    const spaceForTotals = 5 * lineHeight; // Space needed for totals section
    checkNewPage(spaceForTotals);

    // Draw a line before totals
    doc.setLineWidth(0.5);
    doc.line(startX, startY, pageWidth - startX, startY);
    startY += lineHeight;

    // Print Total SGST, CGST, Total Tax, and Grand Total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");

    doc.text("Total SGST:", startX, startY);
    doc.text(totalSGST.toFixed(2), totalAmountColx, startY, { align: "right" });
    startY += lineHeight;

    doc.text("Total CGST:", startX, startY);
    doc.text(totalCGST.toFixed(2), totalAmountColx, startY, { align: "right" });
    startY += lineHeight;

    doc.text("Total Tax:", startX, startY);
    doc.text(totalTax.toFixed(2), totalAmountColx, startY, { align: "right" });
    startY += lineHeight;

    doc.text("Grand Total:", startX, startY);
    doc.text(grandTotal.toFixed(2), totalAmountColx, startY, {
      align: "right",
    });
    startY += lineHeight;

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
