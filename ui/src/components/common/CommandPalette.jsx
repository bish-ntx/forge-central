import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

export const COMMAND_ITEMS = [
  { id: 'nav-vms', title: 'Go to VMs', category: 'Navigation', path: '/vms' },
  { id: 'nav-clusters', title: 'Go to Clusters', category: 'Navigation', path: '/clusters' },
  { id: 'nav-fleet', title: 'Go to Fleet Dashboard', category: 'Navigation', path: '/fleet' },
  { id: 'nav-diagnostics', title: 'Go to Diagnostics', category: 'Navigation', path: '/diagnostics' },
  { id: 'nav-ipam', title: 'Go to IPAM Subnets', category: 'Navigation', path: '/ipam' },
  { id: 'nav-settings', title: 'Go to Settings', category: 'Navigation', path: '/settings' },
  { id: 'nav-settings-paths', title: 'Path Configuration & Migration', category: 'Navigation', path: '/settings/paths' },
  { id: 'nav-settings-upgrade', title: 'Air-Gapped Upgrade', category: 'Navigation', path: '/settings/upgrade' },
  { id: 'action-deploy-cluster', title: 'Deploy NKP Cluster', category: 'Quick Action', path: '/clusters/deploy' },
  { id: 'action-create-vm', title: 'Create Virtual Machine', category: 'Quick Action', path: '/vms' },
  { id: 'action-capture-diagnostics', title: 'Capture Diagnostics', category: 'Quick Action', path: '/diagnostics' },
  { id: 'cluster-nkp-prod-01', title: 'Cluster: nkp-prod-01', category: 'Cluster', path: '/clusters/nkp-prod-01' },
  { id: 'cluster-amd-nkp1', title: 'Cluster: amd-nkp1', category: 'Cluster', path: '/clusters/amd-nkp1' },
  { id: 'vm-100', title: 'VM: gpu-worker-01 (100)', category: 'VM', path: '/vms' },
]

function CommandPalette({ open, onOpen, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      } else if (event.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpen, onClose])

  useEffect(() => {
    if (open) {
      setQuery('')
    }
  }, [open])

  if (!open) {
    return null
  }

  const needle = query.trim().toLowerCase()
  const results = COMMAND_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle),
  )

  function select(item) {
    navigate(item.path)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 pt-24"
      data-testid="command-palette-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded border border-slate-700 bg-slate-900 shadow-xl"
        data-testid="command-palette-modal"
        role="dialog"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) {
                select(results[0])
              }
            }}
            placeholder="Search pages, actions, clusters, VMs..."
            data-testid="input-command-palette"
            className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
          />
        </div>
        <ul className="max-h-80 overflow-y-auto py-1" data-testid="command-palette-results">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => select(item)}
                data-testid={`command-item-${item.id}`}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                {item.title}
                <span className="text-xs text-slate-500">{item.category}</span>
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No results</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

export default CommandPalette
