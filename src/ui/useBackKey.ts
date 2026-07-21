import { useEffect } from 'react'
import { useStore } from '../state/store'

/**
 * Wires Esc and Backspace to the store's layered `back()`:
 * panel → subcategory → category → root → re-collapse to the intro star.
 *
 * Lives on `window` so it works regardless of focus, but stands down when the
 * target is editable. Backspace is prevented as a defence against browsers
 * that still treat it as history-back. Blurs focus so Esc never leaves a
 * focus ring on the circular hub hotspot.
 */
export function useBackKey() {
  const back = useStore((s) => s.back)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Backspace') return

      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      )
        return

      if (e.key === 'Backspace') e.preventDefault()
      const active = document.activeElement
      if (active instanceof HTMLElement) active.blur()
      back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [back])
}
