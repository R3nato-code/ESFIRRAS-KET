import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, MathUtils, PerspectiveCamera } from 'three'
import type { Group } from 'three'

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
    if (warmup.current < 18) {
      warmup.current += 1
      return
    }

    samples.current += 1
    total.current += Math.min(delta, 0.1)

    /* Chega mais cedo (menos amostras) e com valores menores para começar
      a reduzir a resolução quando o device ainda não está entregando. */
    if (samples.current >= 24) {
      const average = total.current / samples.current
      if (average > 0.018) {
        gl.setPixelRatio(Math.max(1, gl.getPixelRatio() - 0.3))
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
function LandingGear({
  active,
  reduced,
  landingRef,
}: {
  active: boolean
  reduced: boolean
  landingRef: { current: Group | null }
}) {
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const start = useRef<number | null>(null)
  /* Altura (no mundo) em que o grupo da nave deve repousar. */
  const landY = useRef(-0.9)

  /* Sempre que a cena volta a ficar ativa, o pouso recomeça do alto. */
  useEffect(() => {
    start.current = null
  }, [active])

  /* Mede o topo real das esfirras na tela e converte para o mundo da cena,
     assim o casco repousa sobre a comida em qualquer tamanho de tela. */
  useEffect(() => {
    const measure = () => {
      const food = document.querySelector<HTMLElement>('.ufo-stage__food')
      const canvas = gl.domElement
      if (!food || !canvas) return

      const foodRect = food.getBoundingClientRect()
      const canvasRect = canvas.getBoundingClientRect()
      if (foodRect.height < 1 || canvasRect.height < 1) return

      /* O próprio SVG informa em que fração da altura fica o topo das
         esfirras — assim o pouso continua certo se a arte mudar. */
      const svg = food.querySelector<SVGSVGElement>('.ufo-food')
      const topRatio = Number(svg?.dataset.clusterTop ?? '0.548')

      const clusterTop =
        foodRect.top - canvasRect.top + foodRect.height * topRatio
      const ndcY = 1 - (clusterTop / canvasRect.height) * 2

      const cam = camera as PerspectiveCamera
      const halfHeight =
        Math.abs(cam.position.z) * Math.tan(MathUtils.degToRad(cam.fov) / 2)
      const worldTop = cam.position.y + ndcY * halfHeight

      /* 0.6 = distância do grupo da nave até a base do casco (1.1 - 0.5). */
      landY.current = worldTop - 0.6
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [camera, gl, size.width, size.height])

  useFrame((state) => {
    if (!active || reduced) return

    /* Ref direta em vez de varrer a árvore da cena a cada frame. */
    const group = landingRef.current
    if (!group) return

    const time = state.clock.elapsedTime
    if (start.current === null) start.current = time

    /* Descida leva ~2.2s, começando após 0.6s de delay. */
    const t = Math.min(Math.max((time - start.current - 0.6) / 2.2, 0), 1)
    const eased = 1 - Math.pow(1 - t, 3) /* ease-out cubico */

    group.position.y = 1.1 + (landY.current - 1.1) * eased
    group.rotation.z = eased * 0.03
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
  const landingRef = useRef<Group>(null)

  const hullMaps = useMemo(
    () => hullMapsFromBitmaps(hullBitmaps, lite ? 2 : 8),
    [hullBitmaps, lite],
  )

  return (
    <Canvas
      className="ufo-canvas"
      frameloop={reduced ? 'demand' : active ? 'always' : 'never'}
      dpr={lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.25)}
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
      <group ref={landingRef}>
        <Saucer lite={lite} reduced={reduced} hullMaps={hullMaps} />
        <Beam lite={lite} reduced={reduced} />
      </group>

      <LandingGear active={active} reduced={reduced} landingRef={landingRef} />

      <AdaptiveQuality enabled={!lite && !reduced} />
    </Canvas>
  )
}
