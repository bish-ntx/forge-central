import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/layout/Layout.jsx'
import ClusterDeployPage from './pages/ClusterDeployPage.jsx'
import ClusterDetailPage from './pages/ClusterDetailPage.jsx'
import ClustersPage from './pages/ClustersPage.jsx'
import DiagnosticsPage from './pages/DiagnosticsPage.jsx'
import FleetDashboardPage from './pages/FleetDashboardPage.jsx'
import IpamPage from './pages/IpamPage.jsx'
import PathSettingsPage from './pages/PathSettingsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import VmListPage from './pages/VmListPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/vms" replace />} />
        <Route path="vms" element={<VmListPage />} />
        <Route path="clusters" element={<ClustersPage />} />
        <Route path="clusters/deploy" element={<ClusterDeployPage />} />
        <Route path="clusters/:name" element={<ClusterDetailPage />} />
        <Route path="diagnostics" element={<DiagnosticsPage />} />
        <Route path="fleet" element={<FleetDashboardPage />} />
        <Route path="ipam" element={<IpamPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/paths" element={<PathSettingsPage />} />
      </Route>
    </Routes>
  )
}

export default App
