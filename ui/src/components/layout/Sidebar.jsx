import React from 'react'
import {
  FolderKanban,
  Network,
  Server,
  Settings,
  SquareStack,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/vms', label: 'VMs', icon: Server, testId: 'nav-link-vms' },
  {
    to: '/clusters',
    label: 'Clusters',
    icon: SquareStack,
    testId: 'nav-link-clusters',
  },
  {
    to: '/fleet',
    label: 'Fleet Dashboard',
    icon: FolderKanban,
    testId: 'nav-link-fleet',
  },
  { to: '/ipam', label: 'IPAM Subnets', icon: Network, testId: 'nav-link-ipam' },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    testId: 'nav-link-settings',
  },
]

function Sidebar({ mode, onModeChange }) {
  return (
    <aside
      className="flex w-72 shrink-0 flex-col border-r border-slate-700 bg-card-slate p-4"
      data-testid="layout-sidebar"
    >
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-100">Forge Central</h1>
        <p className="mt-2 inline-flex rounded bg-slate-700 px-2 py-1 text-xs text-slate-200" data-testid="lab-site-badge">
          amd-lab (Santa Clara)
        </p>
      </div>

      <div className="mb-6" data-testid="mode-switcher">
        <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Control Plane Mode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-testid="mode-console"
            onClick={() => onModeChange('console')}
            className={`rounded px-3 py-2 text-xs font-medium transition ${
              mode === 'console'
                ? 'bg-accent-teal text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Console
          </button>
          <button
            type="button"
            data-testid="mode-fleet"
            onClick={() => onModeChange('fleet')}
            className={`rounded px-3 py-2 text-xs font-medium transition ${
              mode === 'fleet'
                ? 'bg-accent-teal text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Fleet
          </button>
        </div>
      </div>

      <nav className="space-y-2" data-testid="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded px-3 py-2 text-sm transition ${
                isActive
                  ? 'bg-slate-700 text-accent-teal'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
