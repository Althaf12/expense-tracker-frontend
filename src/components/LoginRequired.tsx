import { useEffect, useState, type ReactElement } from 'react'
import { Lock, ExternalLink } from 'lucide-react'
import { getLoginUrl } from '../auth'
import styles from './LoginRequired.module.css'

const REDIRECT_DELAY_MS = 5000

type LoginRequiredProps = {
  /** Optional feature name to display in the message */
  feature?: string
}

export default function LoginRequired({ feature }: LoginRequiredProps): ReactElement {
  const [countdown, setCountdown] = useState(5)
  const loginUrl = getLoginUrl()

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
      window.location.href = loginUrl
    }, REDIRECT_DELAY_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [loginUrl])

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} />
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <Lock className={styles.icon} size={48} />
        </div>
        <h1 className={styles.title}>Authentication Required</h1>
        <p className={styles.message}>
          {feature
            ? `You need to sign in to access ${feature}.`
            : 'You need to login first to access this site.'}
        </p>
        <p className={styles.countdown}>
          Redirecting to login in <span className={styles.timer}>{countdown}</span> seconds...
        </p>
        <a href={loginUrl} className={styles.link}>
          <ExternalLink size={16} />
          <span>Click here if not redirected automatically</span>
        </a>
      </div>
    </div>
  )
}
