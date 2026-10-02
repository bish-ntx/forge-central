import React, { useCallback, useEffect, useMemo, useState } from 'react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'
import Timestamp from '../components/common/Timestamp.jsx'
import { roleHeaders, useRole } from '../context/RoleContext.jsx'
import { suggestIpPlan } from '../utils/ipamSuggest.js'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  Loader2,
  Network,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import LiveTerminal from '../components/common/LiveTerminal.jsx'

const DEFAULT_NKP_VERSION = 'v2.18.0'
const DEFAULT_WORKER_NODES = 4
const SECRET_REGISTRIES = ['harbor', 'dockerhub']
const SETTINGS_SECRETS_LINK = '/settings?tab=secrets-vault'
const isNutanixCsi = (mode) => mode === 'nutanix-csi-pe' || mode === 'nutanix-csi-pc'

// Harbor secrets are per cluster (a lab-named secret acts as the default); Docker Hub has one global secret.
function hasRegistrySecret(secrets, registryType, clusterName, labName) {
  return secrets.some(
    (secret) =>
      secret.sec_type === registryType &&
      (registryType === 'dockerhub' || secret.cluster === clusterName || secret.cluster === labName),
  )
}

function RegistrySecretNotice({ registryType, status, configured, testId }) {
  if (!SECRET_REGISTRIES.includes(registryType)) return null
  if (status === 'loading' || status === 'idle') {
    return <p className="text-[11px] text-slate-400" data-testid={`${testId}-checking`}>Checking {registryType} credentials…</p>
  }
  if (status === 'ready' && configured) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300"
        data-testid={`${testId}-ok`}
      >
        <CheckCircle2 size={12} /> ✓ Credentials Configured
      </span>
    )
  }
  return (
    <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-300" data-testid={`${testId}-missing`}>
      <CircleAlert size={12} className="mr-1 inline" />
      {status === 'error'
        ? `Could not verify ${registryType} credentials.`
        : `No ${registryType} credentials found for this cluster.`}{' '}
      <Link to={SETTINGS_SECRETS_LINK} className="underline hover:text-amber-200" data-testid={`${testId}-link`}>
        Configure them in Settings → Registry & Secrets Vault
      </Link>{' '}
      before deploying.
    </div>
  )
}

