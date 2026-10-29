import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, DoubleSide, Mesh, MeshBasicMaterial } from 'three'
import { getGlowTexture } from './textures'

type GroundProps = {
  lite: boolean
}

/* Chão com microrrelevo procedural, sombra de contato sempre presente e
   ondas de impacto em loop. A sombra real continua por conta da luz key. */
export default function Ground({ lite }: GroundProps) {
  const glow = getGlowTexture()
  const rings = useRef<(Mesh | null)[]>([])
  const burst = useRef<Mesh>(null)
  const start = useRef<number | null>(null)

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const loop = 2.8

    rings.current.forEach((ring, index) => {
      if (!ring) return
      const phase = ((time + index * 1.35) % loop) / loop
      const scale = 0.85 + phase * 1.75
      ring.scale.setScalar(scale)
      const material = ring.material as MeshBasicMaterial
      material.opacity = (1 - phase) * 0.42
    })

    if (start.current === null) start.current = time

    /* Onda única de impacto sincronizada com o pouso da nave */
    const shock = (time - start.current - 1.15) / 1.5
    if (burst.current) {
      if (shock < 0 || shock > 1) {
        burst.current.visible = false
      } else {
        burst.current.visible = true
        burst.current.scale.setScalar(0.35 + shock * 2.9)
        const material = burst.current.material as MeshBasicMaterial
        material.opacity = (1 - shock) * 0.5
      }
    }
  })

  return (
    <group>
      {/* Sem disco de chão: a cena pousa na luz do feixe, com sombras de
         contato e brilho especular fazendo o papel de piso. Evita a borda
         dura de um "palco" flutuante em qualquer enquadramento. */}

      {/* sombra de contato difusa — ancora a nave mesmo no perfil lite */}
      <mesh
        position={[0, -1.005, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <planeGeometry args={[4.4, 2.2]} />
        <meshBasicMaterial
          map={glow}
          color="#070302"
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </mesh>

      {/* banho quente do feixe no chão */}
      <mesh
        position={[0, -1.003, 0.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[6, 3.7]} />
        <meshBasicMaterial
          map={glow}
          color="#ff9d3d"
          transparent
          opacity={0.34}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* brilho especular alongado, como piso úmido */}
      <mesh
        position={[0, -1.001, 0.18]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[7.4, 1.15]} />
        <meshBasicMaterial
          map={glow}
          color="#ffb15a"
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {Array.from({ length: lite ? 1 : 2 }).map((_, index) => (
        <mesh
          key={index}
          ref={(element) => {
            rings.current[index] = element
          }}
          position={[0, -0.994, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={3}
        >
          <ringGeometry args={[0.86, 0.9, 48]} />
          <meshBasicMaterial
            color="#ffe0a0"
            transparent
            opacity={0.42}
            depthWrite={false}
            side={DoubleSide}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      <mesh
        ref={burst}
        visible={false}
        position={[0, -0.993, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={4}
      >
        <ringGeometry args={[0.9, 0.96, 48]} />
        <meshBasicMaterial
          color="#ffd08a"
          transparent
          opacity={0}
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
