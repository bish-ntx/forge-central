import React, { useCallback, useEffect, useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import Timestamp from '../common/Timestamp.jsx'
import { roleHeaders, useRole } from '../../context/RoleContext.jsx'

const SECRETS_API = '/api/v1/secrets'
const EMPTY = { user: '', password: '', url: '', ca_path: '', cluster: '' }

const TYPES = {
  dockerhub: { title: 'Docker Hub Credentials', action: 'Stage Docker Hub PAT', modal: 'modal-stage-dockerhub' },
  harbor: { title: 'Harbor CA / Token', action: 'Stage Harbor Registry', modal: 'modal-stage-harbor' },
}

function StageModal({ type, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const isHarbor = type === 'harbor'
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  async function submit(event) {
    event.preventDefault()
    setError('')
    const body = { sec_type: type, user: form.user, password: form.password }
    for (const field of isHarbor ? ['url', 'ca_path', 'cluster'] : ['url']) {
      if (form[field]) body[field] = form[field]
    }
    try {
      const response = await fetch(`${SECRETS_API}/save`, {
        method: 'POST',
        headers: roleHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) {
        const detail = Array.isArray(payload.detail) ? payload.detail.map((d) => d.msg).join('; ') : payload.detail
        throw new Error(detail ?? 'Failed to stage secret')
      }
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to stage secret')
    }
  }

  const input = 'mt-1 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100'
  const fields = [
    ...(isHarbor ? [['cluster', 'Harbor Cluster Name']] : []),
    ['user', isHarbor ? 'Harbor Username' : 'Docker Hub Username'],
    ['password', isHarbor ? 'Password / Token' : 'Personal Access Token', 'password'],
    ['url', isHarbor ? 'Harbor URL (https://<ip>:5000/library)' : 'Registry URL (optional)'],
    ...(isHarbor ? [['ca_path', 'ca.crt Path (optional)']] : []),
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70">
      <form onSubmit={submit} className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-5" data-testid={TYPES[type].modal}>
        <h3 className="text-lg font-semibold text-slate-100">{TYPES[type].action}</h3>
        {fields.map(([field, label, inputType = 'text']) => (
          <label key={field} className="mt-3 block text-xs text-slate-300">
            {label}
            <input type={inputType} value={form[field]} onChange={update(field)} className={input} data-testid={`input-secret-${field}`} />
          </label>
        ))}
        {error && <p className="mt-2 text-xs text-rose-300" data-testid="text-secret-error">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200" data-testid="btn-cancel-stage-secret">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!form.user || !form.password || (isHarbor && !form.cluster)}
            className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
            data-testid="btn-submit-stage-secret"
          >
            Stage
          </button>
        </div>
      </form>
    </div>
  )
}

function SecretsVaultTab() {
  const { adminProps } = useRole()
  const [secrets, setSecrets] = useState([])
  const [stageType, setStageType] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const response = await fetch(SECRETS_API)
      if (!response.ok) throw new Error('Failed to load secrets')
      setSecrets((await response.json()).secrets ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load secrets')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(item) {
    setError('')
    const query = item.cluster ? `?cluster=${encodeURIComponent(item.cluster)}` : ''
    const response = await fetch(`${SECRETS_API}/${item.sec_type}${query}`, { method: 'DELETE', headers: roleHeaders() })
    if (!response.ok) {
      setError((await response.json()).detail ?? 'Failed to delete secret')
      return
    }
    await load()
  }

  return (
    <div className="space-y-4" data-testid="tab-secrets-vault">
      <div className="grid gap-3 md:grid-cols-2">
        {Object.entries(TYPES).map(([type, meta]) => (
          <div key={type} className="rounded border border-slate-700 bg-slate-900/80 p-4" data-testid={`card-secret-${type}`}>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <KeyRound size={14} />
              {meta.title}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {secrets.some((s) => s.sec_type === type) ? 'Staged' : 'Not staged'}
            </p>
            <button
              type="button"
              onClick={() => setStageType(type)}
              {...adminProps()}
              className="mt-3 rounded border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-100 disabled:opacity-60"
              data-testid={`btn-stage-${type}`}
            >
              {meta.action}
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-rose-300" data-testid="text-secrets-error">{error}</p>}

      <table className="w-full text-left text-sm text-slate-200" data-testid="table-secrets">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="py-2">Type</th>
            <th>User</th>
            <th>File Location</th>
            <th>Status</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {secrets.length === 0 && (
            <tr>
              <td colSpan={6} className="py-3 text-xs text-slate-400">No secrets staged.</td>
            </tr>
          )}
          {secrets.map((item) => {
            const key = `${item.sec_type}-${item.cluster ?? ''}`
            return (
              <tr key={key} className="border-t border-slate-700" data-testid={`row-secret-${key}`}>
                <td className="py-2">{item.sec_type}{item.cluster ? ` (${item.cluster})` : ''}</td>
                <td>{item.user}</td>
                <td className="font-mono text-xs">{item.path}</td>
                <td className="text-xs">{item.password_masked} · {item.sec_type === 'harbor' ? (item.has_ca ? 'CA present' : 'CA missing') : 'staged'}</td>
                <td className="text-xs"><Timestamp value={item.updated_at} /></td>
                <td>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    {...adminProps()}
                    aria-label={`Delete ${key}`}
                    className="text-rose-300 disabled:opacity-40"
                    data-testid={`btn-delete-secret-${key}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {stageType && (
        <StageModal
          type={stageType}
          onClose={() => setStageType(null)}
          onSaved={() => {
            setStageType(null)
            void load()
          }}
        />
      )}
    </div>
  )
}

export default SecretsVaultTab
