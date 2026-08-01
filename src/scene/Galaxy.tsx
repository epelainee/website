import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import {
  BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Object3D,
  Points,
  type Intersection,
  type PointsMaterial,
  type Raycaster,
  Sphere,
  Vector3,
} from 'three'
import { useContent } from '../content/useContent'
import {
  buildDust,
  buildLayout,
  buildStarShell,
  DRIFT_AMPLITUDE,
  DRIFT_SPEED,
  ORBIT_SPEED,
  SPIKE_LENGTHS,
  STAR_RADIUS,
  fieldFrame,
  fieldPoint,
} from './galaxyLayout'
import { regularStarShape } from './starShape'
import {
  byId,
  experienceMatchesSearch,
  subcategoriesMatchPath,
} from '../data/experiences'
import { CRUSH_DURATION, useStore } from '../state/store'
import { crush } from './crush'
import { NodeLabel } from '../ui/NodeLabel'

const dummy = new Object3D()

/**
 * The field the star bursts into: instanced nodes per experience (sphere,
 * 4-point internship star, or 5-point certification star), plus dust.
 *
 * The star and the field are the same points. At crush 0 every point sits inside
 * the star; at 1 it sits on a ring orbiting the hub. So the burst is one number,
 * and the two states cannot drift out of sync.
 *
 * Settled positions are recomputed in world space every frame from the camera's
 * measured frustum (see `fieldFrame`). They cannot be baked: the shape tracks the
 * screen, and they interpolate from an undistorted star, so a scaled parent group
 * is not an option either — it would squash the star.
 *
 * Node dots must stay comfortably larger than the halftone cell pitch. The
 * halftone samples once per cell centre, so anything smaller than a cell can
 * fall between samples and flicker as it drifts. NODE_RADIUS is set against
 * that floor, not for looks alone.
 */
/** Desktop sphere size. Mobile shrinks via `TOUCH_NODE_SCALE`. */
const NODE_RADIUS = 0.16
/** 4-point internship stars — a bit larger than spheres. */
const STAR4_OUTER = NODE_RADIUS * 1.35
/** 5-point certification stars — clearly larger so kind reads at a glance. */
const STAR5_OUTER = NODE_RADIUS * 1.9
const DUST_COUNT = 6000

/**
 * How small a node shrinks while the star is intact.
 *
 * Nodes are meshes, so unlike the dust they really do scale with fov and
 * distance — at the intro camera a full-size node is several times a dust
 * point, reading as a fat blob that breaks the star's grain. This brings them
 * down to roughly dust size, and they grow into view as the star bursts.
 */
const COLLAPSED_NODE_SCALE = 0.2

/**
 * Dust point size, collapsed vs settled.
 *
 * Beware the units. Three's sizeAttenuation is `size * (height/2) / distance`
 * and ignores fov entirely, so these are NOT comparable to the world-space
 * radii used for meshes — at this fov a point renders far smaller than its
 * number suggests.
 *
 * The floor that matters is the halftone cell: the pass takes one sample per
 * cell centre, so points smaller than a cell mostly fall between samples and
 * the star breaks into speckle no matter how many of them there are. Collapsed
 * is sized to comfortably exceed a cell so the star fuses solid; settled is
 * smaller, letting the field read as fine dust once the camera pulls back.
 */
const DUST_SIZE_COLLAPSED = 0.17
const DUST_SIZE_SETTLED = 0.1

/**
 * Keep-out radius around the hub, in CSS pixels.
 *
 * The arcs sweep straight through the centre of the screen, so this holds a
 * small halo clear around the star itself. Deliberately tight: anything near the
 * category ring's radius shoves thousands of motes onto one circle, which punches
 * an obvious hole in the field and draws a hard ring around it. Dust sitting
 * behind the buttons is fine — they have their own backing.
 */
const HUB_CLEAR_PX = 62

/** How far the shell flies outward as it burns off. */
const SHELL_SPREAD = 2.2

