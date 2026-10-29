/* Pintura procedural do casco. Fica isolada aqui porque roda tanto no main
   thread (fallback) quanto em um Web Worker com OffscreenCanvas — no worker
   ela não bloqueia o primeiro paint nem o carregamento da página. */

export type PaintContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D

function mulberry32(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function paintHull(
  size: number,
  color: PaintContext,
  bump: PaintContext,
  rough: PaintContext,
) {
  const random = mulberry32(778812)

  /* Base dos mapas técnicos vem primeiro: os detalhes são desenhados por cima */
  bump.fillStyle = '#808080'
  bump.fillRect(0, 0, size, size)
  rough.fillStyle = '#6f6f6f'
  rough.fillRect(0, 0, size, size)

  /* v=0 (base) escuro, v=1 (topo) claro */
  const base = color.createLinearGradient(0, 0, 0, size)
  base.addColorStop(0, '#5d636d')
  base.addColorStop(0.42, '#9aa2ad')
  base.addColorStop(0.72, '#c3cad3')
  base.addColorStop(1, '#e2e7ee')
  color.fillStyle = base
  color.fillRect(0, 0, size, size)

  /* Metal escovado circular */
  for (let y = 0; y < size; y += 1) {
    const tone = 110 + Math.floor(random() * 90)
    color.fillStyle = `rgba(${tone},${tone},${tone + 6},${0.04 + random() * 0.1})`
    color.fillRect(0, y, size, 1)
  }

  /* Variação de tonalidade em grandes áreas */
  for (let i = 0; i < 24; i += 1) {
    const x = random() * size
    const y = random() * size
    const radius = 30 + random() * 120
    const patch = color.createRadialGradient(x, y, 0, x, y, radius)
    patch.addColorStop(
      0,
      random() > 0.5
        ? `rgba(255,255,255,${0.02 + random() * 0.06})`
        : `rgba(28,34,42,${0.02 + random() * 0.07})`,
    )
    patch.addColorStop(1, 'rgba(28,34,42,0)')
    color.fillStyle = patch
    color.beginPath()
    color.arc(x, y, radius, 0, Math.PI * 2)
    color.fill()
  }

  const seededRandom = mulberry32(400451)

  /* Costuras de painel: horizontais (anéis) e verticais (radiais) */
  const rings = [0.26, 0.5, 0.69, 0.84]
  rings.forEach((v) => {
    const y = v * size
    color.fillStyle = 'rgba(8,10,14,0.58)'
    color.fillRect(0, y, size, 2.5)
    color.fillStyle = 'rgba(255,255,255,0.14)'
    color.fillRect(0, y + 2.5, size, 1)
    bump.fillStyle = 'rgba(32,32,32,0.9)'
    bump.fillRect(0, y, size, 3)
    bump.fillStyle = 'rgba(210,210,210,0.7)'
    bump.fillRect(0, y + 3, size, 1.5)
    rough.fillStyle = 'rgba(196,196,196,0.8)'
    rough.fillRect(0, y, size, 3)
  })

  for (let i = 0; i < 8; i += 1) {
    const x = (i / 8) * size + 11
    color.fillStyle = 'rgba(8,10,14,0.5)'
    color.fillRect(x, 0, 2, size)
    color.fillStyle = 'rgba(255,255,255,0.12)'
    color.fillRect(x + 2, 0, 1, size)
    bump.fillStyle = 'rgba(40,40,40,0.85)'
    bump.fillRect(x, 0, 2.5, size)
    rough.fillStyle = 'rgba(190,190,190,0.7)'
    rough.fillRect(x, 0, 2.5, size)

    /* Rebites ao longo da costura */
    for (let y = 0.08; y < 0.94; y += 0.07) {
      const px = x + 1
      const py = y * size + (seededRandom() - 0.5) * 6
      color.fillStyle = 'rgba(16,18,22,0.6)'
      color.beginPath()
      color.arc(px, py, 2.6, 0, Math.PI * 2)
      color.fill()
      color.fillStyle = 'rgba(255,255,255,0.34)'
      color.beginPath()
      color.arc(px - 0.7, py - 0.8, 1.2, 0, Math.PI * 2)
      color.fill()
      bump.fillStyle = 'rgba(220,220,220,0.9)'
      bump.beginPath()
      bump.arc(px, py, 2.8, 0, Math.PI * 2)
      bump.fill()
    }
  }

  /* Arranhões e marcas de uso */
  for (let i = 0; i < 46; i += 1) {
    const x = random() * size
    const y = random() * size
    const length = 8 + random() * 60
    const angle = random() * Math.PI
    color.save()
    color.translate(x, y)
    color.rotate(angle)
    color.fillStyle = `rgba(255,255,255,${0.04 + random() * 0.14})`
    color.fillRect(0, 0, length, 0.8)
    color.restore()
  }

  /* Fuligem/desgaste perto da base e das bordas */
  for (let i = 0; i < 30; i += 1) {
    const x = random() * size
    const y = size * (0.1 + random() * 0.85)
    const radius = 12 + random() * 46
    const grime = color.createRadialGradient(x, y, 0, x, y, radius)
    grime.addColorStop(0, `rgba(40,32,28,${0.04 + random() * 0.12})`)
    grime.addColorStop(1, 'rgba(40,32,28,0)')
    color.fillStyle = grime
    color.beginPath()
    color.arc(x, y, radius, 0, Math.PI * 2)
    color.fill()

    rough.fillStyle = `rgba(215,215,215,${0.06 + random() * 0.12})`
    rough.beginPath()
    rough.arc(x, y, radius * 0.7, 0, Math.PI * 2)
    rough.fill()
  }

  /* Microrrelevo do metal */
  for (let i = 0; i < 2200; i += 1) {
    const value = 90 + Math.floor(random() * 80)
    bump.fillStyle = `rgba(${value},${value},${value},${0.05 + random() * 0.14})`
    bump.fillRect(random() * size, random() * size, 1, 1)
  }
  for (let y = 0; y < size; y += 1) {
    const tone = 92 + Math.floor(random() * 74)
    rough.fillStyle = `rgba(${tone},${tone},${tone},${0.05 + random() * 0.16})`
    rough.fillRect(0, y, size, 1)
  }
}
