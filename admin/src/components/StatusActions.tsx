/* ==================================================================
   AÇÕES DE STATUS — somente as transições válidas para o status atual.
   Ações que exigem confirmação ou motivo abrem o ConfirmDialog; o
   avanço simples é aplicado em um clique.
   A validação definitiva continua nas regras do Firestore.
   ================================================================== */

import {
  getOrderActions,
  statusLabel,
  type OrderAction,
  type OrderStatusValue,
} from '../lib/orders'

interface StatusActionsProps {
  status: OrderStatusValue
  busy: boolean
  /** Destino em execução — usado para o rótulo "Salvando…". */
  pendingTo: string | null
  onSelect: (action: OrderAction) => void
}

export function StatusActions({
  status,
  busy,
  pendingTo,
  onSelect,
}: StatusActionsProps) {
  const actions = getOrderActions(status)

  if (actions.length === 0) {
    return (
      <p className="order-actions__empty">
        {status === 'cancelado'
          ? 'Pedido cancelado é um estado final: não há novas ações.'
          : status === 'entregue'
            ? 'Pedido entregue. Use a linha do tempo para conferir o histórico.'
            : 'O status deste pedido está fora do contrato — corrija-o no Console do Firestore antes de continuar.'}
      </p>
    )
  }

  return (
    <div className="order-actions__group">
      {actions.map((action) => {
        const variant =
          action.kind === 'advance'
            ? 'advance'
            : action.kind === 'regress'
              ? 'regress'
              : 'cancel'

        const isBusy = busy && pendingTo === action.to

        return (
          <button
            key={action.to}
            type="button"
            className={`order-action-btn order-action-btn--${variant}`}
            onClick={() => onSelect(action)}
            disabled={busy}
          >
            <span className="order-action-btn__text">
              <span className="order-action-btn__label">
                {isBusy ? 'Salvando…' : action.label}
              </span>
              <span className="order-action-btn__hint">
                {actionDescription(action)}
              </span>
            </span>
            <span className="order-action-btn__arrow" aria-hidden="true">
              {isBusy ? '…' : '→'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function actionDescription(action: OrderAction): string {
  if (action.kind === 'cancel') {
    return 'Encerra o pedido sem entrega · exige motivo'
  }

  if (action.kind === 'regress') {
    return `Volta uma etapa · novo status: ${statusLabel(action.to)} · exige motivo`
  }

  if (action.requiresConfirm) {
    return `Conclui o pedido · novo status: ${statusLabel(action.to)}`
  }

  return `Novo status: ${statusLabel(action.to)}`
}
