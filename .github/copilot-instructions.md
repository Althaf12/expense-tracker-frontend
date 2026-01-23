# Copilot / AI Agent Instructions for expense-tracker-frontend

Summary
- Tech: React 18 + TypeScript + Vite. Router: react-router-dom v6.
- Purpose: thin SPA that talks to a backend API (default base from `import.meta.env.VITE_API_BASE` → fallback `http://localhost:8081/api`).

Quick start (PowerShell)
```powershell
npm install
$env:VITE_API_BASE='http://localhost:8081/api'; npm run dev
```

Developer workflows
- Dev server: `npm run dev` (Vite). Build: `npm run build`. Preview production build: `npm run preview`.
- Health check: call `api.checkHealth()` in the console or hit `${API_BASE}/health` to verify backend + CORS.

High-level architecture & patterns
- API layer: `src/api/index.ts` is the single place for API helpers. It wraps `authFetch` (from `src/auth/httpClient.ts`) via `request()` and exports many convenience functions (e.g. `fetchExpenses`, `updateUserPreferences`).
- Auth: `src/auth/httpClient.ts` provides `authFetch` with automatic 401 handling — it will try `refreshAuth()` once, retry the request, or redirect to login. Prefer using `request()` or the exported API helpers to keep refresh & cookie handling consistent.
- Guest mode: `src/utils/guestStore.ts` implements a full in-memory/sessionStorage fallback for unauthenticated users. Key constants: `guestStore.GUEST_USER_ID === 'guest-user'` and `guestStore.GUEST_USERNAME`. Follow the existing pattern where API helpers call `guestStore` when `isGuestUser` is true.
- Types-first: update `src/types/app.ts` before changing API helpers or components that consume those shapes.
- Global state: `src/context/AppDataContext.tsx` exposes the app-level cache and helpers (expense categories, caches, reload helpers). Use `useAppDataContext()` to access.

Conventions & concrete examples
- Add an API endpoint: edit `src/api/index.ts`, implement a function that calls `request('/your/path', { method, body })`, then include it in the file's default export.
- Guest fallback pattern: most API helpers check `guestStore.isGuestUser(userId)` and either operate on `guestStore` or call the backend. Copy this flow when adding user-scoped APIs.
- File downloads: exports use `fetch` + blob handling and `triggerDownload()` in `src/api/index.ts` — keep downloads isolated from React components.
- Caching: `fetchPreviousMonthlyBalance` uses localStorage + in-memory maps (`_prevMonthlyBalanceCache`, `_prevMonthlyBalancePromises`). Reuse these helpers for consistent client-side caching.

Session & testing notes
- Session storage: the app stores session info in `localStorage['session']` as a `SessionData` object (see `src/types/app.ts`). To simulate a logged-in user in the browser console, run:
```js
localStorage.setItem('session', JSON.stringify({ userId: 'your-id', username: 'you' }))
```
- Guest data: `guestStore` writes demo data to `sessionStorage` and uses `GUEST_STORE_VERSION` to reinitialize default/demo data when needed.

Where to look for common changes
- API helpers: [src/api/index.ts](src/api/index.ts)
- Auth: [src/auth/httpClient.ts](src/auth/httpClient.ts) and [src/auth/authService.ts](src/auth/authService.ts)
- Types: [src/types/app.ts](src/types/app.ts)
- Global app data: [src/context/AppDataContext.tsx](src/context/AppDataContext.tsx)
- Guest demo logic: [src/utils/guestStore.ts](src/utils/guestStore.ts)
- Routing and pages: [src/App.tsx](src/App.tsx) and [src/pages/*](src/pages)

Quick gotchas discovered
- Many backend endpoints expect `userId`/`username` in request bodies or path params — tokens/headers are not always used. Prefer API helpers to avoid subtle bugs.
- `authFetch` sets `credentials: 'include'` and manages refresh queues — avoid parallel low-level fetches that bypass `authFetch`.
- Report exports use different endpoints (PDF vs Excel) and rely on `Content-Disposition` parsing in `src/api/index.ts`.

Next actions I can take
- Add example snippets: "add API helper" and "add a route".
- Expand CI / test guidance if you want test tooling added.

Please review and tell me any missing details or examples you want added.
## Copilot / AI Agent Instructions for expense-tracker-frontend

Summary
- Stack: React 18 + TypeScript + Vite; Router: `react-router-dom` v6.
- Purpose: UI is a thin frontend that talks to a backend API (default base `http://localhost:8081/api`). Supports **guest mode** for visitors (no login required).

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
- `src/utils/guestStore.ts`: in-memory store for guest users. Uses `sessionStorage` so data clears when browser closes.
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
