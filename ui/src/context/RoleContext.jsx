import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const ROLE_STORAGE_KEY = 'forge_role'
export const ROLES = ['viewer', 'operator', 'admin']
export const ROLE_LABELS = { viewer: 'Demo (Viewer)', operator: 'Operator', admin: 'Admin' }
export const VIEWER_DENIED_MESSAGE = 'Action disabled in Demo/Viewer mode'
export const OPERATOR_DENIED_MESSAGE = 'Day-0 infrastructure setup requires Admin role'
const DEFAULT_ROLE = 'operator'

// A role chosen with "Remember my choice" lives in localStorage; otherwise in sessionStorage (tab-scoped).
function readChosenRole() {
  try {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY) ?? window.sessionStorage.getItem(ROLE_STORAGE_KEY)
    return ROLES.includes(stored) ? stored : null
  } catch (_error) {
    return null
  }
}

function readStoredRole() {
  return readChosenRole() ?? DEFAULT_ROLE
}

function persistRole(role, remember) {
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY)
    window.sessionStorage.removeItem(ROLE_STORAGE_KEY)
    if (role) (remember ? window.localStorage : window.sessionStorage).setItem(ROLE_STORAGE_KEY, role)
  } catch (_error) {
    // Storage may be unavailable; the role is in-memory only then.
  }
}

function isSessionOnly() {
  try {
    return window.sessionStorage.getItem(ROLE_STORAGE_KEY) !== null
  } catch (_error) {
    return false
  }
}

/** Headers for mutating API calls so the backend can enforce the viewer guard. */
export function roleHeaders(extra = {}) {
  return { ...extra, 'X-Forge-Role': readStoredRole() }
}

function buildValue(role, setRole, hasSession = true, signOut = () => {}) {
  const isViewer = role === 'viewer'
  const isAdmin = role === 'admin'
  const guard = (allowed, disabled = false) => ({
    disabled: disabled || !allowed,
    title: allowed ? undefined : isViewer ? VIEWER_DENIED_MESSAGE : OPERATOR_DENIED_MESSAGE,
  })
  return {
    role,
    label: ROLE_LABELS[role],
    isViewer,
    isAdmin,
    canMutate: !isViewer,
    canManageInfra: isAdmin,
    /** False until a role was picked on the gateway screen or restored from storage. */
    hasSession,
    setRole,
    /** Forget the stored role so the gateway screen is shown again. */
    signOut,
    /** Props for operator-level mutating controls: disabled + tooltip in viewer mode. */
    mutationProps: (disabled = false) => guard(!isViewer, disabled),
    /** Props for Day-0 admin controls: disabled + tooltip unless role is admin. */
    adminProps: (disabled = false) => guard(isAdmin, disabled),
    /** Validate the passphrase server-side; elevates to admin and resolves true on success. */
    unlockAdmin: async (passphrase, options) => {
      const response = await fetch('/api/v1/auth/unlock-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      })
      if (!response.ok) return false
      setRole('admin', options)
      return true
    },
  }
}

// Default (no provider): operator with no-op setter. Keeps isolated component tests working.
const RoleContext = createContext(buildValue(DEFAULT_ROLE, () => {}))

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(readStoredRole)
  const [hasSession, setHasSession] = useState(() => readChosenRole() !== null)
  const setRole = useCallback((next, { remember } = {}) => {
    if (!ROLES.includes(next)) return
    // Keep the current storage scope unless the caller picks one (session-only stays session-only).
    persistRole(next, remember ?? !isSessionOnly())
    setRoleState(next)
    setHasSession(true)
  }, [])
  const signOut = useCallback(() => {
    persistRole(null, false)
    setRoleState(DEFAULT_ROLE)
    setHasSession(false)
  }, [])

  const value = useMemo(() => buildValue(role, setRole, hasSession, signOut), [role, setRole, hasSession, signOut])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
