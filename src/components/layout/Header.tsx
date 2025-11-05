import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SessionData } from '../../types/app'
import styles from './Header.module.css'

type HeaderProps = {
  session: SessionData | null
  onLogout?: () => void
}

const getInitial = (session: SessionData | null): string => {
  const source = session?.identifier ?? session?.username ?? ''
  return source.charAt(0).toUpperCase() || 'U'
}

export default function Header({ session, onLogout }: HeaderProps): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [])

  const goToProfile = () => {
    setOpen(false)
    navigate('/profile')
  }

  const handleLogout = () => {
    setOpen(false)
    onLogout?.()
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}> 
        <Link to="/dashboard" className={styles.brandLink}>
          Expense Tracker
        </Link>
      </div>

      <nav className={styles.actions}>
        {!session ? (
          <Link to="/" className={styles.authLink}>
            Login
          </Link>
        ) : (
          <div
            ref={wrapperRef}
            className={`${styles.profileWrapper} ${open ? styles.profileWrapperOpen : ''}`.trim()}
          >
            <button
              type="button"
              className={styles.profileButton}
              aria-haspopup="true"
              aria-expanded={open}
              onClick={() => setOpen((prev) => !prev)}
            >
              {getInitial(session)}
            </button>

            <div className={styles.menu} role="menu">
              <button type="button" className={styles.menuItem} onClick={goToProfile}>
                Profile
              </button>
              <button type="button" className={styles.menuItem} onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
