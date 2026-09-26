import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import VmListPage from '../VmListPage.jsx'

const mockVmPayload = {
  vms: [
    {
      vmid: 101,
      name: 'gpu-vm-01',
      node: 'pve-a',
      cores: 8,
      memory_mb: 16384,
      disk_gb: 200,
      status: 'running',
      gpu_passthrough: true,
      pci_devices: ['0000:65:00.0'],
    },
    {
      vmid: 102,
      name: 'db-vm-01',
      node: 'pve-b',
      cores: 4,
      memory_mb: 8192,
      disk_gb: 80,
      status: 'stopped',
      gpu_passthrough: false,
      pci_devices: [],
    },
  ],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => payload,
  })
}

describe('VmListPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders VM table rows from API payload', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)

    await waitFor(() => {
      expect(screen.getByTestId('row-vm-101')).toBeInTheDocument()
    })
    expect(screen.getByTestId('row-vm-102')).toBeInTheDocument()
    expect(screen.getByTestId('btn-vm-start-101')).toBeInTheDocument()
    expect(screen.getByTestId('btn-vm-stop-101')).toBeInTheDocument()
    expect(screen.getByTestId('btn-vm-destroy-101')).toBeInTheDocument()
  })

  test('filters VM table using search input', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('row-vm-101')).toBeInTheDocument())

    fireEvent.change(screen.getByTestId('input-vm-search'), {
      target: { value: 'db-vm-01' },
    })

    expect(screen.queryByTestId('row-vm-101')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-vm-102')).toBeInTheDocument()
  })

  test('opens VM creation modal from toolbar button', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('table-vms')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-open-create-vm-modal'))
    expect(screen.getByTestId('modal-create-vm')).toBeInTheDocument()
  })

  test('triggers VM start action handler', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
      .mockImplementationOnce(() => jsonResponse({ run_id: 'abc', status: 'PENDING' }))
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('btn-vm-start-101')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('btn-vm-start-101'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/vms/101/action', expect.any(Object))
    })
    const actionCall = fetchMock.mock.calls[1]
    expect(actionCall[1].method).toBe('POST')
    expect(actionCall[1].body).toBe(JSON.stringify({ action: 'start' }))
  })
})
