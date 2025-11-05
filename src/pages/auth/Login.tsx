import { ReactElement, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Expense, SessionData, StatusMessage } from '../../types/app'
import styles from './Login.module.css'

type StatusSetter = (status: StatusMessage | null) => void

type LoginProps = {
  onLogin: (session: SessionData, initialExpenses?: Expense[]) => void
  setStatus: StatusSetter
}

const SESSION_KEY = 'session'

const isEmail = (value: string): boolean => /@/.test(value)

const normaliseUsername = (user: Record<string, unknown>, fallback: string): string => {
  const candidates = [
    user.username,
    user.name,
    user.user_name,
    user.userName,
    user.id,
    user.user_id,
    fallback,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate
    }
  }
  return fallback
}

export default function Login({ onLogin, setStatus }: LoginProps): ReactElement {
  const [identifier, setIdentifier] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setLoading(true)

    try {
      const payload = isEmail(identifier) ? { email: identifier } : { username: identifier }

      const response = await fetch('http://localhost:8080/api/user/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Details request failed: ${response.status} ${text || response.statusText}`)
      }

      const rawUser = (await response.json()) as unknown
      if (typeof rawUser !== 'object' || rawUser === null) {
        throw new Error('User not found in response')
      }

      const user = rawUser as Record<string, unknown>
      const username = normaliseUsername(user, identifier)
      const session: SessionData = { username: String(username), identifier, user }

      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } catch {
        /* ignore storage issues */
      }

      onLogin(session, [])
      navigate('/dashboard')

      void (async () => {
        try {
          const expensesResponse = await fetch('http://localhost:8080/api/expense/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: String(username) }),
          })

          if (!expensesResponse.ok) {
            console.warn('Expenses request failed:', expensesResponse.status)
            return
          }

          const expensesPayload = (await expensesResponse.json()) as unknown
          if (Array.isArray(expensesPayload)) {
            onLogin(session, expensesPayload as Expense[])
          }
        } catch (backgroundError) {
          console.warn('Failed to fetch expenses after login', backgroundError)
        }
      })()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h2 className={styles.title}>Login</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-identifier">
              Username or Email
            </label>
            <input
              id="login-identifier"
              className={styles.input}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => navigate('/register')}
            >
              Register
            </button>
          </div>
        </form>

        <div className={styles.footerLink}>
          <button className={styles.linkButton} type="button" onClick={() => navigate('/forgot-password')}>
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}
