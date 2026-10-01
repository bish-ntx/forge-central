import React, { useState } from 'react'
import { Flame, LockKeyhole, UserRound } from 'lucide-react'
import { useRole } from '../../context/RoleContext.jsx'

/** First-visit gateway: shown until a role is chosen (or restored from storage). */
function LoginGatewayModal() {
  const { hasSession, setRole, unlockAdmin } = useRole()
  const [remember, setRemember] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')

  if (hasSession) return null

  async function submitAdmin(event) {
    event.preventDefault()
    try {
      if (!(await unlockAdmin(passphrase, { remember }))) setError('Invalid admin passphrase')
    } catch (_error) {
      setError('Unable to validate passphrase')
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/95" data-testid="modal-login-gateway">
      <div className="w-full max-w-md rounded border border-slate-700 bg-slate-900 p-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
          <Flame size={20} className="text-accent-teal" />
          Welcome to Forge Central
        </h2>
        <p className="mt-2 text-sm text-slate-300">Choose how you want to enter the console.</p>

        <button
          type="button"
          onClick={() => setRole('operator', { remember })}
          className="mt-4 flex w-full items-center gap-2 rounded border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-teal-500"
          data-testid="btn-gateway-operator"
        >
          <UserRound size={16} />
          Enter as Operator / Viewer
        </button>
        <button
          type="button"
          onClick={() => setRole('viewer', { remember })}
          className="mt-1 text-xs text-slate-400 underline hover:text-slate-200"
          data-testid="btn-gateway-viewer"
        >
          or browse read-only as Viewer
        </button>

        {adminMode ? (
          <form onSubmit={submitAdmin} className="mt-4" data-testid="form-gateway-admin">
            <input
              type="password"
              autoFocus
              placeholder="Admin passphrase"
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              data-testid="input-gateway-passphrase"
            />
            {error && (
              <p className="mt-2 text-xs text-rose-300" data-testid="text-gateway-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={!passphrase}
              className="mt-2 w-full rounded bg-accent-teal px-3 py-2 text-sm font-medium text-slate-900 disabled:opacity-60"
              data-testid="btn-gateway-submit-admin"
            >
              Unlock
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdminMode(true)}
            className="mt-3 flex w-full items-center gap-2 rounded border border-slate-600 bg-slate-800 px-4 py-3 text-left text-sm font-medium text-slate-100 hover:border-teal-500"
            data-testid="btn-gateway-admin"
          >
            <LockKeyhole size={16} />
            Unlock as Administrator
          </button>
        )}

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            data-testid="checkbox-gateway-remember"
          />
          Remember my choice on this browser
        </label>
      </div>
    </div>
  )
}

export default LoginGatewayModal
