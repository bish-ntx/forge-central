import { useCallback, useEffect, useState } from 'react'

export const THEME_STORAGE_KEY = 'forge_theme_preference'
export const THEME_CYCLE = ['dark', 'light', 'system']

function prefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemeClass(themeMode) {
  document.documentElement.classList.toggle(
    'dark',
    themeMode === 'dark' || (themeMode === 'system' && prefersDark()),
  )
}

function readThemeMode() {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return THEME_CYCLE.includes(stored) ? stored : 'dark'
}

export default function useTheme() {
  const [themeMode, setThemeMode] = useState(readThemeMode)

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    applyThemeClass(themeMode)
  }, [themeMode])

  useEffect(() => {
    if (themeMode !== 'system') return undefined
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyThemeClass('system')
    mediaQuery.addEventListener?.('change', listener)
    return () => mediaQuery.removeEventListener?.('change', listener)
  }, [themeMode])

  const toggleThemeMode = useCallback(() => {
    setThemeMode((current) => THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length])
  }, [])

  return { themeMode, toggleThemeMode }
}
