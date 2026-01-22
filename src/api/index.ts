import type { Expense, Income, MonthlyBalance, MonthlyBalanceUpdateRequest, MonthlyBalanceUpdateResponse, UserExpense, UserExpenseCategory, UserPreferences, FontSize, CurrencyCode, ThemeCode, IncomeMonth, PagedResponse, ExportType, ExportFormat, EmailExportResponse, AnalyticsDataResponse, AnalyticsExpenseRecord, AnalyticsIncomeRecord, AnalyticsSummary } from '../types/app'
import { guestStore } from '../utils/guestStore'
import { authFetch } from '../auth'

// Read API base from Vite environment variable `VITE_API_BASE`.
// Falls back to the current localhost API for now.
const API_BASE: string = ((import.meta as any)?.env?.VITE_API_BASE as string) || 'http://localhost:8081/api'

// Helper to check if a userId belongs to guest
const isGuestUserId = (userId: string | undefined | null): boolean => guestStore.isGuestUser(userId)

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Make API requests with automatic 401 handling (token refresh + retry)
 * Uses authFetch which includes SSO interceptor
 */
async function request(path: string, options: ApiRequestOptions = {}): Promise<unknown> {
  return authFetch(path, options)
}

const ensureUserId = (userId: string): string => {
  const value = String(userId ?? '').trim()
  if (!value) {
    throw new Error('UserId is required for this request')
  }
  return encodeURIComponent(value)
}

// In-memory caches to avoid duplicate network calls for the same user/month
const _prevMonthlyBalancePromises = new Map<string, Promise<MonthlyBalance | null>>()
const _prevMonthlyBalanceCache = new Map<string, MonthlyBalance | null>()

// ============================================================================
// User Management APIs
// ============================================================================

/**
 * Sync user with backend - creates user if new, updates last seen if existing.
 * Should be called on every authenticated session start (login, page load, return visit).
 */
export async function syncUser(userId: string): Promise<void> {
  if (isGuestUserId(userId)) return // Guest user doesn't need backend sync
  
  // Always call POST /api/user - backend handles create or update
  await request('/user', { 
    method: 'POST',
    body: { userId } 
  })
}

/**
 * @deprecated Use syncUser instead
 */
export async function ensureUserExists(userId: string): Promise<void> {
  return syncUser(userId)
}

/**
 * User logout - calls backend logout API
 */
export async function logoutUser(userId: string): Promise<void> {
  if (isGuestUserId(userId)) {
    guestStore.clearAll()
    return
  }
  await request('/user/logout', { 
    method: 'POST',
    body: { userId } 
  })
}

/**
 * Get user details by userId
 */
