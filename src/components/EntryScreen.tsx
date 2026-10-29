import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import UfoSceneStage from './three/UfoSceneStage'
import { ArrowRight, MapPin, Sparkle } from './icons'

type EntryScreenProps = {
  onEnter: () => void
  hidden?: boolean
}

export default function EntryScreen({ onEnter, hidden = false }: EntryScreenProps) {
  const [leaving, setLeaving] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const exitTimer = useRef<number | undefined>(undefined)

  /* Ao trocar de tela a entrada permanece montada: zera o estado de saída
     antes de reaparecer, sem mostrar a animação de fade-out de novo. */
  useLayoutEffect(() => {
    if (!hidden) return
    window.clearTimeout(exitTimer.current)
    setLeaving(false)
  }, [hidden])

  /* O palco 3D monta junto com o hero. O antigo SVG da nave não entra mais
     na página: a comida 2D aparece na hora e a nave chega direto em 3D. */

  /* Parallax sutil — desligado em touch, na tela escondida e em quem prefere
     menos movimento */
  useEffect(() => {
    if (hidden) return

    const root = rootRef.current
    if (!root) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (reduced || coarse) return

    let frame = 0

    const handlePointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2
        const y = (event.clientY / window.innerHeight - 0.5) * 2
        root.style.setProperty('--pointer-x', x.toFixed(3))
        root.style.setProperty('--pointer-y', y.toFixed(3))
      })
    }

    const handlePointerLeave = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        root.style.setProperty('--pointer-x', '0')
        root.style.setProperty('--pointer-y', '0')
      })
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', handlePointerLeave)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', handlePointerMove)
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave)
    }
  }, [hidden])

  useEffect(() => () => window.clearTimeout(exitTimer.current), [])

  const handleEnter = () => {
    if (leaving) return
    setLeaving(true)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    exitTimer.current = window.setTimeout(onEnter, reduced ? 180 : 560)
  }

  return (
    <main
      ref={rootRef}
      className={`entry${leaving ? ' is-leaving' : ''}`}
      hidden={hidden}
    >
      {/* Grão fora do backdrop: com blend-mode ele fica abaixo das camadas
          animadas e é rasterizado uma única vez. */}
      <span className="entry__grain" aria-hidden="true" />

      <div className="entry__backdrop" aria-hidden="true">
        <span className="entry__glow" />
        <span className="entry__stars" />
        <span className="entry__grade" />
        <span className="entry__leak" />
        <span className="entry__vignette" />
      </div>

      <header className="entry__bar">
        <span className="entry__bar-item">
          <Sparkle size={13} className="entry__bar-star" />
          A melhor escolha
        </span>
        <span className="entry__bar-item entry__bar-item--pill">
          <MapPin size={13} />
          Escola Kennedy
        </span>
      </header>

      <div className="entry__logo">
        <span className="entry__logo-aura" aria-hidden="true" />
        <img
          src="/logo.webp"
          alt="Foxy Esfirras — A melhor escolha"
          width="480"
          height="480"
          fetchPriority="high"
          decoding="async"
          loading="eager"
        />
      </div>

      <div className="entry__hero">
        <h1 className="entry__headline">
          <span className="entry__headline-pre">Sabor de outro</span>
          <span className="entry__headline-main">Mundo</span>
        </h1>

        <div className="entry__scene">
          <UfoSceneStage paused={hidden || leaving} />
        </div>
      </div>

      <div className="entry__actions">
        <button
          type="button"
          className="enter-button"
          onClick={handleEnter}
          disabled={leaving}
          aria-describedby="enter-hint"
        >
          <span className="enter-button__label">Entrar</span>
          <span className="enter-button__icon" aria-hidden="true">
            <ArrowRight size={19} />
          </span>
          <span className="enter-button__shine" aria-hidden="true" />
        </button>
        <p id="enter-hint" className="entry__hint">
          O cardápio está pousando
        </p>
      </div>

      <footer className="entry__footer">
        <span>Salas gêmeas · Bloco 2</span>
        <span className="entry__footer-dot" aria-hidden="true" />
        <span>Esfirras artesanais</span>
      </footer>

      <div className="entry__flash" aria-hidden="true" />
    </main>
  )
}
