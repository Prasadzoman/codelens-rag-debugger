export async function fetchEmployees() {
  // Simulates remote employee retrieval
  return [
    { id: 1, name: 'Alice Walker', department: 'Engineering', role: 'Staff SRE' },
    { id: 2, name: 'Bob Roberts', department: 'Product', role: 'Lead PM' },
    { id: 3, name: 'Charlie Zheng', department: 'Design', role: 'UX Architect' },
    { id: 4, name: 'Dana Scully', department: 'Security', role: 'Security Engineer' }
  ];
}