export async function getUserDetails(userId: string): Promise<Record<string, unknown> | null> {
  if (isGuestUserId(userId)) {
    return { userId: guestStore.GUEST_USER_ID, username: guestStore.GUEST_USERNAME }
  }
  const safeUserId = ensureUserId(userId)
  try {
    const result = await request(`/user/${safeUserId}`, { method: 'GET' })
    return (result && typeof result === 'object') ? (result as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// ============================================================================
// Expense Category APIs
// ============================================================================

export async function fetchUserExpenseCategories(userId: string): Promise<UserExpenseCategory[]> {
  if (isGuestUserId(userId)) {
    return guestStore.getCategories()
  }
  const safeUserId = ensureUserId(userId)
  const result = await request(`/user-expense-category/${safeUserId}`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpenseCategory[]) : []
}

export async function fetchUserExpenseCategoriesActive(userId: string): Promise<UserExpenseCategory[]> {
  if (isGuestUserId(userId)) {
    return guestStore.getActiveCategories()
  }
  const safeUserId = ensureUserId(userId)
  const result = await request(`/user-expense-category/${safeUserId}/active`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpenseCategory[]) : []
}

export async function createUserExpenseCategory(payload: {
  userId: string
  userExpenseCategoryName: string
  status?: 'A' | 'I'
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.createCategory(payload.userExpenseCategoryName, payload.status ?? 'A')
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const body = {
    userExpenseCategoryName: payload.userExpenseCategoryName,
    status: payload.status ?? 'A',
  }
  await request(`/user-expense-category/${safeUserId}`, { method: 'POST', body })
}

export async function updateUserExpenseCategory(payload: {
  userId: string
  id: string | number
  userExpenseCategoryName: string
  status: 'A' | 'I'
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.updateCategory(payload.id, payload.userExpenseCategoryName, payload.status)
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const safeId = encodeURIComponent(String(payload.id))
  const body = {
    userExpenseCategoryName: payload.userExpenseCategoryName,
    status: payload.status,
  }
  await request(`/user-expense-category/${safeUserId}/${safeId}`, { method: 'PUT', body })
}

export async function deleteUserExpenseCategory(payload: { userId: string; id: string | number }): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    const result = guestStore.deleteCategory(payload.id)
    if (!result.success) {
      throw new Error(result.error ?? 'Cannot delete category')
    }
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const safeId = encodeURIComponent(String(payload.id))
  await request(`/user-expense-category/${safeUserId}/${safeId}`, { method: 'DELETE' })
}

export async function deleteAllUserExpenseCategories(userId: string): Promise<void> {
  if (isGuestUserId(userId)) {
    guestStore.resetCategoriesToDefault()
    return
  }
  const safeUserId = ensureUserId(userId)
  await request(`/user-expense-category/${safeUserId}`, { method: 'DELETE' })
}

export async function copyUserExpenseCategoriesFromMaster(userId: string): Promise<void> {
  if (isGuestUserId(userId)) {
    guestStore.resetCategoriesToDefault()
    return
  }
  const safeUserId = ensureUserId(userId)
  await request(`/user-expense-category/${safeUserId}/copy-master`, { method: 'POST' })
}

export async function resolveUserExpenseCategoryId(payload: {
  userId: string
  userExpenseCategoryName: string
}): Promise<string | number | null> {
  if (isGuestUserId(payload.userId)) {
    const categories = guestStore.getCategories()
    const searchName = payload.userExpenseCategoryName.toLowerCase().trim()
    const cat = categories.find((c) => c.userExpenseCategoryName.toLowerCase().trim() === searchName)
    return cat?.userExpenseCategoryId ?? null
  }
  const safeUserId = ensureUserId(payload.userId)
  const name = String(payload.userExpenseCategoryName ?? '').trim()
  if (!name) {
    throw new Error('userExpenseCategoryName is required')
  }
  const result = await request(`/user-expense-category/${safeUserId}/id`, {
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

// ============================================================================
// User Expenses (Planned Expenses) APIs
// ============================================================================

export async function fetchUserExpenses(userId: string): Promise<UserExpense[]> {
  if (isGuestUserId(userId)) {
    return guestStore.getUserExpenses()
  }
  const safeUserId = ensureUserId(userId)
  const result = await request(`/user-expenses/${safeUserId}`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpense[]) : []
}

export async function fetchUserExpensesActive(userId: string): Promise<UserExpense[]> {
  if (isGuestUserId(userId)) {
    return guestStore.getActiveUserExpenses()
  }
  const safeUserId = ensureUserId(userId)
  const result = await request(`/user-expenses/${safeUserId}/active`, { method: 'GET' })
  return Array.isArray(result) ? (result as UserExpense[]) : []
}

export async function createUserExpense(payload: {
  userId: string
  userExpenseName: string
  userExpenseCategoryId: string | number
  amount: number
  status?: 'A' | 'I'
  paid?: 'Y' | 'N'
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.createUserExpense({
      userExpenseName: payload.userExpenseName,
      userExpenseCategoryId: payload.userExpenseCategoryId,
      amount: payload.amount,
      status: payload.status,
      paid: payload.paid,
    })
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const body = {
    userExpenseName: payload.userExpenseName,
    userExpenseCategoryId: payload.userExpenseCategoryId,
    amount: payload.amount,
    status: payload.status ?? 'A',
    paid: payload.paid ?? 'N',
  }
  await request(`/user-expenses/${safeUserId}`, { method: 'POST', body })
}

export async function updateUserExpense(payload: {
  userId: string
  id: string | number
  userExpenseName?: string
  userExpenseCategoryId?: string | number
  amount?: number
  status?: 'A' | 'I'
  paid?: 'Y' | 'N'
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.updateUserExpense(payload.id, {
      userExpenseName: payload.userExpenseName,
      userExpenseCategoryId: payload.userExpenseCategoryId,
      amount: payload.amount,
      status: payload.status,
      paid: payload.paid,
    })
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const safeId = encodeURIComponent(String(payload.id))
  const body: Record<string, unknown> = {}
  if (payload.userExpenseName !== undefined) body.userExpenseName = payload.userExpenseName
  if (payload.userExpenseCategoryId !== undefined) body.userExpenseCategoryId = payload.userExpenseCategoryId
  if (payload.amount !== undefined) body.amount = payload.amount
  if (payload.status !== undefined) body.status = payload.status
  if (payload.paid !== undefined) body.paid = payload.paid
  await request(`/user-expenses/${safeUserId}/${safeId}`, { method: 'PUT', body })
}

export async function deleteUserExpense(payload: { userId: string; id: string | number }): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.deleteUserExpense(payload.id)
    return
  }
  const safeUserId = ensureUserId(payload.userId)
  const safeId = encodeURIComponent(String(payload.id))
  await request(`/user-expenses/${safeUserId}/${safeId}`, { method: 'DELETE' })
}

export async function copyUserExpensesFromMaster(userId: string): Promise<void> {
  if (isGuestUserId(userId)) {
    guestStore.resetUserExpensesToDefault()
    return
  }
  const safeUserId = ensureUserId(userId)
  await request(`/planned-expenses/${safeUserId}/copyMaster`, { method: 'POST' })
}

// ============================================================================
// Expenses APIs
// ============================================================================

export async function fetchExpenses(userId: string): Promise<Expense[]> {
  if (isGuestUserId(userId)) {
    return guestStore.getExpenses()
  }
  const safeUserId = ensureUserId(userId)
  const result = await request('/expense/all', { body: { userId: safeUserId } })
  if (Array.isArray(result)) {
    return result as Expense[]
  }
  throw new Error('fetchExpenses: unexpected response format')
}

export async function fetchExpensesByRange(payload: { userId: string; start: string; end: string; page?: number; size?: number }): Promise<PagedResponse<Expense>> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.getExpensesByRange(payload.start, payload.end)
  }
  const body: Record<string, unknown> = { userId: payload.userId, start: payload.start, end: payload.end }
  if (typeof payload.page === 'number') body.page = payload.page
  if (typeof payload.size === 'number') body.size = payload.size
  const result = await request('/expense/range', { body })
  if (result && typeof result === 'object' && 'content' in result && Array.isArray((result as any).content)) {
    return result as PagedResponse<Expense>
  }
  const arr = Array.isArray(result) ? (result as Expense[]) : []
  return { content: arr, totalElements: arr.length, totalPages: 1, page: 0, size: arr.length }
}

export async function fetchExpensesByMonth(payload: { userId: string; month: number; year: number; page?: number; size?: number }): Promise<PagedResponse<Expense>> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.getExpensesByMonth(payload.month, payload.year)
  }
  const body: Record<string, unknown> = { userId: payload.userId, month: payload.month, year: payload.year }
  if (typeof payload.page === 'number') body.page = payload.page
  if (typeof payload.size === 'number') body.size = payload.size
  const result = await request('/expense/month', { body })
  if (result && typeof result === 'object' && 'content' in result && Array.isArray((result as any).content)) {
    return result as PagedResponse<Expense>
  }
  const arr = Array.isArray(result) ? (result as Expense[]) : []
  return { content: arr, totalElements: arr.length, totalPages: 1, page: 0, size: arr.length }
}

export async function fetchExpensesByYear(payload: { userId: string; year: number }): Promise<Expense[]> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.getExpenses().filter((e) => {
      if (!e.expenseDate) return false
      return new Date(e.expenseDate).getFullYear() === payload.year
    })
  }
  const result = await request('/expense/year', { body: payload })
  return Array.isArray(result) ? (result as Expense[]) : []
}

export async function addExpense(payload: {
  userId: string
  userExpenseCategoryId: number | string
  expenseAmount: number
  expenseDate: string
  expenseName?: string
}): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.addExpense({
      userExpenseCategoryId: payload.userExpenseCategoryId,
      expenseAmount: payload.expenseAmount,
      expenseDate: payload.expenseDate,
      expenseName: payload.expenseName,
    })
  }
  return await request('/expense/add', { body: payload })
}

