import type { Expense, Income, MonthlyBalance, UserExpense, UserExpenseCategory, UserPreferences, FontSize, CurrencyCode, ThemeCode } from '../types/app'

// Read API base from Vite environment variable `VITE_API_BASE`.
// Falls back to the current localhost API for now.
const API_BASE: string = ((import.meta as any)?.env?.VITE_API_BASE as string) || 'http://localhost:8081/api'

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

async function request(path: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const { method, body, headers = {} } = options
  const url = `${API_BASE}${path}`
  try {
    const isBodyPresent = body !== undefined && body !== null
    const requestMethod = method ?? (isBodyPresent ? 'POST' : 'GET')
    // If a body is present we will include a JSON Content-Type header and
    // attach the serialized body to the request. Note: including a body on
    // GET requests is non-standard but some servers accept it; caller asked
    // to support that behavior.
    const fetchOptions: RequestInit = {
      method: requestMethod,
      headers: {
        ...(isBodyPresent ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    }

    if (isBodyPresent) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)

    const text = await response.text().catch(() => '')
    if (!response.ok) {
      // include response body / status for clearer errors
      throw new Error(`Request to ${url} failed: ${response.status} ${text || response.statusText}`)
    }

    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Rethrow with context
    throw new Error(`API request error for ${url}: ${message}`)
  }
}

export async function userDetails(payload: { username?: string; email?: string }): Promise<Record<string, unknown> | null> {
  const result = await request('/user/details', { body: payload })
  return (result && typeof result === 'object') ? (result as Record<string, unknown>) : null
}

export async function registerUser(payload: { username: string; email: string; password: string }): Promise<void> {
  await request('/user', { body: payload })
}

export async function fetchExpenses(username: string): Promise<Expense[]> {
  const user = String(username ?? '').trim()
  if (!user) {
    throw new Error('fetchExpenses: username is required')
  }
  const result = await request('/expense/all', { body: { username: user } })
  if (Array.isArray(result)) {
    return result as Expense[]
  }
  // If server returned something unexpected, surface a clear error so callers can see why
  throw new Error('fetchExpenses: unexpected response format')
}

export async function forgotPassword(payload: { username?: string; email?: string }): Promise<unknown> {
  return await request('/user/forgot-password', { body: payload })
}

export async function resetPassword(payload: Record<string, unknown>): Promise<unknown> {
  return await request('/user/reset-password', { body: payload })
}

export async function updatePassword(payload: { username?: string; email?: string; newPassword: string }): Promise<unknown> {
  return await request('/user/password', { method: 'PUT', body: payload })
}

export async function fetchExpenseCategories(): Promise<UserExpenseCategory[]> {
  const result = await request('/expense-category/all', { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpenseCategory[]) : []
}

const ensureUsername = (username: string): string => {
  const value = String(username ?? '').trim()
  if (!value) {
    throw new Error('Username is required for this request')
  }
  return encodeURIComponent(value)
}

// In-memory caches to avoid duplicate network calls for the same user/month
const _prevMonthlyBalancePromises = new Map<string, Promise<MonthlyBalance | null>>()
const _prevMonthlyBalanceCache = new Map<string, MonthlyBalance | null>()

export async function fetchUserExpenseCategories(username: string): Promise<UserExpenseCategory[]> {
  const safeUser = ensureUsername(username)
  const result = await request(`/user-expense-category/${safeUser}`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpenseCategory[]) : []
}

export async function fetchUserExpenseCategoriesActive(username: string): Promise<UserExpenseCategory[]> {
  const safeUser = ensureUsername(username)
  const result = await request(`/user-expense-category/${safeUser}/active`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpenseCategory[]) : []
}

export async function fetchUserExpenses(username: string): Promise<UserExpense[]> {
  const safeUser = ensureUsername(username)
  const result = await request(`/user-expenses/${safeUser}`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpense[]) : []
}

export async function fetchUserExpensesActive(username: string): Promise<UserExpense[]> {
  const safeUser = ensureUsername(username)
  const result = await request(`/user-expenses/${safeUser}/active`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpense[]) : []
}

export async function createUserExpense(payload: {
  username: string
  userExpenseName: string
  userExpenseCategoryId: string | number
  amount: number
  status?: 'A' | 'I'
  paid?: 'Y' | 'N'
}): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const body = {
    userExpenseName: payload.userExpenseName,
    userExpenseCategoryId: payload.userExpenseCategoryId,
    amount: payload.amount,
    status: payload.status ?? 'A',
    paid: payload.paid ?? 'N',
  }
  await request(`/user-expenses/${safeUser}`, { method: 'POST', body })
}

export async function updateUserExpense(payload: {
  username: string
  id: string | number
  userExpenseName?: string
  userExpenseCategoryId?: string | number
  amount?: number
  status?: 'A' | 'I'
  paid?: 'Y' | 'N'
}): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const safeId = encodeURIComponent(String(payload.id))
  const body: Record<string, unknown> = {}
  if (payload.userExpenseName !== undefined) body.userExpenseName = payload.userExpenseName
  if (payload.userExpenseCategoryId !== undefined) body.userExpenseCategoryId = payload.userExpenseCategoryId
  if (payload.amount !== undefined) body.amount = payload.amount
  if (payload.status !== undefined) body.status = payload.status
  if (payload.paid !== undefined) body.paid = payload.paid
  await request(`/user-expenses/${safeUser}/${safeId}`, { method: 'PUT', body })
}

