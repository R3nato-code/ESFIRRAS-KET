/* ==================================================================
   ERROS — tradução de códigos do Firestore para mensagens em português.
   A UI nunca mostra stack trace: mostra `toAppError().message`.
   ================================================================== */

export type AppErrorCode =
  | 'permission-denied'
  | 'unauthenticated'
  | 'failed-precondition'
  | 'unavailable'
  | 'aborted'
  | 'not-found'
  | 'conflict'
  | 'invalid-transition'
  | 'invalid-argument'
  | 'unknown'

export interface AppErrorInfo {
  code: AppErrorCode
  title: string
  message: string
  hint?: string
  /** Contexto extra (ex.: `{ currentStatus }` em conflito de transação). */
  details?: Record<string, unknown>
}

export interface OrderServiceErrorOptions {
  hint?: string
  details?: Record<string, unknown>
}

export class OrderServiceError extends Error {
  readonly code: AppErrorCode
  readonly hint?: string
  readonly details?: Record<string, unknown>

  constructor(
    code: AppErrorCode,
    message: string,
    options: OrderServiceErrorOptions = {},
  ) {
    super(message)
    this.name = 'OrderServiceError'
    this.code = code
    this.hint = options.hint
    this.details = options.details
  }
}

const CATALOG: Record<AppErrorCode, AppErrorInfo> = {
  'permission-denied': {
    code: 'permission-denied',
    title: 'Sem permissão',
    message: 'Sua sessão não tem permissão para acessar os pedidos.',
    hint: 'Confirme se a conta tem a claim admin e se as regras do Firestore foram publicadas.',
  },
  unauthenticated: {
    code: 'unauthenticated',
    title: 'Sessão encerrada',
    message: 'Sua sessão expirou. Entre novamente para continuar.',
    hint: 'Faça login novamente com sua conta administrativa.',
  },
  'failed-precondition': {
    code: 'failed-precondition',
    title: 'Índice necessário',
    message: 'Esta consulta precisa de um índice no Firestore.',
    hint: 'Rode `npm run deploy:indexes` e aguarde a criação do índice antes de tentar de novo.',
  },
  unavailable: {
    code: 'unavailable',
    title: 'Sem conexão',
    message: 'Não foi possível falar com o servidor.',
    hint: 'Verifique sua internet e tente novamente.',
  },
  aborted: {
    code: 'aborted',
    title: 'Conflito de concorrência',
    message: 'Outro usuário alterou este pedido ao mesmo tempo.',
    hint: 'Recarregue os dados do pedido antes de tentar novamente.',
  },
  'not-found': {
    code: 'not-found',
    title: 'Pedido não encontrado',
    message: 'Este pedido não existe ou foi removido.',
    hint: 'Atualize a lista de pedidos.',
  },
  conflict: {
    code: 'conflict',
    title: 'Pedido alterado por outra pessoa',
    message: 'O status do pedido mudou enquanto você decidia.',
    hint: 'Confira o status atual e confirme a ação novamente.',
  },
  'invalid-transition': {
    code: 'invalid-transition',
    title: 'Ação não permitida',
    message: 'Este status não permite a mudança solicitada.',
    hint: 'Recarregue o pedido para ver as ações disponíveis.',
  },
  'invalid-argument': {
    code: 'invalid-argument',
    title: 'Dados inválidos',
    message: 'Os dados enviados não são válidos.',
    hint: 'Revise as informações e tente novamente.',
  },
  unknown: {
    code: 'unknown',
    title: 'Erro inesperado',
    message: 'Algo deu errado ao falar com o banco de dados.',
    hint: 'Tente novamente. Se persistir, verifique o console do navegador.',
  },
}

function extractCode(error: unknown): AppErrorCode | null {
  if (!error || typeof error !== 'object') return null
  const raw = (error as { code?: unknown }).code
  if (typeof raw !== 'string') return null

  const normalized = raw.replace(/^firestore\//, '').replace(/^auth\//, '')
  return normalized in CATALOG ? (normalized as AppErrorCode) : null
}

/** Converte qualquer erro em algo seguro de exibir na interface. */
export function toAppError(error: unknown): AppErrorInfo {
  if (error instanceof OrderServiceError) {
    const base = CATALOG[error.code]
    return {
      ...base,
      message: error.message || base.message,
      hint: error.hint ?? base.hint,
      ...(error.details ? { details: error.details } : {}),
    }
  }

  const code = extractCode(error)
  if (code) return CATALOG[code]

  if (error instanceof Error && error.message) {
    // Erros de rede do navegador não vêm com `code` do Firestore.
    if (/network|offline|failed to fetch/i.test(error.message)) {
      return CATALOG.unavailable
    }
  }

  return CATALOG.unknown
}

export function isPermissionError(error: unknown): boolean {
  return toAppError(error).code === 'permission-denied'
}
