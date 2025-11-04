import React from 'react'

export default function Profile({ session, onRequestReset }) {
  const user = session?.user || {}
  const username = user.username ?? user.userName ?? session?.identifier ?? ''
  const email = user.email ?? ''

  return (
    <div style={{ maxWidth: 640 }}>
      <h2>Profile</h2>
      <div style={{ marginBottom: 12 }}>
        <div><strong>Username:</strong> {username}</div>
        <div><strong>Email:</strong> {email || '-'}</div>
      </div>
      <div>
        <button onClick={() => onRequestReset?.(username)} style={{ padding: '8px 12px' }}>Reset password</button>
      </div>
    </div>
  )
}
