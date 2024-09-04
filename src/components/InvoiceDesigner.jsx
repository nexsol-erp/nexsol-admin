import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Grid,
} from "@mui/material";
import { useFormik } from "formik";
import * as yup from "yup";
import { useDropzone } from "react-dropzone";

const columnOptions = [
  { label: "Item Name", value: "itemName" },
  { label: "Description", value: "description" },
  { label: "Quantity", value: "quantity" },
  { label: "Unit Price", value: "standardPrice" },
  { label: "Tax Rate", value: "taxRate" },
  { label: "Total", value: "total" },
];

const logoPositions = ["Top Left", "Top Center", "Top Right"];

const validationSchema = yup.object({
  companyName: yup.string().required("Company Name is required"),
  companyAddress: yup.string().required("Company Address is required"),
  companyContact: yup.string().required("Company Contact is required"),
  companyGST: yup.string(),
  selectedColumns: yup.array().min(1, "At least one column must be selected"),
  logoPosition: yup.string().required("Logo position is required"),
});

const InvoiceDesigner = ({ onSave }) => {
  const [logoFile, setLogoFile] = useState(null);

  const onDrop = (acceptedFiles) => {
    setLogoFile(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const formik = useFormik({
    initialValues: {
      companyName: "",
      companyAddress: "",
      companyContact: "",
      companyGST: "",
      logoPosition: "Top Left",
      selectedColumns: ["itemName", "quantity", "standardPrice", "total"],
      footerText: "",
    },
    validationSchema,
    onSubmit: (values) => {
      handleSaveTemplate(values);
    },
  });

  const handleSaveTemplate = async (values) => {
    const formData = new FormData();
   

    // Append form data fields
    formData.append(
      "template",
      JSON.stringify({
        companyName: values.companyName,
        companyAddress: values.companyAddress,
        companyContact: values.companyContact,
        companyGST: values.companyGST,
        logoPosition: values.logoPosition,
        selectedColumns: values.selectedColumns,
        footerText: values.footerText,
      })
    );

    // Append logo file if exists
    if (logoFile) {
      formData.append("logo", logoFile);
    }

    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/invoice-templates/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        alert("Invoice template saved successfully!");
      } else {
        alert("Failed to save invoice template.");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      alert("An error occurred while saving the template.");
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Invoice Designer
        </Typography>
        <form onSubmit={formik.handleSubmit}>
          <TextField
            fullWidth
            label="Company Name"
            name="companyName"
            value={formik.values.companyName}
            onChange={formik.handleChange}
            error={
              formik.touched.companyName && Boolean(formik.errors.companyName)
            }
            helperText={formik.touched.companyName && formik.errors.companyName}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Company Address"
            name="companyAddress"
            value={formik.values.companyAddress}
            onChange={formik.handleChange}
            error={
              formik.touched.companyAddress &&
              Boolean(formik.errors.companyAddress)
            }
            helperText={
              formik.touched.companyAddress && formik.errors.companyAddress
            }
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            fullWidth
            label="Company Contact"
            name="companyContact"
            value={formik.values.companyContact}
            onChange={formik.handleChange}
            error={
              formik.touched.companyContact &&
              Boolean(formik.errors.companyContact)
            }
            helperText={
              formik.touched.companyContact && formik.errors.companyContact
            }
            margin="normal"
          />
          <TextField
            fullWidth
            label="Company GST Number"
            name="companyGST"
            value={formik.values.companyGST}
            onChange={formik.handleChange}
            margin="normal"
          />
          <Box
            {...getRootProps()}
            sx={{
              border: "2px dashed #ccc",
              padding: 2,
              textAlign: "center",
              marginY: 2,
              cursor: "pointer",
            }}
          >
            <input {...getInputProps()} />
            {logoFile ? (
              <Typography>{logoFile.name}</Typography>
            ) : (
              <Typography>
                Drag 'n' drop company logo here, or click to select
              </Typography>
            )}
          </Box>
          <FormControl fullWidth margin="normal">
            <InputLabel>Logo Position</InputLabel>
            <Select
              name="logoPosition"
              value={formik.values.logoPosition}
              onChange={formik.handleChange}
            >
              {logoPositions.map((position) => (
                <MenuItem key={position} value={position}>
                  {position}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
            Select Columns to Include
          </Typography>
          <Grid container>
            {columnOptions.map((column) => (
              <Grid item xs={6} key={column.value}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name="selectedColumns"
                      value={column.value}
                      checked={formik.values.selectedColumns.includes(
                        column.value
                      )}
                      onChange={formik.handleChange}
                    />
                  }
                  label={column.label}
                />
              </Grid>
            ))}
          </Grid>
          {formik.touched.selectedColumns && formik.errors.selectedColumns && (
            <Typography color="error" variant="body2">
              {formik.errors.selectedColumns}
            </Typography>
          )}
          <TextField
            fullWidth
            label="Footer Text"
            name="footerText"
            value={formik.values.footerText}
            onChange={formik.handleChange}
            margin="normal"
            multiline
            rows={2}
          />
          <Button
            variant="contained"
            color="primary"
            type="submit"
            sx={{ mt: 2 }}
          >
            Save Template
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default InvoiceDesigner;
