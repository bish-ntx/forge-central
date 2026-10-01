import React, { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'

const STATUS_API = '/api/v1/upgrade/status'
const INSPECT_API = '/api/v1/upgrade/inspect'
const DEFAULT_BUNDLE_PATH = '/tmp/forge-central-v1.1.0.tar.gz'

function UpgradePage() {
  const [status, setStatus] = useState(null)
  const [bundlePath, setBundlePath] = useState(DEFAULT_BUNDLE_PATH)
  const [result, setResult] = useState(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await fetch(STATUS_API)
        if (!response.ok) {
          throw new Error('Failed to load upgrade status')
        }
        setStatus(await response.json())
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load upgrade status')
      }
    }
    void loadStatus()
  }, [])

  async function inspectBundle() {
    setIsInspecting(true)
    setError('')
    try {
      const response = await fetch(INSPECT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundle_path: bundlePath.trim() }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.detail ?? 'Bundle inspection failed')
      }
      setResult(payload)
    } catch (inspectError) {
      setResult(null)
      setError(inspectError instanceof Error ? inspectError.message : 'Bundle inspection failed')
    } finally {
      setIsInspecting(false)
    }
  }

  const cliCommand = result?.valid
    ? `./scripts/install-upgrade.sh --bundle ${bundlePath.trim()}`
    : './scripts/build-release-bundle.sh'

  return (
    <section className="space-y-5 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-upgrade">
      <h2 className="text-xl font-semibold text-slate-100">Air-Gapped Upgrade</h2>

      <article className="rounded border border-slate-700 bg-slate-900/70 p-4" data-testid="card-current-version">
        <h3 className="text-lg font-semibold text-slate-100">Current Version</h3>
        <p className="mt-2 text-2xl font-semibold text-accent-teal" data-testid="text-current-version">
          {status ? `v${status.current_version}` : '—'}
        </p>
        {status ? (
          <p className="mt-1 text-xs text-slate-400">
            {status.platform} · {status.arch} · Last upgrade:{' '}
            {status.last_upgrade_at ? new Date(status.last_upgrade_at).toLocaleString() : 'never'}
          </p>
        ) : null}
      </article>

      <article className="rounded border border-slate-700 bg-slate-900/70 p-4" data-testid="card-upgrade-inspect">
        <h3 className="text-lg font-semibold text-slate-100">Bundle Inspection</h3>
        <p className="mt-1 text-xs text-slate-400">
          Run pre-flight checks on a release tarball copied onto this host.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Bundle Path</span>
            <input
              type="text"
              value={bundlePath}
              onChange={(event) => setBundlePath(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              data-testid="input-upgrade-bundle-path"
            />
          </label>
          <button
            type="button"
            onClick={() => void inspectBundle()}
            className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-70"
            data-testid="btn-inspect-upgrade"
            disabled={isInspecting || !bundlePath.trim()}
          >
            {isInspecting ? 'Inspecting...' : 'Inspect Bundle'}
          </button>
        </div>

        {result ? (
          <div className="mt-4 space-y-2">
            <p
              className={`text-sm font-medium ${result.valid ? 'text-emerald-300' : 'text-rose-300'}`}
              data-testid="text-upgrade-verdict"
            >
              {result.valid ? 'Ready to upgrade' : 'Pre-flight failed'} · {result.current_version} → {result.bundle_version}
            </p>
            <ul className="space-y-2" data-testid="list-upgrade-preflight">
              {result.checks.map((check) => (
                <li
                  key={check.name}
                  className="flex items-start gap-2 text-sm text-slate-200"
                  data-testid={`item-preflight-${check.name}`}
                >
                  {check.passed ? (
                    <CheckCircle2 size={16} className="mt-0.5 text-emerald-400" />
                  ) : (
                    <XCircle size={16} className="mt-0.5 text-rose-400" />
                  )}
                  <span>
                    <span className="font-medium">{check.name}</span>
                    <span className="text-slate-400"> — {check.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4">
          <CliSnippetCard command={cliCommand} />
        </div>
      </article>

      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
    </section>
  )
}

export default UpgradePage
