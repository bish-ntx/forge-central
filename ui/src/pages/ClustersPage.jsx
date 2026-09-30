import React, { useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

const API_BASE = '/api/v1/clusters'

function statusBadgeClasses(status) {
  if (status === 'ready') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'deploying') {
    return 'bg-amber-500/20 text-amber-300'
  }
  if (status === 'failed') {
    return 'bg-rose-500/20 text-rose-300'
  }
  return 'bg-slate-600 text-slate-200'
}

function statusLabel(status) {
  if (status === 'ready') {
    return 'Ready'
  }
  if (status === 'deploying') {
    return 'Deploying'
  }
  if (status === 'failed') {
    return 'Failed'
  }
  return 'Unknown'
}

function ClustersPage() {
  const navigate = useNavigate()
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTargetCluster, setDeleteTargetCluster] = useState(null)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [nodepoolTargetCluster, setNodepoolTargetCluster] = useState(null)
  const [nodepoolForm, setNodepoolForm] = useState({ name: '', replicas: 1, hypervisor: 'proxmox' })
  const [resetTargetCluster, setResetTargetCluster] = useState(null)
  const [resetConfirmationText, setResetConfirmationText] = useState('')

  async function loadClusters() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_BASE)
      if (!response.ok) {
        throw new Error('Failed to fetch clusters')
      }
      const payload = await response.json()
      setClusters(payload.clusters ?? [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch clusters')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadClusters()
  }, [])

  const filteredClusters = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    return clusters.filter((cluster) => {
      if (normalizedSearch.length === 0) {
        return true
      }
      const name = String(cluster.name ?? '').toLowerCase()
      const kubeVersion = String(cluster.kubernetes_version ?? '').toLowerCase()
      return name.includes(normalizedSearch) || kubeVersion.includes(normalizedSearch)
    })
  }, [clusters, searchTerm])

  function openDeleteModal(cluster) {
    setDeleteTargetCluster(cluster)
    setDeleteConfirmationText('')
  }

  function closeDeleteModal() {
    setDeleteTargetCluster(null)
    setDeleteConfirmationText('')
  }

  async function confirmDeleteCluster() {
    if (!deleteTargetCluster || deleteConfirmationText !== deleteTargetCluster.name) {
      return
    }
    setError('')
    try {
      const response = await fetch(`${API_BASE}/${deleteTargetCluster.name}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Cluster deletion request failed')
      }
      closeDeleteModal()
      await loadClusters()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Cluster deletion request failed')
    }
  }

  function openNodepoolModal(cluster) {
    setNodepoolTargetCluster(cluster)
    setNodepoolForm({ name: '', replicas: 1, hypervisor: 'proxmox' })
  }

  async function submitAddNodepool() {
    if (!nodepoolTargetCluster || nodepoolForm.name.trim().length === 0) {
      return
    }
    setError('')
    try {
      const response = await fetch(`${API_BASE}/${nodepoolTargetCluster.name}/nodepools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodepool_name: nodepoolForm.name.trim(),
          replicas: Number(nodepoolForm.replicas),
          hypervisor_type: nodepoolForm.hypervisor,
        }),
      })
      if (!response.ok) {
        throw new Error('Add nodepool request failed')
      }
      setNodepoolTargetCluster(null)
    } catch (nodepoolError) {
      setError(nodepoolError instanceof Error ? nodepoolError.message : 'Add nodepool request failed')
    }
  }

  function openResetModal(cluster) {
    setResetTargetCluster(cluster)
    setResetConfirmationText('')
  }

  async function confirmResetNodes() {
    if (!resetTargetCluster || resetConfirmationText !== 'RESET') {
      return
    }
    setError('')
    try {
      const response = await fetch(`${API_BASE}/${resetTargetCluster.name}/reset-nodes`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Reset nodes request failed')
      }
      setResetTargetCluster(null)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Reset nodes request failed')
    }
  }

  return (
    <section className="rounded border border-slate-700 bg-card-slate p-6" data-testid="page-clusters">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">NKP Clusters</h2>
        <button
          type="button"
          className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900"
          onClick={() => navigate('/clusters/deploy')}
          data-testid="btn-open-deploy-cluster"
        >
          Deploy NKP Cluster
        </button>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search clusters by name or Kubernetes version"
          className="w-full max-w-md rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
          data-testid="input-cluster-search"
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400" data-testid="clusters-page-error">
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {!loading && filteredClusters.length === 0 ? (
          <div
            className="rounded border border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400"
            data-testid="card-cluster-empty"
          >
            No clusters match the current search filter.
          </div>
        ) : null}
        {filteredClusters.map((cluster) => {
          const desiredNodes = Number(cluster.desired_nodes ?? 0)
          const readyNodes = Number(cluster.ready_nodes ?? 0)
          const progressPercent =
            desiredNodes > 0 ? Math.min(100, Math.round((readyNodes / desiredNodes) * 100)) : 0
          return (
            <article
              key={cluster.name}
              className="rounded border border-slate-700 bg-slate-900/70 p-4"
              data-testid={`cluster-card-${cluster.name}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    <Link
                      to={`/clusters/${cluster.name}`}
                      className="hover:text-accent-teal"
                      data-testid={`link-cluster-detail-${cluster.name}`}
                    >
                      {cluster.name}
                    </Link>
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">{cluster.kubernetes_version}</p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClasses(
                    cluster.status,
                  )}`}
                  data-testid={`badge-cluster-status-${cluster.name}`}
                >
                  {statusLabel(cluster.status)}
                </span>
              </div>

              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>Ready {readyNodes}/{desiredNodes} nodes</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 rounded bg-slate-700" data-testid={`bar-cluster-progress-${cluster.name}`}>
                  <div
                    className="h-2 rounded bg-emerald-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-300" data-testid={`text-cluster-metallb-${cluster.name}`}>
                MetalLB VIP Range: {cluster.metallb?.vip_range || 'Not configured'}
              </p>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200"
                  onClick={() => openNodepoolModal(cluster)}
                  data-testid={`btn-add-nodepool-${cluster.name}`}
                >
                  <Plus size={14} />
                  Add Nodepool
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => openResetModal(cluster)}
                  data-testid={`btn-reset-nodes-${cluster.name}`}
                >
                  <RotateCcw size={14} />
                  Reset Nodes
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded bg-rose-700 px-3 py-1.5 text-xs font-medium text-white"
                  onClick={() => openDeleteModal(cluster)}
                  data-testid={`btn-cluster-delete-${cluster.name}`}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-700 text-sm" data-testid="table-clusters">
          <thead className="bg-slate-800/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Cluster</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Kubernetes</th>
              <th className="px-3 py-2">Node Health</th>
              <th className="px-3 py-2">MetalLB VIP Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {filteredClusters.map((cluster) => (
              <tr key={`row-${cluster.name}`} data-testid={`row-cluster-${cluster.name}`}>
                <td className="px-3 py-2">
                  <Link
                    to={`/clusters/${cluster.name}`}
                    className="hover:text-accent-teal"
                    data-testid={`link-cluster-detail-${cluster.name}`}
                  >
                    {cluster.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{statusLabel(cluster.status)}</td>
                <td className="px-3 py-2">{cluster.kubernetes_version}</td>
                <td className="px-3 py-2">
                  Ready {cluster.ready_nodes}/{cluster.desired_nodes} nodes
                </td>
                <td className="px-3 py-2">{cluster.metallb?.vip_range || 'Not configured'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTargetCluster ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-confirm-cluster-delete"
          >
            <h3 className="text-lg font-semibold text-slate-100">Confirm Cluster Delete</h3>
            <p className="mt-2 text-sm text-slate-300">
              Type <span className="font-semibold text-rose-300">{deleteTargetCluster.name}</span> to
              confirm deletion.
            </p>
            <input
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={deleteConfirmationText}
              onChange={(event) => setDeleteConfirmationText(event.target.value)}
              data-testid="input-confirm-cluster-delete"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCluster}
                disabled={deleteConfirmationText !== deleteTargetCluster.name}
                className="rounded bg-rose-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                data-testid="btn-confirm-cluster-delete"
              >
                Delete Cluster
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {nodepoolTargetCluster ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-add-nodepool"
          >
            <h3 className="text-lg font-semibold text-slate-100">
              Add Nodepool to {nodepoolTargetCluster.name}
            </h3>
            <input
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Nodepool name"
              value={nodepoolForm.name}
              onChange={(event) => setNodepoolForm({ ...nodepoolForm, name: event.target.value })}
              data-testid="input-nodepool-name"
            />
            <input
              type="number"
              min="1"
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={nodepoolForm.replicas}
              onChange={(event) => setNodepoolForm({ ...nodepoolForm, replicas: event.target.value })}
              data-testid="input-nodepool-replicas"
            />
            <select
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={nodepoolForm.hypervisor}
              onChange={(event) => setNodepoolForm({ ...nodepoolForm, hypervisor: event.target.value })}
              data-testid="select-nodepool-hypervisor"
            >
              <option value="proxmox">Proxmox</option>
              <option value="ahv">Nutanix AHV</option>
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNodepoolTargetCluster(null)}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                data-testid="btn-cancel-add-nodepool"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAddNodepool}
                disabled={nodepoolForm.name.trim().length === 0}
                className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                data-testid="btn-submit-add-nodepool"
              >
                Add Nodepool
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetTargetCluster ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/70">
          <div
            className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-confirm-reset-nodes"
          >
            <h3 className="text-lg font-semibold text-slate-100">Confirm Reset Nodes</h3>
            <p className="mt-2 text-sm text-slate-300">
              Type <span className="font-semibold text-rose-300">RESET</span> to reset all nodes of{' '}
              {resetTargetCluster.name}.
            </p>
            <input
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={resetConfirmationText}
              onChange={(event) => setResetConfirmationText(event.target.value)}
              data-testid="input-confirm-reset-nodes"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTargetCluster(null)}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                data-testid="btn-cancel-reset-nodes"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmResetNodes}
                disabled={resetConfirmationText !== 'RESET'}
                className="rounded bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                data-testid="btn-confirm-reset-nodes"
              >
                Reset Nodes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default ClustersPage
