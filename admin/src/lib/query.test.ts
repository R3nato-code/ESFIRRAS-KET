import { describe, expect, it } from 'vitest'
import type { Order } from './orders'
import {
  countOrdersByStatus,
  filterOrders,
  normalizeSearch,
  orderMatchesSearch,
  parseDateInput,
  resolvePeriodRange,
  sortOrders,
  STATUS_CARD_ORDER,
} from './query'

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'pedido-1',
    customerName: 'Maria',
    customerContact: null,
    items: [],
    notes: '',
    pickupLocation: 'Balcão',
    totalItems: 1,
    totalAmount: 1000,
    paymentMethod: null,
    status: 'pendente',
    createdAt: new Date('2026-10-31T12:00:00.000Z'),
    updatedAt: null,
    statusUpdatedAt: null,
    statusUpdatedBy: null,
    lastHistoryId: null,
    ...overrides,
  }
}

describe('normalizeSearch', () => {
  it('remove acentos, caixa alta e espaços das pontas', () => {
    expect(normalizeSearch('  Esfirra de CaRiú ')).toBe('esfirra de cariu')
    expect(normalizeSearch('JOÃO')).toBe('joao')
  })
})

describe('orderMatchesSearch', () => {
  const order = makeOrder({
    id: 'AbCdEf123456',
    customerName: 'João da Silva',
    customerContact: '(11) 91234-5678',
  })

  it('casa por nome ignorando acento e caixa', () => {
    expect(orderMatchesSearch(order, 'joao')).toBe(true)
    expect(orderMatchesSearch(order, 'SILVA')).toBe(true)
    expect(orderMatchesSearch(order, 'maria')).toBe(false)
  })

  it('casa por telefone com ou sem máscara', () => {
    expect(orderMatchesSearch(order, '91234')).toBe(true)
    expect(orderMatchesSearch(order, '(11) 91234-5678')).toBe(true)
    expect(orderMatchesSearch(order, '99999')).toBe(false)
  })

  it('casa por ID completo, parcial e com "#"', () => {
    expect(orderMatchesSearch(order, 'AbCdEf123456')).toBe(true)
    expect(orderMatchesSearch(order, '#AbCdE')).toBe(true)
    expect(orderMatchesSearch(order, 'zzz')).toBe(false)
  })

  it('termo vazio casa com tudo', () => {
    expect(orderMatchesSearch(order, '')).toBe(true)
    expect(orderMatchesSearch(order, '   ')).toBe(true)
  })
})

describe('resolvePeriodRange', () => {
  const now = new Date('2026-10-31T15:00:00.000Z') // 12:00 em Brasília

  it('hoje começa e termina no dia de Brasília', () => {
    const range = resolvePeriodRange('today', { now })
    expect(range.start?.toISOString()).toBe('2026-10-31T03:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-11-01T02:59:59.999Z')
  })

  it('considera o dia anterior quando ainda é noite no UTC', () => {
    const range = resolvePeriodRange('today', {
      now: new Date('2026-10-31T02:00:00.000Z'), // 30/10 23:00 em Brasília
    })
    expect(range.start?.toISOString()).toBe('2026-10-30T03:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-10-31T02:59:59.999Z')
  })

  it('7 e 30 dias incluem hoje', () => {
    expect(resolvePeriodRange('7d', { now }).start?.toISOString()).toBe(
      '2026-10-25T03:00:00.000Z',
    )
    expect(resolvePeriodRange('30d', { now }).start?.toISOString()).toBe(
      '2026-10-02T03:00:00.000Z',
    )
  })

  it('tudo não limita nada', () => {
    expect(resolvePeriodRange('all', { now })).toEqual({
      start: null,
      end: null,
    })
  })

  it('intervalo personalizado usa o dia inteiro', () => {
    const range = resolvePeriodRange('custom', {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      now,
    })
    expect(range.start?.toISOString()).toBe('2026-10-01T03:00:00.000Z')
    expect(range.end?.toISOString()).toBe('2026-11-01T02:59:59.999Z')
  })

  it('datas inválidas não geram limite', () => {
    const range = resolvePeriodRange('custom', {
      startDate: '2026-02-31',
      endDate: '31/10/2026',
      now,
    })
    expect(range).toEqual({ start: null, end: null })
  })
})

