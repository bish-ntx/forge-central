import { renderHook } from '@testing-library/react'
import { broadcastTabEvent, useTabSync } from '../useTabSync.js'

const channels = []

class FakeBroadcastChannel {
  constructor(name) {
    this.name = name
    this.closed = false
    channels.push(this)
  }

  postMessage(data) {
    channels
      .filter((c) => c !== this && !c.closed && c.name === this.name)
      .forEach((c) => c.onmessage?.({ data }))
  }

  close() {
    this.closed = true
  }
}

describe('useTabSync', () => {
  beforeEach(() => {
    channels.length = 0
    window.BroadcastChannel = FakeBroadcastChannel
  })

  afterEach(() => {
    delete window.BroadcastChannel
  })

  test('delivers matching events to subscribers', () => {
    const callback = vi.fn()
    const other = vi.fn()
    renderHook(() => useTabSync('vm_created', callback))
    renderHook(() => useTabSync('cluster_deleted', other))

    broadcastTabEvent('vm_created', { vmid: 100 })

    expect(callback).toHaveBeenCalledWith({ vmid: 100 })
    expect(other).not.toHaveBeenCalled()
  })

  test('is a safe no-op without BroadcastChannel', () => {
    delete window.BroadcastChannel
    expect(() => broadcastTabEvent('vm_created', {})).not.toThrow()
    expect(() => renderHook(() => useTabSync('vm_created', vi.fn()))).not.toThrow()
  })
})