export async function deleteUserExpense(payload: { username: string; id: string | number }): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const safeId = encodeURIComponent(String(payload.id))
  await request(`/user-expenses/${safeUser}/${safeId}`, { method: 'DELETE' })
}

export async function copyUserExpensesFromMaster(username: string): Promise<void> {
  const safeUser = ensureUsername(username)
  // Use the exact endpoint provided by the caller (case-sensitive path)
  await request(`/planned-expenses/${safeUser}/copyMaster`, { method: 'POST' })
}

export async function createUserExpenseCategory(payload: {
  username: string
  userExpenseCategoryName: string
  status?: 'A' | 'I'
}): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const body = {
    userExpenseCategoryName: payload.userExpenseCategoryName,
    status: payload.status ?? 'A',
  }
  await request(`/user-expense-category/${safeUser}`, { method: 'POST', body })
}

export async function updateUserExpenseCategory(payload: {
  username: string
  id: string | number
  userExpenseCategoryName: string
  status: 'A' | 'I'
}): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const safeId = encodeURIComponent(String(payload.id))
  const body = {
    userExpenseCategoryName: payload.userExpenseCategoryName,
    status: payload.status,
  }
  await request(`/user-expense-category/${safeUser}/${safeId}`, { method: 'PUT', body })
}

export async function deleteUserExpenseCategory(payload: { username: string; id: string | number }): Promise<void> {
  const safeUser = ensureUsername(payload.username)
  const safeId = encodeURIComponent(String(payload.id))
  await request(`/user-expense-category/${safeUser}/${safeId}`, { method: 'DELETE' })
}

export async function deleteAllUserExpenseCategories(username: string): Promise<void> {
  const safeUser = ensureUsername(username)
  await request(`/user-expense-category/${safeUser}`, { method: 'DELETE' })
}

export async function copyUserExpenseCategoriesFromMaster(username: string): Promise<void> {
  const safeUser = ensureUsername(username)
  await request(`/user-expense-category/${safeUser}/copy-master`, { method: 'POST' })
}

export async function resolveUserExpenseCategoryId(payload: {
  username: string
  userExpenseCategoryName: string
}): Promise<string | number | null> {
  const safeUser = ensureUsername(payload.username)
  const name = String(payload.userExpenseCategoryName ?? '').trim()
  if (!name) {
    throw new Error('userExpenseCategoryName is required')
  }
  // Use POST body for lookup (server expects JSON body)
  const result = await request(`/user-expense-category/${safeUser}/id`, {
    method: 'POST',
    body: { userExpenseCategoryName: name },
  })

  if (result === null || result === undefined) {
    return null
  }

  if (typeof result === 'string' || typeof result === 'number') {
    return result
  }

  if (typeof result === 'object') {
    const candidate = result as { userExpenseCategoryId?: string | number; id?: string | number }
    if (candidate.userExpenseCategoryId !== undefined && candidate.userExpenseCategoryId !== null) {
      return candidate.userExpenseCategoryId
    }
    if (candidate.id !== undefined && candidate.id !== null) {
      return candidate.id
    }
  }

  return null
}

