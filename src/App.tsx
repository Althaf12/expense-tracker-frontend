import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/dashboard/Dashboard'
import ExpensesOperations from './pages/operations/ExpensesOperations'
import IncomeOperations from './pages/operations/IncomeOperations'
import Profile from './pages/profile/Profile'
import {
  fetchExpensesByMonth as apiFetchExpensesByMonth,
  fetchIncomeLastYear as apiFetchIncomeLastYear,
  fetchUserExpenseCategoriesActive as apiFetchUserExpenseCategoriesActive,
  fetchUserExpenses as apiFetchUserExpenses,
  fetchUserExpensesActive as apiFetchUserExpensesActive,
  fetchPreviousMonthlyBalance as apiFetchPreviousMonthlyBalance,
  ensureUserExists as apiEnsureUserExists,
  logoutUser as apiLogoutUser,
} from './api'
import type { Expense, UserExpenseCategory, Income, SessionData, StatusMessage, UserExpense } from './types/app'
import { AppDataProvider } from './context/AppDataContext'
import { ThemeProvider } from './context/ThemeContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { NotificationsProvider } from './context/NotificationsContext'
import Notifications from './components/notifications/Notifications'
import { getAuthFromCookies, clearAuthCookies } from './utils/cookies'
import { guestStore } from './utils/guestStore'
import GuestWelcomeModal from './components/GuestWelcomeModal'
import styles from './App.module.css'

type StatusState = StatusMessage | null

const REDIRECT_URL = ((import.meta as any)?.env?.VITE_MAIN_SITE_URL as string) || 'https://eternivity.com'

