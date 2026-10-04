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
import { NavHelp } from './ui/NavHelp'
import { ExportList } from './ui/ExportList'
import { dustCountFor, shellCountFor, useViewport } from './ui/useViewport'
import { useBackKey } from './ui/useBackKey'
import { useStore } from './state/store'

export default function App() {
  const phase = useStore((s) => s.phase)
  const panelOpen = useStore((s) => s.selectedId !== null)
  const exportOpen = useStore((s) => s.exportOpen)
  const helpOpen = useStore((s) => s.helpOpen)
  const setHelpOpen = useStore((s) => s.setHelpOpen)
  const back = useStore((s) => s.back)
  const { coarse, width } = useViewport()
  useBackKey()

  const galaxySettled = phase === 'galaxy'
  const galaxyChrome = galaxySettled && !panelOpen && !exportOpen && !helpOpen

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
            if (phase !== 'galaxy' || exportOpen || helpOpen) return
            // R3F types this as MouseEvent; runtime is often a PointerEvent.
            const pe = e as MouseEvent & { pointerType?: string }
            if (pe.pointerType === 'mouse' && e.button !== 0) return
            // Empty space goes back — inside the field too. Stars already
            // swallow the pointer via raycast (fatter on touch), so a miss
            // means the click was not near a floating node.
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
        <NavHelp />

        {/* Bottom-right chrome: help (?), plus touch back. */}
        {galaxyChrome && (
          <div
            style={{
              position: 'fixed',
              right: 'max(1rem, env(safe-area-inset-right))',
              bottom: 'max(1rem, env(safe-area-inset-bottom))',
              zIndex: 45,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            {coarse && (
              <button
                type="button"
                onClick={() => back()}
                aria-label="Go back"
                style={{
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
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Navigation help"
              title="Navigation help"
              style={{
                margin: 0,
                width: '2.1rem',
                height: '2.1rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                background: 'rgba(0, 0, 0, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.35)',
                borderRadius: '999px',
                color: 'rgba(255, 255, 255, 0.95)',
                font: '400 0.875rem/1 var(--mono)',
                textShadow: '0 0 8px #000',
                backdropFilter: 'blur(3px)',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              ?
            </button>
          </div>
        )}
      </div>

      <ExportList />
    </>
  )
}
