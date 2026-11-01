/* ==================================================================
   DETALHE DO PEDIDO — drawer lateral (desktop) / tela cheia (celular).

   Responsabilidades desta camada:
   - exibir cliente, contato, itens, totais, pagamento e observações;
   - oferecer apenas as ações válidas para o status atual;
   - confirmar cancelamento, retrocesso e conclusão; motivo obrigatório
     em cancelamento/retrocesso;
   - executar a mudança via transação (orderService) e refletir o
     histórico em tempo real;
   - tratar conflito de concorrência: se outro operador mudou o pedido,
     o drawer é atualizado e a confirmação é refeita.
   Nenhuma regra é reimplementada aqui: transições vêm de `orders.ts`.
   ================================================================== */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAdminAuth } from '../auth/useAdminAuth'
import { useOrder } from '../hooks/useOrder'
import { useOrderHistory } from '../hooks/useOrderHistory'
import { toAppError, type AppErrorInfo } from '../lib/errors'
import {
  formatDateTime,
  formatPhone,
  shortOrderId,
  telUrl,
  whatsappUrl,
} from '../lib/format'
import {
  MAX_REASON_LENGTH,
  MIN_REASON_LENGTH,
  changeOrderStatus,
} from '../lib/orderService'
import {
  isValidTransition,
  normalizeStatus,
  paymentMethodLabel,
  statusLabel,
  type Order,
  type OrderAction,
  type OrderStatusValue,
} from '../lib/orders'
import { useFocusTrap } from '../lib/useFocusTrap'
import { ConfirmDialog } from './ConfirmDialog'
import { HistoryTimeline } from './HistoryTimeline'
import { OrderItems } from './OrderItems'
import { StatusActions } from './StatusActions'
import { StatusBadge } from './StatusBadge'
import { useToast } from './Toast'

const CLOSE_ANIMATION_MS = 220

interface OrderDetailDrawerProps {
  /** Retrato vindo da lista; a partir daí o documento é assinado. */
  order: Order
  onClose: () => void
}

