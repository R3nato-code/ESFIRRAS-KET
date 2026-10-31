/* ==================================================================
   DOMÍNIO DO PEDIDO — tipos, status e máquina de estados.
   Este arquivo é puro: nenhuma dependência do Firebase em runtime,
   para permitir teste unitário rápido e reuso na UI.
   ================================================================== */

/* ---------- Status ---------- */

export const ORDER_STATUSES = [
  'pendente',
  'em_preparacao',
  'pronto',
  'entregue',
  'cancelado',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Valor lido do banco. Pedidos legados podem ter status fora do contrato. */
export type OrderStatusValue = OrderStatus | 'desconhecido'

export const UNKNOWN_STATUS = 'desconhecido' as const

export function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    typeof value === 'string' &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  )
}

export function normalizeStatus(value: unknown): OrderStatusValue {
  return isOrderStatus(value) ? value : UNKNOWN_STATUS
}

export interface StatusMeta {
  label: string
  /** Nome do token de cor em tokens.css (usado em `data-status`). */
  tone: OrderStatusValue
  description: string
  /** Ordem de exibição nos cards de indicadores. */
  order: number
}

export const STATUS_META: Record<OrderStatusValue, StatusMeta> = {
  pendente: {
    label: 'Pendente',
    tone: 'pendente',
    description: 'Aguardando início do preparo',
    order: 0,
  },
  em_preparacao: {
    label: 'Em preparação',
    tone: 'em_preparacao',
    description: 'Na cozinha',
    order: 1,
  },
  pronto: {
    label: 'Pronto',
    tone: 'pronto',
    description: 'Aguardando retirada/entrega',
    order: 2,
  },
  entregue: {
    label: 'Entregue',
    tone: 'entregue',
    description: 'Pedido concluído',
    order: 3,
  },
  cancelado: {
    label: 'Cancelado',
    tone: 'cancelado',
    description: 'Pedido encerrado sem entrega',
    order: 4,
  },
  desconhecido: {
    label: 'Status desconhecido',
    tone: 'desconhecido',
    description: 'Valor fora da máquina de estados — corrigir manualmente',
    order: 99,
  },
}

export function statusLabel(status: OrderStatusValue): string {
  return STATUS_META[status].label
}

/* ---------- Pagamento ---------- */

export const PAYMENT_METHODS = ['pix', 'dinheiro', 'cartao'] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_META: Record<PaymentMethod, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    typeof value === 'string' &&
    (PAYMENT_METHODS as readonly string[]).includes(value)
  )
}

export function normalizePaymentMethod(value: unknown): PaymentMethod | null {
  return isPaymentMethod(value) ? value : null
}

export function paymentMethodLabel(value: PaymentMethod | null): string {
  return value ? PAYMENT_META[value] : 'Não informado'
}

/* ---------- Entidades ---------- */

export interface Actor {
  uid: string
  email: string
}

export interface OrderItem {
  id: string
  name: string
  /** 'salgadas' | 'doces' hoje; mantido aberto para snapshots antigos. */
  category: string | null
  quantity: number
  /** Centavos. */
  unitPrice: number
  /** Centavos. */
  totalPrice: number
}

export interface Order {
  id: string
  customerName: string
  customerContact: string | null
  items: OrderItem[]
  notes: string
  pickupLocation: string
  totalItems: number
  /** Centavos — sempre inteiro. */
  totalAmount: number
  paymentMethod: PaymentMethod | null
  status: OrderStatusValue
  createdAt: Date | null
  updatedAt: Date | null
  statusUpdatedAt: Date | null
  statusUpdatedBy: Actor | null
  lastHistoryId: string | null
}

export interface OrderHistoryEntry {
  id: string
  orderId: string
  fromStatus: OrderStatusValue
  toStatus: OrderStatusValue
  changedAt: Date | null
  changedBy: Actor | null
  reason: string | null
}

/* ---------- Transições ---------- */

/** Avanço normal: exatamente uma etapa. */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pendente: 'em_preparacao',
  em_preparacao: 'pronto',
  pronto: 'entregue',
}

/** Retrocesso: exatamente uma etapa. `entregue` só volta para `pronto`. */
export const PREVIOUS_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  em_preparacao: 'pendente',
  pronto: 'em_preparacao',
  entregue: 'pronto',
}

/** Status que ainda podem ser cancelados. `entregue` e `cancelado` não. */
export function isCancellable(status: OrderStatusValue): boolean {
  return (
    isOrderStatus(status) && status !== 'entregue' && status !== 'cancelado'
  )
}

/** Pedido já encerrado (não deve receber novas ações de avanço). */
export function isFinalized(status: OrderStatusValue): boolean {
  return status === 'entregue' || status === 'cancelado'
}

export function isValidTransition(
  from: OrderStatusValue,
  to: OrderStatusValue,
): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false
  if (from === to) return false
  if (NEXT_STATUS[from] === to) return true
  if (PREVIOUS_STATUS[from] === to) return true
  return to === 'cancelado' && isCancellable(from)
}

