import Grid from '@mui/material/Grid'
import { Typography } from '@mui/material'
import { useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StatusMessage } from '../../types/app'
import { friendlyErrorMessage } from '../../utils/format'
import styles from './ForgotPassword.module.css'
import { forgotPassword } from '../../api'

type StatusSetter = (status: StatusMessage | null) => void

type ForgotPasswordProps = {
  setStatus: StatusSetter
}

const isEmail = (value: string): boolean => /@/.test(value)

export default function ForgotPassword({ setStatus }: ForgotPasswordProps): ReactElement {
  const [identifier, setIdentifier] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(null)
    setLoading(true)

    try {
      const payload = isEmail(identifier) ? { email: identifier } : { username: identifier }
      await forgotPassword(payload)
      setStatus({
        type: 'success',
        message: 'If the account exists, a reset token was generated — check your email for the reset link.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setStatus({ type: 'error', message: friendlyErrorMessage(message, 'requesting password reset') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Grid container component="section" className={styles.page} direction="column" spacing={0}>
      <Grid size={12} className={styles.card}>
        <Typography variant="h4" component="h1" className={styles.title}>
          Forgot password
        </Typography>
        <Typography variant="body1" component="p" className={styles.lead}>
          Enter your username or email and we will generate a reset token for you.
        </Typography>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="forgot-identifier">
              Username or Email
            </label>
            <input
              id="forgot-identifier"
              className={styles.input}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset token'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>
        </form>
      </Grid>
    </Grid>
  )
}
