import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Register({ setStatus }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8080/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Register failed: ${res.status} ${text || res.statusText}`)
      }

      setStatus({ type: 'success', message: 'Registration successful — you can now log in.' })
      navigate('/')
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Register</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Username</label>
            <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          <div className="form-row">
            <label>Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="form-row">
            <label>Password</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Registering...' : 'Register'}</button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/')}>Back to Login</button>
          </div>
        </form>
      </div>
    </div>
  )
}
