import { useState, type CSSProperties } from 'react'
import { categoryLabels, menu } from '../data/menu'
import { ArrowRight, Sparkle } from './icons'

/* Vitrine: uma imagem grande + seletor de sabores. É a prévia visual do que
   existe, separada do cardápio completo que vem logo abaixo. */
export default function ShowcaseSection() {
  const [activeId, setActiveId] = useState(menu[0].id)
  const active = menu.find((item) => item.id === activeId) ?? menu[0]

  return (
    <section id="destaques" className="showcase" aria-labelledby="destaques-title">
      <div className="showcase__head">
        <div className="showcase__head-copy">
          <p className="showcase__eyebrow">
            <Sparkle size={12} />
            O que tem
          </p>
          <h2 id="destaques-title" className="showcase__title">
            Direto da nave
          </h2>
          <p className="showcase__lede">
            Uma passada rápida pelos sabores que saem do forno. Toque em um nome
            para ver de perto antes de escolher no cardápio.
          </p>
        </div>

        <a className="showcase__jump" href="#cardapio">
          Ver cardápio completo
          <ArrowRight size={15} />
        </a>
      </div>

      <div className="showcase__stage">
        <figure
          id="showcase-panel"
          className="showcase__frame"
          style={{ '--accent': active.accent } as CSSProperties}
          aria-live="polite"
        >
          <img
            key={active.id}
            className="showcase__img"
            src={active.image}
            alt={`Esfirra de ${active.name}`}
            width={active.width}
            height={active.height}
            loading="lazy"
            decoding="async"
          />

          <figcaption className="showcase__caption">
            <span className="showcase__chip">{categoryLabels[active.category]}</span>
            <h3 className="showcase__name">{active.name}</h3>
            <p className="showcase__desc">{active.description}</p>
          </figcaption>
        </figure>

        <div className="showcase__picker" aria-label="Prévia dos sabores">
          {menu.map((item, index) => {
            const isActive = item.id === active.id

            return (
              <button
                key={item.id}
                type="button"
                className={`showcase__option${isActive ? ' is-active' : ''}`}
                style={{ '--accent': item.accent } as CSSProperties}
                aria-pressed={isActive}
                aria-controls="showcase-panel"
                onClick={() => setActiveId(item.id)}
              >
                <span className="showcase__option-index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <img
                  className="showcase__option-img"
                  src={item.image}
                  alt=""
                  width={item.width}
                  height={item.height}
                  loading="lazy"
                  decoding="async"
                />
                <span className="showcase__option-copy">
                  <strong>{item.name}</strong>
                  <span>{categoryLabels[item.category]}</span>
                </span>
                <span className="showcase__option-dot" aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
