import {
  categoryOrder,
  type CategoryId,
  type MainCategory,
} from '../data/categories'
import type { Experience } from '../data/experiences'

/**
 * Deterministic layout maths for the galaxy. Kept free of three.js and of React
 * so the geometry can be reasoned about (and checked) on its own.
 *
 * Every value derives from a seeded hash of the experience id, so a node lands
 * in the same place on every load — the layout is stable without being regular.
 */

/** Cheap string hash -> [0,1). Stable across runs, unlike Math.random. */
export function hash01(str: string, salt = 0): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  // >>> 0 keeps it unsigned; / 2^32 normalises.
  return ((h >>> 0) % 100000) / 100000
}

/** Reach of the star's longest spike — the field in collapsed form. */
export const STAR_RADIUS = 2.5

/**
 * The eight spikes, as [angle from +X, reach as a fraction of STAR_RADIUS].
 * Vertical longest, horizontal a little shorter, diagonals short.
 */
export const SPIKE_LENGTHS: [number, number][] = [
  [Math.PI / 2, 1.0], // up
  [-Math.PI / 2, 1.0], // down
  [0, 0.78], // right
  [Math.PI, 0.78], // left
  [Math.PI / 4, 0.52],
  [(3 * Math.PI) / 4, 0.52],
  [(-3 * Math.PI) / 4, 0.52],
  [-Math.PI / 4, 0.52],
]

/** Half-width of a spike at its base, as a fraction of STAR_RADIUS. */
const SPIKE_WIDTH = 0.055

/** How sharply a spike narrows toward its tip. */
const TAPER = 1.5

/** Radius of the solid centre, as a fraction of STAR_RADIUS. */
const CORE_R = 0.1

/** Share of points spent on the solid centre. */
const CORE_SHARE = 0.16

/** Fraction of the way to a tip that stays fully solid. */
const CORE_FRAC = 0.18

/** How fast the stipple thins past that. Higher = emptier tips. */
const TIP_FALLOFF = 2.2

/** Half-width of a spike at position t along it (0 base, 1 tip). */
const spikeHalfWidth = (t: number) => SPIKE_WIDTH * Math.pow(1 - t, TAPER)

/** Fraction of STAR_RADIUS the widest horizontal spike reaches. */
export const STAR_HALF_WIDTH_FRAC = 0.78

/** Total spike length, for picking a spike in proportion to its size. */
const SPIKE_TOTAL = SPIKE_LENGTHS.reduce((sum, [, length]) => sum + length, 0)

/**
 * A point in the star, from a seeded hash.
 *
 * Each spike is built as a real tapered needle — a position along its axis plus
 * a perpendicular offset — rather than as an angular wedge. An angular profile
 * seems equivalent and is not: a fixed angle covers more width the further out
 * it goes, so the spikes fatten into blunt petals exactly where they should be
 * narrowing to a point.
 *
 * Along the axis, `t` is drawn so points land uniformly over the needle's area
 * (which narrows), then thinned past CORE_FRAC. That combination is what keeps
 * the base solid while the tips break into stipple.
 *
 * Returns a flat star in the XY plane, facing the camera.
 */
export function starPoint(
  seed: string,
  radius: number,
): [number, number, number] {
  const depth = (hash01(seed, 13) - 0.5) * 0.04 * radius

  // A solid centre, so the spikes spring from something rather than crossing in
  // mid-air. sqrt spreads it evenly over the disc's area.
  if (hash01(seed, 12) < CORE_SHARE) {
    const a = hash01(seed, 14) * Math.PI * 2
    const r = Math.sqrt(hash01(seed, 15)) * CORE_R * radius
    return [Math.cos(a) * r, Math.sin(a) * r, depth]
  }

  // Pick a spike in proportion to its length, so long spikes are not starved.
  let pick = hash01(seed, 16) * SPIKE_TOTAL
  let angle = SPIKE_LENGTHS[0][0]
  let length = SPIKE_LENGTHS[0][1]
  for (const [a, l] of SPIKE_LENGTHS) {
    pick -= l
    if (pick <= 0) {
      angle = a
      length = l
      break
    }
  }

  for (let k = 0; k < 24; k++) {
    const salt = 40 + k * 3
    // Inverse-CDF of a pdf proportional to the needle's width, so density is
    // even along its area rather than piling up at the narrow tip.
    const t = 1 - Math.pow(1 - hash01(seed, salt), 1 / (TAPER + 1))

    const keep =
      t < CORE_FRAC
        ? 1
        : Math.pow(1 - (t - CORE_FRAC) / (1 - CORE_FRAC), TIP_FALLOFF)
    if (hash01(seed, salt + 1) > keep) continue

    const along = t * length * radius
    const across = (hash01(seed, salt + 2) * 2 - 1) * spikeHalfWidth(t) * radius

    return [
      Math.cos(angle) * along - Math.sin(angle) * across,
      Math.sin(angle) * along + Math.cos(angle) * across,
      depth,
    ]
  }

  // Rare. Park it in the core, where one extra point cannot be seen.
  return [0, 0, depth]
}

