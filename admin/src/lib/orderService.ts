/* ==================================================================
   SERVIÇO DE PEDIDOS — única porta de entrada do Firestore.
   - leitura em tempo real com limite (lista do dashboard)
   - histórico append-only por pedido
   - contagens por status
   - mudança de status em transação atômica com histórico
   Nenhuma regra de negócio duplicada aqui: transições e motivos vêm
   de `orders.ts`; as regras do Firestore validam o mesmo contrato.
   ================================================================== */

import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type QueryConstraint,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  ORDER_STATUSES,
  isValidTransition,
  isOrderStatus,
  mapHistoryDoc,
  mapOrderDoc,
  normalizeStatus,
  requiresReason,
  type Order,
  type OrderHistoryEntry,
  type OrderStatus,
  type OrderStatusValue,
} from './orders'
import {
  OrderServiceError,
  toAppError,
  type AppErrorInfo,
} from './errors'

/** Quantidade inicial de pedidos carregados; "Carregar mais" aumenta. */
export const DEFAULT_PAGE_SIZE = 50

/** Motivo obrigatório em cancelamento/retrocesso: mínimo exigido. */
export const MIN_REASON_LENGTH = 3
export const MAX_REASON_LENGTH = 280

export type OrdersListener = (orders: Order[]) => void
export type OrderListener = (order: Order | null) => void
export type HistoryListener = (entries: OrderHistoryEntry[]) => void
export type ErrorListener = (error: AppErrorInfo) => void

export interface OrdersQueryOptions {
  status?: OrderStatusValue | 'todos'
  startAt?: Date | null
  endAt?: Date | null
  pageSize?: number
}

function documentToOrder(snapshot: QueryDocumentSnapshot): Order {
  return mapOrderDoc(snapshot.id, snapshot.data())
}

/**
 * Lista em tempo real. Filtro por status e período são aplicados no
 * servidor (exigem índice composto — ver firestore.indexes.json).
 */
export function subscribeOrders(
  options: OrdersQueryOptions,
  onOrders: OrdersListener,
  onError?: ErrorListener,
): Unsubscribe {
  const constraints: QueryConstraint[] = []

  if (
    options.status &&
    options.status !== 'todos' &&
    isOrderStatus(options.status)
  ) {
    constraints.push(where('status', '==', options.status))
  }

  if (options.startAt) {
    constraints.push(where('createdAt', '>=', options.startAt))
  }

  if (options.endAt) {
    constraints.push(where('createdAt', '<=', options.endAt))
  }

  constraints.push(orderBy('createdAt', 'desc'))
  constraints.push(limitTo(options.pageSize ?? DEFAULT_PAGE_SIZE))

  return onSnapshot(
    query(collection(db, 'pedidos'), ...constraints),
    (snapshot) => onOrders(snapshot.docs.map(documentToOrder)),
    (error) => onError?.(toAppError(error)),
  )
}

/** Mantém o pedido aberto sincronizado mesmo quando ele sai do filtro da lista. */
export function subscribeOrder(
  orderId: string,
  onOrder: OrderListener,
  onError?: ErrorListener,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'pedidos', orderId),
    (snapshot) => onOrder(snapshot.exists() ? mapOrderDoc(snapshot.id, snapshot.data()) : null),
    (error) => onError?.(toAppError(error)),
  )
}

/** Histórico do pedido em ordem cronológica (mais antigo primeiro). */
export function subscribeOrderHistory(
  orderId: string,
  onEntries: HistoryListener,
  onError?: ErrorListener,
): Unsubscribe {
  const historyQuery = query(
    collection(db, 'pedidos', orderId, 'historico'),
    orderBy('changedAt', 'asc'),
  )

  return onSnapshot(
    historyQuery,
    (snapshot) =>
      onEntries(
        snapshot.docs.map((entry) =>
          mapHistoryDoc(entry.id, entry.data(), orderId),
        ),
      ),
    (error) => onError?.(toAppError(error)),
  )
}

/** Fallback da busca: quando o termo parece um ID completo. */
export async function fetchOrderById(orderId: string): Promise<Order | null> {
  try {
    const snapshot = await getDoc(doc(db, 'pedidos', orderId))
    return snapshot.exists() ? mapOrderDoc(snapshot.id, snapshot.data()) : null
  } catch (error) {
    throw asServiceError(error)
  }
}

