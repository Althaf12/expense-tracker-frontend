import type { SessionData } from '../../types/app'
import type { ReactElement } from 'react'
import styles from './Profile.module.css'

type ProfileProps = {
  session: SessionData | null
  onRequestReset?: (username: string) => void
}

const getString = (value: unknown): string => (typeof value === 'string' ? value : '')

export default function Profile({ session, onRequestReset }: ProfileProps): ReactElement {
  const user = (session?.user ?? {}) as Record<string, unknown>
  const sessionIdentifier = session?.identifier ?? session?.username ?? ''
  const username = getString(user.username) || getString(user.userName) || sessionIdentifier
  const email = getString(user.email)

  const handleReset = () => {
    if (username) {
      onRequestReset?.(username)
    }
  }

  return (
    <section className={styles.wrapper}>
      <h2 className={styles.title}>Profile</h2>
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Username</dt>
          <dd>{username || '-'}</dd>
        </div>
        <div className={styles.row}>
          <dt>Email</dt>
          <dd>{email || '-'}</dd>
        </div>
      </dl>
      <button type="button" className={styles.resetButton} onClick={handleReset} disabled={!username}>
        Reset password
      </button>
    </section>
  )
}
