import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UpgradePage from '../UpgradePage.jsx'

const statusPayload = { current_version: '1.0.0', last_upgrade_at: null, arch: 'arm64', platform: 'Darwin' }
const inspectPayload = {
  valid: false,
  current_version: '1.0.0',
  bundle_version: '1.1.0',
  checks: [
    { name: 'Bundle format', passed: true, message: 'Found forge-central-v1.1.0.tar.gz' },
    { name: 'Checksum', passed: false, message: 'Companion checksum file missing' },
  ],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

describe('UpgradePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders current version card', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(statusPayload)))
    render(<UpgradePage />)

    expect(await screen.findByTestId('text-current-version')).toHaveTextContent('v1.0.0')
    expect(screen.getByTestId('card-current-version')).toHaveTextContent('arm64')
    expect(screen.getByTestId('input-upgrade-bundle-path')).toBeInTheDocument()
    expect(screen.getByTestId('card-cli-snippet')).toHaveTextContent('./scripts/build-release-bundle.sh')
  })

  test('renders pre-flight checklist after inspection', async () => {
    const fetchMock = vi.fn().mockImplementation((url) =>
      jsonResponse(url === '/api/v1/upgrade/inspect' ? inspectPayload : statusPayload),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<UpgradePage />)
    await screen.findByTestId('text-current-version')

    fireEvent.change(screen.getByTestId('input-upgrade-bundle-path'), {
      target: { value: '/mnt/forge-central-v1.1.0.tar.gz' },
    })
    fireEvent.click(screen.getByTestId('btn-inspect-upgrade'))

    await waitFor(() => expect(screen.getByTestId('list-upgrade-preflight')).toBeInTheDocument())
    expect(screen.getByTestId('item-preflight-Bundle format')).toHaveTextContent('Found forge-central-v1.1.0.tar.gz')
    expect(screen.getByTestId('item-preflight-Checksum')).toHaveTextContent('Companion checksum file missing')
    expect(screen.getByTestId('text-upgrade-verdict')).toHaveTextContent('Pre-flight failed')

    const postCall = fetchMock.mock.calls.find(([url]) => url === '/api/v1/upgrade/inspect')
    expect(JSON.parse(postCall[1].body)).toEqual({ bundle_path: '/mnt/forge-central-v1.1.0.tar.gz' })
  })
})