/**
 * The field the star bursts into: concentric elliptical orbits around the hub
 * (screen centre), filling most of the frame.
 *
 * Nodes and dust are placed in a normalised polar space and mapped to world
 * coordinates every frame by `fieldFrame` below, which measures the camera's
 * actual frustum. Two reasons it works this way rather than as fixed world
 * positions:
 *
 *  - The shape has to track the SCREEN. The frame's width and height depend on
 *    the viewport's aspect — anything fixed in world units fills a widescreen
 *    and crops a portrait.
 *  - It cannot be done by scaling a parent group either, because the same points
 *    are the star at crush 0. A non-uniform group scale would squash the star.
 *    So the field is stretched, the star is not, and the two are interpolated in
 *    world space.
 */

/**
 * Outer orbit vs half-height of the frustum. Below 1 leaves air for bottom
 * chrome (name / mailto) plus a small margin so nodes don't kiss the text.
 */
export const FIELD_FILL_Y = 0.78

/** Outer orbit vs half-width — slight inset so sides don't clip hard. */
export const FIELD_FILL_X = 0.92

/** Innermost and outermost ring, as a fraction of the field's radius. */
const ARC_INNER = 0.38
const ARC_OUTER = 0.97

/**
 * Angular speed around the hub (rad/s). Full rings can spin rigidly again —
 * the old half-arc could not. Slight Kepler falloff so inner rings lap faster.
 */
export const ORBIT_SPEED = 0.045

/** Tiny residual sway on top of the orbit, so rings do not look locked. */
export const DRIFT_AMPLITUDE = 0.04
export const DRIFT_SPEED = 0.22

export type FieldFrame = {
  /** Horizontal radius of the outer orbit. */
  radiusX: number
  /** Vertical radius of the outer orbit. */
  radiusY: number
  /** Keep-out radius around the hub, in world units. */
  clear: number
}

/**
 * Measures the camera's frame and returns the field's dimensions in world units.
 *
 * Orbits are centred on the hub at the origin. `clearPx` keeps nodes from
 * landing under the star and its category ring; it is given in CSS pixels and
 * converted here, since that is the space the ring is actually sized in.
 */
export function fieldFrame(
  cameraZ: number,
  fovDeg: number,
  viewportW: number,
  viewportH: number,
  clearPx: number,
): FieldFrame {
  const halfH = Math.tan((fovDeg * Math.PI) / 360) * cameraZ
  const halfW = halfH * (viewportW / viewportH)
  return {
    radiusX: halfW * FIELD_FILL_X,
    radiusY: halfH * FIELD_FILL_Y,
    clear: (clearPx / viewportH) * halfH * 2,
  }
}

/**
 * Places one point of the field, given its ring and angle, into world x/y.
 *
 * Angle 0 is +X (right), increasing counter-clockwise — full 0..2π around the
 * hub. Points that would land on the hub are pushed radially clear of it.
 */
export function fieldPoint(
  f: FieldFrame,
  arc: number,
  angle: number,
): [number, number] {
  let x = Math.cos(angle) * f.radiusX * arc
  let y = Math.sin(angle) * f.radiusY * arc

  const d = Math.hypot(x, y)
  if (d < f.clear && d > 1e-4) {
    const push = f.clear / d
    x *= push
    y *= push
  }
  return [x, y]
}

