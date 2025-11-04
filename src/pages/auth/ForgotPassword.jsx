import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ForgotPassword({ setStatus }) {
  const [identifier, setIdentifier] = useState('')
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
      const res = await fetch('http://localhost:8080/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) {
        throw new Error(`${res.status} ${text || res.statusText}`)
      }
      let data
      try { data = JSON.parse(text) } catch (e) { data = null }
      // do not display token here for security; token may be emailed instead
      // Inform the user to check their email and do not redirect.
      setStatus({ type: 'success', message: 'If the account exists, a reset token was generated — check your email for the reset link.' })
      // Do not navigate; the user should click the link sent by email to reach the reset page.
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>Forgot password</h2>
        <p>Enter your username or email and we'll generate a reset token for you.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>Username or Email</label>
            <input className="form-input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset token'}</button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate(-1)}>Back</button>
          </div>
        </form>
      </div>
    </div>
  )
}
