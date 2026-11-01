/* ==================================================================
   FOCO EM DIÁLOGOS — mantém o Tab dentro do container enquanto aberto.

   Não restaura o foco: quem monta o diálogo decide quando e para onde
   devolver o foco (o drawer devolve ao gatilho ao desmontar; o dialog
   devolve ao botão de ação ao fechar).
   ================================================================== */

import { useEffect, type RefObject } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableInside(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE),
  ).filter(
    (element) =>
      element.getAttribute('aria-hidden') !== 'true' &&
      element.getClientRects().length > 0,
  )
}

interface UseFocusTrapOptions {
  /** Elemento que recebe o foco ao abrir (padrão: primeiro focável). */
  initialFocus?: RefObject<HTMLElement | null>
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  options: UseFocusTrapOptions = {},
): void {
  const initialFocus = options.initialFocus

  useEffect(() => {
    const container = containerRef.current
    if (!active || !container) return

    const frame = requestAnimationFrame(() => {
      const preferred = initialFocus?.current
      const target =
        preferred && container.contains(preferred)
          ? preferred
          : focusableInside(container)[0] ?? container

      target.focus({ preventScroll: true })
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return

      const currentContainer = containerRef.current
      if (!currentContainer) return

      const focusable = focusableInside(currentContainer)
      if (focusable.length === 0) {
        event.preventDefault()
        currentContainer.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey) {
        if (activeElement === first || !currentContainer.contains(activeElement)) {
          event.preventDefault()
          last.focus()
        }
        return
      }

      if (activeElement === last || !currentContainer.contains(activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, containerRef, initialFocus])
}
