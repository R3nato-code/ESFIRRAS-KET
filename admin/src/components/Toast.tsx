/* ==================================================================
   TOAST — notificações temporárias (erro, sucesso, aviso, info).
   ================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type ToastType = 'info' | 'success' | 'warning' | 'error'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  show: (toast: Omit<Toast, 'id'>) => void
  hide: (id: string) => void
  toasts: Toast[]
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      const entry: Toast = { ...toast, id }
      setToasts((prev) => [...prev, entry])

      if (toast.duration !== 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id))
        }, toast.duration ?? DEFAULT_DURATION)
      }
    },
    [],
  )

  const hide = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const value: ToastContextValue = { show, hide, toasts }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            role="alert"
          >
            <div className="toast__title">{toast.title}</div>
            {toast.message && (
              <div className="toast__message">{toast.message}</div>
            )}
            <button
              type="button"
              className="toast__close"
              onClick={() => hide(toast.id)}
              aria-label="Fechar notificação"
            >
              <span aria-hidden="true">✕</span>
              <span className="sr-only">Fechar</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider.')
  }
  return context
}
