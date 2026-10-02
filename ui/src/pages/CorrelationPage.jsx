import React, { useEffect, useState } from 'react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'
import Timestamp from '../components/common/Timestamp.jsx'

const API_CORRELATION = '/api/v1/telemetry/correlation'
const API_INGEST = '/api/v1/telemetry/ingest/test-run'

const BADGES = {
  qualified: { label: 'QUALIFIED', className: 'bg-emerald-500/20 text-emerald-300' },
  failing: { label: 'FAILING', className: 'bg-rose-500/20 text-rose-300' },
  untested: { label: 'UNTESTED', className: 'bg-amber-500/20 text-amber-300' },
}

const INGEST_CLI = `curl -X POST http://localhost:8000${API_INGEST} \\
  -H 'Content-Type: application/json' \\
  -d '{"cluster_name":"<cluster>","run_id":"day2-001","suite_name":"nkpday2-gpu","passed":40,"failed":0,"duration_seconds":312.5,"status":"passed"}'`

function CorrelationPage() {
  const [matrix, setMatrix] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [simulateMessage, setSimulateMessage] = useState('')

  async function loadMatrix() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(API_CORRELATION)
      if (!response.ok) {
        throw new Error('Failed to fetch qualification matrix')
      }
      setMatrix(await response.json())
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch qualification matrix')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMatrix()
  }, [])

  async function simulateIngestion() {
    const target = matrix?.clusters?.[0]?.cluster_name
    if (!target) {
      setSimulateMessage('No clusters available to simulate ingestion.')
      return
    }
    setSimulateMessage('')
    try {
      const response = await fetch(API_INGEST, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_name: target,
          run_id: `sim-${Date.now()}`,
          suite_name: 'nkpday2-gpu',
          passed: 40,
          failed: 0,
          duration_seconds: 1,
          status: 'passed',
          tags: { source: 'ui-simulation' },
        }),
      })
      if (!response.ok) {
        throw new Error('Simulated ingestion failed')
      }
      setSimulateMessage(`Simulated passing run ingested for ${target}.`)
      await loadMatrix()
    } catch (simError) {
      setSimulateMessage(simError instanceof Error ? simError.message : 'Simulated ingestion failed')
    }
  }

  const clusters = matrix?.clusters ?? []

  return (
    <section className="space-y-4 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-correlation">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-100" data-testid="header-correlation">
          Cross-Repo Qualification & Telemetry Matrix
        </h2>
        <button
          type="button"
          className="rounded bg-accent-teal px-3 py-2 text-xs font-medium text-slate-900"
          onClick={() => void loadMatrix()}
          data-testid="btn-refresh-correlation"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-xs text-amber-300">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3" data-testid="card-total-qualified">
          <p className="text-xs text-slate-400">Total Qualified</p>
          <p className="mt-1 text-xl font-semibold text-emerald-300">{matrix?.total_qualified ?? 0}</p>
        </article>
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3" data-testid="card-total-failing">
          <p className="text-xs text-slate-400">Total Failing</p>
          <p className="mt-1 text-xl font-semibold text-rose-300">{matrix?.total_failing ?? 0}</p>
        </article>
        <article className="rounded border border-slate-700 bg-slate-900/70 p-3" data-testid="card-total-untested">
          <p className="text-xs text-slate-400">Untested</p>
          <p className="mt-1 text-xl font-semibold text-amber-300">{matrix?.total_untested ?? 0}</p>
        </article>
      </div>

      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="w-full text-left text-sm text-slate-200" data-testid="table-correlation">
          <thead className="bg-slate-900/70 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">Cluster Name</th>
              <th className="px-3 py-2">NKP Version</th>
              <th className="px-3 py-2">K8s Version</th>
              <th className="px-3 py-2">Latest Test Suite</th>
              <th className="px-3 py-2">Results (passed/failed)</th>
              <th className="px-3 py-2">Qualification</th>
              <th className="px-3 py-2">Last Tested</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster) => {
              const badge = BADGES[cluster.qualification_status] ?? BADGES.untested
              return (
                <tr
                  key={cluster.cluster_name}
                  className="border-t border-slate-700"
                  data-testid={`row-correlation-${cluster.cluster_name}`}
                >
                  <td className="px-3 py-2 font-medium">{cluster.cluster_name}</td>
                  <td className="px-3 py-2">{cluster.nkp_version}</td>
                  <td className="px-3 py-2">{cluster.k8s_version || '—'}</td>
                  <td className="px-3 py-2">{cluster.latest_suite ?? '—'}</td>
                  <td className="px-3 py-2">
                    {cluster.passed == null ? '—' : `${cluster.passed} / ${cluster.failed ?? 0}`}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${badge.className}`}
                      data-testid="badge-qualification-status"
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Timestamp value={cluster.last_tested_at} fallback="Never" />
                  </td>
                </tr>
              )
            })}
            {!loading && clusters.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-xs text-slate-400">
                  No clusters found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {loading ? <p className="text-xs text-slate-400">Loading qualification matrix...</p> : null}

      <div className="space-y-2 rounded border border-slate-700 bg-slate-900/70 p-4" data-testid="card-telemetry-cli-snippet">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Ingest Day-2 Test Results (nkpday2 GPU/CSI)</h3>
          <button
            type="button"
            className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600"
            onClick={() => void simulateIngestion()}
            data-testid="btn-simulate-ingestion"
          >
            Simulate Ingestion
          </button>
        </div>
        <CliSnippetCard command={INGEST_CLI} title="Post a test run" />
        {simulateMessage ? (
          <p className="text-xs text-slate-300" data-testid="simulate-ingestion-message">
            {simulateMessage}
          </p>
        ) : null}
      </div>
    </section>
  )
}

export default CorrelationPage
