import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword({ setStatus }) {
  const [token, setToken] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [localUsername, setLocalUsername] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const t = params.get('token')
      const u = params.get('username') || params.get('user') || null
      if (t) setToken(t)
      if (u) setLocalUsername(u)
    } catch (e) {}
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(null)
    if (!token) {
      setStatus({ type: 'error', message: 'Token is required to reset password.' })
      return
    }
    if (!newPassword || newPassword.length < 6) {
      setStatus({ type: 'error', message: 'New password must be at least 6 characters.' })
      return
    }
    if (newPassword !== confirm) {
      setStatus({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    setLoading(true)
    try {
      const payload = localUsername ? { token, newPassword, username: localUsername } : { token, newPassword }
      const res = await fetch('http://localhost:8080/api/user/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(`${res.status} ${text || res.statusText}`)
      setStatus({ type: 'success', message: 'Password reset successful. Please login with your new password.' })
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
        <h2>Reset Password</h2>
        {localUsername && <div style={{ marginBottom: 8 }}>Resetting password for <strong>{localUsername}</strong></div>}
        <form onSubmit={handleSubmit}>
          {/* token is read from query and kept hidden to the user */}
          {!token && (
            <div className="form-row">
              <label>Token</label>
              <input className="form-input" type="password" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
          )}

          <div className="form-row">
            <label>Old password (optional)</label>
            <input className="form-input" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
          </div>

          <div className="form-row">
            <label>New password</label>
            <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>

          <div className="form-row">
            <label>Confirm new password</label>
            <input className="form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Resetting...' : 'Reset Password'}</button>
            <button className="btn btn-ghost" type="button" onClick={() => navigate(-1)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}
