import React from 'react'
function SettingsPage() {
  return (
    <section
      className="rounded border border-slate-700 bg-card-slate p-6"
      data-testid="page-settings"
    >
      <h2 className="text-xl font-semibold text-slate-100">Settings</h2>
      <p className="mt-2 text-sm text-slate-300">
        Placeholder settings for lab and platform configuration.
      </p>
    </section>
  )
}

export default SettingsPage
