/* ==================================================================
   FORMATADORES — moeda em centavos, data/hora em America/Sao_Paulo,
   telefone, links de contato e ID curto.
   Funções puras: nenhuma depende de Firebase ou do DOM.
   ================================================================== */

import { toDate } from './orders'

const TIME_ZONE = 'America/Sao_Paulo'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  weekday: 'short',
})

function partsOf(
  formatter: Intl.DateTimeFormat,
  date: Date,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') result[part.type] = part.value
  }
  return result
}

/* ---------- Dinheiro ---------- */

/** Recebe centavos e devolve "R$ 12,34". Valores inválidos viram R$ 0,00. */
export function formatCurrency(cents: number | null | undefined): string {
  const value =
    typeof cents === 'number' && Number.isFinite(cents) ? cents : 0
  return currencyFormatter.format(Math.round(value) / 100)
}

/* ---------- Data e hora ---------- */

export const PENDING_DATE_LABEL = 'Processando data'

/** "31/10/2026 14:30" no horário de Brasília. */
export function formatDateTime(value: unknown): string {
  const date = toDate(value)
  if (!date) return PENDING_DATE_LABEL

  const parts = partsOf(dateTimeFormatter, date)
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}

/** "31/10/2026" no horário de Brasília. */
export function formatDate(value: unknown): string {
  const date = toDate(value)
  if (!date) return PENDING_DATE_LABEL
  return dateFormatter.format(date)
}

/** "14:30" no horário de Brasília. */
export function formatTime(value: unknown): string {
  const date = toDate(value)
  if (!date) return '--:--'
  return timeFormatter.format(date)
}

/** "sáb." — útil para agrupar pedidos do dia. */
export function formatWeekday(value: unknown): string {
  const date = toDate(value)
  if (!date) return ''
  return weekdayFormatter.format(date).replace(/\.$/, '')
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias". */
export function formatRelativeTime(
  value: unknown,
  now: Date = new Date(),
): string {
  const date = toDate(value)
  if (!date) return PENDING_DATE_LABEL

  const diff = date.getTime() - now.getTime()
  const abs = Math.abs(diff)

  if (abs < 60_000) return 'agora'

  const minutes = Math.round(abs / 60_000)
  if (abs < 3_600_000) {
    return diff < 0 ? `há ${minutes} min` : `em ${minutes} min`
  }

  const hours = Math.round(abs / 3_600_000)
  if (abs < 86_400_000) {
    return diff < 0 ? `há ${hours} h` : `em ${hours} h`
  }

  const days = Math.round(abs / 86_400_000)
  const unit = days === 1 ? 'dia' : 'dias'
  return diff < 0 ? `há ${days} ${unit}` : `em ${days} ${unit}`
}

/* ---------- Telefone e contato ---------- */

const COUNTRY_CODE = '55'
const NOT_INFORMED = 'Não informado'

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/** Remove o código do país quando presente, deixando DDD + número. */
function localDigits(value: string): string {
  let digits = digitsOnly(value)
  if (digits.length >= 12 && digits.startsWith(COUNTRY_CODE)) {
    digits = digits.slice(COUNTRY_CODE.length)
  }
  return digits
}

/** "(11) 91234-5678" / "(11) 3456-7890"; devolve o original se não reconhecer. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return NOT_INFORMED

  const trimmed = value.trim()
  if (!trimmed) return NOT_INFORMED

  const digits = localDigits(trimmed)

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return trimmed
}

/**
 * Número no formato aceito pelo WhatsApp (DDI + DDD + número).
 * Retorna null quando não há dígitos suficientes — a UI esconde o link.
 */
export function toWhatsAppNumber(
  value: string | null | undefined,
): string | null {
  if (!value) return null

  const digits = localDigits(value)
  if (digits.length < 10 || digits.length > 11) return null

  return `${COUNTRY_CODE}${digits}`
}

export function whatsappUrl(value: string | null | undefined): string | null {
  const number = toWhatsAppNumber(value)
  return number ? `https://wa.me/${number}` : null
}

export function telUrl(value: string | null | undefined): string | null {
  const number = toWhatsAppNumber(value)
  return number ? `tel:+${number}` : null
}

/* ---------- Identificador ---------- */

/** "#a1b2c3" — o ID completo continua disponível para copiar. */
export function shortOrderId(id: string, size = 6): string {
  const clean = id.trim()
  if (!clean) return '—'
  return `#${clean.slice(0, size)}`
}
