import React, { useEffect, useState } from 'react'
import { Clock, LogOut, Search } from 'lucide-react'
import { useRole } from '../../context/RoleContext.jsx'
import { useTimezone } from '../../context/TimezoneContext.jsx'
import RoleSwitcher from './RoleSwitcher.jsx'

const THEME_MODE_LABELS = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

function Header({ mode, onToggleMode, themeMode, onToggleThemeMode, onOpenCommandPalette }) {
  const [mockMode, setMockMode] = useState(false)
  const { signOut } = useRole()
  const { mode: timezoneMode, label: timezoneLabel, timeZone, toggleMode: toggleTimezoneMode } = useTimezone()
  const modeLabel =
    mode === 'console' ? 'Forge Central Console' : 'Forge Fleet Dashboard'

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => fetch('/health'))
      .then((response) => response.json())
      .then((health) => active && setMockMode(Boolean(health?.mock_mode)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <header
      className="flex items-center justify-between border-b border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 px-6 py-4"
      data-testid="layout-header"
    >
      <div className="flex items-center gap-4">
        <span
          className="rounded-full border border-teal-500/40 bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300"
          data-testid="header-mode-badge"
        >
          {modeLabel}
        </span>
        {mockMode && (
          <span
            className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300"
            data-testid="badge-mock-mode"
          >
            [SYNTHETIC MOCK MODE]
          </span>
        )}
        <button
          type="button"
          onClick={onToggleMode}
          className="rounded border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-500"
          data-testid="toggle-mode"
        >
          Toggle Mode
        </button>
        <span
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"
          data-testid="header-system-health"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          System Health
        </span>
      </div>

      <div className="flex items-center gap-3">
        <RoleSwitcher />
        <button
          type="button"
          onClick={signOut}
          title="Log out / switch user"
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
          data-testid="btn-logout-switch-user"
        >
          <LogOut size={14} />
          Log Out
        </button>
        <button
          type="button"
          onClick={toggleTimezoneMode}
          title={`Timestamps shown in ${timezoneMode === 'utc' ? 'UTC' : timeZone}. Click to switch.`}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600"
          data-testid="button-timezone-toggle"
        >
          <Clock size={14} />
          {timezoneLabel}
        </button>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          data-testid="btn-open-command-palette"
          className="inline-flex items-center gap-2 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
        >
          <Search size={14} />
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            ⌘K Search
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleThemeMode}
          data-testid="toggle-theme-mode"
          className="w-72 rounded border border-slate-300 bg-slate-100 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-slate-600"
        >
          Theme: {THEME_MODE_LABELS[themeMode] ?? 'Dark'}
          <span className="float-right rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            Toggle
          </span>
        </button>
      </div>
    </header>
  )
}

export default Header
