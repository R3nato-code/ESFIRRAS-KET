import {
  CanvasTexture,
  ClampToEdgeWrapping,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
} from 'three'
import type { ColorSpace, Wrapping } from 'three'

/* Este módulo só é carregado junto do chunk 3D. Os ImageBitmaps do casco já
   chegam prontos de hullBitmaps.ts (gerados em worker antes da cena montar). */

export type HullMaps = {
  map: Texture
  bumpMap: Texture
  roughnessMap: Texture
}

function makeCanvas(
  width: number,
  height = width,
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D indisponível')
  return [canvas, context]
}

function tuneTexture<T extends Texture>(
  texture: T,
  colorSpace: ColorSpace,
  anisotropy = 8,
  wrapT: Wrapping = ClampToEdgeWrapping,
) {
  texture.colorSpace = colorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = wrapT
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  return texture
}

let glowTexture: CanvasTexture | undefined

/** Halo radial branco — usado em sprites de glow e na luz do chão. */
export function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture

  const [canvas, ctx] = makeCanvas(128)
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.16, 'rgba(255,255,255,0.9)')
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.36)')
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.08)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)

  glowTexture = tuneTexture(
    new CanvasTexture(canvas),
    SRGBColorSpace,
    4,
  )
  return glowTexture
}

let hullCache:
  | { key: string; maps: HullMaps }
  | undefined

/** Converte os bitmaps em Textures. Fica em cache para remontagens da cena
    (ex.: voltar da tela "em breve") não recriarem uploads de GPU. */
export function hullMapsFromBitmaps(
  bitmaps: ImageBitmap[],
  anisotropy: number,
): HullMaps {
  const key = `${bitmaps[0]?.width ?? 0}:${anisotropy}`
  if (hullCache?.key === key) return hullCache.maps

  const [map, bumpMap, roughnessMap] = bitmaps
  const maps = {
    map: tuneTexture(new Texture(map), SRGBColorSpace, anisotropy),
    bumpMap: tuneTexture(new Texture(bumpMap), NoColorSpace, anisotropy),
    roughnessMap: tuneTexture(
      new Texture(roughnessMap),
      NoColorSpace,
      anisotropy,
    ),
  }

  hullCache = { key, maps }
  return maps
}
