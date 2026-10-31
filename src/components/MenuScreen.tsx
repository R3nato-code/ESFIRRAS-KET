import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { categoryLabels, menu, type MenuCategory } from '../data/menu'
import OrderSection from './OrderSection'
import ShowcaseSection from './ShowcaseSection'
import { ChevronLeft, Instagram, Sparkle } from './icons'

type MenuScreenProps = {
  onBack: () => void
}

type Filter = 'todos' | MenuCategory

const filters: { id: Filter; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'salgadas', label: 'Salgadas' },
  { id: 'doces', label: 'Doces' },
]

const sections = [
  { id: 'destaques', label: 'O que tem' },
  { id: 'cardapio', label: 'Cardápio' },
  { id: 'encomendar', label: 'Encomendar' },
]

const marqueeItems = [
  'A melhor escolha',
  'Sabor de outro mundo',
  'Esfirras artesanais',
  'Feitas na hora',
]

export default function MenuScreen({ onBack }: MenuScreenProps) {
  const [filter, setFilter] = useState<Filter>('todos')
  const [activeSection, setActiveSection] = useState('destaques')
  const gridRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const visible = filter === 'todos' ? menu : menu.filter((item) => item.category === filter)

  /* Atualiza o link ativo conforme a seção cruza o terço superior da tela. */
  useEffect(() => {
    const update = () => {
      const marker = window.scrollY + window.innerHeight * 0.34
      let current = sections[0].id

      for (const section of sections) {
        const element = document.getElementById(section.id)
        if (!element) continue
        if (element.getBoundingClientRect().top + window.scrollY <= marker) {
          current = section.id
        }
      }

      setActiveSection(current)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)

    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  /* Página nova: começa no topo e move o foco para o título (leitores de tela). */
  useEffect(() => {
    window.scrollTo(0, 0)
    const timer = window.setTimeout(
      () => headingRef.current?.focus({ preventScroll: true }),
      120,
    )
    return () => window.clearTimeout(timer)
  }, [])

  /* Revelação dos pratos conforme entram na viewport. O estado inicial
     "escondido" só é aplicado via JS, então o conteúdo continua visível
     caso o observer não rode. */
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-dish]'))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    grid.dataset.reveal = 'on'

    if (reduced || typeof IntersectionObserver === 'undefined') {
      cards.forEach((card) => card.classList.add('is-in'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -6% 0px' },
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [filter])

  return (
    <main className="menu">
      <span className="menu__grain" aria-hidden="true" />

      <div className="menu__bg" aria-hidden="true">
        <span className="menu__glow" />
        <span className="menu__stars" />
        <span className="menu__orbit menu__orbit--a" />
        <span className="menu__orbit menu__orbit--b" />
      </div>

      <header className="menu__bar">
        <div className="menu__brand">
          <img
            className="menu__brand-logo"
            src="/logo.webp"
            alt=""
            width="480"
            height="480"
            decoding="async"
          />
          <span className="menu__brand-text">
            <strong>Foxy</strong>
            <span>Esfirras</span>
          </span>
        </div>

        <nav className="menu__nav" aria-label="Seções da página">
          {sections.map((section) => (
            <a
              key={section.id}
              className={`menu__nav-link${activeSection === section.id ? ' is-active' : ''}`}
              href={`#${section.id}`}
              aria-current={activeSection === section.id ? 'location' : undefined}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="menu__bar-actions">
          <a
            className="menu__ig"
            href="https://www.instagram.com/foxy.esfihas_pg/"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram da Foxy Esfirras"
          >
            <Instagram size={15} />
            <span>@foxy.esfihas_pg</span>
          </a>

          <button
            type="button"
            className="menu__back"
            onClick={onBack}
            aria-label="Voltar para a entrada"
          >
            <ChevronLeft size={17} />
            <span>Entrada</span>
          </button>
        </div>
      </header>

      <div className="menu__inner">
        <header className="menu__hero">
          <p className="menu__eyebrow">
            <Sparkle size={13} className="menu__eyebrow-star" />
            Cardápio intergaláctico
          </p>

          <h1 ref={headingRef} tabIndex={-1} className="menu__title">
            <span className="menu__title-main">Sabores</span>
            <svg
              className="menu__title-scribble"
              viewBox="0 0 420 26"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M6 17C90 8 214 6 414 12" />
              <path d="M34 23c104-7 218-7 360-2" />
            </svg>
            <span className="menu__title-sub">de outro mundo</span>
          </h1>

          <p className="menu__lede">
            Esfirras artesanais assadas na hora. Escolha entre as salgadas e as doces —
            todas com sabor de outro mundo.
          </p>

          <ul className="menu__facts">
            <li>
              <span>{menu.length}</span> sabores
            </li>
            <li>
              <span>2</span> categorias
            </li>
            <li>
              <span>100%</span> artesanal
            </li>
          </ul>
        </header>

        <div className="menu__marquee" aria-hidden="true">
          <div className="menu__marquee-track">
            {[0, 1].map((copy) => (
              <div className="menu__marquee-group" key={copy}>
                {marqueeItems.map((text) => (
                  <span className="menu__marquee-item" key={`${copy}-${text}`}>
                    {text}
                    <Sparkle size={11} className="menu__marquee-star" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <ShowcaseSection />

        <section id="cardapio" className="menu__section" aria-labelledby="cardapio-title">
          <div className="menu__section-head">
            <div className="menu__section-copy">
              <p className="menu__section-eyebrow">O cardápio</p>
              <h2 id="cardapio-title" className="menu__section-title">
                Escolha o seu sabor
              </h2>
            </div>

            <div className="menu__filters" role="group" aria-label="Filtrar sabores">
              {filters.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`menu__filter${filter === tab.id ? ' is-active' : ''}`}
                  aria-pressed={filter === tab.id}
                  aria-controls="cardapio-grid"
                  onClick={() => setFilter(tab.id)}
                >
                  {tab.label}
                  <span className="menu__filter-count">
                    {tab.id === 'todos'
                      ? menu.length
                      : menu.filter((item) => item.category === tab.id).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <p className="menu__status" role="status" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'sabor encontrado' : 'sabores encontrados'}
          </p>

          <div id="cardapio-grid" className="dish-grid" ref={gridRef} key={filter}>
            {visible.map((item, index) => (
              <article
                key={item.id}
                data-dish
                className="dish"
                style={
                  {
                    '--i': index,
                    '--accent': item.accent,
                  } as CSSProperties
                }
              >
                <div className="dish__media">
                  <span className="dish__halo" aria-hidden="true" />
                  <span className="dish__chip">{categoryLabels[item.category]}</span>
                  <img
                    className="dish__img"
                    src={item.image}
                    alt={`Esfirra de ${item.name}`}
                    width={item.width}
                    height={item.height}
                    loading={index < 3 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                  <span className="dish__shine" aria-hidden="true" />
                </div>

                <div className="dish__content">
                  <h3 className="dish__name">{item.name}</h3>
                  <p className="dish__desc">{item.description}</p>
                  <span className="dish__tag" aria-hidden="true">
                    <Sparkle size={11} />
                    Assada na hora
                  </span>
                </div>
              </article>
            ))}
          </div>

          <p className="menu__note">
            Todos os sabores são preparados na hora. Consulte a disponibilidade do dia.
          </p>
        </section>

        <OrderSection />
      </div>
    </main>
  )
}
