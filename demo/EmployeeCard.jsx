import React from 'react';

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
export default EmployeeCard;
