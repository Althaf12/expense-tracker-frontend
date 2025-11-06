import type { Expense, ExpenseCategory, Income } from '../types/app'

// Read API base from Vite environment variable `VITE_API_BASE`.
// Falls back to the current localhost API for now.
const API_BASE: string = ((import.meta as any)?.env?.VITE_API_BASE as string) || 'http://localhost:8080/api'

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
    const fetchOptions: RequestInit = {
      method: requestMethod,
      headers: {
        ...(requestMethod === 'GET' ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
    }

    if (isBodyPresent && requestMethod !== 'GET') {
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

export async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  const result = await request('/expense-category/all', { method: 'GET' })
  return Array.isArray(result) ? (result as ExpenseCategory[]) : []
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
  expenseCategoryId: number | string
  amount: number
  expenseDate: string
  description?: string
}): Promise<unknown> {
  return await request('/expense/add', { body: payload })
}

export async function deleteExpense(payload: { username: string; expensesId: string | number }): Promise<unknown> {
  return await request('/expense/delete', { body: payload })
}

export async function updateExpense(payload: {
  expensesId: string | number
  username: string
  amount?: number
  description?: string
  expenseDate?: string
  expenseCategoryId?: string | number
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

export async function checkHealth(): Promise<string> {
  const result = await request('/health', { method: 'GET' })
  return typeof result === 'string' ? result : 'OK'
}

export function getApiBase(): string {
  return API_BASE
}

export default {
  userDetails,
  registerUser,
  fetchExpenses,
  forgotPassword,
  resetPassword,
  updatePassword,
  fetchExpenseCategories,
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
  checkHealth,
  getApiBase,
}
