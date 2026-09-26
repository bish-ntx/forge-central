import React from 'react'

function Header({ mode }) {
  const modeLabel =
    mode === 'console' ? 'Forge Central Console' : 'Forge Fleet Dashboard'

  return (
    <header
      className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4"
      data-testid="layout-header"
    >
      <div className="flex items-center gap-4">
        <span
          className="rounded-full border border-teal-500/40 bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-300"
          data-testid="header-mode-badge"
        >
          {modeLabel}
        </span>
        <span
          className="inline-flex items-center gap-2 text-sm text-slate-300"
          data-testid="header-system-health"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          System Health
        </span>
      </div>

      <button
        type="button"
        data-testid="header-search-trigger"
        className="w-72 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-600"
      >
        Search resources
        <span className="float-right rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
          ⌘K
        </span>
      </button>
    </header>
  )
}

export default Header
