import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { ReactElement, useState, type FormEvent } from 'react'
import { userDetails } from '../../api'
import { useNavigate } from 'react-router-dom'
import type { Expense, SessionData, StatusMessage } from '../../types/app'
import { friendlyErrorMessage } from '../../utils/format'
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

      const user = (await userDetails(payload)) as Record<string, unknown> | null
      if (!user) {
        throw new Error('User not found in response')
      }
      const username = normaliseUsername(user, identifier)
      const session: SessionData = { username: String(username), identifier, user }

      try {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      } catch {
        /* ignore storage issues */
      }

      onLogin(session, [])
      navigate('/dashboard')

      /* Background fetch of all/current-month expenses removed — not required.
         Keeping initial login flow lightweight. */
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'logging in') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid container component="section" className={styles.page} direction="column" spacing={0}>
      <Grid size={12} className={styles.card}>
        <Typography variant="h4" component="h1" className={styles.title}>
          Login
        </Typography>
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
      </Grid>
    </Grid>
  )
}
