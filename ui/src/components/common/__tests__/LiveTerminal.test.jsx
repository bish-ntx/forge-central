import React from 'react'
import { render, screen } from '@testing-library/react'
import LiveTerminal from '../LiveTerminal.jsx'

vi.mock('../../../hooks/useEventSource.js', () => ({
  default: () => ({
    events: [
      {
        event: 'log',
        data: {
          timestamp: '2026-09-26T22:40:00Z',
          line: 'stdout line',
          stream: 'stdout',
        },
      },
      {
        event: 'log',
        data: {
          timestamp: '2026-09-26T22:40:01Z',
          line: 'stderr line',
          stream: 'stderr',
        },
      },
      {
        event: 'end',
        data: {
          exit_code: 0,
          status: 'COMPLETED',
        },
      },
    ],
    endEvent: { exit_code: 0, status: 'COMPLETED' },
    connectionState: 'closed',
    reconnectCount: 0,
  }),
}))

describe('LiveTerminal', () => {
  test('renders numbered log lines and stream coloring', () => {
    render(<LiveTerminal activeStepName="test-step" />)

    expect(screen.getByTestId('terminal-status-label')).toHaveTextContent('COMPLETED')
    expect(screen.getByTestId('terminal-line-1')).toHaveTextContent('1')
    expect(screen.getByTestId('terminal-line-1')).toHaveTextContent('stdout line')
    expect(screen.getByTestId('terminal-line-2')).toHaveTextContent('2')
    expect(screen.getByTestId('terminal-line-2')).toHaveTextContent('stderr line')
    expect(screen.getByText('stderr line')).toHaveClass('text-amber-300')
  })
})
