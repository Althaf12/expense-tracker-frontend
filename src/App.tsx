import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Dashboard from './pages/dashboard/Dashboard'
import ExpensesOperations from './pages/operations/ExpensesOperations'
import IncomeOperations from './pages/operations/IncomeOperations'
import Profile from './pages/profile/Profile'
import type { Expense, ExpenseCategory, Income, SessionData, StatusMessage } from './types/app'
import {
  fetchExpenses as apiFetchExpenses,
  forgotPassword as apiForgotPassword,
  fetchExpenseCategories as apiFetchExpenseCategories,
  fetchIncomeLastYear as apiFetchIncomeLastYear,
} from './api'
import { AppDataProvider } from './context/AppDataContext'
import styles from './App.module.css'

type StatusState = StatusMessage | null

const SESSION_STORAGE_KEY = 'session'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const parseSession = (raw: string | null): SessionData | null => {
  if (!raw) return null
  try {
    const candidate = JSON.parse(raw) as unknown
    if (!isRecord(candidate)) {
      return null
    }
    const username = candidate.username
    if (typeof username !== 'string' || username.length === 0) {
      return null
    }
    return {
      username,
      identifier: typeof candidate.identifier === 'string' ? candidate.identifier : undefined,
      user: isRecord(candidate.user) ? candidate.user : undefined,
    }
  } catch {
    return null
  }
}

export default function App(): ReactElement {
  const [session, setSession] = useState<SessionData | null>(null)
  const [status, setStatusState] = useState<StatusState>(null)
  const [expenseCategories, setExpenseCategories] = useState<ExpenseCategory[]>([])
  const [expensesCache, setExpensesCache] = useState<Expense[]>([])
  const [incomesCache, setIncomesCache] = useState<Income[]>([])

  const updateStatus = useCallback((next: StatusState) => {
    setStatusState(next)
  }, [])

  const handleLogin = (sessionData: SessionData, _initialExpenses: Expense[] = []) => {
    setSession(sessionData)
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
    } catch {
      /* ignore storage errors */
    }
  }

  const handleLogout = () => {
    setSession(null)
    setExpensesCache([])
    setExpenseCategories([])
    setIncomesCache([])
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    } catch {
      /* ignore storage errors */
    }
    try {
      window.location.href = '/'
    } catch {
      /* ignore navigation issues */
    }
  }

  const ensureExpenseCategories = useCallback(async (): Promise<ExpenseCategory[]> => {
    if (expenseCategories.length > 0) {
      return expenseCategories
    }
    const categories = await apiFetchExpenseCategories()
    setExpenseCategories(categories)
    return categories
  }, [expenseCategories])

  const reloadExpensesCache = useCallback(async (username: string): Promise<Expense[]> => {
    if (!username) return []
    const list = await apiFetchExpenses(username)
    setExpensesCache(list)
    return list
  }, [])

  const reloadIncomesCache = useCallback(async (username: string): Promise<Income[]> => {
    if (!username) return []
    const currentYear = new Date().getFullYear()
    const list = await apiFetchIncomeLastYear(username, currentYear)
    setIncomesCache(list)
    return list
  }, [])

  const handleGenerateTokenForUser = async (usernameOrEmail: string) => {
    if (!usernameOrEmail) return
    setStatusState({ type: 'loading', message: 'Generating reset token...' })
    try {
      const isEmail = usernameOrEmail.includes('@')
      const payload = isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail }
      const json = await apiForgotPassword(payload)

      if (isRecord(json) && typeof (json as Record<string, unknown>).token === 'string') {
        setStatusState({ type: 'success', message: 'Token generated. Proceed to reset password.' })
        try {
          window.location.href = `/reset-password?token=${encodeURIComponent(
            String((json as Record<string, unknown>).token)
          )}&username=${encodeURIComponent(usernameOrEmail)}`
        } catch {
          /* ignore navigation issues */
        }
      } else {
        setStatusState({ type: 'success', message: 'If the account exists, a token was generated (check email).' })
        try {
          window.location.href = '/reset-password'
        } catch {
          /* ignore navigation issues */
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatusState({ type: 'error', message })
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = parseSession(window.localStorage.getItem(SESSION_STORAGE_KEY))
    if (stored) {
      setSession(stored)
    }
  }, [])

  const contextValue = useMemo(
    () => ({
      session,
      setSession,
      status,
      setStatus: updateStatus,
      expenseCategories,
      setExpenseCategories,
      expensesCache,
      setExpensesCache,
      incomesCache,
      setIncomesCache,
      ensureExpenseCategories,
      reloadExpensesCache,
      reloadIncomesCache,
    }),
    [
      session,
      status,
      expenseCategories,
      expensesCache,
      incomesCache,
      ensureExpenseCategories,
      reloadExpensesCache,
      reloadIncomesCache,
      updateStatus,
    ],
  )

  return (
    <AppDataProvider value={contextValue}>
      <div className={styles.appShell}>
        {status && (
          <div
            className={`${styles.statusBanner} ${
              status.type === 'error'
                ? styles.error
                : status.type === 'success'
                ? styles.success
                : styles.loading
            }`}
          >
            {status.message}
          </div>
        )}

        <Routes>
          <Route
            path="/"
            element={
              session ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} setStatus={updateStatus} />
              )
            }
          />
          <Route path="/register" element={<Register setStatus={updateStatus} />} />
          <Route path="/forgot-password" element={<ForgotPassword setStatus={updateStatus} />} />
          <Route path="/reset-password" element={<ResetPassword setStatus={updateStatus} />} />

          <Route element={<Layout session={session} onLogout={handleLogout} />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operations/expenses" element={<ExpensesOperations />} />
            <Route path="/operations/income" element={<IncomeOperations />} />
            <Route
              path="/profile"
              element={<Profile session={session} onRequestReset={handleGenerateTokenForUser} />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AppDataProvider>
  )
}
