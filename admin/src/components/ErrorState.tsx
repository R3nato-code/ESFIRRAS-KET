/* ==================================================================
   ESTADO DE ERRO — título, mensagem, dica opcional e botão de retry.
   ================================================================== */

import { type ReactNode } from 'react'

export interface ErrorStateProps {
  title: string
  message: string
  hint?: string
  onRetry?: () => void
  retryLabel?: string
  icon?: ReactNode
}

export function ErrorState({
  title,
  message,
  hint,
  onRetry,
  retryLabel,
  icon,
}: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state__icon" aria-hidden="true">
        {icon ?? '⚠'}
      </div>
      <h2 className="error-state__title">{title}</h2>
      <p className="error-state__message">{message}</p>
      {hint && <p className="error-state__hint">{hint}</p>}
      {onRetry && (
        <button
          type="button"
          className="btn btn--primary"
          onClick={onRetry}
          style={{ minHeight: '44px' }}
        >
          {retryLabel ?? 'Tentar novamente'}
        </button>
      )}
    </div>
  )
}
