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
  /** Small lead-in above the intro name, e.g. "hi, i'm". Empty hides it. */
  greeting: string
  /** Name above the intro star; falls back to `displayName`. */
  greetingName: string
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
    /** Visible cue under the intro text; empty hides it. */
    introHint: string
    /** Touch wording for `introHint`; falls back to it when empty. */
    introHintTouch: string
    filterByCategory: string
    hideFilters: string
  }
  navHelp: {
    title: string
    steps: string[]
    /** Touch-oriented copy; falls back to `steps` when absent. */
    stepsTouch?: string[]
  }
}
