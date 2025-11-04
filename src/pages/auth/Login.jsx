import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login({ onLogin, setStatus }) {
  const [identifier, setIdentifier] = useState('') // username or email
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function isEmail(val) {
    return /@/.test(val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const payload = isEmail(identifier) ? { email: identifier } : { username: identifier }

      // First call: get user details
      const res = await fetch('http://localhost:8080/api/user/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Details request failed: ${res.status} ${text || res.statusText}`)
      }

      const user = await res.json()
      if (!user || (!user.userId && !user.id && !user.user_id)) {
        throw new Error('User not found in response')
      }

      // Normalize userId field
      const userId = user.userId ?? user.id ?? user.user_id

      // Call getMyExpenses to load expenses and complete login flow
      const expRes = await fetch('http://localhost:8080/api/getMyExpenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: String(userId) }),
      })

      if (!expRes.ok) {
        const text = await expRes.text().catch(() => '')
        throw new Error(`Expenses request failed: ${expRes.status} ${text || expRes.statusText}`)
      }

      const expenses = await expRes.json()

      const session = { userId: String(userId), identifier, user }
      localStorage.setItem('session', JSON.stringify(session))
      onLogin(session, expenses)
      navigate('/dashboard')
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Login</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Username or Email</label>
            <input
              className="form-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/register')}>
              Register
            </button>
          </div>
        </form>

        <div style={{ marginTop: 12 }}>
          <button className="link-plain" type="button" onClick={() => navigate('/forgot-password')}>
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  )
}
