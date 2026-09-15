import type { CategoryId, MainCategory } from './categories'
import { subcategoryToCategory, subLabel } from './categories'

export type ExperienceKind = 'internship' | 'certification'

export type Experience = {
  id: string
  title: string
  org: string
  /** Galaxy ring — category of the first listed subcategory. */
  category: CategoryId
  /** One or more subcategory ids (e.g. 'crea-music'). */
  subcategories: string[]
  dates: string
  location: string
  blurb: string
  /** Omit → default sphere node. internship = 4-pt star, certification = 5-pt. */
  kind?: ExperienceKind
  links?: { label: string; url: string }[]
}

export const byId = (experiences: Experience[], id: string) =>
  experiences.find((e) => e.id === id)

/** True when an experience should be visible at the current nav path. */
export function experienceMatchesPath(
  exp: Experience,
  path: string[],
  categories: MainCategory[],
): boolean {
  return subcategoriesMatchPath(exp.subcategories, path, categories)
}

/** True when a node with these subcategories matches the current nav path. */
export function subcategoriesMatchPath(
  subcategories: string[],
  path: string[],
  categories: MainCategory[],
): boolean {
  if (path.length === 0) return true
  const bySub = subcategoryToCategory(categories)
  const cat = path[0]
  if (path.length === 1) {
    return subcategories.some((sub) => bySub.get(sub) === cat)
  }
  return subcategories.includes(path[1])
}

/** Case-insensitive match against title / org / location / blurb / dates / tags. */
export function experienceMatchesSearch(
  exp: Experience,
  query: string,
  categories: MainCategory[],
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    exp.title,
    exp.org,
    exp.location,
    exp.blurb,
    exp.dates,
    ...exp.subcategories.map((id) => subLabel(categories, id)),
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
}

/** YYYYMM sortable int. Present/ongoing → far future. Unparseable → 0. */
function parseDateToken(token: string): number {
  const t = token.trim().toLowerCase().replace(/^issued\s+/, '')
  if (!t) return 0
  if (t === 'present' || t === 'current' || t === 'now') return 999_912

  const monthYear = /^([a-z]+)\s+(\d{4})$/.exec(t)
  if (monthYear) {
    const month = MONTHS[monthYear[1]!] ?? 6
    return Number(monthYear[2]) * 100 + month
  }

  const yearOnly = /^(\d{4})$/.exec(t)
  if (yearOnly) {
    // Year-only ranges ("2023 – 2024") and singles ("2025") sort by year end.
    return Number(yearOnly[1]) * 100 + 12
  }

  return 0
}

/**
 * Sort key from a freeform dates string. Uses the range end (or the single
 * date); "Present" sorts newest. Returns { end, start } as YYYYMM ints.
 */
export function experienceDateSortKey(dates: string): {
  end: number
  start: number
} {
  const normalized = dates.replace(/[–—]/g, '-').trim()
  if (!normalized) return { end: 0, start: 0 }

  const parts = normalized
    .split(/\s*-\s*/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    return {
      start: parseDateToken(parts[0]!),
      end: parseDateToken(parts[1]!),
    }
  }

  const only = parseDateToken(parts[0] ?? '')
  return { start: only, end: only }
}

/** Newest end date first; tie-break by start, then title. */
export function compareExperiencesByRecency(
  a: Experience,
  b: Experience,
): number {
  const ka = experienceDateSortKey(a.dates)
  const kb = experienceDateSortKey(b.dates)
  if (ka.end !== kb.end) return kb.end - ka.end
  if (ka.start !== kb.start) return kb.start - ka.start
  return a.title.localeCompare(b.title)
}
