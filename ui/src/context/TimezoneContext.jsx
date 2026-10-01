import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const TIMEZONE_STORAGE_KEY = 'forge_timezone_mode'
export const FALLBACK_TIMEZONE = 'America/Los_Angeles'

const DATE_OPTIONS = { year: 'numeric', month: 'short', day: '2-digit' }
const TIME_OPTIONS = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }

export function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE
  } catch (_error) {
    return FALLBACK_TIMEZONE
  }
}

function parseIso(isoString) {
  if (!isoString) return null
  const parsed = new Date(isoString)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function shortZoneName(timeZone, date = new Date()) {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((item) => item.type === 'timeZoneName')
  return part?.value ?? timeZone
}

/** Format an ISO 8601 string in `timeZone`. formatType: 'datetime' | 'date' | 'time'. */
export function formatInZone(isoString, formatType = 'datetime', timeZone = detectTimezone()) {
  const date = parseIso(isoString)
  if (!date) return isoString ? String(isoString) : '—'
  const options = {
    date: DATE_OPTIONS,
    time: TIME_OPTIONS,
    datetime: { ...DATE_OPTIONS, ...TIME_OPTIONS },
  }[formatType] ?? { ...DATE_OPTIONS, ...TIME_OPTIONS }
  const text = new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(date)
  return formatType === 'date' ? text : `${text} ${shortZoneName(timeZone, date)}`
}

function buildValue(mode, setMode) {
  const localZone = detectTimezone()
  const timeZone = mode === 'utc' ? 'UTC' : localZone
  return {
    mode,
    timeZone,
    localZone,
    label: mode === 'utc' ? 'UTC' : `${shortZoneName(localZone)} (Local)`,
    formatTimestamp: (isoString, formatType = 'datetime') => formatInZone(isoString, formatType, timeZone),
    toggleMode: () => setMode((current) => (current === 'utc' ? 'local' : 'utc')),
  }
}

// Default (no provider): local mode, read-only toggle. Keeps isolated component tests working.
const TimezoneContext = createContext(buildValue('local', () => {}))

function readStoredMode() {
  try {
    return window.localStorage.getItem(TIMEZONE_STORAGE_KEY) === 'utc' ? 'utc' : 'local'
  } catch (_error) {
    return 'local'
  }
}

export function TimezoneProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode)

  useEffect(() => {
    try {
      window.localStorage.setItem(TIMEZONE_STORAGE_KEY, mode)
    } catch (_error) {
      // Storage may be unavailable (private mode); preference is session-only then.
    }
  }, [mode])

  const value = useMemo(() => buildValue(mode, setMode), [mode])
  return <TimezoneContext.Provider value={value}>{children}</TimezoneContext.Provider>
}

export function useTimezone() {
  return useContext(TimezoneContext)
}
