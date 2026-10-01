import React, { useEffect, useState } from 'react'
import CliSnippetCard from '../components/common/CliSnippetCard.jsx'

const PATHS_API = '/api/v1/settings/paths'
const MIGRATE_API = '/api/v1/settings/paths/migrate'
const BACKUP_LIST_API = '/api/v1/backup/list'
const BACKUP_CREATE_API = '/api/v1/backup/create'

const FALLBACK_PATHS = [
  { name: 'FORGE_HOME', path: '~/forge', exists: true, accessible: true, writable: true, status: 'accessible', free_bytes: 120000000000, total_bytes: 500000000000 },
  { name: 'FORGE_DATA_DIR', path: '~/forge-data', exists: true, accessible: true, writable: true, status: 'accessible', free_bytes: 120000000000, total_bytes: 500000000000 },
  { name: 'FORGE_CENTRAL_DATA_DIR', path: '~/forge-central-data', exists: true, accessible: true, writable: false, status: 'read-only', free_bytes: 120000000000, total_bytes: 500000000000 },
  { name: 'FORGE_BACKUP_DIR', path: '~/forge-backups', exists: false, accessible: false, writable: false, status: 'missing', free_bytes: 0, total_bytes: 0 },
  { name: 'FORGE_LOG_DIR', path: '~/forge-logs', exists: true, accessible: true, writable: true, status: 'accessible', free_bytes: 120000000000, total_bytes: 500000000000 },
]

function statusPillClasses(status) {
  if (status === 'accessible') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'read-only') {
    return 'bg-amber-500/20 text-amber-300'
  }
  return 'bg-rose-500/20 text-rose-300'
}

function formatSize(bytes) {
  const value = Number(bytes || 0)
  return value >= 1024 ** 2 ? `${(value / 1024 ** 2).toFixed(1)} MB` : `${(value / 1024).toFixed(1)} KB`
}

function formatGb(bytes) {
  return `${(Number(bytes || 0) / 1024 ** 3).toFixed(1)} GB`
}

