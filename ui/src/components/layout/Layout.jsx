import React, { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import CommandPalette from '../common/CommandPalette.jsx'
import Header from './Header.jsx'
import Sidebar from './Sidebar.jsx'

const THEME_STORAGE_KEY = 'forge_theme_preference'
const THEME_CYCLE = ['dark', 'light', 'system']

function resolveSystemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyThemeClass(themeMode) {
  const root = document.documentElement
  const useDark = themeMode === 'dark' || (themeMode === 'system' && resolveSystemPrefersDark())
  root.classList.toggle('dark', useDark)
}

function Layout() {
  const [mode, setMode] = useState('console')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const closePalette = useCallback(() => setPaletteOpen(false), [])
  const [themeMode, setThemeMode] = useState(
    () => window.localStorage.getItem(THEME_STORAGE_KEY) ?? 'dark',
  )

  useEffect(() => {
    if (!THEME_CYCLE.includes(themeMode)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      applyThemeClass('dark')
      return
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    applyThemeClass(themeMode)
  }, [themeMode])

  useEffect(() => {
    if (themeMode !== 'system') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyThemeClass('system')
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [themeMode])

  function toggleMode() {
    setMode((current) => (current === 'console' ? 'fleet' : 'console'))
  }

  function toggleThemeMode() {
    setThemeMode((current) => {
      const index = THEME_CYCLE.indexOf(current)
      const nextIndex = index === -1 ? 0 : (index + 1) % THEME_CYCLE.length
      return THEME_CYCLE[nextIndex]
    })
  }

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100" data-testid="app-layout">
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
      <CommandPalette open={paletteOpen} onOpen={openPalette} onClose={closePalette} />
    </div>
  )
}

export default Layout
