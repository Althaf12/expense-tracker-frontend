import React from 'react'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <small>© {new Date().getFullYear()} Expense Tracker</small>
      </div>
    </footer>
  )
}
