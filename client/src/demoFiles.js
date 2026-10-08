export const DEMO_FILES = [
  {
    name: 'EmployeeList.jsx',
    lines: 42,
    size: 1150,
    content: `import React, { useState } from 'react';
import { EmployeeCard } from './EmployeeCard';

export function EmployeeList({ initialEmployees = [] }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(initialEmployees);

  // DELIBERATE BUG: React state update 'setQuery' is asynchronous.
  // Reading 'query' on the subsequent line evaluates the previous (stale) query state,
  // causing the search results to lag by one keystroke.
  function handleSearch(e) {
    const val = e.target.value;
    setQuery(val);
    const results = initialEmployees.filter(emp =>
      emp.name.toLowerCase().includes(query.toLowerCase())
    );
    setFiltered(results);
  }

  return (
    <div className="space-y-4">
      <div className="search-bar">
        <input
          type="text"
          value={query}
          onChange={handleSearch}
          placeholder="Search employees by name..."
          className="border p-2 rounded w-full"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(emp => (
          <EmployeeCard key={emp.id} employee={emp} />
        ))}
      </div>
    </div>
  );
}
export default EmployeeList;`
  },
  {
    name: 'App.jsx',
    lines: 26,
    size: 680,
    content: `import React, { useState, useEffect } from 'react';
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
export default App;`
  },
  {
    name: 'api.js',
    lines: 11,
    size: 420,
    content: `export async function fetchEmployees() {
  return [
    { id: 1, name: 'Alice Walker', department: 'Engineering', role: 'Staff SRE' },
    { id: 2, name: 'Bob Roberts', department: 'Product', role: 'Lead PM' },
    { id: 3, name: 'Charlie Zheng', department: 'Design', role: 'UX Architect' },
    { id: 4, name: 'Dana Scully', department: 'Security', role: 'Security Engineer' }
  ];
}`
  },
  {
    name: 'EmployeeCard.jsx',
    lines: 16,
    size: 380,
    content: `import React from 'react';

export function EmployeeCard({ employee }) {
  return (
    <div className="card p-4 border rounded shadow-sm bg-white">
      <h3 className="font-bold text-lg">{employee.name}</h3>
      <p className="text-gray-600 text-sm">{employee.role}</p>
      <span className="badge inline-block mt-2 px-2 py-1 bg-gray-100 text-xs rounded">
        {employee.department}
      </span>
    </div>
  );
}
export default EmployeeCard;`
  }
];

export const DEMO_QUERY = "Employee search sometimes shows stale results. Find the likely bug and explain why.";
