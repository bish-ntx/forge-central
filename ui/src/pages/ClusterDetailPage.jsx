import React, { useEffect, useState } from 'react'
import { ArrowLeft, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SafetySnapshotNotice from '../components/common/SafetySnapshotNotice.jsx'
import { roleHeaders, useRole } from '../context/RoleContext.jsx'

const API_BASE = '/api/v1/clusters'

const SEED_NODES = [
  { name: 'cp-1', role: 'control-plane', status: 'ready' },
  { name: 'worker-1', role: 'worker', status: 'ready' },
  { name: 'worker-2', role: 'worker', status: 'notready' },
]
const SEED_NODEPOOLS = [
  { name: 'worker-pool-1', replicas: 3, hypervisor_type: 'proxmox', status: 'ready' },
  { name: 'worker-pool-2', replicas: 2, hypervisor_type: 'proxmox', status: 'ready' },
]

function seedCluster(name) {
  return {
    name,
    status: 'ready',
    kubernetes_version: 'v1.31.1',
    desired_nodes: 3,
    ready_nodes: 2,
    metallb: { vip_range: '10.10.40.100-10.10.40.120', address_pool: 'default-pool' },
  }
}

function badgeClasses(status) {
  if (status === 'ready') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'deploying') {
    return 'bg-amber-500/20 text-amber-300'
  }
  if (status === 'failed' || status === 'notready') {
    return 'bg-rose-500/20 text-rose-300'
  }
  return 'bg-slate-600 text-slate-200'
}