/** Retroceder e cancelar exigem motivo registrado no histórico. */
export function requiresReason(
  from: OrderStatusValue,
  to: OrderStatusValue,
): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false
  if (to === 'cancelado') return true
  return PREVIOUS_STATUS[from] === to
}

export type OrderActionKind = 'advance' | 'regress' | 'cancel'

export interface OrderAction {
  kind: OrderActionKind
  to: OrderStatus
  label: string
  requiresReason: boolean
  requiresConfirm: boolean
  destructive: boolean
}

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  pendente: 'Iniciar preparo',
  em_preparacao: 'Marcar como pronto',
  pronto: 'Marcar como entregue',
}

/**
 * Ações que a UI pode oferecer para o status atual.
 * A regra definitiva continua sendo validada no servidor.
 */
export function getOrderActions(status: OrderStatusValue): OrderAction[] {
  if (!isOrderStatus(status)) return []

  const actions: OrderAction[] = []

  const next = NEXT_STATUS[status]
  if (next) {
    actions.push({
      kind: 'advance',
      to: next,
      label: ADVANCE_LABEL[status] ?? `Avançar para ${statusLabel(next)}`,
      requiresReason: false,
      // Concluir o pedido é irreversível na prática: pede confirmação.
      requiresConfirm: next === 'entregue',
      destructive: false,
    })
  }

  const previous = PREVIOUS_STATUS[status]
  if (previous) {
    actions.push({
      kind: 'regress',
      to: previous,
      label: `Voltar para ${statusLabel(previous).toLowerCase()}`,
      requiresReason: true,
      requiresConfirm: true,
      destructive: false,
    })
  }

  if (isCancellable(status)) {
    actions.push({
      kind: 'cancel',
      to: 'cancelado',
      label: 'Cancelar pedido',
      requiresReason: true,
      requiresConfirm: true,
      destructive: true,
    })
  }

  return actions
}

/* ---------- Leitura tolerante de documentos ---------- */

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value)
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.round(parsed) : null
  }
  return null
}

/** Converte Timestamp do Firestore, Date, `{seconds}` ou string ISO em Date. */
export function toDate(value: unknown): Date | null {
  if (!value) return null

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: unknown
      seconds?: unknown
      nanoseconds?: unknown
    }

    if (typeof candidate.toDate === 'function') {
      try {
        const converted = (candidate.toDate as () => unknown)()
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
          return converted
        }
      } catch {
        return null
      }
      return null
    }

    if (typeof candidate.seconds === 'number') {
      const nanos =
        typeof candidate.nanoseconds === 'number' ? candidate.nanoseconds : 0
      return new Date(candidate.seconds * 1000 + Math.round(nanos / 1_000_000))
    }
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function mapActor(value: unknown): Actor | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const uid = asString(raw.uid)
  if (!uid) return null
  return { uid, email: asString(raw.email) ?? '' }
}

function mapItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) return []

  const items: OrderItem[] = []
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return
    const raw = entry as Record<string, unknown>
    const quantity = asInt(raw.quantity) ?? 0
    const unitPrice = asInt(raw.unitPrice) ?? 0
    const totalPrice = asInt(raw.totalPrice) ?? quantity * unitPrice

    items.push({
      id: asString(raw.id) ?? `item-${index}`,
      name: asString(raw.name) ?? 'Item sem nome',
      category: asString(raw.category),
      quantity,
      unitPrice,
      totalPrice,
    })
  })

  return items
}

export function mapOrderDoc(
  id: string,
  data: Record<string, unknown> | null | undefined,
): Order {
  const raw = data ?? {}

  return {
    id,
    customerName: asString(raw.customerName) ?? 'Cliente não identificado',
    customerContact: asString(raw.customerContact),
    items: mapItems(raw.items),
    notes: asString(raw.notes) ?? '',
    pickupLocation: asString(raw.pickupLocation) ?? '',
    totalItems: asInt(raw.totalItems) ?? 0,
    totalAmount: asInt(raw.totalAmount) ?? 0,
    paymentMethod: normalizePaymentMethod(raw.paymentMethod),
    status: normalizeStatus(raw.status),
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
    statusUpdatedAt: toDate(raw.statusUpdatedAt),
    statusUpdatedBy: mapActor(raw.statusUpdatedBy),
    lastHistoryId: asString(raw.lastHistoryId),
  }
}

export function mapHistoryDoc(
  id: string,
  data: Record<string, unknown> | null | undefined,
  orderId?: string,
): OrderHistoryEntry {
  const raw = data ?? {}

  return {
    id,
    orderId: asString(raw.pedidoId) ?? orderId ?? '',
    fromStatus: normalizeStatus(raw.fromStatus),
    toStatus: normalizeStatus(raw.toStatus),
    changedAt: toDate(raw.changedAt),
    changedBy: mapActor(raw.changedBy),
    reason: asString(raw.reason),
  }
}
