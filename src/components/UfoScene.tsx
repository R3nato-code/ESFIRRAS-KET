import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Dados gerados de forma determinística (mesmo desenho em todo load) */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number) {
  let t = seed
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(20261026)
const meatRandom = mulberry32(987654)
const chocoRandom = mulberry32(314159)
const sweetRandom = mulberry32(271828)

/* ------------------------------------------------------------------ */
/*  Gradientes e padrões compartilhados                               */
/* ------------------------------------------------------------------ */

export default function EsfirrasSvg() {
  return (
    <svg
      className="ufo-scene ufo-food"
      viewBox="0 0 720 520"
      preserveAspectRatio="xMidYMax meet"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Sombra de contato sob cada esfirra */}
        <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3A1204" stopOpacity=".55" />
          <stop offset=".6" stopColor="#3A1204" stopOpacity=".22" />
          <stop offset="1" stopColor="#3A1204" stopOpacity="0" />
        </radialGradient>

        {/* Massa dourada assada */}
        <radialGradient id="crustGolden" cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFE8B5" />
          <stop offset=".35" stopColor="#F0C47C" />
          <stop offset=".65" stopColor="#D98E3B" />
          <stop offset="1" stopColor="#9C5A1F" />
        </radialGradient>

        {/* Borda da massa mais escura */}
        <radialGradient id="crustEdge" cx="50%" cy="50%" r="70%">
          <stop offset="0" stopColor="#FFE0A4" />
          <stop offset=".5" stopColor="#C9742E" />
          <stop offset="1" stopColor="#7E4312" />
        </radialGradient>

        {/* Recheio de carne */}
        <radialGradient id="meatFilling" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#7A3B1D" />
          <stop offset=".5" stopColor="#5C2E12" />
          <stop offset="1" stopColor="#3A1C0B" />
        </radialGradient>

        {/* Recheio de chocolate */}
        <radialGradient id="chocoFilling" cx="45%" cy="40%" r="70%">
          <stop offset="0" stopColor="#4A2210" />
          <stop offset=".5" stopColor="#2A1005" />
          <stop offset="1" stopColor="#120502" />
        </radialGradient>

        {/* Brilho de óleo / molho */}
        <radialGradient id="oilGloss" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".5" />
          <stop offset=".6" stopColor="#FFFFFF" stopOpacity=".1" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        {/* Luz do feixe sobre a comida */}
        <radialGradient id="beamWash" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#FFF0C4" stopOpacity=".45" />
          <stop offset=".5" stopColor="#FFC971" stopOpacity=".18" />
          <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ============================================================ */
      /*   ESFIRRA DA CARNE (esquerda, atrás)                        */
      /* ============================================================ */}
      <g className="esfirra esfirra--left" transform="translate(180 300) rotate(-5)">
        <g className="esfirra__body">
        {/* Sombra de contato */}
        <ellipse cx="95" cy="85" rx="92" ry="30" fill="url(#contactShadow)" />

        {/* Massa externa */}
        <ellipse cx="95" cy="70" rx="96" ry="72" fill="url(#crustGolden)" />
        <ellipse cx="95" cy="70" rx="86" ry="64" fill="url(#crustEdge)" opacity=".35" />

        {/* Recheio de carne moída */}
        <ellipse cx="95" cy="70" rx="78" ry="56" fill="url(#meatFilling)" />

        {/* Pedaços de carne moída */}
        <g fill="#6B3E20">
          {Array.from({ length: 28 }, (_, i) => {
            const r = meatRandom()
            const angle = r * Math.PI * 2
            const radius = Math.sqrt(meatRandom()) * 50
            const size = 2.5 + meatRandom() * 5
            return (
              <ellipse
                key={i}
                cx={95 + Math.cos(angle) * radius}
                cy={70 + Math.sin(angle) * radius * 0.7}
                rx={size}
                ry={size * 0.5}
                fill="#8C4A24"
                opacity=".85"
                transform={`rotate(${r * 180} ${95 + Math.cos(angle) * radius} ${70 + Math.sin(angle) * radius * 0.7})`}
              />
            )
          })}
        </g>

        {/* Legumes no recheio (vermelho e verde) */}
        <g>
          {Array.from({ length: 14 }, (_, i) => {
            const r = meatRandom()
            const angle = r * Math.PI * 2
            const radius = Math.sqrt(meatRandom()) * 44
            const isRed = r > 0.5
            return (
              <ellipse
                key={i}
                cx={95 + Math.cos(angle) * radius}
                cy={70 + Math.sin(angle) * radius * 0.7}
                rx={3 + meatRandom() * 3}
                ry={2 + meatRandom() * 2}
                fill={isRed ? '#C43A2A' : '#5C8E3D'}
                opacity=".9"
                transform={`rotate(${r * 180} ${95 + Math.cos(angle) * radius} ${70 + Math.sin(angle) * radius * 0.7})`}
              />
            )
          })}
        </g>

        {/* Brilho de óleo quente */}
        <ellipse
          cx={60}
          cy={40}
          rx="40"
          ry="14"
          fill="url(#oilGloss)"
          opacity=".5"
          transform="rotate(-15 60 40)"
        />

        {/* Borda ondulada da massa */}
        <ellipse
          cx="95"
          cy="70"
          rx="92"
          ry="68"
          fill="none"
          stroke="#B4611B"
          strokeOpacity=".35"
          strokeWidth="5"
          strokeDasharray="4 9"
          strokeLinecap="round"
        />
      </g>
        </g>

      {/* ============================================================ */
      /*   ESFIRRA DE CHOCOLATE COM GRANULADO (centro, frente)        */
      /* ============================================================ */}
      <g className="esfirra esfirra--center" transform="translate(360 340) rotate(1)">
        <g className="esfirra__body">
          {/* Sombra de contato */}
        <ellipse cx="105" cy="85" rx="102" ry="32" fill="url(#contactShadow)" />

        {/* Massa externa */}
        <ellipse cx="105" cy="70" rx="106" ry="78" fill="url(#crustGolden)" />
        <ellipse cx="105" cy="70" rx="96" ry="70" fill="url(#crustEdge)" opacity=".35" />

        {/* Recheio de chocolate */}
        <ellipse cx="105" cy="70" rx="88" ry="62" fill="url(#chocoFilling)" />

        {/* Granulado de chocolate (fina linha escura) */
        <g stroke="#1A0500" strokeWidth="1.5" strokeLinecap="round" opacity=".85">
          {Array.from({ length: 90 }, (_, i) => {
            const r = chocoRandom()
            const angle = r * Math.PI * 2
            const radius = Math.sqrt(chocoRandom()) * 56
            const len = 2 + chocoRandom() * 4
            return (
              <line
                key={i}
                x1={105 + Math.cos(angle) * radius}
                y1={70 + Math.sin(angle) * radius * 0.7}
                x2={105 + Math.cos(angle + 0.1) * (radius + len)}
                y2={70 + Math.sin(angle + 0.1) * (radius + len) * 0.7}
                transform={`rotate(${r * 180} ${105 + Math.cos(angle) * radius} ${70 + Math.sin(angle) * radius * 0.7})`}
              />
            )
          })}
        </g>

        {/* Brilho de chocolate derretido */}
        <ellipse
          cx={70}
          cy={45}
          rx="45"
          ry="16"
          fill="url(#oilGloss)"
          opacity=".55"
          transform="rotate(-12 70 45)"
        />

        {/* Borda ondulada */}
        <ellipse
          cx="105"
          cy="70"
          rx="102"
          ry="74"
          fill="none"
          stroke="#8C5A1F"
          strokeOpacity=".4"
          strokeWidth="4"
          strokeDasharray="5 10"
          strokeLinecap="round"
        />
      </g>
        </g>

      {/* ============================================================ */
      /*   ESFIRRA DOCE COM BALINHAS (direita, atrás)                */
      /* ============================================================ */}
      <g className="esfirra esfirra--right" transform="translate(540 300) rotate(5)">
        {/* Sombra de contato */}
        <ellipse cx="95" cy="85" rx="92" ry="30" fill="url(#contactShadow)" />

        {/* Massa externa */}
        <ellipse cx="95" cy="70" rx="96" ry="72" fill="url(#crustGolden)" />
        <ellipse cx="95" cy="70" rx="86" ry="64" fill="url(#crustEdge)" opacity=".35" />

        {/* Recheio base doce */}
        <ellipse cx="95" cy="70" rx="78" ry="56" fill="url(#chocoFilling)" opacity=".85" />

        {/* Balinhas coloridas (M&M style) */}
        <g>
          {Array.from({ length: 24 }, (_, i) => {
            const r = sweetRandom()
            const angle = r * Math.PI * 2
            const radius = Math.sqrt(sweetRandom()) * 50
            const colors = ['#2E62C9', '#D8332A', '#F2C22F', '#3E9B48', '#EF7A21', '#E8A94C']
            const c = colors[Math.floor(r * colors.length)]
            const size = 4.5 + sweetRandom() * 3
            return (
              <circle
                key={i}
                cx={95 + Math.cos(angle) * radius}
                cy={70 + Math.sin(angle) * radius * 0.7}
                r={size}
                fill={c}
                stroke="#1A0A03"
                strokeOpacity=".3"
                strokeWidth="1"
                opacity=".95"
              />
              <ellipse
                key={`h-${i}`}
                cx={95 + Math.cos(angle) * radius - size * 0.3}
                cy={70 + Math.sin(angle) * radius * 0.7 - size * 0.3}
                rx={size * 0.35}
                ry={size * 0.25}
                fill="#FFFFFF"
                opacity=".6"
                transform={`rotate(${r * 180} ${95 + Math.cos(angle) * radius} ${70 + Math.sin(angle) * radius * 0.7})`}
              />
            )
          })}
        </g>

        {/* Brilho de calda */}
        <ellipse
          cx={130}
          cy={40}
          rx="42"
          ry="14"
          fill="url(#oilGloss)"
          opacity=".5"
          transform="rotate(18 130 40)"
        />

        {/* Borda ondulada */}
        <ellipse
          cx="95"
          cy="70"
          rx="92"
          ry="68"
          fill="none"
          stroke="#9B4D11"
          strokeOpacity=".5"
          strokeWidth="3"
          strokeDasharray="4 8"
          strokeLinecap="round"
        />
      </g>

      {/* ============================================================ */
      /*   LUZ DO FEIXE SOBRE A COMIDA                                */
      /* ============================================================ */}
      <ellipse
        cx="360"
        cy="250"
        rx="260"
        ry="130"
        fill="url(#beamWash)"
        className="scene-wash"
      />
    </svg>
  )
}
