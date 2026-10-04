import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'
import { crush } from './crush'
import { STAR_HALF_WIDTH_FRAC, STAR_RADIUS } from './galaxyLayout'

/**
 * Dollies the camera out as the star bursts.
 *
 * The intro distance is measured, not fixed: the star is tall, and a number
 * tuned on a desktop crops it badly on a portrait phone. The settled distance
 * does not need measuring — the field fits itself to whatever frame the camera
 * gives it (see `fieldFrame`), so this only chooses how big the nodes read.
 *
 * The camera object is mutated directly rather than driven by the Canvas
 * `camera` prop, which R3F only reads once at creation.
 */

/** Starting guess only; the rig computes the real distance on the first frame. */
export const INTRO_Z = 7.4

/** Leave room around the star for the intro text. */
const INTRO_MARGIN = 1.6

/**
 * The intro text hangs below the star, so the star rides this far above centre
 * to keep star + text balanced as one group. Eases to zero through the burst.
 */
const INTRO_LIFT_REM = 4

/**
 * The intact star's on-screen half-height as a CSS length, mirroring the fit
 * below: height-bound on wide screens, width-bound on narrow ones.
 */
export const INTRO_STAR_HALF_HEIGHT_CSS = `min(${50 / INTRO_MARGIN}vh, ${
  50 / INTRO_MARGIN / STAR_HALF_WIDTH_FRAC
}vw)`

/** The intact star's on-screen centre, as a CSS `top`. */
export const INTRO_STAR_CENTER_CSS = `calc(50% - ${INTRO_LIFT_REM}rem)`

/**
 * Settled distance. Any value frames the field — it stretches to fit — so this
 * is purely how large the nodes and dust read once everything lands.
 */
const GALAXY_Z = 20

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** Distance at which a half-width/half-height pair fits the frame. */
function fit(
  camera: PerspectiveCamera,
  aspect: number,
  halfWidth: number,
  halfHeight: number,
) {
  const t = Math.tan(MathUtils.degToRad(camera.fov) / 2)
  return Math.max(halfHeight / t, halfWidth / (t * aspect))
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)

  useFrame(() => {
    const aspect = size.width / size.height

    const introZ =
      fit(camera, aspect, STAR_RADIUS * STAR_HALF_WIDTH_FRAC, STAR_RADIUS) *
      INTRO_MARGIN

    const e = easeInOutCubic(crush.progress)
    camera.position.z = introZ + (GALAXY_Z - introZ) * e

    // Back on the axis once settled: the hub has to land on the exact centre of
    // the screen, and the field is measured from this camera.
    const remPx =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const worldPerPx =
      (2 * introZ * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / size.height
    camera.position.y = -INTRO_LIFT_REM * remPx * worldPerPx * (1 - e)
  })

  return null
}