describe('parseDateInput', () => {
  it('aceita YYYY-MM-DD', () => {
    expect(parseDateInput('2026-10-31')?.toISOString()).toBe(
      '2026-10-31T03:00:00.000Z',
    )
  })

  it('rejeita formatos e datas impossíveis', () => {
    expect(parseDateInput('2026-13-01')).toBeNull()
    expect(parseDateInput('2026-10-32')).toBeNull()
    expect(parseDateInput('')).toBeNull()
    expect(parseDateInput(null)).toBeNull()
  })
})

describe('filterOrders', () => {
  const orders = [
    makeOrder({ id: 'a', status: 'pendente', createdAt: new Date('2026-10-31T03:30:00.000Z') }),
    makeOrder({ id: 'b', status: 'pronto', createdAt: new Date('2026-10-31T02:00:00.000Z') }),
    makeOrder({ id: 'c', status: 'pendente', createdAt: null }),
  ]

  it('filtra por status', () => {
    expect(filterOrders(orders, { status: 'pendente' }).map((order) => order.id)).toEqual(['a', 'c'])
    expect(filterOrders(orders, { status: 'todos' })).toHaveLength(3)
  })

  it('combina período de hoje com o fuso de Brasília', () => {
    const result = filterOrders(orders, {
      period: 'today',
      now: new Date('2026-10-31T15:00:00.000Z'),
    })
    // "b" foi criado às 23:00 de 30/10 em Brasília; "c" ainda não tem data.
    expect(result.map((order) => order.id)).toEqual(['a', 'c'])
  })

  it('busca dentro do conjunto', () => {
    expect(filterOrders(orders, { search: 'pronto' })).toHaveLength(0)
    expect(filterOrders(orders, { search: 'a' }).map((order) => order.id)).toContain('a')
  })
})

describe('sortOrders', () => {
  const orders = [
    makeOrder({ id: 'a', totalAmount: 500, createdAt: new Date('2026-10-31T10:00:00.000Z') }),
    makeOrder({ id: 'b', totalAmount: 2000, createdAt: new Date('2026-10-31T12:00:00.000Z') }),
    makeOrder({ id: 'c', totalAmount: 1000, createdAt: null }),
  ]

  it('mais recentes primeiro, com data pendente no topo', () => {
    expect(sortOrders(orders, 'recent').map((order) => order.id)).toEqual(['c', 'b', 'a'])
  })

  it('mais antigos primeiro, com data pendente no fim', () => {
    expect(sortOrders(orders, 'oldest').map((order) => order.id)).toEqual(['a', 'b', 'c'])
  })

  it('ordena por valor', () => {
    expect(sortOrders(orders, 'highest').map((order) => order.id)).toEqual(['b', 'c', 'a'])
    expect(sortOrders(orders, 'lowest').map((order) => order.id)).toEqual(['a', 'c', 'b'])
  })

  it('não muta o array original', () => {
    const original = [...orders]
    sortOrders(orders, 'highest')
    expect(orders).toEqual(original)
  })
})

describe('countOrdersByStatus', () => {
  it('conta todos os status, inclusive os sem pedido', () => {
    const counts = countOrdersByStatus([
      makeOrder({ status: 'pendente' }),
      makeOrder({ status: 'pendente' }),
      makeOrder({ status: 'pronto' }),
      makeOrder({ status: 'desconhecido' }),
    ])

    expect(counts).toMatchObject({
      pendente: 2,
      em_preparacao: 0,
      pronto: 1,
      entregue: 0,
      cancelado: 0,
      desconhecido: 1,
    })
  })

  it('expõe a ordem dos cards sem cancelado no meio', () => {
    expect(STATUS_CARD_ORDER).toEqual([
      'pendente',
      'em_preparacao',
      'pronto',
      'entregue',
      'cancelado',
      'desconhecido',
    ])
  })
})
