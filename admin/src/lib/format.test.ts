import { describe, expect, it } from 'vitest'
import {
  PENDING_DATE_LABEL,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatPhone,
  formatRelativeTime,
  formatTime,
  formatWeekday,
  shortOrderId,
  telUrl,
  toWhatsAppNumber,
  whatsappUrl,
} from './format'

/** O Intl usa espaço não separável em "R$ 12,34". */
function plain(value: string): string {
  return value.replace(/\u00a0/g, ' ')
}

describe('formatCurrency', () => {
  it('converte centavos em reais', () => {
    expect(plain(formatCurrency(1234))).toBe('R$ 12,34')
    expect(plain(formatCurrency(1))).toBe('R$ 0,01')
    expect(plain(formatCurrency(0))).toBe('R$ 0,00')
    expect(plain(formatCurrency(123456789))).toBe('R$ 1.234.567,89')
  })

  it('não quebra com valores inválidos', () => {
    expect(plain(formatCurrency(null))).toBe('R$ 0,00')
    expect(plain(formatCurrency(undefined))).toBe('R$ 0,00')
    expect(plain(formatCurrency(Number.NaN))).toBe('R$ 0,00')
  })

  it('arredonda centavos fracionários', () => {
    expect(plain(formatCurrency(1234.6))).toBe('R$ 12,35')
  })
})

describe('datas em America/Sao_Paulo', () => {
  it('formata data e hora', () => {
    expect(formatDateTime('2026-10-31T17:30:00.000Z')).toBe('31/10/2026 14:30')
  })

  it('usa meia-noite como 00:00, não 24:00', () => {
    expect(formatDateTime('2026-11-01T03:00:00.000Z')).toBe('01/11/2026 00:00')
    expect(formatTime('2026-11-01T03:00:00.000Z')).toBe('00:00')
  })

  it('formata apenas a data', () => {
    expect(formatDate('2026-10-31T17:30:00.000Z')).toBe('31/10/2026')
  })

  it('mostra a data pendente quando o serverTimestamp não resolveu', () => {
    expect(formatDateTime(null)).toBe(PENDING_DATE_LABEL)
    expect(formatDate(undefined)).toBe(PENDING_DATE_LABEL)
    expect(formatTime(null)).toBe('--:--')
  })

  it('abrevia o dia da semana', () => {
    expect(formatWeekday('2026-10-31T17:30:00.000Z')).toBe('sáb')
  })
})

describe('formatRelativeTime', () => {
  const now = new Date('2026-10-31T15:00:00.000Z')

  it('descreve o passado recente', () => {
    expect(formatRelativeTime(new Date('2026-10-31T14:59:40.000Z'), now)).toBe('agora')
    expect(formatRelativeTime(new Date('2026-10-31T14:55:00.000Z'), now)).toBe('há 5 min')
    expect(formatRelativeTime(new Date('2026-10-31T13:00:00.000Z'), now)).toBe('há 2 h')
    expect(formatRelativeTime(new Date('2026-10-28T15:00:00.000Z'), now)).toBe('há 3 dias')
  })

  it('descreve o futuro (relógio do cliente atrasado)', () => {
    expect(formatRelativeTime(new Date('2026-10-31T15:10:00.000Z'), now)).toBe('em 10 min')
    expect(formatRelativeTime(new Date('2026-11-01T15:00:00.000Z'), now)).toBe('em 1 dia')
  })

  it('trata data ausente', () => {
    expect(formatRelativeTime(null, now)).toBe(PENDING_DATE_LABEL)
  })
})

describe('telefone', () => {
  it('formata celular e fixo', () => {
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678')
    expect(formatPhone('1134567890')).toBe('(11) 3456-7890')
    expect(formatPhone('+55 11 91234-5678')).toBe('(11) 91234-5678')
  })

  it('preserva o texto original quando não reconhece', () => {
    expect(formatPhone('ramal 12')).toBe('ramal 12')
    expect(formatPhone('')).toBe('Não informado')
    expect(formatPhone(null)).toBe('Não informado')
  })

  it('monta o número de WhatsApp com DDI sem duplicar', () => {
    expect(toWhatsAppNumber('11912345678')).toBe('5511912345678')
    expect(toWhatsAppNumber('+55 (11) 91234-5678')).toBe('5511912345678')
    expect(toWhatsAppNumber('1134567890')).toBe('551134567890')
    expect(toWhatsAppNumber('123')).toBeNull()
    expect(toWhatsAppNumber(null)).toBeNull()
  })

  it('gera links apenas com número válido', () => {
    expect(whatsappUrl('11912345678')).toBe('https://wa.me/5511912345678')
    expect(whatsappUrl(null)).toBeNull()
    expect(telUrl('1134567890')).toBe('tel:+551134567890')
    expect(telUrl('abc')).toBeNull()
  })
})

describe('shortOrderId', () => {
  it('encurta com "#" e preserva maiúsculas/minúsculas do ID', () => {
    expect(shortOrderId('AbCdEf123456')).toBe('#AbCdEf')
  })

  it('respeita tamanho customizado', () => {
    expect(shortOrderId('AbCdEf123456', 4)).toBe('#AbCd')
  })

  it('lida com ID vazio', () => {
    expect(shortOrderId('   ')).toBe('—')
  })
})