function InheritedBadge({ inherited, overridden, testId }) {
  const tone = overridden
    ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
    : inherited
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
  return (
    <span className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] ${tone}`} data-testid={testId}>
      {overridden ? 'Override' : inherited ? 'Inherited from lab' : 'Not set in lab'}
    </span>
  )
}
const CLUSTER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/
const STORAGE_MODES = ['local', 'nutanix-csi-pe', 'nutanix-csi-pc']
const REGISTRY_TYPES = ['dockerhub', 'harbor', 'mirror']
const STEP_MARKER_RE = /^==> Step (\d+)\/(\d+):/

const WIZARD_STEPS = [
  { number: 1, title: 'Basics & Lab', stage: 'lab inheritance' },
  { number: 2, title: 'Sizing & IPAM', stage: 'free IP slots' },
  { number: 3, title: 'Runner Target', stage: 'central | bastion' },
  { number: 4, title: 'Config Preview', stage: 'input.ini + CLI' },
  { number: 5, title: 'Live Execution', stage: 'SSE stream' },
]

function defaultDeploySteps(runner) {
  return runner === 'bastion'
    ? ['Sync config to bastion', 'Provision VMs (bastion)', 'Create cluster (bastion)']
    : ['Provision VMs', 'Create cluster']
}

function stepState(index, progress) {
  if (progress.status === 'COMPLETED') return 'done'
  if (index < progress.current) return 'done'
  if (index === progress.current) return progress.status === 'FAILED' ? 'failed' : 'running'
  return 'pending'
}

async function readError(response, fallback) {
  const data = await response.json().catch(() => ({}))
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg
  return fallback
}

function ClusterDeployPage() {
  const { mutationProps } = useRole()
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    cluster_name: 'nkp-prod-01',
    lab_name: '',
    nkp_version: DEFAULT_NKP_VERSION,
    hypervisor_type: 'proxmox',
    control_plane_nodes: 3,
    worker_nodes: DEFAULT_WORKER_NODES,
    registry_type: 'dockerhub',
    storage_mode: 'local',
    target_runner: 'central',
    bastion_ip: '',
    // Optional per-cluster Prism target override (blank = inherit from the lab).
    prism_endpoint: '',
    prism_port: '',
    prism_user: '',
    storage_container: '',
  })

  // Registry credential pre-flight (GET /api/v1/secrets)
  const [secretsState, setSecretsState] = useState({ status: 'idle', items: [] })

  // Stage 1: labs discovered from /api/v1/lab/config
  const [labs, setLabs] = useState([])
  const [labConfig, setLabConfig] = useState(null)
  const [labsState, setLabsState] = useState('loading') // loading | ready | error
  const [labsError, setLabsError] = useState('')

  // Stage 2: free IPAM slots from /api/v1/ipam/free
  const [freeSlots, setFreeSlots] = useState([])
  const [ipamState, setIpamState] = useState('idle') // idle | loading | ready | error
  const [ipamError, setIpamError] = useState('')

  // Stage 4: generated cluster config (POST /api/v1/clusters/init-config)
  const [configResult, setConfigResult] = useState(null)
  const [configState, setConfigState] = useState('idle') // idle | loading | ready | error
  const [configError, setConfigError] = useState('')
  const [configNonce, setConfigNonce] = useState(0)
  const [syncState, setSyncState] = useState({ status: 'idle', runId: '', message: '' })

  // Stage 5: execution state
  const [runId, setRunId] = useState(null)
  const [streamUrl, setStreamUrl] = useState('')
  const [startedAt, setStartedAt] = useState('')
  const [deploySteps, setDeploySteps] = useState([])
  const [progress, setProgress] = useState({ current: 0, status: 'RUNNING' })

  function handleInputChange(field, value) {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  const applyLab = useCallback((config) => {
    setLabConfig(config)
    setFormData((previous) => ({
      ...previous,
      lab_name: config.lab_name || previous.lab_name,
      nkp_version: config.nkp_version || previous.nkp_version,
      registry_type: REGISTRY_TYPES.includes(config.registry_type) ? config.registry_type : previous.registry_type,
      storage_mode: config.storage_mode || previous.storage_mode,
      // Prism fields auto-populate from the lab; the operator can then override them per cluster.
      prism_endpoint: config.prism_endpoint || '',
      prism_port: config.prism_port ? String(config.prism_port) : '',
      prism_user: config.prism_user || '',
      storage_container: config.storage_container || '',
    }))
  }, [])

  // Load the active lab + the list of labs.
  useEffect(() => {
    let cancelled = false
    async function loadLabs() {
      try {
        const response = await fetch('/api/v1/lab/config')
        if (!response.ok) throw new Error(await readError(response, 'Failed to load lab configuration'))
        const config = await response.json()
        if (cancelled) return
        setLabs(Array.isArray(config.labs) ? config.labs : [])
        if (config.configured) applyLab(config)
        setLabsState('ready')
      } catch (error) {
        if (cancelled) return
        setLabsError(error instanceof Error ? error.message : 'Failed to load lab configuration')
        setLabsState('error')
      }
    }
    loadLabs()
    return () => {
      cancelled = true
    }
  }, [applyLab])

  async function handleLabChange(labName) {
    handleInputChange('lab_name', labName)
    setLabConfig(null)
    if (!labName) return
    try {
      const response = await fetch(`/api/v1/lab/config?lab=${encodeURIComponent(labName)}`)
      if (!response.ok) throw new Error(await readError(response, `Failed to load lab ${labName}`))
      applyLab(await response.json())
      setLabsError('')
    } catch (error) {
      setLabsError(error instanceof Error ? error.message : 'Failed to load lab configuration')
    }
  }

  // Check staged Harbor / Docker Hub credentials whenever one of those registries is selected.
  const needsSecretCheck = SECRET_REGISTRIES.includes(formData.registry_type)
  useEffect(() => {
    if (!needsSecretCheck) return undefined
    let cancelled = false
    setSecretsState((previous) => ({ ...previous, status: 'loading' }))
    fetch('/api/v1/secrets')
      .then(async (response) => {
        if (!response.ok) throw new Error('secrets unavailable')
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setSecretsState({ status: 'ready', items: Array.isArray(data?.secrets) ? data.secrets : [] })
      })
      .catch(() => {
        if (!cancelled) setSecretsState({ status: 'error', items: [] })
      })
    return () => {
      cancelled = true
    }
  }, [needsSecretCheck, formData.registry_type])

  // Fetch real free IPAM slots whenever Stage 2 is shown.
  const loadFreeSlots = useCallback(async () => {
    setIpamState('loading')
    setIpamError('')
    try {
      const response = await fetch('/api/v1/ipam/free')
      if (!response.ok) throw new Error(await readError(response, 'Failed to load free IP slots'))
      const slots = await response.json()
      setFreeSlots(Array.isArray(slots) ? slots : [])
      setIpamState('ready')
    } catch (error) {
      setIpamError(error instanceof Error ? error.message : 'Failed to load free IP slots')
      setIpamState('error')
    }
  }, [])

  useEffect(() => {
    if (currentStep === 2) loadFreeSlots()
  }, [currentStep, loadFreeSlots])

  const ipPlan = useMemo(() => suggestIpPlan(freeSlots), [freeSlots])

  // Prism target overrides are only sent for Nutanix CSI modes; blank fields inherit the lab value.
  const prismActive = isNutanixCsi(formData.storage_mode)
  const prismOverrides = prismActive
    ? {
        prism_endpoint: formData.prism_endpoint.trim() || null,
        prism_port: formData.prism_port ? Number(formData.prism_port) : null,
        prism_user: formData.prism_user.trim() || null,
        storage_container: formData.storage_container.trim() || null,
      }
    : {}
  const secretConfigured = hasRegistrySecret(
    secretsState.items,
    formData.registry_type,
    formData.cluster_name.trim(),
    formData.lab_name,
  )

  // Generate the real <cluster>-input.ini whenever Stage 4 is shown (or regenerated on demand).
  useEffect(() => {
    if (currentStep !== 4) return undefined
    let cancelled = false
    async function generateConfig() {
      setConfigState('loading')
      setConfigError('')
      try {
        const response = await fetch('/api/v1/clusters/init-config', {
          method: 'POST',
          headers: roleHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            cluster_name: formData.cluster_name.trim(),
            lab_name: formData.lab_name,
            nkp_version: formData.nkp_version.trim(),
            registry_type: formData.registry_type,
            storage_mode: formData.storage_mode,
            control_plane_nodes: Number(formData.control_plane_nodes),
            worker_nodes: Number(formData.worker_nodes),
            target_runner: formData.target_runner,
            bastion_ip: formData.target_runner === 'bastion' ? formData.bastion_ip.trim() : null,
            hypervisor_type: formData.hypervisor_type,
            ...prismOverrides,
          }),
        })
        if (!response.ok) throw new Error(await readError(response, 'Failed to generate cluster config'))
        const result = await response.json()
        if (cancelled) return
        setConfigResult(result)
        setConfigState('ready')
      } catch (error) {
        if (cancelled) return
        setConfigError(error instanceof Error ? error.message : 'Failed to generate cluster config')
        setConfigState('error')
      }
    }
    generateConfig()
    return () => {
      cancelled = true
    }
    // formData is intentionally read once per visit to Stage 4 (inputs are not editable there).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, configNonce])

  async function syncToBastion() {
    setSyncState({ status: 'syncing', runId: '', message: '' })
    try {
      const response = await fetch('/api/v1/clusters/sync-bastion', {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          cluster_name: formData.cluster_name.trim(),
          bastion_ip: formData.bastion_ip.trim(),
          nfs_mount: true,
        }),
      })
      if (!response.ok) throw new Error(await readError(response, 'Failed to queue bastion sync'))
      const payload = await response.json()
      setSyncState({ status: payload.status, runId: payload.run_id, message: '' })
    } catch (error) {
      setSyncState({
        status: 'error',
        runId: '',
        message: error instanceof Error ? error.message : 'Failed to queue bastion sync',
      })
    }
  }

  const clusterNameValid = CLUSTER_NAME_RE.test(formData.cluster_name.trim())
  const countsValid =
    Number(formData.control_plane_nodes) >= 1 &&
    Number(formData.control_plane_nodes) <= 9 &&
    Number(formData.worker_nodes) >= 0 &&
    Number(formData.worker_nodes) <= 64
  const bastionValid = formData.target_runner !== 'bastion' || formData.bastion_ip.trim().length > 0

  const nextBlocker = (() => {
    if (currentStep === 1) {
      if (!formData.lab_name) return 'Select a lab to inherit infrastructure settings from.'
      if (!clusterNameValid) return 'Cluster name must be 1-63 letters, digits, ".", "_" or "-".'
      if (!formData.nkp_version.trim()) return 'Enter the NKP version.'
    }
    if (currentStep === 2 && !countsValid) return 'Control plane nodes: 1-9, worker nodes: 0-64.'
    if (currentStep === 3 && !bastionValid) return 'Enter the bastion IP or hostname.'
    return ''
  })()

  function goToNextStep() {
    if (currentStep < 5 && !nextBlocker) {
      setCurrentStep((previous) => previous + 1)
    }
  }

  function goToPreviousStep() {
    if (currentStep > 1 && !isSubmitting && !runId) {
      setCurrentStep((previous) => previous - 1)
    }
  }

  async function launchDeployment() {
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      const response = await fetch('/api/v1/clusters/create', {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          cluster_name: formData.cluster_name.trim(),
          lab_name: formData.lab_name,
          control_plane_nodes: Number(formData.control_plane_nodes),
          worker_nodes: Number(formData.worker_nodes),
          hypervisor_type: formData.hypervisor_type,
          target_runner: formData.target_runner,
          bastion_ip: formData.target_runner === 'bastion' ? formData.bastion_ip.trim() : null,
          nfs_mount: true,
        }),
      })

      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to initiate cluster deployment pipeline'))
      }

      const payload = await response.json()
      setRunId(payload.run_id)
      setStartedAt(payload.started_at || new Date().toISOString())
      setDeploySteps(
        Array.isArray(payload.steps) && payload.steps.length > 0 ? payload.steps : defaultDeploySteps(formData.target_runner),
      )
      setProgress({ current: 0, status: 'RUNNING' })
      setStreamUrl(import.meta.env.VITE_TERMINAL_STREAM_URL || `/api/v1/pipeline/${payload.run_id}/stream`)
      setCurrentStep(5)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Deployment submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Derive per-step progress from the "==> Step i/n:" markers in the streamed log.
  const handleTerminalProgress = useCallback(({ lines, status }) => {
    let current = 0
    for (const line of lines) {
      const match = STEP_MARKER_RE.exec(line)
      if (match) current = Math.max(current, Number(match[1]))
    }
    setProgress((previous) =>
      previous.current === current && previous.status === status ? previous : { current, status },
    )
  }, [])

  const centralHint = formData.target_runner === 'bastion' ? '<forge-central-ip>' : ''
  const bastionHost = formData.bastion_ip.trim() || '<bastion-ip>'
  const shownDeploySteps = deploySteps.length > 0 ? deploySteps : defaultDeploySteps(formData.target_runner)
  const inputClass =
    'mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none'

  return (
    <section className="rounded border border-slate-700 bg-card-slate p-6" data-testid="page-clusters-deploy">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/clusters')}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
              data-testid="btn-back-to-clusters"
            >
              <ArrowLeft size={14} />
              Back to Clusters
            </button>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">NKP Cluster Deployment Wizard</h2>
          <p className="mt-1 text-xs text-slate-400">
            Guided cluster config generator: lab inheritance, IPAM-backed sizing and Central / Bastion execution
          </p>
        </div>
        {runId && (
          <div className="flex items-center gap-2 rounded bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
            <span className="text-slate-400">Run ID:</span>
            <code className="font-mono text-teal-400" data-testid="text-run-id">{runId}</code>
          </div>
        )}
      </div>

      {/* 5-Stage Stepper Navigation */}
      <nav className="mt-6 mb-8" aria-label="Wizard Steps">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {WIZARD_STEPS.map((s) => {
            const isActive = currentStep === s.number
            const isCompleted = currentStep > s.number
            return (
              <li
                key={s.number}
                data-testid={`step-indicator-${s.number}`}
                className={`flex items-center justify-between rounded border p-3 text-xs transition-colors ${
                  isActive
                    ? 'border-accent-teal bg-slate-800/90 text-teal-300 font-medium'
                    : isCompleted
                      ? 'border-emerald-600/50 bg-slate-900/60 text-emerald-400'
                      : 'border-slate-700 bg-slate-900/40 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                      isActive
                        ? 'bg-accent-teal text-slate-950'
                        : isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {isCompleted ? '✓' : s.number}
                  </span>
                  <div>
                    <span className="block font-medium">{s.title}</span>
                    <span className="text-[10px] text-slate-400">{s.stage}</span>
                  </div>
                </div>
                {s.number < 5 && <ChevronRight className="hidden sm:block h-3.5 w-3.5 text-slate-600" />}
              </li>
            )
          })}
        </ol>
      </nav>

      {errorMessage && (
        <div className="mb-6 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300" data-testid="wizard-error-message">
          {errorMessage}
        </div>
      )}

      {/* Stage 1: Cluster Basics & Lab Inheritance */}
      {currentStep === 1 && (
        <div className="space-y-6" data-testid="stage-1-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 1: Cluster Basics & Lab Inheritance</h3>
            <p className="mt-1 text-xs text-slate-400">
              Pick the lab the cluster lives in; Proxmox host, bridge, storage pool and NKP version are inherited from it.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="select-lab" className="block text-xs font-medium text-slate-300">
                Lab
              </label>
              <select
                id="select-lab"
                className={inputClass}
                value={formData.lab_name}
                onChange={(e) => handleLabChange(e.target.value)}
                data-testid="select-lab"
                disabled={labsState === 'loading'}
              >
                <option value="">{labsState === 'loading' ? 'Loading labs…' : 'Select a lab…'}</option>
                {labs.map((lab) => (
                  <option key={lab} value={lab}>
                    {lab}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Labs discovered from the Day-0 lab-infra files.</p>
            </div>

            <div>
              <label htmlFor="input-cluster-name" className="block text-xs font-medium text-slate-300">
                Cluster Name
              </label>
              <input
                id="input-cluster-name"
                type="text"
                className={inputClass}
                value={formData.cluster_name}
                onChange={(e) => handleInputChange('cluster_name', e.target.value)}
                data-testid="input-cluster-name"
                placeholder="e.g. nkp-prod-01"
              />
              <p className="mt-1 text-[11px] text-slate-400">DNS-compliant identifier for the target NKP cluster.</p>
            </div>

            <div>
              <label htmlFor="select-hypervisor" className="block text-xs font-medium text-slate-300">
                Hypervisor Infrastructure Type
              </label>
              <select
                id="select-hypervisor"
                className={inputClass}
                value={formData.hypervisor_type}
                onChange={(e) => handleInputChange('hypervisor_type', e.target.value)}
                data-testid="select-hypervisor"
              >
                <option value="proxmox">Proxmox VE (PVE)</option>
                <option value="ahv">Nutanix AHV</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Underlying hypervisor virtualization layer.</p>
            </div>

            <div>
              <label htmlFor="input-nkp-version" className="block text-xs font-medium text-slate-300">
                NKP Version
              </label>
              <input
                id="input-nkp-version"
                type="text"
                className={inputClass}
                value={formData.nkp_version}
                onChange={(e) => handleInputChange('nkp_version', e.target.value)}
                data-testid="input-nkp-version"
                placeholder={DEFAULT_NKP_VERSION}
              />
              <p className="mt-1 text-[11px] text-slate-400">Defaults to the lab's NKP CLI version when it defines one.</p>
            </div>
          </div>

          {labsState === 'error' && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300" data-testid="lab-load-error">
              <CircleAlert size={12} className="mr-1 inline" />
              {labsError}
            </div>
          )}
          {labsState === 'ready' && labs.length === 0 && (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300" data-testid="lab-empty-notice">
              No labs found. Create one with the Day-0 Lab Wizard in Settings first.
            </div>
          )}

          {labConfig && (
            <div className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="lab-inheritance-card">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200">Inherited from lab {labConfig.lab_name}</h4>
              </div>
              <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <dt className="text-[10px] text-slate-400">Proxmox host</dt>
                  <dd className="font-mono text-teal-300" data-testid="text-lab-pve-host">{labConfig.pve_host || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Network bridge</dt>
                  <dd className="font-mono text-teal-300" data-testid="text-lab-bridge">{labConfig.network_bridge || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Storage pool</dt>
                  <dd className="font-mono text-teal-300" data-testid="text-lab-storage-pool">{labConfig.storage_pool || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] text-slate-400">Default NKP version</dt>
                  <dd className="font-mono text-teal-300" data-testid="text-lab-nkp-version">{labConfig.nkp_version || '—'}</dd>
                </div>
              </dl>
              {needsSecretCheck && (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3 text-xs text-slate-300">
                  <span>Registry <code className="font-mono text-teal-300">{formData.registry_type}</code>:</span>
                  <RegistrySecretNotice
                    registryType={formData.registry_type}
                    status={secretsState.status}
                    configured={secretConfigured}
                    testId="registry-secret-stage1"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stage 2: Node Sizing & IPAM Allocation */}
      {currentStep === 2 && (
        <div className="space-y-6" data-testid="stage-2-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 2: Node Sizing & IPAM Allocation</h3>
            <p className="mt-1 text-xs text-slate-400">
              Size the cluster; the control-plane VIP and MetalLB range are suggested from live free IPAM slots.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <label htmlFor="input-control-plane-count" className="block text-xs font-medium text-slate-300">
                Control Plane Node Count
              </label>
              <input
                id="input-control-plane-count"
                type="number"
                min="1"
                max="9"
                className={inputClass}
                value={formData.control_plane_nodes}
                onChange={(e) => handleInputChange('control_plane_nodes', e.target.value)}
                data-testid="input-control-plane-count"
              />
              <p className="mt-1 text-[11px] text-slate-400">Recommended HA count: 3 control plane nodes.</p>
            </div>

            <div>
              <label htmlFor="input-worker-count" className="block text-xs font-medium text-slate-300">
                Worker Node Count
              </label>
              <input
                id="input-worker-count"
                type="number"
                min="0"
                max="64"
                className={inputClass}
                value={formData.worker_nodes}
                onChange={(e) => handleInputChange('worker_nodes', e.target.value)}
                data-testid="input-worker-count"
              />
              <p className="mt-1 text-[11px] text-slate-400">Worker nodes allocated for workload pods.</p>
            </div>

            <div>
              <label htmlFor="select-storage-mode" className="block text-xs font-medium text-slate-300">
                Storage Mode
              </label>
              <select
                id="select-storage-mode"
                className={inputClass}
                value={formData.storage_mode}
                onChange={(e) => handleInputChange('storage_mode', e.target.value)}
                data-testid="select-storage-mode"
              >
                {[...new Set([formData.storage_mode, ...STORAGE_MODES])].map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">Inherited from the lab; override per cluster.</p>
            </div>

            <div>
              <label htmlFor="select-registry-type" className="block text-xs font-medium text-slate-300">
                Registry Type
              </label>
              <select
                id="select-registry-type"
                className={inputClass}
                value={formData.registry_type}
                onChange={(e) => handleInputChange('registry_type', e.target.value)}
                data-testid="select-registry-type"
              >
                {REGISTRY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <p className="mt-1 mb-1.5 text-[11px] text-slate-400">Image registry used by the cluster.</p>
              <RegistrySecretNotice
                registryType={formData.registry_type}
                status={secretsState.status}
                configured={secretConfigured}
                testId="registry-secret"
              />
            </div>
          </div>

          {prismActive && (
            <details open className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="prism-accordion">
              <summary className="cursor-pointer text-xs font-semibold text-slate-200">
                Nutanix Prism ({formData.storage_mode === 'nutanix-csi-pc' ? 'Prism Central' : 'Prism Element'}) storage target
              </summary>
              <p className="mt-2 text-[11px] text-slate-400">
                Auto-populated from lab {labConfig?.lab_name || formData.lab_name || '—'}; edit a field to override it for this cluster
                (e.g. a secondary Prism). The Prism password is always inherited from the lab and never shown.
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {[
                  ['prism_endpoint', 'Prism Endpoint', 'prism_endpoint', 'text'],
                  ['prism_port', 'Prism Port', 'prism_port', 'number'],
                  ['prism_user', 'Prism User', 'prism_user', 'text'],
                  ['storage_container', 'Storage Container', 'storage_container', 'text'],
                ].map(([field, label, labKey, type]) => {
                  const labValue = labConfig?.[labKey]
                  const inherited = labValue !== undefined && labValue !== null && labValue !== ''
                  const overridden = String(formData[field]).trim() !== String(inherited ? labValue : '')
                  return (
                    <div key={field}>
                      <label htmlFor={`input-${field}`} className="block text-xs font-medium text-slate-300">
                        {label}
                        <InheritedBadge
                          inherited={inherited}
                          overridden={overridden}
                          testId={`badge-${field}`}
                        />
                      </label>
                      <input
                        id={`input-${field}`}
                        type={type}
                        className={inputClass}
                        value={formData[field]}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        data-testid={`input-${field}`}
                      />
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-[11px] text-slate-400" data-testid="prism-password-status">
                Prism password:{' '}
                {labConfig?.prism_password ? (
                  <span className="text-emerald-300">{labConfig.prism_password} (inherited from lab)</span>
                ) : (
                  <span className="text-amber-300">not set in lab — add it under Settings → Lab Infrastructure</span>
                )}
              </p>
            </details>
          )}

          {/* Live IPAM suggestion */}
          <div className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="ipam-preview-card">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-teal-400" />
                <h4 className="text-xs font-semibold text-slate-200">Suggested IP allocation (from free IPAM slots)</h4>
              </div>
              <button
                type="button"
                onClick={loadFreeSlots}
                disabled={ipamState === 'loading'}
                className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:border-slate-400 disabled:opacity-50"
                data-testid="btn-refresh-ipam"
              >
                <RefreshCw size={12} className={ipamState === 'loading' ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            {ipamState === 'loading' && (
              <p className="mt-3 text-xs text-slate-400" data-testid="ipam-loading">
                <Loader2 size={12} className="mr-1 inline animate-spin" />
                Loading free IP slots…
              </p>
            )}
            {ipamState === 'error' && (
              <p className="mt-3 text-xs text-rose-300" data-testid="ipam-error">
                <CircleAlert size={12} className="mr-1 inline" />
                {ipamError}
              </p>
            )}
            {ipamState === 'ready' && (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <span className="block text-[10px] text-slate-400">Control Plane VIP</span>
                    <span className="font-mono text-teal-300" data-testid="text-vip-preview">
                      {ipPlan.vip || 'none free — IPAM will allocate'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">MetalLB Range</span>
                    <span className="font-mono text-teal-300" data-testid="text-metallb-preview">
                      {ipPlan.metallbRange || 'none free — IPAM will allocate'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Free Slots</span>
                    <span className="font-semibold text-slate-200" data-testid="text-ipam-free-count">{freeSlots.length}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5" data-testid="ipam-free-slots">
                  {freeSlots.slice(0, 16).map((slot) => (
                    <span key={slot.ip} className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                      {slot.ip}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  These are previews: the addresses are reserved when the cluster config is generated in Stage 4.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage 3: Deployment Runner Target */}
      {currentStep === 3 && (
        <div className="space-y-6" data-testid="stage-3-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 3: Deployment Runner Target</h3>
            <p className="mt-1 text-xs text-slate-400">Choose where the deployment commands execute.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Deployment runner">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${
                formData.target_runner === 'central' ? 'border-accent-teal bg-slate-800/80' : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <input
                type="radio"
                name="target-runner"
                className="mt-1 h-4 w-4 text-teal-500"
                checked={formData.target_runner === 'central'}
                onChange={() => handleInputChange('target_runner', 'central')}
                data-testid="radio-runner-central"
              />
              <div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-100">
                  <Server size={12} /> Option A: Execute on Forge Central
                </span>
                <p className="mt-1 text-[11px] text-slate-400">
                  Runs <code className="font-mono">./forge provision vms</code> and{' '}
                  <code className="font-mono">./forge create cluster</code> directly on this host.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded border p-4 ${
                formData.target_runner === 'bastion' ? 'border-accent-teal bg-slate-800/80' : 'border-slate-700 bg-slate-900/60'
              }`}
            >
              <input
                type="radio"
                name="target-runner"
                className="mt-1 h-4 w-4 text-teal-500"
                checked={formData.target_runner === 'bastion'}
                onChange={() => handleInputChange('target_runner', 'bastion')}
                data-testid="radio-runner-bastion"
              />
              <div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-100">
                  <Database size={12} /> Option B: Stage & Execute on Cluster Bastion
                </span>
                <p className="mt-1 text-[11px] text-slate-400">
                  Syncs the generated config, mounts the product shares and runs the pipeline on the bastion over SSH.
                </p>
              </div>
            </label>
          </div>

          {formData.target_runner === 'bastion' && (
            <div className="space-y-4 rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="bastion-options">
              <div className="max-w-md">
                <label htmlFor="input-bastion-ip" className="block text-xs font-medium text-slate-300">
                  Bastion IP / Hostname
                </label>
                <input
                  id="input-bastion-ip"
                  type="text"
                  className={`${inputClass} font-mono`}
                  value={formData.bastion_ip}
                  onChange={(e) => handleInputChange('bastion_ip', e.target.value)}
                  data-testid="input-bastion-ip"
                  placeholder="10.0.0.50"
                />
              </div>
              <ol className="space-y-1.5 text-[11px] text-slate-300" data-testid="bastion-sync-steps">
                <li>
                  1. Write <code className="font-mono text-teal-300">{formData.cluster_name || '<cluster>'}-input.ini</code> on Forge Central
                </li>
                <li>
                  2. Mount product shares:{' '}
                  <code className="font-mono text-teal-300">
                    ./forge share mount --from {centralHint} --target {bastionHost}
                  </code>
                </li>
                <li>
                  3. Run <code className="font-mono text-teal-300">provision vms</code> and{' '}
                  <code className="font-mono text-teal-300">create cluster</code> on the bastion over SSH
                </li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Stage 4: Config Preview & Copy as CLI */}
      {currentStep === 4 && (
        <div className="space-y-6" data-testid="stage-4-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 4: Config Preview & Copy as CLI</h3>
            <p className="mt-1 text-xs text-slate-400">
              The generated cluster config inherits the lab settings; review it, then launch.
            </p>
          </div>

          <div className="rounded border border-slate-700 bg-slate-900/80 p-4">
            <h4 className="mb-3 border-b border-slate-800 pb-2 text-xs font-semibold text-slate-200">
              Deployment Summary
            </h4>
            <div className="grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4" data-testid="deploy-summary">
              <div>
                <span className="block text-[10px] text-slate-400">Cluster / Lab</span>
                <span className="font-semibold text-slate-200">{formData.cluster_name}</span> @ {formData.lab_name}
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Topology</span>
                <span className="font-semibold text-slate-200">
                  {formData.control_plane_nodes} CP / {formData.worker_nodes} Workers
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Control Plane VIP</span>
                <span className="font-mono text-teal-300" data-testid="text-config-vip">
                  {configResult?.vip_preview || '—'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">MetalLB Range</span>
                <span className="font-mono text-teal-300" data-testid="text-config-metallb">
                  {configResult?.metallb_range_preview || '—'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Runner</span>
                <span className="text-slate-200" data-testid="text-config-runner">
                  {formData.target_runner === 'bastion' ? `Bastion (${formData.bastion_ip})` : 'Forge Central'}
                </span>
              </div>
            </div>
          </div>

          {configState === 'loading' && (
            <p className="text-xs text-slate-400" data-testid="config-loading">
              <Loader2 size={12} className="mr-1 inline animate-spin" />
              Generating cluster config…
            </p>
          )}
          {configState === 'error' && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300" data-testid="config-error">
              <CircleAlert size={12} className="mr-1 inline" />
              {configError}
              <button
                type="button"
                onClick={() => setConfigNonce((value) => value + 1)}
                className="ml-3 rounded border border-rose-400/60 px-2 py-0.5 text-[11px] hover:border-rose-300"
                data-testid="btn-retry-config"
              >
                Retry
              </button>
            </div>
          )}
          {configState === 'ready' && configResult && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-400">
                  {formData.cluster_name}-input.ini <span className="font-mono">({configResult.config_path})</span>
                </label>
                <pre
                  className="max-h-64 overflow-y-auto rounded border border-slate-800 bg-black/80 p-3 font-mono text-[11px] text-teal-300"
                  data-testid="config-preview"
                >
                  {configResult.config_preview}
                </pre>
              </div>
              <CliSnippetCard title="Copy as CLI" command={configResult.commands.join('\n')} />
            </>
          )}

          {formData.target_runner === 'bastion' && (
            <div className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="bastion-sync-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Stage config on bastion {formData.bastion_ip}</h4>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Optional dry stage: mounts the product shares now. Launch also performs this step.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={syncToBastion}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
                  data-testid="btn-sync-bastion"
                  {...mutationProps(syncState.status === 'syncing' || configState !== 'ready')}
                >
                  {syncState.status === 'syncing' ? <Loader2 size={12} className="animate-spin" /> : <Terminal size={12} />}
                  Sync to Bastion
                </button>
              </div>
              {syncState.runId && (
                <p className="mt-2 text-[11px] text-slate-300" data-testid="sync-bastion-status">
                  Sync {syncState.status} — run <code className="font-mono text-teal-400" data-testid="text-sync-run-id">{syncState.runId}</code>
                </p>
              )}
              {syncState.status === 'error' && (
                <p className="mt-2 text-[11px] text-rose-300" data-testid="sync-bastion-error">{syncState.message}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Stage 5: Live Execution Terminal */}
      {currentStep === 5 && (
        <div className="space-y-6" data-testid="stage-5-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 5: Live Execution</h3>
            <p className="mt-1 text-xs text-slate-400">
              Real-time SSE log output for the {formData.target_runner === 'bastion' ? 'bastion' : 'Forge Central'} deployment run.
            </p>
            {startedAt && (
              <p className="mt-1 text-[11px] text-slate-400" data-testid="run-started-at">
                Started — UTC: <span className="font-mono text-slate-300">{startedAt}</span> | Local:{' '}
                <span className="font-mono text-slate-300">
                  <Timestamp value={startedAt} />
                </span>
              </p>
            )}
          </div>

          {/* Step progress indicators */}
          <ol className="grid gap-2 sm:grid-cols-3" data-testid="deploy-step-progress">
            {shownDeploySteps.map((label, index) => {
              const state = stepState(index + 1, progress)
              const tone =
                state === 'done'
                  ? 'border-emerald-600/50 text-emerald-300'
                  : state === 'running'
                    ? 'border-accent-teal text-teal-300'
                    : state === 'failed'
                      ? 'border-rose-500/60 text-rose-300'
                      : 'border-slate-800 text-slate-400'
              return (
                <li
                  key={label}
                  data-testid={`step-progress-${index + 1}`}
                  data-state={state}
                  className={`flex items-center gap-2 rounded border bg-slate-950/70 p-2.5 text-xs ${tone}`}
                >
                  {state === 'done' && <CheckCircle2 size={14} />}
                  {state === 'running' && <Loader2 size={14} className="animate-spin" />}
                  {state === 'failed' && <CircleAlert size={14} />}
                  {state === 'pending' && <span className="h-3.5 w-3.5 rounded-full border border-slate-600" />}
                  <span className="font-mono">
                    {index + 1}. {label}
                  </span>
                </li>
              )
            })}
          </ol>

          {/* Live Terminal Stream Component */}
          {streamUrl ? (
            <LiveTerminal
              streamUrl={streamUrl}
              activeStepName={`NKP Deploy (${formData.cluster_name})`}
              autoConnect={true}
              onProgress={handleTerminalProgress}
            />
          ) : (
            <div className="rounded border border-dashed border-slate-700 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
              Click <span className="font-semibold text-teal-300">Launch Deployment</span> to trigger cluster creation pipeline.
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons Controls */}
      <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-4">
        <button
          type="button"
          onClick={goToPreviousStep}
          disabled={currentStep === 1 || isSubmitting || Boolean(runId)}
          className="rounded border border-slate-600 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-400 disabled:opacity-40 disabled:hover:border-slate-600"
          data-testid="btn-wizard-back"
        >
          Back
        </button>

        <div className="flex items-center gap-3">
          {nextBlocker && currentStep < 4 && (
            <span className="text-[11px] text-amber-300" data-testid="text-next-blocker">
              {nextBlocker}
            </span>
          )}
          {currentStep < 4 && (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={Boolean(nextBlocker)}
              className="inline-flex items-center gap-1.5 rounded bg-accent-teal px-4 py-2 text-xs font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-40"
              data-testid="btn-wizard-next"
            >
              Next Step
              <ChevronRight size={14} />
            </button>
          )}

          {(currentStep === 4 || (currentStep === 5 && !runId)) && (
            <button
              type="button"
              onClick={launchDeployment}
              className="inline-flex items-center gap-2 rounded bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              data-testid="btn-wizard-launch"
              {...mutationProps(isSubmitting || Boolean(runId) || configState !== 'ready')}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Initiating Deployment...
                </>
              ) : (
                <>
                  <Play size={14} />
                  Launch Deployment
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export default ClusterDeployPage
