import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAppDataContext } from './AppDataContext'

export type NotificationType = 'info' | 'success' | 'error'
export type Notification = { id: string; type: NotificationType; message: string }

type NotificationsContextValue = {
  notifications: Notification[]
  addNotification: (n: Omit<Notification, 'id'>) => string
  removeNotification: (id: string) => void
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const { status, setStatus } = useAppDataContext()

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
    // Ignore info notifications — we only display success and error
    if (n.type === 'info') return ''
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const item: Notification = { id, ...n }
    setNotifications((prev) => [item, ...prev])
    // auto remove after 5s
    // This line will be moved to the UI component for animation
    // setTimeout(() => removeNotification(id), 5000)
    return id
  }, [removeNotification])

  // convert legacy AppDataContext status messages into notifications
  useEffect(() => {
    if (!status) return
    // only create notifications for success and error
    if (status.type === 'success' || status.type === 'error') {
      const type = status.type === 'success' ? 'success' : 'error'
      addNotification({ type, message: status.message })
      setStatus(null)
      return
    }
    // clear loading/other statuses silently (do not show info)
    if (status.type === 'loading') {
      setStatus(null)
    }
  }, [status, addNotification, setStatus])

  const value = useMemo(
    () => ({ notifications, addNotification, removeNotification }),
    [notifications, addNotification, removeNotification]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export const useNotifications = (): NotificationsContextValue => {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}

export default NotificationsContext
