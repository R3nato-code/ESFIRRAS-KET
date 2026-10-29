/* Detecção de capacidade do dispositivo — feita uma única vez, antes de
   baixar o chunk do three. Decide entre "full" (desktop) e "lite" (mobile). */

export type SceneTier = 'full' | 'lite'

export type SceneProfile = {
  tier: SceneTier
  lite: boolean
  starCount: number
}

export function supportsWebGL2(): boolean {
  try {
    const canvas = document.createElement('canvas')
    /* failIfMajorPerformanceCaveat descarta renderização por software
       (SwiftShader/llvmpipe): nesses casos a cena 3D ficaria em 2–3 fps e o
       fallback 2D entrega uma experiência muito melhor. */
    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: true,
    })
    if (!gl) return false

    /* Alguns navegadores ignoram a flag acima quando o software rendering é
       habilitado explicitamente; o renderer revela a verdade. */
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : ''
    gl.getExtension('WEBGL_lose_context')?.loseContext()

    return !/swiftshader|llvmpipe|software|basic render/i.test(renderer)
  } catch {
    return false
  }
}

export function readSceneProfile(): SceneProfile {
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const narrow = window.innerWidth < 900
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 8

  const lite = coarse || narrow || memory <= 4 || cores <= 4

  if (lite) {
    return {
      tier: 'lite',
      lite: true,
      starCount: 56,
    }
  }

  return {
    tier: 'full',
    lite: false,
    starCount: 96,
  }
}
