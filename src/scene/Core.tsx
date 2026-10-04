import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Shape,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from 'three'
import {
  BECKON_AMP,
  BECKON_COUNT,
  BECKON_DELAY,
  BECKON_GLOW,
  BECKON_PERIOD,
  CLICK_DECAY,
  FLASH_AMP,
  PULSE_AMP,
  coreClick,
} from './coreClick'
import { crush } from './crush'
import { SPIKE_LENGTHS } from './galaxyLayout'
import { useStore } from '../state/store'

/**
 * The small star left at the centre once the big one bursts.
 *
 * Real geometry, not points. Points would be the obvious choice for matching
 * the big star, but three's sizeAttenuation sizes them as `size * (height/2) /
 * distance` — at the settled camera they land under the halftone's cell and
 * mostly vanish, leaving no core at all. A mesh scales honestly with distance
 * and the halftone screens it into the same dot treatment as everything else.
 *
 * Interaction is not on this mesh — a mesh at the origin gets occluded by
 * drifting galaxy nodes. It lives on the `HubHotspot` DOM element instead, which
 * this component positions each frame by projecting the star to screen.
 *
 * Click feedback (scale pulse + open-only flash) comes from `coreClick`, written
 * by the hotspot and decayed here.
 */
export const CORE_RADIUS = 0.85

/** Waist of the star, where two spikes meet. */
const INNER_FRAC = 0.17

const origin = new Vector3()

export function Core() {
  const group = useRef<Group>(null)
  const mesh = useRef<Mesh>(null)
  const phase = useStore((s) => s.phase)
  /** Clock time the landing beckon starts; null until the galaxy settles. */
  const beckonAt = useRef<number | null>(null)

  /** The same eight spikes as the big star, so it reads as that star shrunk. */
  const shape = useMemo(() => {
    const s = new Shape()
    const step = Math.PI / 8
    for (let i = 0; i < 8; i++) {
      const angle = SPIKE_LENGTHS[i][0]
      const outer = SPIKE_LENGTHS[i][1] * CORE_RADIUS
      const tip = [Math.cos(angle) * outer, Math.sin(angle) * outer]
      const waistAngle = angle + step
      const waist = [
        Math.cos(waistAngle) * INNER_FRAC * CORE_RADIUS,
        Math.sin(waistAngle) * INNER_FRAC * CORE_RADIUS,
      ]
      if (i === 0) s.moveTo(tip[0], tip[1])
      else s.lineTo(tip[0], tip[1])
      s.lineTo(waist[0], waist[1])
    }
    s.closePath()
    return s
  }, [])

  useFrame((state, delta) => {
    const g = group.current
    if (!g) return

    // Hold at nothing for the first half of the burst, then grow. Squaring the
    // back half makes it read as revealed rather than inflated.
    const p = crush.progress
    const reveal = p < 0.45 ? 0 : Math.pow((p - 0.45) / 0.55, 2)

    if (coreClick.pulse > 0) {
      coreClick.pulse = Math.max(0, coreClick.pulse - delta / CLICK_DECAY)
    }
    if (coreClick.flash > 0) {
      coreClick.flash = Math.max(0, coreClick.flash - delta / CLICK_DECAY)
    }

    const now = state.clock.elapsedTime
    if (phase === 'galaxy' && beckonAt.current === null) {
      beckonAt.current = now + BECKON_DELAY
    }
    // A real click means the hint landed; stop beckoning.
    if (coreClick.pulse > 0) beckonAt.current = -Infinity
    const bt = beckonAt.current === null ? -1 : now - beckonAt.current
    const beckon =
      bt >= 0 && bt < BECKON_COUNT * BECKON_PERIOD
        ? Math.sin((Math.PI * bt) / BECKON_PERIOD) ** 2
        : 0

    const pulse = coreClick.pulse
    const flash = coreClick.flash
    g.scale.setScalar(reveal * (1 + pulse * PULSE_AMP + beckon * BECKON_AMP))

    const mat = mesh.current?.material
    if (mat && !Array.isArray(mat)) {
      // Rest stays full white; flash pushes channels above 1 so the halftone
      // reads a brighter kick on open.
      const b = 1 + flash * FLASH_AMP + beckon * BECKON_GLOW
      ;(mat as MeshBasicMaterial).color.setRGB(b, b, b)
    }

    // Turn in its own plane, not about Y — a flat star spun about Y collapses
    // to a line. In-plane rotation reads as a twinkle.
    if (mesh.current) mesh.current.rotation.z += delta * 0.05

    // Intro + galaxy: keep the DOM hotspot on the star. Skip mid-crush — the
    // hotspot is pointer-disabled then and the star is mid-burst.
    if (phase !== 'intro' && phase !== 'galaxy') return

    // Where the star actually is on screen. Everything below hangs off this, so
    // it stays correct on any viewport rather than assuming screen centre.
    origin.set(0, 0, 0).project(state.camera)
    const hubX = (origin.x * 0.5 + 0.5) * state.size.width
    const hubY = (-origin.y * 0.5 + 0.5) * state.size.height

    const hotspot = document.getElementById('hub-hotspot')
    if (hotspot) hotspot.style.transform = `translate(${hubX}px, ${hubY}px)`
  })

  return (
    <group ref={group} scale={0}>
      {/* Picking lives on HubHotspot; this mesh must never steal empty-space misses. */}
      <mesh ref={mesh} frustumCulled={false} raycast={() => {}}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  )
}
