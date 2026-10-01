import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import ClustersPage from '../../pages/ClustersPage.jsx'
import PathSettingsPage from '../../pages/PathSettingsPage.jsx'
import VmListPage from '../../pages/VmListPage.jsx'
import { ROLE_STORAGE_KEY, RoleProvider, VIEWER_DENIED_MESSAGE } from '../RoleContext.jsx'

const clusterPayload = {
  clusters: [
    {
      name: 'nkp-prod-01',
      status: 'ready',
      kubernetes_version: 'v1.31.1',
      desired_nodes: 3,
      ready_nodes: 3,
      metallb: { vip_range: '10.10.40.100-10.10.40.120', address_pool: 'prod-pool' },
    },
  ],
}
const vmPayload = {
  vms: [{ vmid: 101, name: 'gpu-vm-01', node: 'pve-a', cores: 8, memory_mb: 16384, disk_gb: 200, status: 'running' }],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

function withRole(ui) {
  return render(
    <MemoryRouter>
      <RoleProvider>{ui}</RoleProvider>
    </MemoryRouter>,
  )
}

function renderHeader() {
  return withRole(<Header mode="console" themeMode="dark" onToggleMode={() => {}} onToggleThemeMode={() => {}} />)
}

function switchTo(role) {
  fireEvent.click(screen.getByTestId('badge-role-switcher'))
  fireEvent.click(screen.getByTestId(`option-role-${role}`))
}

describe('RoleContext', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({ mock_mode: false })))
  })

  test('defaults to Operator and persists role switches in localStorage', () => {
    renderHeader()
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Operator')

    switchTo('viewer')
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Demo (Viewer)')
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe('viewer')

    switchTo('operator')
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Operator')
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe('operator')
  })

  test('restores the stored role on load', () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, 'viewer')
    renderHeader()
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Demo (Viewer)')
  })

  test('elevating to Admin opens the unlock dialog and rejects a wrong passphrase', async () => {
    renderHeader()
    switchTo('admin')

    expect(screen.getByTestId('modal-unlock-admin')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-unlock-admin')).toBeDisabled()
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Operator')

    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ detail: 'nope' }, false))
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.change(screen.getByTestId('input-unlock-admin-passphrase'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByTestId('btn-submit-unlock-admin'))

    expect(await screen.findByTestId('text-unlock-admin-error')).toHaveTextContent('Invalid admin passphrase')
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Operator')
  })

  test('correct passphrase unlocks Admin after server validation', async () => {
    renderHeader()
    switchTo('admin')

    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ status: 'authorized', role: 'admin' }))
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.change(screen.getByTestId('input-unlock-admin-passphrase'), { target: { value: 'Nutanix.123' } })
    fireEvent.click(screen.getByTestId('btn-submit-unlock-admin'))

    await waitFor(() => expect(screen.queryByTestId('modal-unlock-admin')).not.toBeInTheDocument())
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Admin')
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe('admin')
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/auth/unlock-admin')
    expect(JSON.parse(options.body)).toEqual({ passphrase: 'Nutanix.123' })
  })

  test('viewer mode disables cluster mutation buttons with a demo tooltip', async () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, 'viewer')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(clusterPayload)))
    withRole(<ClustersPage />)

    await waitFor(() => expect(screen.getByTestId('btn-cluster-delete-nkp-prod-01')).toBeInTheDocument())
    for (const testId of [
      'btn-open-deploy-cluster',
      'btn-open-prep-node-modal',
      'btn-add-nodepool-nkp-prod-01',
      'btn-reset-nodes-nkp-prod-01',
      'btn-cluster-delete-nkp-prod-01',
    ]) {
      expect(screen.getByTestId(testId)).toBeDisabled()
      expect(screen.getByTestId(testId)).toHaveAttribute('title', VIEWER_DENIED_MESSAGE)
    }
  })

  test('viewer mode disables VM power and destroy buttons; operator enables them', async () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, 'viewer')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(vmPayload)))
    withRole(<VmListPage />)

    await waitFor(() => expect(screen.getByTestId('btn-vm-start-101')).toBeInTheDocument())
    expect(screen.getByTestId('btn-vm-start-101')).toBeDisabled()
    expect(screen.getByTestId('btn-vm-destroy-101')).toBeDisabled()
    expect(screen.getByTestId('btn-open-create-vm-modal')).toHaveAttribute('title', VIEWER_DENIED_MESSAGE)
  })

  test('operator can power VMs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(vmPayload)))
    withRole(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('btn-vm-start-101')).toBeEnabled())
    expect(screen.getByTestId('btn-vm-destroy-101')).toBeEnabled()
  })

  test('Day-0 path controls are read-only for Operator and enabled for Admin', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({ paths: [], backups: [] })))
    const { unmount } = withRole(<PathSettingsPage />)
    expect(screen.getByTestId('btn-trigger-migration')).toBeDisabled()
    expect(screen.getByTestId('btn-create-backup')).toBeDisabled()
    unmount()

    window.localStorage.setItem(ROLE_STORAGE_KEY, 'admin')
    withRole(<PathSettingsPage />)
    expect(screen.getByTestId('btn-trigger-migration')).toBeEnabled()
    expect(screen.getByTestId('btn-create-backup')).toBeEnabled()
  })

  test('cluster delete and reset require exact uppercase DELETE / RESET', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(clusterPayload)))
    withRole(<ClustersPage />)
    await waitFor(() => expect(screen.getByTestId('btn-cluster-delete-nkp-prod-01')).toBeEnabled())

    fireEvent.click(screen.getByTestId('btn-cluster-delete-nkp-prod-01'))
    expect(screen.getByTestId('modal-confirm-cluster-delete')).toBeInTheDocument()
    for (const attempt of ['delete', 'Delete', 'nkp-prod-01', 'DELETE ']) {
      fireEvent.change(screen.getByTestId('input-confirm-cluster-delete'), { target: { value: attempt } })
      expect(screen.getByTestId('btn-confirm-cluster-delete')).toBeDisabled()
    }
    fireEvent.change(screen.getByTestId('input-confirm-cluster-delete'), { target: { value: 'DELETE' } })
    expect(screen.getByTestId('btn-confirm-cluster-delete')).toBeEnabled()

    fireEvent.click(screen.getByTestId('btn-reset-nodes-nkp-prod-01'))
    fireEvent.change(screen.getByTestId('input-confirm-reset-nodes'), { target: { value: 'reset' } })
    expect(screen.getByTestId('btn-confirm-reset-nodes')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-confirm-reset-nodes'), { target: { value: 'RESET' } })
    expect(screen.getByTestId('btn-confirm-reset-nodes')).toBeEnabled()
  })

  test('batch destroy requires exact uppercase DESTROY and sends the role header', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(vmPayload))
    vi.stubGlobal('fetch', fetchMock)
    withRole(<VmListPage />)
    await waitFor(() => expect(screen.getByTestId('checkbox-vm-101')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('checkbox-vm-101'))
    fireEvent.click(screen.getByTestId('btn-batch-destroy'))

    expect(screen.getByTestId('modal-confirm-batch-destroy')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('input-confirm-batch-destroy'), { target: { value: 'destroy' } })
    expect(screen.getByTestId('btn-confirm-batch-destroy')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-confirm-batch-destroy'), { target: { value: 'DESTROY' } })
    expect(screen.getByTestId('btn-confirm-batch-destroy')).toBeEnabled()
    fireEvent.click(screen.getByTestId('btn-confirm-batch-destroy'))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/vms/batch-action',
        expect.objectContaining({ headers: expect.objectContaining({ 'X-Forge-Role': 'operator' }) }),
      ),
    )
  })
})
