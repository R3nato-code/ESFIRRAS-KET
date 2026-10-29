import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, Group, InstancedMesh, LatheGeometry, Matrix4, Mesh, MeshStandardMaterial, Sprite, Vector2 } from 'three'
import { getGlowTexture } from './textures'
import type { HullMaps } from './textures'

type SaucerProps = {
  lite: boolean
  reduced: boolean
  hullMaps: HullMaps
}

const RIM_LIGHTS = 12

/* Nave construída por revolução (LatheGeometry): casco metálico com painéis,
   rugosidade escovada, cúpula iridescente, anéis emissivos, faróis de borda
   e beacon. Geometria e texturas 100% procedurais. */
export default function Saucer({ lite, reduced, hullMaps }: SaucerProps) {
  const group = useRef<Group>(null)
  const beacon = useRef<Mesh>(null)
  const beaconGlow = useRef<Sprite>(null)
  const rimLights = useRef<InstancedMesh>(null)
  const introStart = useRef<number | null>(null)

  const glow = getGlowTexture()

  const hull = useMemo(() => {
    const profile = [
      [0.14, -0.44],
      [0.36, -0.42],
      [0.66, -0.39],
      [0.96, -0.34],
      [1.24, -0.27],
      [1.5, -0.19],
      [1.7, -0.11],
      [1.83, -0.04],
      [1.88, 0.02],
      [1.85, 0.07],
      [1.76, 0.11],
      [1.58, 0.15],
      [1.36, 0.18],
      [1.12, 0.21],
      [0.94, 0.23],
      [0.9, 0.25],
      [0.8, 0.27],
      [0.62, 0.29],
      [0.42, 0.31],
      [0.26, 0.325],
      [0.15, 0.33],
    ].map(([x, y]) => new Vector2(x, y))

    const geometry = new LatheGeometry(profile, lite ? 64 : 96)
    geometry.computeVertexNormals()
    return geometry
  }, [lite])

  useEffect(() => () => hull.dispose(), [hull])

  useLayoutEffect(() => {
    const mesh = rimLights.current
    if (!mesh) return

    const matrix = new Matrix4()
    const color = new Color()

    for (let i = 0; i < RIM_LIGHTS; i += 1) {
      const angle = (i / RIM_LIGHTS) * Math.PI * 2
      matrix.makeTranslation(
        Math.cos(angle) * 1.58,
        0.15,
        Math.sin(angle) * 1.58,
      )
      mesh.setMatrixAt(i, matrix)
      color.set(i % 3 === 0 ? '#ffe0b0' : '#ff9a6a')
      mesh.setColorAt(i, color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [lite])

  useFrame((state) => {
    const time = reduced ? 0 : state.clock.elapsedTime

    if (introStart.current === null) introStart.current = time
    const intro = reduced
      ? 1
      : Math.min(
          Math.max((time - introStart.current) / (lite ? 1.5 : 2.4), 0),
          1,
        )
    const eased = 1 - Math.pow(1 - intro, 3)

    if (group.current) {
      group.current.position.y =
        1.1 + (1 - eased) * 2.9 + Math.sin(time * 0.9) * 0.055
      group.current.rotation.y = time * 0.07 + (1 - eased) * 0.55
      group.current.rotation.x =
        0.035 + Math.sin(time * 0.6) * 0.01 + (1 - eased) * 0.16
      group.current.rotation.z = -0.035 + Math.sin(time * 0.45) * 0.008
    }

    const pulse = 1 + Math.sin(time * 2.6) * 0.16
    beacon.current?.scale.setScalar(pulse)

    if (beaconGlow.current) {
      const scale = 0.82 + Math.sin(time * 2.6) * 0.16
      beaconGlow.current.scale.set(scale, scale, 1)
    }

    const rimMaterial = rimLights.current?.material as
      | MeshStandardMaterial
      | undefined
    if (rimMaterial) {
      rimMaterial.emissiveIntensity = 2.2 + Math.sin(time * 2.3) * 0.65
    }

  })

  return (
    <group ref={group} position={[0, 1.1, 0]}>
      {/* casco principal */}
      <mesh geometry={hull}>
        <meshPhysicalMaterial
          map={hullMaps.map}
          bumpMap={hullMaps.bumpMap}
          bumpScale={0.026}
          roughnessMap={hullMaps.roughnessMap}
          roughness={1}
          metalness={1}
          clearcoat={lite ? 0.35 : 0.9}
          clearcoatRoughness={0.18}
          envMapIntensity={lite ? 1.3 : 1.8}
        />
      </mesh>

      {/* bocal inferior escuro */}
      <mesh position={[0, -0.42, 0]} scale={[1, 0.5, 1]}>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial
          color="#14161b"
          metalness={0.9}
          roughness={0.42}
          envMapIntensity={0.7}
        />
      </mesh>

      {/* lábio metálico do aro */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.875, 0.026, 10, 96]} />
        <meshStandardMaterial
          color="#dfe5ee"
          metalness={1}
          roughness={0.2}
          envMapIntensity={1.9}
        />
      </mesh>

      {/* costuras de painel */}
      <mesh position={[0, 0.21, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.1, 0.007, 6, 96]} />
        <meshStandardMaterial color="#171a20" metalness={1} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.43, 0.007, 6, 96]} />
        <meshStandardMaterial color="#171a20" metalness={1} roughness={0.4} />
      </mesh>

      {/* faixa pintada da marca */}
      <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.815, 0.05, 12, 96]} />
        <meshStandardMaterial
          color="#8d1b06"
          metalness={0.72}
          roughness={0.34}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* anel emissivo inferior */}
      <mesh position={[0, -0.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.58, 0.05, 9, 56]} />
        <meshStandardMaterial
          color="#3a1405"
          emissive="#ffe0a0"
          emissiveIntensity={3.2}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>

      {/* base da cúpula */}
      <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.785, 0.032, 9, 56]} />
        <meshStandardMaterial
          color="#e4e9f2"
          metalness={1}
          roughness={0.22}
          envMapIntensity={1.8}
        />
      </mesh>

      {/* cúpula de vidro */}
      <mesh position={[0, 0.26, 0]} scale={[1, 0.92, 1]}>
        <sphereGeometry args={[0.8, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color="#bcd8ee"
          transparent
          opacity={0.2}
          roughness={0.06}
          metalness={0}
          envMapIntensity={1.6}
          clearcoat={1}
          clearcoatRoughness={0.05}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* núcleo luminoso dentro da cúpula */}
      <mesh position={[0, 0.54, 0]}>
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshStandardMaterial
          color="#3a1a05"
          emissive="#ffcf7a"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <sprite position={[0, 0.54, 0]} scale={[1.2, 1.2, 1]}>
        <spriteMaterial
          map={glow}
          color="#ffcf7a"
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {/* halo do emissor sob a nave */}
      <sprite position={[0, -0.46, 0]} scale={[2.7, 2.7, 1]}>
        <spriteMaterial
          map={glow}
          color="#ffd48a"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

      {/* faróis na borda do casco */}
      <instancedMesh ref={rimLights} args={[undefined, undefined, RIM_LIGHTS]}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial
          color="#2a0e04"
          emissive="#ffc98a"
          emissiveIntensity={2.6}
          roughness={0.4}
          toneMapped={false}
        />
      </instancedMesh>

      {/* antena + beacon no topo */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.008, 0.014, 0.18, 8]} />
        <meshStandardMaterial
          color="#d7dae0"
          metalness={1}
          roughness={0.3}
          envMapIntensity={1.4}
        />
      </mesh>
      <mesh ref={beacon} position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.09, 16, 12]} />
        <meshStandardMaterial
          color="#3a0d05"
          emissive="#ff5a3c"
          emissiveIntensity={4}
          toneMapped={false}
        />
      </mesh>
      <sprite ref={beaconGlow} position={[0, 1.2, 0]} scale={[0.9, 0.9, 1]}>
        <spriteMaterial
          map={glow}
          color="#ff6a45"
          transparent
          opacity={0.42}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </sprite>

    </group>
  )
}
