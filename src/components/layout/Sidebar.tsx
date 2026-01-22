import type { MouseEvent, ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Receipt, Wallet, BarChart3 } from 'lucide-react'
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
                <LayoutDashboard size={20} />
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
                <Receipt size={20} />
              </span>
              <span className={styles.label}>Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/operations/income" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">
                <Wallet size={20} />
              </span>
              <span className={styles.label}>Income</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/operations/analytics" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">
                <BarChart3 size={20} />
              </span>
              <span className={styles.label}>Analytics</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
