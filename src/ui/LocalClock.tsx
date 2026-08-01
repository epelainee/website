import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
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
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}

/** Hold duration to open hidden search on touch (ms). */
const SEARCH_HOLD_MS = 650

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
 * Galaxy chrome:
 * - Left: local time
 * - Center (desktop) / top-right (mobile): entry count — hidden while search
 *   is open; long-press opens search on touch
 * - Right (desktop): date
 */
export function LocalClock() {
  const phase = useStore((s) => s.phase)
  const searchOpen = useStore((s) => s.searchOpen)
  const visible = phase === 'galaxy'
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const { experiences } = useContent()
  const { compact } = useViewport()
  const [now, setNow] = useState(() => new Date())
  const holdRef = useRef<number | null>(null)
  const totalEntries = compact
    ? `${experiences.length} Entries`
    : `${experiences.length} Total Entries`

  useEffect(() => {
    if (!visible) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [visible])

  useEffect(() => {
    return () => {
      if (holdRef.current !== null) window.clearTimeout(holdRef.current)
    }
  }, [])

  const clearHold = () => {
    if (holdRef.current === null) return
    window.clearTimeout(holdRef.current)
    holdRef.current = null
  }

  const onEntriesPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') return
    clearHold()
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null
      setSearchOpen(true)
    }, SEARCH_HOLD_MS)
  }

  if (!visible) return null

  return (
    <>
      <p
        aria-live="polite"
        style={{
          ...chrome,
          left: 'max(1.25rem, env(safe-area-inset-left))',
          top: 'max(1.25rem, env(safe-area-inset-top))',
          right: 'max(8rem, env(safe-area-inset-right))',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {formatTime(now)}
      </p>

      {!searchOpen && (
        <p
          onPointerDown={onEntriesPointerDown}
          onPointerUp={clearHold}
          onPointerCancel={clearHold}
          onPointerLeave={clearHold}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            ...chrome,
            top: 'max(1.25rem, env(safe-area-inset-top))',
            maxWidth: 'min(18rem, 42vw)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            pointerEvents: 'auto',
            cursor: 'default',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            ...(compact
              ? {
                  right: 'max(1.25rem, env(safe-area-inset-right))',
                  left: 'auto',
                  textAlign: 'right' as const,
                }
              : {
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center' as const,
                }),
          }}
        >
          {totalEntries}
        </p>
      )}

      {!compact && (
        <p
          style={{
            ...chrome,
            right: 'max(1.25rem, env(safe-area-inset-right))',
            top: 'max(1.25rem, env(safe-area-inset-top))',
            left: 'auto',
            textAlign: 'right',
          }}
        >
          {formatDate(now)}
        </p>
      )}
    </>
  )
}
