import { describe, expect, it } from 'vitest'
import {
  getOrderActions,
  isCancellable,
  isValidTransition,
  mapHistoryDoc,
  mapOrderDoc,
  normalizePaymentMethod,
  normalizeStatus,
  paymentMethodLabel,
  requiresReason,
  statusLabel,
  toDate,
} from './orders'

describe('normalizeStatus', () => {
  it('mantém os status canônicos', () => {
    for (const status of ['pendente', 'em_preparacao', 'pronto', 'entregue', 'cancelado']) {
      expect(normalizeStatus(status)).toBe(status)
    }
  })

  it('trata valor legado/desconhecido sem quebrar a UI', () => {
    expect(normalizeStatus('concluido')).toBe('desconhecido')
    expect(normalizeStatus('PENDENTE')).toBe('desconhecido')
    expect(normalizeStatus(null)).toBe('desconhecido')
    expect(normalizeStatus(42)).toBe('desconhecido')
  })

  it('rotula status desconhecido', () => {
    expect(statusLabel('desconhecido')).toBe('Status desconhecido')
    expect(statusLabel('em_preparacao')).toBe('Em preparação')
  })
})

describe('máquina de estados', () => {
  it('permite avanço de uma etapa', () => {
    expect(isValidTransition('pendente', 'em_preparacao')).toBe(true)
    expect(isValidTransition('em_preparacao', 'pronto')).toBe(true)
    expect(isValidTransition('pronto', 'entregue')).toBe(true)
  })

  it('permite retrocesso de uma etapa, inclusive a partir de entregue', () => {
    expect(isValidTransition('em_preparacao', 'pendente')).toBe(true)
    expect(isValidTransition('pronto', 'em_preparacao')).toBe(true)
    expect(isValidTransition('entregue', 'pronto')).toBe(true)
  })

  it('recusa saltos de mais de uma etapa', () => {
    expect(isValidTransition('pendente', 'pronto')).toBe(false)
    expect(isValidTransition('pendente', 'entregue')).toBe(false)
    expect(isValidTransition('em_preparacao', 'entregue')).toBe(false)
  })

  it('permite cancelar enquanto o pedido não foi concluído', () => {
    expect(isValidTransition('pendente', 'cancelado')).toBe(true)
    expect(isValidTransition('em_preparacao', 'cancelado')).toBe(true)
    expect(isValidTransition('pronto', 'cancelado')).toBe(true)
  })

  it('bloqueia cancelamento após entrega e qualquer saída de cancelado', () => {
    expect(isValidTransition('entregue', 'cancelado')).toBe(false)
    expect(isValidTransition('cancelado', 'pendente')).toBe(false)
    expect(isValidTransition('cancelado', 'em_preparacao')).toBe(false)
  })

  it('recusa mesmo status e status inválidos', () => {
    expect(isValidTransition('pendente', 'pendente')).toBe(false)
    expect(isValidTransition('desconhecido', 'pendente')).toBe(false)
    expect(isValidTransition('pendente', 'desconhecido')).toBe(false)
  })

  it('exige motivo em retrocesso e cancelamento', () => {
    expect(requiresReason('pronto', 'em_preparacao')).toBe(true)
    expect(requiresReason('entregue', 'pronto')).toBe(true)
    expect(requiresReason('pendente', 'cancelado')).toBe(true)
    expect(requiresReason('pendente', 'em_preparacao')).toBe(false)
    expect(requiresReason('em_preparacao', 'pronto')).toBe(false)
  })

  it('isCancellable acompanha a máquina', () => {
    expect(isCancellable('pendente')).toBe(true)
    expect(isCancellable('pronto')).toBe(true)
    expect(isCancellable('entregue')).toBe(false)
    expect(isCancellable('cancelado')).toBe(false)
    expect(isCancellable('desconhecido')).toBe(false)
  })
})

describe('getOrderActions', () => {
  it('pendente: avançar e cancelar', () => {
    const actions = getOrderActions('pendente')
    expect(actions.map((action) => action.kind)).toEqual(['advance', 'cancel'])
    expect(actions[0]).toMatchObject({
      to: 'em_preparacao',
      label: 'Iniciar preparo',
      requiresReason: false,
      requiresConfirm: false,
    })
    expect(actions[1]).toMatchObject({
      to: 'cancelado',
      requiresReason: true,
      requiresConfirm: true,
      destructive: true,
    })
  })

  it('em preparação: avançar, retroceder e cancelar', () => {
    const actions = getOrderActions('em_preparacao')
    expect(actions.map((action) => action.to)).toEqual([
      'pronto',
      'pendente',
      'cancelado',
    ])
  })

  it('pronto: concluir exige confirmação', () => {
    const advance = getOrderActions('pronto')[0]
    expect(advance.to).toBe('entregue')
    expect(advance.requiresConfirm).toBe(true)
  })

  it('entregue: só retrocesso, sem cancelamento', () => {
    const actions = getOrderActions('entregue')
    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({
      kind: 'regress',
      to: 'pronto',
      requiresReason: true,
    })
  })

  it('cancelado e desconhecido não oferecem ações', () => {
    expect(getOrderActions('cancelado')).toEqual([])
    expect(getOrderActions('desconhecido')).toEqual([])
  })
})

