import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, CylinderGeometry, DoubleSide, MeshBasicMaterial, ShaderMaterial } from 'three'

type BeamProps = {
  lite: boolean
  reduced: boolean
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uIntensity;
  uniform float uNoise;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float along = vUv.y;
    float fade =
      smoothstep(0.0, 0.16, along) *
      (0.64 + 0.36 * smoothstep(0.82, 1.0, along));
    float bands = 0.88 + 0.12 * sin(along * 26.0 - uTime * 2.1);
    float grain = 1.0 - uNoise * 0.22 * hash(
      vec2(floor(vUv.x * 72.0), floor(along * 48.0 - uTime * 2.6))
    );

    /* Silhueta do cone suavizada: a luz some nas bordas rasantes */
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float edge = 0.28 + 0.72 * pow(facing, 0.55);

    vec3 color = mix(
      uColor,
      uColor * vec3(1.06, 0.78, 0.42),
      smoothstep(0.15, 1.0, along)
    );

    gl_FragColor = vec4(
      color,
      uOpacity * uIntensity * fade * bands * grain * edge
    );
  }
`

const MOTE_VERTEX = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  attribute vec3 aSeed;
  attribute float aSize;
  attribute float aPhase;
  varying float vAlpha;

  void main() {
    float life = fract(aPhase + uTime * 0.07);
    float y = mix(-0.95, 0.98, life);
    float radius = mix(1.55, 0.32, life) * (0.25 + aSeed.y * 0.75);
    float angle = aSeed.x * 6.28318 + uTime * (0.08 + aSeed.z * 0.12);

    vec3 pos = vec3(cos(angle) * radius, y, sin(angle) * radius * 0.55);
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = aSize * (30.0 / max(0.1, -mvPosition.z));

    float fadeIn = smoothstep(0.0, 0.14, life);
    float fadeOut = 1.0 - smoothstep(0.72, 1.0, life);
    vAlpha = fadeIn * fadeOut * uIntensity;
  }
`

const MOTE_FRAGMENT = /* glsl */ `
  varying float vAlpha;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = 1.0 - smoothstep(0.08, 0.5, length(p));
    if (d <= 0.001) discard;
    gl_FragColor = vec4(vec3(1.0, 0.84, 0.58), d * vAlpha * 0.72);
  }
`

type Layer = [top: number, bottom: number, opacity: number, noise: number]

/* Duas camadas já dão o volume do cone. A terceira (halo externo bem fraco)
   custava um fullscreen extra de overdraw aditivo sem diferença visível. */
const FULL_LAYERS: Layer[] = [
  [0.46, 1.28, 0.42, 0.35],
  [0.6, 1.6, 0.2, 0.6],
]

const LITE_LAYERS: Layer[] = [
  [0.46, 1.28, 0.44, 0.3],
  [0.66, 1.74, 0.17, 0.55],
]

function mulberry32(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/* Feixe volumétrico: camadas cônicas aditivas com queda vertical, bandas
   animadas e partículas de poeira em um único draw call. Sem postprocessing. */
export default function Beam({ lite, reduced }: BeamProps) {
  const layers = lite ? LITE_LAYERS : FULL_LAYERS
  const start = useRef<number | null>(null)
  const moteMaterial = useRef<ShaderMaterial>(null)
  const coreMaterial = useRef<MeshBasicMaterial>(null)

  const materials = useMemo(
    () =>
      layers.map(([, , opacity, noise]) => {
        const material = new ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uColor: { value: new Color('#ffe0a8') },
            uOpacity: { value: opacity },
            uIntensity: { value: reduced ? 1 : 0 },
            uNoise: { value: noise },
          },
          vertexShader: VERTEX_SHADER,
          fragmentShader: FRAGMENT_SHADER,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          blending: AdditiveBlending,
        })
        material.toneMapped = false
        return material
      }),
    [layers, reduced],
  )

  const geometries = useMemo(
    () =>
      layers.map(
        ([top, bottom]) =>
          new CylinderGeometry(top, bottom, 2, lite ? 24 : 32, 1, true),
      ),
    [layers, lite],
  )

  const motes = useMemo(() => {
    const count = lite ? 22 : 48
    const random = mulberry32(90123)
    const seeds = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const phases = new Float32Array(count)

    for (let i = 0; i < count; i += 1) {
      seeds[i * 3] = random()
      seeds[i * 3 + 1] = random()
      seeds[i * 3 + 2] = random()
      sizes[i] = 0.7 + random() * 1.5
      phases[i] = random()
    }

    return { count, seeds, sizes, phases }
  }, [lite])

  const positions = useMemo(() => new Float32Array(motes.count * 3), [motes.count])

  useEffect(
    () => () => {
      materials.forEach((material) => material.dispose())
      geometries.forEach((geometry) => geometry.dispose())
    },
    [materials, geometries],
  )

  useFrame((state) => {
    if (reduced) return

    const time = state.clock.elapsedTime

    if (start.current === null) start.current = time
    const ignition = Math.min(
      Math.max((time - start.current - 0.55) / 1.25, 0),
      1,
    )
    const eased = ignition * ignition * (3 - 2 * ignition)
    const breathe = 0.92 + Math.sin(time * 1.4) * 0.08

    materials.forEach((material) => {
      material.uniforms.uTime.value = time
      material.uniforms.uIntensity.value = eased * breathe
    })

    if (moteMaterial.current) {
      moteMaterial.current.uniforms.uTime.value = time
      moteMaterial.current.uniforms.uIntensity.value = eased
    }

    if (coreMaterial.current) {
      coreMaterial.current.opacity = 0.14 * eased * breathe
    }
  })

  return (
    <group position={[0, 0.04, 0]}>
      {layers.map((layer, index) => (
        <mesh
          key={`${layer[0]}-${layer[1]}`}
          geometry={geometries[index]}
          material={materials[index]}
        />
      ))}

      {/* núcleo luminoso bem no eixo */}
      <mesh>
        <cylinderGeometry args={[0.08, 0.26, 2, 20, 1, true]} />
        <meshBasicMaterial
          ref={coreMaterial}
          color="#fff3d6"
          transparent
          opacity={reduced ? 0.14 : 0}
          depthWrite={false}
          side={DoubleSide}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* poeira iluminada subindo pelo feixe — 1 draw call */}
      <points frustumCulled={false} renderOrder={3}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[motes.seeds, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[motes.sizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[motes.phases, 1]} />
        </bufferGeometry>
        <shaderMaterial
          ref={moteMaterial}
          uniforms={{
            uTime: { value: 0 },
            uIntensity: { value: reduced ? 1 : 0 },
          }}
          vertexShader={MOTE_VERTEX}
          fragmentShader={MOTE_FRAGMENT}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}
