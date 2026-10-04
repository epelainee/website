import { useState, type CSSProperties } from 'react'
import { CRUSH_DURATION, useStore } from '../state/store'
import { useContent } from '../content/useContent'
import {
  INTRO_STAR_CENTER_CSS,
  INTRO_STAR_HALF_HEIGHT_CSS,
} from '../scene/CameraRig'
import { SocialIconRow } from './SocialLinks'
import { useViewport } from './useViewport'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Panel open/close dissolve — soft settle, not a hard cut. */
const PANEL_MS = 520
const DISSOLVE_BLUR = '12px'
/** Intro text hugs the star: this far past its bottom spike tip. */
const STAR_EDGE = `calc(${INTRO_STAR_CENTER_CSS} + ${INTRO_STAR_HALF_HEIGHT_CSS} + 1rem)`

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
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

/** Single-line name — nbsp so words never break apart. */
function solidName(name: string) {
  return name.replace(/ /g, '\u00a0')
}

/** How far a letter rises when the pointer is on it, or on a neighbour. */
function letterLift(distance: number) {
  if (distance === 0) return '-0.48em'
  if (distance === 1) return '-0.16em'
  return '0'
}

/**
 * Intro name, one span per letter, so a hover lifts that letter and nudges
 * the ones beside it. Tracking stays on the line so the word stays centred.
 */
function GreetingName({
  name,
  active,
  compact,
}: {
  name: string
  active: boolean
  compact: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const letters = Array.from(solidName(name))

  return (
    <p
      aria-label={name}
      style={{
        ...nameStyle,
        margin: 0,
        font: compact
          ? '400 0.9375rem/1.15 var(--mono)'
          : '400 1.0625rem/1.15 var(--mono)',
        letterSpacing: '0.18em',
        // Tracking trails the last letter; pad the left so it stays centred.
        paddingLeft: '0.18em',
        pointerEvents: active ? 'auto' : 'none',
      }}
      onMouseLeave={() => setHover(null)}
    >
      {letters.map((ch, i) => {
        const distance = hover === null ? 3 : Math.abs(hover - i)
        const hovered = distance === 0
        return (
          <span
            key={i}
            className="greeting-letter"
            aria-hidden="true"
            onMouseEnter={() => setHover(i)}
            style={{
              transform: `translateY(${letterLift(distance)})`,
              color: hovered
                ? '#fff'
                : distance === 1
                  ? 'rgba(255, 255, 255, 0.98)'
                  : undefined,
              textShadow: hovered
                ? '0 0 10px #000, 0 0 14px rgba(255, 255, 255, 0.55)'
                : undefined,
            }}
          >
            {ch}
          </span>
        )
      })}
    </p>
  )
}

/**
 * Identity chrome. Intro: greeting + name, optional place, tagline, socials and
 * a delayed "click the star" hint centred below the star.
 * Galaxy: bottom-centre name. Dissolves with the burst / panel.
 */
export function NamePlate() {
  const { siteSettings } = useContent()
  const { compact, coarse } = useViewport()
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => s.selectedId !== null)
  const intro = phase === 'intro'
  const settled = phase === 'galaxy' || phase === 'crushing'
  const settledVisible = settled && !panelOpen
  const displayName = solidName(siteSettings.displayName)
  const introHint = coarse
    ? siteSettings.hubTips.introHintTouch
    : siteSettings.hubTips.introHint

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
          right: 'max(1.25rem, env(safe-area-inset-right))',
          top: STAR_EDGE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '0.6rem',
          ...introDissolve,
        }}
      >
        {/* Same hierarchy as the galaxy page: one spaced headline, the rest small and dim. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '0.6rem',
            marginBottom: '0.3rem',
          }}
        >
          {siteSettings.greeting && (
            <p
              style={{
                margin: 0,
                font: '400 0.6875rem/1 var(--mono)',
                letterSpacing: '0.1em',
                color: 'rgba(255, 255, 255, 0.6)',
                whiteSpace: 'nowrap',
              }}
            >
              {siteSettings.greeting}
            </p>
          )}
          <GreetingName
            name={siteSettings.greetingName}
            active={intro}
            compact={compact}
          />
        </div>
        {siteSettings.locationLine?.trim() && (
          <p
            style={{
              margin: 0,
              font: '400 0.625rem/1.2 var(--mono)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.6)',
              maxWidth: compact ? '100%' : '18rem',
            }}
          >
            {siteSettings.locationLine}
          </p>
        )}
        <p
          style={{
            margin: 0,
            font: compact
              ? '400 0.6875rem/1.6 var(--mono)'
              : '400 0.75rem/1.6 var(--mono)',
            letterSpacing: '0.06em',
            color: 'rgba(255, 255, 255, 0.75)',
            maxWidth: 'min(24rem, 100%)',
            whiteSpace: 'pre-line',
          }}
        >
          {siteSettings.tagline}
        </p>
        <nav
          aria-label="Social links"
          aria-hidden={phase !== 'intro'}
          style={{
            display: 'flex',
            marginTop: '0.2rem',
            pointerEvents: intro ? 'auto' : 'none',
          }}
        >
          <SocialIconRow gap={compact ? '0.65rem' : '0.85rem'} />
        </nav>
        {introHint && (
          <p
            className="intro-hint"
            style={{
              margin: '0.5rem 0 0',
              font: '400 0.625rem/1 var(--mono)',
              letterSpacing: '0.14em',
              color: 'rgba(255, 255, 255, 0.5)',
              whiteSpace: 'nowrap',
            }}
          >
            {introHint}
          </p>
        )}
      </div>

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
                  'max(1rem, env(safe-area-inset-bottom))',
                transform: settledVisible
                  ? 'translateY(0)'
                  : 'translateY(8px)',
                alignItems: 'flex-start' as const,
                textAlign: 'left' as const,
              }
            : {
                left: '50%',
                bottom:
                  'max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
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
        <p
          style={{
            margin: compact ? '0.35rem 0 0' : '0.4rem 0 0',
            font: '400 0.5625rem/1 var(--mono)',
            letterSpacing: '0.06em',
            color: 'rgba(255, 255, 255, 0.55)',
            whiteSpace: 'nowrap',
          }}
        >
          ©️ 2026 Elizabeth Patricia Elaine
        </p>
      </div>
    </>
  )
}
