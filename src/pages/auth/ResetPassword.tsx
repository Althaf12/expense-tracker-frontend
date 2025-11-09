import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useEffect, useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StatusMessage } from '../../types/app'
import styles from './ResetPassword.module.css'
import { resetPassword } from '../../api'

type StatusSetter = (status: StatusMessage | null) => void

type ResetPasswordProps = {
  setStatus: StatusSetter
}

const parseQueryParam = (search: string, key: string): string | null => {
  try {
    const params = new URLSearchParams(search)
    const value = params.get(key)
    return value && value.trim().length > 0 ? value : null
  } catch {
    return null
  }
}

export default function ResetPassword({ setStatus }: ResetPasswordProps): ReactElement {
  const [token, setToken] = useState<string>('')
  const [oldPassword, setOldPassword] = useState<string>('')
  const [newPassword, setNewPassword] = useState<string>('')
  const [confirmPassword, setConfirmPassword] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [username, setUsername] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const initialToken = parseQueryParam(window.location.search, 'token')
    const initialUser = parseQueryParam(window.location.search, 'username') ?? parseQueryParam(window.location.search, 'user')
    if (initialToken) {
      setToken(initialToken)
    }
    if (initialUser) {
      setUsername(initialUser)
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)

    if (!token) {
      setStatus({ type: 'error', message: 'Token is required to reset password.' })
      return
    }
    if (newPassword.trim().length < 6) {
      setStatus({ type: 'error', message: 'New password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        token,
        newPassword,
      }
      if (username) {
        payload.username = username
      }
      if (oldPassword.trim().length > 0) {
        payload.oldPassword = oldPassword
      }

      await resetPassword(payload)

      setStatus({ type: 'success', message: 'Password reset successful. Please login with your new password.' })
      navigate('/')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid container component="section" className={styles.page} direction="column" spacing={0}>
      <Grid size={12} className={styles.card}>
        <Typography variant="h4" component="h1" className={styles.title}>
          Reset Password
        </Typography>
        {username && (
          <Typography variant="body1" component="p" className={styles.lead}>
            Resetting password for <strong>{username}</strong>
          </Typography>
        )}
        <form className={styles.form} onSubmit={handleSubmit}>
          {!token && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="reset-token">
                Token
              </label>
              <input
                id="reset-token"
                className={styles.input}
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="reset-old-password">
              Old password (optional)
            </label>
            <input
              id="reset-old-password"
              className={styles.input}
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="reset-new-password">
              New password
            </label>
            <input
              id="reset-new-password"
              className={styles.input}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="reset-confirm-password">
              Confirm new password
            </label>
            <input
              id="reset-confirm-password"
              className={styles.input}
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button className={styles.secondaryButton} type="button" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </Grid>
    </Grid>
  )
}
