import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import CliSnippetCard from '../CliSnippetCard.jsx'

describe('CliSnippetCard', () => {
  it('renders title, command text and copy button', () => {
    render(<CliSnippetCard command="./forge diagnose --cluster-name demo" />)

    expect(screen.getByTestId('card-cli-snippet')).toBeInTheDocument()
    expect(screen.getByText('CLI Equivalent')).toBeInTheDocument()
    expect(screen.getByText('./forge diagnose --cluster-name demo')).toBeInTheDocument()
    expect(screen.getByTestId('btn-copy-cli-snippet')).toBeInTheDocument()
  })

  it('copies the command to the clipboard and shows feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<CliSnippetCard command="./forge share --share-name data" />)
    fireEvent.click(screen.getByTestId('btn-copy-cli-snippet'))

    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument())
    expect(writeText).toHaveBeenCalledWith('./forge share --share-name data')
  })
})
