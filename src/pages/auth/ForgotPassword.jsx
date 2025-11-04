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
      setStatus({ type: 'success', message: 'If the account exists, a reset token was generated (check your email).' })
      // navigate to reset page; token (if returned) won't be exposed here
      if (data?.token) {
        // include token in URL but encoded (frontend will read it)
        navigate(`/reset-password?token=${encodeURIComponent(data.token)}${isEmail(identifier) ? `&username=${encodeURIComponent(identifier)}` : `&username=${encodeURIComponent(identifier)}`}`)
      } else {
        navigate('/reset-password')
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <h2>Forgot password</h2>
      <p>Enter your username or email and we'll generate a reset token for you.</p>
      <form onSubmit={handleSubmit}>
        <label style={{ display: 'block', marginBottom: 8 }}>
          Username or Email
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required style={{ display: 'block', width: '100%', padding: 8, marginTop: 6 }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading} style={{ padding: '8px 12px' }}>{loading ? 'Sending...' : 'Send reset token'}</button>
          <button type="button" onClick={() => navigate(-1)} style={{ padding: '8px 12px' }}>Back</button>
        </div>
      </form>
    </div>
  )
}
