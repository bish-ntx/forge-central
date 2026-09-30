import React from 'react'
import { AlertTriangle, Copy } from 'lucide-react'
import { getRemediation } from '../../utils/errorRemediation.js'

const SEVERITY_STYLES = {
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
}

function ErrorRemediationCard({ error }) {
  const remediation = getRemediation(error)

  return (
    <div
      className={`rounded border p-4 ${SEVERITY_STYLES[remediation.severity]}`}
      data-testid="card-error-remediation"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle size={16} />
        {remediation.title}
      </h3>
      <p className="mt-1 text-sm text-slate-300">{remediation.description}</p>
      <p className="mt-2 text-sm text-slate-100">
        <span className="font-semibold">Fix: </span>
        {remediation.actionable_fix}
      </p>
      {remediation.cli_command ? (
        <div className="mt-2 flex items-center justify-between rounded bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
          <code data-testid="error-remediation-cli">{remediation.cli_command}</code>
          <button
            type="button"
            aria-label="Copy command"
            data-testid="btn-copy-remediation-cli"
            onClick={() => navigator.clipboard?.writeText(remediation.cli_command)}
            className="text-slate-400 hover:text-slate-200"
          >
            <Copy size={14} />
          </button>
        </div>
      ) : null}
    </div>
  )
}

export default ErrorRemediationCard
