import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export const ROLE_STORAGE_KEY = 'forge_role'
export const ROLES = ['viewer', 'operator', 'admin']
export const ROLE_LABELS = { viewer: 'Demo (Viewer)', operator: 'Operator', admin: 'Admin' }
export const VIEWER_DENIED_MESSAGE = 'Action disabled in Demo/Viewer mode'
export const OPERATOR_DENIED_MESSAGE = 'Day-0 infrastructure setup requires Admin role'
const DEFAULT_ROLE = 'operator'

function readStoredRole() {
  try {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY)
    return ROLES.includes(stored) ? stored : DEFAULT_ROLE
  } catch (_error) {
    return DEFAULT_ROLE
  }
}

/** Headers for mutating API calls so the backend can enforce the viewer guard. */
export function roleHeaders(extra = {}) {
  return { ...extra, 'X-Forge-Role': readStoredRole() }
}

function buildValue(role, setRole) {
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
    setRole,
    /** Props for operator-level mutating controls: disabled + tooltip in viewer mode. */
    mutationProps: (disabled = false) => guard(!isViewer, disabled),
    /** Props for Day-0 admin controls: disabled + tooltip unless role is admin. */
    adminProps: (disabled = false) => guard(isAdmin, disabled),
    /** Validate the passphrase server-side; elevates to admin and resolves true on success. */
    unlockAdmin: async (passphrase) => {
      const response = await fetch('/api/v1/auth/unlock-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase }),
      })
      if (!response.ok) return false
      setRole('admin')
      return true
    },
  }
}

// Default (no provider): operator with no-op setter. Keeps isolated component tests working.
const RoleContext = createContext(buildValue(DEFAULT_ROLE, () => {}))

export function RoleProvider({ children }) {
  const [role, setRoleState] = useState(readStoredRole)
  const setRole = useCallback((next) => ROLES.includes(next) && setRoleState(next), [])

  useEffect(() => {
    try {
      window.localStorage.setItem(ROLE_STORAGE_KEY, role)
    } catch (_error) {
      // Storage may be unavailable; role is session-only then.
    }
  }, [role])

  const value = useMemo(() => buildValue(role, setRole), [role, setRole])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole() {
  return useContext(RoleContext)
}
