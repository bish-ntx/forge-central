import { useEffect, useRef } from 'react'

const CHANNEL_NAME = 'forge-central-events'

function hasBroadcastChannel() {
  return typeof window !== 'undefined' && 'BroadcastChannel' in window
}

export function broadcastTabEvent(eventType, payload) {
  if (!hasBroadcastChannel()) {
    return
  }
  const channel = new window.BroadcastChannel(CHANNEL_NAME)
  channel.postMessage({ type: eventType, payload })
  channel.close()
}

export function useTabSync(eventType, onEventCallback) {
  const callbackRef = useRef(onEventCallback)
  callbackRef.current = onEventCallback

  useEffect(() => {
    if (!hasBroadcastChannel()) {
      return undefined
    }
    const channel = new window.BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      if (event.data?.type === eventType) {
        callbackRef.current?.(event.data.payload)
      }
    }
    return () => channel.close()
  }, [eventType])
}

export default useTabSync
