/* ==================================================================
   PEDIDO EM TEMPO REAL — assina o documento individual.

   O objeto recebido do dashboard é apenas o retrato inicial (snapshot
   da lista). A partir daí, o Firestore passa a ser a fonte da verdade:
   se outro operador alterar o status, o drawer atualiza sozinho.
   ================================================================== */

import { useEffect, useState } from 'react'
import type { AppErrorInfo } from '../lib/errors'
import { subscribeOrder } from '../lib/orderService'
import type { Order } from '../lib/orders'

export interface UseOrderResult {
  order: Order
  error: AppErrorInfo | null
  /** false até o primeiro snapshot do documento chegar. */
  live: boolean
}

export function useOrder(initialOrder: Order): UseOrderResult {
  const [order, setOrder] = useState<Order>(initialOrder)
  const [error, setError] = useState<AppErrorInfo | null>(null)
  const [live, setLive] = useState(false)

  const orderId = initialOrder.id

  useEffect(() => {
    setOrder(initialOrder)
    setError(null)
    setLive(false)

    const unsubscribe = subscribeOrder(
      orderId,
      (nextOrder) => {
        setOrder(nextOrder)
        setError(null)
        setLive(true)
      },
      (nextError) => {
        setError(nextError)
        setLive(false)
      },
    )

    return unsubscribe
    // A assinatura depende apenas do ID: trocar de pedido reinicia o hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  return { order, error, live }
}
