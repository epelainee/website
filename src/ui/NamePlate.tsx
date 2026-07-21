import type { CSSProperties } from 'react'
import { CRUSH_DURATION, useStore } from '../state/store'
import { useContent } from '../content/useContent'
import { SocialIconRow } from './SocialLinks'
import { useViewport } from './useViewport'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Panel open/close dissolve — soft settle, not a hard cut. */
const PANEL_MS = 520
const DISSOLVE_BLUR = '12px'

const chrome: CSSProperties = {
  position: 'fixed',
  zIndex: 20,
  margin: 0,
  color: 'rgba(255, 255, 255, 0.92)',
  textShadow: '0 0 10px #000',
  pointerEvents: 'none',
}

const nameStyle: CSSProperties = {
  font: '400 0.8125rem/1 var(--mono)',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

/** Single-line name — nbsp so words never break apart. */
function solidName(name: string) {
  return name.replace(/ /g, '\u00a0')
}

/**
 * Identity chrome. Intro: top-left name + place, bottom-left tagline.
 * Galaxy: bottom-centre name. Dissolves with the burst / panel.
 */
export function NamePlate() {
  const { siteSettings } = useContent()
  const { compact } = useViewport()
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => s.selectedId !== null)
  const intro = phase === 'intro'
  const settled = phase === 'galaxy' || phase === 'crushing'
  const settledVisible = settled && !panelOpen
  const displayName = solidName(siteSettings.displayName)

  const introDissolve = {
    opacity: intro ? 1 : 0,
    filter: intro ? 'blur(0)' : `blur(${DISSOLVE_BLUR})`,
    transition: [
      `opacity ${CRUSH_DURATION}s ${EASE}`,
      `filter ${CRUSH_DURATION}s ${EASE}`,
    ].join(', '),
  }

  return (
    <>
      <div
        aria-hidden={phase !== 'intro'}
        style={{
          ...chrome,
          left: 'max(1.25rem, env(safe-area-inset-left))',
          top: 'max(1.25rem, env(safe-area-inset-top))',
          // Compact: full width — icons stack under identity, not beside it.
          // Wide: leave a gutter for the top-right icon row.
          right: compact
            ? 'max(1.25rem, env(safe-area-inset-right))'
            : 'max(5.5rem, env(safe-area-inset-right))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          ...introDissolve,
        }}
      >
        <p
          style={{
            ...nameStyle,
            margin: 0,
            whiteSpace: 'nowrap',
            font: compact
              ? '400 0.625rem/1 var(--mono)'
              : nameStyle.font,
            letterSpacing: compact ? '0.1em' : nameStyle.letterSpacing,
          }}
        >
          {displayName}
        </p>
        <p
          style={{
            margin: 0,
            font: '400 0.625rem/1.35 var(--mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.78)',
            maxWidth: compact ? '100%' : '16rem',
            whiteSpace: 'normal',
          }}
        >
          {siteSettings.locationLine}
        </p>
        {compact && (
          <nav
            aria-label="Social links"
            aria-hidden={phase !== 'intro'}
            style={{
              display: 'flex',
              marginTop: '0.15rem',
              pointerEvents: intro ? 'auto' : 'none',
            }}
          >
            <SocialIconRow gap="0.65rem" />
          </nav>
        )}
      </div>

      <p
        aria-hidden={phase !== 'intro'}
        style={{
          ...chrome,
          left: 'max(1.25rem, env(safe-area-inset-left))',
          right: 'max(1.25rem, env(safe-area-inset-right))',
          // Compact + wide: tagline sits on the bottom band (cue stacks above on compact).
          bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          font: '400 0.6875rem/1.45 var(--mono)',
          letterSpacing: '0.06em',
          maxWidth: compact
            ? 'min(22rem, calc(100vw - 2.5rem))'
            : 'min(22rem, calc(100vw - 12rem))',
          whiteSpace: 'normal',
          ...introDissolve,
        }}
      >
        {siteSettings.tagline}
      </p>

      <div
        aria-hidden={!settledVisible}
        style={{
          ...chrome,
          // Compact galaxy: name left, no socials. Wide: centred bottom.
          ...(compact
            ? {
                left: 'max(1.25rem, env(safe-area-inset-left))',
                right: 'max(5.5rem, env(safe-area-inset-right))',
                bottom:
                  'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.25rem))',
                transform: settledVisible
                  ? 'translateY(0)'
                  : 'translateY(8px)',
                alignItems: 'flex-start' as const,
                textAlign: 'left' as const,
              }
            : {
                left: '50%',
                bottom:
                  'max(1.75rem, calc(env(safe-area-inset-bottom) + 1.25rem))',
                transform: settledVisible
                  ? 'translateX(-50%) translateY(0)'
                  : 'translateX(-50%) translateY(8px)',
                alignItems: 'center' as const,
                textAlign: 'center' as const,
              }),
          display: 'flex',
          flexDirection: 'column',
          maxWidth: compact ? 'min(70vw, 18rem)' : 'min(72vw, 20rem)',
          padding: compact ? 0 : '0 0.75rem',
          opacity: settledVisible ? 1 : 0,
          filter: settledVisible ? 'blur(0)' : `blur(${DISSOLVE_BLUR})`,
          transition: [
            `opacity ${PANEL_MS}ms ${EASE}`,
            `filter ${PANEL_MS}ms ${EASE}`,
            `transform ${PANEL_MS}ms ${EASE}`,
          ].join(', '),
        }}
      >
        <p
          style={{
            ...nameStyle,
            margin: 0,
            font: compact
              ? '400 0.6875rem/1 var(--mono)'
              : '400 1rem/1.15 var(--mono)',
            letterSpacing: compact ? '0.1em' : '0.18em',
            whiteSpace: 'nowrap',
          }}
        >
          {displayName}
        </p>
      </div>
    </>
  )
}
