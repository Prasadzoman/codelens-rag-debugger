import React, { useState, useEffect } from 'react';
import { fetchEmployees } from './api';
import { EmployeeList } from './EmployeeList';

export function App() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmployees().then(data => {
      setEmployees(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-xl font-bold">Staff Directory</h1>
      {loading ? (
        <p>Loading staff records...</p>
      ) : (
        <EmployeeList initialEmployees={employees} />
      )}
    </div>
  );
}
export default App;
