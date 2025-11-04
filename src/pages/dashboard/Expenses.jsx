import React from 'react'

export default function Expenses({ expenses = [] }) {
  return (
    <div>
      <h2>My Expenses</h2>

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
