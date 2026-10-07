import React, { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import useTheme from '../../hooks/useTheme.js'
import LoginGatewayModal from '../auth/LoginGatewayModal.jsx'
import CommandPalette from '../common/CommandPalette.jsx'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

function Layout() {
  const [mode, setMode] = useState('console')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const { themeMode, toggleThemeMode } = useTheme()

  function toggleMode() {
    setMode((current) => (current === 'console' ? 'fleet' : 'console'))
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100" data-testid="app-layout">
      <Sidebar mode={mode} onModeChange={setMode} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          mode={mode}
          onToggleMode={toggleMode}
          themeMode={themeMode}
          onToggleThemeMode={toggleThemeMode}
          onOpenCommandPalette={openPalette}
        />
        <main className="flex-1 p-6" data-testid="layout-main-content">
          <Outlet />
        </main>
      </div>
      <LoginGatewayModal />
      <CommandPalette open={paletteOpen} onOpen={openPalette} onClose={closePalette} />
    </div>
  )
}

export default Layout
