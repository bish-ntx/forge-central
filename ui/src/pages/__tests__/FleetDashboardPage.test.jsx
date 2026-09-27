import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import FleetDashboardPage from '../FleetDashboardPage.jsx'

const fleetPayload = {
  sites: [
    {
      site_id: 'amd-lab',
      site_name: 'AMD Lab',
      location: 'Santa Clara, CA',
      status: 'HEALTHY',
      clusters_count: 2,
      vms_count: 12,
      ipam_utilization_pct: 45.0,
      gpu_nodes_count: 4,
      last_seen: '2026-09-26T23:00:00+00:00',
    },
    {
      site_id: 'cirra-lab',
      site_name: 'Cirrascale Lab',
      location: 'San Jose, CA',
      status: 'HEALTHY',
      clusters_count: 1,
      vms_count: 8,
      ipam_utilization_pct: 30.0,
      gpu_nodes_count: 8,
      last_seen: '2026-09-26T23:01:00+00:00',
    },
    {
      site_id: 'ntx-lab',
      site_name: 'Nutanix Durham Lab',
      location: 'Durham, NC',
      status: 'HEALTHY',
      clusters_count: 3,
      vms_count: 16,
      ipam_utilization_pct: 62.5,
      gpu_nodes_count: 2,
      last_seen: '2026-09-26T23:02:00+00:00',
    },
  ],
  total_clusters: 6,
  total_vms: 36,
  total_gpu_nodes: 14,
  hq_sync_status: 'ONLINE',
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => payload,
  })
}

describe('FleetDashboardPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders read-only banner, summary metrics, and seeded site cards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(fleetPayload)))

    render(<FleetDashboardPage />)

    expect(screen.getByTestId('fleet-banner-readonly')).toBeInTheDocument()
    expect(screen.getByTestId('fleet-readonly-badge')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('metric-total-sites')).toHaveTextContent('3'))
    expect(screen.getByTestId('metric-total-clusters')).toHaveTextContent('6')
    expect(screen.getByTestId('metric-total-vms')).toHaveTextContent('36')
    expect(screen.getByTestId('metric-total-gpu')).toHaveTextContent('14')

    expect(screen.getByTestId('site-card-amd-lab')).toBeInTheDocument()
    expect(screen.getByTestId('site-card-cirra-lab')).toBeInTheDocument()
    expect(screen.getByTestId('site-card-ntx-lab')).toBeInTheDocument()
  })

  test('refresh button triggers fleet status reload', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(fleetPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<FleetDashboardPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByTestId('btn-refresh-fleet'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/fleet/status')
  })
})