export async function deleteExpense(payload: { userId: string; expensesId: string | number }): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    guestStore.deleteExpense(payload.expensesId)
    return null
  }
  return await request('/expense/delete', { body: payload })
}

export async function updateExpense(payload: {
  expensesId: string | number
  userId: string
  expenseAmount?: number
  expenseName?: string
  expenseDate?: string
  userExpenseCategoryId?: string | number
}): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    guestStore.updateExpense(payload.expensesId, {
      amount: payload.expenseAmount,
      expenseAmount: payload.expenseAmount,
      expenseName: payload.expenseName,
      expenseDate: payload.expenseDate,
      userExpenseCategoryId: payload.userExpenseCategoryId,
    })
    return null
  }
  return await request('/expense/update', { method: 'PUT', body: payload })
}

// ============================================================================
// Income APIs
// ============================================================================

export async function addIncome(payload: {
  userId: string
  source: string
  amount: number
  receivedDate: string
  month?: string | number
  year?: number
}): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.addIncome({
      source: payload.source,
      amount: payload.amount,
      receivedDate: payload.receivedDate,
      month: payload.month,
      year: payload.year,
    })
  }
  return await request('/income/add', { body: payload })
}

export async function deleteIncome(payload: { userId: string; incomeId: string | number }): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    guestStore.deleteIncome(payload.incomeId)
    return null
  }
  return await request('/income/delete', { body: payload })
}

