import React, { useEffect, useMemo, useState } from 'react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'

const API_BASE = '/api/v1/vms'

const DEFAULT_CREATE_FORM = {
  name: '',
  node: '',
  cores: 2,
  memory_mb: 4096,
  disk_gb: 40,
  hypervisor_type: 'proxmox',
}

function VmListPage() {
  const [vms, setVms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [nodeFilter, setNodeFilter] = useState('all')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CREATE_FORM)
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false)
  const [destroyTargetVm, setDestroyTargetVm] = useState(null)
  const [destroyConfirmationText, setDestroyConfirmationText] = useState('')
  const [selectedVmids, setSelectedVmids] = useState([])
  const [isBatchDestroyOpen, setIsBatchDestroyOpen] = useState(false)
  const [batchDestroyText, setBatchDestroyText] = useState('')

  async function loadVms() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_BASE)
      if (!response.ok) {
        throw new Error('Failed to fetch VM list')
      }
      const payload = await response.json()
      setVms(payload.vms ?? [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch VM list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadVms()
  }, [])

  const nodeOptions = useMemo(() => {
    const nodes = new Set(vms.map((vm) => vm.node))
    return ['all', ...Array.from(nodes).sort()]
  }, [vms])

  const filteredVms = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return vms.filter((vm) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        String(vm.name).toLowerCase().includes(normalizedSearch) ||
        String(vm.vmid).includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || vm.status === statusFilter
      const matchesNode = nodeFilter === 'all' || vm.node === nodeFilter
      return matchesSearch && matchesStatus && matchesNode
    })
  }, [nodeFilter, searchTerm, statusFilter, vms])

  const allFilteredSelected =
    filteredVms.length > 0 && filteredVms.every((vm) => selectedVmids.includes(vm.vmid))

  function toggleVmSelection(vmid) {
    setSelectedVmids((current) =>
      current.includes(vmid) ? current.filter((id) => id !== vmid) : [...current, vmid],
    )
  }

  function toggleSelectAll() {
    setSelectedVmids(allFilteredSelected ? [] : filteredVms.map((vm) => vm.vmid))
  }

  async function runBatchAction(action) {
    setError('')
    try {
      const response = await fetch(`${API_BASE}/batch-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmids: selectedVmids, action }),
      })
      if (!response.ok) {
        throw new Error(`Batch ${action} failed`)
      }
      setSelectedVmids([])
      await loadVms()
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Batch action failed')
    }
  }

  function closeBatchDestroyModal() {
    setIsBatchDestroyOpen(false)
    setBatchDestroyText('')
  }

  async function confirmBatchDestroy() {
    if (batchDestroyText !== 'DESTROY') {
      return
    }
    await runBatchAction('destroy')
    closeBatchDestroyModal()
  }

  function openCreateVmModal() {
    setCreateForm(DEFAULT_CREATE_FORM)
    setIsCreateModalOpen(true)
  }

  function closeCreateVmModal() {
    setIsCreateModalOpen(false)
  }

  async function submitCreateVm(event) {
    event.preventDefault()
    setIsCreateSubmitting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!response.ok) {
        throw new Error('VM creation request failed')
      }
      closeCreateVmModal()
      await loadVms()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'VM creation request failed')
    } finally {
      setIsCreateSubmitting(false)
    }
  }

  async function runVmAction(vmid, action) {
    const response = await fetch(`${API_BASE}/${vmid}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!response.ok) {
      throw new Error(`${action} action failed`)
    }
    await loadVms()
  }

  async function handleVmAction(vmid, action) {
    setError('')
    try {
      await runVmAction(vmid, action)
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'VM action failed')
    }
  }

  function requestDestroy(vm) {
    setDestroyTargetVm(vm)
    setDestroyConfirmationText('')
  }

  function closeDestroyModal() {
    setDestroyTargetVm(null)
    setDestroyConfirmationText('')
  }

  async function confirmDestroy() {
    if (!destroyTargetVm || destroyConfirmationText !== destroyTargetVm.name) {
      return
    }
    await handleVmAction(destroyTargetVm.vmid, 'destroy')
    closeDestroyModal()
  }

  return (
    <section
      className="rounded border border-slate-700 bg-card-slate p-6"
      data-testid="page-vms"
    >
      <h2 className="text-xl font-semibold text-slate-100">VMs</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by name or VMID"
          className="w-64 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          data-testid="input-vm-search"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          data-testid="select-vm-status-filter"
        >
          <option value="all">All Status</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
        </select>
        <select
          value={nodeFilter}
          onChange={(event) => setNodeFilter(event.target.value)}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          data-testid="select-vm-node-filter"
        >
          {nodeOptions.map((node) => (
            <option key={node} value={node}>
              {node === 'all' ? 'All Nodes' : node}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={openCreateVmModal}
          className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900"
          data-testid="btn-open-create-vm-modal"
        >
          Create VM
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400" data-testid="vm-page-error">
          {error}
        </p>
      ) : null}

      {selectedVmids.length > 0 ? (
        <div
          className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3 py-2"
          data-testid="batch-action-bar"
        >
          <span className="text-sm font-medium text-slate-100">
            {selectedVmids.length} {selectedVmids.length === 1 ? 'VM' : 'VMs'} selected
          </span>
          <button
            type="button"
            onClick={() => runBatchAction('start')}
            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
            data-testid="btn-batch-start"
          >
            Start Selected
          </button>
          <button
            type="button"
            onClick={() => runBatchAction('stop')}
            className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
            data-testid="btn-batch-stop"
          >
            Stop Selected
          </button>
          <button
            type="button"
            onClick={() => runBatchAction('restart')}
            className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white"
            data-testid="btn-batch-restart"
          >
            Restart Selected
          </button>
          <button
            type="button"
            onClick={() => setIsBatchDestroyOpen(true)}
            className="rounded bg-rose-700 px-2 py-1 text-xs font-medium text-white"
            data-testid="btn-batch-destroy"
          >
            Destroy Selected
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700 text-sm" data-testid="table-vms">
          <thead className="bg-slate-800/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  data-testid="checkbox-select-all-vms"
                />
              </th>
              <th className="px-3 py-2">VMID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Node</th>
              <th className="px-3 py-2">CPUs</th>
              <th className="px-3 py-2">RAM</th>
              <th className="px-3 py-2">Disk</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">GPU Passthrough</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {!loading && filteredVms.length === 0 ? (
              <tr data-testid="row-vm-empty">
                <td className="px-3 py-4 text-slate-400" colSpan={10}>
                  No VMs match the current filters.
                </td>
              </tr>
            ) : null}
            {filteredVms.map((vm) => {
              const hasGpuPassthrough =
                Boolean(vm.gpu_passthrough) || (vm.pci_devices?.length ?? 0) > 0
              return (
                <tr key={vm.vmid} data-testid={`row-vm-${vm.vmid}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedVmids.includes(vm.vmid)}
                      onChange={() => toggleVmSelection(vm.vmid)}
                      data-testid={`checkbox-vm-${vm.vmid}`}
                    />
                  </td>
                  <td className="px-3 py-2">{vm.vmid}</td>
                  <td className="px-3 py-2">{vm.name}</td>
                  <td className="px-3 py-2">{vm.node}</td>
                  <td className="px-3 py-2">{vm.cores}</td>
                  <td className="px-3 py-2">{vm.memory_mb} MB</td>
                  <td className="px-3 py-2">{vm.disk_gb} GB</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        vm.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-600 text-slate-200'
                      }`}
                    >
                      {vm.status === 'running' ? 'Running' : 'Stopped'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        hasGpuPassthrough
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {hasGpuPassthrough ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleVmAction(vm.vmid, 'start')}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-vm-start-${vm.vmid}`}
                      >
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVmAction(vm.vmid, 'stop')}
                        className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-vm-stop-${vm.vmid}`}
                      >
                        Stop
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVmAction(vm.vmid, 'restart')}
                        className="rounded bg-sky-600 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-vm-restart-${vm.vmid}`}
                      >
                        Restart
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDestroy(vm)}
                        className="rounded bg-rose-700 px-2 py-1 text-xs font-medium text-white"
                        data-testid={`btn-vm-destroy-${vm.vmid}`}
                      >
                        Destroy
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isCreateModalOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-create-vm"
          >
            <h3 className="text-lg font-semibold text-slate-100">Create VM</h3>
            <form className="mt-4 space-y-3" onSubmit={submitCreateVm}>
              <input
                required
                placeholder="VM name"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                data-testid="input-create-vm-name"
              />
              <input
                required
                placeholder="Node"
                value={createForm.node}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, node: event.target.value }))
                }
                className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                data-testid="input-create-vm-node"
              />
              <div className="grid grid-cols-3 gap-3">
                <input
                  type="number"
                  min={1}
                  value={createForm.cores}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      cores: Number(event.target.value),
                    }))
                  }
                  className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  data-testid="input-create-vm-cores"
                />
                <input
                  type="number"
                  min={256}
                  value={createForm.memory_mb}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      memory_mb: Number(event.target.value),
                    }))
                  }
                  className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  data-testid="input-create-vm-memory"
                />
                <input
                  type="number"
                  min={5}
                  value={createForm.disk_gb}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      disk_gb: Number(event.target.value),
                    }))
                  }
                  className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
                  data-testid="input-create-vm-disk"
                />
              </div>
              <CliSnippetCard
                command={`./forge vm-create --name ${createForm.name || '<vm-name>'} --node ${createForm.node || '<node>'} --cores ${createForm.cores} --memory-mb ${createForm.memory_mb}`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCreateVmModal}
                  className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateSubmitting}
                  className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                  data-testid="btn-submit-create-vm"
                >
                  {isCreateSubmitting ? 'Creating...' : 'Create VM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {destroyTargetVm ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-confirm-vm-destroy"
          >
            <h3 className="text-lg font-semibold text-slate-100">Confirm VM Destroy</h3>
            <p className="mt-2 text-sm text-slate-300">
              Type <span className="font-semibold text-rose-300">{destroyTargetVm.name}</span> to
              confirm deletion.
            </p>
            <input
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={destroyConfirmationText}
              onChange={(event) => setDestroyConfirmationText(event.target.value)}
              data-testid="input-confirm-vm-destroy"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDestroyModal}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDestroy}
                disabled={destroyConfirmationText !== destroyTargetVm.name}
                className="rounded bg-rose-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                data-testid="btn-confirm-vm-destroy"
              >
                Destroy VM
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isBatchDestroyOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-confirm-batch-destroy"
          >
            <h3 className="text-lg font-semibold text-slate-100">Confirm Batch Destroy</h3>
            <p className="mt-2 text-sm text-slate-300">
              Type <span className="font-semibold text-rose-300">DESTROY</span> to permanently
              delete {selectedVmids.length} selected {selectedVmids.length === 1 ? 'VM' : 'VMs'}.
            </p>
            <input
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={batchDestroyText}
              onChange={(event) => setBatchDestroyText(event.target.value)}
              data-testid="input-confirm-batch-destroy"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeBatchDestroyModal}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                data-testid="btn-cancel-batch-destroy"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBatchDestroy}
                disabled={batchDestroyText !== 'DESTROY'}
                className="rounded bg-rose-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                data-testid="btn-confirm-batch-destroy"
              >
                Destroy Selected
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default VmListPage
