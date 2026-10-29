import { ChevronLeft, MapPin } from './icons'

type SoonScreenProps = {
  onBack: () => void
}

export default function SoonScreen({ onBack }: SoonScreenProps) {
  return (
    <main className="soon">
      <div className="soon__veil" aria-hidden="true" />

      <span className="soon__grain" aria-hidden="true" />

      <div className="soon__bg" aria-hidden="true">
        <span className="soon__glow" />
        <span className="soon__stars" />
      </div>

      <img
        className="soon__logo"
        src="/logo.webp"
        alt="Foxy Esfirras — A melhor escolha"
        width="480"
        height="480"
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />

      <p className="soon__eyebrow">Cardápio intergaláctico</p>

      <h1 className="soon__title">
        Sabor de outro mundo,
        <br />
        <em>pousando em breve.</em>
      </h1>

      <p className="soon__text">
        Estamos finalizando o cardápio da Foxy. Enquanto a nave abastece, volte para a entrada.
      </p>

      <button type="button" className="soon__back" onClick={onBack}>
        <ChevronLeft size={18} />
        Voltar para a entrada
      </button>

      <footer className="soon__footer">
        <MapPin size={13} />
        Escola Kennedy · Salas gêmeas · Bloco 2
      </footer>
    </main>
  )
}
