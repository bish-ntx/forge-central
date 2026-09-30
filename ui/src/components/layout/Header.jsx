import React from 'react'
import { Search } from 'lucide-react'

const THEME_MODE_LABELS = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

function Header({ mode, onToggleMode, themeMode, onToggleThemeMode, onOpenCommandPalette }) {
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
        <button
          type="button"
          onClick={onToggleMode}
          className="rounded border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          data-testid="toggle-mode"
        >
          Toggle Mode
        </button>
        <span
          className="inline-flex items-center gap-2 text-sm text-slate-300"
          data-testid="header-system-health"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          System Health
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-testid="btn-open-command-palette"
          className="inline-flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 hover:border-slate-600"
        >
          <Search size={14} />
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
            ⌘K Search
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleThemeMode}
          data-testid="toggle-theme-mode"
          className="w-72 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-left text-sm text-slate-400 hover:border-slate-600"
        >
          Theme: {THEME_MODE_LABELS[themeMode] ?? 'Dark'}
          <span className="float-right rounded bg-slate-700 px-1.5 py-0.5 text-xs text-slate-300">
            Toggle
          </span>
        </button>
      </div>
    </header>
  )
}

export default Header
