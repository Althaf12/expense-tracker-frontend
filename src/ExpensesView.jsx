import React, { useState } from 'react'

export default function ExpensesView({ initialExpenses = [], session, onLogout }) {
  const [expenses, setExpenses] = useState(initialExpenses || [])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>My Expenses</h2>
        <div>
          <span style={{ marginRight: 12, color: '#444' }}>Signed in: {session?.identifier ?? session?.userId}</span>
          <button onClick={() => { localStorage.removeItem('session'); onLogout(); }} style={{ padding: '6px 10px' }}>
            Logout
          </button>
        </div>
      </div>

      {expenses.length === 0 ? (
        <p>No expenses found.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Name</th>
              <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '8px' }}>Amount</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '8px' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.expensesId ?? `${e.expenseDate}-${e.expenseName}-${Math.random()}`}>
                <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{e.expenseName ?? '-'}</td>
                <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', textAlign: 'right' }}>
                  {typeof e.expenseAmount === 'number' ? e.expenseAmount.toFixed(2) : (e.expenseAmount ?? '-')}
                </td>
                <td style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>{e.expenseDate ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
