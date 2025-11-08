import type { MouseEvent, ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

type SidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
  isMobile?: boolean
  mobileOpen?: boolean
  onClose?: () => void
}

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `${styles.link} ${isActive ? styles.active : ''}`.trim()

export default function Sidebar({ collapsed = false, onToggle, isMobile = false, mobileOpen = false, onClose }: SidebarProps): ReactElement {
  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onToggle?.()
  }

  const handleClose = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onClose?.()
  }

  const sidebarClassName = [
    styles.sidebar,
    collapsed ? styles.collapsed : styles.expanded,
    isMobile ? styles.mobile : '',
    isMobile && mobileOpen ? styles.mobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  const expanded = isMobile ? mobileOpen : !collapsed

  return (
    <aside
      id="primary-sidebar"
      className={sidebarClassName}
      aria-expanded={expanded}
    >
      {isMobile ? (
        <div className={styles.mobileHeader}>
          <span className={styles.mobileTitle}>Navigation</span>
          <button type="button" className={styles.mobileClose} onClick={handleClose} aria-label="Close sidebar">
            ✕
          </button>
        </div>
      ) : (
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleButton} ${collapsed ? styles.toggleButtonActive : ''}`.trim()}
            onClick={handleToggle}
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      )}

      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li>
            <NavLink to="/dashboard" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">
                {/* Dashboard grid icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="3" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.4" rx="1" />
                  <rect x="13" y="3" width="8" height="8" stroke="currentColor" strokeWidth="1.4" rx="1" />
                  <rect x="3" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.4" rx="1" />
                  <rect x="13" y="13" width="8" height="8" stroke="currentColor" strokeWidth="1.4" rx="1" />
                </svg>
              </span>
              <span className={styles.label}>Dashboard</span>
            </NavLink>
          </li>
          <li className={styles.sectionTitle} aria-hidden="true">
            <span>User Operations</span>
          </li>
          <li>
            <NavLink to="/operations/expenses" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">
                {/* Receipt / expense icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M4 3h12l4 4v14H4V3z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 7h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className={styles.label}>Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/operations/income" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">
                {/* Wallet / income icon */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M3 7h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className={styles.label}>Income</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
