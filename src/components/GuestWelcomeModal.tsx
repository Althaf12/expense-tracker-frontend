import { useState, useEffect, type ReactElement } from 'react'
import styles from './GuestWelcomeModal.module.css'
import { MAIN_SITE_URL } from '../auth'

const GUEST_WELCOME_SHOWN_KEY = 'guest-welcome-shown'

type GuestWelcomeModalProps = {
  isGuest: boolean
  onSignIn?: () => void
}

export default function GuestWelcomeModal({ isGuest, onSignIn }: GuestWelcomeModalProps): ReactElement | null {
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
    setShow(false)
    // Open login modal
    onSignIn?.()
  }

  const handleRegister = () => {
    window.open(MAIN_SITE_URL, '_blank', 'noopener,noreferrer')
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

        <p className={styles.registerMessage}>
          If you haven't registered, please register for Eternivity and avail all the services.
        </p>
        
        <div className={styles.actions}>
          <button type="button" className={styles.signInButton} onClick={handleSignIn}>
            🔐 Sign In
          </button>
          <button type="button" className={styles.continueButton} onClick={handleContinue}>
            🚀 Continue as Guest
          </button>
        </div>

        <div className={styles.registerSection}>
          <button type="button" className={styles.registerButton} onClick={handleRegister}>
            📝 Register for Eternivity
          </button>
        </div>
      </div>
    </div>
  )
}
