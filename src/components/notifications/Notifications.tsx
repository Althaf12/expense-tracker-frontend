import React, { JSX, useEffect, useRef, useState } from 'react'
import { useNotifications } from '../../context/NotificationsContext'
import styles from './Notifications.module.css'

export default function Notifications(): JSX.Element {
  const { notifications, removeNotification } = useNotifications()
  const [closing, setClosing] = useState<Record<string, boolean>>({})
  const timersRef = useRef<Record<string, number>>({})

  const startClose = (id: string) => {
    if (closing[id]) return
    setClosing((prev) => ({ ...prev, [id]: true }))
    // wait for animation to finish then remove from context
    const t = window.setTimeout(() => {
      removeNotification(id)
      setClosing((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id])
        delete timersRef.current[id]
      }
    }, 260)
    timersRef.current[`close-${id}`] = t
  }

  // Auto-schedule close after 5s for each notification
  useEffect(() => {
    notifications.forEach((n) => {
      const key = n.id
      if (timersRef.current[key] || closing[key]) return
      const t = window.setTimeout(() => {
        startClose(key)
      }, 5000)
      timersRef.current[key] = t
    })

    return () => {
      Object.values(timersRef.current).forEach((v) => clearTimeout(v))
      timersRef.current = {}
    }
  }, [notifications])

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((v) => clearTimeout(v))
      timersRef.current = {}
    }
  }, [])

  return (
    <div className={styles.container} aria-live="polite" aria-atomic="true">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`${styles.card} ${styles[n.type]} ${closing[n.id] ? styles.closing : ''}`}
        >
          <div className={styles.message}>{n.message}</div>
          <button
            aria-label="Close"
            className={styles.close}
            onClick={() => startClose(n.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
