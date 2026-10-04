/**
 * Live click impulse for the settled core star.
 *
 * Plain mutable ref rather than store state: HubHotspot writes on click, Core
 * decays every frame. Routing through React would re-render for no gain.
 *
 * `pulse` drives a scale bounce on open and close.
 * `flash` drives a brief brightness kick on open only.
 */
export const coreClick = { pulse: 0, flash: 0 }

/** Peak scale overshoot (fraction of reveal scale). */
export const PULSE_AMP = 0.22

/** Peak brightness bump on material color (open only). */
export const FLASH_AMP = 0.45

/** Seconds for pulse/flash to decay from 1 → 0. */
export const CLICK_DECAY = 0.3

/**
 * Landing beckon: a few slow swells once the galaxy first settles, hinting the
 * core is clickable. Smooth rather than the click's kick.
 */
export const BECKON_DELAY = 0.5
export const BECKON_PERIOD = 1.1
export const BECKON_COUNT = 2
export const BECKON_AMP = 0.2
export const BECKON_GLOW = 0.3
