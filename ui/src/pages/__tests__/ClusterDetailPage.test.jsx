import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ClusterDetailPage from '../ClusterDetailPage.jsx'

const detailPayload = {
  cluster: {
    name: 'nkp-prod-01',
    status: 'ready',
    kubernetes_version: 'v1.31.1',
    desired_nodes: 4,
    ready_nodes: 3,
    metallb: { vip_range: '10.10.40.100-10.10.40.120', address_pool: 'prod-pool' },
  },
  nodes: [
    { name: 'prod-cp-1', role: 'control-plane', status: 'ready' },
    { name: 'prod-w-1', role: 'worker', status: 'notready' },
  ],
}
const nodepoolPayload = {
  nodepools: [{ name: 'gpu-pool', replicas: 2, hypervisor_type: 'ahv', status: 'ready' }],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

function mockFetch() {
  const fetchMock = vi.fn().mockImplementation((url, options) => {
    if (options?.method) {
      return jsonResponse({})
    }
    return jsonResponse(String(url).endsWith('/nodepools') ? nodepoolPayload : detailPayload)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/clusters/nkp-prod-01']}>
      <Routes>
        <Route path="/clusters" element={<div data-testid="page-clusters">Clusters</div>} />
        <Route path="/clusters/:name" element={<ClusterDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClusterDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders cluster details, nodes and nodepools', async () => {
    mockFetch()
    renderPage()

    await waitFor(() => expect(screen.getByTestId('badge-node-status-prod-cp-1')).toBeInTheDocument())
    expect(screen.getByTestId('page-cluster-detail')).toBeInTheDocument()
    expect(screen.getByTestId('text-cluster-detail-name')).toHaveTextContent('nkp-prod-01')
    expect(screen.getByTestId('badge-cluster-detail-status')).toHaveTextContent('ready')
    expect(screen.getByTestId('text-cluster-detail-metallb')).toHaveTextContent('10.10.40.100-10.10.40.120')
    expect(screen.getByTestId('table-cluster-nodes')).toHaveTextContent('control-plane')
    expect(screen.getByTestId('badge-node-status-prod-w-1')).toHaveTextContent('notready')
    await waitFor(() => expect(screen.getByTestId('text-replicas-gpu-pool')).toHaveTextContent('2'))
    expect(screen.getByTestId('section-nodepools')).toBeInTheDocument()
  })

  test('scale buttons post updated replicas and update count', async () => {
    const fetchMock = mockFetch()
    renderPage()

    await waitFor(() => expect(screen.getByTestId('btn-scale-up-gpu-pool')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-scale-up-gpu-pool'))

    await waitFor(() => expect(screen.getByTestId('text-replicas-gpu-pool')).toHaveTextContent('3'))
    const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
    expect(postCall[0]).toBe('/api/v1/clusters/nkp-prod-01/nodepools')
    expect(JSON.parse(postCall[1].body).replicas).toBe(3)

    fireEvent.click(screen.getByTestId('btn-scale-down-gpu-pool'))
    await waitFor(() => expect(screen.getByTestId('text-replicas-gpu-pool')).toHaveTextContent('2'))
  })

  test('action buttons are present and reset requires RESET', async () => {
    const fetchMock = mockFetch()
    renderPage()

    await waitFor(() => expect(screen.getByTestId('btn-detail-add-nodepool')).toBeInTheDocument())
    expect(screen.getByTestId('btn-back-clusters')).toHaveAttribute('href', '/clusters')
    expect(screen.getByTestId('btn-detail-delete-cluster')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-detail-delete-cluster'))
    expect(screen.getByTestId('panel-detail-delete-cluster')).toContainElement(
      screen.getByTestId('banner-safety-snapshot-notice'),
    )

    fireEvent.click(screen.getByTestId('btn-detail-reset-nodes'))
    expect(screen.getByTestId('banner-safety-snapshot-notice')).toBeInTheDocument()
    expect(screen.getByTestId('btn-detail-confirm-reset')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-detail-confirm-reset'), { target: { value: 'RESET' } })
    fireEvent.click(screen.getByTestId('btn-detail-confirm-reset'))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/clusters/nkp-prod-01/reset-nodes', { method: 'POST' }),
    )
  })

  test('falls back to seed data when backend is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderPage()

    expect(screen.getByTestId('text-cluster-detail-name')).toHaveTextContent('nkp-prod-01')
    expect(screen.getByTestId('btn-scale-up-worker-pool-1')).toBeInTheDocument()
    expect(screen.getByTestId('badge-node-status-cp-1')).toBeInTheDocument()
  })
})
