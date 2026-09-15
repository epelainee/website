import { create } from 'zustand'
import type { CategoryId } from '../data/categories'

export type Phase = 'intro' | 'crushing' | 'galaxy'

/** Crush duration in seconds. Shared by the store's timer and the scene's easing. */
export const CRUSH_DURATION = 1.2

/**
 * `path` is the navigation cursor into the category tree:
 *   []              → root, all experiences, ring shows the 7 categories
 *   [catId]         → a category, its experiences, ring shows its subcategories
 *   [catId, subId]  → a subcategory, its experiences narrowed further
 *
 * `ringOpen` is whether the choice buttons are showing. The central star opens
 * and closes it; entering a subcategory also closes it so the filtered field
 * stays visible. Re-click the star to bring the buttons back.
 *
 * `exportOpen` is the private print-list overlay (secret shortcut). Cleared when
 * leaving the galaxy.
 */
type State = {
  phase: Phase
  hoveredId: string | null
  selectedId: string | null
  path: string[]
  ringOpen: boolean
  /** Galaxy field search — empty string = no text filter. */
  searchQuery: string
  /** Whether the search field is expanded (query can still filter when closed). */
  searchOpen: boolean
  /** Private export checklist overlay. */
  exportOpen: boolean
  /** Experience ids checked for print. */
  exportSelectedIds: string[]

  crush: () => void
  setHovered: (id: string | null) => void
  select: (id: string | null) => void
  toggleRing: () => void
  setSearchQuery: (q: string) => void
  setSearchOpen: (open: boolean) => void
  setExportOpen: (open: boolean) => void
  toggleExportId: (id: string) => void
  setExportSelectedIds: (ids: string[]) => void

  enterCategory: (id: CategoryId) => void
  enterSub: (id: string) => void
  back: () => void
}

// Moving levels drops any open panel — the node it showed may not exist at the
// new level. Entering a category keeps the ring open so you can pick a
// subcategory next; entering a subcategory closes it for visibility.
const afterChoice = { selectedId: null as string | null }

const leaveGalaxy = {
  phase: 'intro' as Phase,
  ringOpen: false,
  hoveredId: null as string | null,
  selectedId: null as string | null,
  searchQuery: '',
  searchOpen: false,
  exportOpen: false,
  exportSelectedIds: [] as string[],
}

export const useStore = create<State>((set, get) => ({
  phase: 'intro',
  hoveredId: null,
  selectedId: null,
  path: [],
  // Closed on arrival — the categories only appear once the star is clicked.
  ringOpen: false,
  searchQuery: '',
  searchOpen: false,
  exportOpen: false,
  exportSelectedIds: [],

  /**
   * Intro -> crushing -> galaxy. Re-entry is guarded rather than queued; the
   * way back out is `back()` at root, which reverses the burst.
   */
  crush: () => {
    if (get().phase !== 'intro') return
    set({ phase: 'crushing' })
    setTimeout(() => set({ phase: 'galaxy' }), CRUSH_DURATION * 1000)
  },

  setHovered: (id) => set({ hoveredId: id }),
  // Ignore pick races after Esc has already collapsed the field — a late click
  // must not reopen a panel over the intro star.
  select: (id) => {
    if (id !== null && get().phase !== 'galaxy') return
    set({ selectedId: id })
  },
  toggleRing: () => set((s) => ({ ringOpen: !s.ringOpen })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setExportOpen: (open) => set({ exportOpen: open }),
  toggleExportId: (id) =>
    set((s) => {
      const has = s.exportSelectedIds.includes(id)
      return {
        exportSelectedIds: has
          ? s.exportSelectedIds.filter((x) => x !== id)
          : [...s.exportSelectedIds, id],
      }
    }),
  setExportSelectedIds: (ids) => set({ exportSelectedIds: ids }),

  enterCategory: (id) => set({ path: [id], ...afterChoice }),

  // Drill into a subcategory and hide the ring so the filtered field is clear.
  // Re-selecting the active subcategory steps back to the whole category and
  // keeps the ring open. `back()` is the keyboard equivalent for stepping out.
  enterSub: (id) =>
    set((s) => {
      const cat = s.path[0]
      if (!cat) return s
      if (s.path[1] === id) {
        return { path: [cat], ...afterChoice }
      }
      return { path: [cat, id], ringOpen: false, ...afterChoice }
    }),

  /**
   * The keyboard "back": one press undoes the last spatial step, layered —
   * export list → panel → search clears → search UI → path pop → intro star.
   */
  back: () =>
    set((s) => {
      if (s.exportOpen) return { exportOpen: false }
      if (s.selectedId !== null) return { selectedId: null, hoveredId: null }
      if (s.searchQuery.trim()) return { searchQuery: '', hoveredId: null }
      if (s.searchOpen) return { searchOpen: false, hoveredId: null }
      if (s.path.length > 0)
        return { path: s.path.slice(0, -1), hoveredId: null, ...afterChoice }
      // Leaving the galaxy entirely, so the ring goes too. Mid-crush presses
      // fall through to a no-op rather than fighting the animation. Clear hover
      // + selection: raycast is off once phase leaves galaxy, so pointerOut
      // never fires and a sticky hoveredId would keep the star label alive.
      if (s.phase === 'galaxy') return leaveGalaxy
      return s
    }),
}))
