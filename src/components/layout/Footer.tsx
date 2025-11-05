import styles from './Footer.module.css'
import type { ReactElement } from 'react'

export default function Footer(): ReactElement {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <small>
          {'\u00A9 '}
          {new Date().getFullYear()} Expense Tracker
        </small>
      </div>
    </footer>
  )
}
