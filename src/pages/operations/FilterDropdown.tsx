import { useState, useRef, useEffect } from 'react'
import styles from './FilterDropdown.module.css'

export interface FilterDropdownOption {
  value: string
  /** Text shown in the open dropdown list */
  label: string
  /** Text shown on the trigger when this option is selected. Falls back to label. */
  triggerLabel?: string
}

interface Props {
  value: string
  options: FilterDropdownOption[]
  onChange: (value: string) => void
  className?: string
}

export function FilterDropdown({ value, options, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  return (
    <div ref={rootRef} className={`${styles.root}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{selected?.triggerLabel ?? selected?.label ?? value}</span>
        <span className={`${styles.arrow}${open ? ` ${styles.arrowOpen}` : ''}`}>▾</span>
      </button>

      {open && (
        <ul className={styles.menu} role="listbox">
          {options.map((opt) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`${styles.item}${opt.value === value ? ` ${styles.itemActive}` : ''}`}
              onMouseDown={() => {
                onChange(opt.value)
                setOpen(false)
              }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
