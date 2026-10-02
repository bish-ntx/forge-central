import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ClusterDeployPage from '../ClusterDeployPage.jsx'

vi.mock('../../hooks/useEventSource.js', () => ({
  default: () => ({
    events: [
      {
        event: 'log',
        data: { timestamp: '2026-09-26T22:40:00Z', line: '==> Step 1/2: Provision VMs', stream: 'stdout' },
      },
      {
        event: 'log',
        data: { timestamp: '2026-09-26T22:40:05Z', line: '==> Step 2/2: Create cluster', stream: 'stdout' },
      },
    ],
    endEvent: null,
    connectionState: 'open',
    reconnectCount: 0,
  }),
}))

const AMD_LAB = {
  configured: true,
  lab_name: 'amd-lab',
  labs: ['amd-lab', 'cirra-lab'],
  pve_host: '10.0.0.5',
  pve_node: 'pve1',
  network_bridge: 'vmbr1',
  storage_pool: 'local-lvm',
  nkp_version: 'v2.18.0',
  registry_type: 'harbor',
  storage_mode: 'local',
  prism_endpoint: '10.1.1.10',
  prism_port: 9440,
  prism_user: 'admin',
  prism_password: '***MASKED***',
  storage_container: 'lab-container',
}
const CIRRA_LAB = {
  ...AMD_LAB,
  lab_name: 'cirra-lab',
  pve_host: '10.1.0.5',
  network_bridge: 'vmbr9',
  storage_pool: 'tank',
  nkp_version: 'v2.19.0',
}
const SECRET_ITEM = { user: 'u', path: '/cacrt/x.ini', has_ca: false, password_masked: '********', updated_at: '2026-09-26T22:40:00Z' }
const HARBOR_SECRET = { ...SECRET_ITEM, sec_type: 'harbor', cluster: 'nkp-prod-01' }
const DOCKERHUB_SECRET = { ...SECRET_ITEM, sec_type: 'dockerhub', cluster: null }
const FREE_SLOTS = [15, 16, 17, 18, 19, 20, 24, 25].map((octet) => ({
  ip: `10.0.0.${octet}`,
  status: 'free',
  cluster: null,
}))
const INIT_RESULT = {
  cluster_name: 'nkp-prod-01',
  config_path: '/home/forge/forge-state/nkp-prod-01/nkp-prod-01-input.ini',
  vip_preview: '10.0.0.15',
  metallb_range_preview: '10.0.0.16-10.0.0.20',
  status: 'initialized',
  lab_name: 'amd-lab',
  config_preview: 'CLUSTER_NAME="nkp-prod-01"\nKUBE_VIP="10.0.0.15"\n',
  commands: [
    './forge init nkp-cluster --cluster nkp-prod-01 --lab-infra /labs/amd-lab-infra.ini',
    './forge provision vms --skip-bastion --conf /state/nkp-prod-01-input.ini',
    './forge create cluster --conf /state/nkp-prod-01-input.ini',
  ],
  free_ip_count: 8,
}
const CREATE_RESULT = {
  run_id: '12345678-abcd-ef01-2345-6789abcdef01',
  status: 'PENDING',
  command: './forge provision vms && ./forge create cluster',
  started_at: '2026-09-26T22:40:00Z',
  steps: ['Provision VMs', 'Create cluster'],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

function installFetch(overrides = {}) {
  const routes = {
    'GET /api/v1/lab/config': () => jsonResponse(AMD_LAB),
    'GET /api/v1/lab/config?lab=cirra-lab': () => jsonResponse(CIRRA_LAB),
    'GET /api/v1/ipam/free': () => jsonResponse(FREE_SLOTS),
    'GET /api/v1/secrets': () => jsonResponse({ secrets: [] }),
    'POST /api/v1/clusters/init-config': () => jsonResponse(INIT_RESULT),
    'POST /api/v1/clusters/sync-bastion': () =>
      jsonResponse({ run_id: 'sync-run-1', cluster_name: 'nkp-prod-01', bastion_ip: '10.0.0.50', status: 'queued' }),
    'POST /api/v1/clusters/create': () => jsonResponse(CREATE_RESULT),
    ...overrides,
  }
  const fetchMock = vi.fn().mockImplementation((url, options = {}) => {
    const key = `${options.method || 'GET'} ${url}`
    const handler = routes[key]
    return handler ? handler(options) : jsonResponse({ detail: `unmocked request: ${key}` }, false)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function callsTo(fetchMock, method, url) {
  return fetchMock.mock.calls.filter(([u, o]) => u === url && (o?.method || 'GET') === method)
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

async function renderReady() {
  renderDeployWizard()
  await waitFor(() => expect(screen.getByTestId('select-lab')).toHaveValue('amd-lab'))
}

const next = () => fireEvent.click(screen.getByTestId('btn-wizard-next'))

describe('ClusterDeployPage Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('renders Stage 1 with the active lab pre-selected and inherited infrastructure values', async () => {
    const fetchMock = installFetch()
    await renderReady()

    expect(screen.getByTestId('page-clusters-deploy')).toBeInTheDocument()
    expect(screen.getByTestId('stage-1-container')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'GET', '/api/v1/lab/config')).toHaveLength(1)

    const options = within(screen.getByTestId('select-lab')).getAllByRole('option').map((o) => o.value)
    expect(options).toEqual(['', 'amd-lab', 'cirra-lab'])

    const card = screen.getByTestId('lab-inheritance-card')
    expect(within(card).getByTestId('text-lab-pve-host')).toHaveTextContent('10.0.0.5')
    expect(within(card).getByTestId('text-lab-bridge')).toHaveTextContent('vmbr1')
    expect(within(card).getByTestId('text-lab-storage-pool')).toHaveTextContent('local-lvm')
    expect(screen.getByTestId('input-nkp-version')).toHaveValue('v2.18.0')
    expect(screen.getByTestId('input-cluster-name')).toHaveValue('nkp-prod-01')
    expect(screen.getByTestId('select-hypervisor')).toHaveValue('proxmox')
    expect(screen.getByTestId('btn-wizard-back')).toBeDisabled()
    expect(screen.getByTestId('btn-wizard-next')).toBeEnabled()
  })

  test('switching the lab loads that lab and re-inherits its values', async () => {
    const fetchMock = installFetch()
    await renderReady()

    fireEvent.change(screen.getByTestId('select-lab'), { target: { value: 'cirra-lab' } })

    await waitFor(() => expect(screen.getByTestId('text-lab-pve-host')).toHaveTextContent('10.1.0.5'))
    expect(callsTo(fetchMock, 'GET', '/api/v1/lab/config?lab=cirra-lab')).toHaveLength(1)
    expect(screen.getByTestId('text-lab-bridge')).toHaveTextContent('vmbr9')
    expect(screen.getByTestId('text-lab-storage-pool')).toHaveTextContent('tank')
    expect(screen.getByTestId('input-nkp-version')).toHaveValue('v2.19.0')
  })

  test('blocks Next and explains when no lab exists or the lab list cannot be loaded', async () => {
    installFetch({ 'GET /api/v1/lab/config': () => jsonResponse({ configured: false, labs: [] }) })
    renderDeployWizard()

    expect(await screen.findByTestId('lab-empty-notice')).toBeInTheDocument()
    expect(screen.getByTestId('btn-wizard-next')).toBeDisabled()
    expect(screen.getByTestId('text-next-blocker')).toHaveTextContent('Select a lab')
  })

  test('shows an error when the lab configuration request fails', async () => {
    installFetch({ 'GET /api/v1/lab/config': () => jsonResponse({ detail: 'lab backend offline' }, false) })
    renderDeployWizard()

    expect(await screen.findByTestId('lab-load-error')).toHaveTextContent('lab backend offline')
    expect(screen.getByTestId('btn-wizard-next')).toBeDisabled()
  })

  test('validates the cluster name before advancing', async () => {
    installFetch()
    await renderReady()

    fireEvent.change(screen.getByTestId('input-cluster-name'), { target: { value: 'bad name!' } })
    expect(screen.getByTestId('btn-wizard-next')).toBeDisabled()

    fireEvent.change(screen.getByTestId('input-cluster-name'), { target: { value: 'good-name' } })
    expect(screen.getByTestId('btn-wizard-next')).toBeEnabled()
  })

  test('navigates forward and backward through steps while preserving form state', async () => {
    installFetch()
    await renderReady()

    fireEvent.change(screen.getByTestId('input-cluster-name'), { target: { value: 'nkp-custom-cluster' } })
    next()
    expect(screen.getByTestId('stage-2-container')).toBeInTheDocument()
    expect(screen.getByTestId('step-indicator-2')).toHaveClass('border-accent-teal')

    fireEvent.click(screen.getByTestId('btn-wizard-back'))
    expect(screen.getByTestId('stage-1-container')).toBeInTheDocument()
    expect(screen.getByTestId('input-cluster-name')).toHaveValue('nkp-custom-cluster')
    expect(screen.getByTestId('select-lab')).toHaveValue('amd-lab')
  })

  test('Stage 2 fetches free IPAM slots and previews the VIP and MetalLB range', async () => {
    const fetchMock = installFetch()
    await renderReady()
    next()

    expect(screen.getByTestId('input-control-plane-count')).toHaveValue(3)
    expect(screen.getByTestId('input-worker-count')).toHaveValue(4)
    expect(screen.getByTestId('select-storage-mode')).toHaveValue('local')
    expect(screen.getByTestId('select-registry-type')).toHaveValue('harbor')

    await waitFor(() => expect(screen.getByTestId('text-vip-preview')).toHaveTextContent('10.0.0.15'))
    expect(callsTo(fetchMock, 'GET', '/api/v1/ipam/free')).toHaveLength(1)
    expect(screen.getByTestId('text-metallb-preview')).toHaveTextContent('10.0.0.16-10.0.0.20')
    expect(screen.getByTestId('text-ipam-free-count')).toHaveTextContent('8')
    expect(within(screen.getByTestId('ipam-free-slots')).getByText('10.0.0.24')).toBeInTheDocument()
    // The old hardcoded mockup values are gone.
    expect(screen.queryByText('10.10.40.99')).not.toBeInTheDocument()
    expect(screen.queryByTestId('inventory-yaml-preview')).not.toBeInTheDocument()
  })

  test('Stage 2 refresh re-queries IPAM and surfaces failures', async () => {
    let calls = 0
    const fetchMock = installFetch({
      'GET /api/v1/ipam/free': () => {
        calls += 1
        return calls === 1 ? jsonResponse({ detail: 'ipam offline' }, false) : jsonResponse(FREE_SLOTS)
      },
    })
    await renderReady()
    next()

    expect(await screen.findByTestId('ipam-error')).toHaveTextContent('ipam offline')

    fireEvent.click(screen.getByTestId('btn-refresh-ipam'))
    await waitFor(() => expect(screen.getByTestId('text-vip-preview')).toHaveTextContent('10.0.0.15'))
    expect(callsTo(fetchMock, 'GET', '/api/v1/ipam/free')).toHaveLength(2)
  })

  test('Stage 2 rejects out-of-range node counts', async () => {
    installFetch()
    await renderReady()
    next()

    fireEvent.change(screen.getByTestId('input-control-plane-count'), { target: { value: '0' } })
    expect(screen.getByTestId('btn-wizard-next')).toBeDisabled()
    fireEvent.change(screen.getByTestId('input-control-plane-count'), { target: { value: '3' } })
    expect(screen.getByTestId('btn-wizard-next')).toBeEnabled()
  })

  test('Stage 3 defaults to Forge Central and requires a bastion address for the bastion runner', async () => {
    installFetch()
    await renderReady()
    next()
    next()

    expect(screen.getByTestId('stage-3-container')).toBeInTheDocument()
    expect(screen.getByTestId('radio-runner-central')).toBeChecked()
    expect(screen.queryByTestId('input-bastion-ip')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('radio-runner-bastion'))
    expect(screen.getByTestId('radio-runner-bastion')).toBeChecked()
    expect(screen.getByTestId('radio-runner-central')).not.toBeChecked()
    expect(screen.getByTestId('btn-wizard-next')).toBeDisabled()

    fireEvent.change(screen.getByTestId('input-bastion-ip'), { target: { value: '10.0.0.50' } })
    expect(screen.getByTestId('btn-wizard-next')).toBeEnabled()
    const steps = screen.getByTestId('bastion-sync-steps')
    expect(steps).toHaveTextContent('./forge share mount --from')
    expect(steps).toHaveTextContent('--target 10.0.0.50')

    fireEvent.click(screen.getByTestId('radio-runner-central'))
    expect(screen.queryByTestId('bastion-options')).not.toBeInTheDocument()
  })

  test('Stage 4 generates the real cluster config and renders it with the CLI commands', async () => {
    const fetchMock = installFetch()
    await renderReady()
    fireEvent.change(screen.getByTestId('input-nkp-version'), { target: { value: 'v2.18.1' } })
    next()
    fireEvent.change(screen.getByTestId('input-worker-count'), { target: { value: '5' } })
    next()
    next()

    expect(screen.getByTestId('stage-4-container')).toBeInTheDocument()
    expect(await screen.findByTestId('config-preview')).toHaveTextContent('KUBE_VIP="10.0.0.15"')
    expect(screen.getByTestId('text-config-vip')).toHaveTextContent('10.0.0.15')
    expect(screen.getByTestId('text-config-metallb')).toHaveTextContent('10.0.0.16-10.0.0.20')
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('./forge init nkp-cluster')
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('./forge provision vms')
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('./forge create cluster')
    expect(screen.queryByTestId('btn-sync-bastion')).not.toBeInTheDocument()

    const [calls] = [callsTo(fetchMock, 'POST', '/api/v1/clusters/init-config')]
    expect(calls).toHaveLength(1)
    const body = JSON.parse(calls[0][1].body)
    expect(body).toMatchObject({
      cluster_name: 'nkp-prod-01',
      lab_name: 'amd-lab',
      nkp_version: 'v2.18.1',
      registry_type: 'harbor',
      storage_mode: 'local',
      control_plane_nodes: 3,
      worker_nodes: 5,
      target_runner: 'central',
      bastion_ip: null,
      hypervisor_type: 'proxmox',
    })
    expect(calls[0][1].headers['Content-Type']).toBe('application/json')
  })

  test('Stage 4 reports config generation errors and can retry', async () => {
    let attempts = 0
    installFetch({
      'POST /api/v1/clusters/init-config': () => {
        attempts += 1
        return attempts === 1 ? jsonResponse({ detail: 'lab not found: amd-lab' }, false) : jsonResponse(INIT_RESULT)
      },
    })
    await renderReady()
    next()
    next()
    next()

    expect(await screen.findByTestId('config-error')).toHaveTextContent('lab not found: amd-lab')
    expect(screen.getByTestId('btn-wizard-launch')).toBeDisabled()

    fireEvent.click(screen.getByTestId('btn-retry-config'))
    expect(await screen.findByTestId('config-preview')).toBeInTheDocument()
    expect(screen.getByTestId('btn-wizard-launch')).toBeEnabled()
  })

  test('bastion runner sends the bastion IP and can stage the config before launch', async () => {
    const fetchMock = installFetch()
    await renderReady()
    next()
    next()
    fireEvent.click(screen.getByTestId('radio-runner-bastion'))
    fireEvent.change(screen.getByTestId('input-bastion-ip'), { target: { value: '10.0.0.50' } })
    next()

    await screen.findByTestId('config-preview')
    const initBody = JSON.parse(callsTo(fetchMock, 'POST', '/api/v1/clusters/init-config')[0][1].body)
    expect(initBody).toMatchObject({ target_runner: 'bastion', bastion_ip: '10.0.0.50' })
    expect(screen.getByTestId('text-config-runner')).toHaveTextContent('Bastion (10.0.0.50)')

    fireEvent.click(screen.getByTestId('btn-sync-bastion'))
    expect(await screen.findByTestId('text-sync-run-id')).toHaveTextContent('sync-run-1')
    const syncBody = JSON.parse(callsTo(fetchMock, 'POST', '/api/v1/clusters/sync-bastion')[0][1].body)
    expect(syncBody).toEqual({ cluster_name: 'nkp-prod-01', bastion_ip: '10.0.0.50', nfs_mount: true })
  })

  test('launch posts the wizard payload and streams step progress in Stage 5', async () => {
    const fetchMock = installFetch()
    await renderReady()
    next()
    next()
    next()
    await screen.findByTestId('config-preview')

    fireEvent.click(screen.getByTestId('btn-wizard-launch'))

    await waitFor(() => expect(screen.getByTestId('stage-5-container')).toBeInTheDocument())
    const createCalls = callsTo(fetchMock, 'POST', '/api/v1/clusters/create')
    expect(createCalls).toHaveLength(1)
    const body = JSON.parse(createCalls[0][1].body)
    expect(body).toMatchObject({
      cluster_name: 'nkp-prod-01',
      lab_name: 'amd-lab',
      hypervisor_type: 'proxmox',
      control_plane_nodes: 3,
      worker_nodes: 4,
      target_runner: 'central',
      bastion_ip: null,
    })

    expect(screen.getByTestId('terminal-live-logs')).toBeInTheDocument()
    expect(screen.getByTestId('text-run-id')).toHaveTextContent('12345678-abcd-ef01-2345-6789abcdef01')
    expect(screen.getByTestId('run-started-at')).toHaveTextContent('UTC: 2026-09-26T22:40:00Z')
    expect(screen.getByTestId('run-started-at')).toHaveTextContent('Local:')

    // "==> Step 2/2" has been streamed: step 1 is done, step 2 is running.
    await waitFor(() => expect(screen.getByTestId('step-progress-2')).toHaveAttribute('data-state', 'running'))
    expect(screen.getByTestId('step-progress-1')).toHaveAttribute('data-state', 'done')
    expect(screen.getByTestId('step-progress-1')).toHaveTextContent('Provision VMs')
    expect(screen.getByTestId('step-progress-2')).toHaveTextContent('Create cluster')
    expect(screen.queryByTestId('btn-wizard-launch')).not.toBeInTheDocument()
    expect(screen.getByTestId('btn-wizard-back')).toBeDisabled()
  })

  test('launch failure surfaces the API error and stays on Stage 4', async () => {
    installFetch({
      'POST /api/v1/clusters/create': () => jsonResponse({ detail: 'cluster config not found' }, false),
    })
    await renderReady()
    next()
    next()
    next()
    await screen.findByTestId('config-preview')

    fireEvent.click(screen.getByTestId('btn-wizard-launch'))

    expect(await screen.findByTestId('wizard-error-message')).toHaveTextContent('cluster config not found')
    expect(screen.getByTestId('stage-4-container')).toBeInTheDocument()
  })

  test('worker nodes default to the 4-node production baseline', async () => {
    installFetch()
    await renderReady()
    next()
    expect(screen.getByTestId('input-worker-count')).toHaveValue(4)
  })

  test('shows a green credentials badge when a Harbor secret exists for the cluster', async () => {
    installFetch({ 'GET /api/v1/secrets': () => jsonResponse({ secrets: [HARBOR_SECRET] }) })
    await renderReady()

    expect(await screen.findByTestId('registry-secret-stage1-ok')).toHaveTextContent('Credentials Configured')
    expect(screen.queryByTestId('registry-secret-stage1-missing')).not.toBeInTheDocument()
    next()
    expect(await screen.findByTestId('registry-secret-ok')).toHaveTextContent('Credentials Configured')
  })

  test('warns with a Settings link when Harbor credentials are missing for this cluster', async () => {
    installFetch({
      'GET /api/v1/secrets': () => jsonResponse({ secrets: [{ ...HARBOR_SECRET, cluster: 'other-cluster' }] }),
    })
    await renderReady()

    const warning = await screen.findByTestId('registry-secret-stage1-missing')
    expect(warning).toHaveTextContent('No harbor credentials found')
    expect(screen.getByTestId('registry-secret-stage1-link')).toHaveAttribute('href', '/settings?tab=secrets-vault')
    expect(screen.queryByTestId('registry-secret-stage1-ok')).not.toBeInTheDocument()
    // The guard is advisory: the wizard can still proceed.
    expect(screen.getByTestId('btn-wizard-next')).toBeEnabled()
  })

  test('checks the global Docker Hub secret and ignores the guard for mirror registries', async () => {
    const fetchMock = installFetch({
      'GET /api/v1/lab/config': () => jsonResponse({ ...AMD_LAB, registry_type: 'dockerhub' }),
      'GET /api/v1/secrets': () => jsonResponse({ secrets: [DOCKERHUB_SECRET] }),
    })
    await renderReady()
    expect(await screen.findByTestId('registry-secret-stage1-ok')).toBeInTheDocument()

    next()
    fireEvent.change(screen.getByTestId('select-registry-type'), { target: { value: 'mirror' } })
    expect(screen.queryByTestId('registry-secret-ok')).not.toBeInTheDocument()
    expect(screen.queryByTestId('registry-secret-missing')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, 'GET', '/api/v1/secrets')).toHaveLength(1)
  })

  test('shows an amber warning when the secrets API is unavailable', async () => {
    installFetch({ 'GET /api/v1/secrets': () => jsonResponse({ detail: 'boom' }, false) })
    await renderReady()

    expect(await screen.findByTestId('registry-secret-stage1-missing')).toHaveTextContent('Could not verify harbor credentials')
  })

  test('Nutanix CSI storage modes reveal the Prism accordion auto-populated from the lab', async () => {
    const fetchMock = installFetch()
    await renderReady()
    next()
    expect(screen.queryByTestId('prism-accordion')).not.toBeInTheDocument()

    fireEvent.change(screen.getByTestId('select-storage-mode'), { target: { value: 'nutanix-csi-pe' } })
    expect(screen.getByTestId('prism-accordion')).toBeInTheDocument()
    expect(screen.getByTestId('input-prism_endpoint')).toHaveValue('10.1.1.10')
    expect(screen.getByTestId('input-prism_port')).toHaveValue(9440)
    expect(screen.getByTestId('input-prism_user')).toHaveValue('admin')
    expect(screen.getByTestId('input-storage_container')).toHaveValue('lab-container')
    expect(screen.getByTestId('badge-prism_endpoint')).toHaveTextContent('Inherited from lab')
    expect(screen.getByTestId('prism-password-status')).toHaveTextContent('***MASKED***')

    // Operator override for a secondary Prism target.
    fireEvent.change(screen.getByTestId('input-prism_endpoint'), { target: { value: '10.2.2.20' } })
    expect(screen.getByTestId('badge-prism_endpoint')).toHaveTextContent('Override')
    expect(screen.getByTestId('badge-prism_user')).toHaveTextContent('Inherited from lab')

    next()
    next()
    await screen.findByTestId('config-preview')
    const body = JSON.parse(callsTo(fetchMock, 'POST', '/api/v1/clusters/init-config')[0][1].body)
    expect(body).toMatchObject({
      storage_mode: 'nutanix-csi-pe',
      prism_endpoint: '10.2.2.20',
      prism_port: 9440,
      prism_user: 'admin',
      storage_container: 'lab-container',
    })
    expect(JSON.stringify(body)).not.toContain('password')
  })

  test('flags missing lab Prism settings and omits Prism fields for local storage', async () => {
    const fetchMock = installFetch({
      'GET /api/v1/lab/config': () => jsonResponse({ ...AMD_LAB, storage_mode: 'nutanix-csi-pc', prism_endpoint: null, prism_password: null }),
    })
    await renderReady()
    next()

    expect(screen.getByTestId('badge-prism_endpoint')).toHaveTextContent('Not set in lab')
    expect(screen.getByTestId('prism-password-status')).toHaveTextContent('not set in lab')

    fireEvent.change(screen.getByTestId('select-storage-mode'), { target: { value: 'local' } })
    expect(screen.queryByTestId('prism-accordion')).not.toBeInTheDocument()
    next()
    next()
    await screen.findByTestId('config-preview')
    const body = JSON.parse(callsTo(fetchMock, 'POST', '/api/v1/clusters/init-config')[0][1].body)
    expect(body).not.toHaveProperty('prism_endpoint')
  })

  test('navigates back to clusters list via back header button', async () => {
    installFetch()
    await renderReady()

    fireEvent.click(screen.getByTestId('btn-back-to-clusters'))
    expect(screen.getByTestId('page-clusters')).toBeInTheDocument()
  })
})
