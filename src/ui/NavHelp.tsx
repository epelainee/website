import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useStore } from '../state/store'
import { useContent } from '../content/useContent'
import { useViewport } from './useViewport'

const PANEL_MS = 520
/** Gap between each row's dissolve-in, so the manual reads in like the intro chrome. */
const ROW_STAGGER_MS = 70
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Ignore dismiss for a beat after open so the opening click cannot close it. */
const DISMISS_GUARD_MS = 500

const chromeText: CSSProperties = {
  font: '400 0.6875rem/1.6 var(--mono)',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.92)',
  textShadow: '0 0 10px #000',
}

/**
 * Tracking is added after the last glyph, so a centred line sits a little left.
 * Pad the left by the same amount — same fix as the intro name.
 */
const opticalCenter: CSSProperties = {
  paddingLeft: '0.14em',
}

const keyBadge: CSSProperties = {
  display: 'inline-block',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  borderRadius: '2px',
  padding: '0.1rem 0.35rem',
  margin: '0 0.15rem',
  lineHeight: 1.2,
}

const rule: CSSProperties = {
  width: '100%',
  height: 1,
  border: 'none',
  background:
    'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent)',
}

function rowIn(index: number): CSSProperties {
  return {
    animation: `nav-help-in ${PANEL_MS}ms ${EASE} ${index * ROW_STAGGER_MS}ms both`,
  }
}

/**
 * Navigation manual for the galaxy. Opened only from the `?` control.
 *
 * Styled as floating chrome rather than a card: mono uppercase over a dark
 * veil, matching the intro and galaxy text instead of a boxed dialog.
 */
export function NavHelp() {
  const { siteSettings } = useContent()
  const { coarse } = useViewport()
  const phase = useStore((s) => s.phase)
  const open = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
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
    setHelpOpen(false)
  }

  useEffect(() => {
    if (!open) return
    openedAt.current = performance.now()
    panelRef.current?.focus()
  }, [open])

  if (phase !== 'galaxy' || !open) return null

  const back: ReactNode = coarse ? (
    <>
      Tap <span style={keyBadge}>← back</span> or empty space to go back
    </>
  ) : (
    <>
      Press <span style={keyBadge}>esc</span> or click empty space to go back
    </>
  )
  const steps: ReactNode[] = [...lines, back]

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
        // Darkest behind the text, so it reads without needing a boxed card.
        background:
          'radial-gradient(ellipse 60% 45% at center, rgba(0, 0, 0, 0.94), rgba(0, 0, 0, 0.7))',
        animation: `nav-help-veil ${PANEL_MS}ms ${EASE} both`,
      }}
    >
      <button
        type="button"
        onClick={dismiss}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Close help"
        style={{
          ...chromeText,
          position: 'fixed',
          top: 'max(1rem, env(safe-area-inset-top))',
          right: 'max(1rem, env(safe-area-inset-right))',
          padding: '0.4rem 0.5rem',
          background: 'none',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.7)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        close ×
      </button>

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation help"
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          outline: 'none',
        }}
      >
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem',
          }}
        >
          {steps.map((step, i) => (
            <li
              key={i}
              style={{
                ...chromeText,
                ...opticalCenter,
                ...rowIn(i),
                textAlign: 'center',
              }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>{' '}
              {step}
            </li>
          ))}
        </ol>

        {/* Hung below the centred steps so the hint does not pull them off centre. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <hr
            style={{
              ...rule,
              ...rowIn(steps.length),
              width: 'min(16rem, 70%)',
              marginTop: '1.1rem',
            }}
          />

          <p
            style={{
              ...chromeText,
              ...opticalCenter,
              ...rowIn(steps.length + 1),
              marginTop: '1.1rem',
              font: '400 0.5625rem/1.4 var(--mono)',
              color: 'rgba(255, 255, 255, 0.45)',
              textAlign: 'center',
            }}
          >
            {coarse ? 'Tap' : 'Click'} anywhere to close · reopen with ?
          </p>
        </div>
      </aside>
    </div>
  )
}
