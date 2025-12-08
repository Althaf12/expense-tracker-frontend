import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SessionData } from '../../types/app'
import { useTheme } from '../../context/ThemeContext'
import ThemeToggle from './ThemeToggle'
import styles from './Header.module.css'

type HeaderProps = {
  session: SessionData | null
  onLogout?: () => void
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  isMobile?: boolean
}

const getInitial = (session: SessionData | null): string => {
  const source = session?.identifier ?? session?.username ?? ''
  return source.charAt(0).toUpperCase() || 'U'
}

export default function Header({ session, onLogout, onToggleSidebar, sidebarOpen = false }: HeaderProps): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

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
      <div className={styles.left}>
        {onToggleSidebar ? (
          <button
            type="button"
            className={`${styles.menuButton} ${sidebarOpen ? styles.menuButtonActive : ''}`.trim()}
            aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={sidebarOpen}
            aria-controls="primary-sidebar"
            onClick={onToggleSidebar}
          >
            <span />
            <span />
            <span />
          </button>
        ) : null}
        <div className={styles.brand}>
          <Link to="/dashboard" className={styles.brandLink}>
            Expense Tracker Powered by Eternivity<span className={styles.tm}>TM</span>
          </Link>
        </div>
      </div>

      <nav className={styles.actions}>
        <ThemeToggle theme={theme} onToggle={setTheme} className={styles.headerThemeToggle} />
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
