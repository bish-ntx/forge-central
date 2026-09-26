import { useCallback, useEffect, useRef, useState } from 'react'

function safeParseEventData(raw) {
  try {
    return JSON.parse(raw)
  } catch (_error) {
    return null
  }
}

export default function useEventSource(
  url,
  { enabled = true, reconnectDelayMs = 2000, maxReconnectAttempts = 5 } = {},
) {
  const [events, setEvents] = useState([])
  const [connectionState, setConnectionState] = useState('idle')
  const [endEvent, setEndEvent] = useState(null)
  const [reconnectCount, setReconnectCount] = useState(0)

  const sourceRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const disconnect = useCallback(() => {
    clearReconnectTimer()
    if (sourceRef.current) {
      sourceRef.current.close()
      sourceRef.current = null
    }
    setConnectionState('closed')
  }, [clearReconnectTimer])

  const connect = useCallback(() => {
    if (!enabled || !url) {
      return
    }

    clearReconnectTimer()
    if (sourceRef.current) {
      sourceRef.current.close()
    }

    setConnectionState('connecting')
    const source = new EventSource(url)
    sourceRef.current = source

    source.onopen = () => {
      reconnectAttemptRef.current = 0
      setReconnectCount(0)
      setConnectionState('open')
    }

    source.addEventListener('log', (event) => {
      const payload = safeParseEventData(event.data)
      if (!payload) {
        return
      }
      setEvents((previous) => [...previous, { event: 'log', data: payload }])
    })

    source.addEventListener('end', (event) => {
      const payload = safeParseEventData(event.data)
      if (!payload) {
        return
      }
      setEvents((previous) => [...previous, { event: 'end', data: payload }])
      setEndEvent(payload)
      setConnectionState('closed')
      source.close()
      sourceRef.current = null
    })

    source.onerror = () => {
      source.close()
      sourceRef.current = null
      setConnectionState('error')

      if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        return
      }

      reconnectAttemptRef.current += 1
      setReconnectCount(reconnectAttemptRef.current)
      reconnectTimerRef.current = setTimeout(() => {
        connect()
      }, reconnectDelayMs)
    }
  }, [clearReconnectTimer, enabled, maxReconnectAttempts, reconnectDelayMs, url])

  useEffect(() => {
    if (!enabled || !url) {
      return undefined
    }

    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect, enabled, url])

  return {
    events,
    endEvent,
    connectionState,
    reconnectCount,
    connect,
    disconnect,
  }
}
