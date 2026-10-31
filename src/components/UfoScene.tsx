/* ------------------------------------------------------------------ */
/*  As esfirras — ilustração vetorial autoral (sem imagem externa)     */
/*                                                                     */
/*  Composição simétrica: duas esfirras atrás e uma à frente, todas     */
/*  centradas no viewBox. A borda é uma massa ondulada de verdade      */
/*  (path com crimp), não um traço pontilhado.                         */
/* ------------------------------------------------------------------ */

type Point = [number, number]

const VIEW_W = 720
const VIEW_H = 520

/* Centro de cada esfirra (coordenadas do viewBox).
   Somados aos raios, formam um conjunto perfeitamente centralizado. */
const LEFT = { x: 222, y: 366, rx: 104, ry: 78, rotate: -6 }
const RIGHT = { x: 498, y: 366, rx: 104, ry: 78, rotate: 6 }
const FRONT = { x: 360, y: 404, rx: 118, ry: 90, rotate: -1.5 }

/* Topo real da comida em fração da altura do SVG. Lido pelo LandingGear
   para a nave pousar exatamente sobre as esfirras em qualquer tela. */
const CLUSTER_TOP = (LEFT.y - LEFT.ry * 1.035) / VIEW_H

const CANDY_COLORS = [
  '#a5612f',
  '#8f4f26',
  '#b4713b',
  '#7a3d1a',
  '#5c2a0e',
  '#c98b52',
  '#e0c39a',
]

const BEEF_COLORS = ['#a5612f', '#8f4f26', '#b4713b', '#7a3d1a', '#5c2a0e']
const SPRINKLE_COLORS = ['#3b1808', '#4f230c', '#6b3214', '#84461f']

