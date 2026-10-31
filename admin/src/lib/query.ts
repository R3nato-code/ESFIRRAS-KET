/* ==================================================================
   BUSCA, FILTROS, PERÍODOS E ORDENAÇÃO — funções puras sobre `Order[]`.
   A consulta ao Firestore (queries/limites) fica em orderService.ts.
   ================================================================== */

import {
  STATUS_META,
  type Order,
  type OrderStatusValue,
} from './orders'

/* ---------- Busca ---------- */

/** Minúsculas, sem acentos e sem espaços nas pontas. */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Busca por nome, telefone ou ID (completo ou curto, com ou sem "#").
 * Termo vazio casa com tudo.
 */
export function orderMatchesSearch(order: Order, term: string): boolean {
  const query = normalizeSearch(term)
  if (!query) return true

  const withoutHash = query.replace(/^#/, '')
  if (!withoutHash) return true

  if (normalizeSearch(order.customerName).includes(query)) return true

  if (order.id.toLowerCase().includes(withoutHash)) return true

  const searchDigits = digitsOnly(withoutHash)
  if (searchDigits.length >= 3 && order.customerContact) {
    const contactDigits = digitsOnly(order.customerContact)
    if (contactDigits.includes(searchDigits)) return true
  }

  return false
}

/* ---------- Período ---------- */

export type PeriodPreset = 'today' | '7d' | '30d' | 'all' | 'custom'

export const PERIOD_OPTIONS: ReadonlyArray<{
  value: PeriodPreset
  label: string
}> = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: 'all', label: 'Tudo' },
  { value: 'custom', label: 'Personalizado' },
]

export interface PeriodRange {
  start: Date | null
  end: Date | null
}

export interface PeriodInput {
  startDate?: string | null
  endDate?: string | null
  now?: Date
}

/**
 * Brasil não observa horário de verão desde 2019, então o offset fixo
 * de -03:00 é seguro para calcular as bordas do dia local.
 */
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/

function brazilStartOfDay(date: Date): Date {
  const shifted = new Date(date.getTime() + BRT_OFFSET_MS)
  const utcMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  )
  return new Date(utcMidnight - BRT_OFFSET_MS)
}

function endOfDay(start: Date): Date {
  return new Date(start.getTime() + DAY_MS - 1)
}

/** "2026-10-31" → 00:00 de 31/10 em Brasília. Inválido → null. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null
  const match = DATE_INPUT.exec(value.trim())
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const start = new Date(Date.UTC(year, month - 1, day) - BRT_OFFSET_MS)

  // Rejeita datas impossíveis, como 2026-02-31.
  const check = new Date(start.getTime() + BRT_OFFSET_MS)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }

  return start
}

export function resolvePeriodRange(
  preset: PeriodPreset,
  input: PeriodInput = {},
): PeriodRange {
  const now = input.now ?? new Date()
  const todayStart = brazilStartOfDay(now)

  switch (preset) {
    case 'today':
      return { start: todayStart, end: endOfDay(todayStart) }
    case '7d':
      return {
        start: new Date(todayStart.getTime() - 6 * DAY_MS),
        end: endOfDay(todayStart),
      }
    case '30d':
      return {
        start: new Date(todayStart.getTime() - 29 * DAY_MS),
        end: endOfDay(todayStart),
      }
    case 'custom': {
      const start = parseDateInput(input.startDate)
      const endStart = parseDateInput(input.endDate)
      return { start, end: endStart ? endOfDay(endStart) : null }
    }
    case 'all':
    default:
      return { start: null, end: null }
  }
}

/* ---------- Filtro combinado ---------- */

export type OrderStatusFilter = OrderStatusValue | 'todos'

export interface OrderFilterInput extends PeriodInput {
  status?: OrderStatusFilter
  period?: PeriodPreset
  search?: string
}

export function filterOrders(
  orders: readonly Order[],
  filters: OrderFilterInput = {},
): Order[] {
  const { status = 'todos', period = 'all', search = '' } = filters
  const { start, end } = resolvePeriodRange(period, filters)

  return orders.filter((order) => {
    if (status !== 'todos' && order.status !== status) return false
    if (!orderMatchesSearch(order, search)) return false

    if (start || end) {
      // Pedidos recém-criados podem chegar sem createdAt resolvido
      // (serverTimestamp pendente). Nesse caso, não os esconda do painel.
      if (!order.createdAt) return true
      const time = order.createdAt.getTime()
      if (start && time < start.getTime()) return false
      if (end && time > end.getTime()) return false
    }

    return true
  })
}

/* ---------- Ordenação ---------- */

export type OrderSort = 'recent' | 'oldest' | 'highest' | 'lowest'

export const SORT_OPTIONS: ReadonlyArray<{ value: OrderSort; label: string }> = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'highest', label: 'Maior valor' },
  { value: 'lowest', label: 'Menor valor' },
]

function timeOf(order: Order): number {
  return order.createdAt ? order.createdAt.getTime() : Number.POSITIVE_INFINITY
}

/** Nunca muta o array recebido. */
export function sortOrders(
  orders: readonly Order[],
  sort: OrderSort = 'recent',
): Order[] {
  const copy = [...orders]

  switch (sort) {
    case 'oldest':
      // Sem data definida vai para o fim.
      return copy.sort((a, b) => timeOf(a) - timeOf(b))
    case 'highest':
      return copy.sort(
        (a, b) => b.totalAmount - a.totalAmount || timeOf(b) - timeOf(a),
      )
    case 'lowest':
      return copy.sort(
        (a, b) => a.totalAmount - b.totalAmount || timeOf(b) - timeOf(a),
      )
    case 'recent':
    default:
      // Sem data definida é, por definição, um pedido recém-criado: vem antes.
      return copy.sort((a, b) => timeOf(b) - timeOf(a))
  }
}

/* ---------- Contagens ---------- */

export function countOrdersByStatus(
  orders: readonly Order[],
): Record<OrderStatusValue, number> {
  const counts: Record<OrderStatusValue, number> = {
    pendente: 0,
    em_preparacao: 0,
    pronto: 0,
    entregue: 0,
    cancelado: 0,
    desconhecido: 0,
  }

  for (const order of orders) {
    counts[order.status] += 1
  }

  return counts
}

/** Status na ordem dos cards de indicadores. */
export const STATUS_CARD_ORDER: readonly OrderStatusValue[] = (
  Object.keys(STATUS_META) as OrderStatusValue[]
).sort((a, b) => STATUS_META[a].order - STATUS_META[b].order)
