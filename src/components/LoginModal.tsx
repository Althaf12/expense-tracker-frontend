import { useState, useCallback, type ReactElement, type FormEvent } from 'react'
import styles from './LoginModal.module.css'
import { login, MAIN_SITE_URL } from '../auth'

type LoginModalProps = {
  isOpen: boolean
  onClose: () => void
  onLoginSuccess: () => void
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps): ReactElement | null {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername) {
      setError('Username is required')
      return
    }
    if (!trimmedPassword) {
      setError('Password is required')
      return
    }

    setLoading(true)
    try {
      const result = await login(trimmedUsername, trimmedPassword)
      
      if (result.success) {
        // Clear form
        setUsername('')
        setPassword('')
        setError(null)
        // Notify parent of successful login
        onLoginSuccess()
      } else {
        setError(result.error || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [username, password, onLoginSuccess])

  const handleClose = useCallback(() => {
    if (!loading) {
      setUsername('')
      setPassword('')
      setError(null)
      onClose()
    }
  }, [loading, onClose])

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      handleClose()
    }
  }, [loading, handleClose])

  const handleRegister = useCallback(() => {
    window.open(MAIN_SITE_URL, '_blank', 'noopener,noreferrer')
  }, [])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <span className={styles.icon}>🔐</span>
        </div>

        <h2 className={styles.title}>Sign In</h2>
        <p className={styles.subtitle}>Enter your credentials to continue</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="login-username" className={styles.label}>Username</label>
            <input
              id="login-username"
              type="text"
              className={styles.input}
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="login-password" className={styles.label}>Password</label>
            <input
              id="login-password"
              type="password"
              className={styles.input}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.loginButton}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className={styles.spinner} />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={loading}
            >
              Continue as Guest
            </button>
          </div>
        </form>

        <div className={styles.registerSection}>
          <p className={styles.registerMessage}>
            If you haven't registered, please register for Eternivity and avail all the services.
          </p>
          <button type="button" className={styles.registerButton} onClick={handleRegister}>
            📝 Register for Eternivity
          </button>
        </div>
      </div>
    </div>
  )
}
