import React, { useState } from 'react';
import axios from 'axios';

const DocumentList = () => {
  // State to hold the tenantId and voucher
  const [tenantId, setTenantId] = useState('');
  const [voucher, setVoucher] = useState('');
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDocuments = async () => {
    if (!tenantId || !voucher) {
      setError('Tenant ID and Voucher are required');
      return;
    }
  
    setError('');
    setLoading(true);
  
    const jwtToken = localStorage.getItem('jwtToken');
    const tenancyId = localStorage.getItem('tenancyId');
  
    try {
      const response = await fetch(`/api/${tenantId}/${voucher}`, {
        headers: {
          'Authorization': `Bearer ${jwtToken}` // Passing JWT Token in the header
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
  
      const data = await response.json();
      setDocuments(data); // Set the returned documents in state
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to fetch documents');
      setLoading(false);
    }
  };
  

  // JSX for rendering the form and document list
  return (
    <div>
      <h2>Document List</h2>
      
      {/* Input for Tenant ID */}
      <div>
        <label htmlFor="tenantId">Tenant ID:</label>
        <input
          type="text"
          id="tenantId"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="Enter Tenant ID"
        />
      </div>

      {/* Input for Voucher */}
      <div>
        <label htmlFor="voucher">Voucher:</label>
        <input
          type="text"
          id="voucher"
          value={voucher}
          onChange={(e) => setVoucher(e.target.value)}
          placeholder="Enter Voucher"
        />
      </div>

      {/* Button to trigger the API call */}
      <button onClick={fetchDocuments}>Fetch Documents</button>

      {/* Loading Indicator */}
      {loading && <p>Loading documents...</p>}

      {/* Error Message */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Document List Display */}
      {documents.length > 0 && (
        <div>
          <h3>Documents:</h3>
          <ul>
            {documents.map((doc, index) => (
              <li key={index}>
                {/* Display each document's details (assuming document has a 'name' and 'description') */}
                <strong>{doc.name}</strong>: {doc.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DocumentList;