function ClusterDetailPage() {
  const { name } = useParams()
  const navigate = useNavigate()
  const { mutationProps } = useRole()
  const [cluster, setCluster] = useState(seedCluster(name))
  const [nodes, setNodes] = useState(SEED_NODES)
  const [nodepools, setNodepools] = useState(SEED_NODEPOOLS)
  const [error, setError] = useState('')
  const [panel, setPanel] = useState(null)
  const [newPoolName, setNewPoolName] = useState('')
  const [resetText, setResetText] = useState('')
  const [deleteText, setDeleteText] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [detailResponse, poolResponse] = await Promise.all([
          fetch(`${API_BASE}/${name}`),
          fetch(`${API_BASE}/${name}/nodepools`),
        ])
        if (detailResponse.ok) {
          const detail = await detailResponse.json()
          setCluster(detail.cluster ?? seedCluster(name))
          setNodes(detail.nodes ?? [])
        }
        if (poolResponse.ok) {
          const pools = await poolResponse.json()
          setNodepools(pools.nodepools ?? [])
        }
      } catch {
        // Backend offline: keep fallback seed data.
      }
    }
    void load()
  }, [name])

  async function postAction(path, options, failureMessage) {
    setError('')
    try {
      const response = await fetch(`${API_BASE}/${name}${path}`, options)
      if (!response.ok) {
        throw new Error(failureMessage)
      }
      return true
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : failureMessage)
      return false
    }
  }

  async function submitNodepool(pool) {
    const ok = await postAction(
      '/nodepools',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodepool_name: pool.name,
          replicas: pool.replicas,
          hypervisor_type: pool.hypervisor_type ?? 'proxmox',
        }),
      },
      'Nodepool request failed',
    )
    if (ok) {
      setNodepools((current) =>
        current.some((item) => item.name === pool.name)
          ? current.map((item) => (item.name === pool.name ? { ...item, replicas: pool.replicas } : item))
          : [...current, { status: 'ready', hypervisor_type: 'proxmox', ...pool }],
      )
    }
    return ok
  }

  async function addNodepool() {
    if (newPoolName.trim().length === 0) {
      return
    }
    if (await submitNodepool({ name: newPoolName.trim(), replicas: 1, hypervisor_type: 'proxmox' })) {
      setPanel(null)
      setNewPoolName('')
    }
  }

  async function resetNodes() {
    if (resetText === 'RESET' && (await postAction('/reset-nodes', { method: 'POST', headers: roleHeaders() }, 'Reset nodes request failed'))) {
      setPanel(null)
      setResetText('')
    }
  }

  async function deleteCluster() {
    if (
      deleteText === 'DELETE' &&
      (await postAction('', { method: 'DELETE', headers: roleHeaders() }, 'Cluster deletion request failed'))
    ) {
      navigate('/clusters')
    }
  }

  return (
    <section className="rounded border border-slate-700 bg-card-slate p-6" data-testid="page-cluster-detail">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/clusters"
            className="inline-flex items-center gap-1 rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
            data-testid="btn-back-clusters"
          >
            <ArrowLeft size={14} />
            Back
          </Link>
          <h2 className="text-xl font-semibold text-slate-100" data-testid="text-cluster-detail-name">
            {cluster.name}
          </h2>
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${badgeClasses(cluster.status)}`}
            data-testid="badge-cluster-detail-status"
          >
            {cluster.status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200"
            onClick={() => setPanel('add')}
            data-testid="btn-detail-add-nodepool"
            {...mutationProps()}
          >
            <Plus size={14} />
            Add Nodepool
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded bg-amber-700 px-3 py-1.5 text-sm text-white"
            onClick={() => setPanel('reset')}
            data-testid="btn-detail-reset-nodes"
            {...mutationProps()}
          >
            <RotateCcw size={14} />
            Reset Nodes
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded bg-rose-700 px-3 py-1.5 text-sm text-white"
            onClick={() => setPanel('delete')}
            data-testid="btn-detail-delete-cluster"
            {...mutationProps()}
          >
            <Trash2 size={14} />
            Delete Cluster
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400" data-testid="cluster-detail-error">
          {error}
        </p>
      ) : null}

      {panel === 'add' ? (
        <div className="mt-4 flex gap-2" data-testid="panel-detail-add-nodepool">
          <input
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            placeholder="Nodepool name"
            value={newPoolName}
            onChange={(event) => setNewPoolName(event.target.value)}
            data-testid="input-detail-nodepool-name"
          />
          <button
            type="button"
            className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900"
            onClick={addNodepool}
            data-testid="btn-detail-submit-nodepool"
            {...mutationProps()}
          >
            Create
          </button>
        </div>
      ) : null}
      {panel === 'reset' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="panel-detail-reset-nodes">
          <span className="text-sm text-slate-300">Type RESET to confirm:</span>
          <SafetySnapshotNotice />
          <input
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            value={resetText}
            onChange={(event) => setResetText(event.target.value)}
            data-testid="input-detail-confirm-reset"
          />
          <button
            type="button"
            className="rounded bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={resetText !== 'RESET'}
            onClick={resetNodes}
            data-testid="btn-detail-confirm-reset"
          >
            Confirm
          </button>
        </div>
      ) : null}
      {panel === 'delete' ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="panel-detail-delete-cluster">
          <span className="text-sm text-slate-300">
            Delete {cluster.name}? This cannot be undone. Type DELETE to confirm:
          </span>
          <SafetySnapshotNotice />
          <input
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            value={deleteText}
            onChange={(event) => setDeleteText(event.target.value)}
            data-testid="input-detail-confirm-delete"
          />
          <button
            type="button"
            className="rounded bg-rose-700 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={deleteText !== 'DELETE'}
            onClick={deleteCluster}
            data-testid="btn-detail-confirm-delete"
          >
            Confirm Delete
          </button>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-3 text-sm text-slate-300 md:grid-cols-3">
        <div data-testid="text-cluster-detail-version">Kubernetes: {cluster.kubernetes_version}</div>
        <div data-testid="text-cluster-detail-nodes">
          Ready {cluster.ready_nodes}/{cluster.desired_nodes} nodes
        </div>
        <div data-testid="text-cluster-detail-metallb">
          MetalLB VIP Range: {cluster.metallb?.vip_range || 'Not configured'}
        </div>
      </dl>

      <h3 className="mt-6 text-lg font-semibold text-slate-100">Nodes</h3>
      <table className="mt-2 min-w-full divide-y divide-slate-700 text-sm" data-testid="table-cluster-nodes">
        <thead className="bg-slate-800/70 text-left text-slate-300">
          <tr>
            <th className="px-3 py-2">Node</th>
            <th className="px-3 py-2">Role</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-slate-200">
          {nodes.map((node) => (
            <tr key={node.name}>
              <td className="px-3 py-2">{node.name}</td>
              <td className="px-3 py-2">{node.role}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${badgeClasses(node.status)}`}
                  data-testid={`badge-node-status-${node.name}`}
                >
                  {node.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div data-testid="section-nodepools">
        <h3 className="mt-6 text-lg font-semibold text-slate-100">Nodepools</h3>
        <table className="mt-2 min-w-full divide-y divide-slate-700 text-sm">
          <thead className="bg-slate-800/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Nodepool</th>
              <th className="px-3 py-2">Hypervisor</th>
              <th className="px-3 py-2">Replicas</th>
              <th className="px-3 py-2">Scale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {nodepools.map((pool) => (
              <tr key={pool.name} data-testid={`row-nodepool-${pool.name}`}>
                <td className="px-3 py-2">{pool.name}</td>
                <td className="px-3 py-2">{pool.hypervisor_type}</td>
                <td className="px-3 py-2" data-testid={`text-replicas-${pool.name}`}>
                  {pool.replicas}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-600 p-1"
                      aria-label={`Scale down ${pool.name}`}
                      onClick={() => submitNodepool({ ...pool, replicas: pool.replicas - 1 })}
                      data-testid={`btn-scale-down-${pool.name}`}
                      {...mutationProps(pool.replicas <= 0)}
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-600 p-1"
                      aria-label={`Scale up ${pool.name}`}
                      onClick={() => submitNodepool({ ...pool, replicas: pool.replicas + 1 })}
                      data-testid={`btn-scale-up-${pool.name}`}
                      {...mutationProps()}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ClusterDetailPage
