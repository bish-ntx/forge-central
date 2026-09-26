import React, { useState } from 'react';
import { Copy, Check, ShieldCheck, Server, AlertTriangle, CheckCircle2, XCircle, FileText } from 'lucide-react';

export default function InventoryYamlViewer({
  filename = 'inventory-lab-01.yaml',
  rawYaml = '',
  controlPlaneNodes = [],
  workerNodes = [],
  checkResults = [],
  isValid = true,
  nodeCount,
  onValidate,
  onCopy,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (rawYaml) {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(rawYaml);
        }
        setCopied(true);
        if (onCopy) onCopy(rawYaml);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy YAML: ', err);
        setCopied(true);
        if (onCopy) onCopy(rawYaml);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const cpCount = controlPlaneNodes.length;
  const workerCount = workerNodes.length;
  const totalNodes = nodeCount ?? (cpCount + workerCount);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/90 p-4 shadow-md space-y-4">
      {/* Header section with filename & Copy Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-400" />
          <span className="font-mono text-xs font-semibold text-slate-200" data-testid="inventory-filename">
            {filename}
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
            {totalNodes} Total Nodes
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onValidate && (
            <button
              onClick={onValidate}
              className="flex items-center gap-1.5 rounded bg-teal-600/20 px-2.5 py-1 text-xs font-medium text-teal-300 hover:bg-teal-600/30 transition-colors"
              data-testid="btn-validate-inventory"
            >
              <ShieldCheck size={13} />
              Validate Manifest
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            data-testid="btn-copy-yaml"
          >
            {copied ? (
              <>
                <Check size={13} className="text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={13} />
                <span>Copy Manifest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Node Summary Chips */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <div
          className="flex items-center gap-2 rounded-md border border-indigo-500/30 bg-indigo-950/40 px-3 py-1.5 text-indigo-300 font-medium"
          data-testid="chip-cp-nodes"
        >
          <Server size={14} className="text-indigo-400" />
          <span>Control Plane: {cpCount} Nodes</span>
          {cpCount > 0 && (
            <span className="font-mono text-[10px] text-indigo-400/80">
              ({controlPlaneNodes.join(', ')})
            </span>
          )}
        </div>

        <div
          className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-cyan-300 font-medium"
          data-testid="chip-worker-nodes"
        >
          <Server size={14} className="text-cyan-400" />
          <span>Worker: {workerCount} Nodes</span>
          {workerCount > 0 && (
            <span className="font-mono text-[10px] text-cyan-400/80">
              ({workerNodes.join(', ')})
            </span>
          )}
        </div>
      </div>

      {/* Validation Status Badges */}
      {checkResults && checkResults.length > 0 && (
        <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className={isValid ? "text-emerald-400" : "text-amber-400"} />
              Pre-flight Diagnostics
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${isValid ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
              {isValid ? "PASSED" : "ATTENTION REQUIRED"}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {checkResults.map((check, idx) => {
              const status = check.status?.toLowerCase() || 'pass';
              const isPass = status === 'pass' || status === 'success';
              const isWarn = status === 'warn' || status === 'warning';

              return (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded border border-slate-800/80 bg-slate-900/50 p-2 text-xs"
                  data-testid="validation-status-badge"
                >
                  {isPass && <CheckCircle2 size={14} className="mt-0.5 text-emerald-400 shrink-0" />}
                  {isWarn && <AlertTriangle size={14} className="mt-0.5 text-amber-400 shrink-0" />}
                  {!isPass && !isWarn && <XCircle size={14} className="mt-0.5 text-rose-400 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 font-medium text-slate-200">
                      <span className="truncate">{check.name}</span>
                      <span
                        className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-mono ${
                          isPass
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    {check.message && (
                      <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-2">{check.message}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Raw YAML Code Viewer Box */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-slate-400">
          Raw Manifest Output
        </label>
        <pre
          className="max-h-64 overflow-y-auto rounded-md border border-slate-800 bg-black/90 p-3 font-mono text-xs text-teal-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-700"
          data-testid="inventory-yaml-text"
        >
          <code>{rawYaml || '# No inventory manifest loaded'}</code>
        </pre>
      </div>
    </div>
  );
}