export default function App(): ReactElement {
  const [session, setSession] = useState<SessionData | null>(null)
  const [isAuthChecked, setIsAuthChecked] = useState(false)
  const [status, setStatusState] = useState<StatusState>(null)
  const [expenseCategories, setExpenseCategories] = useState<UserExpenseCategory[]>([])
  const expenseCategoriesRef = useRef<UserExpenseCategory[]>([])
  const [userExpenses, setUserExpenses] = useState<UserExpense[]>([])
  const [activeUserExpenses, setActiveUserExpenses] = useState<UserExpense[]>([])
  const [expensesCache, setExpensesCache] = useState<Expense[]>([])
  const [incomesCache, setIncomesCache] = useState<Income[]>([])

  const updateStatus = useCallback((next: StatusState) => {
    setStatusState(next)
  }, [])

  // Helper to check if current session is guest
  const isGuestSession = session?.userId === guestStore.GUEST_USER_ID

  const handleLogout = useCallback(async () => {
    if (session?.userId) {
      try {
        await apiLogoutUser(session.userId)
      } catch {
        /* ignore logout API errors */
      }
    }
    
    // Clear all state
    setSession(null)
    setExpensesCache([])
    setExpenseCategories([])
    expenseCategoriesRef.current = []
    setUserExpenses([])
    setActiveUserExpenses([])
    setIncomesCache([])
    
    // Clear cookies
    clearAuthCookies()
    
    // For guest users, just reload the page to start fresh guest session
    if (isGuestSession) {
      guestStore.clearAll()
      window.location.reload()
      return
    }
    
    // Redirect to main domain for real users
    window.location.href = REDIRECT_URL
  }, [session?.userId, isGuestSession])

  const ensureExpenseCategories = useCallback(async (): Promise<UserExpenseCategory[]> => {
    const userId = session?.userId
    if (!userId) {
      setExpenseCategories([])
      expenseCategoriesRef.current = []
      return []
    }
    const cached = expenseCategoriesRef.current
    if (cached.length > 0) {
      return cached
    }
    const categories = await apiFetchUserExpenseCategoriesActive(userId)
    expenseCategoriesRef.current = categories
    setExpenseCategories(categories)
    return categories
  }, [session?.userId])

  const ensureUserExpenses = useCallback(async (): Promise<UserExpense[]> => {
    const userId = session?.userId
    if (!userId) {
      setUserExpenses([])
      return []
    }
    const expenses = await apiFetchUserExpenses(userId)
    setUserExpenses(expenses)
    return expenses
  }, [session?.userId])

  const ensureActiveUserExpenses = useCallback(async (): Promise<UserExpense[]> => {
    const userId = session?.userId
    if (!userId) {
      setActiveUserExpenses([])
      return []
    }
    const expenses = await apiFetchUserExpensesActive(userId)
    setActiveUserExpenses(expenses)
    return expenses
  }, [session?.userId])

  // Force refresh functions that bypass any caching
  const refreshExpenseCategories = useCallback(async (): Promise<UserExpenseCategory[]> => {
    const userId = session?.userId
    if (!userId) {
      setExpenseCategories([])
      expenseCategoriesRef.current = []
      return []
    }
    const categories = await apiFetchUserExpenseCategoriesActive(userId)
    expenseCategoriesRef.current = categories
    setExpenseCategories(categories)
    return categories
  }, [session?.userId])

  const refreshActiveUserExpenses = useCallback(async (): Promise<UserExpense[]> => {
    const userId = session?.userId
    if (!userId) {
      setActiveUserExpenses([])
      return []
    }
    const expenses = await apiFetchUserExpensesActive(userId)
    setActiveUserExpenses(expenses)
    return expenses
  }, [session?.userId])

  const reloadExpensesCache = useCallback(async (userId: string): Promise<Expense[]> => {
    if (!userId) return []
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    try {
      const paged = await apiFetchExpensesByMonth({ userId, month, year, page: 0, size: 20 })
      const list = Array.isArray((paged as any).content) ? (paged as any).content as Expense[] : []
      setExpensesCache(list)
      return list
    } catch {
      setExpensesCache([])
      return []
    }
  }, [])

  const reloadIncomesCache = useCallback(async (userId: string): Promise<Income[]> => {
    if (!userId) return []
    const currentYear = new Date().getFullYear()
    const list = await apiFetchIncomeLastYear(userId, currentYear)
    setIncomesCache(list)
    return list
  }, [])

  // Check for cookie-based authentication on mount
  useEffect(() => {
    const initAuth = async () => {
      const authData = getAuthFromCookies()
      
      if (authData && authData.userId && authData.token) {
        // Create session from cookie data
        const sessionData: SessionData = {
          userId: authData.userId,
          username: authData.username,
          email: authData.email,
          token: authData.token,
          subscription: authData.subscription,
        }
        
        // Ensure user exists in backend (first-time login check)
        try {
          await apiEnsureUserExists(authData.userId)
        } catch {
          /* User might already exist, ignore */
        }
        
        setSession(sessionData)
      } else {
        // No real user logged in - create guest session
        const guestSession: SessionData = {
          userId: guestStore.GUEST_USER_ID,
          username: guestStore.GUEST_USERNAME,
          email: undefined,
          token: undefined,
        }
        setSession(guestSession)
      }
      
      setIsAuthChecked(true)
    }
    
    initAuth()
  }, [])

  // Scheduler: fetch previous monthly closing balance at 00:05 on the 1st of each month
  useEffect(() => {
    if (typeof window === 'undefined') return
    let mounted = true
    let timerId: number | undefined

    const runFetchAndScheduleNext = async () => {
      try {
        const userId = session?.userId
        if (userId) {
          try {
            const mb = await apiFetchPreviousMonthlyBalance(userId)
            const now = new Date()
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
              const key = `dashboard:monthly-balance:${userId}:${year}-${String(month).padStart(2, '0')}`
              try {
                window.localStorage.setItem(key, JSON.stringify({ balance, month, year, storedAt: new Date().toISOString() }))
              } catch {
                /* ignore storage errors */
              }
              try {
                window.dispatchEvent(new CustomEvent('monthlyBalanceUpdated', { detail: { userId, month, year, balance } }))
              } catch {
                /* ignore event dispatch failures */
              }
            }
          } catch {
            /* swallow API errors; schedule next run */
          }
        }
      } finally {
        if (!mounted) return
        const now = new Date()
        let next = new Date(now.getFullYear(), now.getMonth(), 1, 0, 5, 0, 0)
        if (now >= next) {
          next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5, 0, 0)
        }
        const delay = Math.max(0, next.getTime() - Date.now())
        timerId = window.setTimeout(runFetchAndScheduleNext, delay)
      }
    }

    runFetchAndScheduleNext()

    return () => {
      mounted = false
      if (timerId) clearTimeout(timerId)
    }
  }, [session?.userId])

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
      refreshExpenseCategories,
      ensureUserExpenses,
      ensureActiveUserExpenses,
      refreshActiveUserExpenses,
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
      refreshExpenseCategories,
      ensureUserExpenses,
      ensureActiveUserExpenses,
      refreshActiveUserExpenses,
      reloadExpensesCache,
      reloadIncomesCache,
      updateStatus,
    ],
  )

  // Show nothing while checking auth
  if (!isAuthChecked) {
    return (
      <div className={styles.appShell}>
        <div className={styles.loadingScreen}>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    )
  }

  // Session should always be present (either real user or guest)
  // But we keep a fallback just in case
  if (!session) {
    return (
      <div className={styles.appShell}>
        <div className={styles.loadingScreen}>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider userId={session?.userId}>
      <AppDataProvider value={contextValue}>
        <PreferencesProvider userId={session?.userId}>
          <NotificationsProvider>
            <div className={styles.appShell}>
              <Notifications />
              <GuestWelcomeModal isGuest={isGuestSession} />
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                <Route element={<Layout session={session} onLogout={handleLogout} isGuest={isGuestSession} />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/operations/expenses" element={<ExpensesOperations />} />
                  <Route path="/operations/income" element={<IncomeOperations />} />
                  <Route path="/profile" element={<Profile session={session} />} />
                </Route>

                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </NotificationsProvider>
        </PreferencesProvider>
      </AppDataProvider>
    </ThemeProvider>
  )
}
