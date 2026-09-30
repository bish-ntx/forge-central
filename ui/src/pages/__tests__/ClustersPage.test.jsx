import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ClustersPage from '../ClustersPage.jsx'

const mockClusterPayload = {
  clusters: [
    {
      name: 'nkp-prod-01',
      status: 'ready',
      kubernetes_version: 'v1.31.1',
      desired_nodes: 6,
      ready_nodes: 6,
      metallb: { vip_range: '10.10.40.100-10.10.40.120', address_pool: 'prod-pool' },
    },
    {
      name: 'nkp-stage-01',
      status: 'deploying',
      kubernetes_version: 'v1.31.1',
      desired_nodes: 5,
      ready_nodes: 3,
      metallb: { vip_range: '10.10.41.100-10.10.41.120', address_pool: 'stage-pool' },
    },
  ],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => payload,
  })
}

function renderWithRoutes() {
  return render(
    <MemoryRouter initialEntries={['/clusters']}>
      <Routes>
        <Route path="/clusters" element={<ClustersPage />} />
        <Route path="/clusters/deploy" element={<div data-testid="page-clusters-deploy">Deploy Wizard</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClustersPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders cluster cards from API payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()

    await waitFor(() => {
      expect(screen.getByTestId('cluster-card-nkp-prod-01')).toBeInTheDocument()
    })
    expect(screen.getByTestId('cluster-card-nkp-stage-01')).toBeInTheDocument()
    expect(screen.getAllByText('Ready 6/6 nodes').length).toBeGreaterThan(0)
  })

  test('filters clusters using search input', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('row-cluster-nkp-prod-01')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-cluster-search'), {
      target: { value: 'stage' },
    })

    expect(screen.queryByTestId('row-cluster-nkp-prod-01')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-cluster-nkp-stage-01')).toBeInTheDocument()
  })

  test('opens typed confirmation modal from cluster delete action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('btn-cluster-delete-nkp-prod-01')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-cluster-delete-nkp-prod-01'))

    expect(screen.getByTestId('modal-confirm-cluster-delete')).toBeInTheDocument()
    expect(screen.getByTestId('btn-confirm-cluster-delete')).toBeDisabled()
  })

  test('opens add nodepool modal and submits nodepool request', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload))
    vi.stubGlobal('fetch', fetchMock)

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('btn-add-nodepool-nkp-prod-01')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-add-nodepool-nkp-prod-01'))
    expect(screen.getByTestId('modal-add-nodepool')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('input-nodepool-name'), { target: { value: 'gpu-pool' } })
    fireEvent.change(screen.getByTestId('input-nodepool-replicas'), { target: { value: '2' } })
    fireEvent.change(screen.getByTestId('select-nodepool-hypervisor'), { target: { value: 'ahv' } })
    fireEvent.click(screen.getByTestId('btn-submit-add-nodepool'))

    await waitFor(() => expect(screen.queryByTestId('modal-add-nodepool')).not.toBeInTheDocument())
    const postCall = fetchMock.mock.calls.find(([url]) => url === '/api/v1/clusters/nkp-prod-01/nodepools')
    expect(JSON.parse(postCall[1].body)).toEqual({
      nodepool_name: 'gpu-pool',
      replicas: 2,
      hypervisor_type: 'ahv',
    })
  })

  test('add nodepool modal can be cancelled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('btn-add-nodepool-nkp-prod-01')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('btn-add-nodepool-nkp-prod-01'))
    fireEvent.click(screen.getByTestId('btn-cancel-add-nodepool'))

    expect(screen.queryByTestId('modal-add-nodepool')).not.toBeInTheDocument()
  })

  test('reset nodes modal requires typing RESET before confirming', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload))
    vi.stubGlobal('fetch', fetchMock)

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('btn-reset-nodes-nkp-prod-01')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-reset-nodes-nkp-prod-01'))
    expect(screen.getByTestId('modal-confirm-reset-nodes')).toBeInTheDocument()
    expect(screen.getByTestId('btn-confirm-reset-nodes')).toBeDisabled()

    fireEvent.change(screen.getByTestId('input-confirm-reset-nodes'), { target: { value: 'RESET' } })
    expect(screen.getByTestId('btn-confirm-reset-nodes')).toBeEnabled()
    fireEvent.click(screen.getByTestId('btn-confirm-reset-nodes'))

    await waitFor(() => expect(screen.queryByTestId('modal-confirm-reset-nodes')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/clusters/nkp-prod-01/reset-nodes', { method: 'POST' })
  })

  test('cluster name links navigate to detail route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()
    await waitFor(() => expect(screen.getAllByTestId('link-cluster-detail-nkp-prod-01').length).toBe(2))

    expect(screen.getAllByTestId('link-cluster-detail-nkp-prod-01')[0]).toHaveAttribute(
      'href',
      '/clusters/nkp-prod-01',
    )
  })

  test('opens deploy wizard route from primary button', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockClusterPayload)))

    renderWithRoutes()
    await waitFor(() => expect(screen.getByTestId('btn-open-deploy-cluster')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-open-deploy-cluster'))

    expect(screen.getByTestId('page-clusters-deploy')).toBeInTheDocument()
  })
})
