import { useEffect, useMemo, useState } from 'react'
import styles from './ThemeToggle.module.css'

export type ThemeMode = 'light' | 'dark'

export type ThemeToggleProps = {
  defaultTheme?: ThemeMode
  theme?: ThemeMode
  onToggle?: (nextTheme: ThemeMode) => void
  className?: string
  id?: string
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="5" fill="currentColor" />
    <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none">
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="6.7" y2="6.7" />
      <line x1="17.3" y1="17.3" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="6.7" y2="17.3" />
      <line x1="17.3" y1="6.7" x2="19.78" y2="4.22" />
    </g>
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M20.75 13.4a8.5 8.5 0 1 1-10.15-10.15 7 7 0 1 0 10.15 10.15z"
      fill="currentColor"
    />
  </svg>
)

export function ThemeToggle({
  defaultTheme = 'dark',
  theme: controlledTheme,
  onToggle,
  className = '',
  id,
}: ThemeToggleProps) {
  const [uncontrolledTheme, setUncontrolledTheme] = useState<ThemeMode>(defaultTheme)

  const isControlled = controlledTheme !== undefined

  useEffect(() => {
    if (!isControlled) {
      setUncontrolledTheme(defaultTheme)
    }
  }, [defaultTheme, isControlled])

  const currentTheme = isControlled ? controlledTheme! : uncontrolledTheme
  const isDark = currentTheme === 'dark'

  const buttonLabel = useMemo(
    () => (isDark ? 'Dark mode enabled. Switch to light mode' : 'Light mode enabled. Switch to dark mode'),
    [isDark]
  )

  const handleToggle = () => {
    const nextTheme: ThemeMode = isDark ? 'light' : 'dark'
    if (!isControlled) {
      setUncontrolledTheme(nextTheme)
    }
    onToggle?.(nextTheme)
  }

  return (
    <button
      type="button"
      id={id}
      className={`${styles.toggle} ${isDark ? styles.toggleDark : ''} ${className}`.trim()}
      role="switch"
      aria-checked={isDark}
      aria-label={buttonLabel}
      onClick={handleToggle}
    >
      <span className={styles.iconSun} aria-hidden="true">
        <SunIcon />
      </span>
      <span className={styles.iconMoon} aria-hidden="true">
        <MoonIcon />
      </span>
      <span className={styles.knob} aria-hidden="true">
        <span className={styles.knobInner} />
      </span>
    </button>
  )
}

export default ThemeToggle
