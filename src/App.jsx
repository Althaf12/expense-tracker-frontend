import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'
import Expenses from './pages/dashboard/Expenses'
import Profile from './pages/profile/Profile'

export default function App() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [status, setStatus] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('session')
      if (raw) {
        const s = JSON.parse(raw)
        setSession(s)
        if (s?.userId) fetchExpensesForUser(s.userId)
        navigate('/dashboard')
      }
    } catch (e) {
      // ignore
    }
  }, [])

  async function fetchExpensesForUser(userId) {
    setStatus({ type: 'loading', message: 'Loading expenses...' })
    try {
      const res = await fetch('http://localhost:8080/api/getMyExpenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: String(userId) }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Expenses request failed: ${res.status} ${text || res.statusText}`)
      }
      const data = await res.json()
      setExpenses(Array.isArray(data) ? data : [])
      setStatus(null)
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    }
  }

  function handleLogin(sessionData, initialExpenses = []) {
    setSession(sessionData)
    setExpenses(initialExpenses || [])
    localStorage.setItem('session', JSON.stringify(sessionData))
    navigate('/dashboard')
  }

  function handleLogout() {
    setSession(null)
    setExpenses([])
    localStorage.removeItem('session')
    navigate('/')
  }

  async function handleGenerateTokenForUser(usernameOrEmail) {
    setStatus({ type: 'loading', message: 'Generating reset token...' })
    try {
      const isEmail = /@/.test(usernameOrEmail)
      const payload = isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail }
      const res = await fetch('http://localhost:8080/api/user/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const text = await res.text().catch(() => '')
      if (!res.ok) throw new Error(`${res.status} ${text || res.statusText}`)
      let data
      try {
        data = JSON.parse(text)
      } catch (e) {
        data = null
      }
      if (data && data.token) {
        setStatus({ type: 'success', message: 'Token generated. Proceed to reset password.' })
        navigate(`/reset-password?token=${encodeURIComponent(data.token)}&username=${encodeURIComponent(usernameOrEmail)}`)
      } else {
        setStatus({ type: 'success', message: 'If the account exists, a token was generated (check email).' })
        navigate('/reset-password')
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || String(err) })
    }
  }

  return (
    <div>
      {status?.type === 'error' && <div className="error">{status.message}</div>}
      {status?.type === 'success' && <div style={{ background: '#ecfdf5', padding: 8, borderRadius: 6 }}>{status.message}</div>}

      <Routes>
        <Route
          path="/"
          element={session ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} setStatus={setStatus} />}
        />
        <Route path="/register" element={<Register setStatus={setStatus} />} />
        <Route path="/forgot-password" element={<ForgotPassword setStatus={setStatus} />} />
        <Route path="/reset-password" element={<ResetPassword setStatus={setStatus} />} />

        <Route element={<Layout session={session} onLogout={handleLogout} onProfile={() => navigate('/profile')} />}>
          <Route path="/dashboard" element={<Expenses expenses={expenses} />} />
          <Route path="/profile" element={<Profile session={session} onRequestReset={handleGenerateTokenForUser} />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
