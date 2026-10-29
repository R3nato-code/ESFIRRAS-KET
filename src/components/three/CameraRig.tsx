import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils, PerspectiveCamera } from 'three'

const FOV = 34
const LOOK_Y = 0.62
const NEED_HEIGHT = 4.4
const NEED_WIDTH = 6.2

/* Enquadra a cena em qualquer proporção de tela e adiciona o "respiro"
   cinematográfico: dolly-in lento na entrada e deriva mínima depois. */
export default function CameraRig() {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const invalidate = useThree((state) => state.invalidate)
  const distance = useRef(8)
  const started = useRef<number | null>(null)

  useEffect(() => {
    const aspect = Math.max(size.width, 1) / Math.max(size.height, 1)
    const halfFov = MathUtils.degToRad(FOV) / 2

    /* Em telas estreitas a largura manda no enquadramento. 6.2 deixava a cena
       minúscula no meio do hero; 5.0 aproxima sem cortar a nave. */
    const needWidth = size.width < 900 ? 5.0 : NEED_WIDTH
    const distanceForHeight = NEED_HEIGHT / 2 / Math.tan(halfFov)
    const distanceForWidth =
      needWidth / 2 / (Math.tan(halfFov) * aspect)
    const next = Math.max(distanceForHeight, distanceForWidth) * 1.03

    distance.current = next
    camera.position.set(0, LOOK_Y, next)
    camera.lookAt(0, LOOK_Y, 0)

    if (camera instanceof PerspectiveCamera) {
      camera.fov = FOV
      camera.updateProjectionMatrix()
    }

    /* Necessário no frameloop="demand" (reduced motion): o resize/posição
       inicial não redesenha sozinho. */
    invalidate()
  }, [camera, invalidate, size])

  useFrame((state) => {
    const time = state.clock.elapsedTime

    if (started.current === null) started.current = time
    const intro = Math.min(Math.max((time - started.current) / 3.2, 0), 1)
    const eased = 1 - Math.pow(1 - intro, 3)

    const dolly = (1 - eased) * 0.55
    const breathe = Math.sin(time * 0.32) * 0.045

    camera.position.set(
      Math.sin(time * 0.22) * 0.055,
      LOOK_Y + Math.sin(time * 0.29) * 0.018,
      distance.current + dolly + breathe,
    )
    camera.lookAt(
      Math.sin(time * 0.18) * 0.026,
      LOOK_Y + Math.sin(time * 0.4) * 0.009,
      0,
    )
  })

  return null
}
