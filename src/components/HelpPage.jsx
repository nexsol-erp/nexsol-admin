import React from "react";
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

const HelpPage = () => {
  return (
    <Box sx={{ color: '#333',
        p: 4,
        width: "100%",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
        boxSizing: "border-box",
        overflowX: "hidden",
      }}
    >
      <Paper
        elevation={3}
        sx={{ padding: 4, maxWidth: "1000px", margin: "auto", backgroundColor: "#fafafa",
          borderRadius: "12px",
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ color: "#212121" }}>
          User Manual
        </Typography>

        <Typography variant="h5" gutterBottom sx={{ color: "#333" }}>
          Table of Contents
        </Typography>
        <List component="nav">
          {[
            "introduction",
            "system-requirements",
            "login-and-authentication",
            "setup-sequence",
            "menu-descriptions",
            "desktop-menus",
            "troubleshooting",
            "contact-support",
          ].map((section) => (
            <ListItem button component="a" href={`#${section}`} key={section}>
              <ListItemText sx={{ color: '#333' }}
                primary={section
                  .replace(/-/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              />
            </ListItem>
          ))}
        </List>

        <Typography variant="h5" gutterBottom id="introduction">
          Introduction
        </Typography>
        <Typography paragraph sx={{ color: "#444" }}>
          Welcome to our system, designed for efficient management of sales,
          purchases, stock, and other business operations across multiple
          branches. This guide will help you navigate the system and make the
          most of its features.
        </Typography>

        <Typography variant="h5" gutterBottom id="system-requirements">
          System Requirements
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          To use the system effectively, ensure you have:
        </Typography>
        <ul style={{ color: '#444' }}>
          <li>A computer with internet access</li>
          <li>
            A modern web browser (Google Chrome, Mozilla Firefox, Microsoft
            Edge, or Safari)
          </li>
          <li>An active user account</li>
        </ul>

        <Typography variant="h5" gutterBottom id="login-and-authentication">
          Login and Authentication
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>Follow these steps to log in:</Typography>
        <ol style={{ color: '#444' }}>
          <li>
            Access the Login Page: Open your web browser and navigate to your
            system's login page.
          </li>
          <li>
            Login: Enter your username and password, then click "Login". If
            successful, you'll be redirected to the dashboard.
          </li>
        </ol>

        <Typography variant="h5" gutterBottom id="setup-sequence">
          Setup Sequence
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          Follow these steps to set up the system:
        </Typography>
        <ol style={{ color: '#444' }}>
          <li>Signup: Create an account.</li>
          <li>Login: Log in with your credentials.</li>
          <li>Create Branch: Set up new branches.</li>
          <li>
            Download Desktop for Each Branch: Install the desktop application
            for each branch.
          </li>
          <li>Create User for Branch: Set up user accounts for each branch.</li>
          <li>
            Create Category Type and Name: Define categories for your items.
          </li>
          <li>
            Upload Item Masters: Upload item master data using the specified
            Excel format.
          </li>
        </ol>
        <Typography paragraph sx={{ color: '#444' }}>
          The following details are required for each item in order:  <li>Item Name</li>
  <li>Tax Rate</li>
  <li>Unit Name</li>
  <li>Item Code</li>
  <li>Standard Price</li>
  <li>HSN Code</li>
  <li>Item ID</li>
  <li>Barcode</li>
          <br />
          <strong>Note:</strong> Tax Rate and Standard Price should be in
          numeric format, while all other columns should be in text format.
        </Typography>
        <ol style={{ color: '#444' }}>
          <li>
            Upload Stock for Each Branch: Upload stock data using the specified
            Excel format.
          </li>
        </ol>
        <Typography paragraph sx={{ color: '#444' }}>
          The following details are required for each record in order: Stock
          <li>
          Date, 
          </li>
          <li>Item Name, </li>
          <li>Branch Code, </li> 
          <li>Qty,</li>
          <li>Batch (Default 'NB'), </li>
          <li>Expiry Date (This can be null).</li>
          <br />
          <strong>Note:</strong> Stock Date and Expiry should be in dd/MM/yyyy
          format. Qty in numeric and all other in Text Format.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
        <strong>Supplier Master:</strong>   can be uploaded from excel file
          Supplier Mst Excel Format:  
          <li>
          Supplier Name, 
          </li>
          <li>Address, </li>
          <li>GST, </li> 
          <li>State,</li>
          <li>Phone  </li>
          
          <br />
           
        </Typography>
        

        <Typography variant="h5" gutterBottom id="menu-descriptions">
          Menu Descriptions
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Dashboard:</strong> Provides an overview of key metrics and
          performance indicators.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Sales Entry:</strong> Record and manage sales transactions.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>HSNwise Sales Report:</strong> Generate reports based on HSN
          codes.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Purchase:</strong> Manage purchase activities with sub-menus
          for Purchase Entry and Purchase Report.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Branch Creation:</strong> Create new branches for your
          business.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>User Creation:</strong> Manage user accounts and roles.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Scheme:</strong> Create and manage promotional schemes.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Masters:</strong> Manage master data, including Category Type,
          Category Name, and Supplier Creation.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Reports:</strong> Access various reports like Sales, Purchase,
          Stock Movement, Bill Series, and Season Sales.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Download:</strong> Download desktop application for each
          branch.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Upload:</strong> Upload files or data into the system.
        </Typography>

        <Typography variant="h5" gutterBottom id="desktop-menus">
          Desktop Menus
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Day End Report:</strong> Generate a summary report for the
          day's operations.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>POS:</strong> Access the Point of Sale system.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>KOT:</strong> Manage Kitchen Order Tickets.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Credit Sales:</strong> Record credit sales.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Stock Transfer:</strong> Transfer stock between branches.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Accept Stock:</strong> Record incoming stock.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Purchase:</strong> Manage purchases directly from the desktop
          application.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Initialize:</strong> Initialize the system or synchronize
          data.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Physical Stock:</strong> Manage and update physical stock
          inventory.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Item Masters:</strong> Manage item master data.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Production Def, Planning, Execution:</strong> Handle
          production-related activities.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Receipt Modes:</strong> Manage payment modes.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Supplier:</strong> Manage supplier information.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Customer:</strong> Manage customer information.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Account Heads:</strong> Manage financial accounts and ledgers.
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Reports:</strong> Access various reports related to sales,
          purchases, inventory, and accounting.
        </Typography>

        <Typography variant="h5" gutterBottom id="troubleshooting">
          Troubleshooting
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          <strong>Common Issues:</strong>
        </Typography>
        <ul style={{ color: '#444' }}>
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
            System Slow: Check your internet connection and server load.
          </li>
        </ul>

        <Typography variant="h5" gutterBottom id="contact-support">
          Contact Support
        </Typography>
        <Typography paragraph sx={{ color: '#444' }}>
          If you encounter any issues not covered in this manual, please contact
          our support team at <strong>erp.nexsol@gmail.com</strong>.
        </Typography>
      </Paper>
    </Box>
  );
};

export default HelpPage;