/** Contagem total por status (cards), independente do período filtrado. */
export async function fetchStatusCounts(): Promise<Record<OrderStatus, number>> {
  try {
    const entries = await Promise.all(
      ORDER_STATUSES.map(async (status) => {
        const snapshot = await getCountFromServer(
          query(collection(db, 'pedidos'), where('status', '==', status)),
        )
        return [status, snapshot.data().count] as const
      }),
    )

    return Object.fromEntries(entries) as Record<OrderStatus, number>
  } catch (error) {
    throw asServiceError(error)
  }
}

/* ---------- Mudança de status ---------- */

export interface ChangeOrderStatusInput {
  orderId: string
  /** Status que a interface estava exibindo — base da checagem de conflito. */
  fromStatus: OrderStatusValue
  toStatus: OrderStatus
  reason?: string | null
}

export interface ChangeOrderStatusActor {
  uid: string
  email: string | null
}

export interface ChangeOrderStatusResult {
  historyId: string
  fromStatus: OrderStatus
  toStatus: OrderStatus
}

/**
 * Atualiza o pedido e grava o histórico na MESMA transação.
 * O `lastHistoryId` aponta para o registro criado; as regras do Firestore
 * exigem esse vínculo para aceitar o update.
 */
export async function changeOrderStatus(
  input: ChangeOrderStatusInput,
  actor: ChangeOrderStatusActor,
): Promise<ChangeOrderStatusResult> {
  const orderId = input.orderId.trim()
  const reason = (input.reason ?? '').trim()

  if (!orderId) {
    throw new OrderServiceError('invalid-argument', 'Pedido inválido.')
  }

  if (!actor.uid) {
    throw new OrderServiceError(
      'unauthenticated',
      'Entre novamente para alterar pedidos.',
    )
  }

  if (!isOrderStatus(input.fromStatus)) {
    throw new OrderServiceError(
      'invalid-transition',
      'O status atual do pedido não permite alteração.',
      { hint: 'Recarregue o pedido para ver o status real.' },
    )
  }

  if (!isOrderStatus(input.toStatus)) {
    throw new OrderServiceError('invalid-argument', 'Status de destino inválido.')
  }

  if (!isValidTransition(input.fromStatus, input.toStatus)) {
    throw new OrderServiceError(
      'invalid-transition',
      'Este status não permite a mudança solicitada.',
      { hint: 'Recarregue o pedido para ver as ações disponíveis.' },
    )
  }

  if (requiresReason(input.fromStatus, input.toStatus)) {
    if (reason.length < MIN_REASON_LENGTH) {
      throw new OrderServiceError(
        'invalid-argument',
        `Informe o motivo (mínimo ${MIN_REASON_LENGTH} caracteres).`,
      )
    }
  }

  if (reason.length > MAX_REASON_LENGTH) {
    throw new OrderServiceError(
      'invalid-argument',
      `O motivo deve ter no máximo ${MAX_REASON_LENGTH} caracteres.`,
    )
  }

  const orderRef = doc(db, 'pedidos', orderId)
  const historyRef = doc(collection(db, 'pedidos', orderId, 'historico'))
  const actorData = { uid: actor.uid, email: actor.email ?? '' }

  try {
    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(orderRef)

      if (!snapshot.exists()) {
        throw new OrderServiceError(
          'not-found',
          'Este pedido não existe ou foi removido.',
        )
      }

      const currentStatus = normalizeStatus(snapshot.data().status)

      if (currentStatus !== input.fromStatus) {
        throw new OrderServiceError(
          'conflict',
          'O status do pedido mudou enquanto você decidia.',
          {
            hint: 'Confira o status atual e confirme a ação novamente.',
            details: { currentStatus },
          },
        )
      }

      if (!isValidTransition(currentStatus, input.toStatus)) {
        throw new OrderServiceError(
          'invalid-transition',
          'Este status não permite a mudança solicitada.',
        )
      }

      transaction.update(orderRef, {
        status: input.toStatus,
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        statusUpdatedBy: actorData,
        lastHistoryId: historyRef.id,
      })

      transaction.set(historyRef, {
        pedidoId: orderId,
        fromStatus: currentStatus,
        toStatus: input.toStatus,
        changedAt: serverTimestamp(),
        changedBy: actorData,
        ...(reason ? { reason } : {}),
      })
    })
  } catch (error) {
    throw asServiceError(error)
  }

  return {
    historyId: historyRef.id,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
  }
}

function asServiceError(error: unknown): OrderServiceError {
  if (error instanceof OrderServiceError) return error
  const info = toAppError(error)
  return new OrderServiceError(info.code, info.message, { hint: info.hint })
}
