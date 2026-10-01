import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import IpamPage from '../IpamPage.jsx'
import { ROLE_STORAGE_KEY, RoleProvider } from '../../context/RoleContext.jsx'

function makeLedger(overrides = {}) {
  return {
    total_slots: 6,
    allocated_slots: 5,
    free_slots: 1,
    ip_pool: '10.0.0.10-10.0.0.40',
    updated_at: '2026-09-30T20:00:00Z',
    slots: [
      { ip: '10.0.0.10', status: 'gateway', cluster: null, vmid: null, hostname: 'lab-gateway', role: 'gateway' },
      { ip: '10.0.0.11', status: 'vip', cluster: 'amd-nkp1', vmid: null, hostname: null, role: 'control-plane-vip' },
      { ip: '10.0.0.12', status: 'allocated', cluster: 'amd-nkp1', vmid: 1001, hostname: 'amd-nkp1-cp-01', role: 'control-plane' },
      { ip: '10.0.0.21', status: 'vip', cluster: 'cirra-nkp1', vmid: null, hostname: null, role: 'control-plane-vip' },
      { ip: '10.0.0.22', status: 'allocated', cluster: 'cirra-nkp1', vmid: 1101, hostname: 'cirra-nkp1-cp-01', role: 'control-plane' },
      { ip: '10.0.0.30', status: 'free', cluster: null, vmid: null, hostname: null, role: null },
    ],
    ...overrides,
  }
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

function mockApi(handlers = {}) {
  const fetchMock = vi.fn().mockImplementation((url, options) => {
    if (handlers[url]) return handlers[url](options)
    return jsonResponse(makeLedger())
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPage(role = 'operator') {
  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
  return render(
    <RoleProvider>
      <IpamPage />
    </RoleProvider>,
  )
}

describe('IpamPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  test('renders KPI cards and the ledger table with status badges', async () => {
    mockApi()
    renderPage()

    await screen.findByTestId('row-ipam-10.0.0.11')
    expect(screen.getByTestId('card-ipam-total')).toHaveTextContent('6')
    expect(screen.getByTestId('card-ipam-allocated')).toHaveTextContent('5')
    expect(screen.getByTestId('card-ipam-free')).toHaveTextContent('1')
    expect(screen.getByTestId('text-ipam-pool')).toHaveTextContent('10.0.0.10-10.0.0.40')

    const table = screen.getByTestId('table-ipam')
    expect(within(table).getAllByRole('row')).toHaveLength(7) // header + 6 slots
    expect(within(screen.getByTestId('row-ipam-10.0.0.10')).getByText('GATEWAY')).toBeInTheDocument()
    expect(within(screen.getByTestId('row-ipam-10.0.0.11')).getByText('VIP')).toBeInTheDocument()
    expect(within(screen.getByTestId('row-ipam-10.0.0.12')).getByText('ALLOCATED')).toBeInTheDocument()
    expect(within(screen.getByTestId('row-ipam-10.0.0.30')).getByText('FREE')).toBeInTheDocument()
    expect(screen.getByTestId('row-ipam-10.0.0.12')).toHaveTextContent('amd-nkp1-cp-01')
    expect(screen.getByTestId('row-ipam-10.0.0.12')).toHaveTextContent('1001')
  })

  test('shows Copy as CLI snippets for ipam list and free', async () => {
    mockApi()
    renderPage()
    await screen.findByTestId('table-ipam')

    const snippets = screen.getAllByTestId('card-cli-snippet')
    expect(snippets.map((s) => s.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('./forge ipam list'), expect.stringContaining('./forge ipam free')]),
    )
  })

  test('filters rows by search text and status', async () => {
    mockApi()
    renderPage()
    await screen.findByTestId('row-ipam-10.0.0.11')

    fireEvent.change(screen.getByTestId('input-ipam-search'), { target: { value: 'cirra' } })
    expect(screen.queryByTestId('row-ipam-10.0.0.11')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-ipam-10.0.0.21')).toBeInTheDocument()
    expect(screen.getByTestId('row-ipam-10.0.0.22')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('input-ipam-search'), { target: { value: '10.0.0.30' } })
    expect(screen.getAllByTestId(/^row-ipam-/)).toHaveLength(1)

    fireEvent.change(screen.getByTestId('input-ipam-search'), { target: { value: '' } })
    fireEvent.change(screen.getByTestId('select-ipam-status'), { target: { value: 'free' } })
    expect(screen.getAllByTestId(/^row-ipam-/)).toHaveLength(1)
    expect(screen.getByTestId('row-ipam-10.0.0.30')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('select-ipam-status'), { target: { value: 'allocated' } })
    expect(screen.getAllByTestId(/^row-ipam-/)).toHaveLength(2)

    fireEvent.change(screen.getByTestId('input-ipam-search'), { target: { value: 'nothing-matches' } })
    expect(screen.getByTestId('text-ipam-empty')).toBeInTheDocument()
  })

  test('release requires typing RELEASE, then posts the cluster and refreshes', async () => {
    const afterRelease = makeLedger({
      allocated_slots: 3,
      free_slots: 3,
      slots: makeLedger().slots.filter((s) => s.cluster !== 'amd-nkp1'),
    })
    let released = false
    const fetchMock = mockApi({
      '/api/v1/ipam': () => jsonResponse(released ? afterRelease : makeLedger()),
      '/api/v1/ipam/release': () => {
        released = true
        return jsonResponse({ released_count: 2, cluster_name: 'amd-nkp1', status: 'released' })
      },
    })
    renderPage('admin')
    await screen.findByTestId('row-ipam-10.0.0.11')

    expect(screen.getAllByTestId(/^btn-release-/)).toHaveLength(2) // one per cluster
    fireEvent.click(screen.getByTestId('btn-release-amd-nkp1'))
    expect(screen.getByTestId('modal-confirm-release')).toHaveTextContent('amd-nkp1')

    const confirm = screen.getByTestId('btn-confirm-release')
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-confirm-release'), { target: { value: 'release' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-confirm-release'), { target: { value: 'RELEASE' } })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => expect(screen.queryByTestId('modal-confirm-release')).not.toBeInTheDocument())
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/v1/ipam/release')
    expect(call[1].method).toBe('POST')
    expect(JSON.parse(call[1].body)).toEqual({ cluster_name: 'amd-nkp1' })
    expect(call[1].headers['X-Forge-Role']).toBe('admin')
    expect(await screen.findByTestId('alert-ipam-result')).toHaveTextContent('Released 2 IP slot(s) held by amd-nkp1')
    await waitFor(() => expect(screen.queryByTestId('row-ipam-10.0.0.11')).not.toBeInTheDocument())
    expect(screen.getByTestId('card-ipam-free')).toHaveTextContent('3')
  })

  test('cancelling the release modal sends nothing', async () => {
    const fetchMock = mockApi()
    renderPage()
    await screen.findByTestId('row-ipam-10.0.0.11')

    fireEvent.click(screen.getByTestId('btn-release-cirra-nkp1'))
    fireEvent.click(screen.getByTestId('btn-close-release-modal'))

    expect(screen.queryByTestId('modal-confirm-release')).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/v1/ipam/release')).toBe(false)
  })

  test('surfaces a backend release error and keeps the modal open', async () => {
    mockApi({
      '/api/v1/ipam/release': () => jsonResponse({ detail: 'no IPAM reservation found' }, false),
    })
    renderPage()
    await screen.findByTestId('row-ipam-10.0.0.11')

    fireEvent.click(screen.getByTestId('btn-release-amd-nkp1'))
    fireEvent.change(screen.getByTestId('input-confirm-release'), { target: { value: 'RELEASE' } })
    fireEvent.click(screen.getByTestId('btn-confirm-release'))

    expect(await screen.findByTestId('text-ipam-error')).toHaveTextContent('no IPAM reservation found')
    expect(screen.getByTestId('modal-confirm-release')).toBeInTheDocument()
  })

  test('Reconcile VMIDs shows the drift report', async () => {
    const fetchMock = mockApi({
      '/api/v1/ipam/reconcile': () =>
        jsonResponse({
          discrepancies_found: 2,
          status: 'drift-detected',
          details: [
            { type: 'claimed-but-not-live', vmid: 1004 },
            { type: 'live-but-not-claimed', vmid: 1201, hostname: 'orphan-vm-01' },
          ],
        }),
    })
    renderPage()
    await screen.findByTestId('row-ipam-10.0.0.11')

    fireEvent.click(screen.getByTestId('btn-reconcile-ipam'))

    expect(await screen.findByTestId('text-reconcile-summary')).toHaveTextContent('2 VMID discrepancies found')
    expect(screen.getAllByTestId('row-reconcile-detail')).toHaveLength(2)
    expect(screen.getByTestId('panel-reconcile-result')).toHaveTextContent('VMID 1201 (orphan-vm-01)')
    expect(fetchMock.mock.calls.find(([url]) => url === '/api/v1/ipam/reconcile')[1].method).toBe('POST')
  })

  test('Reconcile VMIDs reports an in-sync ledger', async () => {
    mockApi({
      '/api/v1/ipam/reconcile': () => jsonResponse({ discrepancies_found: 0, status: 'in-sync', details: [] }),
    })
    renderPage()
    await screen.findByTestId('row-ipam-10.0.0.11')

    fireEvent.click(screen.getByTestId('btn-reconcile-ipam'))

    expect(await screen.findByTestId('text-reconcile-summary')).toHaveTextContent('no VMID drift')
  })

  test('viewer role cannot release reservations', async () => {
    mockApi()
    renderPage('viewer')
    await screen.findByTestId('row-ipam-10.0.0.11')

    expect(screen.getByTestId('btn-release-amd-nkp1')).toBeDisabled()
    expect(screen.getByTestId('btn-reconcile-ipam')).toBeDisabled()
  })

  test('shows an error when the ledger cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    renderPage()

    expect(await screen.findByTestId('text-ipam-error')).toHaveTextContent('offline')
    expect(screen.getByTestId('card-ipam-total')).toHaveTextContent('0')
  })
})
