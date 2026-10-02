import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import CorrelationPage from '../CorrelationPage.jsx'
import Layout from '../../components/layout/Layout.jsx'

const matrixPayload = {
  clusters: [
    {
      cluster_name: 'amd-nkp1',
      cluster_status: 'ready',
      nkp_version: 'v2.17.0',
      k8s_version: 'v1.32.3',
      latest_suite: 'nkpday2-gpu',
      passed: 40,
      failed: 0,
      qualification_status: 'qualified',
      last_tested_at: '2026-10-01T10:00:00Z',
    },
    {
      cluster_name: 'cirra-nkp1',
      cluster_status: 'ready',
      nkp_version: 'unknown',
      k8s_version: 'v1.32.3',
      latest_suite: 'nkpday2-csi',
      passed: 12,
      failed: 3,
      qualification_status: 'failing',
      last_tested_at: '2026-10-01T11:00:00Z',
    },
    {
      cluster_name: 'ntx-nkp1',
      cluster_status: 'deploying',
      nkp_version: 'unknown',
      k8s_version: 'v1.31.1',
      latest_suite: null,
      passed: null,
      failed: null,
      qualification_status: 'untested',
      last_tested_at: null,
    },
  ],
  total_qualified: 1,
  total_failing: 1,
  total_untested: 1,
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

describe('CorrelationPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders header, KPI cards and table rows with badges', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(matrixPayload)))
    render(<CorrelationPage />)

    expect(screen.getByTestId('header-correlation')).toHaveTextContent(
      'Cross-Repo Qualification & Telemetry Matrix',
    )
    await waitFor(() => expect(screen.getByTestId('card-total-qualified')).toHaveTextContent('1'))
    expect(screen.getByTestId('card-total-failing')).toHaveTextContent('1')
    expect(screen.getByTestId('card-total-untested')).toHaveTextContent('1')

    const table = screen.getByTestId('table-correlation')
    expect(within(table).getByTestId('row-correlation-amd-nkp1')).toHaveTextContent('nkpday2-gpu')
    expect(within(table).getByTestId('row-correlation-amd-nkp1')).toHaveTextContent('40 / 0')
    expect(within(table).getByTestId('row-correlation-cirra-nkp1')).toHaveTextContent('12 / 3')
    expect(within(table).getByTestId('row-correlation-ntx-nkp1')).toHaveTextContent('Never')

    const badges = screen.getAllByTestId('badge-qualification-status')
    expect(badges.map((badge) => badge.textContent)).toEqual(['QUALIFIED', 'FAILING', 'UNTESTED'])
    expect(badges[0].className).toContain('emerald')
    expect(badges[1].className).toContain('rose')
    expect(badges[2].className).toContain('amber')
  })

  test('shows CLI snippet card and simulate ingestion posts then reloads', async () => {
    const fetchMock = vi.fn().mockImplementation(() => jsonResponse(matrixPayload))
    vi.stubGlobal('fetch', fetchMock)
    render(<CorrelationPage />)
    await waitFor(() => expect(screen.getByTestId('row-correlation-amd-nkp1')).toBeInTheDocument())

    expect(screen.getByTestId('card-telemetry-cli-snippet')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('btn-simulate-ingestion'))

    await waitFor(() => expect(screen.getByTestId('simulate-ingestion-message')).toHaveTextContent('amd-nkp1'))
    const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(postCall[0]).toBe('/api/v1/telemetry/ingest/test-run')
    expect(JSON.parse(postCall[1].body).cluster_name).toBe('amd-nkp1')
    expect(fetchMock.mock.calls.filter(([url]) => url === '/api/v1/telemetry/correlation')).toHaveLength(2)
  })

  test('sidebar link navigates to /analytics/correlation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(matrixPayload)))
    render(
      <MemoryRouter initialEntries={['/vms']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="vms" element={<div data-testid="page-vms" />} />
            <Route path="analytics/correlation" element={<CorrelationPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByTestId('link-analytics-correlation'))
    expect(await screen.findByTestId('header-correlation')).toBeInTheDocument()
  })

  test('command palette offers Qualification Matrix navigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(matrixPayload)))
    render(
      <MemoryRouter initialEntries={['/vms']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="vms" element={<div data-testid="page-vms" />} />
            <Route path="analytics/correlation" element={<CorrelationPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByTestId('command-item-nav-analytics-correlation'))
    expect(await screen.findByTestId('header-correlation')).toBeInTheDocument()
  })
})
