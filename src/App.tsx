import { useEffect, useState, type ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Expenses from './pages/dashboard/Expenses'
import Profile from './pages/profile/Profile'
import type { Expense, SessionData, StatusMessage } from './types/app'
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
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [status, setStatusState] = useState<StatusState>(null)

  const updateStatus = (next: StatusState) => {
    setStatusState(next)
  }

  const fetchExpensesForUser = async (username: string) => {
    if (!username) return
    setStatusState({ type: 'loading', message: 'Loading expenses...' })
    try {
      const response = await fetch('http://localhost:8080/api/expense/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Expenses request failed: ${response.status} ${text || response.statusText}`)
      }
      const payload = (await response.json()) as unknown
      const nextExpenses = Array.isArray(payload) ? (payload.filter(isRecord) as Expense[]) : []
      setExpenses(nextExpenses)
      setStatusState(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatusState({ type: 'error', message })
    }
  }

  const handleLogin = (sessionData: SessionData, initialExpenses: Expense[] = []) => {
    setSession(sessionData)
    setExpenses(initialExpenses)
    try {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData))
    } catch {
      /* ignore storage errors */
    }
  }

  const handleLogout = () => {
    setSession(null)
    setExpenses([])
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

  const handleGenerateTokenForUser = async (usernameOrEmail: string) => {
    if (!usernameOrEmail) return
    setStatusState({ type: 'loading', message: 'Generating reset token...' })
    try {
      const isEmail = usernameOrEmail.includes('@')
      const payload = isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail }
      const response = await fetch('http://localhost:8080/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await response.text().catch(() => '')
      if (!response.ok) {
        throw new Error(`${response.status} ${text || response.statusText}`)
      }

      let json: unknown = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = null
        }
      }

      if (isRecord(json) && typeof json.token === 'string') {
        setStatusState({ type: 'success', message: 'Token generated. Proceed to reset password.' })
        try {
          window.location.href = `/reset-password?token=${encodeURIComponent(json.token)}&username=${encodeURIComponent(usernameOrEmail)}`
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
      void fetchExpensesForUser(stored.username)
    }
  }, [])

  return (
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
          <Route path="/dashboard" element={<Expenses expenses={expenses} />} />
          <Route
            path="/profile"
            element={<Profile session={session} onRequestReset={handleGenerateTokenForUser} />}
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
