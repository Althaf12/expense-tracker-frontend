import { useEffect, useState, type ReactElement } from 'react'
import { Lock, ExternalLink } from 'lucide-react'
import styles from './LoginRequired.module.css'

const REDIRECT_URL = import.meta.env.VITE_MAIN_SITE_URL || 'https://eternivity.com'
const REDIRECT_DELAY_MS = 5000

export default function LoginRequired(): ReactElement {
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    const timeout = setTimeout(() => {
      window.location.href = REDIRECT_URL
    }, REDIRECT_DELAY_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} />
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <Lock className={styles.icon} size={48} />
        </div>
        <h1 className={styles.title}>Authentication Required</h1>
        <p className={styles.message}>
          You need to login first to access this site.
        </p>
        <p className={styles.countdown}>
          Redirecting to eternivity.com in <span className={styles.timer}>{countdown}</span> seconds...
        </p>
        <a href={REDIRECT_URL} className={styles.link}>
          <ExternalLink size={16} />
          <span>Click here if not redirected automatically</span>
        </a>
      </div>
    </div>
  )
}
