import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Cpu, Plus } from 'lucide-react'
import CliSnippetCard from '../common/CliSnippetCard.jsx'
import { roleHeaders, useRole } from '../../context/RoleContext.jsx'

const VMS_API = '/api/v1/vms'

async function readError(response, fallback) {
  try {
    const body = await response.json()
    return typeof body?.detail === 'string' ? body.detail : fallback
  } catch {
    return fallback
  }
}

function isGpuWorker(vm) {
  return (vm.vmid >= 300 && vm.vmid < 400) || Boolean(vm.gpu_passthrough)
}

export function buildProvisionCommand(clusterName) {
  return `./forge provision gpu-vms --conf ${clusterName}-input.ini`
}

export function buildAttachPreview(form, vmid = '<vmid>') {
  return `${form.gpu_bdf ? `GPU_PCIE_DEVICE=${form.gpu_bdf} ` : ''}./forge passthrough attach --vmid ${vmid} --device gpu`
}

/** GPU worker status card (`section-gpu-workers`) with the Add GPU Worker VM modal. */
function GpuWorkersSection({ clusterName }) {
  const { mutationProps } = useRole()
  const [vms, setVms] = useState([])
  const [devices, setDevices] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ gpu_worker_count: 1, gpu_bdf: '', nic_bdf: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [vmResponse, hwResponse] = await Promise.all([fetch(VMS_API), fetch(`${VMS_API}/hardware/pci`)])
      if (vmResponse.ok) {
        const payload = await vmResponse.json()
        setVms(Array.isArray(payload?.vms) ? payload.vms : [])
      }
      if (hwResponse.ok) {
        const payload = await hwResponse.json()
        setDevices(Array.isArray(payload?.pci_devices) ? payload.pci_devices : [])
      }
    } catch {
      // Backend offline: the card renders empty.
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const gpuWorkers = useMemo(() => vms.filter(isGpuWorker), [vms])
  const freeGpus = useMemo(
    () => devices.filter((item) => item.device_type === 'gpu' && item.assigned_vmid == null),
    [devices],
  )
  const freeNics = useMemo(
    () => devices.filter((item) => item.device_type === 'nic' && item.assigned_vmid == null),
    [devices],
  )

  async function submitProvision(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${VMS_API}/provision-gpu`, {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          cluster_name: clusterName,
          gpu_worker_count: Number(form.gpu_worker_count) || 1,
          gpu_bdf: form.gpu_bdf || null,
          nic_bdf: form.nic_bdf || null,
        }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'GPU VM provisioning request failed'))
      }
      const payload = await response.json()
      setModalOpen(false)
      setNotice(`GPU VM provisioning queued (run ${payload.run_id})`)
      await load()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'GPU VM provisioning request failed')
    } finally {
      setSubmitting(false)
    }
  }

  const selectClasses =
    'w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100'

  return (
    <div data-testid="section-gpu-workers">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Cpu size={18} />
          GPU Workers
        </h3>
        <button
          type="button"
          onClick={() => {
            setError('')
            setModalOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded bg-accent-teal px-3 py-1.5 text-sm font-medium text-slate-900"
          data-testid="btn-add-gpu-worker"
          {...mutationProps()}
        >
          <Plus size={14} />
          Add GPU Worker VM
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-400" data-testid="text-gpu-capacity">
        {freeGpus.length} unassigned GPU{freeGpus.length === 1 ? '' : 's'} · {freeNics.length} unassigned NIC
        {freeNics.length === 1 ? '' : 's'}
      </p>

      {notice ? (
        <p className="mt-2 text-sm text-emerald-300" data-testid="gpu-provision-notice">
          {notice}
        </p>
      ) : null}
      {error && !modalOpen ? (
        <p className="mt-2 text-sm text-rose-400" data-testid="gpu-provision-error">
          {error}
        </p>
      ) : null}

      <table className="mt-2 min-w-full divide-y divide-slate-700 text-sm" data-testid="table-gpu-workers">
        <thead className="bg-slate-800/70 text-left text-slate-300">
          <tr>
            <th className="px-3 py-2">VMID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Node</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">PCI Devices</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {gpuWorkers.length === 0 ? (
            <tr data-testid="row-gpu-workers-empty">
              <td className="px-3 py-4 text-slate-400" colSpan={5}>
                No GPU worker VMs provisioned yet.
              </td>
            </tr>
          ) : null}
          {gpuWorkers.map((vm) => (
            <tr key={vm.vmid} data-testid={`row-gpu-worker-${vm.vmid}`}>
              <td className="px-3 py-2">{vm.vmid}</td>
              <td className="px-3 py-2">{vm.name}</td>
              <td className="px-3 py-2">{vm.node}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    vm.status === 'running' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-600 text-slate-200'
                  }`}
                  data-testid={`badge-gpu-worker-status-${vm.vmid}`}
                >
                  {vm.status}
                </span>
              </td>
              <td className="px-3 py-2 font-mono text-xs">{(vm.pci_devices ?? []).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 grid gap-3 md:grid-cols-2" data-testid="gpu-cli-previews">
        <CliSnippetCard title="Copy as CLI — provision GPU VMs" command={buildProvisionCommand(clusterName)} />
        <CliSnippetCard title="Copy as CLI — passthrough attach" command={buildAttachPreview(form)} />
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <form
            className="w-full max-w-lg space-y-3 rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-provision-gpu-vm"
            onSubmit={submitProvision}
          >
            <h3 className="text-lg font-semibold text-slate-100">Add GPU Worker VM</h3>
            <p className="text-xs text-slate-400">
              Clones 300-series GPU worker VMs for {clusterName} via <code>./forge provision gpu-vms</code>.
            </p>
            <label className="block text-xs text-slate-300">
              GPU worker count
              <input
                type="number"
                min={1}
                max={16}
                value={form.gpu_worker_count}
                onChange={(event) => setForm((current) => ({ ...current, gpu_worker_count: event.target.value }))}
                className={`mt-1 ${selectClasses}`}
                data-testid="input-provision-gpu-count"
              />
            </label>
            <label className="block text-xs text-slate-300">
              GPU PCI BDF
              <select
                value={form.gpu_bdf}
                onChange={(event) => setForm((current) => ({ ...current, gpu_bdf: event.target.value }))}
                className={`mt-1 ${selectClasses}`}
                data-testid="select-provision-gpu-bdf"
              >
                <option value="">Auto (from cluster config)</option>
                {freeGpus.map((device) => (
                  <option key={device.pci_bdf} value={device.pci_bdf}>
                    {`${device.pci_bdf} — ${device.vendor}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-300">
              Pensando NIC PCI BDF
              <select
                value={form.nic_bdf}
                onChange={(event) => setForm((current) => ({ ...current, nic_bdf: event.target.value }))}
                className={`mt-1 ${selectClasses}`}
                data-testid="select-provision-nic-bdf"
              >
                <option value="">Auto (from cluster config)</option>
                {freeNics.map((device) => (
                  <option key={device.pci_bdf} value={device.pci_bdf}>
                    {`${device.pci_bdf} — ${device.vendor}`}
                  </option>
                ))}
              </select>
            </label>
            {error ? (
              <p className="text-sm text-rose-400" data-testid="gpu-provision-modal-error">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                data-testid="btn-cancel-provision-gpu"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                data-testid="btn-submit-provision-gpu"
              >
                {submitting ? 'Provisioning...' : 'Provision GPU VM'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default GpuWorkersSection
