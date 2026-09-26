import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ClusterDeployPage from '../ClusterDeployPage.jsx'

vi.mock('../../hooks/useEventSource.js', () => ({
  default: () => ({
    events: [
      {
        event: 'log',
        data: {
          timestamp: '2026-09-26T22:40:00Z',
          line: '[01-konvoy] Bootstrapping cluster nodes...',
          stream: 'stdout',
        },
      },
    ],
    endEvent: null,
    connectionState: 'open',
    reconnectCount: 0,
  }),
}))

function jsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => payload,
  })
}

function renderDeployWizard() {
  return render(
    <MemoryRouter initialEntries={['/clusters/deploy']}>
      <Routes>
        <Route path="/clusters/deploy" element={<ClusterDeployPage />} />
        <Route path="/clusters" element={<div data-testid="page-clusters">Clusters List</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClusterDeployPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders Stage 1 by default with wizard locators', () => {
    renderDeployWizard()

    expect(screen.getByTestId('page-clusters-deploy')).toBeInTheDocument()
    expect(screen.getByTestId('stage-1-container')).toBeInTheDocument()
    expect(screen.getByTestId('input-cluster-name')).toHaveValue('nkp-prod-01')
    expect(screen.getByTestId('select-hypervisor')).toHaveValue('proxmox')
    expect(screen.getByTestId('input-k8s-version')).toHaveValue('v1.31.1')
    expect(screen.getByTestId('btn-wizard-back')).toBeDisabled()
    expect(screen.getByTestId('btn-wizard-next')).toBeInTheDocument()
  })

  test('navigates forward and backward through steps while preserving form state', () => {
    renderDeployWizard()

    // Modify cluster name in Stage 1
    fireEvent.change(screen.getByTestId('input-cluster-name'), {
      target: { value: 'nkp-custom-cluster' },
    })
    expect(screen.getByTestId('input-cluster-name')).toHaveValue('nkp-custom-cluster')

    // Navigate to Stage 2
    fireEvent.click(screen.getByTestId('btn-wizard-next'))
    expect(screen.getByTestId('stage-2-container')).toBeInTheDocument()

    // Navigate back to Stage 1
    fireEvent.click(screen.getByTestId('btn-wizard-back'))
    expect(screen.getByTestId('stage-1-container')).toBeInTheDocument()

    // Verify form state retention
    expect(screen.getByTestId('input-cluster-name')).toHaveValue('nkp-custom-cluster')
  })

  test('renders Stage 2 node topology and pre-flight inventory inspection', () => {
    renderDeployWizard()

    // Navigate to Stage 2
    fireEvent.click(screen.getByTestId('btn-wizard-next'))

    expect(screen.getByTestId('input-control-plane-count')).toHaveValue(3)
    expect(screen.getByTestId('input-worker-count')).toHaveValue(3)
    expect(screen.getByTestId('select-inventory-file')).toHaveValue('inventory-lab-01.yaml')

    expect(screen.getByTestId('inventory-inspection-card')).toBeInTheDocument()
    expect(screen.getByTestId('preflight-status-checks')).toBeInTheDocument()
    expect(screen.getByTestId('inventory-yaml-preview')).toBeInTheDocument()
  })

  test('renders Stage 3 networking inputs and Stage 4 storage toggles', () => {
    renderDeployWizard()

    // Move to Stage 2
    fireEvent.click(screen.getByTestId('btn-wizard-next'))
    // Move to Stage 3
    fireEvent.click(screen.getByTestId('btn-wizard-next'))

    expect(screen.getByTestId('stage-3-container')).toBeInTheDocument()
    expect(screen.getByTestId('input-metallb-range')).toHaveValue('10.10.40.100-10.10.40.120')
    expect(screen.getByTestId('input-cp-vip')).toHaveValue('10.10.40.99')

    // Move to Stage 4
    fireEvent.click(screen.getByTestId('btn-wizard-next'))

    expect(screen.getByTestId('stage-4-container')).toBeInTheDocument()
    expect(screen.getByTestId('toggle-csi')).toBeChecked()
    expect(screen.getByTestId('toggle-kommander')).toBeChecked()
    expect(screen.getByTestId('btn-wizard-launch')).toBeInTheDocument()
  })

  test('triggers deployment pipeline launch and renders LiveTerminal in Stage 5', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({
        run_id: '12345678-abcd-ef01-2345-6789abcdef01',
        status: 'PENDING',
        command: 'forge',
        started_at: '2026-09-26T22:40:00Z',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderDeployWizard()

    // Navigate Stage 1 -> Stage 2 -> Stage 3 -> Stage 4
    fireEvent.click(screen.getByTestId('btn-wizard-next'))
    fireEvent.click(screen.getByTestId('btn-wizard-next'))
    fireEvent.click(screen.getByTestId('btn-wizard-next'))

    expect(screen.getByTestId('stage-4-container')).toBeInTheDocument()

    // Click Launch Deployment
    fireEvent.click(screen.getByTestId('btn-wizard-launch'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/clusters/create',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    const callBody = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(callBody.cluster_name).toBe('nkp-prod-01')
    expect(callBody.hypervisor_type).toBe('proxmox')
    expect(callBody.control_plane_nodes).toBe(3)
    expect(callBody.worker_nodes).toBe(3)

    // Verify transition to Stage 5 with LiveTerminal
    await waitFor(() => {
      expect(screen.getByTestId('stage-5-container')).toBeInTheDocument()
    })
    expect(screen.getByTestId('terminal-live-logs')).toBeInTheDocument()
    expect(screen.getByTestId('text-run-id')).toHaveTextContent('12345678-abcd-ef01-2345-6789abcdef01')
  })

  test('navigates back to clusters list via back header button', () => {
    renderDeployWizard()

    fireEvent.click(screen.getByTestId('btn-back-to-clusters'))
    expect(screen.getByTestId('page-clusters')).toBeInTheDocument()
  })
})
