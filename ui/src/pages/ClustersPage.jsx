import React from 'react'
import LiveTerminal from '../components/common/LiveTerminal.jsx'

function ClustersPage() {
  return (
    <section
      className="rounded border border-slate-700 bg-card-slate p-6"
      data-testid="page-clusters"
    >
      <h2 className="text-xl font-semibold text-slate-100">Clusters</h2>
      <p className="mt-2 text-sm text-slate-300">
        Placeholder cluster overview for NKP deployment lifecycle.
      </p>
      <div className="mt-4">
        <LiveTerminal activeStepName="01-preprov-create-nkp-cluster-konvoy.sh" />
      </div>
    </section>
  )
}

export default ClustersPage
