import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
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

const validationSchema = yup.object({
  companyName: yup.string().required("Company Name is required"),
  companyAddress: yup.string().required("Company Address is required"),
  companyContact: yup.string().required("Company Contact is required"),
  companyGST: yup.string(),
  selectedColumns: yup.array().min(1, "At least one column must be selected"),
  logoWidth: yup
    .number()
    .min(1, "Logo width must be greater than 0")
    .required("Logo width is required"),
  logoHeight: yup
    .number()
    .min(1, "Logo height must be greater than 0")
    .required("Logo height is required"),
  logoStartX: yup
    .number()
    .min(0, "Logo start X position must be greater than or equal to 0")
    .required("Logo start X position is required"),
  logoStartY: yup
    .number()
    .min(0, "Logo start Y position must be greater than or equal to 0")
    .required("Logo start Y position is required"),
});

const InvoiceDesigner = ({ onSave }) => {
  const [logoFile, setLogoFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [activeTemplateId, setActiveTemplateId] = useState(null);

  const onDrop = (acceptedFiles) => {
    setLogoFile(acceptedFiles[0]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(`/api/${tenancyId}/invoice-templates`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setTemplates(data);
      // Find the active template
      const activeTemplate = data.find((template) => template.active === 1);
      if (activeTemplate) {
        setActiveTemplateId(activeTemplate.id);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(
        `/api/${tenancyId}/invoice-templates/delete/${templateId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert("Template deleted successfully!");
        fetchTemplates(); // Refresh templates after deletion
      } else {
        alert("Failed to delete template.");
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      alert("An error occurred while deleting the template.");
    }
  };

  const handleMakeActive = async (templateId) => {
    try {
      const tenancyId = localStorage.getItem("tenancyId");
      const token = localStorage.getItem("jwtToken");
      const response = await fetch(
        `/api/${tenancyId}/invoice-templates/activate/${templateId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert("Template activated successfully!");
        setActiveTemplateId(templateId); // Set the selected template as active
        fetchTemplates(); // Refresh templates after activation
      } else {
        alert("Failed to activate template.");
      }
    } catch (error) {
      console.error("Error activating template:", error);
      alert("An error occurred while activating the template.");
    }
  };

  const formik = useFormik({
    initialValues: {
      companyName: "",
      companyAddress: "",
      companyContact: "",
      companyGST: "",
      logoWidth: 50, // Default values for logo width and height
      logoHeight: 20,
      logoStartX: 15, // Default value for logo X position
      logoStartY: 10, // Default value for logo Y position
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
        logoWidth: values.logoWidth,
        logoHeight: values.logoHeight,
        logoStartX: values.logoStartX,
        logoStartY: values.logoStartY,
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
        fetchTemplates(); // Refresh templates after saving
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
          
          {/* Fields for Logo Width, Height, X Position, and Y Position */}
          <TextField
            fullWidth
            label="Logo Width (in mm)"
            name="logoWidth"
            value={formik.values.logoWidth}
            onChange={formik.handleChange}
            error={formik.touched.logoWidth && Boolean(formik.errors.logoWidth)}
            helperText={formik.touched.logoWidth && formik.errors.logoWidth}
            margin="normal"
            type="number"
          />

          <TextField
            fullWidth
            label="Logo Height (in mm)"
            name="logoHeight"
            value={formik.values.logoHeight}
            onChange={formik.handleChange}
            error={
              formik.touched.logoHeight && Boolean(formik.errors.logoHeight)
            }
            helperText={formik.touched.logoHeight && formik.errors.logoHeight}
            margin="normal"
            type="number"
          />

          <TextField
            fullWidth
            label="Logo Start X Position (in mm)"
            name="logoStartX"
            value={formik.values.logoStartX}
            onChange={formik.handleChange}
            error={
              formik.touched.logoStartX && Boolean(formik.errors.logoStartX)
            }
            helperText={formik.touched.logoStartX && formik.errors.logoStartX}
            margin="normal"
            type="number"
          />

          <TextField
            fullWidth
            label="Logo Start Y Position (in mm)"
            name="logoStartY"
            value={formik.values.logoStartY}
            onChange={formik.handleChange}
            error={
              formik.touched.logoStartY && Boolean(formik.errors.logoStartY)
            }
            helperText={formik.touched.logoStartY && formik.errors.logoStartY}
            margin="normal"
            type="number"
          />

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

      {/* List of available templates */}
      <Paper sx={{ p: 4, mt: 4 }}>
        <Typography variant="h5" gutterBottom>
          Available Templates
        </Typography>

        <FormControl component="fieldset">
          <FormLabel component="legend">Active Template</FormLabel>
          <RadioGroup
            aria-label="active-template"
            name="active-template"
            value={activeTemplateId}
            onChange={(e) => handleMakeActive(Number(e.target.value))}
          >
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Company Name</TableCell>
                    <TableCell>Columns</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>{template.companyName}</TableCell>
                      <TableCell>
                        {template.selectedColumns.join(", ")}
                      </TableCell>
                      <TableCell>
                        <Radio value={template.id} />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleDeleteTemplate(template.id)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </RadioGroup>
        </FormControl>
      </Paper>
    </Box>
  );
};

export default InvoiceDesigner;
