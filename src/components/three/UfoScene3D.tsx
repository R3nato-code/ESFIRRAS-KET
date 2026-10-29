import { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'

import Beam from './Beam'
import CameraRig from './CameraRig'
import Ground from './Ground'
import Lights from './Lights'
import Saucer from './Saucer'
import Stars from './Stars'
import { hullMapsFromBitmaps } from './textures'

export type Scene3DProps = {
  lite: boolean
  active: boolean
  reduced: boolean
  starCount: number
  hullBitmaps: ImageBitmap[]
  onFail: () => void
}

/* Monitor barato de frame time: se o dispositivo não sustentar o tier full,
   reduz o pixel ratio em degraus. Evita travar em telas 4K/GPU fraca. */
function AdaptiveQuality({ enabled }: { enabled: boolean }) {
  const gl = useThree((state) => state.gl)
  const warmup = useRef(0)
  const samples = useRef(0)
  const total = useRef(0)
  const steps = useRef(0)

  useFrame((_, delta) => {
    if (!enabled || steps.current >= 2) return

    /* Ignora os primeiros frames: compilação de shader e upload de textura
       geram picos que fariam a cena baixar qualidade sem necessidade. */
    if (warmup.current < 30) {
      warmup.current += 1
      return
    }

    samples.current += 1
    total.current += Math.min(delta, 0.1)

    if (samples.current >= 50) {
      const average = total.current / samples.current
      if (average > 0.021) {
        gl.setPixelRatio(Math.max(1, gl.getPixelRatio() - 0.35))
        steps.current += 1
      }
      samples.current = 0
      total.current = 0
    }
  })

  return null
}

/* Wrapper que faz a nave descer suavemente e pousar sobre as esfirras.
   Não toca no Saucer nem em nenhum outro componente interno. */
function LandingGear({ active, reduced }: { active: boolean; reduced: boolean }) {
  const start = useRef<number | null>(null)
  const landed = useRef(false)

  useFrame((state) => {
    if (!active || reduced) return

    const time = state.clock.elapsedTime
    if (start.current === null) start.current = time

    /* Descida leva ~2.2s, começando após 0.6s de delay */
    const t = Math.min(Math.max((time - start.current - 0.6) / 2.2, 0), 1)
    const eased = 1 - Math.pow(1 - t, 3) /* ease-out cubico */

    if (eased >= 0.999) landed.current = true

    const group = state.scene.children.find(
      (child) => child.userData?.isLandingGear
    )
    if (group) {
      /* position.y inicial da nave é 1.1; desce até 0.28 (sobre as esfirras) */
      group.position.y = 1.1 - eased * 0.82
      /* Leve inclinação de pouso */
      group.rotation.z = eased * 0.03
    }
  })

  return null
}

export default function UfoScene3D({
  lite,
  active,
  reduced,
  starCount,
  hullBitmaps,
  onFail,
}: Scene3DProps) {
  const hullMaps = useMemo(
    () => hullMapsFromBitmaps(hullBitmaps, lite ? 2 : 8),
    [hullBitmaps, lite],
  )

  return (
    <Canvas
      className="ufo-canvas"
      frameloop={reduced ? 'demand' : active ? 'always' : 'never'}
      dpr={lite ? 1 : 1.25}
      shadows={false}
      camera={{ fov: 34, near: 0.1, far: 40, position: [0, 0.62, 8] }}
      gl={{
        antialias: !lite,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping
        gl.toneMappingExposure = 1.12
        gl.setClearColor(0x000000, 0)

        gl.domElement.addEventListener(
          'webglcontextlost',
          (event) => {
            event.preventDefault()
            onFail()
          },
          { once: true },
        )
      }}
    >
      <CameraRig />
      <fog attach="fog" args={['#140804', 10, 20]} />

      <Lights lite={lite} />
      <Stars count={starCount} />
      <Ground lite={lite} />

      {/* Grupo que pousa a nave sobre as esfirras (sem mexer no Saucer) */}
      <group userData={{ isLandingGear: true }}>
        <Saucer lite={lite} reduced={reduced} hullMaps={hullMaps} />
        <Beam lite={lite} reduced={reduced} />
      </group>

      <LandingGear active={active} reduced={reduced} />

      <AdaptiveQuality enabled={!lite && !reduced} />
    </Canvas>
  )
}
