import { useState, type FormEvent, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import type { StatusMessage } from '../../types/app'
import styles from './ForgotPassword.module.css'

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
      const response = await fetch('http://localhost:8080/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await response.text().catch(() => '')
      if (!response.ok) {
        throw new Error(`${response.status} ${text || response.statusText}`)
      }

      setStatus({
        type: 'success',
        message: 'If the account exists, a reset token was generated � check your email for the reset link.',
      })
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
        <h2 className={styles.title}>Forgot password</h2>
        <p className={styles.lead}>Enter your username or email and we will generate a reset token for you.</p>
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
      </div>
    </div>
  )
}
