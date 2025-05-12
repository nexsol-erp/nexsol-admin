import React, { useEffect, useState } from 'react';

const ItemSalesReport = () => {
  const [data, setData] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const jwtToken = localStorage.getItem('jwtToken');
  const tenancyId = localStorage.getItem('tenancyId');

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setError(new Error('Start date and end date are required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = `/api/${tenancyId}/reports/itemsales?startDate=${startDate}T00:00:00&endDate=${endDate}T23:59:59`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      setError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Item Sales Report</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Start Date: 
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        &nbsp;
        <label>
          End Date: 
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        &nbsp;
        <button onClick={fetchData}>Load Report</button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}

      {!loading && !error && (
        <table border="1" cellPadding="8">
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
      )}
    </div>
  );
};

export default ItemSalesReport;
