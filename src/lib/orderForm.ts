/* ------------------------------------------------------------------
   Contrato do formulário de pedido do site.

   Este módulo é puro (não importa Firebase nem React) para que as
   regras de validação e o formato exato do documento gravado em
   `pedidos` possam ser conferidos e testados isoladamente.

   O documento gerado é o mesmo contrato aceito por `firestore.rules`
   e lido pelo painel administrativo (admin/src/lib/orders.ts).
   ------------------------------------------------------------------ */

/** Limite de caracteres do campo `customerContact` (igual ao das regras). */
export const MAX_CONTACT_LENGTH = 20

/* Valores canônicos de pagamento — os mesmos do enum das regras. */
export const PAYMENT_LABELS = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
} as const

export type PaymentMethod = keyof typeof PAYMENT_LABELS

/** '' representa "não informado" (campo opcional). */
export const PAYMENT_OPTIONS: ReadonlyArray<{
  value: PaymentMethod | ''
  label: string
}> = [
  { value: 'pix', label: PAYMENT_LABELS.pix },
  { value: 'dinheiro', label: PAYMENT_LABELS.dinheiro },
  { value: 'cartao', label: PAYMENT_LABELS.cartao },
  { value: '', label: 'A combinar' },
]

/** Aceita apenas dígitos e separadores comuns de telefone, no limite do campo. */
export const sanitizeContact = (value: string): string =>
  value.replace(/[^\d()+\-\s]/g, '').slice(0, MAX_CONTACT_LENGTH)

export const contactDigits = (value: string): string => value.replace(/\D/g, '')

/**
 * Contato é opcional: string vazia é válida.
 * Quando preenchido, exige DDD + número (10 ou 11 dígitos), aceitando
 * o prefixo 55 do Brasil. Formatação livre (parênteses, espaço, hífen).
 */
export const isContactValid = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return true

  let digits = contactDigits(trimmed)
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)

  return digits.length === 10 || digits.length === 11
}

export interface OrderItemSnapshot {
  id: string
  name: string
  category: 'salgadas' | 'doces'
  quantity: number
  /** Centavos. */
  unitPrice: number
  /** Centavos. */
  totalPrice: number
}

export interface OrderDraft {
  items: OrderItemSnapshot[]
  customerName: string
  /** Opcional. */
  customerContact?: string
  /** Opcional. */
  paymentMethod?: PaymentMethod
  notes: string
  pickupLocation: string
  totalItems: number
  totalAmount: number
}

export interface OrderDocument<TTimestamp = unknown> {
  items: OrderItemSnapshot[]
  customerName: string
  customerContact?: string
  paymentMethod?: PaymentMethod
  notes: string
  pickupLocation: string
  totalItems: number
  totalAmount: number
  status: 'pendente'
  createdAt: TTimestamp
}

/**
 * Monta o documento enviado ao Firestore.
 *
 * Campos opcionais só entram quando preenchidos: as regras usam
 * `keys().hasOnly`, e o Firestore rejeita valores `undefined`.
 * Pedidos sem contato/pagamento continuam válidos, como antes.
 */
export function buildOrderDocument<TTimestamp>(
  draft: OrderDraft,
  createdAt: TTimestamp,
): OrderDocument<TTimestamp> {
  const customerContact = draft.customerContact?.trim() ?? ''

  return {
    items: draft.items,
    customerName: draft.customerName.trim(),
    notes: draft.notes.trim(),
    pickupLocation: draft.pickupLocation,
    totalItems: draft.totalItems,
    totalAmount: draft.totalAmount,
    ...(customerContact ? { customerContact } : {}),
    ...(draft.paymentMethod ? { paymentMethod: draft.paymentMethod } : {}),
    status: 'pendente',
    createdAt,
  }
}
