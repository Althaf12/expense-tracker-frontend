## Copilot / AI Agent Instructions for expense-tracker-frontend

Summary
- Stack: React 18 + TypeScript + Vite; Router: `react-router-dom` v6.
- Purpose: UI is a thin frontend that talks to a backend API (default base `http://localhost:8081/api`). Many flows require a running backend.

Quick start (PowerShell)
```powershell
npm install
$env:VITE_API_BASE='http://localhost:8081/api'; npm run dev
```
Or set `VITE_API_BASE` in `.env` or your environment before `npm run dev`.

Key places to look
- `src/api/index.ts`: single `request(path, options)` helper used by all endpoints. It:
  - reads `import.meta.env.VITE_API_BASE` (falls back to `http://localhost:8081/api`),
  - sets `Content-Type: application/json` when `body` exists and serializes non-string bodies,
  - parses JSON (or text) and throws on non-2xx with helpful messages.
  - many helpers validate `username` via `ensureUsername` and expect encoded path params.
- `src/types/app.ts`: central types (`SessionData`, `Expense`, `UserExpenseCategory`, etc.). Update types first when shapes change.
- `src/context/AppDataContext.tsx`: global data provider — session, caches, and helpers like `ensureExpenseCategories` and `reloadExpensesCache`.
- `src/App.tsx` / `src/main.tsx`: routing and app wiring. Pages live under `src/pages/*`; layout under `src/components/layout/*`.

Conventions & project patterns
- API helpers live in `src/api/index.ts` (add new endpoints here using `request()` and export them).
- Naming: camelCase helpers (e.g. `fetchUserExpenses`). Validate inputs (use `ensureUsername` when needed).
- Session: stored in `localStorage['session']` by `App`. Many flows read username from this session — set it explicitly when testing.
- Styling: CSS Modules for components/pages; global styles in `src/styles.css` and tokens in `src/theme.ts`.

Debugging & common troubleshooting
- If lists are empty: confirm backend + CORS. Check `http://localhost:8081/api/health` or call `api.checkHealth()` from the console.
- Use Network tab to inspect payloads — `request()` frequently sends JSON bodies even for lookups.
- To simulate login: set localStorage key `session` to `{"username":"yourname"}` before load.

Where to edit for common tasks
- Add endpoint: `src/api/index.ts` → add helper → export in default export.
- Change shared state/flows: `src/context/AppDataContext.tsx` and `src/App.tsx`.
- Add route/page: create file under `src/pages/*` and register route in `src/App.tsx`.

Project-specific gotchas
- Backend often expects `username` in request bodies or path params (not via auth headers).
- `request()` throws enriched errors including the URL and server response — read thrown errors for debugging.
- Environment vars use Vite `import.meta.env`; ensure `VITE_API_BASE` is available at build/runtime.

If you change API shapes
- Update `src/types/app.ts` first, then `src/api/index.ts` helpers, then components and context that consume them.

Quick references
- API helpers: [src/api/index.ts](src/api/index.ts)
- App context: [src/context/AppDataContext.tsx](src/context/AppDataContext.tsx)
- Types: [src/types/app.ts](src/types/app.ts)
- Routes & wiring: [src/App.tsx](src/App.tsx) and [src/main.tsx](src/main.tsx)

If anything here is unclear or you want the instructions expanded (CI, tests, or environment matrix), tell me and I will iterate.
