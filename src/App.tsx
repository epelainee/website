import { Canvas } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Halftone } from './scene/HalftonePass'
import { Galaxy } from './scene/Galaxy'
import { Core } from './scene/Core'
import { CameraRig, INTRO_Z } from './scene/CameraRig'
import { DetailPanel } from './ui/DetailPanel'
import { NavRing } from './ui/NavRing'
import { HubHotspot } from './ui/HubHotspot'
import { EmptyRipple } from './ui/EmptyRipple'
import { spawnEmptyRipple } from './ui/emptyRippleBus'
import { NamePlate } from './ui/NamePlate'
import { SocialLinks } from './ui/SocialLinks'
import { LocalClock } from './ui/LocalClock'
import { GalaxySearch } from './ui/GalaxySearch'
import { ExportList } from './ui/ExportList'
import { dustCountFor, shellCountFor, useViewport } from './ui/useViewport'
import { useBackKey } from './ui/useBackKey'
import { CRUSH_DURATION, useStore } from './state/store'
import { isInsideGalaxyField } from './scene/galaxyLayout'

/** Map a client point on the canvas to NDC (−1…1, y up). */
function clientToNdc(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -(((clientY - rect.top) / rect.height) * 2 - 1)
  return { x, y }
}

export default function App() {
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => s.selectedId !== null)
  const exportOpen = useStore((s) => s.exportOpen)
  const back = useStore((s) => s.back)
  const { coarse, width, compact } = useViewport()
  useBackKey()

  const galaxySettled = phase === 'galaxy'
  const galaxyChrome = galaxySettled && !panelOpen && !exportOpen

  return (
    <>
      <div className="app-no-print">
        <Canvas
          camera={{ position: [0, 0, INTRO_Z], fov: 32 }}
          gl={{ antialias: false }}
          // Cap DPR at 1.5 rather than 2: the halftone runs per output pixel, and
          // phones pay for a 3x buffer they cannot show the detail of anyway.
          dpr={[1, coarse ? 1.5 : 2]}
          onPointerMissed={(e) => {
            spawnEmptyRipple(e.clientX, e.clientY)
            if (phase !== 'galaxy' || exportOpen) return
            // R3F types this as MouseEvent; runtime is often a PointerEvent.
            const pe = e as MouseEvent & { pointerType?: string }
            if (pe.pointerType === 'mouse' && e.button !== 0) return
            // Only leave / step back outside the oval — gaps between stars
            // must not count as "outside" (especially on touch).
            const canvas =
              document.querySelector('.app-no-print canvas') ??
              document.querySelector('canvas')
            if (!(canvas instanceof HTMLCanvasElement)) return
            const { x, y } = clientToNdc(
              e.clientX,
              e.clientY,
              canvas.getBoundingClientRect(),
            )
            if (isInsideGalaxyField(x, y)) return
            back()
          }}
        >
          <color attach="background" args={['#000000']} />
          <CameraRig />
          <Galaxy
            dustCount={dustCountFor(width)}
            shellCount={shellCountFor(width)}
            touch={coarse}
          />
          <Core />
          <EffectComposer multisampling={0}>
            <Halftone cellSize={5} />
          </EffectComposer>
        </Canvas>

        <EmptyRipple />
        <HubHotspot />
        <NavRing />
        <DetailPanel />
        <NamePlate />
        <SocialLinks />
        <LocalClock />
        <GalaxySearch />

        {/* Intro copyright (wide). Dematerialises with the burst. */}
        {!compact && (
          <p
            aria-hidden={phase !== 'intro'}
            style={{
              position: 'fixed',
              right: 'max(1.25rem, env(safe-area-inset-right))',
              bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
              zIndex: 20,
              margin: 0,
              pointerEvents: 'none',
              font: '400 0.5625rem/1 var(--mono)',
              letterSpacing: '0.06em',
              color: 'rgba(255, 255, 255, 0.55)',
              textShadow: '0 0 8px #000',
              whiteSpace: 'nowrap',
              opacity: phase === 'intro' ? 1 : 0,
              filter: phase === 'intro' ? 'blur(0)' : 'blur(6px)',
              transition: [
                `opacity ${CRUSH_DURATION}s cubic-bezier(0.65, 0, 0.35, 1)`,
                `filter ${CRUSH_DURATION}s cubic-bezier(0.65, 0, 0.35, 1)`,
              ].join(', '),
            }}
          >
            ©️ 2026 Elizabeth Patricia Elaine
          </p>
        )}

        {/* Desktop keyboard hint. */}
        {galaxyChrome && !coarse && (
          <p
            aria-hidden="true"
            style={{
              position: 'fixed',
              right: 'max(1.25rem, env(safe-area-inset-right))',
              bottom: 'max(1.25rem, env(safe-area-inset-bottom))',
              zIndex: 20,
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              font: '400 0.625rem/1 var(--mono)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.88)',
              textShadow: '0 0 8px #000',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                border: '1px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '3px',
                padding: '0.25rem 0.4rem',
              }}
            >
              esc
            </span>
            back
          </p>
        )}

        {/* Touch back — same ladder as Esc (export → panel → path → intro). */}
        {galaxySettled && coarse && !exportOpen && (
          <button
            type="button"
            onClick={() => back()}
            aria-label="Go back"
            style={{
              position: 'fixed',
              right: 'max(1rem, env(safe-area-inset-right))',
              bottom: 'max(1rem, env(safe-area-inset-bottom))',
              zIndex: 45,
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.75rem',
              background: 'rgba(0, 0, 0, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
              borderRadius: '999px',
              color: 'rgba(255, 255, 255, 0.95)',
              font: '400 0.6875rem/1 var(--mono)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textShadow: '0 0 8px #000',
              backdropFilter: 'blur(3px)',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span aria-hidden="true">←</span>
            back
          </button>
        )}
      </div>

      <ExportList />
    </>
  )
}
