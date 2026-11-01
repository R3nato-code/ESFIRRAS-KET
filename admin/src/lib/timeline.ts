/* ==================================================================
   LINHA DO TEMPO DO PEDIDO — módulo puro.

   Regras:
   - o primeiro item é SEMPRE sintético: "Pedido recebido pelo site",
     derivado de `createdAt`. Isso mantém pedidos antigos (sem histórico
     gravado) legíveis sem escrever nada no banco;
   - os registros de `historico` entram em ordem cronológica;
   - registros sem `changedAt` (serverTimestamp ainda não resolvido)
     ficam no fim, sem quebrar a renderização.
   ================================================================== */

import {
  PREVIOUS_STATUS,
  isOrderStatus,
  statusLabel,
  type Actor,
  type Order,
  type OrderHistoryEntry,
  type OrderStatusValue,
} from './orders'

export type TimelineKind =
  | 'created'
  | 'advance'
  | 'regress'
  | 'cancel'
  | 'unknown'

export interface TimelineEntry {
  id: string
  kind: TimelineKind
  /** Texto curto, em português, do que aconteceu. */
  title: string
  /** Complemento: "Pendente → Em preparação". */
  detail: string | null
  fromStatus: OrderStatusValue | null
  toStatus: OrderStatusValue | null
  timestamp: Date | null
  actor: Actor | null
  reason: string | null
  /** true apenas para o evento inicial derivado de `createdAt`. */
  synthetic: boolean
}

/** Classifica a mudança para escolher rótulo e cor do marcador. */
export function timelineKindFor(
  from: OrderStatusValue,
  to: OrderStatusValue,
): TimelineKind {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return 'unknown'
  if (to === 'cancelado') return 'cancel'
  if (PREVIOUS_STATUS[from] === to) return 'regress'
  return 'advance'
}

function titleFor(kind: TimelineKind, to: OrderStatusValue): string {
  const label = statusLabel(to)

  switch (kind) {
    case 'cancel':
      return 'Pedido cancelado'
    case 'regress':
      return `Retornou para ${label.toLowerCase()}`
    case 'advance':
      return `Avançou para ${label.toLowerCase()}`
    default:
      return 'Alteração de status'
  }
}

function compareTimestamps(
  a: OrderHistoryEntry,
  b: OrderHistoryEntry,
): number {
  if (!a.changedAt && !b.changedAt) return 0
  if (!a.changedAt) return 1
  if (!b.changedAt) return -1
  return a.changedAt.getTime() - b.changedAt.getTime()
}

function cleanReason(value: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/**
 * Monta a linha do tempo exibida no detalhe do pedido.
 * `history` pode vir vazio: o evento inicial sintético garante contexto.
 */
export function buildTimeline(
  order: Pick<Order, 'id' | 'createdAt'>,
  history: readonly OrderHistoryEntry[],
): TimelineEntry[] {
  const created: TimelineEntry = {
    id: `created:${order.id}`,
    kind: 'created',
    title: 'Pedido recebido pelo site',
    detail: 'Registro inicial do pedido',
    fromStatus: null,
    toStatus: 'pendente',
    timestamp: order.createdAt,
    actor: null,
    reason: null,
    synthetic: true,
  }

  const changes: TimelineEntry[] = [...history]
    .sort(compareTimestamps)
    .map((entry) => {
      const kind = timelineKindFor(entry.fromStatus, entry.toStatus)

      return {
        id: entry.id,
        kind,
        title: titleFor(kind, entry.toStatus),
        detail: `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}`,
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
        timestamp: entry.changedAt,
        actor: entry.changedBy,
        reason: cleanReason(entry.reason),
        synthetic: false,
      }
    })

  return [created, ...changes]
}

/** Quantidade de mudanças registradas (não conta o evento sintético). */
export function countChanges(entries: readonly TimelineEntry[]): number {
  return entries.filter((entry) => !entry.synthetic).length
}
