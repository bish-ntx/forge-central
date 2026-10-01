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

  test('row checkbox and header select-all toggle selection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockVmPayload)))

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('checkbox-vm-101')).toBeInTheDocument())

    fireEvent.click(screen.getByTestId('checkbox-vm-101'))
    expect(screen.getByTestId('checkbox-vm-101')).toBeChecked()
    expect(screen.getByTestId('checkbox-select-all-vms')).not.toBeChecked()

    fireEvent.click(screen.getByTestId('checkbox-select-all-vms'))
    expect(screen.getByTestId('checkbox-vm-102')).toBeChecked()
    expect(screen.getByTestId('checkbox-select-all-vms')).toBeChecked()

    fireEvent.click(screen.getByTestId('checkbox-select-all-vms'))
    expect(screen.getByTestId('checkbox-vm-101')).not.toBeChecked()
    expect(screen.queryByTestId('batch-action-bar')).not.toBeInTheDocument()
  })

  test('batch action bar appears when VMs are selected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(mockVmPayload)))

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('checkbox-vm-101')).toBeInTheDocument())
    expect(screen.queryByTestId('batch-action-bar')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('checkbox-select-all-vms'))
    expect(screen.getByTestId('batch-action-bar')).toHaveTextContent('2 VMs selected')
  })

  test('triggers batch start and clears selection', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
      .mockImplementationOnce(() => jsonResponse({ run_id: 'abc', status: 'PENDING' }))
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('checkbox-vm-101')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('checkbox-select-all-vms'))
    fireEvent.click(screen.getByTestId('btn-batch-start'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/vms/batch-action', expect.any(Object))
    })
    expect(fetchMock.mock.calls[1][1].body).toBe(
      JSON.stringify({ vmids: [101, 102], action: 'start' }),
    )
    await waitFor(() => {
      expect(screen.queryByTestId('batch-action-bar')).not.toBeInTheDocument()
    })
  })

  test('batch destroy requires typing DESTROY', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
      .mockImplementationOnce(() => jsonResponse({ run_id: 'abc', status: 'PENDING' }))
      .mockImplementationOnce(() => jsonResponse(mockVmPayload))
    vi.stubGlobal('fetch', fetchMock)

    render(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('checkbox-vm-101')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('checkbox-vm-101'))
    fireEvent.click(screen.getByTestId('btn-batch-destroy'))

    expect(screen.getByTestId('modal-confirm-batch-destroy')).toBeInTheDocument()
    expect(screen.getByTestId('banner-safety-snapshot-notice')).toBeInTheDocument()
    expect(screen.getByTestId('btn-confirm-batch-destroy')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-confirm-batch-destroy'), {
      target: { value: 'DESTROY' },
    })
    fireEvent.click(screen.getByTestId('btn-confirm-batch-destroy'))

    await waitFor(() => {
      expect(fetchMock.mock.calls[1][1].body).toBe(
        JSON.stringify({ vmids: [101], action: 'destroy' }),
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('modal-confirm-batch-destroy')).not.toBeInTheDocument()
    })
  })

  describe('PCI hardware inventory', () => {
    const hardwarePayload = {
      pci_devices: [
        {
          pci_bdf: '0000:05:00.0',
          device_type: 'gpu',
          description: 'Instinct MI350P',
          vendor: 'AMD',
          assigned_vmid: 101,
          assigned_vm_name: 'gpu-vm-01',
        },
        {
          pci_bdf: '0000:65:00.0',
          device_type: 'gpu',
          description: 'Instinct MI350P',
          vendor: 'AMD',
          assigned_vmid: null,
          assigned_vm_name: null,
        },
        {
          pci_bdf: '0000:67:00.0',
          device_type: 'nic',
          description: 'Pollara 400',
          vendor: 'Pensando',
          assigned_vmid: null,
          assigned_vm_name: null,
        },
      ],
      total_gpus: 2,
      total_nics: 1,
      discovered_at: '2026-09-30T10:00:00Z',
    }

    function mockHardwareFetch() {
      const fetchMock = vi.fn().mockImplementation((url, options) => {
        if (String(url).endsWith('/hardware/pci')) {
          return jsonResponse(hardwarePayload)
        }
        if (options?.method === 'POST') {
          return jsonResponse({ run_id: 'run-1', status: 'PENDING' })
        }
        return jsonResponse(mockVmPayload)
      })
      vi.stubGlobal('fetch', fetchMock)
      return fetchMock
    }

    async function openInventory() {
      render(<VmListPage />)
      await waitFor(() => expect(screen.getByTestId('row-vm-101')).toBeInTheDocument())
      fireEvent.click(screen.getByTestId('btn-open-hardware-inventory'))
      await waitFor(() => expect(screen.getByTestId('row-pci-0000:05:00.0')).toBeInTheDocument())
    }

    test('opens the PCI hardware drawer with GPUs, NICs and assignment badges', async () => {
      const fetchMock = mockHardwareFetch()
      await openInventory()

      expect(screen.getByTestId('modal-hardware-pci')).toBeInTheDocument()
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/vms/hardware/pci')
      expect(screen.getByTestId('text-total-gpus')).toHaveTextContent('2')
      expect(screen.getByTestId('text-total-nics')).toHaveTextContent('1')
      expect(screen.getByTestId('row-pci-0000:67:00.0')).toHaveTextContent('Pensando')
      expect(screen.getByTestId('badge-pci-assignment-0000:05:00.0')).toHaveTextContent('gpu-vm-01 (101)')
      expect(screen.getByTestId('badge-pci-assignment-0000:65:00.0')).toHaveTextContent('Unassigned')
      expect(screen.getByTestId('btn-detach-pci-0000:05:00.0')).toBeInTheDocument()
      expect(screen.getByTestId('btn-attach-pci-0000:65:00.0')).toBeInTheDocument()

      fireEvent.click(screen.getByTestId('btn-close-hardware-inventory'))
      expect(screen.queryByTestId('modal-hardware-pci')).not.toBeInTheDocument()
    })

    test('attach modal warns when the selected VM is running and requires Stop VM first', async () => {
      const fetchMock = mockHardwareFetch()
      await openInventory()

      fireEvent.click(screen.getByTestId('btn-attach-pci-0000:65:00.0'))
      expect(screen.getByTestId('modal-attach-pci')).toBeInTheDocument()
      expect(screen.getByTestId('select-attach-pci-device')).toHaveValue('0000:65:00.0')

      // VM 101 is running: power-state warning and disabled submit until force-stop is ticked.
      expect(screen.getByTestId('warning-attach-pci-power')).toHaveTextContent('is running')
      expect(screen.getByTestId('btn-submit-attach-pci')).toBeDisabled()
      fireEvent.click(screen.getByTestId('checkbox-attach-force-stop'))
      expect(screen.getByTestId('btn-submit-attach-pci')).not.toBeDisabled()
      expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent(
        './forge passthrough attach --vmid 101 --device gpu --stop',
      )

      fireEvent.click(screen.getByTestId('btn-submit-attach-pci'))
      await waitFor(() => {
        const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
        expect(post[0]).toBe('/api/v1/vms/101/passthrough/attach')
        expect(JSON.parse(post[1].body)).toEqual({
          vmid: 101,
          device_type: 'gpu',
          pci_bdf: '0000:65:00.0',
          force_stop: true,
        })
      })
      await waitFor(() => expect(screen.queryByTestId('modal-attach-pci')).not.toBeInTheDocument())
      expect(screen.getByTestId('pci-hardware-notice')).toHaveTextContent('0000:65:00.0')
    })

    test('attach modal for a stopped VM needs no force-stop and previews the CLI', async () => {
      mockHardwareFetch()
      await openInventory()

      fireEvent.click(screen.getByTestId('btn-attach-pci-0000:67:00.0'))
      fireEvent.change(screen.getByTestId('select-attach-pci-vm'), { target: { value: '102' } })

      expect(screen.getByTestId('warning-attach-pci-power')).toHaveTextContent('while the VM is stopped')
      expect(screen.queryByTestId('checkbox-attach-force-stop')).not.toBeInTheDocument()
      expect(screen.getByTestId('btn-submit-attach-pci')).not.toBeDisabled()
      expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent(
        './forge passthrough attach --vmid 102 --device nic',
      )
    })

    test('shows the backend power-state error when attach is rejected', async () => {
      const fetchMock = vi.fn().mockImplementation((url, options) => {
        if (String(url).endsWith('/hardware/pci')) return jsonResponse(hardwarePayload)
        if (options?.method === 'POST') {
          return Promise.resolve({ ok: false, json: async () => ({ detail: 'VM 102 is running' }) })
        }
        return jsonResponse(mockVmPayload)
      })
      vi.stubGlobal('fetch', fetchMock)
      await openInventory()

      fireEvent.click(screen.getByTestId('btn-attach-pci-0000:67:00.0'))
      fireEvent.change(screen.getByTestId('select-attach-pci-vm'), { target: { value: '102' } })
      fireEvent.click(screen.getByTestId('btn-submit-attach-pci'))

      await waitFor(() => expect(screen.getByTestId('pci-hardware-error')).toHaveTextContent('VM 102 is running'))
      expect(screen.getByTestId('modal-attach-pci')).toBeInTheDocument()
    })

    test('detach posts to the passthrough detach endpoint of the owning VM', async () => {
      const fetchMock = mockHardwareFetch()
      await openInventory()

      fireEvent.click(screen.getByTestId('btn-detach-pci-0000:05:00.0'))
      await waitFor(() => {
        const post = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')
        expect(post[0]).toBe('/api/v1/vms/101/passthrough/detach')
        expect(JSON.parse(post[1].body).pci_bdf).toBe('0000:05:00.0')
      })
    })
  })
})
