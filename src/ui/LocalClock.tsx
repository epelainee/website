import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useContent } from '../content/useContent'
import { useStore } from '../state/store'
import { useViewport } from './useViewport'

const chrome: CSSProperties = {
  position: 'fixed',
  zIndex: 20,
  margin: 0,
  font: '400 0.625rem/1 var(--mono)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.88)',
  textShadow: '0 0 8px #000',
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Galaxy chrome: local time top-left, total entries top-center (wide), local
 * date top-right — on compact viewports the date slot shows total entries instead.
 */
export function LocalClock() {
  const phase = useStore((s) => s.phase)
  const visible = phase === 'galaxy'
  const { experiences } = useContent()
  const { compact } = useViewport()
  const [now, setNow] = useState(() => new Date())
  const totalEntries = `${experiences.length} Total Entries`

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [visible])

  if (!visible) return null

  return (
    <>
      <p
        aria-live="polite"
        style={{
          ...chrome,
          left: 'max(1.25rem, env(safe-area-inset-left))',
          top: 'max(1.25rem, env(safe-area-inset-top))',
          right: 'max(7rem, env(safe-area-inset-right))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {formatTime(now)}
      </p>
      {!compact ? (
        <p
          style={{
            ...chrome,
            left: '50%',
            top: 'max(1.25rem, env(safe-area-inset-top))',
            transform: 'translateX(-50%)',
            textAlign: 'center',
          }}
        >
          {totalEntries}
        </p>
      ) : null}
      <p
        style={{
          ...chrome,
          right: 'max(1.25rem, env(safe-area-inset-right))',
          top: 'max(1.25rem, env(safe-area-inset-top))',
          left: 'max(7rem, env(safe-area-inset-left))',
          textAlign: 'right',
          whiteSpace: compact ? 'nowrap' : 'normal',
          lineHeight: 1.35,
        }}
      >
        {compact ? totalEntries : formatDate(now)}
      </p>
    </>
  )
}
