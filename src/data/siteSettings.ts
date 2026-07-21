/**
 * Chrome / meta / placeholder types.
 * Data lives in `content/site-settings.json` (Pages CMS).
 */
export type SocialIcon = 'linkedin' | 'instagram' | 'email' | 'other'

export type SocialLink = {
  label: string
  url: string
  icon: SocialIcon
}

export type SiteSettings = {
  displayName: string
  locationLine: string
  tagline: string
  pageTitle: string
  pageDescription: string
  /** Absolute site origin for embed previews, e.g. https://example.com */
  siteUrl: string
  /** Public path or absolute URL for the favicon. */
  favicon: string
  /** Public path or absolute URL for Open Graph / Twitter card image. */
  ogImage: string
  socialLinks: SocialLink[]
  placeholders: {
    org: string
    dates: string
    location: string
    blurb: string
  }
  hubTips: {
    introAria: string
    filterByCategory: string
    hideFilters: string
  }
}
