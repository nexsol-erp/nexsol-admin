import React from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Link,
} from "@mui/material";

const HelpPage = () => {
  return (
    <Box sx={{ flexGrow: 1, p: 3, ml: "240px", mt: 2 }}>
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: "800px", margin: "auto" }}
      >
        <Typography variant="h4" gutterBottom>
          User Manual
        </Typography>

        <Typography variant="h5" gutterBottom>
          Table of Contents
        </Typography>
        <List component="nav">
          <ListItem button component="a" href="#introduction">
            <ListItemText primary="Introduction" />
          </ListItem>
          <ListItem button component="a" href="#system-requirements">
            <ListItemText primary="System Requirements" />
          </ListItem>
          <ListItem button component="a" href="#login-and-authentication">
            <ListItemText primary="Login and Authentication" />
          </ListItem>
          <ListItem
            button
            component="a"
            href="#using-the-file-download-feature"
          >
            <ListItemText primary="Using the File Download Feature" />
          </ListItem>
          <ListItem button component="a" href="#technical-details">
            <ListItemText primary="Technical Details" />
          </ListItem>
          <ListItem button component="a" href="#troubleshooting">
            <ListItemText primary="Troubleshooting" />
          </ListItem>
          <ListItem button component="a" href="#contact-support">
            <ListItemText primary="Contact Support" />
          </ListItem>
        </List>

        <Typography variant="h5" gutterBottom id="introduction">
          Introduction
        </Typography>
        <Typography paragraph>
          Welcome to MapleERP, a POS system integrated with accounting and
          inventory. This system is ideal for retail outlets with multiple
          branches. We have a desktop application for fast POS billing. You can
          monitor all branches using the web application. You can download the
          desktop application for trial using the provided link.
        </Typography>

        <Typography variant="h5" gutterBottom id="system-requirements">
          System Requirements
        </Typography>
        <Typography paragraph>
          To use MapleERP, ensure you have the following:
          <ul>
            <li>A computer with internet access</li>
            <li>
              A modern web browser (Google Chrome, Mozilla Firefox, Microsoft
              Edge, or Safari)
            </li>
            <li>An active user account</li>
          </ul>
        </Typography>

        <Typography variant="h5" gutterBottom id="login-and-authentication">
          Login and Authentication
        </Typography>
        <Typography paragraph>
          <ol>
            <li>
              Access the Login Page: Open your web browser and navigate to{" "}
              <code>http://localhost:3000</code> (or the URL where your frontend
              application is hosted).
            </li>
            <li>
              Login: Enter your username and password, then click the "Login"
              button. If the credentials are correct, you will be logged in and
              redirected to the main dashboard.
            </li>
          </ol>
        </Typography>

        <Typography
          variant="h5"
          gutterBottom
          id="using-the-file-download-feature"
        >
          Using the File Download Feature
        </Typography>
        <Typography paragraph>
          <strong>Navigating to the Download Page</strong>
          <ol>
            <li>
              Access the Download Page: After logging in, navigate to the
              "Download" section from the main menu.
            </li>
            <li>
              Download the Desktop Application: Click the "Download Now" button
              to download the latest version of the desktop application. A
              prompt will appear asking you to choose the download location and
              file name.
            </li>
          </ol>

          <Typography variant="h5" gutterBottom id="technical-details">
            Web Reports
          </Typography>
          <strong>Sales Report</strong>
          <ol>
            <li>
              Select Branch and Date Range: Choose the branch from the dropdown
              menu. Select the "From Date" and "To Date" to specify the date
              range for the report.
            </li>
            <li>
              Fetch Sales Data: Click the "Fetch Sales Data" button to retrieve
              the sales data for the selected branch and date range.
            </li>
            <li>
              Export to Excel: Click the "Export to Excel" button. A file save
              dialog will appear, allowing you to choose the name and location
              for the Excel file. The sales data will be saved to an Excel file
              at the chosen location.
            </li>
          </ol>
        </Typography>

        <Typography variant="h5" gutterBottom id="technical-details">
          Desktop POS
        </Typography>
        <Typography paragraph>
          <strong>Menus</strong>
          <ul>
            <li>
              <strong>POS</strong>: POS Billing. This is the fastest billing
              method. You can use a barcode scanner to select items.
            </li>
            <li>
              <strong>KOT</strong>: Kitchen Order Ticket. Capture the order and
              convert it into POS.
            </li>
            <li>
              <strong>Stock Transfer</strong>: You can transfer stock from one
              location to another.
            </li>
            <li>
              <strong>Accept Stock</strong>: Transferred stock is accepted here.
            </li>
            <li>
              <strong>Purchase</strong>: Manage purchase orders and receive
              inventory.
            </li>
            <li>
              <strong>Day End</strong>: Perform end-of-day operations to close
              out the day's transactions.
            </li>
            <li>
              <strong>Scheme Offer</strong>: Manage promotional schemes and
              offers.
            </li>
            <li>
              <strong>Item Master Creation</strong>: Create and manage item
              master data.
            </li>
            <li>
              <strong>Inventory</strong>: Manage inventory levels and stock
              details.
            </li>
            <li>
              <strong>Reports</strong>: Generate various reports for sales,
              inventory, and more.
            </li>
            <li>
              <strong>Settings</strong>: Configure system settings and user
              preferences.
            </li>
            <li>
              <strong>Customer Management</strong>: Manage customer information
              and history.
            </li>
            <li>
              <strong>Supplier Management</strong>: Manage supplier information
              and purchase history.
            </li>
            <li>
              <strong>Loyalty Programs</strong>: Manage customer loyalty
              programs and rewards.
            </li>
            <li>
              <strong>Table Management</strong> (for restaurants): Manage table
              reservations and status.
            </li>
            <li>
              <strong>Menu Management</strong> (for restaurants): Manage food
              and beverage menu items.
            </li>
            <li>
              <strong>Prescription Management</strong> (for pharmacies): Manage
              and fill customer prescriptions.
            </li>
            <li>
              <strong>Expiry Management</strong> (for pharmacies): Track and
              manage product expiry dates.
            </li>
            <li>
              <strong>Batch Management</strong> (for pharmacies): Manage
              inventory batches and lot numbers.
            </li>
          </ul>
        </Typography>

        <Typography variant="h5" gutterBottom id="troubleshooting">
          Troubleshooting
        </Typography>
        <Typography paragraph>
          <strong>Common Issues</strong>
          <ul>
            <li>
              <strong>Unable to Login</strong>: Ensure your credentials are
              correct. Check if the backend server is running.
            </li>
            <li>
              <strong>Download Button Not Working</strong>: Ensure the backend
              server is running and accessible. Check if the file exists on the
              server.
            </li>
            <li>
              <strong>Sales Data Not Loading</strong>: Verify that the selected
              branch and date range are correct. Ensure the backend server is
              running and accessible.
            </li>
            <li>
              <strong>Inventory Discrepancies</strong>: Ensure that all stock
              movements (sales, transfers, purchases) are correctly logged.
            </li>
            <li>
              <strong>POS Not Responding</strong>: Restart the POS application
              and ensure the connection to the backend server is stable.
            </li>
          </ul>
        </Typography>

        <Typography variant="h5" gutterBottom id="contact-support">
          Contact Support
        </Typography>
        <Typography paragraph>
          If you encounter any issues not covered in this manual, please contact
          our support team:
          <ul>
            <li>
              <strong>Email</strong>: support@example.com
            </li>
            <li>
              <strong>Phone</strong>: +1 (555) 123-4567
            </li>
            <li>
              <strong>Support Hours</strong>: Monday to Friday, 9 AM to 5 PM
              (PST)
            </li>
          </ul>
          Thank you for using MapleERP. We hope this manual helps you make the
          most of the system's features.
        </Typography>
      </Paper>
    </Box>
  );
};

export default HelpPage;
