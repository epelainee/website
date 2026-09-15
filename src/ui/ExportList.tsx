import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  compareExperiencesByRecency,
  experienceMatchesPath,
  experienceMatchesSearch,
} from '../data/experiences'
import { useContent } from '../content/useContent'
import { useStore } from '../state/store'
import { BlurbText } from './BlurbText'

/** Tab-scoped unlock flag — obscurity only, not real auth. */
const UNLOCK_KEY = 'export-list-unlocked'
const SITE_URL = 'https://epelainee.com/'

const PANEL_MS = 280
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const monoBtn: CSSProperties = {
  margin: 0,
  padding: '0.4rem 0.75rem',
  background: 'rgba(0, 0, 0, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.35)',
  borderRadius: '999px',
  color: 'rgba(255, 255, 255, 0.95)',
  font: '400 0.625rem/1 var(--mono)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  textShadow: '0 0 8px #000',
  cursor: 'pointer',
  WebkitTapHighlightColor: 'transparent',
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function markUnlocked() {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1')
  } catch {
    /* private mode */
  }
}

/**
 * Private experience checklist → browser Print / Save as PDF.
 *
 * Opens with Ctrl+Shift+L in the galaxy (no public chrome). Esc / Back closes
 * via the store ladder. Print document is screen-hidden; @media print shows it.
 */
export function ExportList() {
  const { experiences, categories, siteSettings } = useContent()
  const phase = useStore((s) => s.phase)
  const path = useStore((s) => s.path)
  const searchQuery = useStore((s) => s.searchQuery)
  const exportOpen = useStore((s) => s.exportOpen)
  const selectedIds = useStore((s) => s.exportSelectedIds)
  const setExportOpen = useStore((s) => s.setExportOpen)
  const toggleExportId = useStore((s) => s.toggleExportId)
  const setExportSelectedIds = useStore((s) => s.setExportSelectedIds)
  const back = useStore((s) => s.back)

  const wantOpen = exportOpen && phase === 'galaxy'
  const [mounted, setMounted] = useState(wantOpen)
  const [visible, setVisible] = useState(wantOpen)

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  const selectedExps = useMemo(
    () =>
      experiences
        .filter((e) => selectedSet.has(e.id))
        .sort(compareExperiencesByRecency),
    [experiences, selectedSet],
  )

  useEffect(() => {
    if (phase !== 'galaxy') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'L' && e.key !== 'l') return
      if (!e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      )
        return
      e.preventDefault()
      markUnlocked()
      setExportOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, setExportOpen])

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
  }, [wantOpen])

  const selectVisible = () => {
    const ids = experiences
      .filter(
        (e) =>
          experienceMatchesPath(e, path, categories) &&
          experienceMatchesSearch(e, searchQuery, categories),
      )
      .map((e) => e.id)
    setExportSelectedIds(ids)
  }

  const selectAll = () => setExportSelectedIds(experiences.map((e) => e.id))
  const clearAll = () => setExportSelectedIds([])

  const canPrint = selectedExps.length > 0
  const printedAt = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [wantOpen],
  )

  const reduced = prefersReducedMotion()

  return (
    <>
      {mounted ? (
        <div
          className="export-list-screen app-no-print"
          role="dialog"
          aria-modal="true"
          aria-hidden={!visible}
          aria-label="Export experience list"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(0, 0, 0, 0.92)',
            color: 'rgba(255, 255, 255, 0.92)',
            padding:
              'max(1.25rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right)) max(1.25rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left))',
            opacity: visible ? 1 : 0,
            transform: visible ? 'none' : 'scale(0.985)',
            pointerEvents: visible ? 'auto' : 'none',
            transition: reduced
              ? undefined
              : [
                  `opacity ${PANEL_MS}ms ${EASE}`,
                  `transform ${PANEL_MS}ms ${EASE}`,
                ].join(', '),
          }}
        >
          <header
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.65rem',
              marginBottom: '1rem',
              flexShrink: 0,
            }}
          >
            <h2
              style={{
                margin: 0,
                marginRight: 'auto',
                font: '400 0.75rem/1 var(--mono)',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Export list · {selectedIds.length} selected
            </h2>
            <button type="button" style={monoBtn} onClick={selectVisible}>
              Select visible
            </button>
            <button type="button" style={monoBtn} onClick={selectAll}>
              Select all
            </button>
            <button type="button" style={monoBtn} onClick={clearAll}>
              Clear
            </button>
            <button
              type="button"
              style={{
                ...monoBtn,
                opacity: canPrint ? 1 : 0.4,
                cursor: canPrint ? 'pointer' : 'not-allowed',
              }}
              disabled={!canPrint}
              onClick={() => window.print()}
            >
              Print / Save PDF
            </button>
            <button type="button" style={monoBtn} onClick={() => back()}>
              Close
            </button>
          </header>

          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              overflow: 'auto',
              flex: 1,
              minHeight: 0,
            }}
          >
            {experiences.map((exp) => {
              const checked = selectedSet.has(exp.id)
              return (
                <li key={exp.id}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '0.75rem',
                      padding: '0.65rem 0.15rem',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExportId(exp.id)}
                      style={{
                        width: '0.9rem',
                        height: '0.9rem',
                        flexShrink: 0,
                        accentColor: '#fff',
                        cursor: 'pointer',
                      }}
                    />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          font: '400 0.8125rem/1.3 var(--sans)',
                        }}
                      >
                        {exp.title}
                      </span>
                      {exp.org ? (
                        <span
                          style={{
                            display: 'block',
                            marginTop: '0.15rem',
                            font: '400 0.6875rem/1.3 var(--mono)',
                            letterSpacing: '0.04em',
                            color: 'rgba(255, 255, 255, 0.55)',
                          }}
                        >
                          {exp.org}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="export-list-print" aria-hidden={!canPrint}>
        <header className="export-print-header">
          <h1>{siteSettings.displayName}</h1>
          <p>
            <span>
              {selectedExps.length}{' '}
              {selectedExps.length === 1 ? 'entry' : 'entries'}
            </span>
            {selectedExps.length > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span>{printedAt}</span>
                <span aria-hidden="true"> · </span>
                <a href={SITE_URL}>{SITE_URL}</a>
              </>
            ) : null}
          </p>
        </header>
        {selectedExps.map((exp) => {
          const org = exp.org.trim()
          const dates = exp.dates.trim()
          const location = exp.location.trim()
          const blurb = exp.blurb.trim()
          return (
            <article key={exp.id} className="export-print-entry">
              <div className="export-print-grid">
                <h2>{exp.title}</h2>
                <p className="export-print-aside">{dates || '\u00a0'}</p>
                {org || location ? (
                  <>
                    <p className="export-print-meta">{org || '\u00a0'}</p>
                    <p className="export-print-aside">
                      {location || '\u00a0'}
                    </p>
                  </>
                ) : null}
              </div>
              {blurb ? (
                <div className="export-print-blurb">
                  <BlurbText text={blurb} />
                </div>
              ) : null}
              {exp.links?.length ? (
                <ul className="export-print-links">
                  {exp.links.map((l) => (
                    <li key={l.url}>
                      {l.label}: {l.url}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          )
        })}
      </div>
    </>
  )
}
