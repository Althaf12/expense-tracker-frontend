## Copilot / AI Agent Instructions for expense-tracker-frontend

Summary
- **Stack**: React 18 + TypeScript + Vite. Router: `react-router-dom` v6. Build scripts in `package.json`.
- **Purpose**: Frontend expects a backend API (default `http://localhost:8081/api`). Many flows depend on a running backend.

Quick start (PowerShell)
```powershell
npm install
VITE_API_BASE=http://localhost:8081/api npm run dev
```
Or set a `.env` / environment variable `VITE_API_BASE` before `npm run dev` to override the API base.

Important files & patterns
- `src/api/index.ts`: single HTTP helper `request(path, options)` and many exported API helpers (e.g. `fetchUserExpenses`, `createUserExpenseCategory`). Use this file to add or update REST calls. The helper:
  - uses `import.meta.env.VITE_API_BASE` fallback to `http://localhost:8081/api`.
  - sets `Content-Type: application/json` when a `body` is provided and serializes non-string bodies.
  - returns parsed JSON (or text) and throws a helpful error on non-2xx responses.
  - many exported functions validate `username` via `ensureUsername` and expect encoded path params.

- `src/types/app.ts`: central TypeScript types for `SessionData`, `Expense`, `UserExpenseCategory`, `UserExpense`, `Income`. When changing shapes, update these types first and then the API layer.

- `src/context/AppDataContext.tsx`: single app-wide data context. The app relies on this provider for session, caches, and helpers like `ensureExpenseCategories` and `reloadExpensesCache`.
  - `App` populates and persists session into `localStorage` under key `session` (see `src/App.tsx`). Keep this in mind when modifying authentication/session flows.

- `src/App.tsx` and `src/main.tsx`: app wiring — `BrowserRouter`, `Routes`, `Layout` usage, and how pages are mounted. Route components live under `src/pages/*` and layout pieces under `src/components/layout/*`.

Conventions & patterns to follow
- Add API requests to `src/api/index.ts` (use the `request()` helper). Export the function and include it in the default export at the bottom of the file.
- All API helpers are camelCase and validate inputs (especially `username`). Reuse `ensureUsername` when constructing path parameters.
- UI state flows live in `App` and are provided via `AppDataContext`. Prefer adding data-loading helpers as context providers when the data is shared between pages.
- Styling uses CSS modules for components under `components/` and `pages/` plus a small global `styles.css` and `theme.ts`. Follow existing modules naming and scoping.

Debugging / developer tips
- If UI shows empty lists, verify backend availability and CORS. Default API is `http://localhost:8081/api` — confirm by visiting `http://localhost:8081/api/health` or calling `api.checkHealth()` from the console (import `src/api`).
- Use browser Network tab to inspect requests; the API helper attaches JSON and returns parsed JSON or text. Errors thrown include URL and server response text for clarity.
- Session loading: `App` reads `localStorage['session']` on startup. To simulate logged-in state, set that key with a minimal `{ "username": "<name>" }` JSON.

Where to look when making common changes
- New API endpoints: `src/api/index.ts` (add function, add to default export).
- Shared UI/data changes: `src/context/AppDataContext.tsx` and `src/App.tsx` (how state is seeded and persisted).
- Routes / pages: `src/App.tsx` (Routes) and `src/pages/*` for page components.
- Layout and small components: `src/components/layout/*`.

Notes and gotchas discovered in the codebase
- Backend expectations: many endpoints expect `username` and sometimes POST bodies containing `username` (not automatic auth headers). Tests or new integrations must include the username in payloads.
- `request()` sometimes posts JSON bodies for lookups (e.g. `resolveUserExpenseCategoryId`) — don't assume all GETs are used for retrieval; read the specific API helper.
- Environment variables are read from `import.meta.env` (Vite). When running outside the dev server, ensure `VITE_API_BASE` is provided at build time.

If you make changes
- Update `src/types/app.ts` when the API shape changes, then update API helpers to match.
- Run `npm run dev` (Vite) and refresh; use the console + network tab to validate requests.

Questions / feedback
- If any part of the app's runtime environment or CI differs from these notes (custom `.env` files, proxies, or Docker setups), tell me and I will incorporate those details.

---
References: `src/api/index.ts`, `src/context/AppDataContext.tsx`, `src/types/app.ts`, `src/App.tsx`, `package.json`, `README.md`
