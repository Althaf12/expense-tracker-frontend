import React from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import Footer from './Footer'

export default function Layout({ session, onLogout, onProfile }) {
  return (
    <div className="app-root">
      <Header session={session} onLogout={onLogout} onProfile={onProfile} />
      <div className="layout-body">
        <Sidebar />
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  )
}