export async function fetchExpensesByRange(payload: { username: string; start: string; end: string }): Promise<Expense[]> {
  const result = await request('/expense/range', { body: payload })
  return Array.isArray(result) ? (result as Expense[]) : []
}

export async function fetchExpensesByMonth(payload: { username: string; month: number; year: number }): Promise<Expense[]> {
  const result = await request('/expense/month', { body: payload })
  return Array.isArray(result) ? (result as Expense[]) : []
}

export async function fetchExpensesByYear(payload: { username: string; year: number }): Promise<Expense[]> {
  const result = await request('/expense/year', { body: payload })
  return Array.isArray(result) ? (result as Expense[]) : []
}

export async function addExpense(payload: {
  username: string
  userExpenseCategoryId: number | string
  expenseAmount: number
  expenseDate: string
  expenseName?: string
}): Promise<unknown> {
  return await request('/expense/add', { body: payload })
}

export async function deleteExpense(payload: { username: string; expensesId: string | number }): Promise<unknown> {
  return await request('/expense/delete', { body: payload })
}

export async function updateExpense(payload: {
  expensesId: string | number
  username: string
  expenseAmount?: number
  expenseName?: string
  expenseDate?: string
  userExpenseCategoryId?: string | number
}): Promise<unknown> {
  return await request('/expense/update', { method: 'PUT', body: payload })
}

export async function addIncome(payload: {
  username: string
  source: string
  amount: number
  receivedDate: string
  month?: string | number
  year?: number
}): Promise<unknown> {
  return await request('/income/add', { body: payload })
}

export async function deleteIncome(payload: { username: string; incomeId: string | number }): Promise<unknown> {
  return await request('/income/delete', { body: payload })
}

export async function updateIncome(payload: {
  incomeId: string | number
  username: string
  source?: string
  amount?: number
  receivedDate?: string
  month?: string | number
  year?: number
}): Promise<unknown> {
  return await request('/income/update', { method: 'PUT', body: payload })
}

export async function fetchIncomeByRange(payload: {
  username: string
  fromMonth: string | number
  fromYear: string | number
  toMonth: string | number
  toYear: string | number
}): Promise<Income[]> {
  const result = await request('/income/range', { body: payload })
  return Array.isArray(result) ? (result as Income[]) : []
}

export async function fetchIncomeByMonth(payload: { username: string; month: number; year: number }): Promise<Income[]> {
  const result = await request('/income/month', { body: payload })
  return Array.isArray(result) ? (result as Income[]) : []
}

export async function fetchIncomeLastYear(username: string, currentYear: number): Promise<Income[]> {
  const fromYear = currentYear - 1
  const result = await request('/income/range', {
    body: {
      username,
      fromMonth: '01',
      fromYear: String(fromYear),
      toMonth: '12',
      toYear: String(fromYear),
    },
  })
  return Array.isArray(result) ? (result as Income[]) : []
}

