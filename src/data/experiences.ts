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