/** Hovered nodes swell so the pick target is legible through the dot grid. */
const HOVER_SCALE = 1.9

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

/**
 * How the intact star breathes. Two incommensurate frequencies so the pulse
 * never settles into a metronome; the sway is a slow in-plane rock, kept well
 * under the spikes' angular width so the silhouette holds. Both are weighted
 * by (1 - crush) so the life fades out as the burst takes over and cannot
 * fight the field's own drift.
 */
const BREATH_MAIN = 0.03
const BREATH_MAIN_SPEED = 1.4
const BREATH_MICRO = 0.008
const BREATH_MICRO_SPEED = 3.7
const SWAY_AMPLITUDE = 0.02
const SWAY_SPEED = 0.6

/**
 * Per-spike tip scintillation on the intact star. Each spike lengthens/shortens
 * out of phase so the silhouette twinkles rather than breathing as one blob.
 * Weighted by tip distance — the core stays put; only the needles flicker.
 */
const SHIMMER_AMP = 0.07
const SHIMMER_SPEED = 2.6
const SHIMMER_PHASE = 0.9

/** Nearest of the eight spikes to a collapsed star point. */
function nearestSpike(x: number, y: number): number {
  const a = Math.atan2(y, x)
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < SPIKE_LENGTHS.length; i++) {
    let d = Math.abs(a - SPIKE_LENGTHS[i][0])
    if (d > Math.PI) d = Math.PI * 2 - d
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  }
  return best
}

/** 0 at the hub → 1 at that spike's tip. */
function tipWeight(x: number, y: number, spike: number): number {
  const reach = SPIKE_LENGTHS[spike][1] * STAR_RADIUS
  return Math.min(1, Math.hypot(x, y) / Math.max(1e-6, reach))
}

/** Radial scale for one collapsed point; fades with the burst (`alive`). */
function spikeShimmer(
  t: number,
  spike: number,
  tip: number,
  alive: number,
): number {
  if (alive <= 0 || tip <= 0) return 1
  const wave = Math.sin(t * SHIMMER_SPEED + spike * SHIMMER_PHASE)
  return 1 + alive * SHIMMER_AMP * tip * tip * wave
}

/**
 * Soft sparkles along the star's perimeter — spawn on the silhouette and drift
 * outward. Slow; fades with the burst.
 */
const SPARKLE_COUNT = 220
const SPARKLE_SIZE = 0.11
const SPARKLE_SPEED_MIN = 0.1
const SPARKLE_SPEED_MAX = 0.18
/** How far a mote travels outward over one life (world units). */
const SPARKLE_TRAVEL = STAR_RADIUS * 0.22
/** Star waist (valley) radius — same fraction as the hub core mesh. */
const STAR_WAIST_FRAC = 0.17
/** Sit just outside the outline so sparkles read as a rim, not fill. */
const PERIMETER_OUTSET = 1.02

type StarSparkles = {
  home: Float32Array
  positions: Float32Array
  colors: Float32Array
  age: Float32Array
  speed: Float32Array
  phase: Float32Array
}

/** Closed outline: tip → waist → tip → … in angle order. */
function starPerimeterVerts(): [number, number][] {
  const tips = [...SPIKE_LENGTHS].sort((a, b) => a[0] - b[0])
  const verts: [number, number][] = []
  for (let i = 0; i < tips.length; i++) {
    const [ang, len] = tips[i]
    const rTip = len * STAR_RADIUS * PERIMETER_OUTSET
    verts.push([Math.cos(ang) * rTip, Math.sin(ang) * rTip])

    const [ang2] = tips[(i + 1) % tips.length]
    let d = ang2 - ang
    if (d > Math.PI) d -= Math.PI * 2
    if (d < -Math.PI) d += Math.PI * 2
    const waistAng = ang + d * 0.5
    const rWaist = STAR_WAIST_FRAC * STAR_RADIUS * PERIMETER_OUTSET
    verts.push([Math.cos(waistAng) * rWaist, Math.sin(waistAng) * rWaist])
  }
  return verts
}

