# CodeLens Demo Scenario: Stale React State Bug

This folder contains a minimal React application demonstrating a common real-world bug.

## The Bug

In `EmployeeList.jsx`:
```jsx
function handleSearch(e) {
  const val = e.target.value;
  setQuery(val);
  const results = initialEmployees.filter(emp =>
    emp.name.toLowerCase().includes(query.toLowerCase()) // ⚠️ BUG: query is stale!
  );
  setFiltered(results);
}
```

Because `setQuery` is asynchronous, reading `query` on the very next line evaluates the **previous** state value. The filtered results lag behind user keystrokes.

## How to Test with CodeLens

1. In the CodeLens UI, click **"Load Demo Bug"** in the top bar (or upload the 4 files in this `demo/` folder: `App.jsx`, `EmployeeList.jsx`, `api.js`, `EmployeeCard.jsx`).
2. The query field is populated with:
   > "Employee search sometimes shows stale results. Find the likely bug and explain why."
3. Click **"Analyze with Local RAG"**.
4. Observe the RAG pipeline stages:
   - Chunking `EmployeeList.jsx` into React components and functions.
   - Vector embedding generation.
   - FAISS vector search retrieving `EmployeeList.jsx` around lines 10–20.
   - LLM structured diagnosis pinpointing `EmployeeList.jsx` lines 12–18.
5. Inspect the highlighted suspicious lines in the code viewer, the supporting evidence card with similarity score, and the suggested fix.
