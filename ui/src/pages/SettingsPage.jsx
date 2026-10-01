import React, { useState } from 'react'
import LabInfraTab from '../components/settings/LabInfraTab.jsx'
import SecretsVaultTab from '../components/settings/SecretsVaultTab.jsx'

const TABS = [
  { id: 'lab-infra', label: 'Lab Infrastructure', Component: LabInfraTab },
  { id: 'secrets-vault', label: 'Registry & Secrets Vault', Component: SecretsVaultTab },
]

function SettingsPage() {
  const [active, setActive] = useState(TABS[0].id)
  const { Component } = TABS.find((tab) => tab.id === active)

  return (
    <section className="rounded border border-slate-700 bg-card-slate p-6" data-testid="page-settings">
      <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
      <p className="mt-2 text-sm text-slate-300">Day-0 lab infrastructure and registry credentials.</p>
      <div className="mt-4 flex gap-2 border-b border-slate-700" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-3 py-2 text-sm ${active === tab.id ? 'border-b-2 border-accent-teal text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            data-testid={`btn-tab-${tab.id}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Component />
      </div>
    </section>
  )
}

export default SettingsPage
