import React from "react";
import { Button } from "@mui/material";
import jsPDF from "jspdf";

const InvoiceGenerator = ({ template, salesEntry }) => {
  const handlePrint = async () => {
    const doc = new jsPDF("p", "mm", "a4");

    // Use template data to add logo (if available)
    if (template.logoFile) {
      const imgData = template.logoFile; // Assuming the logo file is a base64-encoded string or URL
      doc.addImage(imgData, "PNG", 10, 10, 50, 20); // Adjust positioning as needed
    }

    // Add Company Details from template
    doc.setFontSize(14);
    doc.text(template.companyName || "Company Name", 10, 40);
    doc.text(template.companyAddress || "Address Line 1", 10, 50);
    if (template.companyContact) {
      doc.text(`Contact: ${template.companyContact}`, 10, 60);
    }
    if (template.companyGST) {
      doc.text(`GST Number: ${template.companyGST}`, 10, 70);
    }

    // Add Customer Details from salesEntry
    doc.setFontSize(12);
    doc.text(`Customer: ${salesEntry.customer.name}`, 10, 90);
    doc.text(`Address: ${salesEntry.customer.address}`, 10, 100);
    doc.text(`GST: ${salesEntry.customer.gst}`, 10, 110);

    // Add Table Header
    doc.text("Item", 10, 130);
    doc.text("Quantity", 100, 130);
    doc.text("Price", 130, 130);
    doc.text("Total", 160, 130);

    // Add Items
    let yPos = 140;
    salesEntry.items.forEach((item) => {
      doc.text(item.itemName, 10, yPos);
      doc.text(item.qty.toString(), 100, yPos);
      doc.text(item.standardPrice.toFixed(2), 130, yPos);
      doc.text(item.amount.toFixed(2), 160, yPos);
      yPos += 10;
    });

    // Add Grand Total
    doc.text("Grand Total", 130, yPos + 10);
    const grandTotal = salesEntry.items.reduce(
      (total, item) => total + item.amount,
      0
    );
    doc.text(grandTotal.toFixed(2), 160, yPos + 10);

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
