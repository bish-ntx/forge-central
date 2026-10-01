import React, { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ROLE_LABELS, useRole } from '../../context/RoleContext.jsx'

function RoleSwitcher() {
  const { role, label, setRole, unlockAdmin } = useRole()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')

  function choose(next) {
    setMenuOpen(false)
    if (next === 'admin' && role !== 'admin') {
      setPassphrase('')
      setError('')
      setUnlockOpen(true)
      return
    }
    setRole(next)
  }

  async function submitUnlock(event) {
    event.preventDefault()
    try {
      if (await unlockAdmin(passphrase)) {
        setUnlockOpen(false)
        setPassphrase('')
        return
      }
      setError('Invalid admin passphrase')
    } catch (_error) {
      setError('Unable to validate passphrase')
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        title="Switch access role"
        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-600"
        data-testid="badge-role-switcher"
      >
        <ShieldCheck size={14} />
        {label}
      </button>
      {menuOpen && (
        <ul
          className="absolute right-0 z-40 mt-1 w-40 rounded border border-slate-700 bg-slate-900 py-1 text-xs"
          data-testid="menu-role-switcher"
        >
          {Object.entries(ROLE_LABELS).map(([key, text]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => choose(key)}
                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-800"
                data-testid={`option-role-${key}`}
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {unlockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70">
          <form
            onSubmit={submitUnlock}
            className="w-full max-w-sm rounded border border-slate-700 bg-slate-900 p-5"
            data-testid="modal-unlock-admin"
          >
            <h3 className="text-lg font-semibold text-slate-100">Unlock Admin</h3>
            <p className="mt-2 text-sm text-slate-300">Enter the admin passphrase to enable Day-0 infrastructure actions.</p>
            <input
              type="password"
              autoFocus
              className="mt-3 w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              data-testid="input-unlock-admin-passphrase"
            />
            {error && (
              <p className="mt-2 text-xs text-rose-300" data-testid="text-unlock-admin-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlockOpen(false)}
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200"
                data-testid="btn-cancel-unlock-admin"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!passphrase}
                className="rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
                data-testid="btn-submit-unlock-admin"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default RoleSwitcher
