import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import type { SessionData } from '../../types/app'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'
import styles from './Layout.module.css'

type LayoutProps = {
  session: SessionData | null
  onLogout?: () => void
  isGuest?: boolean
  onSignIn?: () => void
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

export default function Layout({ session, onLogout, isGuest = false, onSignIn }: LayoutProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsedState)
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)
  const location = useLocation()
  const _skipFirstLocationClose = useRef(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0')
      } catch {
        /* ignore storage issues */
      }
    }
  }, [collapsed])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const mediaQuery = window.matchMedia('(max-width: 960px)')
    const updateMatches = () => {
      setIsMobile(mediaQuery.matches)
    }
    updateMatches()
    mediaQuery.addEventListener('change', updateMatches)
    return () => {
      mediaQuery.removeEventListener('change', updateMatches)
    }
  }, [])

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('sidebar-collapsed', collapsed && !isMobile)
      document.documentElement.classList.toggle('sidebar-mobile-open', isMobile && mobileSidebarOpen)
    }
  }, [collapsed, isMobile, mobileSidebarOpen])

  // Close mobile sidebar on navigation (after the route changes).
  // Skip the first run to avoid closing immediately on initial mount.
  useEffect(() => {
    if (_skipFirstLocationClose.current) {
      _skipFirstLocationClose.current = false
      return
    }
    if (isMobile && mobileSidebarOpen) {
      setMobileSidebarOpen(false)
    }
  }, [location.pathname])

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen((previous) => !previous)
    } else {
      setCollapsed((previous) => !previous)
    }
  }

  const closeMobileSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen(false)
    }
  }

  return (
    <div className={`${styles.appRoot} ${collapsed && !isMobile ? styles.collapsed : ''}`.trim()}>
      <Header
        session={session}
        onLogout={onLogout}
        onToggleSidebar={toggleSidebar}
        sidebarOpen={isMobile ? mobileSidebarOpen : !collapsed}
        isMobile={isMobile}
        isGuest={isGuest}
        onSignIn={onSignIn}
      />
      <div
        className={`${styles.body} ${collapsed && !isMobile ? styles.bodyCollapsed : ''} ${
          isMobile && mobileSidebarOpen ? styles.bodyMobileOpen : ''
        }`.trim()}
      >
        <div
          className={`${styles.sidebarWrapper} ${
            isMobile ? styles.sidebarWrapperMobile : ''
          } ${isMobile && mobileSidebarOpen ? styles.sidebarWrapperActive : ''}`.trim()}
        >
          <Sidebar
            collapsed={!isMobile && collapsed}
            onToggle={toggleSidebar}
            isMobile={isMobile}
            mobileOpen={mobileSidebarOpen}
            onClose={closeMobileSidebar}
          />
        </div>
        {isMobile && mobileSidebarOpen && (
          <div className={styles.sidebarOverlay} onClick={closeMobileSidebar} aria-hidden="true" />
        )}
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
