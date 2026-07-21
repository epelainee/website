import type { MainCategory, SubCategory } from './categories'
import type { Experience, ExperienceKind } from './experiences'
import type { SiteSettings, SocialIcon, SocialLink } from './siteSettings'

export type SiteContent = {
  categories: MainCategory[]
  experiences: Experience[]
  siteSettings: SiteSettings
}

type CatFile = { id: string; label: string; order?: number }
type SubFile = {
  id: string
  label: string
  order?: number
  category: string
}
type ExpFile = {
  id: string
  title: string
  org?: string
  subcategory: string
  dates?: string
  location?: string
  blurb?: string
  kind?: string
  order?: number
  links?: { label: string; url: string }[]
}

const catModules = import.meta.glob<CatFile>('../../content/categories/*.json', {
  eager: true,
  import: 'default',
})
const subModules = import.meta.glob<SubFile>(
  '../../content/subcategories/*.json',
  { eager: true, import: 'default' },
)
const expModules = import.meta.glob<ExpFile>(
  '../../content/experiences/*.json',
  { eager: true, import: 'default' },
)
const siteSettingsModule = import.meta.glob<SiteSettings>(
  '../../content/site-settings.json',
  { eager: true, import: 'default' },
)

const ICONS = new Set<SocialIcon>(['linkedin', 'instagram', 'email', 'other'])

function asIcon(v: string | undefined): SocialIcon {
  if (v && ICONS.has(v as SocialIcon)) return v as SocialIcon
  return 'other'
}

/** Pages CMS image fields usually store a public path string; tolerate objects too. */
function asMediaPath(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v.trim() || fallback
  if (v && typeof v === 'object') {
    const o = v as { path?: unknown; src?: unknown; url?: unknown }
    for (const key of [o.path, o.src, o.url] as const) {
      if (typeof key === 'string' && key.trim()) return key.trim()
    }
  }
  return fallback
}

function asKind(v: string | undefined): ExperienceKind | undefined {
  if (v === 'internship' || v === 'certification') return v
  return undefined
}

function loadSiteSettings(): SiteSettings {
  const first = Object.values(siteSettingsModule)[0]
  if (!first) {
    throw new Error('Missing content/site-settings.json')
  }
  const socialLinks: SocialLink[] = (first.socialLinks ?? []).map((l) => ({
    label: l.label,
    url: l.url,
    icon: asIcon(l.icon),
  }))
  return {
    ...first,
    siteUrl: first.siteUrl?.trim() ?? '',
    favicon: asMediaPath(first.favicon, '/favicon.svg'),
    ogImage: asMediaPath(first.ogImage),
    socialLinks,
  }
}

/** Build site content from JSON under `content/` (Pages CMS / git). */
export function loadSiteContent(): SiteContent {
  const cats = Object.values(catModules)
    .filter((c) => c?.id && c.label)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const subs = Object.values(subModules)
    .filter((s) => s?.id && s.label && s.category)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const subsByCat = new Map<string, SubCategory[]>()
  const categoryBySub = new Map<string, string>()
  for (const s of subs) {
    categoryBySub.set(s.id, s.category)
    const list = subsByCat.get(s.category) ?? []
    list.push({ id: s.id, label: s.label })
    subsByCat.set(s.category, list)
  }

  const categories: MainCategory[] = cats.map((c) => ({
    id: c.id,
    label: c.label,
    subs: subsByCat.get(c.id) ?? [],
  }))

  const experiences: Experience[] = Object.values(expModules)
    .filter((e) => e?.id && e.title && e.subcategory)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .flatMap((e) => {
      const category = categoryBySub.get(e.subcategory)
      if (!category) {
        console.warn(
          `[content] experience "${e.id}" subcategory "${e.subcategory}" has no category; skipped`,
        )
        return []
      }
      const kind = asKind(e.kind)
      const links = (e.links ?? []).filter((l) => l.label && l.url)
      const exp: Experience = {
        id: e.id,
        title: e.title,
        org: e.org ?? '',
        category,
        subcategory: e.subcategory,
        dates: e.dates ?? '',
        location: e.location ?? '',
        blurb: e.blurb ?? '',
      }
      if (kind) exp.kind = kind
      if (links.length) exp.links = links
      return [exp]
    })

  return {
    categories,
    experiences,
    siteSettings: loadSiteSettings(),
  }
}

/** Eager singleton — same object for the whole app. */
export const SITE_CONTENT = loadSiteContent()
