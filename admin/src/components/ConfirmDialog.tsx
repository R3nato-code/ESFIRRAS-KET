/* ==================================================================
   DIÁLOGO DE CONFIRMAÇÃO — usado para cancelar, retroceder e concluir.

   - Esc fecha (quando não está gravando);
   - foco preso no painel enquanto aberto e devolvido ao gatilho ao sair;
   - motivo obrigatório com contador e validação visível;
   - erro exibido dentro do próprio diálogo, com aria-live.
   ================================================================== */

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useFocusTrap } from '../lib/useFocusTrap'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  requireReason?: boolean
  reasonLabel?: string
  reasonPlaceholder?: string
  minReasonLength?: number
  maxReasonLength?: number
  busy?: boolean
  error?: string | null
  onConfirm: (reason: string) => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  tone = 'default',
  requireReason = false,
  reasonLabel = 'Motivo',
  reasonPlaceholder = 'Descreva o motivo desta alteração…',
  minReasonLength = 3,
  maxReasonLength = 280,
  busy = false,
  error = null,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('')

  const panelRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)

  closeRef.current = onClose
  busyRef.current = busy

  useFocusTrap(panelRef, open, {
    initialFocus: requireReason ? textareaRef : cancelRef,
  })

  useEffect(() => {
    if (open) {
      setReason('')
      restoreFocusRef.current = document.activeElement as HTMLElement | null
    }

    return () => {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || busyRef.current) return
      event.stopPropagation()
      closeRef.current()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  if (!open) return null

  const trimmed = reason.trim()
  const tooShort = requireReason && trimmed.length < minReasonLength
  const tooLong = trimmed.length > maxReasonLength
  const reasonId = 'confirm-dialog-reason'
  const hintId = 'confirm-dialog-reason-hint'
  const errorId = 'confirm-dialog-error'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || tooShort || tooLong) return
    onConfirm(requireReason ? trimmed : '')
  }

  return (
    <div
      className="confirm-dialog__overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="confirm-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={description ? 'confirm-dialog-description' : undefined}
        tabIndex={-1}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">
          {title}
        </h2>

        {description && (
          <div
            id="confirm-dialog-description"
            className="confirm-dialog__message"
          >
            {description}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {requireReason && (
            <div className="confirm-dialog__field">
              <label htmlFor={reasonId} className="confirm-dialog__label">
                {reasonLabel}
                <span className="confirm-dialog__required" aria-hidden="true">
                  {' '}
                  *
                </span>
              </label>

              <textarea
                id={reasonId}
                ref={textareaRef}
                className="confirm-dialog__textarea"
                placeholder={reasonPlaceholder}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={maxReasonLength + 20}
                required
                aria-required="true"
                aria-invalid={tooShort || tooLong}
                aria-describedby={hintId}
                disabled={busy}
              />

              <div className="confirm-dialog__field-footer">
                <span
                  id={hintId}
                  className={`confirm-dialog__hint ${tooShort ? 'confirm-dialog__hint--warning' : ''}`}
                >
                  {tooShort
                    ? `Mínimo de ${minReasonLength} caracteres.`
                    : `Este texto fica registrado na linha do tempo.`}
                </span>
                <span className="confirm-dialog__counter">
                  {trimmed.length}/{maxReasonLength}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p id={errorId} className="confirm-dialog__error" role="alert">
              {error}
            </p>
          )}

          <div className="confirm-dialog__actions">
            <button
              type="button"
              ref={cancelRef}
              className="confirm-dialog__btn confirm-dialog__btn--cancel"
              onClick={onClose}
              disabled={busy}
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`confirm-dialog__btn confirm-dialog__btn--confirm ${
                tone === 'danger'
                  ? 'confirm-dialog__btn--danger'
                  : ''
              }`}
              disabled={busy || tooShort || tooLong}
            >
              {busy ? 'Salvando…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