function buildStarSparkles(count: number): StarSparkles {
  const verts = starPerimeterVerts()
  const edgeLens: number[] = []
  let total = 0
  for (let i = 0; i < verts.length; i++) {
    const [x0, y0] = verts[i]
    const [x1, y1] = verts[(i + 1) % verts.length]
    const len = Math.hypot(x1 - x0, y1 - y0)
    edgeLens.push(len)
    total += len
  }

  const home = new Float32Array(count * 3)
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const age = new Float32Array(count)
  const speed = new Float32Array(count)
  const phase = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    // Walk a random distance around the perimeter.
    let d = Math.random() * total
    let e = 0
    while (e < edgeLens.length - 1 && d > edgeLens[e]) {
      d -= edgeLens[e]
      e++
    }
    const [x0, y0] = verts[e]
    const [x1, y1] = verts[(e + 1) % verts.length]
    const t = edgeLens[e] > 1e-6 ? d / edgeLens[e] : 0
    // Slight normal jitter so the rim isn't a perfect hairline.
    const px = x0 + (x1 - x0) * t
    const py = y0 + (y1 - y0) * t
    const nLen = Math.hypot(px, py) || 1
    const jitter = (Math.random() - 0.35) * 0.08 * STAR_RADIUS
    const hx = px + (px / nLen) * jitter
    const hy = py + (py / nLen) * jitter
    const hz = (Math.random() - 0.5) * 0.05
    home[i * 3] = hx
    home[i * 3 + 1] = hy
    home[i * 3 + 2] = hz
    age[i] = Math.random()
    speed[i] =
      SPARKLE_SPEED_MIN +
      Math.random() * (SPARKLE_SPEED_MAX - SPARKLE_SPEED_MIN)
    phase[i] = Math.random() * Math.PI * 2
    // Seed live buffers so the first paint isn't a zeroed blob at the origin.
    const life = age[i]
    const travel = 1 - (1 - life) * (1 - life)
    const homeR = Math.hypot(hx, hy) || 1
    const r = homeR + travel * SPARKLE_TRAVEL
    positions[i * 3] = (hx / homeR) * r
    positions[i * 3 + 1] = (hy / homeR) * r
    positions[i * 3 + 2] = hz
    const b = (1 - life) * (1 - life)
    colors[i * 3] = b
    colors[i * 3 + 1] = b
    colors[i * 3 + 2] = b
  }
  return { home, positions, colors, age, speed, phase }
}

/** Applies a node's stagger, then eases. Returns 0..1. */
function staggered(raw: number, delay: number) {
  return easeOutCubic(clamp01((raw - delay) / (1 - delay)))
}

/**
 * Mobile-only visual size (relative to desktop geo).
 * Tuned so mobile world size stays ~same after the desktop radius bump.
 * Finger hits use a fatter raycast sphere — see `TOUCH_HIT_PAD` — not bigger meshes.
 */
const TOUCH_NODE_SCALE = 0.58
const TOUCH_STAR4_SCALE = 0.76
/** Keep 5-point stars reading larger than 4-point on touch too. */
const TOUCH_STAR5_SCALE = 0.85

/**
 * Touch pick radius vs rendered geo radius. Visual stays small; hit sphere
 * matches the earlier ~2.5× bump that made fingers land without looking fat.
 */
const TOUCH_HIT_PAD = 2.5

const _hitSphere = new Sphere()
const _hitMatrix = new Matrix4()
const _hitWorld = new Matrix4()
const _hitPoint = new Vector3()

/**
 * Sphere pick per instance — ignores star silhouette, good enough for fingers.
 * Skips near-zero scales so filtered-out nodes stay untouchable.
 */
