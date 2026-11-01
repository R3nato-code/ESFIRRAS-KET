import { useEffect, useMemo, useState } from 'react'
import {
  getOrderActions,
  STATUS_META,
  paymentMethodLabel,
  statusLabel,
  type Order,
  type OrderHistoryEntry,
  type OrderAction,
} from '../lib/orders'
import {
  changeOrderStatus,
  subscribeOrder,
  subscribeOrderHistory,
} from '../lib/orderService'
import { toAppError } from '../lib/errors'
import {
  formatCurrency,
  formatDateTime,
  formatPhone,
  shortOrderId,
  whatsappUrl,
} from '../lib/format'
import { useAdminAuth } from '../auth/useAdminAuth'
import { useToast } from './Toast'

interface Props {
  order: Order
  onClose: () => void
}

type TimelineItem = {
  id: string
  fromStatus: string | null
  toStatus: string
  changedAt: Date | null
  changedBy: string
  reason: string | null
  synthetic?: boolean
}

export function OrderDetailDrawer({ order, onClose }: Props) {
  const { user } = useAdminAuth()
  const { show: showToast } = useToast()
  const [currentOrder, setCurrentOrder] = useState(order)
  const activeOrder = currentOrder
  const [history, setHistory] = useState<OrderHistoryEntry[]>([])
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<OrderAction | null>(null)
  const [actionFromStatus, setActionFromStatus] = useState<Order['status'] | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, saving])

  useEffect(() => {
    setCurrentOrder(order)
    return subscribeOrder(
      activeOrder.id,
      (updatedOrder) => {
        if (updatedOrder) setCurrentOrder(updatedOrder)
      },
      (error) => setHistoryError(error.message),
    )
  }, [activeOrder.id])

  useEffect(() => {
    setHistory([])
    setHistoryError(null)
    return subscribeOrderHistory(
      activeOrder.id,
      setHistory,
      (error) => setHistoryError(error.message),
    )
  }, [activeOrder.id])

  const timeline = useMemo<TimelineItem[]>(() => {
    const initialEvent: TimelineItem = {
      id: 'initial-event',
      fromStatus: null,
      toStatus: 'pendente',
      changedAt: activeOrder.createdAt,
      changedBy: 'Site Foxy Esfirras',
      reason: null,
      synthetic: true,
    }
    return [
      initialEvent,
      ...history.map((entry) => ({
        id: entry.id,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        changedAt: entry.changedAt,
        changedBy: entry.changedBy?.email || 'Administrador',
        reason: entry.reason,
      })),
    ]
  }, [history, activeOrder.createdAt])

  const actions = getOrderActions(activeOrder.status)

  async function confirmAction() {
    if (!pendingAction || !user || saving) return
    setSaving(true)
    try {
      await changeOrderStatus({
        orderId: activeOrder.id,
        fromStatus: actionFromStatus ?? activeOrder.status,
        toStatus: pendingAction.to,
        reason,
      }, { uid: user.uid, email: user.email })
      showToast({
        title: 'Status atualizado',
        message: `Pedido ${shortOrderId(activeOrder.id)}: ${statusLabel(pendingAction.to)}.`,
        type: 'success',
      })
      setPendingAction(null)
      setReason('')
    } catch (error) {
      const appError = toAppError(error)
      showToast({
        title: appError.title,
        message: appError.hint ? `${appError.message} ${appError.hint}` : appError.message,
        type: 'error',
        duration: 8000,
      })
    } finally {
      setSaving(false)
    }
  }

  function requestAction(action: OrderAction) {
    setActionFromStatus(activeOrder.status)
    if (action.requiresConfirm) {
      setPendingAction(action)
      setReason('')
      return
    }
    setPendingAction(action)
    setReason('')
    void confirmDirect(action, activeOrder.status)
  }

  async function confirmDirect(action: OrderAction, fromStatus: Order['status']) {
    if (!user || saving) return
    setSaving(true)
    try {
      await changeOrderStatus({
        orderId: activeOrder.id,
        fromStatus,
        toStatus: action.to,
      }, { uid: user.uid, email: user.email })
      showToast({ title: 'Status atualizado', message: statusLabel(action.to), type: 'success' })
      setPendingAction(null)
    } catch (error) {
      const appError = toAppError(error)
      showToast({ title: appError.title, message: appError.message, type: 'error' })
      setPendingAction(null)
    } finally {
      setSaving(false)
    }
  }

  const phoneLink = whatsappUrl(activeOrder.customerContact)

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose()
    }}>
      <aside className="order-drawer" role="dialog" aria-modal="true"
        aria-labelledby="order-drawer-title">
        <header className="order-drawer__header">
          <div>
            <p className="eyebrow">Detalhes do pedido</p>
            <h2 id="order-drawer-title">{shortOrderId(activeOrder.id)}</h2>
            <span className="status-badge" data-status={activeOrder.status}>
              <span className="badge__dot" aria-hidden="true" />
              {STATUS_META[activeOrder.status].label}
            </span>
          </div>
          <button className="btn btn--ghost" type="button" onClick={onClose}
            aria-label="Fechar detalhes">✕</button>
        </header>

        <div className="order-drawer__body">
          <section className="detail-section">
            <h3>Cliente</h3>
            <dl className="detail-grid">
              <div><dt>Nome</dt><dd>{activeOrder.customerName}</dd></div>
              <div><dt>Contato</dt><dd>{formatPhone(activeOrder.customerContact)}</dd></div>
              <div><dt>Retirada</dt><dd>{activeOrder.pickupLocation || 'Não informado'}</dd></div>
              <div><dt>Pagamento</dt><dd>{paymentMethodLabel(activeOrder.paymentMethod)}</dd></div>
              <div><dt>Recebido em</dt><dd>{formatDateTime(activeOrder.createdAt)}</dd></div>
              <div><dt>ID completo</dt><dd><code>{activeOrder.id}</code></dd></div>
            </dl>
            {phoneLink && <a className="btn btn--primary detail-contact" href={phoneLink}
              target="_blank" rel="noreferrer">Abrir conversa no WhatsApp</a>}
          </section>

          <section className="detail-section">
            <h3>Itens do pedido</h3>
            {activeOrder.items.length ? (
              <ul className="detail-items">
                {activeOrder.items.map((item) => (
                  <li key={item.id}>
                    <div><strong>{item.quantity}× {item.name}</strong>
                      <span>{item.category || 'Categoria não informada'} · {formatCurrency(item.unitPrice)} / un.</span></div>
                    <strong>{formatCurrency(item.totalPrice)}</strong>
                  </li>
                ))}
              </ul>
            ) : <p className="detail-muted">Nenhum item disponível.</p>}
            <div className="detail-totals">
              <div><span>Quantidade total</span><strong>{activeOrder.totalItems} itens</strong></div>
              <div className="detail-totals__grand"><span>Total</span><strong>{formatCurrency(activeOrder.totalAmount)}</strong></div>
            </div>
          </section>

          <section className="detail-section">
            <h3>Observações</h3>
            <p className="detail-notes">{activeOrder.notes.trim() || 'Nenhuma observação informada.'}</p>
          </section>

          <section className="detail-section">
            <h3>Histórico do pedido</h3>
            {historyError && <p className="detail-error" role="status">{historyError}</p>}
            <ol className="history-timeline">
              {timeline.map((entry) => (
                <li key={entry.id} className="history-timeline__item">
                  <span className="history-timeline__marker" aria-hidden="true" />
                  <div>
                    <strong>{entry.synthetic ? 'Pedido recebido pelo site' :
                      entry.fromStatus ? `${statusLabel(entry.fromStatus as Order['status'])} → ${statusLabel(entry.toStatus as Order['status'])}` :
                      statusLabel(entry.toStatus as Order['status'])}</strong>
                    <p>{formatDateTime(entry.changedAt)} · {entry.changedBy}</p>
                    {entry.reason && <p className="history-timeline__reason">Motivo: {entry.reason}</p>}
                    {entry.synthetic && <span className="detail-muted">Evento inicial estimado; não gravado no banco.</span>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="detail-section detail-actions">
            <h3>Ações de status</h3>
            {actions.length ? actions.map((action) => (
              <button key={action.kind} type="button"
                className={`btn ${action.destructive ? 'btn--danger' : action.kind === 'advance' ? 'btn--primary' : ''}`}
                disabled={saving} onClick={() => requestAction(action)}>
                {action.label}
              </button>
            )) : <p className="detail-muted">Não há ações disponíveis para este status.</p>}
          </section>
        </div>

        {pendingAction && pendingAction.requiresConfirm && (
          <div className="confirm-backdrop">
            <section className="confirm-dialog" role="alertdialog" aria-modal="true"
              aria-labelledby="confirm-title" aria-describedby="confirm-description">
              <h3 id="confirm-title">Confirmar alteração</h3>
              <p id="confirm-description">O pedido será alterado para <strong>{statusLabel(pendingAction.to)}</strong>.</p>
              {pendingAction.requiresReason && (
                <label className="confirm-reason">
                  Motivo <span aria-hidden="true">*</span>
                  <textarea value={reason} maxLength={280} rows={3}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Descreva o motivo (mínimo 3 caracteres)." />
                  <small>{reason.trim().length}/280 caracteres</small>
                </label>
              )}
              <div className="confirm-dialog__actions">
                <button type="button" className="btn" disabled={saving}
                  onClick={() => setPendingAction(null)}>Voltar</button>
                <button type="button"
                  className={`btn ${pendingAction.destructive ? 'btn--danger' : 'btn--primary'}`}
                  disabled={saving || (pendingAction.requiresReason && reason.trim().length < 3)}
                  onClick={() => void confirmAction()}>
                  {saving ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  )
}
