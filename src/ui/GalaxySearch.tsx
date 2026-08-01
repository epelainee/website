import { useEffect, useRef, type CSSProperties, type FormEvent } from 'react'
import { useStore } from '../state/store'
import { useViewport } from './useViewport'

/**
 * Hidden galaxy search. Desktop: press `/` to open. Mobile: long-press the
 * entry count (see LocalClock). No chrome when closed.
 *
 * Takes the center slot while open (entry count hides for that time).
 * Desktop keeps time + date on the sides; compact uses side insets so the
 * field doesn’t collide with the clock.
 */
export function GalaxySearch() {
  const phase = useStore((s) => s.phase)
  const query = useStore((s) => s.searchQuery)
  const open = useStore((s) => s.searchOpen)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const setSearchOpen = useStore((s) => s.setSearchOpen)
  const { compact } = useViewport()
  const inputRef = useRef<HTMLInputElement>(null)

  const field: CSSProperties = {
    boxSizing: 'border-box',
    width: compact
      ? 'min(14rem, calc(100vw - 7.5rem))'
      : 'min(16rem, calc(100vw - 18rem))',
    margin: 0,
    padding: '0.35rem 0',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid rgba(255, 255, 255, 0.35)',
    borderRadius: 0,
    outline: 'none',
    font: '400 0.625rem/1 var(--mono)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.92)',
    textShadow: '0 0 8px #000',
    textAlign: 'center',
    caretColor: 'rgba(255, 255, 255, 0.85)',
  }

  useEffect(() => {
    if (phase !== 'galaxy') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      )
        return
      e.preventDefault()
      setSearchOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, setSearchOpen])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  if (phase !== 'galaxy' || !open) return null

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 21,
        left: '50%',
        top: 'max(1.15rem, env(safe-area-inset-top))',
        transform: 'translateX(-50%)',
        pointerEvents: 'auto',
      }}
    >
      <form
        role="search"
        aria-label="Search experiences"
        onSubmit={(e: FormEvent) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.stopPropagation()
            if (query.trim()) {
              setSearchQuery('')
              return
            }
            setSearchOpen(false)
            ;(e.target as HTMLInputElement).blur()
          }}
          onBlur={() => setSearchOpen(false)}
          placeholder="Search"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          style={field}
        />
      </form>
    </div>
  )
}
