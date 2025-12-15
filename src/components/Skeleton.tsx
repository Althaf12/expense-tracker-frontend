import React, { useEffect, useState } from 'react'
import styles from './Skeleton.module.css'

export default function Skeleton({
  className = '',
  size = 'medium',
  delayMs = 200,
}: {
  className?: string
  size?: 'small' | 'medium' | 'large'
  delayMs?: number
}) {
  const [visible, setVisible] = useState(delayMs === 0)

  useEffect(() => {
    if (delayMs === 0) return
    let mounted = true
    const t = window.setTimeout(() => {
      if (mounted) setVisible(true)
    }, delayMs)
    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [delayMs])

  if (!visible) return null
  return <span className={`${styles.skeleton} ${styles[size]} ${className}`} />
}