export async function updateIncome(payload: {
  incomeId: string | number
  userId: string
  source?: string
  amount?: number
  receivedDate?: string
  month?: string | number
  year?: number
}): Promise<unknown> {
  if (isGuestUserId(payload.userId)) {
    guestStore.updateIncome(payload.incomeId, {
      source: payload.source,
      amount: payload.amount,
      receivedDate: payload.receivedDate,
      month: payload.month,
      year: payload.year,
    })
    return null
  }
  return await request('/income/update', { method: 'PUT', body: payload })
}

export async function fetchIncomeByRange(payload: {
  userId: string
  fromMonth: string | number
  fromYear: string | number
  toMonth: string | number
  toYear: string | number
  page?: number
  size?: number
}): Promise<PagedResponse<Income>> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.getIncomesByRange(
      Number(payload.fromMonth),
      Number(payload.fromYear),
      Number(payload.toMonth),
      Number(payload.toYear)
    )
  }
  const body: Record<string, unknown> = {
    userId: payload.userId,
    fromMonth: payload.fromMonth,
    fromYear: payload.fromYear,
    toMonth: payload.toMonth,
    toYear: payload.toYear,
  }
  if (typeof payload.page === 'number') body.page = payload.page
  if (typeof payload.size === 'number') body.size = payload.size
  const result = await request('/income/range', { body })
  if (result && typeof result === 'object' && 'content' in result && Array.isArray((result as any).content)) {
    return result as PagedResponse<Income>
  }
  const arr = Array.isArray(result) ? (result as Income[]) : []
  return { content: arr, totalElements: arr.length, totalPages: 1, page: 0, size: arr.length }
}

export async function fetchIncomeByMonth(payload: { userId: string; month: number; year: number; page?: number; size?: number }): Promise<PagedResponse<Income>> {
  if (isGuestUserId(payload.userId)) {
    return guestStore.getIncomesByMonth(payload.month, payload.year)
  }
  const body: Record<string, unknown> = { userId: payload.userId, month: payload.month, year: payload.year }
  if (typeof payload.page === 'number') body.page = payload.page
  if (typeof payload.size === 'number') body.size = payload.size
  const result = await request('/income/month', { body })
  if (result && typeof result === 'object' && 'content' in result && Array.isArray((result as any).content)) {
    return result as PagedResponse<Income>
  }
  const arr = Array.isArray(result) ? (result as Income[]) : []
  return { content: arr, totalElements: arr.length, totalPages: 1, page: 0, size: arr.length }
}

export async function fetchIncomeLastYear(userId: string, currentYear: number): Promise<Income[]> {
  if (isGuestUserId(userId)) {
    const fromYear = currentYear - 1
    return guestStore.getIncomesByRange(1, fromYear, 12, fromYear).content
  }
  const fromYear = currentYear - 1
  const result = await request('/income/range', {
    body: {
      userId,
      fromMonth: '01',
      fromYear: String(fromYear),
      toMonth: '12',
      toYear: String(fromYear),
    },
  })
  return Array.isArray(result) ? (result as Income[]) : []
}

// ============================================================================
// Monthly Balance APIs
// ============================================================================

