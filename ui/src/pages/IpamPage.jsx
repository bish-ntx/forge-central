import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Trash2 } from 'lucide-react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'
import Timestamp from '../components/common/Timestamp.jsx'
import { roleHeaders, useRole } from '../context/RoleContext.jsx'

const IPAM_API = '/api/v1/ipam'
const IPAM_RELEASE_API = '/api/v1/ipam/release'
const IPAM_RECONCILE_API = '/api/v1/ipam/reconcile'
const RELEASE_CONFIRM_WORD = 'RELEASE'

const STATUS_FILTERS = ['all', 'allocated', 'free', 'vip', 'gateway']

const BADGE_CLASSES = {
  allocated: 'bg-sky-500/20 text-sky-300',
  free: 'bg-emerald-500/20 text-emerald-300',
  vip: 'bg-violet-500/20 text-violet-300',
  gateway: 'bg-amber-500/20 text-amber-300',
}

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded px-2 py-1 text-xs font-medium ${BADGE_CLASSES[status] ?? 'bg-slate-600/40 text-slate-300'}`}
      data-testid={`badge-ipam-status-${status}`}
    >
      {String(status).toUpperCase()}
    </span>
  )
}

function KpiCard({ label, value, testId }) {
  return (
    <article className="rounded border border-slate-700 bg-slate-900/70 p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
    </article>
  )
}

async function readError(response, fallback) {
  try {
    const payload = await response.json()
    return typeof payload.detail === 'string' ? payload.detail : fallback
  } catch {
    return fallback
  }
}

function IpamPage() {
  const { mutationProps } = useRole()
  const [ledger, setLedger] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [releaseTarget, setReleaseTarget] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [isReleasing, setIsReleasing] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [reconcile, setReconcile] = useState(null)

  const loadLedger = useCallback(async () => {
    try {
      const response = await fetch(IPAM_API)
      if (!response.ok) {
        throw new Error(await readError(response, 'Failed to load IPAM ledger'))
      }
      setLedger(await response.json())
      setError('')
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load IPAM ledger')
    }
  }, [])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger])

  const slots = ledger?.slots ?? []

  const visibleSlots = useMemo(() => {
    const term = search.trim().toLowerCase()
    return slots.filter((slot) => {
      if (statusFilter !== 'all' && slot.status !== statusFilter) return false
      if (!term) return true
      return [slot.ip, slot.cluster, slot.status, slot.hostname, slot.role].some((value) =>
        String(value ?? '').toLowerCase().includes(term),
      )
    })
  }, [slots, search, statusFilter])

  // One release button per cluster: shown on the first visible row that cluster holds.
  const releaseRowIps = useMemo(() => {
    const seen = new Set()
    const firstRows = new Set()
    visibleSlots.forEach((slot) => {
      if (slot.cluster && slot.status !== 'free' && !seen.has(slot.cluster)) {
        seen.add(slot.cluster)
        firstRows.add(slot.ip)
      }
    })
    return firstRows
  }, [visibleSlots])

  function openReleaseModal(cluster) {
    setReleaseTarget(cluster)
    setConfirmText('')
  }

  function closeReleaseModal() {
    setReleaseTarget(null)
    setConfirmText('')
  }

  async function releaseReservation() {
    setIsReleasing(true)
    setError('')
    try {
      const response = await fetch(IPAM_RELEASE_API, {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ cluster_name: releaseTarget }),
      })
      if (!response.ok) {
        throw new Error(await readError(response, 'IPAM release failed'))
      }
      const payload = await response.json()
      setNotice(`Released ${payload.released_count} IP slot(s) held by ${payload.cluster_name}.`)
      closeReleaseModal()
      await loadLedger()
    } catch (releaseError) {
      setError(releaseError instanceof Error ? releaseError.message : 'IPAM release failed')
    } finally {
      setIsReleasing(false)
    }
  }

  async function reconcileVmids() {
    setIsReconciling(true)
    setError('')
    try {
      const response = await fetch(IPAM_RECONCILE_API, { method: 'POST', headers: roleHeaders() })
      if (!response.ok) {
        throw new Error(await readError(response, 'VMID reconciliation failed'))
      }
      setReconcile(await response.json())
    } catch (reconcileError) {
      setReconcile(null)
      setError(reconcileError instanceof Error ? reconcileError.message : 'VMID reconciliation failed')
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <section className="space-y-5 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-ipam">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">IPAM Ledger &amp; Subnet Manager</h2>
          <p className="mt-1 text-xs text-slate-400" data-testid="text-ipam-pool">
            Pool: <span className="font-mono text-slate-200">{ledger?.ip_pool || '—'}</span>
            {ledger?.updated_at ? (
              <>
                {' '}· Updated <Timestamp value={ledger.updated_at} />
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadLedger()}
            className="flex items-center gap-1 rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
            data-testid="btn-refresh-ipam"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={() => void reconcileVmids()}
            className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
            data-testid="btn-reconcile-ipam"
            {...mutationProps(isReconciling)}
          >
            {isReconciling ? 'Reconciling...' : 'Reconcile VMIDs'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Total IPs" value={ledger?.total_slots ?? 0} testId="card-ipam-total" />
        <KpiCard label="Allocated IPs" value={ledger?.allocated_slots ?? 0} testId="card-ipam-allocated" />
        <KpiCard label="Free IPs" value={ledger?.free_slots ?? 0} testId="card-ipam-free" />
      </div>

      {reconcile ? (
        <div
          className={`rounded border p-3 text-sm ${
            reconcile.discrepancies_found > 0
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          }`}
          data-testid="panel-reconcile-result"
        >
          <p className="font-medium" data-testid="text-reconcile-summary">
            {reconcile.discrepancies_found > 0
              ? `${reconcile.discrepancies_found} VMID discrepanc${reconcile.discrepancies_found === 1 ? 'y' : 'ies'} found`
              : 'Ledger and live Proxmox state agree — no VMID drift'}
          </p>
          {reconcile.details.length > 0 ? (
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {reconcile.details.map((item, index) => (
                <li key={`${item.type}-${item.vmid}-${index}`} data-testid="row-reconcile-detail">
                  {item.type}: VMID {item.vmid}
                  {item.hostname ? ` (${item.hostname})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs opacity-80">Read-only diagnostic — nothing was modified.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-64 flex-1">
          <span className="mb-1 block text-xs text-slate-400">Search</span>
          <span className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter by IP, cluster or status"
              className="w-full rounded border border-slate-600 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-100"
              data-testid="input-ipam-search"
            />
          </span>
        </label>
        <label>
          <span className="mb-1 block text-xs text-slate-400">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            data-testid="select-ipam-status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-200" data-testid="table-ipam">
          <thead className="text-xs uppercase text-slate-400">
            <tr>
              <th className="py-2 pr-3">IP Address</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Cluster</th>
              <th className="py-2 pr-3">Hostname / Role</th>
              <th className="py-2 pr-3">VMID</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleSlots.map((slot) => (
              <tr key={slot.ip} className="border-t border-slate-700" data-testid={`row-ipam-${slot.ip}`}>
                <td className="py-2 pr-3 font-mono text-xs">{slot.ip}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={slot.status} />
                </td>
                <td className="py-2 pr-3">{slot.cluster ?? '—'}</td>
                <td className="py-2 pr-3">
                  {slot.hostname || slot.role ? (
                    <>
                      <span>{slot.hostname ?? '—'}</span>
                      {slot.role ? <span className="ml-2 text-xs text-slate-400">{slot.role}</span> : null}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 pr-3">{slot.vmid ?? '—'}</td>
                <td className="py-2">
                  {releaseRowIps.has(slot.ip) ? (
                    <button
                      type="button"
                      onClick={() => openReleaseModal(slot.cluster)}
                      className="flex items-center gap-1 rounded border border-rose-500/50 px-3 py-1 text-xs font-medium text-rose-300 disabled:opacity-50"
                      data-testid={`btn-release-${slot.cluster}`}
                      {...mutationProps()}
                    >
                      <Trash2 size={12} /> Release Reservation
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {visibleSlots.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-xs text-slate-400" data-testid="text-ipam-empty">
                  No IP slots match the current filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {notice ? (
        <div
          className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200"
          data-testid="alert-ipam-result"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-amber-300" data-testid="text-ipam-error">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <CliSnippetCard command="./forge ipam list" title="Copy as CLI — list ledger" />
        <CliSnippetCard command="./forge ipam free" title="Copy as CLI — free slots" />
      </div>

      {releaseTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" data-testid="modal-confirm-release">
          <div className="w-full max-w-md space-y-4 rounded border border-slate-600 bg-slate-800 p-6">
            <h3 className="text-lg font-semibold text-slate-100">Release IP reservation</h3>
            <p className="text-sm text-slate-300">
              All IP slots held by <span className="font-mono text-slate-100">{releaseTarget}</span> return to the free
              pool. A safety snapshot is taken first.
            </p>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">
                Type {RELEASE_CONFIRM_WORD} to confirm
              </span>
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                data-testid="input-confirm-release"
              />
            </label>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={closeReleaseModal}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-200"
                data-testid="btn-close-release-modal"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void releaseReservation()}
                className="rounded bg-rose-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                data-testid="btn-confirm-release"
                disabled={confirmText !== RELEASE_CONFIRM_WORD || isReleasing}
              >
                {isReleasing ? 'Releasing...' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default IpamPage
