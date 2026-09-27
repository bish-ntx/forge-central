import React, { useEffect, useMemo, useState } from 'react'

const DIAGNOSTICS_BUNDLES_API = '/api/v1/diagnostics/bundles'
const DIAGNOSTICS_CAPTURE_API = '/api/v1/diagnostics/capture'
const AUDIT_LOGS_API = '/api/v1/audit/logs'

const FALLBACK_BUNDLES = [
  {
    bundle_id: 'bundle-amd-nkp1-20260926',
    cluster_name: 'amd-nkp1',
    filename: 'bundle-amd-nkp1-20260926.tar.gz',
    file_size_bytes: 152034918,
    captured_at: '2026-09-26T10:45:00+00:00',
    status: 'ready',
  },
  {
    bundle_id: 'bundle-cirra-nkp1-20260925',
    cluster_name: 'cirra-nkp1',
    filename: 'bundle-cirra-nkp1-20260925.tar.gz',
    file_size_bytes: 138220441,
    captured_at: '2026-09-25T18:12:00+00:00',
    status: 'ready',
  },
]

const FALLBACK_AUDIT_LOGS = [
  {
    run_id: 'run-provision-amd-nkp1',
    timestamp: '2026-09-26T08:15:00+00:00',
    verb: 'cluster-provision',
    user: 'platform-admin',
    status: 'succeeded',
    duration_sec: 512.8,
  },
  {
    run_id: 'run-vm-poweron-amd-db01',
    timestamp: '2026-09-26T10:02:41+00:00',
    verb: 'vm-power-on',
    user: 'lab-operator',
    status: 'succeeded',
    duration_sec: 9.7,
  },
  {
    run_id: 'run-diag-capture-cirra-nkp1',
    timestamp: '2026-09-26T12:33:19+00:00',
    verb: 'diagnostics-capture',
    user: 'sre-oncall',
    status: 'succeeded',
    duration_sec: 23.5,
  },
]

function formatTimestamp(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString()
}

function formatSize(bytes) {
  const size = Number(bytes || 0)
  if (size <= 0) {
    return '0 B'
  }
  const mb = size / (1024 * 1024)
  return `${mb.toFixed(1)} MB`
}

function statusBadgeClasses(status) {
  if (status === 'ready' || status === 'succeeded') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'running') {
    return 'bg-amber-500/20 text-amber-300'
  }
  if (status === 'failed') {
    return 'bg-rose-500/20 text-rose-300'
  }
  return 'bg-slate-600 text-slate-200'
}

function DiagnosticsPage() {
  const [clusterName, setClusterName] = useState('amd-nkp1')
  const [bundles, setBundles] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState('')

  async function loadDiagnosticsData() {
    setLoading(true)
    setError('')
    try {
      const [bundleResponse, auditResponse] = await Promise.all([fetch(DIAGNOSTICS_BUNDLES_API), fetch(AUDIT_LOGS_API)])
      if (!bundleResponse.ok || !auditResponse.ok) {
        throw new Error('Failed to load diagnostics data')
      }
      const bundlePayload = await bundleResponse.json()
      const auditPayload = await auditResponse.json()
      setBundles(bundlePayload.bundles ?? [])
      setAuditLogs(auditPayload.logs ?? [])
    } catch (fetchError) {
      setBundles(FALLBACK_BUNDLES)
      setAuditLogs(FALLBACK_AUDIT_LOGS)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load diagnostics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDiagnosticsData()
  }, [])

  async function captureDiagnostics() {
    const normalizedCluster = clusterName.trim()
    if (!normalizedCluster) {
      return
    }
    setIsCapturing(true)
    setError('')
    try {
      const response = await fetch(DIAGNOSTICS_CAPTURE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster_name: normalizedCluster, include_logs: true }),
      })
      if (!response.ok) {
        throw new Error('Diagnostics capture failed')
      }
      await loadDiagnosticsData()
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : 'Diagnostics capture failed')
    } finally {
      setIsCapturing(false)
    }
  }

  const displayedBundles = useMemo(
    () => (bundles.length > 0 ? bundles : FALLBACK_BUNDLES),
    [bundles],
  )
  const displayedAuditLogs = useMemo(
    () => (auditLogs.length > 0 ? auditLogs : FALLBACK_AUDIT_LOGS),
    [auditLogs],
  )

  return (
    <section className="space-y-5 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-diagnostics">
      <article
        className="rounded border border-slate-700 bg-slate-900/70 p-4"
        data-testid="card-diagnostics-capture"
      >
        <h2 className="text-lg font-semibold text-slate-100">Cluster Diagnostics Capture</h2>
        <p className="mt-1 text-xs text-slate-400">
          Capture Day-0 support bundles using deterministic local mock workflows.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Cluster Name</span>
            <input
              type="text"
              value={clusterName}
              onChange={(event) => setClusterName(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              data-testid="input-diagnostics-cluster"
            />
          </label>
          <button
            type="button"
            onClick={() => void captureDiagnostics()}
            className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-70"
            data-testid="btn-capture-diagnostics"
            disabled={isCapturing || !clusterName.trim()}
          >
            {isCapturing ? 'Capturing...' : 'Capture Bundle'}
          </button>
        </div>
      </article>

      {error ? <p className="text-xs text-amber-300">{error}</p> : null}

      <div className="overflow-x-auto rounded border border-slate-700 bg-slate-900/70">
        <table className="min-w-full divide-y divide-slate-700 text-sm" data-testid="table-diagnostic-bundles">
          <thead className="bg-slate-800/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Bundle Filename</th>
              <th className="px-3 py-2">Cluster</th>
              <th className="px-3 py-2">Size</th>
              <th className="px-3 py-2">Captured At</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {displayedBundles.map((bundle) => (
              <tr key={bundle.bundle_id}>
                <td className="px-3 py-2">{bundle.filename}</td>
                <td className="px-3 py-2">{bundle.cluster_name}</td>
                <td className="px-3 py-2">{formatSize(bundle.file_size_bytes)}</td>
                <td className="px-3 py-2">{formatTimestamp(bundle.captured_at)}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClasses(bundle.status)}`}
                    data-testid="badge-bundle-status"
                  >
                    {bundle.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded border border-slate-700 bg-slate-900/70">
        <table className="min-w-full divide-y divide-slate-700 text-sm" data-testid="table-audit-logs">
          <thead className="bg-slate-800/70 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Run ID</th>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Verb</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            {displayedAuditLogs.map((log) => (
              <tr key={log.run_id}>
                <td className="px-3 py-2">{log.run_id}</td>
                <td className="px-3 py-2">{formatTimestamp(log.timestamp)}</td>
                <td className="px-3 py-2">{log.verb}</td>
                <td className="px-3 py-2">{log.user}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClasses(log.status)}`}
                    data-testid="badge-audit-status"
                  >
                    {log.status}
                  </span>
                </td>
                <td className="px-3 py-2">{Number(log.duration_sec || 0).toFixed(1)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? <p className="text-xs text-slate-400">Loading diagnostics and audit data...</p> : null}
    </section>
  )
}

export default DiagnosticsPage
