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
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/clusters/nkp-prod-01/reset-nodes', {
        method: 'POST',
        headers: { 'X-Forge-Role': 'operator' },
      }),
    )
  })

  describe('GPU workers', () => {
    const vmsPayload = {
      vms: [
        { vmid: 301, name: 'gpu-wk-01', node: 'pve-03', status: 'running', pci_devices: ['0000:05:00.0'] },
        { vmid: 101, name: 'cp-01', node: 'pve-01', status: 'running', pci_devices: [] },
      ],
    }
    const hardwarePayload = {
      pci_devices: [
        { pci_bdf: '0000:05:00.0', device_type: 'gpu', vendor: 'AMD', assigned_vmid: 301, assigned_vm_name: 'gpu-wk-01' },
        { pci_bdf: '0000:65:00.0', device_type: 'gpu', vendor: 'AMD', assigned_vmid: null, assigned_vm_name: null },
        { pci_bdf: '0000:67:00.0', device_type: 'nic', vendor: 'Pensando', assigned_vmid: null, assigned_vm_name: null },
      ],
      total_gpus: 2,
      total_nics: 1,
    }

    function mockGpuFetch(provisionResponse = { ok: true, json: async () => ({ run_id: 'run-gpu-1' }) }) {
      const fetchMock = vi.fn().mockImplementation((url, options) => {
        const target = String(url)
        if (target === '/api/v1/vms/provision-gpu') return Promise.resolve(provisionResponse)
        if (options?.method) return jsonResponse({})
        if (target === '/api/v1/vms') return jsonResponse(vmsPayload)
        if (target === '/api/v1/vms/hardware/pci') return jsonResponse(hardwarePayload)
        return jsonResponse(target.endsWith('/nodepools') ? nodepoolPayload : detailPayload)
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    test('renders GPU worker status, capacity and Copy as CLI previews', async () => {
      mockGpuFetch()
      renderPage()

      await waitFor(() => expect(screen.getByTestId('row-gpu-worker-301')).toBeInTheDocument())
      expect(screen.getByTestId('section-gpu-workers')).toBeInTheDocument()
      expect(screen.queryByTestId('row-gpu-worker-101')).not.toBeInTheDocument()
      expect(screen.getByTestId('badge-gpu-worker-status-301')).toHaveTextContent('running')
      await waitFor(() => expect(screen.getByTestId('text-gpu-capacity')).toHaveTextContent('1 unassigned GPU'))
      const previews = screen.getByTestId('gpu-cli-previews')
      expect(previews).toHaveTextContent('./forge provision gpu-vms --conf nkp-prod-01-input.ini')
      expect(previews).toHaveTextContent('./forge passthrough attach --vmid <vmid> --device gpu')
    })

    test('Add GPU Worker VM modal provisions with the selected unassigned BDF', async () => {
      const fetchMock = mockGpuFetch()
      renderPage()

      await waitFor(() => expect(screen.getByTestId('text-gpu-capacity')).toHaveTextContent('1 unassigned GPU'))
      fireEvent.click(screen.getByTestId('btn-add-gpu-worker'))
      expect(screen.getByTestId('modal-provision-gpu-vm')).toBeInTheDocument()

      const gpuSelect = screen.getByTestId('select-provision-gpu-bdf')
      expect(gpuSelect).toHaveTextContent('0000:65:00.0')
      expect(gpuSelect).not.toHaveTextContent('0000:05:00.0')
      fireEvent.change(gpuSelect, { target: { value: '0000:65:00.0' } })
      fireEvent.change(screen.getByTestId('select-provision-nic-bdf'), { target: { value: '0000:67:00.0' } })
      fireEvent.change(screen.getByTestId('input-provision-gpu-count'), { target: { value: '2' } })
      fireEvent.click(screen.getByTestId('btn-submit-provision-gpu'))

      await waitFor(() => expect(screen.getByTestId('gpu-provision-notice')).toHaveTextContent('run-gpu-1'))
      const post = fetchMock.mock.calls.find(([url]) => url === '/api/v1/vms/provision-gpu')
      expect(post[1].method).toBe('POST')
      expect(JSON.parse(post[1].body)).toEqual({
        cluster_name: 'nkp-prod-01',
        gpu_worker_count: 2,
        gpu_bdf: '0000:65:00.0',
        nic_bdf: '0000:67:00.0',
      })
      expect(screen.queryByTestId('modal-provision-gpu-vm')).not.toBeInTheDocument()
    })

    test('shows the backend error inside the modal when provisioning fails', async () => {
      mockGpuFetch({ ok: false, json: async () => ({ detail: 'cluster config not found' }) })
      renderPage()

      await waitFor(() => expect(screen.getByTestId('btn-add-gpu-worker')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('btn-add-gpu-worker'))
      fireEvent.click(screen.getByTestId('btn-submit-provision-gpu'))

      await waitFor(() =>
        expect(screen.getByTestId('gpu-provision-modal-error')).toHaveTextContent('cluster config not found'),
      )
      expect(screen.getByTestId('modal-provision-gpu-vm')).toBeInTheDocument()
    })
  })

  test('falls back to seed data when backend is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderPage()

    expect(screen.getByTestId('text-cluster-detail-name')).toHaveTextContent('nkp-prod-01')
    expect(screen.getByTestId('btn-scale-up-worker-pool-1')).toBeInTheDocument()
    expect(screen.getByTestId('badge-node-status-cp-1')).toBeInTheDocument()
  })
})
