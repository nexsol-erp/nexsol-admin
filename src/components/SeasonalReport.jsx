import React, { useEffect, useState } from "react";
import { getSeasons } from "../services/seasonService";
import { getSeasonalReport } from "../services/reportService";
import {
  Box,
  CircularProgress,
  Typography,
  List,
  ListItem,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from "@mui/material";

const SeasonalReport = () => {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const tenancyId = localStorage.getItem("tenancyId");

  useEffect(() => {
    getSeasons()
      .then((response) => setSeasons(response.data))
      .catch((error) => console.error("Error fetching seasons:", error));
  }, []);

  const handleSeasonChange = (event) => {
    setSelectedSeason(event.target.value);
  };

  const handleGenerateReport = () => {
    setLoading(true);
    getSeasonalReport(tenancyId, selectedSeason)
      .then((response) => {
        setReport(response.data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching seasonal report:", error);
        setLoading(false);
      });
  };

  return (
    <Box>
      <Typography variant="h4">Seasonal Report</Typography>
      <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
        <InputLabel>Season</InputLabel>
        <Select value={selectedSeason} onChange={handleSeasonChange}>
          {seasons.map((season) => (
            <MenuItem key={season.seasonCode} value={season.seasonCode}>
              {season.description}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <Button
        variant="contained"
        color="primary"
        onClick={handleGenerateReport}
        disabled={!selectedSeason || loading}
      >
        Generate Report
      </Button>
      {loading && <CircularProgress />}
      {report && (
        <Box>
          <Typography variant="h6">Predicted Sales:</Typography>
          <List>
            {Object.entries(report.predicted_sales).map(
              ([itemId, quantity]) => (
                <ListItem key={itemId}>
                  <ListItemText
                    primary={`Item ID: ${itemId}`}
                    secondary={`Predicted Quantity: ${quantity}`}
                  />
                </ListItem>
              )
            )}
          </List>
          <Typography variant="h6">Minimum Quantities:</Typography>
          <List>
            {Object.entries(report.minimum_quantities).map(
              ([itemId, quantity]) => (
                <ListItem key={itemId}>
                  <ListItemText
                    primary={`Item ID: ${itemId}`}
                    secondary={`Minimum Quantity: ${quantity}`}
                  />
                </ListItem>
              )
            )}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default SeasonalReport;
