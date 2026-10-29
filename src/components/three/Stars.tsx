import { useMemo } from 'react'
import { AdditiveBlending, Color } from 'three'
import { getGlowTexture } from './textures'

function mulberry32(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

type StarsProps = {
  count: number
}

export default function Stars({ count }: StarsProps) {
  const { positions, colors } = useMemo(() => {
    const random = mulberry32(20261026)
    const positionArray = new Float32Array(count * 3)
    const colorArray = new Float32Array(count * 3)
    const warm = new Color('#ffe9c9')
    const cool = new Color('#b9d2ff')
    const mixed = new Color()

    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2
      const radius = 3.4 + random() * 4.4
      positionArray[i * 3] = Math.cos(angle) * radius
      positionArray[i * 3 + 1] = -1.4 + random() * 6.2
      positionArray[i * 3 + 2] = -1.6 - random() * 5.4

      mixed.copy(warm).lerp(cool, random() * 0.55)
      colorArray[i * 3] = mixed.r
      colorArray[i * 3 + 1] = mixed.g
      colorArray[i * 3 + 2] = mixed.b
    }

    return { positions: positionArray, colors: colorArray }
  }, [count])

  return (
    <points renderOrder={-1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getGlowTexture()}
        size={0.068}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.82}
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
