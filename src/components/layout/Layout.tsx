import { useEffect, useState, type ReactElement } from 'react'
import { Outlet } from 'react-router-dom'
import type { SessionData } from '../../types/app'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import styles from './Layout.module.css'

type LayoutProps = {
  session: SessionData | null
  onLogout?: () => void
}

const SIDEBAR_STATE_KEY = 'sidebar-collapsed'

const readCollapsedState = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(SIDEBAR_STATE_KEY) === '1'
  } catch {
    return false
  }
}

export default function Layout({ session, onLogout }: LayoutProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedState)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed)
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0')
      } catch {
        /* ignore storage issues */
      }
    }
  }, [collapsed])

  const toggleSidebar = () => {
    setCollapsed((previous) => !previous)
  }

  return (
    <div className={`${styles.appRoot} ${collapsed ? styles.collapsed : ''}`.trim()}>
      <Header session={session} onLogout={onLogout} />
      <div className={`${styles.body} ${collapsed ? styles.bodyCollapsed : ''}`.trim()}>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
