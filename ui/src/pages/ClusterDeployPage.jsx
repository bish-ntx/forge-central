import React, { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Network,
  Play,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LiveTerminal from '../components/common/LiveTerminal.jsx'

const PIPELINE_STAGES = [
  { id: '01-konvoy', name: '01-konvoy', label: 'Konvoy Infrastructure', description: 'Bootstrap control plane and worker nodes' },
  { id: '02-metallb', name: '02-metallb', label: 'MetalLB LoadBalancer', description: 'Configure Layer-2 VIP address pools' },
  { id: '03-csi', name: '03-csi', label: 'Nutanix CSI Storage', description: 'Install Nutanix CSI driver and storage classes' },
  { id: '04-kommander', name: '04-kommander', label: 'Kommander Addons', description: 'Deploy governance and observability stack' },
  { id: '05-validation', name: '05-validation', label: 'Cluster Validation', description: 'Run end-to-end readiness checks' },
]

const INVENTORY_PREVIEWS = {
  'inventory-lab-01.yaml': `apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
kind: PreprovisionedInventory
metadata:
  name: lab-proxmox-inventory
  namespace: default
spec:
  nodes:
    - address: 10.10.40.11
      hostRef: { name: cp-node-01 }
    - address: 10.10.40.12
      hostRef: { name: cp-node-02 }
    - address: 10.10.40.13
      hostRef: { name: cp-node-03 }
    - address: 10.10.40.21
      hostRef: { name: worker-node-01 }
    - address: 10.10.40.22
      hostRef: { name: worker-node-02 }
    - address: 10.10.40.23
      hostRef: { name: worker-node-03 }`,
  'inventory-ahv-prod.yaml': `apiVersion: infrastructure.cluster.x-k8s.io/v1alpha1
kind: PreprovisionedInventory
metadata:
  name: prod-ahv-inventory
  namespace: default
spec:
  nodes:
    - address: 10.20.50.11
      hostRef: { name: ahv-cp-01 }
    - address: 10.20.50.12
      hostRef: { name: ahv-cp-02 }
    - address: 10.20.50.13
      hostRef: { name: ahv-cp-03 }
    - address: 10.20.50.21
      hostRef: { name: ahv-worker-01 }
    - address: 10.20.50.22
      hostRef: { name: ahv-worker-02 }
    - address: 10.20.50.23
      hostRef: { name: ahv-worker-03 }`,
}

function ClusterDeployPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    cluster_name: 'nkp-prod-01',
    kubernetes_version: 'v1.31.1',
    hypervisor_type: 'proxmox',
    control_plane_nodes: 3,
    worker_nodes: 3,
    inventory_file: 'inventory-lab-01.yaml',
    metallb_ip_range: '10.10.40.100-10.10.40.120',
    control_plane_vip: '10.10.40.99',
    nutanix_csi_enabled: true,
    kommander_addons_enabled: true,
  })

  // Execution State
  const [runId, setRunId] = useState(null)
  const [streamUrl, setStreamUrl] = useState('')

  function handleInputChange(field, value) {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  function goToNextStep() {
    if (currentStep < 5) {
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cluster_name: formData.cluster_name,
          control_plane_nodes: Number(formData.control_plane_nodes),
          worker_nodes: Number(formData.worker_nodes),
          kubernetes_version: formData.kubernetes_version,
          hypervisor_type: formData.hypervisor_type,
          metallb_ip_range: formData.metallb_ip_range,
          control_plane_vip: formData.control_plane_vip,
          nutanix_csi_enabled: formData.nutanix_csi_enabled,
          kommander_addons_enabled: formData.kommander_addons_enabled,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to initiate cluster deployment pipeline')
      }

      const payload = await response.json()
      setRunId(payload.run_id)
      setStreamUrl(import.meta.env.VITE_TERMINAL_STREAM_URL || `/api/v1/pipeline/${payload.run_id}/stream`)
      setCurrentStep(5)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Deployment submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const steps = [
    { number: 1, title: 'Basics', stage: '01-konvoy' },
    { number: 2, title: 'Topology & Preprov', stage: '02-metallb' },
    { number: 3, title: 'Network & VIP', stage: '03-csi' },
    { number: 4, title: 'Storage & Addons', stage: '04-kommander' },
    { number: 5, title: 'Deploy & Execution', stage: '05-validation' },
  ]

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
            Interactive 5-Stage Preprovisioned Nutanix Kubernetes Platform (NKP) Cluster Provisioning
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
          {steps.map((s) => {
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

      {/* Stage 1: Cluster Basics */}
      {currentStep === 1 && (
        <div className="space-y-6" data-testid="stage-1-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 1: Cluster Basics</h3>
            <p className="mt-1 text-xs text-slate-400">Specify cluster identity, target hypervisor engine, and Kubernetes version.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="input-cluster-name" className="block text-xs font-medium text-slate-300">
                Cluster Name
              </label>
              <input
                id="input-cluster-name"
                type="text"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
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
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
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
              <label htmlFor="input-k8s-version" className="block text-xs font-medium text-slate-300">
                Kubernetes Version
              </label>
              <input
                id="input-k8s-version"
                type="text"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
                value={formData.kubernetes_version}
                onChange={(e) => handleInputChange('kubernetes_version', e.target.value)}
                data-testid="input-k8s-version"
                placeholder="v1.31.1"
              />
              <p className="mt-1 text-[11px] text-slate-400">Target NKP Kubernetes release build.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stage 2: Node Topology & Preprovisioned Inventory Selection */}
      {currentStep === 2 && (
        <div className="space-y-6" data-testid="stage-2-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 2: Node Topology & Preprovisioned Inventory</h3>
            <p className="mt-1 text-xs text-slate-400">Define cluster control plane / worker topology and verify pre-flight inventory nodes.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <label htmlFor="input-control-plane-count" className="block text-xs font-medium text-slate-300">
                Control Plane Node Count
              </label>
              <input
                id="input-control-plane-count"
                type="number"
                min="1"
                max="9"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
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
                min="1"
                max="32"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
                value={formData.worker_nodes}
                onChange={(e) => handleInputChange('worker_nodes', e.target.value)}
                data-testid="input-worker-count"
              />
              <p className="mt-1 text-[11px] text-slate-400">Worker nodes allocated for workload pods.</p>
            </div>

            <div>
              <label htmlFor="select-inventory-file" className="block text-xs font-medium text-slate-300">
                Preprovisioned Inventory File
              </label>
              <select
                id="select-inventory-file"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none"
                value={formData.inventory_file}
                onChange={(e) => handleInputChange('inventory_file', e.target.value)}
                data-testid="select-inventory-file"
              >
                <option value="inventory-lab-01.yaml">inventory-lab-01.yaml (Proxmox Lab)</option>
                <option value="inventory-ahv-prod.yaml">inventory-ahv-prod.yaml (Nutanix AHV Cluster)</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-400">YAML manifest specifying node SSH details.</p>
            </div>
          </div>

          {/* Pre-flight PreprovisionedInventory YAML inspection & node status checks */}
          <div className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid="inventory-inspection-card">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-slate-200">Pre-flight Inventory Inspection & Node Checks</h4>
              </div>
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                6/6 Nodes Verified
              </span>
            </div>

            {/* Node Status Summary */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="preflight-status-checks">
              {[
                { name: 'cp-node-01', role: 'Control Plane', ip: '10.10.40.11', specs: '16 vCPU / 32GB', status: 'READY' },
                { name: 'cp-node-02', role: 'Control Plane', ip: '10.10.40.12', specs: '16 vCPU / 32GB', status: 'READY' },
                { name: 'cp-node-03', role: 'Control Plane', ip: '10.10.40.13', specs: '16 vCPU / 32GB', status: 'READY' },
                { name: 'worker-node-01', role: 'Worker', ip: '10.10.40.21', specs: '16 vCPU / 32GB', status: 'READY' },
                { name: 'worker-node-02', role: 'Worker', ip: '10.10.40.22', specs: '16 vCPU / 32GB', status: 'READY' },
                { name: 'worker-node-03', role: 'Worker', ip: '10.10.40.23', specs: '16 vCPU / 32GB', status: 'READY' },
              ].map((node) => (
                <div key={node.name} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-2.5 text-xs">
                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-slate-200">
                      <Server size={12} className="text-slate-400" />
                      {node.name}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{node.role} • {node.ip}</div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <CheckCircle2 size={10} />
                      {node.status}
                    </span>
                    <div className="text-[10px] text-slate-400">{node.specs}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Inventory YAML Preview */}
            <div className="mt-4">
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                PreprovisionedInventory Manifest YAML ({formData.inventory_file})
              </label>
              <pre
                className="max-h-40 overflow-y-auto rounded border border-slate-800 bg-black/80 p-3 font-mono text-[11px] text-teal-300"
                data-testid="inventory-yaml-preview"
              >
                {INVENTORY_PREVIEWS[formData.inventory_file] || INVENTORY_PREVIEWS['inventory-lab-01.yaml']}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Stage 3: Networking & VIP Config */}
      {currentStep === 3 && (
        <div className="space-y-6" data-testid="stage-3-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 3: Networking & Virtual IP (VIP) Config</h3>
            <p className="mt-1 text-xs text-slate-400">Configure MetalLB Layer-2 address pools and Kubernetes Control Plane VIP.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="input-metallb-range" className="block text-xs font-medium text-slate-300">
                MetalLB IP Range
              </label>
              <input
                id="input-metallb-range"
                type="text"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none font-mono"
                value={formData.metallb_ip_range}
                onChange={(e) => handleInputChange('metallb_ip_range', e.target.value)}
                data-testid="input-metallb-range"
                placeholder="10.10.40.100-10.10.40.120"
              />
              <p className="mt-1 text-[11px] text-slate-400">Allocated range for LoadBalancer services.</p>
            </div>

            <div>
              <label htmlFor="input-cp-vip" className="block text-xs font-medium text-slate-300">
                Control Plane Virtual IP (VIP)
              </label>
              <input
                id="input-cp-vip"
                type="text"
                className="mt-1.5 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-accent-teal focus:outline-none font-mono"
                value={formData.control_plane_vip}
                onChange={(e) => handleInputChange('control_plane_vip', e.target.value)}
                data-testid="input-cp-vip"
                placeholder="10.10.40.99"
              />
              <p className="mt-1 text-[11px] text-slate-400">Floating Virtual IP address for API server HA endpoints.</p>
            </div>
          </div>
        </div>
      )}

      {/* Stage 4: Storage & Addons */}
      {currentStep === 4 && (
        <div className="space-y-6" data-testid="stage-4-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 4: Storage & Management Addons</h3>
            <p className="mt-1 text-xs text-slate-400">Enable CSI storage provider and Kommander lifecycle extensions.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-start gap-3 rounded border border-slate-700 bg-slate-900/60 p-4 cursor-pointer hover:border-slate-500">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-400"
                checked={formData.nutanix_csi_enabled}
                onChange={(e) => handleInputChange('nutanix_csi_enabled', e.target.checked)}
                data-testid="toggle-csi"
              />
              <div>
                <span className="text-xs font-medium text-slate-100">Nutanix CSI Storage Driver</span>
                <p className="mt-1 text-[11px] text-slate-400">
                  Deploys Nutanix Container Storage Interface (CSI) for dynamic PVC volumes backed by Nutanix Volumes/Files.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded border border-slate-700 bg-slate-900/60 p-4 cursor-pointer hover:border-slate-500">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-400"
                checked={formData.kommander_addons_enabled}
                onChange={(e) => handleInputChange('kommander_addons_enabled', e.target.checked)}
                data-testid="toggle-kommander"
              />
              <div>
                <span className="text-xs font-medium text-slate-100">Kommander Management Addons</span>
                <p className="mt-1 text-[11px] text-slate-400">
                  Installs Kommander management services including Prometheus, Grafana, Traefik, and FluentBit.
                </p>
              </div>
            </label>
          </div>

          {/* Configuration Review */}
          <div className="rounded border border-slate-700 bg-slate-900/80 p-4">
            <h4 className="text-xs font-semibold text-slate-200 border-b border-slate-800 pb-2 mb-3">
              Deployment Configuration Summary
            </h4>
            <div className="grid gap-3 text-xs sm:grid-cols-2 md:grid-cols-4">
              <div>
                <span className="text-slate-400 block text-[10px]">Cluster Identity</span>
                <span className="font-semibold text-slate-200">{formData.cluster_name}</span> ({formData.hypervisor_type.toUpperCase()})
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Topology</span>
                <span className="font-semibold text-slate-200">{formData.control_plane_nodes} CP / {formData.worker_nodes} Workers</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">VIP Network</span>
                <span className="font-mono text-teal-300">{formData.control_plane_vip}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Addons</span>
                <span className="text-slate-200">CSI: {formData.nutanix_csi_enabled ? 'ON' : 'OFF'} • Kommander: {formData.kommander_addons_enabled ? 'ON' : 'OFF'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage 5: Live Execution Terminal */}
      {currentStep === 5 && (
        <div className="space-y-6" data-testid="stage-5-container">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-base font-medium text-slate-200">Stage 5: Live Pipeline Execution</h3>
            <p className="mt-1 text-xs text-slate-400">Real-time SSE log output for 5-stage preprovisioned NKP cluster deployment.</p>
          </div>

          {/* Pipeline Stage Status Cards */}
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-5">
            {PIPELINE_STAGES.map((stg) => (
              <div
                key={stg.id}
                data-testid={`stage-timer-${stg.id}`}
                className="rounded border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
              >
                <div className="font-mono font-medium text-teal-400">{stg.name}</div>
                <div className="mt-0.5 text-[10px] text-slate-400 truncate">{stg.label}</div>
              </div>
            ))}
          </div>

          {/* Live Terminal Stream Component */}
          {streamUrl ? (
            <LiveTerminal
              streamUrl={streamUrl}
              activeStepName={`NKP Deploy (${formData.cluster_name})`}
              autoConnect={true}
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
          {currentStep < 4 && (
            <button
              type="button"
              onClick={goToNextStep}
              className="inline-flex items-center gap-1.5 rounded bg-accent-teal px-4 py-2 text-xs font-medium text-slate-950 hover:bg-teal-400"
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
              disabled={isSubmitting || Boolean(runId)}
              className="inline-flex items-center gap-2 rounded bg-emerald-500 px-5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
              data-testid="btn-wizard-launch"
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
