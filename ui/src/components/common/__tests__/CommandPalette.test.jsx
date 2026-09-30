import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Layout from '../../layout/Layout.jsx'

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/vms']}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="vms" element={<div data-testid="page-vms" />} />
          <Route path="fleet" element={<div data-testid="page-fleet" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('CommandPalette', () => {
  test('opens with Ctrl+K, Meta+K and header button', () => {
    renderLayout()
    expect(screen.queryByTestId('command-palette-modal')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(screen.getByTestId('command-palette-modal')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('command-palette-modal')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    expect(screen.getByTestId('command-palette-modal')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.click(screen.getByTestId('btn-open-command-palette'))
    expect(screen.getByTestId('command-palette-modal')).toBeInTheDocument()
  })

  test('filters results and navigates on click', () => {
    renderLayout()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    fireEvent.change(screen.getByTestId('input-command-palette'), { target: { value: 'fleet' } })
    expect(screen.getByTestId('command-item-nav-fleet')).toBeInTheDocument()
    expect(screen.queryByTestId('command-item-nav-vms')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('command-item-nav-fleet'))
    expect(screen.getByTestId('page-fleet')).toBeInTheDocument()
    expect(screen.queryByTestId('command-palette-modal')).not.toBeInTheDocument()
  })

  test('closes when clicking the backdrop', () => {
    renderLayout()
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    fireEvent.click(screen.getByTestId('command-palette-backdrop'))
    expect(screen.queryByTestId('command-palette-modal')).not.toBeInTheDocument()
  })
})
