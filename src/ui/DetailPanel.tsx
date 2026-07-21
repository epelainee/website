import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { byId } from '../data/experiences'
import { useContent } from '../content/useContent'

/** Soft rise — opacity + transform only (filter blur transitions flake on Windows). */
const PANEL_MS = 520
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Detail for the selected experience.
 *
 * Floating bottom-left card (not edge-docked). Lives outside the Canvas:
 * real DOM, real text, selectable and reachable by a screen reader, and never
 * touched by the halftone pass.
 *
 * Format: position → company → dates → location → description.
 * Empty dates/location/blurb show placeholders so the layout is visible while data fills in.
 *
 * Escape closes it via `useBackKey` (layered back ladder).
 */
export function DetailPanel() {
  const { experiences, siteSettings } = useContent()
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const ph = siteSettings.placeholders

  // Keep last id while dematerialising so exit has content to dissolve.
  const [heldId, setHeldId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selectedId) {
      setHeldId(selectedId)
      if (prefersReducedMotion()) {
        setOpen(true)
        return
      }
      // Double rAF: closed styles must paint before open, or Windows skips the transition.
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOpen(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }

    setOpen(false)
    if (prefersReducedMotion()) {
      setHeldId(null)
      return
    }
    const t = window.setTimeout(() => setHeldId(null), PANEL_MS)
    return () => window.clearTimeout(t)
  }, [selectedId])

  const exp = heldId ? byId(experiences, heldId) : null
  if (!exp) return null

  const reduced = prefersReducedMotion()
  const dates = exp.dates.trim() || ph.dates
  const location = exp.location.trim() || ph.location
  const blurb = exp.blurb.trim() || ph.blurb
  const datesPlaceholder = !exp.dates.trim()
  const locationPlaceholder = !exp.location.trim()
  const blurbPlaceholder = !exp.blurb.trim()

  return (
    <aside
      aria-label={`${exp.title} detail`}
      aria-hidden={!open}
      style={{
        position: 'fixed',
        left: 'max(1rem, env(safe-area-inset-left))',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
        width: 'min(28rem, calc(100vw - 2rem))',
        maxHeight: 'min(50vh, calc(100dvh - 6rem))',
        overflowY: 'auto',
        padding: '1.5rem clamp(1.25rem, 3vw, 2rem)',
        paddingTop: '2.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(6px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '4px',
        zIndex: 40,
        opacity: open ? 1 : 0,
        transform: open
          ? 'translateY(0) scale(1)'
          : 'translateY(14px) scale(0.96)',
        transformOrigin: 'left bottom',
        pointerEvents: open ? 'auto' : 'none',
        transition: reduced
          ? undefined
          : [
              `opacity ${PANEL_MS}ms ${EASE}`,
              `transform ${PANEL_MS}ms ${EASE}`,
            ].join(', '),
      }}
    >
      <button
        type="button"
        onClick={() => select(null)}
        aria-label="Close detail"
        style={{
          position: 'absolute',
          top: '0.85rem',
          right: '0.85rem',
          background: 'none',
          border: 'none',
          color: 'var(--dim)',
          font: '400 1.5rem/1 var(--mono)',
          cursor: 'pointer',
          padding: '0.25rem 0.5rem',
          transition: `color 200ms ${EASE}, transform 180ms ${EASE}`,
        }}
      >
        ×
      </button>

      {/* position */}
      <h1 style={{ font: '500 1.5rem/1.2 var(--sans)', letterSpacing: '-0.02em' }}>
        {exp.title}
      </h1>

      {/* company */}
      <p style={{ font: '400 0.875rem/1.4 var(--mono)', color: 'var(--dim)' }}>
        {exp.org || ph.org}
      </p>

      {/* month year started – month year ended */}
      <p
        style={{
          font: '400 0.75rem/1.4 var(--mono)',
          color: datesPlaceholder ? 'rgba(255,255,255,0.35)' : 'var(--dim)',
          fontStyle: datesPlaceholder ? 'italic' : undefined,
        }}
      >
        {dates}
      </p>

      {/* location */}
      <p
        style={{
          font: '400 0.75rem/1.4 var(--mono)',
          color: locationPlaceholder ? 'rgba(255,255,255,0.35)' : 'var(--dim)',
          fontStyle: locationPlaceholder ? 'italic' : undefined,
        }}
      >
        {location}
      </p>

      {/* text description */}
      <p
        style={{
          font: '400 0.9375rem/1.55 var(--sans)',
          marginTop: '0.35rem',
          color: blurbPlaceholder ? 'rgba(255,255,255,0.4)' : 'var(--fg)',
          fontStyle: blurbPlaceholder ? 'italic' : undefined,
        }}
      >
        {blurb}
      </p>

      {exp.links?.length ? (
        <ul style={{ listStyle: 'none', marginTop: '0.25rem' }}>
          {exp.links.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--fg)', font: '400 0.8125rem/1.8 var(--mono)' }}
              >
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  )
}