function mulberry32(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/* Contorno de massa com crimp: raio oscilante + variação orgânica bem
   discreta para o desenho não parecer um círculo perfeito de vetor. */
function outlinePath({
  rx,
  ry,
  scallops = 34,
  depth = 0.032,
  phase = 0.7,
  wobble = 0.011,
}: {
  rx: number
  ry: number
  scallops?: number
  depth?: number
  phase?: number
  wobble?: number
}) {
  const steps = scallops * 8
  let path = ''

  for (let i = 0; i < steps; i += 1) {
    const t = (i / steps) * Math.PI * 2
    const crimp = 1 + depth * Math.cos(scallops * t + phase)
    const organic =
      1 + wobble * Math.sin(t * 3 + phase) + wobble * 0.55 * Math.cos(t * 5 + phase * 1.3)
    const x = Math.cos(t) * rx * crimp * organic
    const y = Math.sin(t) * ry * crimp * organic
    path += `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }

  return `${path}Z`
}

/* Polígono fechado com cantos suavizados — usado nos pedaços de recheio. */
function smoothClosedPath(points: Point[]) {
  const count = points.length
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const start = mid(points[count - 1], points[0])
  let d = `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`

  for (let i = 0; i < count; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % count]
    const target = mid(current, next)
    d += `Q${current[0].toFixed(1)} ${current[1].toFixed(1)} ${target[0].toFixed(1)} ${target[1].toFixed(1)}`
  }

  return `${d}Z`
}

/* ------------------------------------------------------------------ */
/*  Detalhes da superfície                                            */
/* ------------------------------------------------------------------ */

type ToppingsProps = {
  seed: number
  rx: number
  ry: number
}

function MeatToppings({ seed, rx, ry }: ToppingsProps) {
  const random = mulberry32(seed)

  const crumbles = Array.from({ length: 46 }, (_, index) => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.86
    const cx = Math.cos(angle) * rx * spread
    const cy = Math.sin(angle) * ry * spread
    const big = index < 18
    const radius = big ? 4.4 + random() * 4.2 : 2.2 + random() * 2.6
    const bite = 0.55 + random() * 0.35

    const points = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2
      const dist = radius * (0.66 + random() * 0.6)
      return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * bite * 1.05] as Point
    })

    return {
      d: smoothClosedPath(points),
      color: BEEF_COLORS[Math.floor(random() * BEEF_COLORS.length)],
      highlight: random() > 0.42,
      hx: cx - radius * 0.22,
      hy: cy - radius * 0.3,
      hr: radius * 0.46,
    }
  })

  const onions = Array.from({ length: 16 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.82
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      rx: 2 + random() * 2.4,
      rot: random() * 180,
    }
  })

  const peas = Array.from({ length: 13 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.78
    const size = 2.4 + random() * 1.6
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      size,
    }
  })

  const corn = Array.from({ length: 10 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.76
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      size: 2.2 + random() * 1.6,
      rot: random() * 180,
    }
  })

  const herbs = Array.from({ length: 42 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.86
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      size: 1 + random() * 1.2,
    }
  })

  const tomato = Array.from({ length: 13 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.68
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      size: 2.6 + random() * 2.8,
      rot: random() * 180,
    }
  })

  return (
    <>
      {/* manchas de molho para dar profundidade sob os pedaços */}
      <ellipse cx={-rx * 0.12} cy={-ry * 0.08} rx={rx * 0.66} ry={ry * 0.56} fill="#7E4018" opacity=".4" />
      <ellipse cx={rx * 0.34} cy={ry * 0.26} rx={rx * 0.4} ry={ry * 0.3} fill="#5E2A0E" opacity=".34" />
      <ellipse cx={rx * 0.08} cy={ry * 0.14} rx={rx * 0.56} ry={ry * 0.36} fill="#B6502A" opacity=".16" />

      {crumbles.map((crumb, i) => (
        <g key={`crumb-${i}`}>
          <path d={crumb.d} fill={crumb.color} />
          {crumb.highlight && (
            <ellipse
              cx={crumb.hx}
              cy={crumb.hy}
              rx={crumb.hr}
              ry={crumb.hr * 0.55}
              fill="#c98a52"
              opacity=".55"
            />
          )}
        </g>
      ))}

      {peas.map((pea, i) => (
        <g key={`pea-${i}`}>
          <circle cx={pea.x} cy={pea.y} r={pea.size} fill="#7d9847" />
          <circle cx={pea.x - pea.size * 0.3} cy={pea.y - pea.size * 0.3} r={pea.size * 0.34} fill="#c8da9a" opacity=".7" />
        </g>
      ))}

      {corn.map((kernel, i) => (
        <ellipse
          key={`corn-${i}`}
          cx={kernel.x}
          cy={kernel.y}
          rx={kernel.size}
          ry={kernel.size * 0.62}
          fill="#dba94a"
          stroke="#a4752b"
          strokeWidth=".5"
          transform={`rotate(${kernel.rot} ${kernel.x} ${kernel.y})`}
        />
      ))}

      {onions.map((onion, i) => (
        <ellipse
          key={`onion-${i}`}
          cx={onion.x}
          cy={onion.y}
          rx={onion.rx}
          ry={onion.rx * 0.34}
          fill="#f4dfb8"
          opacity=".5"
          transform={`rotate(${onion.rot} ${onion.x} ${onion.y})`}
        />
      ))}

      {tomato.map((bit, i) => (
        <g key={`tomato-${i}`}>
          <ellipse
            cx={bit.x}
            cy={bit.y}
            rx={bit.size}
            ry={bit.size * 0.6}
            fill="#c9482c"
            opacity=".85"
            transform={`rotate(${bit.rot} ${bit.x} ${bit.y})`}
          />
          <ellipse
            cx={bit.x - bit.size * 0.3}
            cy={bit.y - bit.size * 0.25}
            rx={bit.size * 0.36}
            ry={bit.size * 0.18}
            fill="#e8896a"
            opacity=".6"
            transform={`rotate(${bit.rot} ${bit.x} ${bit.y})`}
          />
        </g>
      ))}

      {herbs.map((herb, i) => (
        <circle key={`herb-${i}`} cx={herb.x} cy={herb.y} r={herb.size} fill="#3f5a22" opacity=".5" />
      ))}

      {/* brilho úmido do recheio */}
      <ellipse
        cx={-rx * 0.2}
        cy={-ry * 0.34}
        rx={rx * 0.46}
        ry={ry * 0.17}
        fill="url(#esf-gloss)"
        transform={`rotate(-13 ${-rx * 0.2} ${-ry * 0.34})`}
      />
      <ellipse
        cx={rx * 0.34}
        cy={ry * 0.24}
        rx={rx * 0.22}
        ry={ry * 0.08}
        fill="url(#esf-gloss)"
        opacity=".5"
      />
    </>
  )
}

function ChocolateToppings({ seed, rx, ry }: ToppingsProps) {
  const random = mulberry32(seed)

  const sprinkles = Array.from({ length: 170 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.9
    const cx = Math.cos(angle) * rx * spread
    const cy = Math.sin(angle) * ry * spread
    const length = 2 + random() * 2.6
    const direction = random() * Math.PI
    return {
      x1: cx,
      y1: cy,
      x2: cx + Math.cos(direction) * length,
      y2: cy + Math.sin(direction) * length,
      color: SPRINKLE_COLORS[Math.floor(random() * SPRINKLE_COLORS.length)],
      width: 1.5 + random() * 0.8,
    }
  })

  const chips = Array.from({ length: 12 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.82
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      rx: 2.6 + random() * 2.4,
      rot: random() * 180,
    }
  })

  return (
    <>
      {/* fios de chocolate derretido */}
      <g fill="none" strokeLinecap="round" opacity=".55">
        <path
          d={`M${-rx * 0.78} ${-ry * 0.2}c${rx * 0.3} ${-ry * 0.3} ${rx * 0.5} ${ry * 0.3} ${rx * 0.86} ${-ry * 0.1}`}
          stroke="#b06a3c"
          strokeWidth="9"
          opacity=".3"
        />
        <path
          d={`M${-rx * 0.72} ${-ry * 0.02}c${rx * 0.26} ${-ry * 0.34} ${rx * 0.46} ${ry * 0.28} ${rx * 0.82} ${-ry * 0.06}`}
          stroke="#8f4a20"
          strokeWidth="7"
        />
        <path
          d={`M${-rx * 0.62} ${ry * 0.34}c${rx * 0.22} ${ry * 0.22} ${rx * 0.4} ${-ry * 0.3} ${rx * 0.76} ${ry * 0.08}`}
          stroke="#3A160A"
          strokeWidth="4.5"
        />
        <path
          d={`M${-rx * 0.6} ${ry * 0.32}c${rx * 0.22} ${ry * 0.21} ${rx * 0.4} ${-ry * 0.29} ${rx * 0.74} ${ry * 0.07}`}
          stroke="#C07A44"
          strokeWidth="1.2"
          opacity=".55"
        />
        <path
          d={`M${-rx * 0.4} ${-ry * 0.42}c${rx * 0.18} ${ry * 0.2} ${rx * 0.3} ${ry * 0.08} ${rx * 0.42} ${ry * 0.22}`}
          stroke="#8f4a20"
          strokeWidth="4"
          opacity=".7"
        />
      </g>

      {sprinkles.map((sprinkle, i) => (
        <line
          key={`sprinkle-${i}`}
          x1={sprinkle.x1}
          y1={sprinkle.y1}
          x2={sprinkle.x2}
          y2={sprinkle.y2}
          stroke={sprinkle.color}
          strokeWidth={sprinkle.width}
          strokeLinecap="round"
          opacity=".92"
        />
      ))}

      {chips.map((chip, i) => (
        <g key={`chip-${i}`}>
          <ellipse
            cx={chip.x}
            cy={chip.y}
            rx={chip.rx}
            ry={chip.rx * 0.68}
            fill="#451d0a"
            stroke="#1c0702"
            strokeWidth=".6"
            transform={`rotate(${chip.rot} ${chip.x} ${chip.y})`}
          />
          <ellipse
            cx={chip.x - chip.rx * 0.28}
            cy={chip.y - chip.rx * 0.26}
            rx={chip.rx * 0.4}
            ry={chip.rx * 0.24}
            fill="#9a6135"
            opacity=".55"
            transform={`rotate(${chip.rot} ${chip.x} ${chip.y})`}
          />
        </g>
      ))}

      {/* brilho amplo da superfície (chocolate derretido) */}
      <ellipse
        cx={rx * 0.18}
        cy={-ry * 0.02}
        rx={rx * 0.62}
        ry={ry * 0.42}
        fill="url(#esf-gloss)"
        opacity=".22"
      />

      <ellipse
        cx={-rx * 0.18}
        cy={-ry * 0.36}
        rx={rx * 0.44}
        ry={ry * 0.15}
        fill="url(#esf-gloss)"
        transform={`rotate(-11 ${-rx * 0.18} ${-ry * 0.36})`}
      />
      <ellipse cx={rx * 0.38} cy={ry * 0.3} rx={rx * 0.16} ry={ry * 0.06} fill="url(#esf-gloss)" opacity=".45" />
    </>
  )
}

function CandyToppings({ seed, rx, ry }: ToppingsProps) {
  const random = mulberry32(seed)

  const candies = Array.from({ length: 24 }, () => {
    const angle = random() * Math.PI * 2
    const spread = Math.sqrt(random()) * 0.86
    return {
      x: Math.cos(angle) * rx * spread,
      y: Math.sin(angle) * ry * spread,
      size: 3.6 + random() * 3.2,
      color: CANDY_COLORS[Math.floor(random() * CANDY_COLORS.length)],
    }
  })

  return (
    <>
      {/* fios de calda por baixo dos confeitos */}
      <g fill="none" strokeLinecap="round" opacity=".4">
        <path
          d={`M${-rx * 0.7} ${-ry * 0.18}c${rx * 0.24} ${ry * 0.28} ${rx * 0.5} ${-ry * 0.3} ${rx * 0.82} ${ry * 0.04}`}
          stroke="#7a3f18"
          strokeWidth="6"
        />
        <path
          d={`M${-rx * 0.5} ${ry * 0.34}c${rx * 0.2} ${-ry * 0.24} ${rx * 0.44} ${ry * 0.22} ${rx * 0.68} ${-ry * 0.12}`}
          stroke="#8f4a20"
          strokeWidth="4.5"
        />
      </g>

      {candies.map((candy, i) => (
        <g key={`candy-${i}`}>
          <ellipse
            cx={candy.x}
            cy={candy.y + candy.size * 0.35}
            rx={candy.size * 1.02}
            ry={candy.size * 0.86}
            fill="#4a210b"
            opacity=".28"
          />
          <circle cx={candy.x} cy={candy.y} r={candy.size} fill={candy.color} />
          <circle
            cx={candy.x}
            cy={candy.y}
            r={candy.size}
            fill="none"
            stroke="#2a1005"
            strokeOpacity=".35"
            strokeWidth=".8"
          />
          <ellipse
            cx={candy.x - candy.size * 0.32}
            cy={candy.y - candy.size * 0.34}
            rx={candy.size * 0.38}
            ry={candy.size * 0.26}
            fill="#ffffff"
            opacity=".55"
          />
        </g>
      ))}

      {/* confeitos miúdos de baunilha */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = random() * Math.PI * 2
        const spread = Math.sqrt(random()) * 0.9
        return (
          <circle
            key={`crumb-${i}`}
            cx={Math.cos(angle) * rx * spread}
            cy={Math.sin(angle) * ry * spread}
            r={0.9 + random() * 0.9}
            fill="#FFF6E4"
            opacity=".75"
          />
        )
      })}

      <ellipse
        cx={-rx * 0.24}
        cy={-ry * 0.34}
        rx={rx * 0.36}
        ry={ry * 0.11}
        fill="url(#esf-gloss)"
        opacity=".6"
        transform={`rotate(-10 ${-rx * 0.24} ${-ry * 0.34})`}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Uma esfirra                                                       */
/* ------------------------------------------------------------------ */

type PastryProps = {
  id: string
  x: number
  y: number
  rx: number
  ry: number
  rotate?: number
  className?: string
  seed: number
  phase?: number
  filling: 'meat' | 'choco' | 'candy'
}

function Pastry({
  id,
  x,
  y,
  rx,
  ry,
  rotate = 0,
  className = '',
  seed,
  phase = 0.7,
  filling,
}: PastryProps) {
  const crustPath = outlinePath({ rx, ry, scallops: 52, depth: 0.014, phase })
  const innerPath = outlinePath({
    rx: rx * 0.885,
    ry: ry * 0.87,
    scallops: 52,
    depth: 0.009,
    phase: phase + 0.2,
  })
  const fillRx = rx * 0.845
  const fillRy = ry * 0.815
  const fillingPath = outlinePath({
    rx: fillRx,
    ry: fillRy,
    scallops: 32,
    depth: 0.007,
    phase: phase + 0.4,
  })

  const crustRandom = mulberry32(seed + 7)
  const toasted = Array.from({ length: 42 }, () => {
    const angle = crustRandom() * Math.PI * 2
    const band = 0.872 + crustRandom() * 0.112
    const size = 1.6 + crustRandom() * 3.4
    return {
      x: Math.cos(angle) * rx * band,
      y: Math.sin(angle) * ry * band,
      rx: size,
      ry: size * (0.5 + crustRandom() * 0.35),
      rot: (angle * 180) / Math.PI + 90,
      tone: crustRandom(),
    }
  })

  const pleats = Array.from({ length: 52 }, (_, i) => {
    const angle = (i / 52) * Math.PI * 2 + phase * 0.1
    return {
      x1: Math.cos(angle) * rx * 0.918,
      y1: Math.sin(angle) * ry * 0.918,
      x2: Math.cos(angle) * rx * 1.006,
      y2: Math.sin(angle) * ry * 1.006,
    }
  })

  const Toppings =
    filling === 'meat' ? MeatToppings : filling === 'choco' ? ChocolateToppings : CandyToppings

  return (
    <g className={className} transform={`translate(${x} ${y}) rotate(${rotate})`}>
      {/* sombra de contato fixa: não acompanha o "squash" da massa */}
      <ellipse cx={0} cy={ry * 0.64 + 14} rx={rx * 1.01} ry={ry * 0.35} fill="url(#esf-shadow)" />

      <g className="esfirra__body">
        <defs>
          <clipPath id={`${id}-crust`}>
            <path d={crustPath} />
          </clipPath>
          <clipPath id={`${id}-fill`}>
            <path d={fillingPath} />
          </clipPath>
        </defs>

        {/* parede lateral da massa (espessura) + luz refletida embaixo */}
        <path d={crustPath} transform="translate(0 15)" fill="url(#esf-wall)" />
        <path
          d={crustPath}
          transform="translate(0 15)"
          fill="none"
          stroke="#FF9A3C"
          strokeWidth="2.4"
          opacity=".16"
        />

        {/* massa assada */}
        <path d={crustPath} fill="url(#esf-gold)" />

        {/* manchas de forno + farinha, recortadas na borda */}
        <g clipPath={`url(#${id}-crust)`}>
          {toasted.map((spot, i) => (
            <ellipse
              key={`spot-${i}`}
              cx={spot.x}
              cy={spot.y}
              rx={spot.rx}
              ry={spot.ry}
              fill={spot.tone > 0.78 ? '#ffdda0' : '#6E3610'}
              opacity={spot.tone > 0.78 ? 0.22 : 0.3}
              transform={`rotate(${spot.rot} ${spot.x} ${spot.y})`}
            />
          ))}

          {/* vincos radiais do crimp */}
          {pleats.map((pleat, i) =>
            i % 2 === 0 ? (
              <line
                key={`pleat-${i}`}
                x1={pleat.x1}
                y1={pleat.y1}
                x2={pleat.x2}
                y2={pleat.y2}
                stroke="#7d4210"
                strokeWidth="1.2"
                opacity=".12"
              />
            ) : null,
          )}
        </g>

        {/* luz na borda superior + contorno de massa */}
        <path d={crustPath} fill="none" stroke="url(#esf-rim)" strokeWidth="4" opacity=".9" />
        <path d={crustPath} fill="none" stroke="#7A3D0E" strokeWidth="2" opacity=".42" />
        <path d={innerPath} fill="none" stroke="url(#esf-rim)" strokeWidth="2.2" opacity=".55" />

        {/* cova interna onde fica o recheio */}
        <path d={innerPath} fill="url(#esf-well)" />
        <path d={innerPath} fill="none" stroke="#4a2409" strokeWidth="1.4" opacity=".28" />

        {/* recheio */}
        <path d={fillingPath} fill={`url(#esf-${filling})`} />

        <g clipPath={`url(#${id}-fill)`}>
          <Toppings seed={seed} rx={fillRx} ry={fillRy} />
        </g>

        <path d={fillingPath} fill="none" stroke="#2a0f03" strokeWidth="1.6" opacity=".22" />
      </g>
    </g>
  )
}

/* ------------------------------------------------------------------ */
/*  Cena                                                              */
/* ------------------------------------------------------------------ */

export default function EsfirrasSvg() {
  return (
    <svg
      className="ufo-scene ufo-food"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMax meet"
      data-cluster-top={CLUSTER_TOP.toFixed(4)}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* sombra de contato */}
        <radialGradient id="esf-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2A0A02" stopOpacity=".6" />
          <stop offset=".55" stopColor="#331006" stopOpacity=".28" />
          <stop offset="1" stopColor="#331006" stopOpacity="0" />
        </radialGradient>

        {/* sombra que a esfirra da frente projeta nas de trás */}
        <radialGradient id="esf-cast" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2A0A02" stopOpacity=".5" />
          <stop offset=".6" stopColor="#2A0A02" stopOpacity=".22" />
          <stop offset="1" stopColor="#2A0A02" stopOpacity="0" />
        </radialGradient>

        {/* massa dourada: luz vindo de cima/esquerda */}
        <radialGradient id="esf-gold" cx="36%" cy="24%" r="88%">
          <stop offset="0" stopColor="#FFD98A" />
          <stop offset=".22" stopColor="#F5C470" />
          <stop offset=".5" stopColor="#E0A34C" />
          <stop offset=".75" stopColor="#C17F2C" />
          <stop offset="1" stopColor="#8A4E15" />
        </radialGradient>

        {/* detalhe da massa: manchas de forno e farinha */}
        <radialGradient id="esf-toast" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#6E3610" stopOpacity=".55" />
          <stop offset=".65" stopColor="#6E3610" stopOpacity=".25" />
          <stop offset="1" stopColor="#6E3610" stopOpacity="0" />
        </radialGradient>

        {/* espessura da massa */}
        <linearGradient id="esf-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9C5A21" />
          <stop offset=".55" stopColor="#7A3F12" />
          <stop offset="1" stopColor="#5B2B09" />
        </linearGradient>

        {/* luz da borda superior (ovo pincelado, não branco) */}
        <linearGradient id="esf-rim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE0A0" stopOpacity=".85" />
          <stop offset=".45" stopColor="#FFC978" stopOpacity=".3" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </linearGradient>

        {/* parede interna da cova: escura em cima, iluminada embaixo */}
        <linearGradient id="esf-well" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5A2C0C" />
          <stop offset=".42" stopColor="#8F4F1E" />
          <stop offset="1" stopColor="#C98F4A" />
        </linearGradient>

        {/* recheios */}
        <radialGradient id="esf-meat" cx="42%" cy="30%" r="80%">
          <stop offset="0" stopColor="#B75A2E" />
          <stop offset=".45" stopColor="#8A3D19" />
          <stop offset="1" stopColor="#411708" />
        </radialGradient>

        <radialGradient id="esf-choco" cx="40%" cy="26%" r="82%">
          <stop offset="0" stopColor="#9A5A32" />
          <stop offset=".42" stopColor="#66310F" />
          <stop offset="1" stopColor="#2A0F04" />
        </radialGradient>

        {/* salgada: recheio dourado de forno, no lugar do rosa */}
        <radialGradient id="esf-candy" cx="42%" cy="28%" r="82%">
          <stop offset="0" stopColor="#C87945" />
          <stop offset=".48" stopColor="#925026" />
          <stop offset="1" stopColor="#4A1F0B" />
        </radialGradient>

        {/* brilho especular */}
        <radialGradient id="esf-gloss" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".55" />
          <stop offset=".55" stopColor="#FFFFFF" stopOpacity=".16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* luz do feixe sobre a comida */}
        <radialGradient id="esf-beam" cx="50%" cy="38%" r="60%">
          <stop offset="0" stopColor="#FFF0C4" stopOpacity=".38" />
          <stop offset=".5" stopColor="#FFC971" stopOpacity=".14" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>

        {/* vapor: some nas pontas para não parecer um traço */}
        <linearGradient id="esf-steam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFEFC8" stopOpacity="0" />
          <stop offset=".28" stopColor="#FFEFC8" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFEFC8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* atrás: carne (esquerda) e doce (direita) */}
      <Pastry
        id="esf-left"
        className="esfirra esfirra--left"
        x={LEFT.x}
        y={LEFT.y}
        rx={LEFT.rx}
        ry={LEFT.ry}
        rotate={LEFT.rotate}
        seed={987654}
        phase={0.35}
        filling="meat"
      />

      <Pastry
        id="esf-right"
        className="esfirra esfirra--right"
        x={RIGHT.x}
        y={RIGHT.y}
        rx={RIGHT.rx}
        ry={RIGHT.ry}
        rotate={RIGHT.rotate}
        seed={314159}
        phase={1.45}
        filling="candy"
      />

      {/* vapor saindo das esfirras de trás */}
      <g className="steam-group" aria-hidden="true">
        <path className="steam" d="M232 300c-8-14 6-22 1-36s-11-18-5-31" />
      </g>

      {/* frente: chocolate */}
      <ellipse
        cx={FRONT.x}
        cy={FRONT.y + 8}
        rx={FRONT.rx * 1.2}
        ry={FRONT.ry * 1.24}
        fill="url(#esf-cast)"
        aria-hidden="true"
      />
      <Pastry
        id="esf-front"
        className="esfirra esfirra--center"
        x={FRONT.x}
        y={FRONT.y}
        rx={FRONT.rx}
        ry={FRONT.ry}
        rotate={FRONT.rotate}
        seed={271828}
        phase={0.85}
        filling="choco"
      />

      <g className="steam-group" aria-hidden="true">
        <path className="steam steam--front" d="M374 332c-9-16 7-25 2-41s-13-21-6-38" />
      </g>

      {/* banho de luz do feixe */}
      <ellipse cx="360" cy="320" rx="300" ry="150" fill="url(#esf-beam)" className="scene-wash" />
    </svg>
  )
}
