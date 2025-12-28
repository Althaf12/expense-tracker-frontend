import { useState, useEffect, type ReactElement } from 'react'
import styles from './GuestWelcomeModal.module.css'

// Login redirect URL - uses env var or defaults based on environment
const LOGIN_REDIRECT_URL = ((import.meta as any)?.env?.VITE_LOGIN_URL as string) || 
  ((import.meta as any)?.env?.DEV ? 'http://localhost:5175' : 'https://eternivity.com')

const GUEST_WELCOME_SHOWN_KEY = 'guest-welcome-shown'

type GuestWelcomeModalProps = {
  isGuest: boolean
}

export default function GuestWelcomeModal({ isGuest }: GuestWelcomeModalProps): ReactElement | null {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isGuest) return
    
    // Check if already shown in this session
    const alreadyShown = sessionStorage.getItem(GUEST_WELCOME_SHOWN_KEY)
    if (!alreadyShown) {
      setShow(true)
    }
  }, [isGuest])

  const handleContinue = () => {
    sessionStorage.setItem(GUEST_WELCOME_SHOWN_KEY, '1')
    setShow(false)
  }

  const handleSignIn = () => {
    sessionStorage.setItem(GUEST_WELCOME_SHOWN_KEY, '1')
    window.location.href = LOGIN_REDIRECT_URL
  }

  if (!show) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconContainer}>
          <span className={styles.icon}>👋</span>
        </div>
        
        <h2 className={styles.title}>Welcome to Expense Tracker</h2>
        
        <p className={styles.message}>
          Expense Tracker is being opened in <strong>Guest User</strong> mode. 
          If you have already registered, click on <strong>Sign In</strong>. 
          If you want to explore things without login, then you can continue as a guest user.
        </p>
        
        <p className={styles.warning}>
          <span className={styles.warningIcon}>⚠️</span>
          <em>Any modification done in guest mode will be reset after the browser is closed.</em>
        </p>
        
        <div className={styles.actions}>
          <button type="button" className={styles.signInButton} onClick={handleSignIn}>
            🔐 Sign In
          </button>
          <button type="button" className={styles.continueButton} onClick={handleContinue}>
            🚀 Continue as Guest
          </button>
        </div>
      </div>
    </div>
  )
}
