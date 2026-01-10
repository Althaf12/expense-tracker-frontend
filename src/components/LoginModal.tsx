import { useState, useCallback, useEffect, type ReactElement, type FormEvent } from 'react'
import styles from './LoginModal.module.css'
import { login, loginWithGoogle, getRegistrationUrl, GOOGLE_CLIENT_ID } from '../auth'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
            auto_select?: boolean
          }) => void
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              type?: 'standard' | 'icon'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              width?: number
              logo_alignment?: 'left' | 'center'
            }
          ) => void
          prompt: () => void
        }
      }
    }
  }
}

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
  const [googleLoading, setGoogleLoading] = useState(false)

  // Initialize Google Sign-In when modal opens
  useEffect(() => {
    if (!isOpen || !GOOGLE_CLIENT_ID) return

    // Load Google Identity Services script if not already loaded
    const existingScript = document.getElementById('google-identity-script')
    if (!existingScript) {
      const script = document.createElement('script')
      script.id = 'google-identity-script'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initializeGoogleSignIn
      document.head.appendChild(script)
    } else if (window.google?.accounts?.id) {
      initializeGoogleSignIn()
    }
  }, [isOpen])

  const handleGoogleCallback = useCallback(async (response: { credential: string }) => {
    setError(null)
    setGoogleLoading(true)
    
    try {
      const result = await loginWithGoogle(response.credential)
      
      if (result.success) {
        setUsername('')
        setPassword('')
        setError(null)
        onLoginSuccess()
      } else {
        setError(result.error || 'Google sign-in failed. Please try again.')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(message)
    } finally {
      setGoogleLoading(false)
    }
  }, [onLoginSuccess])

  const initializeGoogleSignIn = useCallback(() => {
    if (!window.google?.accounts?.id || !GOOGLE_CLIENT_ID) return

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCallback,
    })

    const buttonContainer = document.getElementById('google-signin-button')
    if (buttonContainer) {
      window.google.accounts.id.renderButton(buttonContainer, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        width: 352,
        logo_alignment: 'center',
      })
    }
  }, [handleGoogleCallback])

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername) {
      setError('Username or email is required')
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
    window.open(getRegistrationUrl(), '_blank', 'noopener,noreferrer')
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

        {/* Google Sign-In Button */}
        {GOOGLE_CLIENT_ID && (
          <div className={styles.googleSection}>
            <div 
              id="google-signin-button" 
              className={`${styles.googleButton} ${googleLoading ? styles.googleButtonLoading : ''}`}
            />
            {googleLoading && (
              <div className={styles.googleLoadingOverlay}>
                <span className={styles.spinner} />
                <span>Signing in with Google...</span>
              </div>
            )}
            <div className={styles.divider}>
              <span className={styles.dividerLine} />
              <span className={styles.dividerText}>or</span>
              <span className={styles.dividerLine} />
            </div>
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="login-username" className={styles.label}>Username or Email</label>
            <input
              id="login-username"
              type="text"
              className={styles.input}
              placeholder="Enter your username or email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading || googleLoading}
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
              disabled={loading || googleLoading}
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
              disabled={loading || googleLoading}
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
              disabled={loading || googleLoading}
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
