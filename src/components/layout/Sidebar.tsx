import type { MouseEvent, ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import styles from './Sidebar.module.css'

type SidebarProps = {
  collapsed?: boolean
  onToggle?: () => void
}

const linkClassName = ({ isActive }: { isActive: boolean }) =>
  `${styles.link} ${isActive ? styles.active : ''}`.trim()

export default function Sidebar({ collapsed = false, onToggle }: SidebarProps): ReactElement {
  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onToggle?.()
  }

  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : styles.expanded}`.trim()}
      aria-expanded={!collapsed}
    >
      <div className={styles.toggleRow}>
        <button type="button" className={styles.toggleButton} onClick={handleToggle} aria-label="Toggle sidebar">
          <svg
            className={`${styles.toggleIcon} ${collapsed ? styles.rotated : ''}`.trim()}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <nav className={styles.navigation}>
        <ul className={styles.navList}>
          <li>
            <NavLink to="/dashboard" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">DB</span>
              <span className={styles.label}>Dashboard</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/profile" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">PR</span>
              <span className={styles.label}>Profile</span>
            </NavLink>
          </li>
          <li className={styles.sectionTitle} aria-hidden="true">
            <span>User Operations</span>
          </li>
          <li>
            <NavLink to="/operations/expenses" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">EX</span>
              <span className={styles.label}>Expenses</span>
            </NavLink>
          </li>
          <li>
            <NavLink to="/operations/income" className={linkClassName}>
              <span className={styles.icon} aria-hidden="true">IN</span>
              <span className={styles.label}>Income</span>
            </NavLink>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
