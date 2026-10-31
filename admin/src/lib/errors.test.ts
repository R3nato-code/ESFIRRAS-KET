import { describe, expect, it } from 'vitest'
import {
  OrderServiceError,
  isPermissionError,
  toAppError,
} from './errors'

describe('toAppError', () => {
  it('traduz códigos do Firestore', () => {
    const info = toAppError({ code: 'permission-denied' })
    expect(info.code).toBe('permission-denied')
    expect(info.title).toBe('Sem permissão')
    expect(info.message).toMatch(/permissão/i)
  })

  it('aceita o prefixo firestore/ que o SDK às vezes inclui', () => {
    expect(toAppError({ code: 'firestore/failed-precondition' }).code).toBe(
      'failed-precondition',
    )
    expect(toAppError({ code: 'firestore/unavailable' }).code).toBe('unavailable')
  })

  it('respeita a mensagem e a dica de um OrderServiceError', () => {
    const error = new OrderServiceError(
      'conflict',
      'O status mudou enquanto você decidia.',
      { hint: 'Recarregue o pedido.' },
    )
    const info = toAppError(error)
    expect(info.code).toBe('conflict')
    expect(info.message).toBe('O status mudou enquanto você decidia.')
    expect(info.hint).toBe('Recarregue o pedido.')
  })

  it('usa o texto padrão quando OrderServiceError vem sem mensagem', () => {
    const info = toAppError(new OrderServiceError('invalid-transition', ''))
    expect(info.message).toBe('Este status não permite a mudança solicitada.')
  })

  it('reconhece falhas de rede sem código', () => {
    expect(toAppError(new Error('Failed to fetch')).code).toBe('unavailable')
    expect(toAppError(new Error('network error')).code).toBe('unavailable')
  })

  it('cai em "unknown" para valores inesperados', () => {
    expect(toAppError(null).code).toBe('unknown')
    expect(toAppError('boom').code).toBe('unknown')
    expect(toAppError({ code: 'coisa-nova' }).code).toBe('unknown')
  })
})

describe('isPermissionError', () => {
  it('identifica apenas falta de permissão', () => {
    expect(isPermissionError({ code: 'permission-denied' })).toBe(true)
    expect(isPermissionError({ code: 'unavailable' })).toBe(false)
  })
})