function PathSettingsPage() {
  const [paths, setPaths] = useState([])
  const [error, setError] = useState('')
  const [sourceDir, setSourceDir] = useState('~/forge-state')
  const [targetDir, setTargetDir] = useState('~/forge-data')
  const [dryRun, setDryRun] = useState(true)
  const [isMigrating, setIsMigrating] = useState(false)
  const [result, setResult] = useState(null)
  const [backups, setBackups] = useState([])
  const [isBackingUp, setIsBackingUp] = useState(false)

  async function loadBackups() {
    try {
      const response = await fetch(BACKUP_LIST_API)
      if (!response.ok) {
        throw new Error('Failed to load backups')
      }
      const payload = await response.json()
      setBackups(payload.backups ?? [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load backups')
    }
  }

  useEffect(() => {
    async function loadPaths() {
      try {
        const response = await fetch(PATHS_API)
        if (!response.ok) {
          throw new Error('Failed to load path status')
        }
        const payload = await response.json()
        setPaths(payload.paths ?? [])
      } catch (fetchError) {
        setPaths(FALLBACK_PATHS)
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load path status')
      }
    }
    void loadPaths()
    void loadBackups()
  }, [])

  async function createBackup() {
    setIsBackingUp(true)
    setError('')
    try {
      const response = await fetch(BACKUP_CREATE_API, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.detail ?? 'Backup creation failed')
      }
      await loadBackups()
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : 'Backup creation failed')
    } finally {
      setIsBackingUp(false)
    }
  }

  async function triggerMigration() {
    setIsMigrating(true)
    setError('')
    try {
      const response = await fetch(MIGRATE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_dir: sourceDir.trim(), target_dir: targetDir.trim(), dry_run: dryRun }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.detail ?? 'State directory migration failed')
      }
      setResult(payload)
    } catch (migrationError) {
      setResult(null)
      setError(migrationError instanceof Error ? migrationError.message : 'State directory migration failed')
    } finally {
      setIsMigrating(false)
    }
  }

  return (
    <section className="space-y-5 rounded border border-slate-700 bg-card-slate p-6" data-testid="page-path-settings">
      <h2 className="text-xl font-semibold text-slate-100">Path Configuration &amp; Migration</h2>

      <div className="grid gap-4 md:grid-cols-2" data-testid="grid-path-inspection">
        {paths.map((item) => {
          const used = Math.max(item.total_bytes - item.free_bytes, 0)
          const percent = item.total_bytes > 0 ? Math.round((used / item.total_bytes) * 100) : 0
          return (
            <article
              key={item.name}
              className="rounded border border-slate-700 bg-slate-900/70 p-4"
              data-testid={`card-path-${item.name}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium ${statusPillClasses(item.status)}`}
                  data-testid={`badge-path-status-${item.name}`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-2 inline-flex rounded bg-slate-700 px-2 py-1 text-xs text-slate-200">{item.path}</p>
              <div className="mt-3 h-2 overflow-hidden rounded bg-slate-700">
                <div className="h-full bg-accent-teal" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {formatGb(item.free_bytes)} free of {formatGb(item.total_bytes)} ({percent}% used)
              </p>
            </article>
          )
        })}
      </div>

      <article className="rounded border border-slate-700 bg-slate-900/70 p-4" data-testid="card-path-migration">
        <h3 className="text-lg font-semibold text-slate-100">State Directory Migration</h3>
        <p className="mt-1 text-xs text-slate-400">
          Copy *.ini, *.yaml, *.json and *.log state files to a new directory.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Source Directory</span>
            <input
              type="text"
              value={sourceDir}
              onChange={(event) => setSourceDir(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              data-testid="input-migration-source"
            />
          </label>
          <label className="min-w-64 flex-1">
            <span className="mb-1 block text-xs text-slate-400">Target Directory</span>
            <input
              type="text"
              value={targetDir}
              onChange={(event) => setTargetDir(event.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              data-testid="input-migration-target"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(event) => setDryRun(event.target.checked)}
              data-testid="checkbox-migration-dry-run"
            />
            Dry run
          </label>
          <button
            type="button"
            onClick={() => void triggerMigration()}
            className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-70"
            data-testid="btn-trigger-migration"
            disabled={isMigrating || !sourceDir.trim() || !targetDir.trim()}
          >
            {isMigrating ? 'Migrating...' : dryRun ? 'Run Dry Migration' : 'Migrate'}
          </button>
        </div>
        {result ? (
          <div
            className="mt-4 rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-200"
            data-testid="alert-migration-result"
          >
            <p>{result.message}</p>
            <p className="mt-1 text-xs">
              Scanned: {result.files_scanned} · Migrated: {result.files_migrated} ·{' '}
              {result.dry_run ? 'Dry run (no changes written)' : 'Migration complete'}
            </p>
          </div>
        ) : null}
      </article>

      <article className="rounded border border-slate-700 bg-slate-900/70 p-4" data-testid="section-backups">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">State Backup &amp; Archives</h3>
            <p className="mt-1 text-xs text-slate-400">
              Export a compressed archive of state, CA certificates and the database (logs excluded) before destructive operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void createBackup()}
            className="rounded bg-accent-teal px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-70"
            data-testid="btn-create-backup"
            disabled={isBackingUp}
          >
            {isBackingUp ? 'Creating...' : 'Create Instant Backup'}
          </button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-200" data-testid="table-backups">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2 pr-3">Filename</th>
                <th className="py-2 pr-3">Size</th>
                <th className="py-2 pr-3">Created At</th>
                <th className="py-2">SHA-256 Checksum</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.backup_id} className="border-t border-slate-700" data-testid={`row-backup-${backup.backup_id}`}>
                  <td className="py-2 pr-3 font-mono text-xs">{backup.filename}</td>
                  <td className="py-2 pr-3">{formatSize(backup.file_size_bytes)}</td>
                  <td className="py-2 pr-3">{new Date(backup.created_at).toLocaleString()}</td>
                  <td className="break-all py-2 font-mono text-xs text-slate-400">{backup.checksum_sha256}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <CliSnippetCard command="./forge backup create" />
        </div>
      </article>

      {error ? <p className="text-xs text-amber-300">{error}</p> : null}
    </section>
  )
}

export default PathSettingsPage
