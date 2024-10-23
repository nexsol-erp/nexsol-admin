import React, { useEffect, useState } from 'react';
import axios from 'axios';

const StockTurnoverReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Retrieve JWT token and Tenancy ID (assuming stored in localStorage)
  const jwtToken = localStorage.getItem('jwtToken');
  const tenancyId = localStorage.getItem('tenancyId');

  useEffect(() => {
    const fetchStockTurnover = async () => {
      try {
        const response = await fetch(`/api/${tenancyId}/reports/stock-turnover`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`, // Passing JWT token
          },
        });
  
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
  
        const result = await response.json();
        setData(result);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    };
  
    fetchStockTurnover();
  }, [jwtToken, tenancyId]); // Ensure useEffect runs when token or tenancyId changes
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Stock Turnover Report</h2>
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Total Purchased Qty</th>
            <th>Total Sold Qty</th>
            <th>Stock Turnover Rate (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <td>{item.itemName}</td>
              <td>{item.totalPurchasedQty}</td>
              <td>{item.totalSoldQty}</td>
              <td>{item.stockTurnoverRate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockTurnoverReport;
