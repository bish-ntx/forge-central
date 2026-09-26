import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../Layout.jsx'
import ClustersPage from '../../../pages/ClustersPage.jsx'
import FleetDashboardPage from '../../../pages/FleetDashboardPage.jsx'
import IpamPage from '../../../pages/IpamPage.jsx'
import SettingsPage from '../../../pages/SettingsPage.jsx'
import VmListPage from '../../../pages/VmListPage.jsx'

function renderLayout(initialEntry = '/vms') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="vms" element={<VmListPage />} />
          <Route path="clusters" element={<ClustersPage />} />
          <Route path="fleet" element={<FleetDashboardPage />} />
          <Route path="ipam" element={<IpamPage />} />
          <Route path="settings" element={<SettingsPage />} />
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
    expect(screen.getByTestId('link-ipam')).toBeInTheDocument()
    expect(screen.getByTestId('link-settings')).toBeInTheDocument()
  })

  test('routes to each page through sidebar links', () => {
    renderLayout()

    expect(screen.getByTestId('page-vms')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-clusters'))
    expect(screen.getByTestId('page-clusters')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-fleet'))
    expect(screen.getByTestId('page-fleet')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-ipam'))
    expect(screen.getByTestId('page-ipam')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('link-settings'))
    expect(screen.getByTestId('page-settings')).toBeInTheDocument()
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
