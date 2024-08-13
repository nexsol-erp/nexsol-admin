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
          <ListItem button component="a" href="#setup-sequence">
            <ListItemText primary="Setup Sequence" />
          </ListItem>
          <ListItem button component="a" href="#menu-descriptions">
            <ListItemText primary="Menu Descriptions" />
          </ListItem>
          <ListItem button component="a" href="#desktop-menus">
            <ListItemText primary="Desktop Menus" />
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
          Welcome to our system, designed for efficient management of sales,
          purchases, stock, and other business operations across multiple
          branches. This guide will help you navigate the system and make the
          most of its features.
        </Typography>

        <Typography variant="h5" gutterBottom id="system-requirements">
          System Requirements
        </Typography>
        <Typography paragraph>
          To use the system effectively, ensure you have:
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
              Access the Login Page: Open your web browser and navigate to your
              system's login page.
            </li>
            <li>
              Login: Enter your username and password, then click "Login". If
              successful, you'll be redirected to the dashboard.
            </li>
          </ol>
        </Typography>

        <Typography variant="h5" gutterBottom id="setup-sequence">
          Setup Sequence
        </Typography>
        <Typography paragraph>
          Follow these steps to set up the system:
          <ol>
            <li>Signup: Create an account.</li>
            <li>Login: Log in with your credentials.</li>
            <li>Create Branch: Set up new branches.</li>
            <li>
              Download Desktop for Each Branch: Install the desktop application
              for each branch.
            </li>
            <li>
              Create User for Branch: Set up user accounts for each branch.
            </li>
            <li>
              Create Category Type and Name: Define categories for your items.
            </li>
            <li>
              Upload Item Masters: Upload item master data using the specified
              Excel format.
            </li>
            <p>
              The following details are required for each item: Item Name, Tax
              Rate, Unit Name, Item Code, Standard Price, HSN Code, Item ID, and
              Barcode.
              <br>
                <strong>Note:</strong> Tax Rate and Standard Price should be in
                numeric format, while all other columns should be in text
                format.
              </br>
            </p>
            <li>
              Upload Stock for Each Branch: Upload stock data using the
              specified Excel format.
            </li>
            <p>
              The following details are required for each record : Stock Date,
              ITem name, Branch code , Qty , Batch,Expiry date
              <br>
                <strong>Note:</strong> Note: Stock Date and Expiry should be in
                dd/MM/yyyy format. Qty in numeric and all other in Text Format.
              </br>
            </p>
            <li>
              Initialize Desktop Application: Go to the 'Initialize' menu,
              select 'All', and click 'Fetch'.
            </li>
            <li>Start Billing: You can now begin processing transactions.</li>
          </ol>
        </Typography>

        <Typography variant="h5" gutterBottom id="menu-descriptions">
          Menu Descriptions
        </Typography>
        <Typography paragraph>
          <strong>Dashboard</strong>: Provides an overview of key metrics and
          performance indicators.
        </Typography>
        <Typography paragraph>
          <strong>Sales Entry</strong>: Record and manage sales transactions.
        </Typography>
        <Typography paragraph>
          <strong>HSNwise Sales Report</strong>: Generate reports based on HSN
          codes.
        </Typography>
        <Typography paragraph>
          <strong>Purchase</strong>: Manage purchase activities with sub-menus
          for Purchase Entry and Purchase Report.
        </Typography>
        <Typography paragraph>
          <strong>Branch Creation</strong>: Create new branches for your
          business.
        </Typography>
        <Typography paragraph>
          <strong>User Creation</strong>: Manage user accounts and roles.
        </Typography>
        <Typography paragraph>
          <strong>Scheme</strong>: Create and manage promotional schemes.
        </Typography>
        <Typography paragraph>
          <strong>Masters</strong>: Manage master data, including Category Type,
          Category Name, and Supplier Creation.
        </Typography>
        <Typography paragraph>
          <strong>Reports</strong>: Access various reports like Sales, Purchase,
          Stock Movement, Bill Series, and Season Sales.
        </Typography>
        <Typography paragraph>
          <strong>Download</strong>: Download desktop application for each
          branch.
        </Typography>
        <Typography paragraph>
          <strong>Upload</strong>: Upload files or data into the system.
        </Typography>

        <Typography variant="h5" gutterBottom id="desktop-menus">
          Desktop Menus
        </Typography>
        <Typography paragraph>
          <strong>Day End Report</strong>: Generate a summary report for the
          day's operations.
        </Typography>
        <Typography paragraph>
          <strong>POS</strong>: Access the Point of Sale system.
        </Typography>
        <Typography paragraph>
          <strong>KOT</strong>: Manage Kitchen Order Tickets.
        </Typography>
        <Typography paragraph>
          <strong>Credit Sales</strong>: Record credit sales.
        </Typography>
        <Typography paragraph>
          <strong>Stock Transfer</strong>: Transfer stock between branches.
        </Typography>
        <Typography paragraph>
          <strong>Accept Stock</strong>: Record incoming stock.
        </Typography>
        <Typography paragraph>
          <strong>Purchase</strong>: Manage purchases directly from the desktop
          application.
        </Typography>
        <Typography paragraph>
          <strong>Initialize</strong>: Initialize the system or synchronize
          data.
        </Typography>
        <Typography paragraph>
          <strong>Physical Stock</strong>: Manage and update physical stock
          inventory.
        </Typography>
        <Typography paragraph>
          <strong>Item Masters</strong>: Manage item master data.
        </Typography>
        <Typography paragraph>
          <strong>Production Def, Planning, Execution</strong>: Handle
          production-related activities.
        </Typography>
        <Typography paragraph>
          <strong>Receipt Modes</strong>: Manage payment modes.
        </Typography>
        <Typography paragraph>
          <strong>Supplier</strong>: Manage supplier information.
        </Typography>
        <Typography paragraph>
          <strong>Customer</strong>: Manage customer information.
        </Typography>
        <Typography paragraph>
          <strong>Account Heads</strong>: Manage financial accounts and ledgers.
        </Typography>
        <Typography paragraph>
          <strong>Reports</strong>: Access various reports related to sales,
          purchases, inventory, and accounting.
        </Typography>

        <Typography variant="h5" gutterBottom id="troubleshooting">
          Troubleshooting
        </Typography>
        <Typography paragraph>
          <strong>Common Issues</strong>
          <ul>
            <li>Unable to Login: Check your credentials and server status.</li>
            <li>
              Download Button Not Working: Verify server accessibility and file
              existence.
            </li>
            <li>
              Sales Data Not Loading: Check branch and date selections, and
              server status.
            </li>
            <li>
              Inventory Discrepancies: Ensure all stock movements are logged.
            </li>
            <li>
              POS Not Responding: Restart the application and check server
              connection.
            </li>
          </ul>
        </Typography>

        <Typography variant="h5" gutterBottom id="contact-support">
          Contact Support
        </Typography>
        <Typography paragraph>
          If you encounter any issues, please contact our support team:
          <ul>
            <li>
              <strong>Email</strong>: erpmaple@gmail.com
            </li>
            <li>
              <strong>Phone</strong>:
            </li>
            <li>
              <strong>Support Hours</strong>: Monday to Friday, 9 AM to 5 PM
              (PST)
            </li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
};

export default HelpPage;
