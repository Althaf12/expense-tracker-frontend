import React from 'react'
import { Link } from 'react-router-dom'

export default function Header({ session, onLogout, onProfile }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <div className="brand">
          <Link to="/dashboard">Expense Tracker</Link>
        </div>

        <nav className="header-right">
          {!session ? (
            <Link to="/">Login</Link>
          ) : (
            <div className="profile-area">
              <button className="profile-btn" onClick={onProfile} aria-label="Profile">
                {String(session?.identifier ?? session?.userId).charAt(0).toUpperCase()}
              </button>
              <button className="logout-btn" onClick={onLogout}>Logout</button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
