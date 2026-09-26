import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

function Layout() {
  const [mode, setMode] = useState('console')

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100" data-testid="app-layout">
      <Sidebar mode={mode} onModeChange={setMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header mode={mode} />
        <main className="flex-1 p-6" data-testid="layout-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
