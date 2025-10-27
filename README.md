# Expense Tracker Frontend

Simple React + Vite frontend that fetches expenses from `http://localhost:8080/api/expenses` and displays them.

Prerequisites
- Node.js (v16+ recommended) and npm installed.

Run (PowerShell)

```powershell
npm install
npm run dev
```

Open the site at the URL printed by Vite (usually http://localhost:5173).

Notes
- The backend API must be running and accessible at `http://localhost:8080/api/expenses`.
- The app expects the endpoint to return a JSON array of expense objects. Example item: `{ "id": 1, "date": "2025-10-27", "description": "Lunch", "amount": 12.50 }`.

If you want CORS disabled locally for testing, ensure the backend allows requests from the dev server origin (usually http://localhost:5173).