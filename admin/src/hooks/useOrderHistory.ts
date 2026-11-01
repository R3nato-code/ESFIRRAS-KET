/* ==================================================================
   HISTÓRICO DO PEDIDO EM TEMPO REAL.
   Append-only: a lista só cresce; cada mudança de status confirmada
   aparece na linha do tempo sem recarregar a página.
   ================================================================== */

import { useEffect, useState } from 'react'
import type { AppErrorInfo } from '../lib/errors'
import { subscribeOrderHistory } from '../lib/orderService'
import type { OrderHistoryEntry } from '../lib/orders'

export interface UseOrderHistoryResult {
  entries: OrderHistoryEntry[]
  loading: boolean
  error: AppErrorInfo | null
}

export function useOrderHistory(orderId: string): UseOrderHistoryResult {
  const [entries, setEntries] = useState<OrderHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AppErrorInfo | null>(null)

  useEffect(() => {
    setEntries([])
    setLoading(true)
    setError(null)

    const unsubscribe = subscribeOrderHistory(
      orderId,
      (nextEntries) => {
        setEntries(nextEntries)
        setLoading(false)
        setError(null)
      },
      (nextError) => {
        setError(nextError)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [orderId])

  return { entries, loading, error }
}
