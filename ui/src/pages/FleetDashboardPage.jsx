import React, { useEffect, useMemo, useState } from 'react'
import Timestamp from '../components/common/Timestamp.jsx'

const API_STATUS = '/api/v1/fleet/status'

const DEFAULT_SEED_SITES = [
  {
    site_id: 'amd-lab',
    site_name: 'AMD Lab',
    location: 'Santa Clara, CA',
    status: 'HEALTHY',
    clusters_count: 2,
    vms_count: 12,
    ipam_utilization_pct: 45.0,
    gpu_nodes_count: 4,
    last_seen: null,
  },
  {
    site_id: 'cirra-lab',
    site_name: 'Cirrascale Lab',
    location: 'San Jose, CA',
    status: 'HEALTHY',
    clusters_count: 1,
    vms_count: 8,
    ipam_utilization_pct: 30.0,
    gpu_nodes_count: 8,
    last_seen: null,
  },
  {
    site_id: 'ntx-lab',
    site_name: 'Nutanix Durham Lab',
    location: 'Durham, NC',
    status: 'HEALTHY',
    clusters_count: 3,
    vms_count: 16,
    ipam_utilization_pct: 62.5,
    gpu_nodes_count: 2,
    last_seen: null,
  },
]

function getStatusBadgeClass(status) {
  if (status === 'HEALTHY') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'DEGRADED') {
    return 'bg-amber-500/20 text-amber-300'
  }
  if (status === 'STALE') {
    return 'bg-rose-500/20 text-rose-300'
  }
  return 'bg-slate-600 text-slate-200'
}

function FleetDashboardPage() {
  const [fleet, setFleet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadFleetStatus() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_STATUS)
      if (!response.ok) {
        throw new Error('Failed to fetch fleet status')
      }
      const payload = await response.json()
      setFleet(payload)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch fleet status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadFleetStatus()
  }, [])

  const activeSites = fleet?.sites?.length ? fleet.sites : DEFAULT_SEED_SITES

  const summary = useMemo(() => {
    const totalSites = activeSites.length
    const totalClusters =
      fleet?.total_clusters ?? activeSites.reduce((acc, site) => acc + Number(site.clusters_count ?? 0), 0)
    const totalVms = fleet?.total_vms ?? activeSites.reduce((acc, site) => acc + Number(site.vms_count ?? 0), 0)
    const totalGpuNodes =
      fleet?.total_gpu_nodes ?? activeSites.reduce((acc, site) => acc + Number(site.gpu_nodes_count ?? 0), 0)
    return { totalSites, totalClusters, totalVms, totalGpuNodes }
  }, [activeSites, fleet])

  return (
    <section className="space-y-4 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-fleet">
      <div
        className="rounded border border-amber-500/60 bg-amber-500/10 p-4"
        data-testid="fleet-banner-readonly"
      >
        <p className="text-sm font-semibold text-amber-200">
          HQ Fleet Dashboard — Read-Only Multi-Site Telemetry
        </p>
        <p className="mt-1 text-xs text-amber-100/90">
          Live monitoring across edge lab regions. Write actions are disabled in HQ Fleet view.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Fleet Dashboard</h2>
        <div className="flex items-center gap-2">
          <span
            className="rounded border border-amber-500/70 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200"
            data-testid="fleet-readonly-badge"
          >
            HQ READ-ONLY MODE
          </span>
          <button
            type="button"
            className="rounded bg-accent-teal px-3 py-2 text-xs font-medium text-slate-900"
            onClick={() => void loadFleetStatus()}
            data-testid="btn-refresh-fleet"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-amber-300">
          Fleet API unavailable. Showing fallback seed telemetry while in read-only mode.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Total Sites</p>
          <p className="mt-1 text-xl font-semibold text-slate-100" data-testid="metric-total-sites">
            {summary.totalSites}
          </p>
        </article>
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Total Clusters</p>
          <p className="mt-1 text-xl font-semibold text-slate-100" data-testid="metric-total-clusters">
            {summary.totalClusters}
          </p>
        </article>
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Total VMs</p>
          <p className="mt-1 text-xl font-semibold text-slate-100" data-testid="metric-total-vms">
            {summary.totalVms}
          </p>
        </article>
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3">
          <p className="text-xs text-slate-400">Total GPU Nodes</p>
          <p className="mt-1 text-xl font-semibold text-slate-100" data-testid="metric-total-gpu">
            {summary.totalGpuNodes}
          </p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {activeSites.map((site) => {
          const utilization = Math.max(0, Math.min(100, Number(site.ipam_utilization_pct ?? 0)))
          return (
            <article
              key={site.site_id}
              className="rounded border border-slate-700 bg-slate-900/70 p-4"
              data-testid={`site-card-${site.site_id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{site.site_name}</h3>
                  <p className="text-xs text-slate-400">{site.location}</p>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadgeClass(site.status)}`}
                  data-testid={`site-status-${site.site_id}`}
                >
                  {site.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-300">
                <p>Clusters: {site.clusters_count}</p>
                <p>VMs: {site.vms_count}</p>
                <p>GPU Nodes: {site.gpu_nodes_count}</p>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>IPAM Utilization</span>
                  <span>{utilization.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded bg-slate-700">
                  <div className="h-2 rounded bg-cyan-500" style={{ width: `${utilization}%` }} />
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-400">
                Last sync: <Timestamp value={site.last_seen ?? site.timestamp} fallback="Not yet synced" />
              </p>
            </article>
          )
        })}
      </div>

      {loading ? <p className="text-xs text-slate-400">Loading latest fleet telemetry...</p> : null}
    </section>
  )
}

export default FleetDashboardPage