describe('toDate', () => {
  it('aceita Date', () => {
    const date = new Date('2026-10-31T12:00:00.000Z')
    expect(toDate(date)?.toISOString()).toBe('2026-10-31T12:00:00.000Z')
  })

  it('aceita Timestamp serializado', () => {
    const timestamp = { seconds: 1_793_457_600, nanoseconds: 500_000_000 }
    expect(toDate(timestamp)?.toISOString()).toBe('2026-10-31T14:40:00.500Z')
  })

  it('aceita objeto com toDate (Timestamp do SDK)', () => {
    const date = new Date('2026-10-31T12:00:00.000Z')
    expect(toDate({ toDate: () => date })?.toISOString()).toBe(
      '2026-10-31T12:00:00.000Z',
    )
  })

  it('aceita string ISO e rejeita lixo', () => {
    expect(toDate('2026-10-31T12:00:00.000Z')?.toISOString()).toBe(
      '2026-10-31T12:00:00.000Z',
    )
    expect(toDate('ontem')).toBeNull()
    expect(toDate(null)).toBeNull()
    expect(toDate(undefined)).toBeNull()
    expect(toDate(123)).toBeNull()
  })
})

describe('mapOrderDoc', () => {
  it('normaliza um pedido atual completo', () => {
    const order = mapOrderDoc('pedido-1', {
      customerName: 'Maria',
      customerContact: '11912345678',
      items: [
        {
          id: 'carne',
          name: 'Esfirra de carne',
          category: 'salgadas',
          quantity: 2,
          unitPrice: 800,
          totalPrice: 1600,
        },
      ],
      notes: 'Sem cebola',
      pickupLocation: 'Balcão',
      totalItems: 2,
      totalAmount: 1600,
      paymentMethod: 'pix',
      status: 'em_preparacao',
      createdAt: { seconds: 1_793_457_600, nanoseconds: 0 },
      statusUpdatedBy: { uid: 'uid-1', email: 'admin@foxy.test' },
      lastHistoryId: 'hist-1',
    })

    expect(order).toMatchObject({
      id: 'pedido-1',
      customerName: 'Maria',
      customerContact: '11912345678',
      totalItems: 2,
      totalAmount: 1600,
      paymentMethod: 'pix',
      status: 'em_preparacao',
      notes: 'Sem cebola',
      lastHistoryId: 'hist-1',
    })
    expect(order.items).toHaveLength(1)
    expect(order.items[0].totalPrice).toBe(1600)
    expect(order.createdAt?.toISOString()).toBe('2026-10-31T14:40:00.000Z')
    expect(order.statusUpdatedBy).toEqual({
      uid: 'uid-1',
      email: 'admin@foxy.test',
    })
  })

  it('é compatível com pedido antigo sem contato, pagamento nem histórico', () => {
    const order = mapOrderDoc('pedido-antigo', {
      customerName: 'João',
      items: [],
      pickupLocation: 'Loja',
      totalItems: 1,
      totalAmount: 500,
      status: 'pendente',
    })

    expect(order.customerContact).toBeNull()
    expect(order.paymentMethod).toBeNull()
    expect(order.notes).toBe('')
    expect(order.createdAt).toBeNull()
    expect(order.statusUpdatedAt).toBeNull()
    expect(order.statusUpdatedBy).toBeNull()
    expect(order.lastHistoryId).toBeNull()
  })

  it('não confia em valores invioláveis do documento', () => {
    const order = mapOrderDoc('x', {
      customerName: 123,
      totalAmount: '1234.6',
      totalItems: '3',
      status: 'finalizado',
      paymentMethod: 'boleto',
      items: 'nada',
    })

    expect(order.customerName).toBe('Cliente não identificado')
    expect(order.totalAmount).toBe(1235)
    expect(order.totalItems).toBe(3)
    expect(order.status).toBe('desconhecido')
    expect(order.paymentMethod).toBeNull()
    expect(order.items).toEqual([])
  })

  it('calcula totalPrice do item quando ausente', () => {
    const order = mapOrderDoc('x', {
      items: [{ name: 'Doce', quantity: 3, unitPrice: 450 }],
      status: 'pendente',
    })
    expect(order.items[0].totalPrice).toBe(1350)
  })
})

describe('mapHistoryDoc', () => {
  it('lê motivo e autor', () => {
    const entry = mapHistoryDoc('hist-1', {
      pedidoId: 'pedido-1',
      fromStatus: 'pronto',
      toStatus: 'cancelado',
      changedAt: { seconds: 1_793_457_600, nanoseconds: 0 },
      changedBy: { uid: 'uid-1', email: 'admin@foxy.test' },
      reason: 'Cliente desistiu',
    })

    expect(entry).toMatchObject({
      id: 'hist-1',
      orderId: 'pedido-1',
      fromStatus: 'pronto',
      toStatus: 'cancelado',
      reason: 'Cliente desistiu',
    })
    expect(entry.changedBy?.uid).toBe('uid-1')
  })

  it('usa o orderId de contexto quando o documento não traz pedidoId', () => {
    const entry = mapHistoryDoc('hist-2', { fromStatus: 'pendente', toStatus: 'em_preparacao' }, 'pedido-9')
    expect(entry.orderId).toBe('pedido-9')
    expect(entry.reason).toBeNull()
    expect(entry.changedAt).toBeNull()
    expect(entry.changedBy).toBeNull()
  })
})

describe('pagamento', () => {
  it('aceita apenas os métodos previstos', () => {
    expect(normalizePaymentMethod('pix')).toBe('pix')
    expect(normalizePaymentMethod('dinheiro')).toBe('dinheiro')
    expect(normalizePaymentMethod('cartao')).toBe('cartao')
    expect(normalizePaymentMethod('cartão')).toBeNull()
    expect(normalizePaymentMethod('PIX')).toBeNull()
    expect(normalizePaymentMethod(undefined)).toBeNull()
  })

  it('rotula "Não informado" quando ausente', () => {
    expect(paymentMethodLabel(null)).toBe('Não informado')
    expect(paymentMethodLabel('cartao')).toBe('Cartão')
  })
})
