import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Cpu, Network, X } from 'lucide-react'
import CliSnippetCard from '../common/CliSnippetCard.jsx'
import { roleHeaders, useRole } from '../../context/RoleContext.jsx'

const API_BASE = '/api/v1/vms'

async function readError(response, fallback) {
  try {
    const body = await response.json()
    return typeof body?.detail === 'string' ? body.detail : fallback
  } catch {
    return fallback
  }
}

function typeLabel(deviceType) {
  if (deviceType === 'gpu') return 'GPU'
  if (deviceType === 'nic') return 'NIC'
  return 'Other'
}

export function buildAttachCommand({ vmid, deviceType, forceStop }) {
  return `./forge passthrough attach --vmid ${vmid || '<vmid>'} --device ${deviceType || 'gpu'}${
    forceStop ? ' --stop' : ''
  }`
}

/**
 * PCI Hardware Inventory drawer (`modal-hardware-pci`) with the Attach PCI Device modal
 * (`modal-attach-pci`). `vms` supplies VM power states for the safety check.
 */
function HardwarePciDrawer({ vms = [], onClose, onChanged }) {
  const { mutationProps } = useRole()
  const [inventory, setInventory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachBdf, setAttachBdf] = useState('')
  const [attachVmid, setAttachVmid] = useState('')
  const [forceStop, setForceStop] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadInventory = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/hardware/pci`)
      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to discover PCI hardware'))
      }
      setInventory(await response.json())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to discover PCI hardware')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  const devices = inventory?.pci_devices ?? []
  const unassignedDevices = useMemo(
    () => devices.filter((device) => device.assigned_vmid == null && device.device_type !== 'other'),
    [devices],
  )
  const selectedDevice = devices.find((device) => device.pci_bdf === attachBdf)
  const selectedVm = vms.find((vm) => String(vm.vmid) === String(attachVmid))
  const vmRunning = selectedVm?.status === 'running'

  function openAttachModal(bdf = '') {
    setAttachBdf(bdf || unassignedDevices[0]?.pci_bdf || '')
    setAttachVmid(vms[0] ? String(vms[0].vmid) : '')
    setForceStop(false)
    setError('')
    setAttachOpen(true)
  }

  async function postPassthrough(vmid, action, body) {
    const response = await fetch(`${API_BASE}/${vmid}/passthrough/${action}`, {
      method: 'POST',
      headers: roleHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(await readError(response, `PCI ${action} request failed`))
    }
    return response.json()
  }

  async function submitAttach(event) {
    event.preventDefault()
    if (!attachBdf || !attachVmid || (vmRunning && !forceStop)) {
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await postPassthrough(attachVmid, 'attach', {
        vmid: Number(attachVmid),
        device_type: selectedDevice?.device_type === 'nic' ? 'nic' : 'gpu',
        pci_bdf: attachBdf,
        force_stop: forceStop,
      })
      setAttachOpen(false)
      setNotice(`Attach of ${attachBdf} to VM ${attachVmid} queued`)
      await loadInventory()
      await onChanged?.()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'PCI attach request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function detachDevice(device) {
    setError('')
    const vm = vms.find((item) => item.vmid === device.assigned_vmid)
    try {
      await postPassthrough(device.assigned_vmid, 'detach', {
        vmid: device.assigned_vmid,
        device_type: device.device_type === 'nic' ? 'nic' : 'gpu',
        pci_bdf: device.pci_bdf,
        force_stop: false,
      })
      setNotice(`Detach of ${device.pci_bdf} from VM ${device.assigned_vmid} queued`)
      await loadInventory()
      await onChanged?.()
    } catch (detachError) {
      const suffix = vm?.status === 'running' ? ' (stop the VM first)' : ''
      setError(`${detachError instanceof Error ? detachError.message : 'PCI detach request failed'}${suffix}`)
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-slate-900/70">
      <aside
        className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-700 bg-slate-900 p-5"
        data-testid="modal-hardware-pci"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-100">PCI Hardware Inventory</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PCI hardware inventory"
            className="rounded border border-slate-600 p-1 text-slate-300"
            data-testid="btn-close-hardware-inventory"
          >
            <X size={16} />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Discovered via <code>./forge discover hardware</code> and <code>./forge passthrough list</code>.
        </p>

        {inventory ? (
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-200" data-testid="pci-inventory-summary">
            <span className="inline-flex items-center gap-1 rounded bg-violet-500/20 px-2 py-1 text-violet-300">
              <Cpu size={14} />
              <span data-testid="text-total-gpus">{inventory.total_gpus}</span> GPUs
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-sky-500/20 px-2 py-1 text-sky-300">
              <Network size={14} />
              <span data-testid="text-total-nics">{inventory.total_nics}</span> NICs
            </span>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-sm text-red-400" data-testid="pci-hardware-error">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 text-sm text-emerald-300" data-testid="pci-hardware-notice">
            {notice}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => openAttachModal()}
            className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900"
            data-testid="btn-open-attach-pci"
            {...mutationProps(unassignedDevices.length === 0)}
          >
            Attach PCI Device
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700 text-sm" data-testid="table-pci-devices">
            <thead className="bg-slate-800/70 text-left text-slate-300">
              <tr>
                <th className="px-3 py-2">PCI BDF</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Vendor</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Assignment</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {!loading && devices.length === 0 ? (
                <tr data-testid="row-pci-empty">
                  <td className="px-3 py-4 text-slate-400" colSpan={6}>
                    No GPU or Pensando devices discovered.
                  </td>
                </tr>
              ) : null}
              {devices.map((device) => (
                <tr key={device.pci_bdf} data-testid={`row-pci-${device.pci_bdf}`}>
                  <td className="px-3 py-2 font-mono text-xs">{device.pci_bdf}</td>
                  <td className="px-3 py-2">{typeLabel(device.device_type)}</td>
                  <td className="px-3 py-2">{device.vendor}</td>
                  <td className="px-3 py-2 text-xs text-slate-300">{device.description}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        device.assigned_vmid != null
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                      data-testid={`badge-pci-assignment-${device.pci_bdf}`}
                    >
                      {device.assigned_vmid != null
                        ? `${device.assigned_vm_name ?? 'VM'} (${device.assigned_vmid})`
                        : 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {device.assigned_vmid != null ? (
                      <button
                        type="button"
                        onClick={() => detachDevice(device)}
                        className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-detach-pci-${device.pci_bdf}`}
                        {...mutationProps()}
                      >
                        Detach
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAttachModal(device.pci_bdf)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-attach-pci-${device.pci_bdf}`}
                        {...mutationProps()}
                      >
                        Attach
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {attachOpen ? (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
            <form
              className="w-full max-w-lg space-y-3 rounded border border-slate-700 bg-slate-900 p-5"
              data-testid="modal-attach-pci"
              onSubmit={submitAttach}
            >
              <h3 className="text-lg font-semibold text-slate-100">Attach PCI Device</h3>
              <select
                value={attachBdf}
                onChange={(event) => setAttachBdf(event.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                data-testid="select-attach-pci-device"
              >
                {unassignedDevices.map((device) => (
                  <option key={device.pci_bdf} value={device.pci_bdf}>
                    {`${device.pci_bdf} — ${typeLabel(device.device_type)} — ${device.vendor}`}
                  </option>
                ))}
              </select>
              <select
                value={attachVmid}
                onChange={(event) => {
                  setAttachVmid(event.target.value)
                  setForceStop(false)
                }}
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                data-testid="select-attach-pci-vm"
              >
                {vms.map((vm) => (
                  <option key={vm.vmid} value={vm.vmid}>
                    {`${vm.vmid} — ${vm.name} (${vm.status})`}
                  </option>
                ))}
              </select>
              <p
                className={`rounded border px-3 py-2 text-xs ${
                  vmRunning
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-200'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}
                data-testid="warning-attach-pci-power"
              >
                {vmRunning
                  ? `VM ${attachVmid} is running. PCI passthrough can only be changed while the VM is stopped — tick "Stop VM first" to stop it before attaching (it is not restarted automatically).`
                  : 'PCI passthrough can only be attached while the VM is stopped; the VM is not started automatically.'}
              </p>
              {vmRunning ? (
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={forceStop}
                    onChange={(event) => setForceStop(event.target.checked)}
                    data-testid="checkbox-attach-force-stop"
                  />
                  Stop VM first
                </label>
              ) : null}
              <CliSnippetCard
                command={buildAttachCommand({
                  vmid: attachVmid,
                  deviceType: selectedDevice?.device_type === 'nic' ? 'nic' : 'gpu',
                  forceStop,
                })}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAttachOpen(false)}
                  className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                  data-testid="btn-cancel-attach-pci"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !attachBdf || !attachVmid || (vmRunning && !forceStop)}
                  className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                  data-testid="btn-submit-attach-pci"
                >
                  {submitting ? 'Attaching...' : 'Attach'}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </aside>
    </div>
  )
}

export default HardwarePciDrawer
