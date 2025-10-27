import React, { useState } from 'react'

export default function Login({ onLogin, switchToRegister, setStatus }) {
  const [identifier, setIdentifier] = useState('') // username or email
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function isEmail(val) {
    return /@/.test(val)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const payload = isEmail(identifier)
        ? { email: identifier }
        : { username: identifier }

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

      // NOTE: the spec asked to call details first, then getMyExpenses.
      // We don't have a provided "login" endpoint. We proceed to fetch expenses with the returned userId.
      // If your backend requires password verification, add a call to a login/auth endpoint here.

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
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Username or Email
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }}
          />
        </label>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 12px' }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" onClick={switchToRegister} style={{ padding: '8px 12px' }}>
            Register
          </button>
        </div>
      </form>
    </div>
  )
}
