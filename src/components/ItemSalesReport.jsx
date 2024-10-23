import React, { useEffect, useState } from 'react';
import axios from 'axios';

const ItemSalesReport = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Retrieve JWT token and Tenancy ID (assuming stored in localStorage)
  const jwtToken = localStorage.getItem('jwtToken');
  const tenancyId = localStorage.getItem('tenancyId');

  
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/${tenancyId}/reports/itemsales`, {
          headers: {
            'Authorization': `Bearer ${jwtToken}`, // Passing JWT token in headers
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

    fetchData();
  }, [jwtToken, tenancyId]); // Ensure the effect runs again if token or tenancyId changes

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h2>Item Sales Report</h2>
      <table>
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Total Sales</th>
            <th>Total Purchase</th>
            <th>Total Profit</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={index}>
              <td>{item.itemName}</td>
              <td>{item.totalSales}</td>
              <td>{item.totalPurchase}</td>
              <td>{item.totalProfit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ItemSalesReport;
