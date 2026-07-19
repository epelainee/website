import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import {
  BufferAttribute,
  Group,
  InstancedMesh,
  Object3D,
  Points,
  type PointsMaterial,
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
  fieldFrame,
  fieldPoint,
} from './galaxyLayout'
import { regularStarShape } from './starShape'
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
const NODE_RADIUS = 0.13
/** Flat stars — a bit larger than spheres so tips survive the halftone. */
const STAR_OUTER = NODE_RADIUS * 1.35
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

/** Applies a node's stagger, then eases. Returns 0..1. */
function staggered(raw: number, delay: number) {
  return easeOutCubic(clamp01((raw - delay) / (1 - delay)))
}

/**
 * Mobile-only size (relative to desktop geo). Stars bumped so tips stay readable.
 * Tuned so mobile world size stays ~same after the desktop radius bump.
 */
const TOUCH_NODE_SCALE = 0.71
const TOUCH_STAR_SCALE = 0.93

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

  const star4 = useMemo(() => regularStarShape(4, STAR_OUTER), [])
  const star5 = useMemo(() => regularStarShape(5, STAR_OUTER), [])

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

  /**
   * A node is shown when it matches the current path: everything at root, the
   * category's nodes once a category is entered, that subcategory's nodes once
   * one is picked. One predicate drives both the fade animation and picking, so
   * a faded-out node can never answer the pointer.
   */
  const matches = (cat: string, sub: string) => {
    if (path.length === 0) return true
    if (path[0] !== cat) return false
    if (path.length === 1) return true
    return path[1] === sub
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

      // Breathe/rock the collapsed position, not the group: a parent
      // transform would drag the settled field along with it.
      const cx = (n.collapsed[0] * swayCos - n.collapsed[1] * swaySin) * breath
      const cy = (n.collapsed[0] * swaySin + n.collapsed[1] * swayCos) * breath

      const x = cx + (fx - cx) * e
      const y = cy + (fy - cy) * e
      const z = n.collapsed[2] + (n.z - n.collapsed[2]) * e

      live[i * 3] = x
      live[i * 3 + 1] = y
      live[i * 3 + 2] = z

      // Ease filter visibility rather than snapping, so a filter change reads
      // as the galaxy thinning out instead of half of it vanishing.
      const want = matches(n.category, n.subcategory) ? 1 : 0
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
    writeGroup(internRef.current, groups.intern, TOUCH_STAR_SCALE)
    writeGroup(certRef.current, groups.cert, TOUCH_STAR_SCALE)

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

        const cx =
          (dust.collapsed[i3] * swayCos - dust.collapsed[i3 + 1] * swaySin) *
          breath
        const cy =
          (dust.collapsed[i3] * swaySin + dust.collapsed[i3 + 1] * swayCos) *
          breath

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

    // Burn the shell off. It fades out over the first half of the burst — well
    // before the field arrives — so what settles is the field's own dust and
    // the star's extra grain is never seen spread thin across it.
    if (shellRef.current && shellMaterial.current) {
      const e = easeOutCubic(p)
      // The shell carries most of the star's visible mass, so it breathes and
      // rocks with the same numbers as the nodes and dust — one transform for
      // 14k points instead of a per-point rewrite.
      shellRef.current.scale.setScalar((1 + SHELL_SPREAD * e) * breath)
      shellRef.current.rotation.z = sway
      // A slow shimmer in point size reads as the star glowing rather than
      // sitting there; the halftone turns it into dots swelling and shrinking.
      shellMaterial.current.size =
        DUST_SIZE_COLLAPSED * (1 + alive * 0.07 * Math.sin(t * 2.1 + 0.7))
      shellMaterial.current.opacity = clamp01(1 - p * 2)
      shellRef.current.visible = p < 0.5
    }
  })

  // Nodes are only pickable once they have settled; during the crush they are
  // moving too fast to aim at, and the orb should read as one object.
  const interactive = phase === 'galaxy'

  // Off-galaxy: disable raycasting so empty-space clicks reach `onPointerMissed`
  // (ripples) instead of landing on the collapsed / expanding instance cloud.
  // Also drop hover — pointerOut won't fire once raycast is stubbed out.
  useEffect(() => {
    const meshes = [sphereRef.current, internRef.current, certRef.current]
    for (const mesh of meshes) {
      if (!mesh) continue
      if (interactive) {
        mesh.raycast = InstancedMesh.prototype.raycast
      } else {
        mesh.raycast = () => {}
      }
    }
    if (!interactive) {
      setHovered(null)
      document.body.style.cursor = ''
    }
  }, [interactive, setHovered])

  /**
   * A filtered-out node shrinks to nothing but its instance still exists, and a
   * zero-scale sphere can still register a raycast hit. Without this guard an
   * invisible node would answer to the pointer.
   */
  const pickable = (globalIndex: number | undefined) =>
    globalIndex !== undefined &&
    layout[globalIndex] !== undefined &&
    matches(layout[globalIndex].category, layout[globalIndex].subcategory)

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
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!interactive) return
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
          <bufferAttribute attach="attributes-position" args={[shell, 3]} />
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
