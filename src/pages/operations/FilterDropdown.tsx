import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
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
  triggerClassName?: string
}

export function FilterDropdown({ value, options, onChange, className, triggerClassName }: Props) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setMenuStyle({
        position: 'fixed',
        top: rect.bottom + 5,
        left: rect.left,
        zIndex: 99999,
        minWidth: rect.width,
      })
    }
    setOpen((prev) => !prev)
  }

  return (
    <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger}${open ? ` ${styles.triggerOpen}` : ''}${triggerClassName ? ` ${triggerClassName}` : ''}`}
        onClick={handleToggle}
      >
        <span>{selected?.triggerLabel ?? selected?.label ?? value}</span>
        <span className={`${styles.arrow}${open ? ` ${styles.arrowOpen}` : ''}`}>▾</span>
      </button>

      {open && ReactDOM.createPortal(
        <ul ref={menuRef} className={styles.menu} role="listbox" style={menuStyle}>
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
        </ul>,
        document.body,
      )}
    </div>
  )
}
