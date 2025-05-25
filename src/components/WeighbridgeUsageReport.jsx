
import React, { useState } from 'react';

const WeighbridgeUsageReport = () => {
  const [summary, setSummary] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [trainMessage, setTrainMessage] = useState('');
  const tenancyId = localStorage.getItem('tenancyId');
  const token = localStorage.getItem("jwtToken");

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setError(new Error('Start date and end date are required'));
      return;
    }

    setLoading(true);
    setError(null);
    setTrainMessage('');

    try {
      const url = `/api/${tenancyId}/predict-summary?from=${startDate}&to=${endDate}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      setSummary(result);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const runTraining = async () => {
    setLoading(true);
    setError(null);
    setTrainMessage('');

    try {
      const response = await fetch(`/api/${tenancyId}/train`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        method: 'POST',
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || 'Training request failed');
      }

      setTrainMessage(text);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Weighbridge Daily Usage Report</h2>
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
        &nbsp;
        <button onClick={runTraining}>Train Model</button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      {trainMessage && <div style={{ color: 'green' }}>{trainMessage}</div>}

      {!loading && !error && summary && (
        <table border="1" cellPadding="8">
          <thead>
            <tr>
              <th>Date</th>
              <th>Predicted Usage Count</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(summary.usage_summary).map(([date, count]) => (
              <tr key={date}>
                <td>{date}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default WeighbridgeUsageReport;