function fatInstanceRaycast(localRadius: number) {
  return function raycast(
    this: InstancedMesh,
    raycaster: Raycaster,
    intersects: Intersection[],
  ) {
    if (this.count === 0) return
    const threshold = localRadius * TOUCH_HIT_PAD
    for (let i = 0; i < this.count; i++) {
      this.getMatrixAt(i, _hitMatrix)
      const sx = Math.hypot(
        _hitMatrix.elements[0],
        _hitMatrix.elements[1],
        _hitMatrix.elements[2],
      )
      if (sx < 0.02) continue
      _hitWorld.multiplyMatrices(this.matrixWorld, _hitMatrix)
      _hitSphere.center.setFromMatrixPosition(_hitWorld)
      _hitSphere.radius = threshold * sx
      if (!raycaster.ray.intersectSphere(_hitSphere, _hitPoint)) continue
      intersects.push({
        distance: raycaster.ray.origin.distanceTo(_hitPoint),
        point: _hitPoint.clone(),
        object: this,
        instanceId: i,
      })
    }
  }
}

const FIELD_BOUNDS = new Sphere(new Vector3(0, 0, 0), 60)

export function Galaxy({
  dustCount = DUST_COUNT,
  shellCount = 14000,
  touch = false,
}: {
  dustCount?: number
  shellCount?: number
  touch?: boolean
}) {
  const sphereRef = useRef<InstancedMesh>(null)
  const internRef = useRef<InstancedMesh>(null)
  const certRef = useRef<InstancedMesh>(null)
  const dustRef = useRef<Points>(null)
  const labelRef = useRef<Group>(null)

  const { experiences, categories } = useContent()
  const layout = useMemo(
    () => buildLayout(experiences, categories),
    [experiences, categories],
  )
  const dust = useMemo(() => buildDust(dustCount), [dustCount])
  const shell = useMemo(() => buildStarShell(shellCount), [shellCount])

  /** Per-shell-point spike + tip weight — baked once so the shimmer is cheap. */
  const shellMeta = useMemo(() => {
    const spike = new Uint8Array(shellCount)
    const tip = new Float32Array(shellCount)
    for (let i = 0; i < shellCount; i++) {
      const x = shell[i * 3]
      const y = shell[i * 3 + 1]
      const s = nearestSpike(x, y)
      spike[i] = s
      tip[i] = tipWeight(x, y, s)
    }
    return { spike, tip }
  }, [shell, shellCount])

  /** Working buffer; shell starts as the baked star and is rewritten while visible. */
  const shellPositions = useMemo(() => new Float32Array(shell), [shell])

  const sparkles = useMemo(() => buildStarSparkles(SPARKLE_COUNT), [])
  const sparkleRef = useRef<Points>(null)
  const sparkleMaterial = useRef<PointsMaterial>(null)

  const star4 = useMemo(() => regularStarShape(4, STAR4_OUTER), [])
  const star5 = useMemo(() => regularStarShape(5, STAR5_OUTER), [])

  /** Global layout indices partitioned by experience kind. */
  const groups = useMemo(() => {
    const kindById = new Map(
      experiences.map((e) => [e.id, e.kind ?? 'default'] as const),
    )
    const sphere: number[] = []
    const intern: number[] = []
    const cert: number[] = []
    layout.forEach((n, i) => {
      const k = kindById.get(n.id) ?? 'default'
      if (k === 'internship') intern.push(i)
      else if (k === 'certification') cert.push(i)
      else sphere.push(i)
    })
    return { sphere, intern, cert }
  }, [layout, experiences])

  const phase = useStore((s) => s.phase)
  const hoveredId = useStore((s) => s.hoveredId)
  const setHovered = useStore((s) => s.setHovered)
  const select = useStore((s) => s.select)
  const path = useStore((s) => s.path)
  const searchQuery = useStore((s) => s.searchQuery)

  /**
   * A node is shown when it matches the current path and search: everything at
   * root (unless searching), the category's nodes once a category is entered,
   * that subcategory's nodes once one is picked. One predicate drives both the
   * fade animation and picking, so a faded-out node can never answer the pointer.
   */
  const matches = (node: (typeof layout)[number]) => {
    if (!subcategoriesMatchPath(node.subcategories, path, categories)) return false
    const exp = byId(experiences, node.id)
    if (!exp) return false
    return experienceMatchesSearch(exp, searchQuery, categories)
  }

  /** Per-node filter visibility, eased toward 0 or 1 so filtering is not a jump cut. */
  const shown = useMemo(
    () => new Float32Array(layout.length).fill(1),
    [layout.length],
  )

  /** Working buffer the dust geometry reads from; starts collapsed in the star. */
  const dustPositions = useMemo(
    () => new Float32Array(dust.collapsed),
    [dust],
  )

  const dustMaterial = useRef<PointsMaterial>(null)
  const shellRef = useRef<Points>(null)
  const shellMaterial = useRef<PointsMaterial>(null)

  /**
   * Live local position of every node, rewritten each frame. The label needs to
   * track a moving target, and recomputing its orbit separately would risk the
   * label and the dot disagreeing by a frame.
   */
  const live = useMemo(
    () => new Float32Array(layout.length * 3),
    [layout.length],
  )

  const indexOf = (id: string | null) =>
    id === null ? -1 : layout.findIndex((n) => n.id === id)

  /**
   * Declare a bounding sphere covering the whole field.
   *
   * InstancedMesh.raycast() rejects the mesh outright if the ray misses this
   * sphere, and Three computes it lazily ONCE from instanceMatrix. Because the
   * instances start collapsed inside the star, that automatic sphere would be
   * star-sized and never recomputed — so every node would become unhoverable and
   * unclickable the moment the field expanded past it. Sizing it generously,
   * past any frame, keeps picking correct at any burst progress and any aspect,
   * at no per-frame cost.
   */
  useLayoutEffect(() => {
    for (const mesh of [sphereRef.current, internRef.current, certRef.current]) {
      if (mesh) mesh.boundingSphere = FIELD_BOUNDS
    }
  }, [groups.sphere.length, groups.intern.length, groups.cert.length])

  useFrame((state, delta) => {
    const { clock } = state
    const target = phase === 'intro' ? 0 : 1
    if (crush.progress !== target) {
      crush.progress = clamp01(
        crush.progress + (delta / CRUSH_DURATION) * (target === 1 ? 1 : -1),
      )
    }
    const p = crush.progress
    const t = clock.getElapsedTime()

    // The intact star breathes and rocks; both die off as the burst begins.
    const alive = 1 - p
    const breath =
      1 +
      alive *
        (Math.sin(t * BREATH_MAIN_SPEED) * BREATH_MAIN +
          Math.sin(t * BREATH_MICRO_SPEED + 1.3) * BREATH_MICRO)
    const sway = alive * Math.sin(t * SWAY_SPEED) * SWAY_AMPLITUDE
    const swayCos = Math.cos(sway)
    const swaySin = Math.sin(sway)

    // Measure the frame this instant: the field is defined against the screen,
    // so its world size changes with the aspect and with the camera's dolly.
    const field = fieldFrame(
      state.camera.position.z,
      (state.camera as { fov?: number }).fov ?? 32,
      state.size.width,
      state.size.height,
      HUB_CLEAR_PX,
    )

    for (let i = 0; i < layout.length; i++) {
      const n = layout[i]
      const e = staggered(p, n.delay)

      // Full orbit around the hub, plus a little sway so rings do not look locked.
      const spin = ORBIT_SPEED / Math.sqrt(Math.max(0.25, n.arc))
      const angle =
        n.angle +
        t * spin +
        Math.sin(t * DRIFT_SPEED + n.phase) * DRIFT_AMPLITUDE
      const [fx, fy] = fieldPoint(field, n.arc, angle)

      // Breathe/rock/shimmer the collapsed position, not the group: a parent
      // transform would drag the settled field along with it.
      const spike = nearestSpike(n.collapsed[0], n.collapsed[1])
      const shim = spikeShimmer(
        t,
        spike,
        tipWeight(n.collapsed[0], n.collapsed[1], spike),
        alive,
      )
      const cx =
        (n.collapsed[0] * swayCos - n.collapsed[1] * swaySin) * breath * shim
      const cy =
        (n.collapsed[0] * swaySin + n.collapsed[1] * swayCos) * breath * shim

      const x = cx + (fx - cx) * e
      const y = cy + (fy - cy) * e
      const z = n.collapsed[2] + (n.z - n.collapsed[2]) * e

      live[i * 3] = x
      live[i * 3 + 1] = y
      live[i * 3 + 2] = z

      // Ease filter visibility rather than snapping, so a filter change reads
      // as the galaxy thinning out instead of half of it vanishing.
      const want = matches(n) ? 1 : 0
      shown[i] += (want - shown[i]) * Math.min(1, delta * 8)
    }

    const writeGroup = (
      mesh: InstancedMesh | null,
      indices: number[],
      touchScale: number,
    ) => {
      if (!mesh || indices.length === 0) return
      for (let j = 0; j < indices.length; j++) {
        const i = indices[j]
        const n = layout[i]
        const e = staggered(p, n.delay)
        dummy.position.set(live[i * 3], live[i * 3 + 1], live[i * 3 + 2])
        dummy.scale.setScalar(
          n.scale *
            (n.id === hoveredId ? HOVER_SCALE : 1) *
            (touch ? touchScale : 1) *
            (COLLAPSED_NODE_SCALE + (1 - COLLAPSED_NODE_SCALE) * e) *
            shown[i],
        )
        dummy.updateMatrix()
        mesh.setMatrixAt(j, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    writeGroup(sphereRef.current, groups.sphere, TOUCH_NODE_SCALE)
    writeGroup(internRef.current, groups.intern, TOUCH_STAR4_SCALE)
    writeGroup(certRef.current, groups.cert, TOUCH_STAR5_SCALE)

    // Park the label on the hovered node.
    const label = labelRef.current
    if (label) {
      const i = indexOf(hoveredId)
      if (i >= 0) label.position.set(live[i * 3], live[i * 3 + 1], live[i * 3 + 2])
    }

    const points = dustRef.current
    if (points) {
      // Rewritten every frame, not only during the burst: the motes sway along
      // their arcs, and the field itself is re-measured each frame, so there is
      // no settled state to skip.
      for (let i = 0; i < dustCount; i++) {
        const e = staggered(p, dust.delay[i])
        const i3 = i * 3

        const spin = ORBIT_SPEED / Math.sqrt(Math.max(0.25, dust.arc[i]))
        const angle =
          dust.angle[i] +
          t * spin +
          Math.sin(t * DRIFT_SPEED + dust.phase[i]) * DRIFT_AMPLITUDE
        const [fx, fy] = fieldPoint(field, dust.arc[i], angle)

        const ox = dust.collapsed[i3]
        const oy = dust.collapsed[i3 + 1]
        const spike = nearestSpike(ox, oy)
        const shim = spikeShimmer(
          t,
          spike,
          tipWeight(ox, oy, spike),
          alive,
        )
        const cx = (ox * swayCos - oy * swaySin) * breath * shim
        const cy = (ox * swaySin + oy * swayCos) * breath * shim

        dustPositions[i3] = cx + (fx - cx) * e
        dustPositions[i3 + 1] = cy + (fy - cy) * e
        dustPositions[i3 + 2] =
          dust.collapsed[i3 + 2] + (dust.z[i] - dust.collapsed[i3 + 2]) * e
      }
      ;(points.geometry.attributes.position as BufferAttribute).needsUpdate = true
    }

    if (dustMaterial.current) {
      // Same shimmer as the shell, so the star's grain pulses as one body.
      dustMaterial.current.size =
        (DUST_SIZE_COLLAPSED + (DUST_SIZE_SETTLED - DUST_SIZE_COLLAPSED) * p) *
        (1 + alive * 0.07 * Math.sin(t * 2.1 + 0.7))
    }

    // Burn the shell off. Per-point rewrite so each spike can scintillate on
    // its own; fades out over the first half of the burst.
    if (shellRef.current && shellMaterial.current) {
      const e = easeOutCubic(p)
      const spread = 1 + SHELL_SPREAD * e
      if (p < 0.5) {
        for (let i = 0; i < shellCount; i++) {
          const i3 = i * 3
          const ox = shell[i3]
          const oy = shell[i3 + 1]
          const shim = spikeShimmer(t, shellMeta.spike[i], shellMeta.tip[i], alive)
          const s = breath * shim * spread
          shellPositions[i3] = (ox * swayCos - oy * swaySin) * s
          shellPositions[i3 + 1] = (ox * swaySin + oy * swayCos) * s
          shellPositions[i3 + 2] = shell[i3 + 2] * s
        }
        ;(shellRef.current.geometry.attributes.position as BufferAttribute).needsUpdate =
          true
      }
      shellRef.current.scale.setScalar(1)
      shellRef.current.rotation.z = 0
      // A slow shimmer in point size reads as the star glowing rather than
      // sitting there; the halftone turns it into dots swelling and shrinking.
      shellMaterial.current.size =
        DUST_SIZE_COLLAPSED * (1 + alive * 0.07 * Math.sin(t * 2.1 + 0.7))
      shellMaterial.current.opacity = clamp01(1 - p * 2)
      shellRef.current.visible = p < 0.5
    }

    // Perimeter sparkles — emerge from the outline and drift outward.
    if (sparkleRef.current && sparkleMaterial.current) {
      const show = alive > 0.05
      sparkleRef.current.visible = show
      if (show) {
        // Tab-focus can dump a huge delta; clamp so ages don't teleport.
        const dt = Math.min(delta, 1 / 30)
        for (let i = 0; i < SPARKLE_COUNT; i++) {
          sparkles.age[i] += dt * sparkles.speed[i]
          if (sparkles.age[i] >= 1) sparkles.age[i] -= 1
          const life = sparkles.age[i]
          // Ease out so they leave the rim slowly, then coast farther.
          const travel = 1 - (1 - life) * (1 - life)
          const i3 = i * 3
          const hx = sparkles.home[i3]
          const hy = sparkles.home[i3 + 1]
          const hz = sparkles.home[i3 + 2]
          const homeR = Math.hypot(hx, hy) || 1
          const ux = hx / homeR
          const uy = hy / homeR
          const r = (homeR + travel * SPARKLE_TRAVEL) * breath
          const lx = ux * r
          const ly = uy * r
          sparkles.positions[i3] = lx * swayCos - ly * swaySin
          sparkles.positions[i3 + 1] = lx * swaySin + ly * swayCos
          sparkles.positions[i3 + 2] = hz
          // Bright near the star, fade as they drift away.
          const b = (1 - life) * (1 - life)
          sparkles.colors[i3] = b
          sparkles.colors[i3 + 1] = b
          sparkles.colors[i3 + 2] = b
        }
        ;(sparkleRef.current.geometry.attributes
          .position as BufferAttribute).needsUpdate = true
        ;(sparkleRef.current.geometry.attributes
          .color as BufferAttribute).needsUpdate = true
        sparkleMaterial.current.opacity = alive * 0.22
        sparkleMaterial.current.size = SPARKLE_SIZE
      }
    }
  })

  // Nodes are only pickable once they have settled; during the crush they are
  // moving too fast to aim at, and the orb should read as one object.
  const interactive = phase === 'galaxy'

  // Off-galaxy: disable raycasting so empty-space clicks reach `onPointerMissed`
  // (ripples) instead of landing on the collapsed / expanding instance cloud.
  // Also drop hover — pointerOut won't fire once raycast is stubbed out.
  // Touch: fat sphere raycast so small visuals still catch fingers.
  useEffect(() => {
    const specs: Array<[InstancedMesh | null, number]> = [
      [sphereRef.current, NODE_RADIUS],
      [internRef.current, STAR4_OUTER],
      [certRef.current, STAR5_OUTER],
    ]
    for (const [mesh, radius] of specs) {
      if (!mesh) continue
      if (!interactive) {
        mesh.raycast = () => {}
      } else if (touch) {
        mesh.raycast = fatInstanceRaycast(radius)
      } else {
        mesh.raycast = InstancedMesh.prototype.raycast
      }
    }
    if (!interactive) {
      setHovered(null)
      document.body.style.cursor = ''
    }
  }, [interactive, setHovered, touch])

  /**
   * A filtered-out node shrinks to nothing but its instance still exists, and a
   * zero-scale sphere can still register a raycast hit. Without this guard an
   * invisible node would answer to the pointer.
   */
  const pickable = (globalIndex: number | undefined) =>
    globalIndex !== undefined &&
    layout[globalIndex] !== undefined &&
    matches(layout[globalIndex])

  const handlersFor = (indices: number[]) => ({
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return
      e.stopPropagation()
      const global = indices[e.instanceId!]
      if (!pickable(global)) {
        if (hoveredId !== null) setHovered(null)
        return
      }
      const id = layout[global].id
      if (id !== hoveredId) setHovered(id)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      if (!interactive) return
      setHovered(null)
      document.body.style.cursor = ''
    },
    // pointerdown: more reliable than click on touch (no ghost-click miss).
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      if (!interactive) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const global = indices[e.instanceId!]
      if (!pickable(global)) return
      e.stopPropagation()
      select(layout[global].id)
    },
  })

  const sphereHandlers = handlersFor(groups.sphere)
  const internHandlers = handlersFor(groups.intern)
  const certHandlers = handlersFor(groups.cert)

  // No parent transform: settled positions are already world coordinates, and
  // the star they interpolate from must not be distorted.
  return (
    <group>
      {groups.sphere.length > 0 ? (
        <instancedMesh
          ref={sphereRef}
          args={[undefined, undefined, groups.sphere.length]}
          frustumCulled={false}
          {...sphereHandlers}
        >
          <sphereGeometry args={[NODE_RADIUS, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
      ) : null}

      {groups.intern.length > 0 ? (
        <instancedMesh
          ref={internRef}
          args={[undefined, undefined, groups.intern.length]}
          frustumCulled={false}
          {...internHandlers}
        >
          <shapeGeometry args={[star4]} />
          <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
      ) : null}

      {groups.cert.length > 0 ? (
        <instancedMesh
          ref={certRef}
          args={[undefined, undefined, groups.cert.length]}
          frustumCulled={false}
          {...certHandlers}
        >
          <shapeGeometry args={[star5]} />
          <meshBasicMaterial color="#ffffff" />
        </instancedMesh>
      ) : null}

      <group ref={labelRef}>
        <NodeLabel />
      </group>

      {/* The star's density, which burns off. Scaled outward rather than having
          its positions rewritten — 14k points move for the cost of one matrix. */}
      <points ref={shellRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[shellPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={shellMaterial}
          color="#ffffff"
          size={DUST_SIZE_COLLAPSED}
          sizeAttenuation
          transparent
          opacity={1}
          depthWrite={false}
        />
      </points>

      <points ref={sparkleRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[sparkles.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[sparkles.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={sparkleMaterial}
          color="#ffffff"
          size={SPARKLE_SIZE}
          sizeAttenuation
          transparent
          opacity={0.22}
          depthWrite={false}
          vertexColors
        />
      </points>

      <points ref={dustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[dustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={dustMaterial}
          color="#ffffff"
          size={DUST_SIZE_COLLAPSED}
          sizeAttenuation
          transparent
          opacity={0.85}
        />
      </points>
    </group>
  )
}