export type NodeLayout = {
  id: string
  category: CategoryId
  subcategories: string[]
  /** Which ring of the field this node rides, 0..1. Set by its category. */
  arc: number
  /** Position on that ring, 0..2π. */
  angle: number
  /** Phase offset for residual sway, so nodes don't rock in lockstep. */
  phase: number
  /** Depth jitter, for a little parallax. */
  z: number
  /** Per-node size multiplier, so the field does not look uniform. */
  scale: number
  /** Position inside the star, before the burst. */
  collapsed: [number, number, number]
  /**
   * Fraction of the burst this node waits before moving, scaled by how far out
   * it ends up. Outer nodes leaving last reads as a shockwave rather than every
   * node moving in lockstep.
   */
  delay: number
}

/**
 * One ring per category, ordered by its position in `categories`: innermost
 * near the hub, outermost near the frame edge. Nodes spread around the full
 * orbit, with jitter so the rings don't read as rigid.
 */
export function buildLayout(
  experiences: Experience[],
  categories: MainCategory[],
): NodeLayout[] {
  const byCategory = new Map<CategoryId, Experience[]>()
  for (const e of experiences) {
    const list = byCategory.get(e.category) ?? []
    list.push(e)
    byCategory.set(e.category, list)
  }

  const bands = Math.max(1, byCategory.size - 1)
  const out: NodeLayout[] = []

  for (const [category, items] of byCategory) {
    const t = categoryOrder(categories, category) / bands
    const arcBase = ARC_INNER + t * (ARC_OUTER - ARC_INNER)

    items.forEach((exp, i) => {
      const id = exp.id
      const span = Math.PI * 2
      const base = ((i + 0.5) / items.length) * span
      const jitterAngle = (hash01(id, 1) - 0.5) * (span / items.length) * 0.6
      const arc = arcBase + (hash01(id, 2) - 0.5) * 0.045

      out.push({
        id,
        category,
        subcategories: exp.subcategories,
        arc,
        angle: base + jitterAngle,
        phase: hash01(id, 3) * Math.PI * 2,
        z: (hash01(id, 5) - 0.5) * 0.6,
        scale: 0.75 + hash01(id, 4) * 0.5,
        collapsed: starPoint(id, STAR_RADIUS),
        delay: arc * 0.3,
      })
    })
  }

  return out
}

/**
 * Extra points that exist only to make the star solid, and burn off as it
 * bursts.
 *
 * The star and the field want very different densities of the same points: at
 * full-frame the star needs enough grain to fuse opaque under the halftone,
 * while that many spread across the field turn it into an undifferentiated
 * starfield with no structure and no visible core. One count cannot serve both,
 * so this shell carries the star's density and fades out during the burst,
 * leaving the field's own dust behind.
 */
export function buildStarShell(count: number): Float32Array {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const [x, y, z] = starPoint(`shell-${i}`, STAR_RADIUS)
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = z
  }
  return positions
}

export type DustLayout = {
  /** Ring each mote rides, 0..1. */
  arc: Float32Array
  /** Angle on that ring, 0..2π. */
  angle: Float32Array
  /** Phase offset for residual sway. */
  phase: Float32Array
  /** Depth jitter. */
  z: Float32Array
  /** Positions inside the star, xyz interleaved. */
  collapsed: Float32Array
  /** Per-mote burst delay. */
  delay: Float32Array
}

/** The dust that fills the field between the nodes. */
export function buildDust(count: number): DustLayout {
  const arc = new Float32Array(count)
  const angle = new Float32Array(count)
  const phase = new Float32Array(count)
  const z = new Float32Array(count)
  const collapsed = new Float32Array(count * 3)
  const delay = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const seed = `dust-${i}`
    // sqrt spreads the motes evenly over the disc's area rather than piling
    // them up near the hub.
    const a = Math.sqrt(hash01(seed, 5))
    arc[i] = a
    angle[i] = hash01(seed, 6) * Math.PI * 2
    phase[i] = hash01(seed, 7) * Math.PI * 2
    z[i] = (hash01(seed, 8) - 0.5) * 1.2
    delay[i] = a * 0.3

    const c = starPoint(seed, STAR_RADIUS)
    collapsed[i * 3] = c[0]
    collapsed[i * 3 + 1] = c[1]
    collapsed[i * 3 + 2] = c[2]
  }

  return { arc, angle, phase, z, collapsed, delay }
}
