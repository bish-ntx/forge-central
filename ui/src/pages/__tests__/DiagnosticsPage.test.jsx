import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DiagnosticsPage from '../DiagnosticsPage.jsx'

const bundlesPayload = {
  bundles: [
    {
      bundle_id: 'bundle-amd-nkp1-20260926',
      cluster_name: 'amd-nkp1',
      filename: 'bundle-amd-nkp1-20260926.tar.gz',
      file_size_bytes: 152034918,
      captured_at: '2026-09-26T10:45:00+00:00',
      status: 'ready',
    },
  ],
}

const auditPayload = {
  logs: [
    {
      run_id: 'run-diag-capture-amd-nkp1',
      timestamp: '2026-09-26T11:20:00+00:00',
      verb: 'diagnostics-capture',
      user: 'console-operator',
      status: 'succeeded',
      duration_sec: 12.4,
    },
  ],
  total_count: 1,
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => payload,
  })
}

describe('DiagnosticsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders capture card and diagnostics tables', async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/v1/diagnostics/bundles') {
        return jsonResponse(bundlesPayload)
      }
      if (url === '/api/v1/audit/logs') {
        return jsonResponse(auditPayload)
      }
      return jsonResponse({}, false)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<DiagnosticsPage />)

    expect(screen.getByTestId('card-diagnostics-capture')).toBeInTheDocument()
    expect(screen.getByTestId('input-diagnostics-cluster')).toBeInTheDocument()
    expect(screen.getByTestId('btn-capture-diagnostics')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('table-diagnostic-bundles')).toBeInTheDocument())
    expect(screen.getByText('bundle-amd-nkp1-20260926.tar.gz')).toBeInTheDocument()
    expect(screen.getByTestId('table-audit-logs')).toBeInTheDocument()
    expect(screen.getByText('run-diag-capture-amd-nkp1')).toBeInTheDocument()
  })

  test('capture button triggers capture API and reloads tables', async () => {
    const fetchMock = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/v1/diagnostics/capture') {
        expect(options?.method).toBe('POST')
        return jsonResponse({
          bundle_id: 'bundle-amd-nkp1-20260926120000',
          cluster_name: 'amd-nkp1',
          filename: 'bundle-amd-nkp1-20260926120000.tar.gz',
          file_size_bytes: 99000000,
          status: 'ready',
          captured_at: '2026-09-26T12:00:00+00:00',
          download_url: '/api/v1/diagnostics/bundles/bundle-amd-nkp1-20260926120000',
        })
      }
      if (url === '/api/v1/diagnostics/bundles') {
        return jsonResponse(bundlesPayload)
      }
      if (url === '/api/v1/audit/logs') {
        return jsonResponse(auditPayload)
      }
      return jsonResponse({}, false)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<DiagnosticsPage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())

    fireEvent.click(screen.getByTestId('btn-capture-diagnostics'))

    await waitFor(() => {
      const captureCalls = fetchMock.mock.calls.filter((call) => call[0] === '/api/v1/diagnostics/capture')
      expect(captureCalls.length).toBe(1)
    })
  })
})
