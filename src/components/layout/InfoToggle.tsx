import { useMemo } from 'react'
import styles from './InfoToggle.module.css'

export type InfoMode = 'show' | 'hide'

export type InfoToggleProps = {
  mode?: InfoMode
  onToggle?: (nextMode: InfoMode) => void
  className?: string
  id?: string
}

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
)

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

export function InfoToggle({
  mode = 'show',
  onToggle,
  className = '',
  id,
}: InfoToggleProps) {
  const isHidden = mode === 'hide'

  const buttonLabel = useMemo(
    () => (isHidden ? 'Amounts hidden. Click to show amounts' : 'Amounts visible. Click to hide amounts'),
    [isHidden]
  )

  const handleToggle = () => {
    const nextMode: InfoMode = isHidden ? 'show' : 'hide'
    onToggle?.(nextMode)
  }

  return (
    <button
      type="button"
      id={id}
      className={`${styles.toggle} ${isHidden ? styles.toggleHidden : ''} ${className}`.trim()}
      role="switch"
      aria-checked={isHidden}
      aria-label={buttonLabel}
      onClick={handleToggle}
    >
      <span className={styles.iconShow} aria-hidden="true">
        <EyeIcon />
      </span>
      <span className={styles.iconHide} aria-hidden="true">
        <EyeOffIcon />
      </span>
      <span className={styles.knob} aria-hidden="true">
        <span className={styles.knobInner} />
      </span>
    </button>
  )
}

export default InfoToggle
