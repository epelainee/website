import type { CSSProperties, ReactNode } from 'react'
import { CRUSH_DURATION, useStore } from '../state/store'
import { useContent } from '../content/useContent'
import type { SocialIcon } from '../data/siteSettings'
import { useViewport } from './useViewport'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const PANEL_MS = 520
const DISSOLVE_BLUR = '12px'

const iconBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  color: 'rgba(255, 255, 255, 0.9)',
  textDecoration: 'none',
  pointerEvents: 'auto',
  transition: `color ${PANEL_MS}ms ${EASE}, transform 180ms ${EASE}`,
}

function Icon({
  label,
  href,
  children,
}: {
  label: string
  href: string
  children: ReactNode
}) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      aria-label={label}
      className="social-icon"
      {...(external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
      style={iconBtn}
    >
      {children}
    </a>
  )
}

function IconGlyph({ icon }: { icon: SocialIcon }) {
  if (icon === 'linkedin') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S.02 4.88.02 3.5 1.14 1 2.5 1s2.48 1.12 2.48 2.5zM.22 8.5h4.56V23H.22V8.5zM8.34 8.5h4.37v1.98h.06c.61-1.15 2.1-2.36 4.32-2.36 4.62 0 5.47 3.04 5.47 7V23h-4.56v-6.6c0-1.57-.03-3.6-2.19-3.6-2.2 0-2.53 1.71-2.53 3.48V23H8.34V8.5z" />
      </svg>
    )
  }
  if (icon === 'instagram') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  }
  if (icon === 'email') {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 7 9-7" />
      </svg>
    )
  }
  // Generic link glyph for "other"
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

/** Icon row — nest under identity on compact intro; also used by fixed chrome. */
export function SocialIconRow({ gap = '0.85rem' }: { gap?: string }) {
  const { siteSettings } = useContent()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>
      {siteSettings.socialLinks.map((link) => (
        <Icon key={`${link.label}-${link.url}`} label={link.label} href={link.url}>
          <IconGlyph icon={link.icon} />
        </Icon>
      ))}
    </span>
  )
}

/**
 * Intro: top-right icon row (wide) or under identity (compact).
 * Galaxy: bottom-left icons on wide only — compact shows name alone.
 * Dissolves with burst / detail panel.
 */
export function SocialLinks() {
  const { compact } = useViewport()
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => s.selectedId !== null)
  const intro = phase === 'intro'
  const galaxyVisible =
    (phase === 'galaxy' || phase === 'crushing') && !panelOpen

  return (
    <>
      {/* Wide intro only — compact nests icons under NamePlate identity. */}
      {!compact && (
        <nav
          aria-label="Social links"
          aria-hidden={!intro}
          style={{
            position: 'fixed',
            right: 'max(1.5rem, env(safe-area-inset-right))',
            top: 'max(1.5rem, env(safe-area-inset-top))',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            pointerEvents: intro ? 'auto' : 'none',
            opacity: intro ? 1 : 0,
            filter: intro ? 'blur(0)' : `blur(${DISSOLVE_BLUR})`,
            transition: [
              `opacity ${CRUSH_DURATION}s ${EASE}`,
              `filter ${CRUSH_DURATION}s ${EASE}`,
            ].join(', '),
          }}
        >
          <SocialIconRow />
        </nav>
      )}

      {/* Wide galaxy only — compact keeps name alone (no icons). */}
      {!compact && (
        <nav
          aria-label="Social links"
          aria-hidden={!galaxyVisible}
          style={{
            position: 'fixed',
            left: 'max(1.5rem, env(safe-area-inset-left))',
            bottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            pointerEvents: galaxyVisible ? 'auto' : 'none',
            opacity: galaxyVisible ? 1 : 0,
            filter: galaxyVisible ? 'blur(0)' : `blur(${DISSOLVE_BLUR})`,
            transform: galaxyVisible ? 'translateY(0)' : 'translateY(6px)',
            transition: [
              `opacity ${PANEL_MS}ms ${EASE}`,
              `filter ${PANEL_MS}ms ${EASE}`,
              `transform ${PANEL_MS}ms ${EASE}`,
            ].join(', '),
          }}
        >
          <SocialIconRow />
        </nav>
      )}
    </>
  )
}
