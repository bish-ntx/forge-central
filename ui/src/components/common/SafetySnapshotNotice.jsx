import React from 'react'
import { ShieldCheck } from 'lucide-react'

function SafetySnapshotNotice() {
  return (
    <div
      className="mt-3 flex items-start gap-2 rounded border border-teal-700 bg-teal-500/10 px-3 py-2 text-xs text-teal-200"
      data-testid="banner-safety-snapshot-notice"
    >
      <ShieldCheck size={14} className="mt-0.5 shrink-0" />
      <span>
        An automatic safety snapshot of cluster state and kubeconfigs will be created before execution.
      </span>
    </div>
  )
}

export default SafetySnapshotNotice
