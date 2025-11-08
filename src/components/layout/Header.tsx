import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { SessionData } from '../../types/app'
import { useTheme } from '../../context/ThemeContext'
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

const SunIcon = (): ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <g stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" fill="none">
      <line x1="12" y1="2.5" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="2.5" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="21.5" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
    </g>
  </svg>
)

const MoonIcon = (): ReactElement => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M20.5 12.55A8.5 8.5 0 0 1 11.45 3.5a7 7 0 1 0 9.05 9.05z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
)

export default function Header({ session, onLogout, onToggleSidebar, sidebarOpen = false }: HeaderProps): ReactElement {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

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
            Expense Tracker
          </Link>
        </div>
      </div>

      <nav className={styles.actions}>
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-pressed={!isDark}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className={styles.themeToggleIcon}>{isDark ? <SunIcon /> : <MoonIcon />}</span>
        </button>
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