export function OrderDetailDrawer({ order: initialOrder, onClose }: OrderDetailDrawerProps) {
  const { user } = useAdminAuth()
  const { show } = useToast()
  const { order, live } = useOrder(initialOrder)
  const history = useOrderHistory(order.id)

  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null)
  const [runningTo, setRunningTo] = useState<OrderAction['to'] | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<AppErrorInfo | null>(null)
  const [conflict, setConflict] = useState<{ status: OrderStatusValue } | null>(null)
  const [copied, setCopied] = useState(false)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const copyTimerRef = useRef<number | null>(null)
  const pendingActionRef = useRef<OrderAction | null>(null)
  const busyRef = useRef(false)

  pendingActionRef.current = pendingAction
  busyRef.current = busy

  /* ---------- Entrada / saída e foco ---------- */

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => setVisible(true))

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      triggerRef.current?.focus?.()
      triggerRef.current = null

      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  useFocusTrap(panelRef, !pendingAction && !closing)

  const closeDrawer = useCallback(() => {
    if (busyRef.current || closing) return

    setClosing(true)
    setPendingAction(null)

    if (prefersReducedMotion()) {
      onClose()
      return
    }

    setVisible(false)
    closeTimerRef.current = window.setTimeout(onClose, CLOSE_ANIMATION_MS)
  }, [closing, onClose])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      // O ConfirmDialog cuida do próprio Esc quando está aberto.
      if (pendingActionRef.current || busyRef.current) return
      event.preventDefault()
      closeDrawer()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeDrawer])

  /* ---------- Conflito em tempo real ---------- */

  useEffect(() => {
    if (!pendingAction) return
    if (isValidTransition(order.status, pendingAction.to)) return

    setPendingAction(null)
    setActionError(null)
    setConflict({ status: order.status })
    show({
      type: 'warning',
      title: 'Pedido atualizado por outra pessoa',
      message: `O pedido agora está em ${statusLabel(order.status)}. As ações foram recalculadas.`,
    })
  }, [order.status, pendingAction, show])

  /* ---------- Mudança de status ---------- */

  const runAction = useCallback(
    async (action: OrderAction, reason: string) => {
      if (!user) {
        setActionError({
          code: 'unauthenticated',
          title: 'Sessão encerrada',
          message: 'Entre novamente para alterar pedidos.',
        })
        return
      }

      setBusy(true)
      setRunningTo(action.to)
      setActionError(null)

      try {
        await changeOrderStatus(
          {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: action.to,
            reason: action.requiresReason ? reason : null,
          },
          { uid: user.uid, email: user.email },
        )

        setPendingAction(null)
        setConflict(null)
        show({
          type: 'success',
          title: 'Status atualizado',
          message: `${shortOrderId(order.id)} · ${statusLabel(action.to)}`,
        })
      } catch (error) {
        const info = toAppError(error)

        if (info.code === 'conflict' || info.code === 'aborted') {
          const current =
            info.details?.currentStatus === undefined
              ? order.status
              : normalizeStatus(info.details.currentStatus)
          setPendingAction(null)
          setConflict({ status: current })
          show({
            type: 'warning',
            title: 'Pedido alterado por outra pessoa',
            message: info.message,
          })
          return
        }

        setActionError(info)
        show({
          type: 'error',
          title: info.title,
          message: info.message,
        })
      } finally {
        setBusy(false)
        setRunningTo(null)
      }
    },
    [order.id, order.status, show, user],
  )

  const handleSelectAction = useCallback(
    (action: OrderAction) => {
      setActionError(null)
      setConflict(null)

      const needsDialog = action.requiresConfirm || action.requiresReason
      if (needsDialog) {
        setPendingAction(action)
        return
      }

      void runAction(action, '')
    },
    [runAction],
  )

  /* ---------- Copiar ID ---------- */

  const copyOrderId = useCallback(async () => {
    try {
      await writeToClipboard(order.id)
      setCopied(true)

      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      show({
        type: 'error',
        title: 'Não foi possível copiar',
        message: 'Selecione o ID manualmente.',
      })
    }
  }, [order.id, show])

  /* ---------- Render ---------- */

  const phone = order.customerContact
  const phoneLink = telUrl(phone)
  const whatsappLink = whatsappUrl(phone)
  const payment = paymentMethodLabel(order.paymentMethod)

  const dialogCopy = pendingAction
    ? describeAction(pendingAction, order.status, order.id)
    : null

  return (
    <>
      <div
        className="order-drawer__overlay"
        data-state={visible ? 'open' : 'closed'}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeDrawer()
        }}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        className={`order-drawer__panel ${visible ? 'order-drawer__panel--open' : ''}`}
        data-state={visible ? 'open' : 'closed'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-drawer-title"
        tabIndex={-1}
      >
        <div className="order-drawer__handle" aria-hidden="true" />

        <header className="order-drawer__header">
          <div className="order-drawer__heading">
            <span className="order-drawer__eyebrow">Pedido</span>
            <h2 id="order-drawer-title" className="order-drawer__title">
              {shortOrderId(order.id)}
            </h2>
            <div className="order-drawer__subtitle">
              <StatusBadge status={order.status} />
              <span className="order-drawer__date">
                {order.createdAt
                  ? formatDateTime(order.createdAt)
                  : 'Processando data'}
              </span>
              {live && (
                <span className="order-drawer__live">
                  <span className="order-drawer__live-dot" aria-hidden="true" />
                  ao vivo
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="order-drawer__close"
            onClick={closeDrawer}
            disabled={busy}
            aria-label="Fechar detalhes do pedido"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="order-drawer__body">
          {conflict && (
            <div className="order-alert order-alert--warning" role="alert">
              <div>
                <strong className="order-alert__title">
                  O pedido mudou enquanto você decidia
                </strong>
                <p className="order-alert__text">
                  Status atual: <strong>{statusLabel(conflict.status)}</strong>.
                  As ações abaixo já refletem o estado mais recente.
                </p>
              </div>
              <button
                type="button"
                className="order-alert__dismiss"
                onClick={() => setConflict(null)}
                aria-label="Fechar aviso"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cliente e contato */}
          <section className="order-section" aria-labelledby="order-section-customer">
            <h3 id="order-section-customer" className="order-section__title">
              Cliente e contato
            </h3>

            <dl className="order-info">
              <div className="order-info__row">
                <dt className="order-info__term">Nome</dt>
                <dd className="order-info__desc">{order.customerName}</dd>
              </div>

              <div className="order-info__row">
                <dt className="order-info__term">Contato</dt>
                <dd className="order-info__desc">
                  {phone ? (
                    <span className="order-contact">
                      <span>{formatPhone(phone)}</span>
                      {phoneLink && (
                        <a
                          className="order-contact__link"
                          href={phoneLink}
                          aria-label={`Ligar para ${order.customerName}`}
                        >
                          Ligar
                        </a>
                      )}
                      {whatsappLink && (
                        <a
                          className="order-contact__link"
                          href={whatsappLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Abrir WhatsApp de ${order.customerName}`}
                        >
                          WhatsApp
                        </a>
                      )}
                    </span>
                  ) : (
                    <span className="order-info__muted">Não informado</span>
                  )}
                </dd>
              </div>

              <div className="order-info__row">
                <dt className="order-info__term">Retirada</dt>
                <dd className="order-info__desc">
                  {order.pickupLocation || (
                    <span className="order-info__muted">Não informado</span>
                  )}
                </dd>
              </div>

              <div className="order-info__row">
                <dt className="order-info__term">Pagamento</dt>
                <dd className="order-info__desc">
                  {order.paymentMethod ? (
                    payment
                  ) : (
                    <span className="order-info__muted">{payment}</span>
                  )}
                </dd>
              </div>

              <div className="order-info__row order-info__row--block">
                <dt className="order-info__term">Observações</dt>
                <dd className="order-info__desc">
                  {order.notes ? (
                    <p className="order-notes">{order.notes}</p>
                  ) : (
                    <span className="order-info__muted">Sem observações</span>
                  )}
                </dd>
              </div>
            </dl>

            <div className="order-copy">
              <span className="order-copy__label">ID completo</span>
              <code className="order-copy__value" title={order.id}>
                {order.id}
              </code>
              <button
                type="button"
                className="btn order-copy__button"
                onClick={() => void copyOrderId()}
              >
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
              <span className="sr-only" aria-live="polite">
                {copied ? 'ID copiado para a área de transferência.' : ''}
              </span>
            </div>
          </section>

          {/* Itens e totais */}
          <section className="order-section" aria-labelledby="order-section-items">
            <h3 id="order-section-items" className="order-section__title">
              Itens do pedido
            </h3>
            <OrderItems order={order} />
          </section>

          {/* Ações de status */}
          <section className="order-section" aria-labelledby="order-section-actions">
            <h3 id="order-section-actions" className="order-section__title">
              Alterar status
            </h3>

            <StatusActions
              status={order.status}
              busy={busy}
              pendingTo={runningTo}
              onSelect={handleSelectAction}
            />

            {actionError && !pendingAction && (
              <div className="order-alert order-alert--error" role="alert">
                <div>
                  <strong className="order-alert__title">
                    {actionError.title}
                  </strong>
                  <p className="order-alert__text">{actionError.message}</p>
                  {actionError.hint && (
                    <p className="order-alert__hint">{actionError.hint}</p>
                  )}
                </div>
              </div>
            )}

            <p className="order-actions__footnote">
              Cancelamento, retrocesso e conclusão exigem confirmação. Toda
              alteração gera um registro imutável no histórico.
            </p>
          </section>

          {/* Linha do tempo */}
          <section className="order-section" aria-labelledby="order-section-history">
            <h3 id="order-section-history" className="order-section__title">
              Histórico
            </h3>

            <HistoryTimeline
              order={order}
              entries={history.entries}
              loading={history.loading}
              error={history.error}
            />
          </section>
        </div>

        <footer className="order-drawer__footer">
          <button
            type="button"
            className="btn btn--block"
            onClick={closeDrawer}
            disabled={busy}
          >
            Fechar
          </button>
        </footer>
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={dialogCopy?.title ?? 'Confirmar alteração'}
        description={dialogCopy?.description}
        confirmLabel={dialogCopy?.confirmLabel ?? 'Confirmar'}
        cancelLabel="Voltar"
        tone={pendingAction?.kind === 'cancel' ? 'danger' : 'default'}
        requireReason={pendingAction?.requiresReason ?? false}
        reasonLabel={
          pendingAction?.kind === 'cancel'
            ? 'Motivo do cancelamento'
            : 'Motivo do retrocesso'
        }
        minReasonLength={MIN_REASON_LENGTH}
        maxReasonLength={MAX_REASON_LENGTH}
        busy={busy}
        error={
          actionError
            ? `${actionError.message}${actionError.hint ? ` ${actionError.hint}` : ''}`
            : null
        }
        onConfirm={(reason) => {
          if (pendingAction) void runAction(pendingAction, reason)
        }}
        onClose={() => {
          if (busy) return
          setPendingAction(null)
          setActionError(null)
        }}
      />
    </>
  )
}

/* ---------- Auxiliares ---------- */

function describeAction(
  action: OrderAction,
  fromStatus: OrderStatusValue,
  orderId: string,
): { title: string; description: string; confirmLabel: string } {
  const from = statusLabel(fromStatus)
  const to = statusLabel(action.to)
  const shortId = shortOrderId(orderId)

  if (action.kind === 'cancel') {
    return {
      title: 'Cancelar este pedido?',
      description: `O pedido ${shortId} passará de "${from}" para "${to}" e não poderá mais avançar. O motivo é obrigatório e fica registrado no histórico.`,
      confirmLabel: 'Cancelar pedido',
    }
  }

  if (action.kind === 'regress') {
    return {
      title: 'Voltar uma etapa?',
      description: `O pedido ${shortId} voltará de "${from}" para "${to}". Informe o motivo: ele fica registrado no histórico.`,
      confirmLabel: 'Voltar etapa',
    }
  }

  return {
    title: 'Concluir este pedido?',
    description: `O pedido ${shortId} será marcado como "${to}". Essa é a conclusão do pedido e fica registrada no histórico.`,
    confirmLabel: 'Marcar como entregue',
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

async function writeToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  // Fallback para contextos não seguros (http) e navegadores antigos.
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) throw new Error('copy-failed')
}
