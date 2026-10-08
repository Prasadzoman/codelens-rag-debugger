import React, { useState } from 'react';
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
export default EmployeeList;
