import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { categoryLabels, menu } from '../data/menu'
import { Instagram, MapPin, Minus, Plus, Sparkle, Check, CheckCircle, AlertCircle, Loader2, X } from './icons'
import { db, collection, addDoc, serverTimestamp } from '../lib/firebase'
import {
  MAX_CONTACT_LENGTH,
  PAYMENT_LABELS,
  PAYMENT_OPTIONS,
  buildOrderDocument,
  isContactValid,
  sanitizeContact,
  type OrderItemSnapshot,
  type PaymentMethod,
} from '../lib/orderForm'

const MAX_PER_FLAVOR = 20

const PICKUP_LOCATION = 'Quadra do Colégio'

type OrderStatus = 'idle' | 'loading' | 'success' | 'error'

interface ConfirmedOrder {
  customerName: string
  totalItems: number
  totalAmount: number
  paymentMethod?: PaymentMethod
}

type OrderItem = OrderItemSnapshot

export default function OrderSection() {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [contactTouched, setContactTouched] = useState(false)
  const [payment, setPayment] = useState<PaymentMethod | ''>('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<OrderStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [confirmedOrder, setConfirmedOrder] = useState<ConfirmedOrder | null>(null)
  const successActionRef = useRef<HTMLButtonElement>(null)
  const successCardRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const contactInputRef = useRef<HTMLInputElement>(null)

  /* Mensagem de confirmação: foco no botão principal, Escape fecha e o Tab
     fica contido no diálogo enquanto ele está aberto. */
  useEffect(() => {
    if (!confirmedOrder) return

    successActionRef.current?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmedOrder(null)
        setStatus('idle')
        return
      }

      if (event.key !== 'Tab') return

      const card = successCardRef.current
      if (!card) return

      const focusable = Array.from(
        card.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => !element.hasAttribute('disabled'))

      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmedOrder])

  const dismissSuccess = () => {
    setConfirmedOrder(null)
    setStatus('idle')
    setStatusMessage('')
    window.requestAnimationFrame(() => nameInputRef.current?.focus({ preventScroll: true }))
  }

  const selected = menu.filter((item) => (quantities[item.id] ?? 0) > 0)

  const orderItems: OrderItem[] = selected.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: quantities[item.id] ?? 0,
    unitPrice: item.preco,
    totalPrice: (quantities[item.id] ?? 0) * item.preco,
  }))

  const totalItems = orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0)

  const contactInvalid = contactTouched && !isContactValid(contact)

  const message = [
    'Olá! Quero encomendar na Foxy Esfirras:',
    ...selected.map((item) => `• ${quantities[item.id]}x ${item.name}`),
    `Total: ${totalItems} ${totalItems === 1 ? 'esfirra' : 'esfirras'}`,
    name.trim() ? `Nome: ${name.trim()}` : '',
    contact.trim() ? `Contato: ${contact.trim()}` : '',
    payment ? `Pagamento: ${PAYMENT_LABELS[payment]}` : '',
    notes.trim() ? `Observação: ${notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const changeQuantity = (id: string, delta: number) => {
    if (status === 'loading') return
    setStatus('idle')
    setStatusMessage('')
    setQuantities((current) => {
      const next = { ...current }
      const value = Math.min(
        MAX_PER_FLAVOR,
        Math.max(0, (current[id] ?? 0) + delta),
      )

      if (value === 0) delete next[id]
      else next[id] = value

      return next
    })
  }

  const clearOrder = () => {
    if (status === 'loading') return
    setQuantities({})
    setName('')
    setContact('')
    setContactTouched(false)
    setPayment('')
    setNotes('')
    setStatus('idle')
    setStatusMessage('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (status === 'loading') return

    if (totalItems === 0) {
      setStatus('error')
      setStatusMessage('Escolha pelo menos um sabor para continuar.')
      return
    }

    if (!name.trim()) {
      setStatus('error')
      setStatusMessage('Informe seu nome para finalizar o pedido.')
      return
    }

    // Contato é opcional: só valida quando algo foi digitado.
    if (!isContactValid(contact)) {
      setContactTouched(true)
      setStatus('error')
      setStatusMessage('Confira o telefone: informe DDD e número (10 ou 11 dígitos).')
      contactInputRef.current?.focus()
      return
    }

    setStatus('loading')
    setStatusMessage('Enviando pedido...')

    try {
      const orderData = buildOrderDocument(
        {
          items: orderItems,
          customerName: name,
          customerContact: contact,
          paymentMethod: payment || undefined,
          notes,
          pickupLocation: PICKUP_LOCATION,
          totalItems,
          totalAmount,
        },
        serverTimestamp(),
      )

      // 🔍 LOG: Dados que serão enviados
      console.log('📤 Enviando pedido para Firestore:', {
        collection: 'pedidos',
        data: JSON.parse(JSON.stringify(orderData, (key, value) =>
          key === 'createdAt' ? 'serverTimestamp()' : value
        ))
      })

      const docRef = await addDoc(collection(db, 'pedidos'), orderData)

      // 🔍 LOG: Sucesso com ID do documento
      console.log('✅ Pedido salvo com sucesso! Document ID:', docRef.id)

      setStatus('success')
      setStatusMessage('')
      setConfirmedOrder({
        customerName: name.trim(),
        totalItems,
        totalAmount,
        ...(payment ? { paymentMethod: payment } : {}),
      })

      // Limpa o formulário após sucesso
      setQuantities({})
      setName('')
      setContact('')
      setContactTouched(false)
      setPayment('')
      setNotes('')
    } catch (error) {
      // 🔍 LOG: Erro detalhado
      const err = error as Error & { code?: string; message?: string }
      console.error('❌ Erro ao enviar pedido:', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        fullError: error
      })

      // Mensagem mais específica baseada no código do erro
      let userMessage = 'Não foi possível enviar o pedido. Tente novamente ou entre em contato pelo Instagram.'
      if (err.code === 'permission-denied') {
        userMessage = 'Permissão negada. Verifique as regras do Firestore no Console do Firebase.'
      } else if (err.code === 'unavailable') {
        userMessage = 'Serviço indisponível. Verifique sua conexão e tente novamente.'
      } else if (err.code === 'invalid-argument') {
        userMessage = 'Dados inválidos. Verifique o console para detalhes.'
      }

      setStatus('error')
      setStatusMessage(userMessage)
    }
  }

  const formatPrice = (cents: number) => {
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
  }

  const firstName = confirmedOrder?.customerName.split(/\s+/)[0] ?? ''

  return (
    <section id="encomendar" className="order" aria-labelledby="encomendar-title">
      <div className="order__head">
        <p className="order__eyebrow">
          <Sparkle size={12} />
          Encomendar
        </p>
        <h2 id="encomendar-title" className="order__title">
          Monte seu pedido
        </h2>
        <p className="order__lede">
          Escolha os sabores e as quantidades. Ao concluir, o pedido é salvo
          automaticamente e fica registrado para a retirada.
        </p>
      </div>

      <form className="order__layout" onSubmit={handleSubmit}>
        <div className="order__main">
          <fieldset className="order__fieldset">
            <legend className="order__legend">
              <span>1</span>
              Escolha os sabores
            </legend>

            <div className="order__items">
              {menu.map((item) => {
                const quantity = quantities[item.id] ?? 0

                return (
                  <div
                    key={item.id}
                    className={`order__item${quantity > 0 ? ' is-active' : ''}`}
                  >
                    <img
                      className="order__item-img"
                      src={item.image}
                      alt=""
                      width={item.width}
                      height={item.height}
                      loading="lazy"
                      decoding="async"
                    />

                    <span className="order__item-copy">
                      <strong>{item.name}</strong>
                      <span>{categoryLabels[item.category]}</span>
                    </span>

                    <div
                      className="order__stepper"
                      role="group"
                      aria-label={`Quantidade de ${item.name}`}
                    >
                      <button
                        type="button"
                        className="order__step"
                        aria-label={`Remover uma esfirra de ${item.name}`}
                        disabled={quantity === 0 || status === 'loading'}
                        onClick={() => changeQuantity(item.id, -1)}
                      >
                        <Minus size={14} />
                      </button>

                      <span className="order__qty" aria-live="polite">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        className="order__step"
                        aria-label={`Adicionar uma esfirra de ${item.name}`}
                        disabled={quantity >= MAX_PER_FLAVOR || status === 'loading'}
                        onClick={() => changeQuantity(item.id, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <div className="order__fields">
            <label className="order__field">
              <span>Seu nome</span>
              <input
                className="order__input"
                type="text"
                name="nome"
                autoComplete="name"
                placeholder="Como podemos chamar você?"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                disabled={status === 'loading'}
                ref={nameInputRef}
              />
            </label>

            <label className="order__field">
              <span>
                WhatsApp / telefone <em>opcional</em>
              </span>
              <input
                className="order__input"
                type="tel"
                name="contato"
                inputMode="tel"
                autoComplete="tel"
                maxLength={MAX_CONTACT_LENGTH}
                placeholder="(41) 99999-9999"
                value={contact}
                onChange={(event) => setContact(sanitizeContact(event.target.value))}
                onBlur={() => setContactTouched(true)}
                disabled={status === 'loading'}
                aria-describedby="order-contact-hint"
                aria-invalid={contactInvalid || undefined}
                ref={contactInputRef}
              />
              <small
                id="order-contact-hint"
                className={`order__hint${contactInvalid ? ' is-error' : ''}`}
                aria-live="polite"
              >
                {contactInvalid
                  ? 'Confira o número: use DDD + telefone (10 ou 11 dígitos).'
                  : 'Só usamos para avisar sobre o pedido.'}
              </small>
            </label>

            <div className="order__field order__field--wide">
              <span id="order-payment-label">
                Forma de pagamento <em>opcional</em>
              </span>
              <div
                className="order__payments"
                role="radiogroup"
                aria-labelledby="order-payment-label"
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <label
                    key={option.value || 'a-combinar'}
                    className={`order__payment${payment === option.value ? ' is-active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="pagamento"
                      value={option.value}
                      checked={payment === option.value}
                      onChange={() => setPayment(option.value)}
                      disabled={status === 'loading'}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="order__field order__field--wide">
              <span>
                Observações <em>opcional</em>
              </span>
              <textarea
                className="order__textarea"
                name="observacoes"
                rows={3}
                maxLength={280}
                placeholder="Sem cebola, ponto da massa, horário de retirada..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                disabled={status === 'loading'}
              />
            </label>
          </div>
        </div>

        <aside className="order__aside" aria-label="Resumo do pedido">
          <div className="order__summary">
            <div className="order__summary-head">
              <p className="order__summary-eyebrow">Seu pedido</p>
              {totalItems > 0 && status !== 'loading' && (
                <button type="button" className="order__clear" onClick={clearOrder}>
                  Limpar
                </button>
              )}
            </div>

            {totalItems > 0 ? (
              <ul className="order__summary-list">
                {selected.map((item) => (
                  <li key={item.id}>
                    <span>{quantities[item.id]}×</span>
                    {item.name}
                    <span className="order__summary-price">
                      {formatPrice((quantities[item.id] ?? 0) * item.preco)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="order__summary-empty">
                Nenhum sabor selecionado ainda.
              </p>
            )}

            <div className="order__summary-total">
              <span>Total</span>
              <strong aria-live="polite">
                {totalItems} {totalItems === 1 ? 'esfirra' : 'esfirras'}
                <span className="order__summary-amount">{formatPrice(totalAmount)}</span>
              </strong>
            </div>

            <button
              type="submit"
              className={`order__submit${status === 'loading' ? ' is-loading' : ''}`}
              disabled={totalItems === 0 || status === 'loading'}
            >
              {status === 'loading' && (
                <Loader2 size={17} className="order__submit-spinner" aria-hidden="true" />
              )}
              {status !== 'loading' && <CheckCircle size={17} />}
              {status === 'loading'
                ? 'Enviando...'
                : 'CONFIRMAR PEDIDO'}
            </button>

            {statusMessage && (
              <div
                className={`order__status${status === 'success' ? ' is-success' : ''}${status === 'error' ? ' is-error' : ''}`}
                role="status"
                aria-live="polite"
              >
                {status === 'success' && (
                  <CheckCircle size={16} className="order__status-icon" aria-hidden="true" />
                )}
                {status === 'error' && (
                  <AlertCircle size={16} className="order__status-icon" aria-hidden="true" />
                )}
                {status === 'loading' && (
                  <Loader2 size={16} className="order__status-icon order__status-spinner" aria-hidden="true" />
                )}
                {statusMessage}
              </div>
            )}

            {totalItems > 0 && status !== 'loading' && (
              <details className="order__preview">
                <summary>Ver mensagem do pedido</summary>
                <pre className="order__pre">{message}</pre>
              </details>
            )}
          </div>

          <div className="order__place">
            <p className="order__place-eyebrow">Retirada</p>
            <h3 className="order__place-title">Quadra do Colégio</h3>
            <p className="order__place-line">
              <MapPin size={15} />
              Ponto de encontro
            </p>
            <a
              className="order__place-link"
              href="https://www.instagram.com/foxy.esfihas_pg/"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={15} />
              @foxy.esfihas_pg
            </a>
          </div>
        </aside>
      </form>

      <p className="order__signature">
        Foxy Esfirras
        <span aria-hidden="true" />
        A melhor escolha
      </p>

      {/* Confirmação do pedido em portal: fica acima de qualquer stacking context */}
      {confirmedOrder &&
        createPortal(
          <div className="order-success" onClick={dismissSuccess}>
            <div
              className="order-success__card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="order-success-title"
              aria-describedby="order-success-text"
              onClick={(event) => event.stopPropagation()}
              ref={successCardRef}
            >
              <button
                type="button"
                className="order-success__close"
                onClick={dismissSuccess}
                aria-label="Fechar mensagem de pedido confirmado"
              >
                <X size={15} />
              </button>

              <span className="order-success__badge" aria-hidden="true">
                <span className="order-success__ring" />
                <span className="order-success__ring order-success__ring--late" />
                <Check size={32} className="order-success__check" />
              </span>

              <p className="order-success__eyebrow">
                <Sparkle size={12} />
                Pedido confirmado
              </p>

              <h2 id="order-success-title" className="order-success__title">
                Pedido feito!
              </h2>

              <p id="order-success-text" className="order-success__text">
                Tudo certo{firstName ? `, ${firstName}` : ''}! Seu pedido de{' '}
                <strong>
                  {confirmedOrder.totalItems}{' '}
                  {confirmedOrder.totalItems === 1 ? 'esfirra' : 'esfirras'}
                </strong>{' '}
                foi registrado e já está com a gente.
              </p>

              <dl
                className={`order-success__meta${confirmedOrder.paymentMethod ? ' order-success__meta--three' : ''}`}
              >
                <div>
                  <dt>Total</dt>
                  <dd>{formatPrice(confirmedOrder.totalAmount)}</dd>
                </div>
                <div>
                  <dt>Retirada</dt>
                  <dd>Quadra do Colégio</dd>
                </div>
                {confirmedOrder.paymentMethod && (
                  <div>
                    <dt>Pagamento</dt>
                    <dd>{PAYMENT_LABELS[confirmedOrder.paymentMethod]}</dd>
                  </div>
                )}
              </dl>

              <button
                type="button"
                className="order-success__action"
                onClick={dismissSuccess}
                ref={successActionRef}
              >
                Fazer outro pedido
              </button>
            </div>
          </div>,
          document.body,
        )}
    </section>
  )
}