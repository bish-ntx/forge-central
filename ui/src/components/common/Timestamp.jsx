import React from 'react'
import { useTimezone } from '../../context/TimezoneContext.jsx'

/** Renders an ISO timestamp in the selected timezone; tooltip shows the raw UTC value. */
function Timestamp({ value, formatType = 'datetime', fallback = '—' }) {
  const { formatTimestamp } = useTimezone()
  if (!value) return <>{fallback}</>
  return (
    <time dateTime={value} title={`UTC: ${value}`} data-testid="timestamp">
      {formatTimestamp(value, formatType)}
    </time>
  )
}

export default Timestamp