export async function fetchPreviousMonthlyBalance(userId: string): Promise<MonthlyBalance | null> {
  if (isGuestUserId(userId)) {
    const now = new Date()
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return guestStore.getMonthlyBalance(prev.getMonth() + 1, prev.getFullYear())
  }
  const safeUserId = ensureUserId(userId)

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthKey = String(prev.getMonth() + 1).padStart(2, '0')
  const yearKey = prev.getFullYear()
  const storageKey = `dashboard:monthly-balance:${safeUserId}:${yearKey}-${monthKey}`

  if (_prevMonthlyBalanceCache.has(storageKey)) {
    return _prevMonthlyBalanceCache.get(storageKey) ?? null
  }

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

  if (_prevMonthlyBalancePromises.has(storageKey)) {
    return _prevMonthlyBalancePromises.get(storageKey)!
  }

  const inflight = (async (): Promise<MonthlyBalance | null> => {
    try {
      const result = await request(`/monthly-balance/previous?userId=${safeUserId}`, { method: 'GET' })
      if (result && typeof result === 'object') {
        const payload = result as { openingBalance?: unknown; closingBalance?: unknown; month?: unknown; year?: unknown }
        const openingBalance = typeof payload.openingBalance === 'number' ? payload.openingBalance : undefined
        const closingBalance = typeof payload.closingBalance === 'number' ? payload.closingBalance : undefined
        const month = typeof payload.month === 'number' ? payload.month : yearKey
        const year = typeof payload.year === 'number' ? payload.year : yearKey
        const mb: MonthlyBalance = { openingBalance, closingBalance, month, year }

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

// ============================================================================
// User Preferences APIs
// ============================================================================

export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (isGuestUserId(userId)) {
    return guestStore.getPreferences()
  }
  const safeUserId = ensureUserId(userId)
  try {
    const result = await request(`/user/preferences/${safeUserId}`, { method: 'GET' })
    if (result && typeof result === 'object') {
      return result as UserPreferences
    }
    return null
  } catch {
    return null
  }
}

export async function updateUserPreferences(payload: {
  userId: string
  fontSize?: FontSize
  currencyCode?: CurrencyCode
  theme?: ThemeCode
  incomeMonth?: IncomeMonth
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    guestStore.updatePreferences({
      fontSize: payload.fontSize,
      currencyCode: payload.currencyCode,
      theme: payload.theme,
      incomeMonth: payload.incomeMonth,
    })
    return
  }
  const body: Record<string, unknown> = { userId: payload.userId }
  if (payload.fontSize !== undefined) body.fontSize = payload.fontSize
  if (payload.currencyCode !== undefined) body.currencyCode = payload.currencyCode
  if (payload.theme !== undefined) body.theme = payload.theme
  if (payload.incomeMonth !== undefined) body.incomeMonth = payload.incomeMonth
  await request('/user/preferences', { method: 'POST', body })
}

// ============================================================================
// Monthly Balance APIs
// ============================================================================

/**
 * Get all monthly balances for a user (paginated)
 */
export async function fetchAllMonthlyBalances(payload: {
  userId: string
  page?: number
  size?: number
}): Promise<PagedResponse<MonthlyBalance>> {
  if (isGuestUserId(payload.userId)) {
    // Return empty for guest users
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      page: 0,
      size: payload.size ?? 10,
    }
  }
  const safeUserId = ensureUserId(payload.userId)
  const page = payload.page ?? 0
  const size = payload.size ?? 10
  const result = await request(`/monthly-balance/all?userId=${safeUserId}&page=${page}&size=${size}`, { method: 'GET' })
  return result as PagedResponse<MonthlyBalance>
}

/**
 * Update monthly balance (opening or closing balance)
 */
export async function updateMonthlyBalance(payload: MonthlyBalanceUpdateRequest): Promise<MonthlyBalanceUpdateResponse> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Monthly balance update is not available for guest users.')
  }
  const body: Record<string, unknown> = {
    userId: payload.userId,
    year: payload.year,
    month: payload.month,
  }
  if (payload.openingBalance !== undefined) body.openingBalance = payload.openingBalance
  if (payload.closingBalance !== undefined) body.closingBalance = payload.closingBalance
  
  const result = await request('/monthly-balance/update', { method: 'PUT', body })
  return result as MonthlyBalanceUpdateResponse
}

// ============================================================================
// Export / Report APIs
// ============================================================================

/**
 * Helper to trigger a file download from a blob response
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Extract filename from Content-Disposition header or generate a default
 */
function extractFilename(response: Response, defaultName: string): string {
  const disposition = response.headers.get('Content-Disposition')
  if (disposition) {
    const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      return match[1].replace(/['"]/g, '')
    }
  }
  return defaultName
}

/**
 * Download expenses report as Excel or PDF
 */
export async function downloadExpensesReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Export is not available for guest users. Please sign in to export data.')
  }
  const { userId, startDate, endDate, format } = payload
  const endpoint = format === 'PDF' ? '/reports/expenses/pdf' : '/reports/expenses/excel'
  const url = `${API_BASE}${endpoint}?userId=${encodeURIComponent(userId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Failed to download expenses report: ${response.status}`)
  }
  
  const blob = await response.blob()
  const ext = format === 'PDF' ? 'pdf' : 'xlsx'
  const defaultFilename = `expenses_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.${ext}`
  const filename = extractFilename(response, defaultFilename)
  triggerDownload(blob, filename)
}

/**
 * Download income report as Excel or PDF
 */
export async function downloadIncomeReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Export is not available for guest users. Please sign in to export data.')
  }
  const { userId, startDate, endDate, format } = payload
  const endpoint = format === 'PDF' ? '/reports/income/pdf' : '/reports/income/excel'
  const url = `${API_BASE}${endpoint}?userId=${encodeURIComponent(userId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Failed to download income report: ${response.status}`)
  }
  
  const blob = await response.blob()
  const ext = format === 'PDF' ? 'pdf' : 'xlsx'
  const defaultFilename = `income_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.${ext}`
  const filename = extractFilename(response, defaultFilename)
  triggerDownload(blob, filename)
}

/**
 * Download combined report (expenses + income) as Excel or PDF
 */
export async function downloadAllReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Export is not available for guest users. Please sign in to export data.')
  }
  const { userId, startDate, endDate, format } = payload
  const endpoint = format === 'PDF' ? '/reports/all/pdf' : '/reports/all/excel'
  const url = `${API_BASE}${endpoint}?userId=${encodeURIComponent(userId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  
  const response = await fetch(url, { method: 'GET', credentials: 'include' })
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Failed to download report: ${response.status}`)
  }
  
  const blob = await response.blob()
  const ext = format === 'PDF' ? 'pdf' : 'xlsx'
  const defaultFilename = `financial_report_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.${ext}`
  const filename = extractFilename(response, defaultFilename)
  triggerDownload(blob, filename)
}

