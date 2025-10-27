import React, { useEffect, useState } from "react";
import Login from './Login'
import Register from './Register'
import ExpensesView from './ExpensesView'

// App now handles simple session routing between Login / Register / ExpensesView
export default function App() {
    const [view, setView] = useState('login') // 'login' | 'register' | 'expenses'
    const [session, setSession] = useState(null)
    const [expenses, setExpenses] = useState([])
    const [status, setStatus] = useState(null)

    useEffect(() => {
        // restore session from localStorage
        try {
            const raw = localStorage.getItem('session')
            if (raw) {
                const s = JSON.parse(raw)
                setSession(s)
                // optionally fetch expenses again
                if (s?.userId) fetchExpensesForUser(s.userId)
                setView('expenses')
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
        setView('expenses')
        setStatus(null)
    }

    function handleLogout() {
        setSession(null)
        setExpenses([])
        setView('login')
        setStatus(null)
    }

    return (
        <div className="container">
            <h1>Expense Tracker</h1>

            {status?.type === 'error' && <div className="error">{status.message}</div>}
            {status?.type === 'success' && <div style={{ background: '#ecfdf5', padding: 8, borderRadius: 6 }}>{status.message}</div>}

            {view === 'login' && (
                <Login
                    onLogin={handleLogin}
                    switchToRegister={() => { setView('register'); setStatus(null) }}
                    setStatus={setStatus}
                />
            )}

            {view === 'register' && (
                <Register switchToLogin={() => { setView('login'); setStatus(null) }} setStatus={setStatus} />
            )}

            {view === 'expenses' && session && (
                <ExpensesView initialExpenses={expenses} session={session} onLogout={handleLogout} />
            )}
        </div>
    )
}