import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, CircleAlert, Copy, Loader2, PauseCircle, RefreshCw } from 'lucide-react'
import useEventSource from '../../hooks/useEventSource.js'
import Timestamp from './Timestamp.jsx'

function formatElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function resolvePipelineStatus(connectionState, endEvent) {
  if (endEvent?.status === 'COMPLETED') return 'COMPLETED'
  if (endEvent?.status === 'FAILED') return 'FAILED'
  if (connectionState === 'connecting' || connectionState === 'open') return 'RUNNING'
  if (connectionState === 'error') return 'ERROR'
  return 'IDLE'
}

function LiveTerminal({
  streamUrl = '',
  activeStepName = 'Pipeline Execution',
  autoConnect = true,
}) {
  const terminalBodyRef = useRef(null)
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true)
  const [elapsedMs, setElapsedMs] = useState(0)
  const startedAtRef = useRef(Date.now())

  const { events, endEvent, connectionState, reconnectCount } = useEventSource(streamUrl, {
    enabled: autoConnect && Boolean(streamUrl),
  })

  const logLines = useMemo(
    () =>
      events
        .filter((entry) => entry.event === 'log')
        .map((entry) => ({
          timestamp: entry.data.timestamp,
          line: entry.data.line,
          stream: entry.data.stream,
        })),
    [events],
  )

  const pipelineStatus = resolvePipelineStatus(connectionState, endEvent)

  useEffect(() => {
    if (!autoScrollEnabled || !terminalBodyRef.current) {
      return
    }
    terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight
  }, [autoScrollEnabled, logLines])

  useEffect(() => {
    if (pipelineStatus !== 'RUNNING') {
      return undefined
    }
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current)
    }, 1000)
    return () => clearInterval(timer)
  }, [pipelineStatus])

  async function copyLogsToClipboard() {
    const merged = logLines
      .map((entry, index) => `${index + 1}. [${entry.stream}] ${entry.line}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(merged)
    } catch (_error) {
      // Clipboard support depends on browser context and permissions.
    }
  }

  return (
    <section
      className="rounded border border-slate-700 bg-slate-900 p-4"
      data-testid="terminal-live-logs"
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-200">
          {pipelineStatus === 'RUNNING' && <Loader2 className="h-4 w-4 animate-spin text-teal-400" />}
          {pipelineStatus === 'COMPLETED' && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {pipelineStatus === 'FAILED' && <CircleAlert className="h-4 w-4 text-rose-400" />}
          {pipelineStatus === 'ERROR' && <RefreshCw className="h-4 w-4 text-amber-400" />}
          {pipelineStatus === 'IDLE' && <PauseCircle className="h-4 w-4 text-slate-400" />}
          <span className="font-medium" data-testid="terminal-status-label">
            {pipelineStatus}
          </span>
          <span className="text-slate-400">Step: {activeStepName}</span>
          <span className="text-slate-400">Elapsed: {formatElapsed(elapsedMs)}</span>
          {reconnectCount > 0 && (
            <span className="text-amber-400" data-testid="terminal-reconnect-count">
              reconnect {reconnectCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-400"
            onClick={() => setAutoScrollEnabled((current) => !current)}
            data-testid="btn-terminal-toggle-autoscroll"
          >
            {autoScrollEnabled ? 'Auto-scroll: On' : 'Auto-scroll: Off'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-slate-400"
            onClick={copyLogsToClipboard}
            data-testid="btn-terminal-copy-logs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Logs
          </button>
        </div>
      </header>

      <div
        ref={terminalBodyRef}
        className="max-h-80 overflow-y-auto rounded border border-slate-700 bg-black p-3 font-mono text-sm text-green-400"
      >
        {logLines.length === 0 ? (
          <p className="text-slate-400">Waiting for live pipeline logs...</p>
        ) : (
          <div className="space-y-1">
            {logLines.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="grid grid-cols-[48px_auto_1fr] gap-2"
                data-testid={`terminal-line-${index + 1}`}
              >
                <span className="text-right text-slate-500">{index + 1}</span>
                <span className="text-slate-500" data-testid={`terminal-line-time-${index + 1}`}>
                  <Timestamp value={entry.timestamp} formatType="time" fallback="" />
                </span>
                <span className={entry.stream === 'stderr' ? 'text-amber-300' : 'text-green-400'}>
                  {entry.line}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default LiveTerminal
