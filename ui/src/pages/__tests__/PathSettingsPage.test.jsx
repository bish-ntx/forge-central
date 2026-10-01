import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import PathSettingsPage from '../PathSettingsPage.jsx'

const pathsPayload = {
  paths: [
    { name: 'FORGE_HOME', path: '/srv/forge', exists: true, accessible: true, writable: true, status: 'accessible', free_bytes: 50 * 1024 ** 3, total_bytes: 100 * 1024 ** 3 },
    { name: 'FORGE_DATA_DIR', path: '/srv/data', exists: true, accessible: true, writable: false, status: 'read-only', free_bytes: 10 * 1024 ** 3, total_bytes: 100 * 1024 ** 3 },
    { name: 'FORGE_BACKUP_DIR', path: '/srv/backup', exists: false, accessible: false, writable: false, status: 'missing', free_bytes: 0, total_bytes: 0 },
  ],
}

function jsonResponse(payload, ok = true) {
  return Promise.resolve({ ok, json: async () => payload })
}

describe('PathSettingsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders path cards with status badges', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => jsonResponse(pathsPayload)))
    render(<PathSettingsPage />)

    expect(await screen.findByTestId('card-path-FORGE_HOME')).toHaveTextContent('/srv/forge')
    expect(screen.getByTestId('badge-path-status-FORGE_HOME')).toHaveTextContent('accessible')
    expect(screen.getByTestId('badge-path-status-FORGE_DATA_DIR')).toHaveTextContent('read-only')
    expect(screen.getByTestId('badge-path-status-FORGE_BACKUP_DIR')).toHaveTextContent('missing')
    expect(screen.getByTestId('card-path-FORGE_HOME')).toHaveTextContent('50.0 GB free of 100.0 GB (50% used)')
    expect(screen.getByTestId('input-migration-source')).toHaveValue('~/forge-state')
    expect(screen.getByTestId('input-migration-target')).toHaveValue('~/forge-data')
  })

  test('falls back to seed data when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<PathSettingsPage />)

    expect(await screen.findByTestId('card-path-FORGE_LOG_DIR')).toBeInTheDocument()
  })

  test('submits migration with dry-run toggle', async () => {
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/v1/settings/paths/migrate') {
        return jsonResponse({
          success: true,
          dry_run: false,
          source_dir: '/a',
          target_dir: '/b',
          files_scanned: 3,
          files_migrated: 3,
          bytes_migrated: 42,
          migrated_files: [],
          message: 'Migrated 3 file(s)',
        })
      }
      return jsonResponse(pathsPayload)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<PathSettingsPage />)
    await screen.findByTestId('card-path-FORGE_HOME')

    const checkbox = screen.getByTestId('checkbox-migration-dry-run')
    expect(checkbox).toBeChecked()
    fireEvent.click(checkbox)
    expect(checkbox).not.toBeChecked()

    fireEvent.click(screen.getByTestId('btn-trigger-migration'))

    await waitFor(() => expect(screen.getByTestId('alert-migration-result')).toBeInTheDocument())
    expect(screen.getByTestId('alert-migration-result')).toHaveTextContent('Migrated 3 file(s)')
    expect(screen.getByTestId('alert-migration-result')).toHaveTextContent('Scanned: 3')

    const postCall = fetchMock.mock.calls.find(([url]) => url === '/api/v1/settings/paths/migrate')
    expect(JSON.parse(postCall[1].body)).toEqual({
      source_dir: '~/forge-state',
      target_dir: '~/forge-data',
      dry_run: false,
    })
  })

  test('renders backups section and creates a backup', async () => {
    const backup = {
      backup_id: 'forge-central-backup-1',
      filename: 'forge-central-backup-1.tar.gz',
      file_size_bytes: 2048,
      created_at: '2026-09-30T00:00:00Z',
      checksum_sha256: 'abc123',
    }
    let created = false
    const fetchMock = vi.fn().mockImplementation((url) => {
      if (url === '/api/v1/backup/create') {
        created = true
        return jsonResponse({ ...backup, status: 'completed' })
      }
      if (url === '/api/v1/backup/list') {
        return jsonResponse({ backups: created ? [backup] : [] })
      }
      return jsonResponse(pathsPayload)
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<PathSettingsPage />)

    expect(await screen.findByTestId('section-backups')).toBeInTheDocument()
    expect(screen.getByTestId('table-backups')).toHaveTextContent('SHA-256 Checksum')
    expect(screen.getByTestId('btn-create-backup')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('btn-create-backup'))

    await waitFor(() => expect(screen.getByTestId('table-backups')).toHaveTextContent('forge-central-backup-1.tar.gz'))
    expect(screen.getByTestId('table-backups')).toHaveTextContent('abc123')
    expect(fetchMock.mock.calls.find(([url]) => url === '/api/v1/backup/create')[1].method).toBe('POST')
  })
})
