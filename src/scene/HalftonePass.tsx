import { forwardRef, useMemo } from 'react'
import { Effect } from 'postprocessing'
import { Uniform } from 'three'

/**
 * Screen-space halftone. Each grid cell samples the scene once at its own
 * centre and draws a single dot whose area tracks that sample's luminance.
 *
 * Sampling per-cell rather than per-pixel is what makes the dots read as
 * uniform discs instead of dithered noise. Anchoring the grid to fragCoord
 * (not to UV or to any object) keeps the dot lattice still while geometry
 * moves underneath it, which is what stops moving points from shimmering.
 */
const fragmentShader = /* glsl */ `
  uniform float cellSize;
  uniform float threshold;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 fragCoord = uv * resolution;

    vec2 cell = floor(fragCoord / cellSize);
    vec2 cellCentre = (cell + 0.5) * cellSize;
    vec2 sampleUv = cellCentre / resolution;

    vec3 sampled = texture2D(inputBuffer, sampleUv).rgb;
    float lum = dot(sampled, vec3(0.2126, 0.7152, 0.0722));
    lum = max(0.0, lum - threshold) / max(1e-4, 1.0 - threshold);

    // Area proportional to luminance => radius proportional to sqrt(luminance).
    // 0.72 lets the brightest cells overlap slightly so highlights read solid.
    float radius = sqrt(lum) * cellSize * 0.72;

    float dist = distance(fragCoord, cellCentre);
    float dot_ = 1.0 - smoothstep(radius - 1.0, radius + 1.0, dist);
    // The 1px edge fade would otherwise leave a grey pixel at every empty cell's centre.
    dot_ *= step(1e-4, lum);

    outputColor = vec4(vec3(dot_), 1.0);
  }
`

class HalftoneEffectImpl extends Effect {
  constructor({ cellSize = 5, threshold = 0.04 } = {}) {
    super('HalftoneEffect', fragmentShader, {
      uniforms: new Map<string, Uniform<number>>([
        ['cellSize', new Uniform(cellSize)],
        ['threshold', new Uniform(threshold)],
      ]),
    })
  }
}

type HalftoneProps = {
  /** Dot grid pitch in device pixels. Smaller = finer dots. */
  cellSize?: number
  /** Luminance below this renders as empty space. Keeps the void truly black. */
  threshold?: number
}

export const Halftone = forwardRef<HalftoneEffectImpl, HalftoneProps>(
  ({ cellSize = 5, threshold = 0.04 }, ref) => {
    const effect = useMemo(
      () => new HalftoneEffectImpl({ cellSize, threshold }),
      [cellSize, threshold],
    )
    return <primitive ref={ref} object={effect} dispose={null} />
  },
)

Halftone.displayName = 'Halftone'
