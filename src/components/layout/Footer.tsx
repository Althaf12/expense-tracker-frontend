import styles from './Footer.module.css'

export default function Footer(): JSX.Element {
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
