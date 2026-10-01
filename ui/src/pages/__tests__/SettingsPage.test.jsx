import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SettingsPage from '../SettingsPage.jsx'
import { ROLE_STORAGE_KEY, RoleProvider } from '../../context/RoleContext.jsx'

const secretsPayload = {
  secrets: [
    { sec_type: 'dockerhub', user: 'bish', path: '/home/u/cacrt/dockerhub/dockerhub-creds.ini', cluster: null, has_ca: false, password_masked: '********', updated_at: '2026-09-30T10:00:00Z' },
    { sec_type: 'harbor', user: 'nkpadmin', path: '/home/u/cacrt/amd-nkp1/harbor-creds.ini', cluster: 'amd-nkp1', has_ca: true, password_masked: '********', updated_at: '2026-09-30T10:00:00Z' },
  ],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

function mockApi(overrides = {}) {
  const fetchMock = vi.fn().mockImplementation((url, options = {}) => {
    if (overrides[`${options.method ?? 'GET'} ${url}`]) return overrides[`${options.method ?? 'GET'} ${url}`]()
    if (url === '/api/v1/lab/config') return jsonResponse({ configured: false })
    if (url === '/api/v1/secrets') return jsonResponse(secretsPayload)
    return jsonResponse({})
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderAs(role) {
  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
  return render(
    <RoleProvider>
      <SettingsPage />
    </RoleProvider>,
  )
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  test('renders the Lab Infrastructure tab by default and switches to the Secrets Vault', async () => {
    mockApi()
    renderAs('admin')

    expect(screen.getByTestId('tab-lab-infra')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-secrets-vault')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-tab-secrets-vault'))
    expect(screen.getByTestId('tab-secrets-vault')).toBeInTheDocument()
    expect(screen.queryByTestId('tab-lab-infra')).not.toBeInTheDocument()
    expect(await screen.findByTestId('table-secrets')).toBeInTheDocument()
  })

  test('save button is admin-guarded', () => {
    mockApi()
    const { unmount } = renderAs('operator')
    expect(screen.getByTestId('btn-save-lab')).toBeDisabled()
    expect(screen.getByTestId('btn-save-lab')).toHaveAttribute('title', 'Day-0 infrastructure setup requires Admin role')
    unmount()

    renderAs('admin')
    expect(screen.getByTestId('btn-save-lab')).toBeEnabled()
  })

  test('prefills the form from an existing lab and previews the INI and CLI snippet', async () => {
    mockApi({
      'GET /api/v1/lab/config': () =>
        jsonResponse({ configured: true, lab_name: 'amd-lab', pve_host: '10.0.0.5', pve_node: 'pve1', storage_pool: 'local-lvm', nameserver: '10.0.0.1', lab_ip_pool: '10.0.0.10-10.0.0.40', golden_vmid: 9000 }),
    })
    renderAs('admin')

    await waitFor(() => expect(screen.getByTestId('input-lab-pve_host')).toHaveValue('10.0.0.5'))
    expect(screen.getByTestId('preview-lab-ini')).toHaveTextContent('PVE_CLUSTER_HOST="10.0.0.5"')
    expect(screen.getByTestId('preview-lab-ini')).toHaveTextContent('GOLDEN_TEMPLATE_VMID="9000"')
    expect(screen.getByTestId('preview-lab-ini')).not.toHaveTextContent('Nutanix')
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('./forge init lab --non-interactive')
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('--pve-host "10.0.0.5"')
  })

  test('Save & Initialize posts the lab with the admin role header', async () => {
    const fetchMock = mockApi({
      'POST /api/v1/lab/init': () => jsonResponse({ status: 'initialized', config_path: '/srv/labs/lab1/lab1-infra.ini' }),
    })
    renderAs('admin')
    fireEvent.change(screen.getByTestId('input-lab-pve_host'), { target: { value: '10.0.0.5' } })
    fireEvent.change(screen.getByTestId('input-lab-golden_vmid'), { target: { value: '9000' } })
    fireEvent.change(screen.getByTestId('select-lab-registry_type'), { target: { value: 'harbor' } })
    fireEvent.click(screen.getByTestId('btn-save-lab'))

    expect(await screen.findByTestId('text-lab-notice')).toHaveTextContent('/srv/labs/lab1/lab1-infra.ini')
    const [, options] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/lab/init')
    expect(options.headers['X-Forge-Role']).toBe('admin')
    expect(JSON.parse(options.body)).toMatchObject({ pve_host: '10.0.0.5', golden_vmid: 9000, registry_type: 'harbor', pve_password: null })
  })

  test('surfaces backend validation errors', async () => {
    mockApi({ 'POST /api/v1/lab/init': () => jsonResponse({ detail: [{ msg: 'Value error, lab_ip_pool must look like 10.0.0.10-10.0.0.40' }] }, false) })
    renderAs('admin')
    fireEvent.click(screen.getByTestId('btn-save-lab'))

    expect(await screen.findByTestId('text-lab-error')).toHaveTextContent('lab_ip_pool must look like')
  })

  test('lists staged secrets with masked passwords and guards stage/delete for operators', async () => {
    mockApi()
    renderAs('operator')
    fireEvent.click(screen.getByTestId('btn-tab-secrets-vault'))

    const row = await screen.findByTestId('row-secret-harbor-amd-nkp1')
    expect(row).toHaveTextContent('harbor (amd-nkp1)')
    expect(row).toHaveTextContent('/home/u/cacrt/amd-nkp1/harbor-creds.ini')
    expect(row).toHaveTextContent('******** · CA present')
    expect(screen.getByTestId('row-secret-dockerhub-')).toHaveTextContent('bish')
    expect(screen.getByTestId('btn-stage-dockerhub')).toBeDisabled()
    expect(screen.getByTestId('btn-stage-harbor')).toBeDisabled()
    expect(screen.getByTestId('btn-delete-secret-dockerhub-')).toBeDisabled()
  })

  test('admin stages a Docker Hub PAT through the modal', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/secrets/save': () => jsonResponse(secretsPayload.secrets[0]) })
    renderAs('admin')
    fireEvent.click(screen.getByTestId('btn-tab-secrets-vault'))
    await screen.findByTestId('row-secret-dockerhub-')

    fireEvent.click(screen.getByTestId('btn-stage-dockerhub'))
    expect(screen.getByTestId('modal-stage-dockerhub')).toBeInTheDocument()
    expect(screen.getByTestId('btn-submit-stage-secret')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-secret-user'), { target: { value: 'bish' } })
    fireEvent.change(screen.getByTestId('input-secret-password'), { target: { value: 'dckr_pat_x' } })
    fireEvent.click(screen.getByTestId('btn-submit-stage-secret'))

    await waitFor(() => expect(screen.queryByTestId('modal-stage-dockerhub')).not.toBeInTheDocument())
    const [, options] = fetchMock.mock.calls.find(([url]) => url === '/api/v1/secrets/save')
    expect(JSON.parse(options.body)).toEqual({ sec_type: 'dockerhub', user: 'bish', password: 'dckr_pat_x' })
    expect(options.headers['X-Forge-Role']).toBe('admin')
  })

  test('Harbor modal requires a cluster and admin can delete a secret', async () => {
    const fetchMock = mockApi({ 'DELETE /api/v1/secrets/harbor?cluster=amd-nkp1': () => jsonResponse({ status: 'deleted' }) })
    renderAs('admin')
    fireEvent.click(screen.getByTestId('btn-tab-secrets-vault'))
    await screen.findByTestId('row-secret-harbor-amd-nkp1')

    fireEvent.click(screen.getByTestId('btn-stage-harbor'))
    expect(screen.getByTestId('modal-stage-harbor')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('input-secret-user'), { target: { value: 'nkpadmin' } })
    fireEvent.change(screen.getByTestId('input-secret-password'), { target: { value: 'pw' } })
    expect(screen.getByTestId('btn-submit-stage-secret')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-secret-cluster'), { target: { value: 'amd-nkp1' } })
    expect(screen.getByTestId('btn-submit-stage-secret')).toBeEnabled()
    fireEvent.click(screen.getByTestId('btn-cancel-stage-secret'))

    fireEvent.click(screen.getByTestId('btn-delete-secret-harbor-amd-nkp1'))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/secrets/harbor?cluster=amd-nkp1', expect.objectContaining({ method: 'DELETE' })),
    )
  })
})
