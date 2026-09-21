/** Bump when first-open logic changes so a stale "seen" flag cannot block it. */
export const NAV_HELP_SEEN_KEY = 'epelainee-nav-help-seen-v3'

export function hasSeenNavHelp(): boolean {
  try {
    return localStorage.getItem(NAV_HELP_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markNavHelpSeen(): void {
  try {
    localStorage.setItem(NAV_HELP_SEEN_KEY, '1')
  } catch {
    /* ignore */
  }
}
