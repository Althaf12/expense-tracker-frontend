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
import {
  fetchExpenses as apiFetchExpenses,
  forgotPassword as apiForgotPassword,
  fetchIncomeLastYear as apiFetchIncomeLastYear,
  fetchUserExpenseCategoriesActive as apiFetchUserExpenseCategoriesActive,
  fetchUserExpenses as apiFetchUserExpenses,
  fetchUserExpensesActive as apiFetchUserExpensesActive,
  fetchPreviousMonthlyBalance as apiFetchPreviousMonthlyBalance,
} from './api'
import type { Expense, UserExpenseCategory, Income, SessionData, StatusMessage, UserExpense } from './types/app'
import { AppDataProvider } from './context/AppDataContext'
import { ThemeProvider } from './context/ThemeContext'
import { NotificationsProvider } from './context/NotificationsContext'
import Notifications from './components/notifications/Notifications'
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
  const [expenseCategories, setExpenseCategories] = useState<UserExpenseCategory[]>([])
  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([])
  const [activeUserExpenses, setActiveUserExpenses] = useState<UserExpense[]>([])
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
    setUserExpenses([])
    setActiveUserExpenses([])
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

  const ensureExpenseCategories = useCallback(async (): Promise<UserExpenseCategory[]> => {
    const username = session?.username
    if (!username) {
      setExpenseCategories([])
      return []
    }
    const categories = await apiFetchUserExpenseCategoriesActive(username)
    setExpenseCategories(categories)
    return categories
  }, [session?.username])

  const ensureUserExpenses = useCallback(async (): Promise<UserExpense[]> => {
    const username = session?.username
    if (!username) {
      setUserExpenses([])
      return []
    }
    const expenses = await apiFetchUserExpenses(username)
    setUserExpenses(expenses)
    return expenses
  }, [session?.username])

  const ensureActiveUserExpenses = useCallback(async (): Promise<UserExpense[]> => {
    const username = session?.username
    if (!username) {
      setActiveUserExpenses([])
      return []
    }
    const expenses = await apiFetchUserExpensesActive(username)
    setActiveUserExpenses(expenses)
    return expenses
  }, [session?.username])

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

  // Scheduler: fetch previous monthly closing balance at 00:05 on the 1st of each month
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true
    let timerId: number | undefined

    const runFetchAndScheduleNext = async () => {
      try {
        const username = session?.username ?? (() => {
          try {
            const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
            if (!raw) return null
            const parsed = JSON.parse(raw)
            return parsed?.username || null
          } catch {
            return null
          }
        })()

        if (username) {
          try {
            const mb = await apiFetchPreviousMonthlyBalance(username)
            const now = new Date()
            // scheduler runs at the start of a new month — store balance for the previous month
            const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            const month = prev.getMonth() + 1
            const year = prev.getFullYear()
            let balance: number | null = null
            if (mb && typeof mb === 'object') {
              const payload = mb as Record<string, unknown>
              if (typeof payload.closingBalance === 'number') {
                balance = payload.closingBalance
              } else if (typeof payload.balance === 'number') {
                balance = payload.balance
              } else if (typeof payload.openingBalance === 'number') {
                balance = payload.openingBalance
              }
            }

            if (balance !== null) {
              const key = `dashboard:monthly-balance:${username}:${year}-${String(month).padStart(2, '0')}`
              try {
                window.localStorage.setItem(key, JSON.stringify({ balance, month, year, storedAt: new Date().toISOString() }))
              } catch {
                /* ignore storage errors */
              }
              try {
                window.dispatchEvent(new CustomEvent('monthlyBalanceUpdated', { detail: { username, month, year, balance } }))
              } catch {
                /* ignore event dispatch failures */
              }
            }
          } catch (err) {
            /* swallow API errors; schedule next run */
          }
        }
      } finally {
        if (!mounted) return
        // schedule next 1st @ 00:05
        const now = new Date()
        let next = new Date(now.getFullYear(), now.getMonth(), 1, 0, 5, 0, 0)
        if (now >= next) {
          next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0, 0)
        }
        const delay = Math.max(0, next.getTime() - Date.now())
        timerId = window.setTimeout(runFetchAndScheduleNext, delay)
      }
    }

    // kick off the scheduler (will schedule itself after run)
    runFetchAndScheduleNext()

    return () => {
      mounted = false
      if (timerId) clearTimeout(timerId)
    }
  }, [session?.username])

  const contextValue = useMemo(
    () => ({
      session,
      setSession,
      status,
      setStatus: updateStatus,
      expenseCategories,
      setExpenseCategories,
      userExpenses,
      setUserExpenses,
      activeUserExpenses,
      setActiveUserExpenses,
      expensesCache,
      setExpensesCache,
      incomesCache,
      setIncomesCache,
      ensureExpenseCategories,
      ensureUserExpenses,
      ensureActiveUserExpenses,
      reloadExpensesCache,
      reloadIncomesCache,
    }),
    [
      session,
      status,
      expenseCategories,
      userExpenses,
      activeUserExpenses,
      expensesCache,
      incomesCache,
      ensureExpenseCategories,
      ensureUserExpenses,
      ensureActiveUserExpenses,
      reloadExpensesCache,
      reloadIncomesCache,
      updateStatus,
    ],
  )

  return (
    <ThemeProvider>
      <AppDataProvider value={contextValue}>
        <NotificationsProvider>
        <div className={styles.appShell}>
        <Notifications />

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
        </NotificationsProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