export async function fetchPreviousMonthlyBalance(username: string): Promise<MonthlyBalance | null> {
  const safeUser = ensureUsername(username)

  // determine the previous month/year key (API returns previous month info)
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthKey = String(prev.getMonth() + 1).padStart(2, '0')
  const yearKey = prev.getFullYear()
  const storageKey = `dashboard:monthly-balance:${safeUser}:${yearKey}-${monthKey}`

  // return in-memory cached value if present
  if (_prevMonthlyBalanceCache.has(storageKey)) {
    return _prevMonthlyBalanceCache.get(storageKey) ?? null
  }

  // check localStorage cache
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.balance === 'number') {
          const mb: MonthlyBalance = { closingBalance: parsed.balance, month: yearKey ? Number(monthKey) : undefined, year: yearKey }
          _prevMonthlyBalanceCache.set(storageKey, mb)
          return mb
        }
        if (parsed && typeof parsed.closingBalance === 'number') {
          const mb: MonthlyBalance = { closingBalance: parsed.closingBalance, month: yearKey ? Number(monthKey) : undefined, year: yearKey }
          _prevMonthlyBalanceCache.set(storageKey, mb)
          return mb
        }
      }
    } catch {
      /* ignore parse/storage errors */
    }
  }

  // dedupe inflight requests
  if (_prevMonthlyBalancePromises.has(storageKey)) {
    return _prevMonthlyBalancePromises.get(storageKey)!
  }

  const inflight = (async (): Promise<MonthlyBalance | null> => {
    try {
      const result = await request(`/monthly-balance/previous?username=${safeUser}`, { method: 'GET' })
      if (result && typeof result === 'object') {
        const payload = result as { openingBalance?: unknown; closingBalance?: unknown; month?: unknown; year?: unknown }
        const openingBalance = typeof payload.openingBalance === 'number' ? payload.openingBalance : undefined
        const closingBalance = typeof payload.closingBalance === 'number' ? payload.closingBalance : undefined
        const month = typeof payload.month === 'number' ? payload.month : yearKey
        const year = typeof payload.year === 'number' ? payload.year : yearKey
        const mb: MonthlyBalance = { openingBalance, closingBalance, month, year }

        // persist a simple numeric balance to localStorage for quick reuse
        const storeValue = closingBalance ?? openingBalance ?? null
        if (storeValue !== null && typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(storageKey, JSON.stringify({ balance: storeValue, month, year, storedAt: new Date().toISOString() }))
          } catch {
            /* ignore storage errors */
          }
        }

        _prevMonthlyBalanceCache.set(storageKey, mb)
        return mb
      }
      _prevMonthlyBalanceCache.set(storageKey, null)
      return null
    } finally {
      _prevMonthlyBalancePromises.delete(storageKey)
    }
  })()

  _prevMonthlyBalancePromises.set(storageKey, inflight)
  return inflight
}

export async function checkHealth(): Promise<string> {
  const result = await request('/health', { method: 'GET' })
  return typeof result === 'string' ? result : 'OK'
}

export function getApiBase(): string {
  return API_BASE
}

export async function fetchUserPreferences(username: string): Promise<UserPreferences | null> {
  const safeUser = ensureUsername(username)
  try {
    const result = await request(`/user/preferences/${safeUser}`, { method: 'GET' })
    if (result && typeof result === 'object') {
      return result as UserPreferences
    }
    return null
  } catch {
    return null
  }
}

export async function updateUserPreferences(payload: {
  username: string
  fontSize?: FontSize
  currencyCode?: CurrencyCode
  theme?: ThemeCode
}): Promise<void> {
  const body: Record<string, unknown> = { username: payload.username }
  if (payload.fontSize !== undefined) body.fontSize = payload.fontSize
  if (payload.currencyCode !== undefined) body.currencyCode = payload.currencyCode
  if (payload.theme !== undefined) body.theme = payload.theme
  await request('/user/preferences', { method: 'POST', body })
}

export default {
  userDetails,
  registerUser,
  fetchExpenses,
  forgotPassword,
  resetPassword,
  updatePassword,
  fetchExpenseCategories,
  fetchUserExpenseCategories,
  fetchUserExpenseCategoriesActive,
  createUserExpenseCategory,
  updateUserExpenseCategory,
  deleteUserExpenseCategory,
  deleteAllUserExpenseCategories,
  copyUserExpenseCategoriesFromMaster,
  copyUserExpensesFromMaster,
  fetchExpensesByRange,
  fetchExpensesByMonth,
  fetchExpensesByYear,
  addExpense,
  deleteExpense,
  updateExpense,
  addIncome,
  deleteIncome,
  updateIncome,
  fetchIncomeByRange,
  fetchIncomeByMonth,
  fetchIncomeLastYear,
  fetchPreviousMonthlyBalance,
  checkHealth,
  getApiBase,
  fetchUserPreferences,
  updateUserPreferences,
}
