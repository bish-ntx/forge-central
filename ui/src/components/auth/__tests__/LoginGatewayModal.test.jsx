import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginGatewayModal from '../LoginGatewayModal.jsx'
import Header from '../../layout/Header.jsx'
import { ROLE_STORAGE_KEY, RoleProvider } from '../../../context/RoleContext.jsx'

function renderGateway() {
  return render(
    <MemoryRouter>
      <RoleProvider>
        <Header mode="console" themeMode="dark" onToggleMode={() => {}} onToggleThemeMode={() => {}} />
        <LoginGatewayModal />
      </RoleProvider>
    </MemoryRouter>,
  )
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

describe('LoginGatewayModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({ mock_mode: false })))
  })

  test('is shown on first visit and hidden when a role is already stored', () => {
    const { unmount } = renderGateway()
    expect(screen.getByTestId('modal-login-gateway')).toHaveTextContent('Welcome to Forge Central')
    expect(screen.getByTestId('btn-gateway-operator')).toHaveTextContent('Enter as Operator / Viewer')
    expect(screen.getByTestId('btn-gateway-admin')).toHaveTextContent('Unlock as Administrator')
    unmount()

    window.localStorage.setItem(ROLE_STORAGE_KEY, 'viewer')
    renderGateway()
    expect(screen.queryByTestId('modal-login-gateway')).not.toBeInTheDocument()
  })

  test('quick Operator entry is session-only unless "Remember" is checked', () => {
    const { unmount } = renderGateway()
    fireEvent.click(screen.getByTestId('btn-gateway-operator'))
    expect(screen.queryByTestId('modal-login-gateway')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem(ROLE_STORAGE_KEY)).toBe('operator')
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBeNull()
    unmount()
    window.sessionStorage.clear()

    renderGateway()
    fireEvent.click(screen.getByTestId('checkbox-gateway-remember'))
    fireEvent.click(screen.getByTestId('btn-gateway-viewer'))
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe('viewer')
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Demo (Viewer)')
  })

  test('admin unlock rejects a wrong passphrase, then accepts the right one', async () => {
    renderGateway()
    fireEvent.click(screen.getByTestId('btn-gateway-admin'))
    expect(screen.getByTestId('btn-gateway-submit-admin')).toBeDisabled()

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse({ detail: 'nope' }, false)))
    fireEvent.change(screen.getByTestId('input-gateway-passphrase'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByTestId('btn-gateway-submit-admin'))
    expect(await screen.findByTestId('text-gateway-error')).toHaveTextContent('Invalid admin passphrase')
    expect(screen.getByTestId('modal-login-gateway')).toBeInTheDocument()

    const fetchMock = vi.fn().mockImplementation(() => jsonResponse({ status: 'authorized', role: 'admin' }))
    vi.stubGlobal('fetch', fetchMock)
    fireEvent.click(screen.getByTestId('checkbox-gateway-remember'))
    fireEvent.change(screen.getByTestId('input-gateway-passphrase'), { target: { value: 'Nutanix.123' } })
    fireEvent.click(screen.getByTestId('btn-gateway-submit-admin'))

    await waitFor(() => expect(screen.queryByTestId('modal-login-gateway')).not.toBeInTheDocument())
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/unlock-admin')
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Admin')
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe('admin')
  })

  test('Log Out in the header clears the role and brings the gateway back', () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, 'admin')
    renderGateway()
    expect(screen.queryByTestId('modal-login-gateway')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-logout-switch-user'))
    expect(screen.getByTestId('modal-login-gateway')).toBeInTheDocument()
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBeNull()
    expect(screen.getByTestId('badge-role-switcher')).toHaveTextContent('Operator')
  })
})
