import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from 'react'
import { categoryById, subcategoryToCategory } from '../data/categories'
import type { CategoryId } from '../data/categories'
import { useContent } from '../content/useContent'
import { useStore } from '../state/store'
import { useViewport } from './useViewport'

/**
 * The ring of category / subcategory choices around the central hub.
 *
 * Shows exactly one level: categories at root, then the entered category's
 * subcategories. Esc / Backspace steps back via `back()`.
 *
 * The central star opens and closes it (`ringOpen`). Selections deliberately do
 * not close it, so drilling category -> subcategory is one continuous motion
 * rather than a trip back to the centre for every step.
 *
 * Compact (mobile): vertical column through the hub with a clear gap for the
 * star — not a ring — so labels stay readable and never cover the core.
 *
 * DOM rather than 3D: it never passes through the halftone, so the labels stay
 * crisp, and it keeps the one interactive 3D object — the central star — clean.
 * The container ignores the pointer; only the buttons catch it, so hovering the
 * galaxy between buttons still works.
 */
const RING = 'clamp(7.5rem, 26vmin, 12rem)'
/** Clear band for the galaxy core hotspot (~4.5rem) plus a little air. */
const STAR_CLEAR = '5.75rem'
const PANEL_MS = 520
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const STAGGER_MS = 28

type Item = { id: string; label: string; count: number; active: boolean }

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function NavRing() {
  const { categories, experiences } = useContent()
  const { compact } = useViewport()
  const phase = useStore((s) => s.phase)
  const ringOpen = useStore((s) => s.ringOpen)
  const path = useStore((s) => s.path)
  const enterCategory = useStore((s) => s.enterCategory)
  const enterSub = useStore((s) => s.enterSub)

  const { categoryCounts, subCounts } = useMemo(() => {
    const bySub = subcategoryToCategory(categories)
    const categoryCounts = new Map<CategoryId, number>()
    const subCounts = new Map<string, number>()
    for (const e of experiences) {
      const catsSeen = new Set<CategoryId>()
      for (const sub of e.subcategories) {
        subCounts.set(sub, (subCounts.get(sub) ?? 0) + 1)
        const cat = bySub.get(sub)
        if (cat) catsSeen.add(cat)
      }
      for (const cat of catsSeen) {
        categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
      }
    }
    return { categoryCounts, subCounts }
  }, [categories, experiences])

  const wantOpen = phase === 'galaxy' && ringOpen
  const [mounted, setMounted] = useState(wantOpen)
  const [visible, setVisible] = useState(wantOpen)
  // Remount buttons when the filter level changes so they restagger in.
  const levelKey = path.length === 0 ? 'root' : path.join('/')

  // Drop to dematerialised before paint when the filter level swaps, so new
  // buttons don't flash in at full opacity for a frame.
  useLayoutEffect(() => {
    if (!wantOpen || prefersReducedMotion()) return
    setVisible(false)
  }, [levelKey, wantOpen])

  useEffect(() => {
    if (wantOpen) {
      setMounted(true)
      if (prefersReducedMotion()) {
        setVisible(true)
        return
      }
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }

    setVisible(false)
    if (prefersReducedMotion()) {
      setMounted(false)
      return
    }
    const t = window.setTimeout(() => setMounted(false), PANEL_MS)
    return () => window.clearTimeout(t)
  }, [wantOpen, levelKey])

  if (!mounted) return null

  // The level currently shown: categories at root, else the category's subs.
  let items: Item[]
  let onPick: (item: Item) => void
  if (path.length === 0) {
    items = categories.map((c) => ({
      id: c.id,
      label: c.label,
      count: categoryCounts.get(c.id) ?? 0,
      active: false,
    }))
    onPick = (item) => enterCategory(item.id)
  } else {
    const cat = categoryById(categories, path[0] as CategoryId)
    items = (cat?.subs ?? []).map((s) => ({
      id: s.id,
      label: s.label,
      count: subCounts.get(s.id) ?? 0,
      active: path[1] === s.id,
    }))
    onPick = (item) => enterSub(item.id)
  }

  const reduced = prefersReducedMotion()

  const buttonStyle = (item: Item): CSSProperties => ({
    background: item.active ? 'var(--fg)' : 'rgba(0,0,0,0.55)',
    color: item.active ? '#000' : 'var(--fg)',
    border: `1px solid ${
      item.active ? 'var(--fg)' : 'rgba(255,255,255,0.35)'
    }`,
    borderRadius: '999px',
    padding: '0.4rem 0.85rem',
    font: '400 0.6875rem/1 var(--mono)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    backdropFilter: 'blur(3px)',
    textShadow: item.active ? 'none' : '0 0 8px #000',
    transition: reduced
      ? undefined
      : [
          `background 220ms ${EASE}`,
          `color 220ms ${EASE}`,
          `border-color 220ms ${EASE}`,
          `transform 180ms ${EASE}`,
        ].join(', '),
  })

  const renderBtn = (item: Item) => (
    <button
      type="button"
      onClick={() => onPick(item)}
      aria-pressed={item.active}
      className="nav-ring-btn"
      style={buttonStyle(item)}
    >
      {item.label} ({item.count})
    </button>
  )

  // Mobile: top→bottom column with a mid spacer so the core star stays free.
  if (compact) {
    const split = Math.ceil(items.length / 2)
    const above = items.slice(0, split)
    const below = items.slice(split)

    const stackItem = (item: Item, i: number) => {
      const delay = reduced ? 0 : i * STAGGER_MS
      return (
        <div
          key={`${levelKey}-${item.id}`}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.88)',
            pointerEvents: visible ? 'auto' : 'none',
            transition: reduced
              ? undefined
              : [
                  `opacity ${PANEL_MS}ms ${EASE} ${delay}ms`,
                  `transform ${PANEL_MS}ms ${EASE} ${delay}ms`,
                ].join(', '),
          }}
        >
          {renderBtn(item)}
        </div>
      )
    }

    return (
      <div
        id="nav-ring"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 25,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.45rem',
          padding: '0.75rem',
        }}
      >
        {above.map((item, i) => stackItem(item, i))}
        <div
          aria-hidden
          style={{
            height: STAR_CLEAR,
            width: 1,
            flexShrink: 0,
          }}
        />
        {below.map((item, i) => stackItem(item, split + i))}
      </div>
    )
  }

  return (
    <div
      id="nav-ring"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 25,
        pointerEvents: 'none',
      }}
    >
      {items.map((item, i) => {
        // Start at the top, go clockwise.
        const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2
        const delay = reduced ? 0 : i * STAGGER_MS
        return (
          <div
            key={`${levelKey}-${item.id}`}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: visible
                ? `translate(-50%, -50%) translate(calc(cos(${angle}rad) * ${RING}), calc(sin(${angle}rad) * ${RING})) scale(1)`
                : `translate(-50%, -50%) translate(calc(cos(${angle}rad) * ${RING}), calc(sin(${angle}rad) * ${RING})) scale(0.82)`,
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none',
              transition: reduced
                ? undefined
                : [
                    `opacity ${PANEL_MS}ms ${EASE} ${delay}ms`,
                    `transform ${PANEL_MS}ms ${EASE} ${delay}ms`,
                  ].join(', '),
            }}
          >
            {renderBtn(item)}
          </div>
        )
      })}
    </div>
  )
}
