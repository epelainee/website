import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useContent } from '../content/useContent'
import { useViewport } from './useViewport'
import { markNavHelpSeen } from '../state/navHelpSeen'

const PANEL_MS = 420
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Ignore dismiss for a beat after open so a lingering click cannot burn first-show. */
const DISMISS_GUARD_MS = 500

const keyBadge: CSSProperties = {
  display: 'inline-block',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '3px',
  padding: '0.2rem 0.35rem',
  font: '400 0.625rem/1 var(--mono)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.88)',
  verticalAlign: 'baseline',
}

/**
 * First-visit navigation manual for the galaxy.
 *
 * Auto-opened from `crush()` after the field settles (see store). Marked seen
 * only when dismissed. The `?` control reopens it anytime.
 */
export function NavHelp() {
  const { siteSettings } = useContent()
  const { coarse } = useViewport()
  const phase = useStore((s) => s.phase)
  const open = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const openedAt = useRef(0)
  const help = siteSettings.navHelp
  const lines = coarse
    ? help.stepsTouch?.length
      ? help.stepsTouch
      : help.steps
    : help.steps

  const dismiss = () => {
    if (performance.now() - openedAt.current < DISMISS_GUARD_MS) return
    markNavHelpSeen()
    setHelpOpen(false)
  }

  useEffect(() => {
    if (!open) return
    openedAt.current = performance.now()
    panelRef.current?.focus()
  }, [open])

  if (phase !== 'galaxy' || !open) return null

  const rows: ReactNode[] = [
    ...lines.map((line, i) => <li key={`s-${i}`}>{line}</li>),
    <li key="back">
      {coarse ? (
        <>
          To go back, tap{' '}
          <span style={keyBadge}>
            <span aria-hidden="true">← </span>back
          </span>{' '}
          or empty space
        </>
      ) : (
        <>
          To go back, press <span style={keyBadge}>esc</span> or click empty
          space
        </>
      )}
    </li>,
  ]

  return (
    <div
      role="presentation"
      onPointerDown={dismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding:
          'max(1.25rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left))',
        background: 'rgba(0, 0, 0, 0.45)',
      }}
    >
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: 'min(20rem, calc(100vw - 2.5rem))',
          padding: '1.35rem 1.4rem 1.25rem',
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '4px',
          color: 'rgba(255, 255, 255, 0.92)',
          textAlign: 'center',
          outline: 'none',
          animation: `nav-help-in ${PANEL_MS}ms ${EASE} both`,
        }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close help"
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            padding: '0.35rem 0.45rem',
            background: 'none',
            border: 'none',
            color: 'var(--dim)',
            font: '400 1.25rem/1 var(--mono)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ×
        </button>

        <h2
          id={titleId}
          style={{
            margin: '0 1.75rem 1rem',
            font: '500 1.15rem/1.25 var(--sans)',
            letterSpacing: '-0.02em',
            color: 'rgba(255, 255, 255, 0.95)',
          }}
        >
          {help.title}
        </h2>

        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.7rem',
            font: '400 0.8125rem/1.45 var(--sans)',
            color: 'rgba(255, 255, 255, 0.82)',
          }}
        >
          {rows}
        </ul>

        <p
          style={{
            margin: '1.15rem 0 0',
            font: '400 0.5625rem/1.4 var(--mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          Reopen anytime with ?
        </p>
      </aside>
    </div>
  )
}
