import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import Header from '../Header.jsx'

function mockHealth(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
  )
}

describe('Header mock mode badge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('renders badge-mock-mode when /health reports mock_mode', async () => {
    mockHealth({ status: 'healthy', mock_mode: true })
    render(<Header mode="console" themeMode="dark" />)

    expect(await screen.findByTestId('badge-mock-mode')).toHaveTextContent(
      '[SYNTHETIC MOCK MODE]',
    )
  })

  test('hides badge-mock-mode when mock_mode is false', async () => {
    mockHealth({ status: 'healthy', mock_mode: false })
    render(<Header mode="console" themeMode="dark" />)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/health'))
    expect(screen.queryByTestId('badge-mock-mode')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-mode-badge')).toBeInTheDocument()
  })
})