/**
 * Generic export with custom options (POST endpoint)
 */
export async function downloadCustomReport(payload: {
  userId: string
  startDate: string
  endDate: string
  exportType?: ExportType
  format?: ExportFormat
}): Promise<void> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Export is not available for guest users. Please sign in to export data.')
  }
  const { userId, startDate, endDate, exportType = 'BOTH', format = 'EXCEL' } = payload
  const url = `${API_BASE}/reports/export`
  
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, startDate, endDate, exportType, format }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Failed to download report: ${response.status}`)
  }
  
  const blob = await response.blob()
  const ext = format === 'PDF' ? 'pdf' : 'xlsx'
  const typePrefix = exportType === 'EXPENSES' ? 'expenses' : exportType === 'INCOME' ? 'income' : 'financial_report'
  const defaultFilename = `${typePrefix}_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.${ext}`
  const filename = extractFilename(response, defaultFilename)
  triggerDownload(blob, filename)
}

/**
 * Email expenses report
 */
export async function emailExpensesReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
  email: string
}): Promise<EmailExportResponse> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Email export is not available for guest users. Please sign in to use this feature.')
  }
  const result = await request('/reports/expenses/email', {
    method: 'POST',
    body: payload,
  })
  return result as EmailExportResponse
}

/**
 * Email income report
 */
export async function emailIncomeReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
  email: string
}): Promise<EmailExportResponse> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Email export is not available for guest users. Please sign in to use this feature.')
  }
  const result = await request('/reports/income/email', {
    method: 'POST',
    body: payload,
  })
  return result as EmailExportResponse
}

/**
 * Email combined report (expenses + income)
 */
export async function emailAllReport(payload: {
  userId: string
  startDate: string
  endDate: string
  format: ExportFormat
  email: string
}): Promise<EmailExportResponse> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Email export is not available for guest users. Please sign in to use this feature.')
  }
  const result = await request('/reports/all/email', {
    method: 'POST',
    body: payload,
  })
  return result as EmailExportResponse
}

/**
 * Generic email export with custom options
 */
export async function emailCustomReport(payload: {
  userId: string
  startDate: string
  endDate: string
  exportType?: ExportType
  format?: ExportFormat
  email: string
}): Promise<EmailExportResponse> {
  if (isGuestUserId(payload.userId)) {
    throw new Error('Email export is not available for guest users. Please sign in to use this feature.')
  }
  const { exportType = 'BOTH', format = 'EXCEL', ...rest } = payload
  const result = await request('/reports/email', {
    method: 'POST',
    body: { ...rest, exportType, format },
  })
  return result as EmailExportResponse
}

// ============================================================================
// Analytics API (No Pagination - up to 10,000 records)
// ============================================================================

/**
 * Get expenses by date range for analytics
 */
export async function fetchAnalyticsExpensesByRange(payload: {
  userId: string
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}): Promise<AnalyticsDataResponse<AnalyticsExpenseRecord>> {
  if (isGuestUserId(payload.userId)) {
    // Return guest store data in analytics format
    const guestExpenses = guestStore.getExpenses()
    const startDate = new Date(payload.start)
    const endDate = new Date(payload.end)
    const filtered = guestExpenses.filter((e) => {
      if (!e.expenseDate) return false
      const d = new Date(e.expenseDate)
      return d >= startDate && d <= endDate
    })
    return {
      data: filtered.map((e) => ({
        expensesId: Number(e.expensesId ?? e.expenseId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        expenseName: e.expenseName ?? '',
        expenseAmount: Number(e.expenseAmount ?? e.amount ?? 0),
        userExpenseCategoryName: e.expenseCategoryName ?? '',
        lastUpdateTmstp: new Date().toISOString(),
        expenseDate: e.expenseDate ?? '',
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/expenses/range', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsExpenseRecord>
}

/**
 * Get expenses for a specific month for analytics
 */
export async function fetchAnalyticsExpensesByMonth(payload: {
  userId: string
  year: number
  month: number
}): Promise<AnalyticsDataResponse<AnalyticsExpenseRecord>> {
  if (isGuestUserId(payload.userId)) {
    const guestExpenses = guestStore.getExpenses()
    const filtered = guestExpenses.filter((e) => {
      if (!e.expenseDate) return false
      const d = new Date(e.expenseDate)
      return d.getFullYear() === payload.year && d.getMonth() + 1 === payload.month
    })
    return {
      data: filtered.map((e) => ({
        expensesId: Number(e.expensesId ?? e.expenseId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        expenseName: e.expenseName ?? '',
        expenseAmount: Number(e.expenseAmount ?? e.amount ?? 0),
        userExpenseCategoryName: e.expenseCategoryName ?? '',
        lastUpdateTmstp: new Date().toISOString(),
        expenseDate: e.expenseDate ?? '',
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/expenses/month', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsExpenseRecord>
}

/**
 * Get expenses for a specific year for analytics
 */
export async function fetchAnalyticsExpensesByYear(payload: {
  userId: string
  year: number
}): Promise<AnalyticsDataResponse<AnalyticsExpenseRecord>> {
  if (isGuestUserId(payload.userId)) {
    const guestExpenses = guestStore.getExpenses()
    const filtered = guestExpenses.filter((e) => {
      if (!e.expenseDate) return false
      const d = new Date(e.expenseDate)
      return d.getFullYear() === payload.year
    })
    return {
      data: filtered.map((e) => ({
        expensesId: Number(e.expensesId ?? e.expenseId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        expenseName: e.expenseName ?? '',
        expenseAmount: Number(e.expenseAmount ?? e.amount ?? 0),
        userExpenseCategoryName: e.expenseCategoryName ?? '',
        lastUpdateTmstp: new Date().toISOString(),
        expenseDate: e.expenseDate ?? '',
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/expenses/year', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsExpenseRecord>
}

/**
 * Get incomes by date range for analytics
 */
export async function fetchAnalyticsIncomesByRange(payload: {
  userId: string
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}): Promise<AnalyticsDataResponse<AnalyticsIncomeRecord>> {
  if (isGuestUserId(payload.userId)) {
    const guestIncomes = guestStore.getIncomes()
    const startDate = new Date(payload.start)
    const endDate = new Date(payload.end)
    const filtered = guestIncomes.filter((i) => {
      if (!i.receivedDate) return false
      const d = new Date(i.receivedDate)
      return d >= startDate && d <= endDate
    })
    return {
      data: filtered.map((i) => ({
        incomeId: Number(i.incomeId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        source: i.source ?? '',
        amount: Number(i.amount ?? 0),
        receivedDate: i.receivedDate ?? '',
        month: Number(i.month ?? 0),
        year: Number(i.year ?? 0),
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/incomes/range', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsIncomeRecord>
}

/**
 * Get incomes for a specific month for analytics
 */
export async function fetchAnalyticsIncomesByMonth(payload: {
  userId: string
  year: number
  month: number
}): Promise<AnalyticsDataResponse<AnalyticsIncomeRecord>> {
  if (isGuestUserId(payload.userId)) {
    const guestIncomes = guestStore.getIncomes()
    const filtered = guestIncomes.filter((i) => {
      return Number(i.year) === payload.year && Number(i.month) === payload.month
    })
    return {
      data: filtered.map((i) => ({
        incomeId: Number(i.incomeId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        source: i.source ?? '',
        amount: Number(i.amount ?? 0),
        receivedDate: i.receivedDate ?? '',
        month: Number(i.month ?? 0),
        year: Number(i.year ?? 0),
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/incomes/month', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsIncomeRecord>
}

/**
 * Get incomes for a specific year for analytics
 */
export async function fetchAnalyticsIncomesByYear(payload: {
  userId: string
  year: number
}): Promise<AnalyticsDataResponse<AnalyticsIncomeRecord>> {
  if (isGuestUserId(payload.userId)) {
    const guestIncomes = guestStore.getIncomes()
    const filtered = guestIncomes.filter((i) => Number(i.year) === payload.year)
    return {
      data: filtered.map((i) => ({
        incomeId: Number(i.incomeId ?? 0),
        userId: guestStore.GUEST_USER_ID,
        source: i.source ?? '',
        amount: Number(i.amount ?? 0),
        receivedDate: i.receivedDate ?? '',
        month: Number(i.month ?? 0),
        year: Number(i.year ?? 0),
      })),
      totalRecords: filtered.length,
      maxRecordsLimit: 10000,
    }
  }
  const result = await request('/analytics/incomes/year', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsDataResponse<AnalyticsIncomeRecord>
}

/**
 * Get analytics summary for date range (pre-aggregated data for charts)
 */
export async function fetchAnalyticsSummaryByRange(payload: {
  userId: string
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}): Promise<AnalyticsSummary> {
  if (isGuestUserId(payload.userId)) {
    // Build summary from guest store data
    return buildGuestAnalyticsSummary(payload.start, payload.end)
  }
  const result = await request('/analytics/summary/range', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsSummary
}

/**
 * Get analytics summary for a specific month
 */
export async function fetchAnalyticsSummaryByMonth(payload: {
  userId: string
  year: number
  month: number
}): Promise<AnalyticsSummary> {
  if (isGuestUserId(payload.userId)) {
    const startDate = new Date(payload.year, payload.month - 1, 1)
    const endDate = new Date(payload.year, payload.month, 0)
    const start = `${payload.year}-${String(payload.month).padStart(2, '0')}-01`
    const end = `${payload.year}-${String(payload.month).padStart(2, '0')}-${endDate.getDate()}`
    return buildGuestAnalyticsSummary(start, end)
  }
  const result = await request('/analytics/summary/month', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsSummary
}

/**
 * Get analytics summary for a specific year
 */
export async function fetchAnalyticsSummaryByYear(payload: {
  userId: string
  year: number
}): Promise<AnalyticsSummary> {
  if (isGuestUserId(payload.userId)) {
    const start = `${payload.year}-01-01`
    const end = `${payload.year}-12-31`
    return buildGuestAnalyticsSummary(start, end)
  }
  const result = await request('/analytics/summary/year', {
    method: 'POST',
    body: payload,
  })
  return result as AnalyticsSummary
}

/**
 * Helper to build analytics summary from guest store data
 */
function buildGuestAnalyticsSummary(start: string, end: string): AnalyticsSummary {
  const startDate = new Date(start)
  const endDate = new Date(end)
  
  const expenses = guestStore.getExpenses().filter((e) => {
    if (!e.expenseDate) return false
    const d = new Date(e.expenseDate)
    return d >= startDate && d <= endDate
  })
  
  const incomes = guestStore.getIncomes().filter((i) => {
    if (!i.receivedDate) return false
    const d = new Date(i.receivedDate)
    return d >= startDate && d <= endDate
  })

  const expensesByCategory: Record<string, number> = {}
  const monthlyExpenseTrend: Record<string, number> = {}
  let totalExpenses = 0

  expenses.forEach((e) => {
    const amount = Number(e.expenseAmount ?? e.amount ?? 0)
    totalExpenses += amount
    
    const cat = e.expenseCategoryName ?? 'Unknown'
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + amount
    
    if (e.expenseDate) {
      const d = new Date(e.expenseDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyExpenseTrend[key] = (monthlyExpenseTrend[key] ?? 0) + amount
    }
  })

  const incomesBySource: Record<string, number> = {}
  const monthlyIncomeTrend: Record<string, number> = {}
  let totalIncome = 0

  incomes.forEach((i) => {
    const amount = Number(i.amount ?? 0)
    totalIncome += amount
    
    const source = i.source ?? 'Unknown'
    incomesBySource[source] = (incomesBySource[source] ?? 0) + amount
    
    if (i.receivedDate) {
      const d = new Date(i.receivedDate)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyIncomeTrend[key] = (monthlyIncomeTrend[key] ?? 0) + amount
    }
  })

  return {
    totalExpenses,
    totalIncome,
    netBalance: totalIncome - totalExpenses,
    totalExpenseCount: expenses.length,
    totalIncomeCount: incomes.length,
    expensesByCategory,
    incomesBySource,
    monthlyExpenseTrend,
    monthlyIncomeTrend,
  }
}

// ============================================================================
// Health Check
// ============================================================================

export async function checkHealth(): Promise<string> {
  const result = await request('/health', { method: 'GET' })
  return typeof result === 'string' ? result : 'OK'
}

export function getApiBase(): string {
  return API_BASE
}

export default {
  ensureUserExists,
  logoutUser,
  getUserDetails,
  fetchExpenses,
  fetchUserExpenseCategories,
  fetchUserExpenseCategoriesActive,
  createUserExpenseCategory,
  updateUserExpenseCategory,
  deleteUserExpenseCategory,
  deleteAllUserExpenseCategories,
  copyUserExpenseCategoriesFromMaster,
  copyUserExpensesFromMaster,
  resolveUserExpenseCategoryId,
  fetchUserExpenses,
  fetchUserExpensesActive,
  createUserExpense,
  updateUserExpense,
  deleteUserExpense,
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
  // Monthly Balance APIs
  fetchAllMonthlyBalances,
  updateMonthlyBalance,
  // Export/Report APIs
  downloadExpensesReport,
  downloadIncomeReport,
  downloadAllReport,
  downloadCustomReport,
  emailExpensesReport,
  emailIncomeReport,
  emailAllReport,
  emailCustomReport,
  // Analytics APIs
  fetchAnalyticsExpensesByRange,
  fetchAnalyticsExpensesByMonth,
  fetchAnalyticsExpensesByYear,
  fetchAnalyticsIncomesByRange,
  fetchAnalyticsIncomesByMonth,
  fetchAnalyticsIncomesByYear,
  fetchAnalyticsSummaryByRange,
  fetchAnalyticsSummaryByMonth,
  fetchAnalyticsSummaryByYear,
}
