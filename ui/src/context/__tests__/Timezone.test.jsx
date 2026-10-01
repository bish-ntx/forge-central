import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Header from '../../components/layout/Header.jsx'
import Timestamp from '../../components/common/Timestamp.jsx'
import {
  FALLBACK_TIMEZONE,
  TIMEZONE_STORAGE_KEY,
  TimezoneProvider,
  detectTimezone,
  formatInZone,
} from '../TimezoneContext.jsx'

const ISO = '2026-10-01T01:15:30Z'

function renderWithProvider(ui) {
  return render(<TimezoneProvider>{ui}</TimezoneProvider>)
}

describe('formatInZone', () => {
  test('renders the same instant in Pacific local time vs UTC', () => {
    const local = formatInZone(ISO, 'datetime', 'America/Los_Angeles')
    expect(local).toContain('Sep 30, 2026')
    expect(local).toContain('18:15:30')
    expect(local).toContain('PDT')

    const utc = formatInZone(ISO, 'datetime', 'UTC')
    expect(utc).toContain('Oct 01, 2026')
    expect(utc).toContain('01:15:30')
    expect(utc).toContain('UTC')
  })

  test('supports date and time format types', () => {
    expect(formatInZone(ISO, 'date', 'America/Los_Angeles')).toBe('Sep 30, 2026')
    expect(formatInZone(ISO, 'time', 'America/Los_Angeles')).toBe('18:15:30 PDT')
  })

  test('handles legacy +00:00 offsets, invalid and empty input', () => {
    expect(formatInZone('2026-10-01T01:15:30+00:00', 'time', 'UTC')).toBe('01:15:30 UTC')
    expect(formatInZone('not-a-date')).toBe('not-a-date')
    expect(formatInZone('')).toBe('—')
  })

  test('detectTimezone falls back to America/Los_Angeles when Intl fails', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('no intl')
    })
    expect(detectTimezone()).toBe(FALLBACK_TIMEZONE)
    spy.mockRestore()
  })
})

describe('Timezone toggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('Header toggle switches between Local and UTC and persists the choice', async () => {
    renderWithProvider(<Header mode="console" themeMode="dark" />)
    const toggle = await screen.findByTestId('button-timezone-toggle')
    expect(toggle).toHaveTextContent('(Local)')
    expect(window.localStorage.getItem(TIMEZONE_STORAGE_KEY)).toBe('local')

    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('UTC')
    expect(toggle).not.toHaveTextContent('(Local)')
    expect(window.localStorage.getItem(TIMEZONE_STORAGE_KEY)).toBe('utc')

    fireEvent.click(toggle)
    expect(toggle).toHaveTextContent('(Local)')
    expect(window.localStorage.getItem(TIMEZONE_STORAGE_KEY)).toBe('local')
  })

  test('restores the persisted UTC preference on mount', async () => {
    window.localStorage.setItem(TIMEZONE_STORAGE_KEY, 'utc')
    renderWithProvider(<Header mode="console" themeMode="dark" />)
    expect(await screen.findByTestId('button-timezone-toggle')).toHaveTextContent('UTC')
  })

  test('Timestamp follows the mode and exposes raw UTC in its tooltip', async () => {
    renderWithProvider(
      <>
        <Header mode="console" themeMode="dark" />
        <Timestamp value={ISO} />
      </>,
    )
    const stamp = screen.getByTestId('timestamp')
    expect(stamp).toHaveAttribute('title', `UTC: ${ISO}`)
    expect(stamp).toHaveTextContent(formatInZone(ISO, 'datetime', detectTimezone()))

    fireEvent.click(await screen.findByTestId('button-timezone-toggle'))
    expect(screen.getByTestId('timestamp')).toHaveTextContent('Oct 01, 2026, 01:15:30 UTC')
    expect(screen.getByTestId('timestamp')).toHaveAttribute('title', `UTC: ${ISO}`)
  })

  test('Timestamp renders the fallback when no value is given', () => {
    renderWithProvider(<Timestamp value={null} fallback="never" />)
    expect(screen.getByText('never')).toBeInTheDocument()
  })
})
