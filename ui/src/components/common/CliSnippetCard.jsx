import React, { useState } from 'react'
import { Check, Copy } from 'lucide-react'

function fallbackCopy(text) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function CliSnippetCard({ command, title = 'CLI Equivalent' }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(command)
      } else {
        fallbackCopy(command)
      }
    } catch {
      fallbackCopy(command)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded border border-slate-700 bg-slate-900/80 p-3" data-testid="card-cli-snippet">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-200">{title}</h4>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy CLI command"
          data-testid="btn-copy-cli-snippet"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <code className="block overflow-x-auto whitespace-pre-wrap break-all rounded bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200">
        {command}
      </code>
    </div>
  )
}

export default CliSnippetCard
