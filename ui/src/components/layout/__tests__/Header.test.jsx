import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

describe('Header theme toggle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test.each([
    ['dark', 'Theme: Dark'],
    ['light', 'Theme: Light'],
    ['system', 'Theme: System'],
  ])('shows %s label and calls onToggleThemeMode on click', async (themeMode, label) => {
    mockHealth({ status: 'healthy', mock_mode: false })
    const onToggleThemeMode = vi.fn()
    render(<Header mode="console" themeMode={themeMode} onToggleThemeMode={onToggleThemeMode} />)

    const toggle = screen.getByTestId('toggle-theme-mode')
    expect(toggle).toHaveTextContent(label)
    expect(toggle.className).toContain('dark:bg-slate-800')
    expect(screen.getByTestId('layout-header').className).toContain('bg-white')
    expect(screen.getByTestId('layout-header').className).toContain('dark:bg-slate-900')

    fireEvent.click(toggle)
    expect(onToggleThemeMode).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })
})
