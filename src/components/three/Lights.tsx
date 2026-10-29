import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { BackSide, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, SphereGeometry, WebGLRenderer, WebGLRenderTarget } from 'three'

type LightsProps = {
  lite: boolean
}

/* Environment HDR gerado na hora com painéis emissivos: key quente no topo,
   rebound laranja do chão, contraluz azul e um recorte especular forte.
   É o que dá reflexos "de estúdio" no metal e no vidro sem baixar HDRI. */
function buildEnvironment(
  gl: WebGLRenderer,
): WebGLRenderTarget {
  const pmrem = new PMREMGenerator(gl)
  const env = new Scene()
  const disposables: Array<{ dispose: () => void }> = []

  const addPanel = (
    color: [number, number, number],
    position: [number, number, number],
    scale: [number, number],
    rotation: [number, number, number],
  ) => {
    const geometry = new PlaneGeometry(1, 1)
    const material = new MeshBasicMaterial({ side: DoubleSide })
    material.color.setRGB(color[0], color[1], color[2])
    const mesh = new Mesh(geometry, material)
    mesh.position.set(position[0], position[1], position[2])
    mesh.scale.set(scale[0], scale[1], 1)
    mesh.rotation.set(rotation[0], rotation[1], rotation[2])
    env.add(mesh)
    disposables.push(geometry, material)
  }

  const shellGeometry = new SphereGeometry(24, 16, 12)
  const shellMaterial = new MeshBasicMaterial({ side: BackSide })
  shellMaterial.color.setRGB(0.032, 0.016, 0.008)
  const shell = new Mesh(shellGeometry, shellMaterial)
  env.add(shell)
  disposables.push(shellGeometry, shellMaterial)

  /* softbox quente principal */
  addPanel([5.4, 3.7, 2.1], [0, 11, 1], [16, 16], [Math.PI / 2, 0, 0])
  /* recorte especular pequeno e muito claro */
  addPanel([8.5, 7.4, 5.8], [0, 8, -9], [2.4, 9], [0, 0, 0])
  /* rebatida laranja da cratera */
  addPanel([1.15, 0.3, 0.07], [0, -9, 0], [16, 16], [-Math.PI / 2, 0, 0])
  /* contraluz azul frio */
  addPanel([0.38, 0.82, 2.3], [-11, 3, -2], [7, 7], [0, Math.PI / 2, 0])
  /* warm rim lateral */
  addPanel([2.7, 0.95, 0.24], [11, 2.5, 2], [7, 7], [0, -Math.PI / 2, 0])
  /* faixa quente baixa, reflexo do feixe */
  addPanel([1.7, 0.75, 0.24], [7, 0.6, -6], [3, 5], [0, -Math.PI / 4, 0])

  const target = pmrem.fromScene(env, 0.035)
  pmrem.dispose()
  disposables.forEach((item) => item.dispose())
  return target
}

/* Iluminação de estúdio cinematográfico: key quente com sombra suave, rim
   frio, luz prática do emissor e ambiente reflexivo procedural. */
export default function Lights({ lite }: LightsProps) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)

  useEffect(() => {
    const target = buildEnvironment(gl)
    scene.environment = target.texture
    scene.environmentIntensity = 1.05
    scene.environmentRotation.set(0.18, 0.35, 0)

    return () => {
      scene.environment = null
      target.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <hemisphereLight args={['#7d8dff', '#2a0e04', 0.34]} />

      {/* Sem shadow map: a comida agora é 2D e não há receiver 3D.
          A sombra de contato vem do SVG e da poça CSS. */}
      <directionalLight
        position={[4.8, 6.4, 3.6]}
        intensity={3.1}
        color="#ffd6a2"
      />

      <directionalLight
        position={[-5.2, 3.2, -4.4]}
        intensity={1.9}
        color="#7fb0ff"
      />

      <pointLight
        position={[0, 0.62, 0.15]}
        intensity={lite ? 6.5 : 11}
        distance={5.5}
        decay={2}
        color="#ffe0a0"
      />

      <pointLight
        position={[0, 1.95, -0.2]}
        intensity={lite ? 2 : 3.2}
        distance={3.6}
        decay={2}
        color="#ff6a45"
      />
    </>
  )
}
