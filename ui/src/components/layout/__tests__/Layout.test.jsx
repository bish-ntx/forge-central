import React from 'react'
import { afterEach, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../Layout.jsx'
import ClustersPage from '../../../pages/ClustersPage.jsx'
import DiagnosticsPage from '../../../pages/DiagnosticsPage.jsx'
import FleetDashboardPage from '../../../pages/FleetDashboardPage.jsx'
import IpamPage from '../../../pages/IpamPage.jsx'
import PathSettingsPage from '../../../pages/PathSettingsPage.jsx'
import SettingsPage from '../../../pages/SettingsPage.jsx'
import VmListPage from '../../../pages/VmListPage.jsx'

function renderLayout(initialEntry = '/vms') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="vms" element={<VmListPage />} />
          <Route path="clusters" element={<ClustersPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="fleet" element={<FleetDashboardPage />} />
          <Route path="ipam" element={<IpamPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/paths" element={<PathSettingsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  test('renders header badges and sidebar navigation links', () => {
    renderLayout()

    expect(screen.getByTestId('layout-header')).toBeInTheDocument()
    expect(screen.getByTestId('header-mode-badge')).toHaveTextContent(
      'Forge Central Console',
    )
    expect(screen.getByTestId('header-system-health')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-theme-mode')).toBeInTheDocument()
    expect(screen.getByTestId('lab-site-badge')).toBeInTheDocument()
    expect(screen.getByTestId('mode-switcher')).toBeInTheDocument()
    expect(screen.getByTestId('link-vms')).toBeInTheDocument()
    expect(screen.getByTestId('link-clusters')).toBeInTheDocument()
    expect(screen.getByTestId('link-fleet')).toBeInTheDocument()
    expect(screen.getByTestId('link-diagnostics')).toBeInTheDocument()
    expect(screen.getByTestId('link-ipam')).toBeInTheDocument()
    expect(screen.getByTestId('link-settings')).toBeInTheDocument()
    expect(screen.getByTestId('link-settings-paths')).toBeInTheDocument()
  })

  test('routes to each page through sidebar links', () => {
    renderLayout()

    expect(screen.getByTestId('page-vms')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-clusters'))
    expect(screen.getByTestId('page-clusters')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-fleet'))
    expect(screen.getByTestId('page-fleet')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-diagnostics'))
    expect(screen.getByTestId('page-diagnostics')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-ipam'))
    expect(screen.getByTestId('page-ipam')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-settings'))
    expect(screen.getByTestId('page-settings')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-settings-paths'))
    expect(screen.getByTestId('page-path-settings')).toBeInTheDocument()
  })

  test('switches between console and fleet mode badges', () => {
    renderLayout()

    fireEvent.click(screen.getByTestId('mode-fleet'))
    expect(screen.getByTestId('header-mode-badge')).toHaveTextContent(
      'Forge Fleet Dashboard',
    )

    fireEvent.click(screen.getByTestId('mode-console'))
    expect(screen.getByTestId('header-mode-badge')).toHaveTextContent(
      'Forge Central Console',
    )
  })
})

describe('Layout theme engine', () => {
  let systemPrefersDark
  let mediaListeners

  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    systemPrefersDark = false
    mediaListeners = new Set()
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return systemPrefersDark
      },
      addEventListener: (_event, listener) => mediaListeners.add(listener),
      removeEventListener: (_event, listener) => mediaListeners.delete(listener),
    }))
  })

  afterEach(() => {
    document.documentElement.classList.remove('dark')
    delete window.matchMedia
  })

  test('toggle cycles Dark -> Light -> System and updates documentElement dark class', () => {
    renderLayout()
    const toggle = screen.getByTestId('toggle-theme-mode')
    const root = document.documentElement

    expect(screen.getByTestId('app-layout').className).toContain('dark:bg-slate-900')
    expect(toggle).toHaveTextContent('Theme: Dark')
    expect(root.classList.contains('dark')).toBe(true)

    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('Theme: Light')
    expect(root.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('forge_theme_preference')).toBe('light')

    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('Theme: System')
    expect(root.classList.contains('dark')).toBe(false)

    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('Theme: Dark')
    expect(root.classList.contains('dark')).toBe(true)
  })

  test('System mode follows prefers-color-scheme changes', () => {
    window.localStorage.setItem('forge_theme_preference', 'system')
    systemPrefersDark = true
    renderLayout()
    const root = document.documentElement

    expect(root.classList.contains('dark')).toBe(true)

    systemPrefersDark = false
    act(() => mediaListeners.forEach((listener) => listener()))
    expect(root.classList.contains('dark')).toBe(false)

    systemPrefersDark = true
    act(() => mediaListeners.forEach((listener) => listener()))
    expect(root.classList.contains('dark')).toBe(true)
  })
})
